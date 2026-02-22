export enum LevelEnum {
    ROADMAP = 1,      /* Year-long huge goal */
    PROJECT = 2,      /* Milestone */
    SUB_PROJECT = 3,  /* Feature Set / Epic */
    TASK = 4,         /* Action item */
    SUB_TASK = 5      /* Micro-step */
}

export enum StatusEnum {
    PLANNING = 'planning',
    PROGRESS = 'progress',
    HOLD = 'hold',
    COMPLETED = 'completed'
}

export interface ManifestationNode {
    id?: string;
    userId: string;
    title: string;
    description: string;
    url?: string;
    dueDate?: string;     // ISO Date String or Timestamp
    status: StatusEnum;
    level: LevelEnum;
    progress: number;     // 0 to 100
    parentId: string | null;  // null if it's a Roadmap (Level 1)
    points: number;       // Gamification points awarded

    // 5 Flexible Custom Fields
    customField1?: string;
    customField2?: string;
    customField3?: string;
    customField4?: string;
    customField5?: string;

    // For UI State only
    isExpanded?: boolean;
    children?: ManifestationNode[];
}
