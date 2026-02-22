import { Component, inject, OnInit, OnDestroy, NgZone, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ManifestationService } from '../../core/services/manifestation.service';
import { ProgressService } from '../../core/services/progress.service';
import { GamificationService, PointsEarning } from '../../core/services/gamification.service';
import { ThemeService } from '../../core/services/theme.service';
import { Router } from '@angular/router';
import { ManifestationNode, LevelEnum, StatusEnum } from '../../shared/models/manifestation.model';
import { TrophyDefinition } from '../../shared/models/gamification.model';
import { ManifestationNodeComponent } from '../../components/manifestation-node/manifestation-node';
import { NodeDialogComponent } from '../../components/node-dialog/node-dialog';
import { PointsPopupComponent } from '../../components/points-popup/points-popup';
import { TrophyGridComponent } from '../../components/trophy-grid/trophy-grid';
import { Subscription } from 'rxjs';

export type ViewMode = 'board' | 'list';
export type SearchFilter = 'all' | 'planning' | 'progress' | 'completed' | 'hold';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule, ManifestationNodeComponent, NodeDialogComponent, PointsPopupComponent, TrophyGridComponent],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private manifestationService = inject(ManifestationService);
  private progressService = inject(ProgressService);
  protected gamificationService = inject(GamificationService);
  protected themeService = inject(ThemeService);
  private router = inject(Router);
  private zone = inject(NgZone);

  // Subscription management to prevent stale listeners
  private roadmapsSub?: Subscription;
  private childrenSub?: Subscription;
  private pointsSub?: Subscription;
  private authSub?: Subscription;

  // Points popup state
  showPointsPopup = false;
  latestEarning: PointsEarning | null = null;

  // Trophy panel state
  showTrophyPanel = false;

  // All roadmaps (for sidebar)
  allRoadmaps: ManifestationNode[] = [];
  allNodes: ManifestationNode[] = [];
  blueprints: ManifestationNode[] = [];
  activeBuilds: ManifestationNode[] = [];
  hallOfFame: ManifestationNode[] = [];
  onHoldRoadmaps: ManifestationNode[] = [];

  // Filtered lists for search
  filteredBlueprints: ManifestationNode[] = [];
  filteredActiveBuilds: ManifestationNode[] = [];
  filteredHallOfFame: ManifestationNode[] = [];
  filteredOnHold: ManifestationNode[] = [];
  searchQuery = '';

  // Global search with filters
  globalSearchQuery = '';
  searchFilter: SearchFilter = 'all';

  // View mode
  viewMode: ViewMode = 'list';

  // Overview dashboard
  showOverview = true;

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
  /** Node being edited (null = create mode) */
  editNode: ManifestationNode | null = null;

  // Delete confirmation state
  isDeleteConfirmOpen = false;
  deleteTarget: ManifestationNode | null = null;

  LevelEnum = LevelEnum;
  StatusEnum = StatusEnum;

  // Overview computed stats
  get overviewStats() {
    const total = this.allRoadmaps.length;
    const planning = this.blueprints.length;
    const active = this.activeBuilds.filter(n => n.status === StatusEnum.PROGRESS).length;
    const completed = this.hallOfFame.length;
    const hold = this.onHoldRoadmaps.length;
    const avgProgress = total > 0
      ? Math.round(this.allRoadmaps.reduce((sum, n) => sum + (n.progress || 0), 0) / total)
      : 0;
    return { total, planning, active, completed, hold, avgProgress };
  }

  get pieChartSegments() {
    const s = this.overviewStats;
    const total = s.total || 1;
    return {
      planning: (s.planning / total) * 100,
      active: (s.active / total) * 100,
      completed: (s.completed / total) * 100,
      hold: (s.hold / total) * 100
    };
  }

  ngOnInit() {
    this.authSub = this.authService.user$.subscribe(user => {
      if (!user) {
        this.router.navigate(['/auth']);
      } else {
        this.loadRoadmaps();
        this.gamificationService.loadProfile();
      }
    });
  }

  ngOnDestroy() {
    this.authSub?.unsubscribe();
    this.roadmapsSub?.unsubscribe();
    this.childrenSub?.unsubscribe();
    this.pointsSub?.unsubscribe();
  }

  // ─── Sidebar / Roadmap Loading ───

  loadRoadmaps() {
    this.roadmapsSub?.unsubscribe();
    this.roadmapsSub = this.manifestationService.getNodesByLevel(LevelEnum.ROADMAP).subscribe((nodes: ManifestationNode[]) => {
      this.zone.run(() => {
        this.allRoadmaps = nodes;
        this.blueprints = nodes.filter(n => n.status === StatusEnum.PLANNING);
        this.activeBuilds = nodes.filter(n => n.status === StatusEnum.PROGRESS);
        this.onHoldRoadmaps = nodes.filter(n => n.status === StatusEnum.HOLD);
        this.hallOfFame = nodes.filter(n => n.status === StatusEnum.COMPLETED);
        this.filterRoadmaps();
        this.loadTotalPoints();

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
      this.filteredOnHold = this.onHoldRoadmaps;
    } else {
      this.filteredBlueprints = this.blueprints.filter(n => n.title.toLowerCase().includes(q));
      this.filteredActiveBuilds = this.activeBuilds.filter(n => n.title.toLowerCase().includes(q));
      this.filteredHallOfFame = this.hallOfFame.filter(n => n.title.toLowerCase().includes(q));
      this.filteredOnHold = this.onHoldRoadmaps.filter(n => n.title.toLowerCase().includes(q));
    }
  }

  /** Fetch all user nodes (kept for allNodes usage, points are from gamification service) */
  loadTotalPoints() {
    this.pointsSub?.unsubscribe();
    this.pointsSub = this.manifestationService.getAllNodes().subscribe(allNodes => {
      this.zone.run(() => {
        this.allNodes = allNodes;
      });
    });
  }

  // ─── Navigation: Select, Drill, Breadcrumb ───

  selectRoadmap(node: ManifestationNode) {
    this.showOverview = false;
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
    this.childrenSub?.unsubscribe();
    this.childrenSub = this.manifestationService.getChildren(this.currentViewNode.id).subscribe(children => {
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

    // Award gamification points
    const earning = await this.gamificationService.awardCompletion(
      this.currentViewNode.level,
      this.currentViewNode.dueDate ?? undefined
    );
    this.showEarningPopup(earning);

    this.loadRoadmaps();
  }

  // ─── Task / Sub-Task Toggle ───

  async toggleTaskComplete(node: ManifestationNode) {
    if (!node.id) return;
    if (node.status === StatusEnum.COMPLETED) {
      // Un-completing: reverse gamification points
      const pts = node.points || 0;
      await this.manifestationService.updateNode(node.id, {
        status: StatusEnum.PROGRESS,
        progress: 0,
        points: 0
      });
      node.status = StatusEnum.PROGRESS;
      node.progress = 0;
      node.points = 0;
      await this.gamificationService.reverseCompletion(node.level, pts);
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

      // Award gamification points
      const earning = await this.gamificationService.awardCompletion(
        node.level,
        node.dueDate ?? undefined
      );
      this.showEarningPopup(earning);
    }
    this.recalculateCurrentNodeProgress();
    this.loadRoadmaps();
  }

  async cycleTaskStatus(node: ManifestationNode) {
    if (!node.id) return;
    const order = [StatusEnum.PLANNING, StatusEnum.PROGRESS, StatusEnum.HOLD, StatusEnum.COMPLETED];
    const currentIndex = order.indexOf(node.status);
    const nextStatus = order[(currentIndex + 1) % order.length];
    const wasCompleted = node.status === StatusEnum.COMPLETED;

    const updates: Partial<ManifestationNode> = { status: nextStatus };
    if (nextStatus === StatusEnum.COMPLETED) {
      updates.points = this.progressService.getPointsForLevel(node.level);
      updates.progress = 100;
      node.points = updates.points;
      node.progress = 100;
    } else if (wasCompleted) {
      updates.progress = 0;
      updates.points = 0;
      const oldPts = node.points || 0;
      node.progress = 0;
      node.points = 0;
      // Reverse gamification
      await this.gamificationService.reverseCompletion(node.level, oldPts);
    }
    await this.manifestationService.updateNode(node.id, updates);
    node.status = nextStatus;

    // Award gamification if cycling into completed
    if (nextStatus === StatusEnum.COMPLETED) {
      const earning = await this.gamificationService.awardCompletion(
        node.level,
        node.dueDate ?? undefined
      );
      this.showEarningPopup(earning);
    }

    this.recalculateCurrentNodeProgress();
    this.loadRoadmaps();
  }

  // ─── Dialog ───

  openNewRoadmapDialog() {
    this.dialogLevel = LevelEnum.ROADMAP;
    this.dialogParentId = null;
    this.editNode = null;
    this.isDialogOpen = true;
  }

  openAddChildDialog() {
    if (!this.currentViewNode?.id || this.currentViewNode.level >= LevelEnum.SUB_TASK) return;
    this.dialogLevel = (this.currentViewNode.level + 1) as LevelEnum;
    this.dialogParentId = this.currentViewNode.id;
    this.editNode = null;
    this.isDialogOpen = true;
  }

  openEditDialog(node: ManifestationNode) {
    this.editNode = node;
    this.dialogLevel = node.level;
    this.dialogParentId = node.parentId;
    this.isDialogOpen = true;
  }

  editCurrentNode() {
    if (this.currentViewNode) {
      this.openEditDialog(this.currentViewNode);
    }
  }

  // ─── Delete ───

  confirmDelete(node: ManifestationNode) {
    this.deleteTarget = node;
    this.isDeleteConfirmOpen = true;
  }

  confirmDeleteCurrentNode() {
    if (this.currentViewNode) {
      this.confirmDelete(this.currentViewNode);
    }
  }

  cancelDelete() {
    this.isDeleteConfirmOpen = false;
    this.deleteTarget = null;
  }

  async executeDelete() {
    if (!this.deleteTarget?.id) return;
    const deletedNode = this.deleteTarget;
    this.isDeleteConfirmOpen = false;
    this.deleteTarget = null;

    try {
      await this.manifestationService.deleteNode(deletedNode.id!);

      // If deleting the current view node, navigate back
      if (this.currentViewNode?.id === deletedNode.id) {
        if (this.breadcrumb.length > 1) {
          this.goBack();
        } else {
          // Deleted the root roadmap
          this.currentViewNode = null;
          this.selectedRoadmap = null;
          this.breadcrumb = [];
          this.currentChildren = [];
        }
      }

      this.loadRoadmaps();
      this.loadCurrentChildren();
    } catch (err) {
      console.error('Failed to delete node', err);
    }
  }

  closeDialog() {
    this.isDialogOpen = false;
    this.editNode = null;
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

  /** Get a breadcrumb label showing the level type */
  getBreadcrumbLabel(node: ManifestationNode): string {
    return this.getLevelName(node.level) + ': ' + node.title;
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

  // ─── View Mode ───
  setViewMode(mode: ViewMode) {
    this.viewMode = mode;
  }

  toggleOverview() {
    this.showOverview = !this.showOverview;
  }

  // ─── Global Search & Filter ───
  get globalFilteredChildren(): ManifestationNode[] {
    let items = this.currentChildren;
    const q = this.globalSearchQuery.toLowerCase().trim();
    if (q) {
      items = items.filter(n =>
        n.title.toLowerCase().includes(q) ||
        (n.description && n.description.toLowerCase().includes(q)) ||
        (n.customField1 && n.customField1.toLowerCase().includes(q))
      );
    }
    if (this.searchFilter !== 'all') {
      items = items.filter(n => n.status === this.searchFilter);
    }
    return items;
  }

  setSearchFilter(filter: SearchFilter) {
    this.searchFilter = filter;
  }

  clearGlobalSearch() {
    this.globalSearchQuery = '';
    this.searchFilter = 'all';
  }

  // ─── Filtered Kanban helpers ───
  getFilteredChildrenByStatus(status: StatusEnum): ManifestationNode[] {
    return this.globalFilteredChildren.filter(c => c.status === status);
  }

  getFilteredSortedChildren(): ManifestationNode[] {
    return [...this.globalFilteredChildren].sort((a, b) => {
      if (a.status === StatusEnum.COMPLETED && b.status !== StatusEnum.COMPLETED) return 1;
      if (a.status !== StatusEnum.COMPLETED && b.status === StatusEnum.COMPLETED) return -1;
      return 0;
    });
  }

  /** CSS conic-gradient string for the pie chart */
  get pieChartGradient(): string {
    const s = this.pieChartSegments;
    let offset = 0;
    const segments: string[] = [];

    if (s.completed > 0) {
      segments.push(`var(--status-completed) ${offset}% ${offset + s.completed}%`);
      offset += s.completed;
    }
    if (s.active > 0) {
      segments.push(`var(--status-progress) ${offset}% ${offset + s.active}%`);
      offset += s.active;
    }
    if (s.planning > 0) {
      segments.push(`var(--status-planning) ${offset}% ${offset + s.planning}%`);
      offset += s.planning;
    }
    if (s.hold > 0) {
      segments.push(`var(--status-hold) ${offset}% ${offset + s.hold}%`);
      offset += s.hold;
    }
    if (segments.length === 0) {
      return 'conic-gradient(var(--bg-surface-elevated) 0% 100%)';
    }
    return `conic-gradient(${segments.join(', ')})`;
  }

  // ─── Points Popup & Trophy Panel ───

  showEarningPopup(earning: PointsEarning): void {
    if (earning.total > 0) {
      this.latestEarning = earning;
      this.showPointsPopup = true;
    }
  }

  dismissPointsPopup(): void {
    this.showPointsPopup = false;
    this.latestEarning = null;
  }

  openTrophyPanel(): void {
    this.showTrophyPanel = true;
  }

  closeTrophyPanel(): void {
    this.showTrophyPanel = false;
  }
}
