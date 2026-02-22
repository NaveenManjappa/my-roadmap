import { Component, inject, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './auth.html',
  styleUrls: ['./auth.css']
})
export class Auth implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private zone = inject(NgZone);

  errorMsg = '';
  isLoading = false;

  ngOnInit() {
    // Auto-redirect if already logged in
    this.authService.user$.subscribe(user => {
      if (user) {
        this.zone.run(() => {
          this.router.navigate(['/dashboard']);
        });
      }
    });
  }

  async loginWithGoogle() {
    try {
      this.isLoading = true;
      this.errorMsg = '';
      await this.authService.loginWithGoogle();
      this.zone.run(() => {
        this.router.navigate(['/dashboard']);
      });
    } catch (err: any) {
      this.zone.run(() => {
        this.errorMsg = err?.message || 'Failed to sign in. Please try again.';
      });
      console.error(err);
    } finally {
      this.zone.run(() => {
        this.isLoading = false;
      });
    }
  }
}
