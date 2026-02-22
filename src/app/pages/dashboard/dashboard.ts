import { Component, inject, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ManifestationService } from '../../core/services/manifestation.service';
import { ProgressService } from '../../core/services/progress.service';
import { Router } from '@angular/router';
import { ManifestationNode, LevelEnum, StatusEnum } from '../../shared/models/manifestation.model';
import { ManifestationNodeComponent } from '../../components/manifestation-node/manifestation-node';
import { NodeDialogComponent } from '../../components/node-dialog/node-dialog';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ManifestationNodeComponent, NodeDialogComponent],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private manifestationService = inject(ManifestationService);
  private progressService = inject(ProgressService);
  private router = inject(Router);
  private zone = inject(NgZone);

  totalPoints = 0;

  // All roadmaps (for sidebar)
  allRoadmaps: ManifestationNode[] = [];
  blueprints: ManifestationNode[] = [];
  activeBuilds: ManifestationNode[] = [];
  hallOfFame: ManifestationNode[] = [];

  // Filtered lists for search
  filteredBlueprints: ManifestationNode[] = [];
  filteredActiveBuilds: ManifestationNode[] = [];
  filteredHallOfFame: ManifestationNode[] = [];
  searchQuery = '';

  // Selected roadmap (highlighted in sidebar)
  selectedRoadmap: ManifestationNode | null = null;

  // Drill-down navigation
  breadcrumb: ManifestationNode[] = [];
  currentViewNode: ManifestationNode | null = null;
  currentChildren: ManifestationNode[] = [];
  isLoadingChildren = false;

  // Sidebar state
  isSidebarCollapsed = false;
  isMobileSidebarOpen = false;

  // Dialog state
  isDialogOpen = false;
  dialogLevel: LevelEnum = LevelEnum.ROADMAP;
  dialogParentId: string | null = null;

  LevelEnum = LevelEnum;
  StatusEnum = StatusEnum;

  ngOnInit() {
    this.authService.user$.subscribe(user => {
      if (!user) {
        this.router.navigate(['/auth']);
      } else {
        this.loadRoadmaps();
      }
    });
  }

  // ─── Sidebar / Roadmap Loading ───

  loadRoadmaps() {
    this.manifestationService.getNodesByLevel(LevelEnum.ROADMAP).subscribe((nodes: ManifestationNode[]) => {
      this.zone.run(() => {
        this.allRoadmaps = nodes;
        this.blueprints = nodes.filter(n => n.status === StatusEnum.PLANNING);
        this.activeBuilds = nodes.filter(n => n.status === StatusEnum.PROGRESS || n.status === StatusEnum.HOLD);
        this.hallOfFame = nodes.filter(n => n.status === StatusEnum.COMPLETED);
        this.filterRoadmaps();
        this.calculateTotalPoints(nodes);

        // Auto-select first active roadmap if nothing selected
        if (!this.selectedRoadmap && nodes.length > 0) {
          const autoSelect = this.activeBuilds[0] || this.blueprints[0] || nodes[0];
          this.selectRoadmap(autoSelect);
        }

        // Refresh current breadcrumb root if it was updated
        if (this.selectedRoadmap) {
          const updated = nodes.find(n => n.id === this.selectedRoadmap!.id);
          if (updated) {
            this.selectedRoadmap = updated;
            if (this.breadcrumb.length > 0 && this.breadcrumb[0].id === updated.id) {
              this.breadcrumb[0] = updated;
            }
            if (this.currentViewNode?.id === updated.id) {
              this.currentViewNode = updated;
            }
          }
        }
      });
    });
  }

  filterRoadmaps() {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) {
      this.filteredBlueprints = this.blueprints;
      this.filteredActiveBuilds = this.activeBuilds;
      this.filteredHallOfFame = this.hallOfFame;
    } else {
      this.filteredBlueprints = this.blueprints.filter(n => n.title.toLowerCase().includes(q));
      this.filteredActiveBuilds = this.activeBuilds.filter(n => n.title.toLowerCase().includes(q));
      this.filteredHallOfFame = this.hallOfFame.filter(n => n.title.toLowerCase().includes(q));
    }
  }

  calculateTotalPoints(nodes: ManifestationNode[]) {
    this.totalPoints = nodes.reduce((sum, node) => sum + (node.points || 0), 0);
  }

  // ─── Navigation: Select, Drill, Breadcrumb ───

  selectRoadmap(node: ManifestationNode) {
    this.selectedRoadmap = node;
    this.breadcrumb = [node];
    this.currentViewNode = node;
    this.isMobileSidebarOpen = false;
    this.loadCurrentChildren();
  }

  drillInto(node: ManifestationNode) {
    this.breadcrumb = [...this.breadcrumb, node];
    this.currentViewNode = node;
    this.loadCurrentChildren();
  }

  navigateToBreadcrumb(index: number) {
    this.breadcrumb = this.breadcrumb.slice(0, index + 1);
    this.currentViewNode = this.breadcrumb[index];
    if (index === 0 && this.breadcrumb[0]) {
      this.selectedRoadmap = this.breadcrumb[0];
    }
    this.loadCurrentChildren();
  }

  goBack() {
    if (this.breadcrumb.length > 1) {
      this.navigateToBreadcrumb(this.breadcrumb.length - 2);
    }
  }

  // ─── Children Loading ───

  loadCurrentChildren() {
    if (!this.currentViewNode?.id) return;
    if (this.currentViewNode.level >= LevelEnum.SUB_TASK) {
      // Sub-tasks have no children
      this.currentChildren = [];
      return;
    }
    this.isLoadingChildren = true;
    this.manifestationService.getChildren(this.currentViewNode.id).subscribe(children => {
      this.zone.run(() => {
        this.currentChildren = children;
        this.isLoadingChildren = false;
        this.recalculateCurrentNodeProgress();
      });
    });
  }

  recalculateCurrentNodeProgress() {
    if (this.currentChildren.length === 0 || !this.currentViewNode?.id) return;
    const completedCount = this.currentChildren.filter(c => c.status === StatusEnum.COMPLETED).length;
    const newProgress = this.progressService.calculateParentProgress(this.currentChildren.length, completedCount);
    if (newProgress !== this.currentViewNode.progress) {
      this.currentViewNode.progress = newProgress;
      this.manifestationService.updateNode(this.currentViewNode.id, { progress: newProgress });
    }
  }

  getChildrenByStatus(status: StatusEnum): ManifestationNode[] {
    return this.currentChildren.filter(c => c.status === status);
  }

  getSortedChildren(): ManifestationNode[] {
    return [...this.currentChildren].sort((a, b) => {
      if (a.status === StatusEnum.COMPLETED && b.status !== StatusEnum.COMPLETED) return 1;
      if (a.status !== StatusEnum.COMPLETED && b.status === StatusEnum.COMPLETED) return -1;
      return 0;
    });
  }

  // ─── Child Updated (from kanban card status chip) ───

  onChildUpdated() {
    this.loadCurrentChildren();
    this.loadRoadmaps();
  }

  // ─── Current Node Actions ───

  async startCurrentNode() {
    if (!this.currentViewNode?.id) return;
    await this.manifestationService.updateNode(this.currentViewNode.id, {
      status: StatusEnum.PROGRESS
    });
    this.currentViewNode.status = StatusEnum.PROGRESS;
    this.loadRoadmaps();
  }

  async completeCurrentNode() {
    if (!this.currentViewNode?.id) return;
    const pts = this.progressService.getPointsForLevel(this.currentViewNode.level);
    await this.manifestationService.updateNode(this.currentViewNode.id, {
      status: StatusEnum.COMPLETED,
      progress: 100,
      points: pts
    });
    this.currentViewNode.status = StatusEnum.COMPLETED;
    this.currentViewNode.progress = 100;
    this.currentViewNode.points = pts;
    this.loadRoadmaps();
  }

  // ─── Task / Sub-Task Toggle ───

  async toggleTaskComplete(node: ManifestationNode) {
    if (!node.id) return;
    if (node.status === StatusEnum.COMPLETED) {
      await this.manifestationService.updateNode(node.id, {
        status: StatusEnum.PROGRESS,
        progress: 0,
        points: 0
      });
      node.status = StatusEnum.PROGRESS;
      node.progress = 0;
      node.points = 0;
    } else {
      const pts = this.progressService.getPointsForLevel(node.level);
      await this.manifestationService.updateNode(node.id, {
        status: StatusEnum.COMPLETED,
        progress: 100,
        points: pts
      });
      node.status = StatusEnum.COMPLETED;
      node.progress = 100;
      node.points = pts;
    }
    this.recalculateCurrentNodeProgress();
    this.loadRoadmaps();
  }

  async cycleTaskStatus(node: ManifestationNode) {
    if (!node.id) return;
    const order = [StatusEnum.PLANNING, StatusEnum.PROGRESS, StatusEnum.HOLD, StatusEnum.COMPLETED];
    const currentIndex = order.indexOf(node.status);
    const nextStatus = order[(currentIndex + 1) % order.length];

    const updates: Partial<ManifestationNode> = { status: nextStatus };
    if (nextStatus === StatusEnum.COMPLETED) {
      updates.points = this.progressService.getPointsForLevel(node.level);
      updates.progress = 100;
      node.points = updates.points;
      node.progress = 100;
    } else if (node.status === StatusEnum.COMPLETED) {
      updates.progress = 0;
      updates.points = 0;
      node.progress = 0;
      node.points = 0;
    }
    await this.manifestationService.updateNode(node.id, updates);
    node.status = nextStatus;
    this.recalculateCurrentNodeProgress();
    this.loadRoadmaps();
  }

  // ─── Dialog ───

  openNewRoadmapDialog() {
    this.dialogLevel = LevelEnum.ROADMAP;
    this.dialogParentId = null;
    this.isDialogOpen = true;
  }

  openAddChildDialog() {
    if (!this.currentViewNode?.id || this.currentViewNode.level >= LevelEnum.SUB_TASK) return;
    this.dialogLevel = (this.currentViewNode.level + 1) as LevelEnum;
    this.dialogParentId = this.currentViewNode.id;
    this.isDialogOpen = true;
  }

  closeDialog() {
    this.isDialogOpen = false;
  }

  onNodeCreated() {
    this.closeDialog();
    this.loadRoadmaps();
    this.loadCurrentChildren();
  }

  // ─── Sidebar Toggle ───

  toggleSidebar() {
    if (window.innerWidth <= 768) {
      this.isMobileSidebarOpen = !this.isMobileSidebarOpen;
    } else {
      this.isSidebarCollapsed = !this.isSidebarCollapsed;
    }
  }

  logout() {
    this.authService.logout();
  }

  // ─── Helpers ───

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

  getChildLevelName(level: LevelEnum): string {
    return this.getLevelName((level + 1) as LevelEnum);
  }

  getStatusLabel(status: StatusEnum): string {
    switch (status) {
      case StatusEnum.PLANNING: return '📋 Planning';
      case StatusEnum.PROGRESS: return '🔥 Active';
      case StatusEnum.HOLD: return '⏸ On Hold';
      case StatusEnum.COMPLETED: return '✅ Completed';
      default: return status;
    }
  }

  getStatusDotClass(status: StatusEnum): string {
    switch (status) {
      case StatusEnum.PLANNING: return 'planning';
      case StatusEnum.PROGRESS: return 'progress';
      case StatusEnum.HOLD: return 'hold';
      case StatusEnum.COMPLETED: return 'completed';
      default: return '';
    }
  }

  /** Whether the current view shows children in kanban columns */
  get showKanban(): boolean {
    return !!this.currentViewNode && this.currentViewNode.level <= LevelEnum.PROJECT && this.currentChildren.length > 0;
  }

  /** Whether the current view shows children as a task list */
  get showTaskList(): boolean {
    return !!this.currentViewNode && this.currentViewNode.level === LevelEnum.SUB_PROJECT && this.currentChildren.length > 0;
  }

  /** Whether the current view shows children as a checklist */
  get showChecklist(): boolean {
    return !!this.currentViewNode && this.currentViewNode.level === LevelEnum.TASK && this.currentChildren.length > 0;
  }

  /** Whether children can be added at this level */
  get canAddChildren(): boolean {
    return !!this.currentViewNode && this.currentViewNode.level < LevelEnum.SUB_TASK;
  }
}
