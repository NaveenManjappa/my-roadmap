import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ManifestationNode, LevelEnum, StatusEnum } from '../../shared/models/manifestation.model';
import { ManifestationService } from '../../core/services/manifestation.service';
import { ProgressService } from '../../core/services/progress.service';

@Component({
  selector: 'app-manifestation-node',
  imports: [CommonModule],
  templateUrl: './manifestation-node.html',
  styleUrls: ['./manifestation-node.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ManifestationNodeComponent {
  @Input() node!: ManifestationNode;
  @Input() isActive = false;
  @Input() isCompleted = false;

  @Output() updated = new EventEmitter<void>();
  @Output() drillIn = new EventEmitter<ManifestationNode>();
  @Output() edit = new EventEmitter<ManifestationNode>();
  @Output() delete = new EventEmitter<ManifestationNode>();

  private service = inject(ManifestationService);
  private progressService = inject(ProgressService);

  StatusEnum = StatusEnum;
  LevelEnum = LevelEnum;

  onCardClick() {
    this.drillIn.emit(this.node);
  }

  onEditClick(event: Event) {
    event.stopPropagation();
    this.edit.emit(this.node);
  }

  onDeleteClick(event: Event) {
    event.stopPropagation();
    this.delete.emit(this.node);
  }

  async changeStatus(newStatus: StatusEnum) {
    if (!this.node.id || this.node.status === newStatus) return;

    const updates: Partial<ManifestationNode> = { status: newStatus };

    if (newStatus === StatusEnum.COMPLETED) {
      updates.points = this.progressService.getPointsForLevel(this.node.level);
      updates.progress = 100;
      this.node.points = updates.points;
      this.node.progress = 100;
    } else if (this.node.status === StatusEnum.COMPLETED) {
      updates.progress = 0;
      updates.points = 0;
      this.node.progress = 0;
      this.node.points = 0;
    }

    await this.service.updateNode(this.node.id, updates);
    this.node.status = newStatus;
    this.updated.emit();
  }

  async cycleStatus() {
    if (!this.node.id) return;
    const order = [StatusEnum.PLANNING, StatusEnum.PROGRESS, StatusEnum.HOLD, StatusEnum.COMPLETED];
    const currentIndex = order.indexOf(this.node.status);
    const nextStatus = order[(currentIndex + 1) % order.length];
    await this.changeStatus(nextStatus);
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

  getStatusLabel(status: StatusEnum): string {
    switch (status) {
      case StatusEnum.PLANNING: return '📋 Plan';
      case StatusEnum.PROGRESS: return '🔥 Active';
      case StatusEnum.HOLD: return '⏸ Hold';
      case StatusEnum.COMPLETED: return '✅ Done';
      default: return status;
    }
  }
}
