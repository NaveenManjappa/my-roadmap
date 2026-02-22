import { Injectable, inject, NgZone, signal, computed } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, updateDoc } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { take } from 'rxjs/operators';
import {
    GamificationProfile,
    TrophyDefinition,
    TROPHY_DEFINITIONS,
    POINTS_TABLE,
    DEADLINE_BOOST,
    STREAK_BONUS_PP,
    STREAK_BONUS_THRESHOLD,
    createDefaultProfile,
} from '../../shared/models/gamification.model';
import { LevelEnum } from '../../shared/models/manifestation.model';

export interface PointsEarning {
    base: number;
    deadlineBoost: number;
    streakBonus: number;
    total: number;
    levelName: string;
    newTrophies: TrophyDefinition[];
}

@Injectable({
    providedIn: 'root',
})
export class GamificationService {
    private firestore = inject(Firestore);
    private authService = inject(AuthService);
    private zone = inject(NgZone);
    private collectionName = 'gamification_profiles';

    /** Reactive signal holding the current profile */
    readonly profile = signal<GamificationProfile>(createDefaultProfile());

    /** Running total of Progress Points */
    readonly totalPoints = computed(() => this.profile().totalPoints);

    /** Current daily streak */
    readonly currentStreak = computed(() => this.profile().currentStreak);

    /** All trophy definitions with unlock status */
    readonly trophies = computed(() => {
        const p = this.profile();
        return TROPHY_DEFINITIONS.map(t => ({
            ...t,
            unlocked: p.unlockedTrophies.includes(t.id),
            current: Math.min(t.progressCurrent(p), t.progressTarget),
            target: t.progressTarget,
        }));
    });

    /** Load the profile from Firestore for the current user */
    async loadProfile(): Promise<void> {
        const uid = await this.getCurrentUid();
        if (!uid) return;

        const docRef = doc(this.firestore, `${this.collectionName}/${uid}`);
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
            const data = snapshot.data() as GamificationProfile;
            this.zone.run(() => this.profile.set(data));
        } else {
            // First time — create default profile
            const defaultProfile = createDefaultProfile();
            await setDoc(docRef, defaultProfile);
            this.zone.run(() => this.profile.set(defaultProfile));
        }
    }

    /**
     * Award points for completing a node. Returns the breakdown for popup display.
     *
     * @param level    The LevelEnum of the completed node
     * @param dueDate  Optional ISO date string; triggers deadline boost if completed before
     */
    async awardCompletion(level: LevelEnum, dueDate?: string): Promise<PointsEarning> {
        const uid = await this.getCurrentUid();
        if (!uid) {
            return { base: 0, deadlineBoost: 0, streakBonus: 0, total: 0, levelName: '', newTrophies: [] };
        }

        const profile = { ...this.profile() };

        // 1. Base points
        const base = this.getBasePoints(level);

        // 2. Deadline boost (+20 % if before deadline)
        let deadlineBoost = 0;
        if (dueDate) {
            const dueDateObj = new Date(dueDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            dueDateObj.setHours(0, 0, 0, 0);
            if (today <= dueDateObj) {
                deadlineBoost = Math.round(base * DEADLINE_BOOST);
            }
        }

        // 3. Streak update
        const todayStr = this.getTodayString();
        let streakBonus = 0;

        if (profile.lastActivityDate === null) {
            // First ever activity
            profile.currentStreak = 1;
        } else if (profile.lastActivityDate === todayStr) {
            // Already active today — streak unchanged
        } else {
            const lastDate = new Date(profile.lastActivityDate);
            const today = new Date(todayStr);
            const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                profile.currentStreak += 1;
            } else {
                // Gap > 1 day — reset
                profile.currentStreak = 1;
            }
        }
        profile.lastActivityDate = todayStr;

        // Award streak bonus if threshold met
        if (profile.currentStreak >= STREAK_BONUS_THRESHOLD) {
            // Only award once per day; we check if we already incremented the streak today
            // (if lastActivityDate was already today, we didn't re-enter the streak block above)
            // So only add bonus when the streak was actually updated (not already today)
            const wasTodayAlready = this.profile().lastActivityDate === todayStr;
            if (!wasTodayAlready) {
                streakBonus = STREAK_BONUS_PP;
            }
        }

        // 4. Increment counters
        this.incrementCounter(profile, level);

        // 5. Update total
        const total = base + deadlineBoost + streakBonus;
        profile.totalPoints += total;

        // 6. Check which new trophies are unlocked
        const newTrophies: TrophyDefinition[] = [];
        for (const trophy of TROPHY_DEFINITIONS) {
            if (!profile.unlockedTrophies.includes(trophy.id) && trophy.condition(profile)) {
                profile.unlockedTrophies = [...profile.unlockedTrophies, trophy.id];
                newTrophies.push(trophy);
            }
        }

        // 7. Persist
        const docRef = doc(this.firestore, `${this.collectionName}/${uid}`);
        await updateDoc(docRef, { ...profile });

        // 8. Update local signal
        this.zone.run(() => this.profile.set(profile));

        return {
            base,
            deadlineBoost,
            streakBonus,
            total,
            levelName: this.getLevelName(level),
            newTrophies,
        };
    }

    /**
     * Reverse points when un-completing a node (toggling back from completed).
     */
    async reverseCompletion(level: LevelEnum, pointsToRemove: number): Promise<void> {
        const uid = await this.getCurrentUid();
        if (!uid) return;

        const profile = { ...this.profile() };

        // Decrement counter
        this.decrementCounter(profile, level);

        // Remove points (floor at 0)
        profile.totalPoints = Math.max(0, profile.totalPoints - pointsToRemove);

        // Re-check trophies (some might now be invalid — but we keep them unlocked as a "forever" badge)
        // Trophies are NOT revoked once earned

        const docRef = doc(this.firestore, `${this.collectionName}/${uid}`);
        await updateDoc(docRef, { ...profile });

        this.zone.run(() => this.profile.set(profile));
    }

    // ─── Helpers ───

    private getBasePoints(level: LevelEnum): number {
        switch (level) {
            case LevelEnum.SUB_TASK: return POINTS_TABLE.SUB_TASK;
            case LevelEnum.TASK: return POINTS_TABLE.TASK;
            case LevelEnum.SUB_PROJECT: return POINTS_TABLE.SUB_PROJECT;
            case LevelEnum.PROJECT: return POINTS_TABLE.PROJECT;
            default: return 0;
        }
    }

    private getLevelName(level: LevelEnum): string {
        switch (level) {
            case LevelEnum.SUB_TASK: return 'Sub-Task';
            case LevelEnum.TASK: return 'Task';
            case LevelEnum.SUB_PROJECT: return 'Sub-Project';
            case LevelEnum.PROJECT: return 'Project';
            case LevelEnum.ROADMAP: return 'Roadmap';
            default: return 'Item';
        }
    }

    private incrementCounter(profile: GamificationProfile, level: LevelEnum): void {
        switch (level) {
            case LevelEnum.SUB_TASK: profile.completedSubTasks++; break;
            case LevelEnum.TASK: profile.completedTasks++; break;
            case LevelEnum.SUB_PROJECT: profile.completedSubProjects++; break;
            case LevelEnum.PROJECT: profile.completedProjects++; break;
        }
    }

    private decrementCounter(profile: GamificationProfile, level: LevelEnum): void {
        switch (level) {
            case LevelEnum.SUB_TASK: profile.completedSubTasks = Math.max(0, profile.completedSubTasks - 1); break;
            case LevelEnum.TASK: profile.completedTasks = Math.max(0, profile.completedTasks - 1); break;
            case LevelEnum.SUB_PROJECT: profile.completedSubProjects = Math.max(0, profile.completedSubProjects - 1); break;
            case LevelEnum.PROJECT: profile.completedProjects = Math.max(0, profile.completedProjects - 1); break;
        }
    }

    private getTodayString(): string {
        const now = new Date();
        return now.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    private getCurrentUid(): Promise<string | null> {
        return new Promise(resolve => {
            this.authService.user$.pipe(take(1)).subscribe(user => {
                resolve(user?.uid ?? null);
            });
        });
    }
}
