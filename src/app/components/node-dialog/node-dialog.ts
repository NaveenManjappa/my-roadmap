import { Component, Input, Output, EventEmitter, inject, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ManifestationNode, LevelEnum, StatusEnum } from '../../shared/models/manifestation.model';
import { ManifestationService } from '../../core/services/manifestation.service';
import { ProgressService } from '../../core/services/progress.service';

@Component({
  selector: 'app-node-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './node-dialog.html',
  styleUrls: ['./node-dialog.css']
})
export class NodeDialogComponent implements OnInit {
  @Input() level!: LevelEnum;
  @Input() parentId: string | null = null;
  /** When set, the dialog opens in edit mode for this node */
  @Input() editNode: ManifestationNode | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private manifestationService = inject(ManifestationService);
  private progressService = inject(ProgressService);
  private zone = inject(NgZone);

  title = '';
  description = '';
  dueDate = '';
  url = '';
  status: StatusEnum = StatusEnum.PLANNING;

  // Custom fields
  priority = 'Medium';
  effort = 'Unknown';

  isSubmitting = false;
  isEditMode = false;

  LevelEnum = LevelEnum;
  StatusEnum = StatusEnum;

  ngOnInit() {
    if (this.editNode) {
      this.isEditMode = true;
      this.title = this.editNode.title || '';
      this.description = this.editNode.description || '';
      this.dueDate = this.editNode.dueDate || '';
      this.url = this.editNode.url || '';
      this.status = this.editNode.status;
      this.priority = this.editNode.customField1 || 'Medium';
      this.effort = this.editNode.customField2 || 'Unknown';
      this.level = this.editNode.level;
    }
  }

  getLevelName(lvl: LevelEnum): string {
    switch (lvl) {
      case LevelEnum.ROADMAP: return 'Roadmap';
      case LevelEnum.PROJECT: return 'Project';
      case LevelEnum.SUB_PROJECT: return 'Sub-Project';
      case LevelEnum.TASK: return 'Task';
      case LevelEnum.SUB_TASK: return 'Sub-Task';
      default: return 'Item';
    }
  }

  errorMessage = '';

  async save() {
    if (!this.title.trim()) return;
    this.isSubmitting = true;
    this.errorMessage = '';

    if (this.isEditMode && this.editNode?.id) {
      // ── UPDATE existing node ──
      const previousStatus = this.editNode.status;
      const updates: Partial<ManifestationNode> = {
        title: this.title,
        description: this.description,
        dueDate: this.dueDate,
        url: this.url,
        status: this.status,
        customField1: this.priority,
        customField2: this.effort
      };

      // Award points when status changes to completed
      if (this.status === StatusEnum.COMPLETED && previousStatus !== StatusEnum.COMPLETED) {
        updates.points = this.progressService.getPointsForLevel(this.editNode.level);
        updates.progress = 100;
      }
      // Remove points when moving away from completed
      if (this.status !== StatusEnum.COMPLETED && previousStatus === StatusEnum.COMPLETED) {
        updates.points = 0;
        updates.progress = 0;
      }

      try {
        await this.manifestationService.updateNode(this.editNode.id, updates);
        this.zone.run(() => {
          this.isSubmitting = false;
          this.saved.emit();
        });
      } catch (err: any) {
        this.zone.run(() => {
          this.errorMessage = err?.message || 'Failed to update. Check your permissions.';
          this.isSubmitting = false;
        });
        console.error('Failed to update node', err);
      }
    } else {
      // ── CREATE new node ──
      const newNode: ManifestationNode = {
        userId: '', // Populated by service securely
        title: this.title,
        description: this.description,
        dueDate: this.dueDate,
        url: this.url,
        level: this.level,
        parentId: this.parentId,
        status: StatusEnum.PLANNING,
        progress: 0,
        points: 0, // Assigned on completion
        customField1: this.priority,
        customField2: this.effort
      };

      try {
        await this.manifestationService.createNode(newNode);
        this.zone.run(() => {
          this.isSubmitting = false;
          this.saved.emit();
        });
      } catch (err: any) {
        this.zone.run(() => {
          this.errorMessage = err?.message || 'Permission denied. Ensure your Firestore Database Rules allow read/write access.';
          this.isSubmitting = false;
        });
        console.error('Failed to create node', err);
      }
    }
  }
}
