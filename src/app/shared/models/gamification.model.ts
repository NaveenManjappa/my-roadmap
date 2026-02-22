/* ─── Points & Trophy System Models ─── */

/** Points earnings per completion level */
export const POINTS_TABLE = {
    SUB_TASK: 10,
    TASK: 50,
    SUB_PROJECT: 200,
    PROJECT: 1_000,
} as const;

/** Deadline-early boost multiplier (20 %) */
export const DEADLINE_BOOST = 0.20;

/** Daily streak bonus when streak >= 3 */
export const STREAK_BONUS_PP = 50;

/** Minimum streak length required to earn the daily bonus */
export const STREAK_BONUS_THRESHOLD = 3;

/* ─── User Gamification Profile (persisted per user) ─── */
export interface GamificationProfile {
    totalPoints: number;
    lastActivityDate: string | null;   // ISO date string (YYYY-MM-DD)
    currentStreak: number;

    // Completion counters
    completedSubTasks: number;
    completedTasks: number;
    completedSubProjects: number;
    completedProjects: number;

    // Unlocked trophy IDs
    unlockedTrophies: string[];
}

export function createDefaultProfile(): GamificationProfile {
    return {
        totalPoints: 0,
        lastActivityDate: null,
        currentStreak: 0,
        completedSubTasks: 0,
        completedTasks: 0,
        completedSubProjects: 0,
        completedProjects: 0,
        unlockedTrophies: [],
    };
}

/* ─── Trophy Definitions ─── */
export type TrophyCategory = 'completion' | 'points' | 'streak';

export interface TrophyDefinition {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: TrophyCategory;
    /** Function that checks whether the trophy should be unlocked */
    condition: (p: GamificationProfile) => boolean;
    /** Progress numerator */
    progressCurrent: (p: GamificationProfile) => number;
    /** Progress denominator (target) */
    progressTarget: number;
}

export const TROPHY_DEFINITIONS: TrophyDefinition[] = [
    // ── Completion Trophies ──
    {
        id: 'bronze_star',
        name: 'Bronze Star',
        description: 'Complete 10 sub-tasks',
        icon: '⭐',
        category: 'completion',
        condition: p => p.completedSubTasks >= 10,
        progressCurrent: p => p.completedSubTasks,
        progressTarget: 10,
    },
    {
        id: 'silver_star',
        name: 'Silver Star',
        description: 'Complete 10 tasks',
        icon: '🌟',
        category: 'completion',
        condition: p => p.completedTasks >= 10,
        progressCurrent: p => p.completedTasks,
        progressTarget: 10,
    },
    {
        id: 'gold_star',
        name: 'Gold Star',
        description: 'Complete 5 sub-projects',
        icon: '💫',
        category: 'completion',
        condition: p => p.completedSubProjects >= 5,
        progressCurrent: p => p.completedSubProjects,
        progressTarget: 5,
    },
    {
        id: 'platinum_crown',
        name: 'Platinum Crown',
        description: 'Complete 1 project',
        icon: '👑',
        category: 'completion',
        condition: p => p.completedProjects >= 1,
        progressCurrent: p => p.completedProjects,
        progressTarget: 1,
    },
    {
        id: 'task_master',
        name: 'Task Master',
        description: 'Complete 50 tasks total',
        icon: '🏅',
        category: 'completion',
        condition: p => p.completedTasks >= 50,
        progressCurrent: p => p.completedTasks,
        progressTarget: 50,
    },
    {
        id: 'project_pioneer',
        name: 'Project Pioneer',
        description: 'Complete 3 projects total',
        icon: '🚀',
        category: 'completion',
        condition: p => p.completedProjects >= 3,
        progressCurrent: p => p.completedProjects,
        progressTarget: 3,
    },

    // ── Points Milestones ──
    {
        id: 'endurance_badge',
        name: 'Endurance Badge',
        description: 'Reach 1,000 PP',
        icon: '🎖️',
        category: 'points',
        condition: p => p.totalPoints >= 1_000,
        progressCurrent: p => p.totalPoints,
        progressTarget: 1_000,
    },
    {
        id: 'momentum_badge',
        name: 'Momentum Badge',
        description: 'Reach 5,000 PP',
        icon: '💎',
        category: 'points',
        condition: p => p.totalPoints >= 5_000,
        progressCurrent: p => p.totalPoints,
        progressTarget: 5_000,
    },
    {
        id: 'apex_achiever',
        name: 'Apex Achiever',
        description: 'Reach 10,000 PP',
        icon: '🏆',
        category: 'points',
        condition: p => p.totalPoints >= 10_000,
        progressCurrent: p => p.totalPoints,
        progressTarget: 10_000,
    },

    // ── Streak Trophies ──
    {
        id: 'streak_starter',
        name: 'Streak Starter',
        description: 'Reach a 3-day streak',
        icon: '🔥',
        category: 'streak',
        condition: p => p.currentStreak >= 3,
        progressCurrent: p => p.currentStreak,
        progressTarget: 3,
    },
    {
        id: 'streak_survivor',
        name: 'Streak Survivor',
        description: 'Reach a 7-day streak',
        icon: '⚡',
        category: 'streak',
        condition: p => p.currentStreak >= 7,
        progressCurrent: p => p.currentStreak,
        progressTarget: 7,
    },
    {
        id: 'streak_legend',
        name: 'Streak Legend',
        description: 'Reach a 30-day streak',
        icon: '🌋',
        category: 'streak',
        condition: p => p.currentStreak >= 30,
        progressCurrent: p => p.currentStreak,
        progressTarget: 30,
    },
];
