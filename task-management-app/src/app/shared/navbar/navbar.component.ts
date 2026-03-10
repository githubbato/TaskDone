import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NgClass } from '@angular/common';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, NgClass],
  templateUrl: './navbar.component.html',
})
export class NavbarComponent implements OnInit {
  authService = inject(AuthService);
  router = inject(Router);

  // Signal for mobile menu visibility
  showMobileMenu = signal(false);

  constructor() {}

  ngOnInit(): void {
    // Close mobile menu automatically on route change
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.showMobileMenu.set(false);
      });
  }

  isLoggedIn(): boolean {
    return this.authService.isAuthenticated();
  }

  isAuthPage(): boolean {
  return this.router.url.startsWith('/login') ||
         this.router.url.startsWith('/register');
}

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
    this.showMobileMenu.set(false);
  }

  toggleMobileMenu() {
    this.showMobileMenu.update(value => !value);
  }
}