import { Injectable } from '@angular/core';
import { LevelEnum } from '../../shared/models/manifestation.model';

@Injectable({
    providedIn: 'root'
})
export class ProgressService {

    constructor() { }

    // Calculate points based on the level of the node
    getPointsForLevel(level: LevelEnum): number {
        switch (level) {
            case LevelEnum.SUB_TASK: return 5;
            case LevelEnum.TASK: return 20;
            case LevelEnum.SUB_PROJECT: return 50;
            case LevelEnum.PROJECT: return 100;
            case LevelEnum.ROADMAP: return 500;
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
