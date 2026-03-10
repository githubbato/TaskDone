import { Component, inject, OnInit, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FooterComponent } from './shared/footer/footer.component';
import { NavbarComponent } from './shared/navbar/navbar.component';
import { SplashComponent } from './core/splash/splash.component';
import { Meta } from '@angular/platform-browser';
import { AuthService } from './services/auth.service';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, FooterComponent, NavbarComponent, SplashComponent, NgIf],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  title = 'task-management-app';
  private authService = inject(AuthService);
  meta = inject(Meta);

  showSplash = true;

  // --- PWA Install banner ---
  deferredPrompt: any;
  showInstallButton = false;

  @HostListener('window:beforeinstallprompt', ['$event'])
  onBeforeInstallPrompt(event: Event) {
    event.preventDefault(); // prevent Chrome's default mini-prompt
    this.deferredPrompt = event;

    // Only show banner if user hasn't dismissed before
    if (!localStorage.getItem('pwaDismissed')) {
      this.showInstallButton = true;
    }
  }

  constructor() {
    this.meta.addTags([
      { name: 'description', content: 'An Angular task management app' },
      { charset: 'UTF-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'author', content: 'Group10' },
      { name: 'keywords', content: 'task management, angular, nodejs, express, mongodb, task done' },
      { name: 'robots', content: 'index, follow' },
      { property: 'og:title', content: 'Task Management App' },
      { property: 'og:description', content: 'A simple task management app built using Angular, Node.js, Express, and MongoDB.' },
      { property: 'og:image', content: 'https://www.taskdone.digital/' },
      { property: 'og:url', content: 'https://www.taskdone.digital/' },
    ]);
  }

  ngOnInit() {
    this.authService.autoLogin();

    // Splash logic
    const splashPlayed = sessionStorage.getItem('splashPlayed');
    if (splashPlayed === 'true') {
      this.showSplash = false;
    } else {
      setTimeout(() => this.hideSplash(), 3000);
    }
  }

  hideSplash() {
    if (!this.showSplash) return;
    console.log('Splash finished');
    this.showSplash = false;
    sessionStorage.setItem('splashPlayed', 'true');
  }

  // --- PWA Install methods ---
  installApp() {
    if (!this.deferredPrompt) return;
    this.deferredPrompt.prompt();
    this.deferredPrompt.userChoice.then((choiceResult: any) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the PWA install');
      } else {
        console.log('User dismissed the PWA install');
      }
      this.deferredPrompt = null;
      this.showInstallButton = false;
    });
  }

  dismissBanner() {
    this.showInstallButton = false;
    localStorage.setItem('pwaDismissed', 'true'); // remember dismissal
  }
}
