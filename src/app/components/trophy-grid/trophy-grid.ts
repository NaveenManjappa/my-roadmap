import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TrophyCategory } from '../../shared/models/gamification.model';

export interface TrophyViewModel {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: TrophyCategory;
    unlocked: boolean;
    current: number;
    target: number;
}

@Component({
    selector: 'app-trophy-grid',
    imports: [DecimalPipe],
    templateUrl: './trophy-grid.html',
    styleUrls: ['./trophy-grid.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrophyGridComponent {
    readonly trophies = input.required<TrophyViewModel[]>();
    readonly totalPoints = input(0);
    readonly currentStreak = input(0);

    readonly close = output<void>();

    get completionTrophies(): TrophyViewModel[] {
        return this.trophies().filter(t => t.category === 'completion');
    }

    get pointsTrophies(): TrophyViewModel[] {
        return this.trophies().filter(t => t.category === 'points');
    }

    get streakTrophies(): TrophyViewModel[] {
        return this.trophies().filter(t => t.category === 'streak');
    }

    get unlockedCount(): number {
        return this.trophies().filter(t => t.unlocked).length;
    }

    progressPercent(trophy: TrophyViewModel): number {
        if (trophy.target === 0) return 0;
        return Math.min(100, Math.round((trophy.current / trophy.target) * 100));
    }

    onClose(): void {
        this.close.emit();
    }
}
