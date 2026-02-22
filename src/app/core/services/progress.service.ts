import { Injectable } from '@angular/core';
import { LevelEnum } from '../../shared/models/manifestation.model';
import { POINTS_TABLE } from '../../shared/models/gamification.model';

@Injectable({
    providedIn: 'root'
})
export class ProgressService {

    constructor() { }

    // Calculate points based on the level of the node (updated PP values)
    getPointsForLevel(level: LevelEnum): number {
        switch (level) {
            case LevelEnum.SUB_TASK: return POINTS_TABLE.SUB_TASK;
            case LevelEnum.TASK: return POINTS_TABLE.TASK;
            case LevelEnum.SUB_PROJECT: return POINTS_TABLE.SUB_PROJECT;
            case LevelEnum.PROJECT: return POINTS_TABLE.PROJECT;
            case LevelEnum.ROADMAP: return 0; // Roadmaps don't earn points directly
            default: return 0;
        }
    }

    // Calculate progress of a parent based on its children's progress
    // E.g. 5 tasks, 2 completed = 40%
    // This is a simple calculation; can be weighted if needed
    calculateParentProgress(childrenCount: number, completedCount: number): number {
        if (childrenCount === 0) return 0;
        return Math.round((completedCount / childrenCount) * 100);
    }
}
