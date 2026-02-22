import { Component, inject, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { ManifestationService } from '../../core/services/manifestation.service';
import { Router } from '@angular/router';
import { ManifestationNode, LevelEnum, StatusEnum } from '../../shared/models/manifestation.model';
import { ManifestationNodeComponent } from '../../components/manifestation-node/manifestation-node';
import { NodeDialogComponent } from '../../components/node-dialog/node-dialog';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ManifestationNodeComponent, NodeDialogComponent],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private manifestationService = inject(ManifestationService);
  private router = inject(Router);
  private zone = inject(NgZone);

  totalPoints = 0;

  // The different sections of "The Staircase"
  blueprints: ManifestationNode[] = [];      // In Planning
  activeBuilds: ManifestationNode[] = [];    // In Progress
  hallOfFame: ManifestationNode[] = [];      // Completed

  isDialogOpen = false;

  LevelEnum = LevelEnum;

  ngOnInit() {
    this.authService.user$.subscribe(user => {
      if (!user) {
        this.router.navigate(['/auth']);
      } else {
        this.loadRoadmaps();
      }
    });
  }

  loadRoadmaps() {
    this.manifestationService.getNodesByLevel(LevelEnum.ROADMAP).subscribe((nodes: ManifestationNode[]) => {
      this.zone.run(() => {
        this.blueprints = nodes.filter(n => n.status === StatusEnum.PLANNING);
        this.activeBuilds = nodes.filter(n => n.status === StatusEnum.PROGRESS || n.status === StatusEnum.HOLD);
        this.hallOfFame = nodes.filter(n => n.status === StatusEnum.COMPLETED);

        this.calculateTotalPoints(nodes);
      });
    });
  }

  calculateTotalPoints(nodes: ManifestationNode[]) {
    this.totalPoints = nodes.reduce((sum, node) => sum + (node.points || 0), 0);
    // In a real app we'd recursively calculate or store a global points counter per user.
    // For this prototype, we'll keep it simple or expand later.
  }

  logout() {
    this.authService.logout();
  }

  openNewRoadmapDialog() {
    this.isDialogOpen = true;
  }

  closeDialog() {
    this.isDialogOpen = false;
  }

  onNodeCreated() {
    this.closeDialog();
    this.loadRoadmaps();
  }
}
