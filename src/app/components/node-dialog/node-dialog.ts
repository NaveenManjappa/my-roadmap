import { Component, Input, Output, EventEmitter, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ManifestationNode, LevelEnum, StatusEnum } from '../../shared/models/manifestation.model';
import { ManifestationService } from '../../core/services/manifestation.service';

@Component({
  selector: 'app-node-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './node-dialog.html',
  styleUrls: ['./node-dialog.css']
})
export class NodeDialogComponent {
  @Input() level!: LevelEnum;
  @Input() parentId: string | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private manifestationService = inject(ManifestationService);
  private zone = inject(NgZone);

  title = '';
  description = '';
  dueDate = '';
  url = '';

  // Custom fields
  priority = 'Medium';
  effort = 'Unknown';

  isSubmitting = false;

  LevelEnum = LevelEnum;

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

    // Build the node
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
