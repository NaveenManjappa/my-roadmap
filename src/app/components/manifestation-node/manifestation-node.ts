import { Component, Input, Output, EventEmitter, inject, OnInit, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ManifestationNode, LevelEnum, StatusEnum } from '../../shared/models/manifestation.model';
import { ManifestationService } from '../../core/services/manifestation.service';
import { ProgressService } from '../../core/services/progress.service';
import { NodeDialogComponent } from '../node-dialog/node-dialog';

@Component({
  selector: 'app-manifestation-node',
  standalone: true,
  imports: [CommonModule, NodeDialogComponent, forwardRef(() => ManifestationNodeComponent)],
  templateUrl: './manifestation-node.html',
  styleUrls: ['./manifestation-node.css']
})
export class ManifestationNodeComponent implements OnInit {
  @Input() node!: ManifestationNode;
  @Input() isActive = false;
  @Input() isCompleted = false;

  @Output() updated = new EventEmitter<void>();

  private service = inject(ManifestationService);
  private progressService = inject(ProgressService);

  children: ManifestationNode[] = [];
  isExpanded = false;
  isLoadingChildren = false;

  showDialog = false;
  dialogLevel!: LevelEnum;

  StatusEnum = StatusEnum;
  LevelEnum = LevelEnum;

  ngOnInit() {
    // Attempt auto-expand if it's an active top level
    if (this.isActive && this.node.level === LevelEnum.ROADMAP) {
      this.toggleExpand();
    }
  }

  toggleExpand() {
    this.isExpanded = !this.isExpanded;
    if (this.isExpanded && this.children.length === 0) {
      this.loadChildren();
    }
  }

  loadChildren() {
    if (!this.node.id) return;
    this.isLoadingChildren = true;
    this.service.getChildren(this.node.id).subscribe({
      next: (kids) => {
        this.children = kids;
        this.isLoadingChildren = false;
        this.calculateProgress();
      },
      error: () => this.isLoadingChildren = false
    });
  }

  // Start working on the node
  async startBuild() {
    if (!this.node.id) return;

    await this.service.updateNode(this.node.id, {
      status: StatusEnum.PROGRESS
    });

    this.node.status = StatusEnum.PROGRESS;
    this.updated.emit();
  }

  // Completing the current node logic (Trophy Pop triggers via CSS class binding to node.status)
  async markAsCompleted() {
    if (!this.node.id) return;

    // Gamification Points Assignment
    const pointsAwarded = this.progressService.getPointsForLevel(this.node.level);

    await this.service.updateNode(this.node.id, {
      status: StatusEnum.COMPLETED,
      progress: 100,
      points: pointsAwarded
    });

    this.node.status = StatusEnum.COMPLETED;
    this.node.progress = 100;
    this.node.points = pointsAwarded;

    // Notify parent to re-render / calculate its bubbling progress
    this.updated.emit();
  }

  calculateProgress() {
    if (this.children.length === 0) return;

    const completedCount = this.children.filter(c => c.status === StatusEnum.COMPLETED).length;
    const newProgress = this.progressService.calculateParentProgress(this.children.length, completedCount);

    if (newProgress !== this.node.progress) {
      this.node.progress = newProgress;
      if (this.node.id) {
        this.service.updateNode(this.node.id, { progress: newProgress });
        this.updated.emit(); // Bubble up
      }
    }
  }

  // Bubble up from children updates
  onChildUpdated() {
    this.loadChildren();
  }

  async changeStatus(event: Event) {
    const target = event.target as HTMLSelectElement;
    const newStatus = target.value as StatusEnum;

    if (!this.node.id || this.node.status === newStatus) return;

    const updates: Partial<ManifestationNode> = { status: newStatus };

    // Automatically apply rules if forcibly changed to completed manually via dropdown
    if (newStatus === StatusEnum.COMPLETED) {
      updates.points = this.progressService.getPointsForLevel(this.node.level);
      updates.progress = 100;
      this.node.points = updates.points;
      this.node.progress = 100;
    } else if (this.node.status === StatusEnum.COMPLETED) {
      // Reverting from completed strips rigid metrics
      updates.progress = 0;
      updates.points = 0;
      this.node.progress = 0;
      this.node.points = 0;
    }

    await this.service.updateNode(this.node.id, updates);
    this.node.status = newStatus;

    // Trigger visual/math recalculation on tree structure changes
    if (newStatus !== StatusEnum.COMPLETED && this.children.length > 0) {
      this.calculateProgress();
    } else {
      this.updated.emit();
    }
  }

  openAddChildDialog() {
    this.dialogLevel = this.node.level + 1;
    this.showDialog = true;
  }

  closeDialog() {
    this.showDialog = false;
  }

  onChildCreated() {
    this.showDialog = false;
    this.isExpanded = true;
    this.loadChildren();
  }

  getLevelClass(): string {
    return `level-${this.node.level}`;
  }

  getLevelName(lvl: LevelEnum): string {
    switch (lvl) {
      case LevelEnum.ROADMAP: return 'ROADMAP';
      case LevelEnum.PROJECT: return 'PROJECT';
      case LevelEnum.SUB_PROJECT: return 'SUB-PROJECT';
      case LevelEnum.TASK: return 'TASK';
      case LevelEnum.SUB_TASK: return 'SUB-TASK';
      default: return 'NODE';
    }
  }
}
