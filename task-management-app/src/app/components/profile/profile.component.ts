import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UsersService } from '../../services/users.service';
import { TaskService } from '../../services/task.service';
import { BadgeService } from '../../services/badge.service';
import { DatePipe, NgIf, CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-profile',
  imports: [DatePipe, NgIf, CommonModule],
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit {
  profile: any = null;
  loading: boolean = true;
  error: string = '';

  badges: any[] = [];
  badgesLoading: boolean = true;

  usersService = inject(UsersService);
  auth = inject(AuthService);
  router = inject(Router);
  badgeService = inject(BadgeService);
  
  completedTasksCount: number = 0;
  taskService = inject(TaskService);

  ngOnInit() {
    this.getProfile();
    this.loadUserBadges();
    this.loadCompletedTasksCount();
  }

  logout() {
  const confirmLogout = confirm('Are you sure you want to logout?');

  if (!confirmLogout) return;

  this.auth.logout();
  this.router.navigate(['/']);
}
  deleteAccount() {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      this.usersService.deleteAccount().subscribe({
        next: () => {
          this.auth.logout();
          this.router.navigate(['/login']);
        },
        error: (err) => {
          this.error = err?.error?.message || 'Failed to delete account';
        },
      });
    }
  }

  getProfile() {
    this.loading = true;
    this.usersService.getProfile().subscribe({
      next: (res) => {
        this.profile = res.data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to load profile';
        this.loading = false;
      },
    });
  }

  async loadCompletedTasksCount() {
  try {
    const currentUser = this.auth.getCurrentUser();
    if (!currentUser?._id) return;

    const result: any = await firstValueFrom(this.taskService.getCompletedTasks(1, 1000));

    // Tasks are inside result.data.tasks
    const tasks: any[] = Array.isArray(result?.data?.tasks) ? result.data.tasks : [];

    // Filter using the correct field: task.user
    this.completedTasksCount = tasks.filter(task => task.user === currentUser._id).length;

    console.log('Completed tasks for user', this.completedTasksCount, tasks);

  } catch (err) {
    console.error('Error loading completed tasks', err);
  }
}

  async loadUserBadges() {
    const userId = this.auth.getCurrentUser()?._id;
    if (!userId) {
      this.badgesLoading = false;
      return;
    }

    try {
      const result: any = await firstValueFrom(
        this.badgeService.getUserBadges(userId)
      );
      this.badges = result || [];
    } catch (err) {
      console.error('Error loading badges', err);
    } finally {
      this.badgesLoading = false;
    }
  }
getBadgeCardClass(milestone: number): string {
  if (milestone >= 100)
    return 'bg-gradient-to-br from-yellow-300 via-yellow-200 to-yellow-100 border-2 border-yellow-400 shadow-lg shadow-yellow-300';
  if (milestone >= 90)
    return 'bg-gradient-to-br from-blue-300 via-blue-200 to-blue-100 border-2 border-blue-400 shadow-lg shadow-blue-300';
  if (milestone >= 75)
    return 'bg-gradient-to-br from-purple-300 via-purple-200 to-purple-100 border-2 border-purple-500 shadow-md shadow-purple-300';
  if (milestone >= 60)
    return 'bg-gradient-to-br from-green-300 via-green-200 to-green-100 border-2 border-green-400 shadow-md shadow-green-300';
  if (milestone >= 50)
    return 'bg-gradient-to-br from-yellow-200 via-yellow-100 to-yellow-50 border-2 border-yellow-300 shadow-sm shadow-yellow-200';
  if (milestone >= 40)
    return 'bg-gradient-to-br from-gray-200 via-gray-100 to-white border-2 border-gray-400 shadow-sm shadow-gray-200';
  if (milestone >= 30)
    return 'bg-gradient-to-br from-orange-200 via-orange-100 to-orange-50 border-2 border-orange-400 shadow-sm shadow-orange-200';
  if (milestone >= 20)
    return 'bg-gradient-to-br from-pink-200 via-pink-100 to-pink-50 border-2 border-pink-400 shadow-sm shadow-pink-200';
  if (milestone >= 10)
    return 'bg-gradient-to-br from-indigo-200 via-indigo-100 to-indigo-50 border-2 border-indigo-400 shadow-sm shadow-indigo-200';
  if (milestone >= 5)
    return 'bg-gradient-to-br from-white via-gray-50 to-white border border-gray-300 shadow-sm shadow-gray-100';
  
  return 'bg-gradient-to-br from-white via-gray-50 to-white border border-gray-200 shadow-sm shadow-gray-100';
}

  getBadgeColor(milestone: number): string {
    if (milestone >= 50) return 'text-purple-500';
    if (milestone >= 25) return 'text-yellow-400';
    if (milestone >= 10) return 'text-orange-500';
    return 'text-gray-400';
  }
}