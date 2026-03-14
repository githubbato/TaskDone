import { Component, inject, OnInit, signal, OnDestroy } from '@angular/core';
import { TaskService } from '../../../services/task.service';
import { Task } from '../../../core/models/tasks.model';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { NgClass, DatePipe, NgIf, NgFor, CommonModule} from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { BadgeService } from '../../../services/badge.service';
import { effect } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import { User } from '../../../core/models/user.model';
import { FormsModule } from '@angular/forms';

function isUser(u: User | null): u is User {
  return !!u && !!u._id;
}

@Component({
    selector: 'app-task-list',
    imports: [RouterLink, NgClass, DatePipe, NgIf, NgFor, CommonModule, FormsModule],
    templateUrl: './task-list.component.html',
})
export class TaskListComponent implements OnInit {
  
  private badgeAwardingInProgress: boolean = false;
  userSignal = signal<User | null>(null);

  allTasks = signal<Task[]>([]);
  completedTasks = signal<Task[]>([]);
  pendingTasks = signal<Task[]>([]);
  unfinishedTasks = signal<Task[]>([]);

  completedPaginatedTasks = signal<Task[]>([]);
  pendingPaginatedTasks = signal<Task[]>([]);
  unfinishedPaginatedTasks = signal<Task[]>([]);
  ongoingSortType: 'deadline' | 'priority' | 'alphabetical' = 'deadline';
  ongoingSortOrder: 'asc' | 'desc' = 'asc';

  completedCurrentPage = signal<number>(1);
  pendingCurrentPage = signal<number>(1);
  unfinishedCurrentPage = signal<number>(1);

  completedItemsPerPage = signal<number>(10);
  pendingItemsPerPage = signal<number>(10);
  unfinishedItemsPerPage = signal<number>(10);

  completedTotalPages = signal<number>(0);
  pendingTotalPages = signal<number>(0);
  unfinishedTotalPages = signal<number>(0);

  completedTotalTasks = signal<number>(0); // Add signal for total completed tasks
  pendingTotalTasks = signal<number>(0);   // Add signal for total pending tasks
  unfinishedTotalTasks = signal<number>(0); // Add signal for total unfinished tasks
  showSortMenu = false;

  taskService = inject(TaskService);
  auth = inject(AuthService);
  route = inject(ActivatedRoute);

  completedError = signal<string>('');
  pendingError = signal<string>('');
  unfinishedError = signal<string>('');

  completedLoading = signal<boolean>(false);
  pendingLoading = signal<boolean>(false);
  unfinishedLoading = signal<boolean>(false);

  showReminder = signal<boolean>(false);
  reminderMessage = signal<string>('');

  showOverdueAlert = signal<boolean>(false);
  overdueTasks = signal<Task[]>([]);
  hasCheckedOverdue = false;
  closingOverdueAlert = signal<boolean>(false);

  progressMap: Record<string, number> = {};
  colorMap: Record<string, string> = {};

  badgeService = inject(BadgeService);
  currentBadge = signal<any>(null);
  showBadgeModal = signal<boolean>(false);
  earnedBadge: any = null;

  constructor() {
     effect(() => {
    if (this.showOverdueAlert()) {
      this.playAlertSound();
    }
  });
  effect(() => {
  const user = this.userSignal();
  const tasks = this.allTasks();

  if (!user) {
    return;
  }

  if (!tasks || tasks.length === 0) {
    return;
  }

  this.checkBadgeMilestone(user);
});
  }

  ngOnInit() {
    this.auth.currentUser$
  .pipe(filter(isUser))
  .subscribe(user => {
    this.userSignal.set(user);
  });
    this.loadPendingTasks(this.pendingCurrentPage(), this.pendingItemsPerPage());
    this.loadCompletedTasks(this.completedCurrentPage(), this.completedItemsPerPage());
    this.loadUnfinishedTasks(this.unfinishedCurrentPage(), this.unfinishedItemsPerPage());
    this.loadAllTasks();

    // Check for reminder message from query params
    this.route.queryParams.subscribe(params => {
      if (params['reminder']) {
        this.reminderMessage.set(params['reminder']);
        this.showReminder.set(true);
      }
    });

    // Check for reminders every minute
    setInterval(() => {
      this.checkReminders();
    }, 60000); // Check every minute

    // Initial check
    setTimeout(() => {
      this.checkReminders();
    }, 1000);

    setInterval(() => {
  const now = Date.now();

  this.pendingTasks.update(tasks => {
    return tasks.map(task => {
      this.calculateTaskProgress(task, now);
      return task;
    });
  });

  this.unfinishedTasks.update(tasks => {
    return tasks.map(task => {
      this.calculateTaskProgress(task, now);
      return task;
    });
  });

  this.completedTasks.update(tasks => {
    return tasks.map(task => {
      this.calculateTaskProgress(task, now);
      return task;
    });
  });
}, 1000);
}
  calculateTaskProgress(task: any, now: number) {
  const created = new Date(task.createdAt).getTime();
  const deadline = new Date(task.deadline).getTime();
  const totalDuration = deadline - created;
  const elapsed = now - created;

  const progress = Math.max(0, Math.min(100, ((totalDuration - elapsed) / totalDuration) * 100));
  this.progressMap[task._id] = progress;

  // Color
  if (progress > 50) this.colorMap[task._id] = '#10b981'; // green
  else if (progress > 20) this.colorMap[task._id] = '#f59e0b'; // yellow
  else this.colorMap[task._id] = '#ef4444'; // red
}

  loadCompletedTasks(page: number, limit: number) {
    this.completedLoading.set(true);
    this.taskService.getCompletedTasks(page, limit).subscribe({
      next: (response) => {
        if (response.status === 'success' && response.data) {
          // Set the tasks directly from the response
          this.completedTasks.set(response.data.tasks || []);
          this.completedTotalPages.set(response.data.totalPages || 1);
          this.completedCurrentPage.set(response.data.currentPage || 1);
          this.completedTotalTasks.set(response.data.totalTasks || 0);

          // No need to call updateCompletedPaginatedTasks() here
          // as we're directly using the paginated data from the API
          this.completedPaginatedTasks.set(response.data.tasks || []);
        } else {
          this.completedError.set('Invalid response format from server');
        }

        this.completedLoading.set(false);
      },
      error: (error) => {
        console.error('Error getting completed tasks:', error);
        this.completedError.set('Error getting completed tasks');
        this.completedLoading.set(false);
      },
    });
  }

  loadPendingTasks(page: number, limit: number) {
    this.pendingLoading.set(true);
    this.taskService.getPendingTasks(page, limit).subscribe({
      next: (response) => {
        if (response.status === 'success' && response.data) {
          this.pendingTasks.set(response.data.tasks || []);
          this.pendingTotalPages.set(response.data.totalPages || 1);
          this.pendingCurrentPage.set(response.data.currentPage || 1);
          this.pendingTotalTasks.set(response.data.totalTasks || 0);

          // Directly set the paginated tasks from the API response
          this.pendingPaginatedTasks.set(response.data.tasks || []);
        } else {
          this.pendingError.set('Invalid response format from server');
        }

        this.pendingLoading.set(false);
      },
      error: (error) => {
        console.error('Error getting pending tasks:', error);
        this.pendingError.set('Error getting pending tasks');
        this.pendingLoading.set(false);
      },
    });
  }

  loadUnfinishedTasks(page: number, limit: number) {
    this.unfinishedLoading.set(true);
    this.taskService.getUnfinishedTasks(page, limit).subscribe({
      next: (response) => {
        if (response.status === 'success' && response.data) {
          this.unfinishedTasks.set(response.data.tasks || []);
          this.unfinishedTotalPages.set(response.data.totalPages || 1);
          this.unfinishedCurrentPage.set(response.data.currentPage || 1);
          this.unfinishedTotalTasks.set(response.data.totalTasks || 0);
          this.unfinishedPaginatedTasks.set(response.data.tasks || []);
          this.checkOverdueTasks();
        } else {
          this.unfinishedError.set('Invalid response format from server');
        }
        this.unfinishedLoading.set(false);
      },
      error: (error) => {
        console.error('Error getting unfinished tasks:', error);
        this.unfinishedError.set('Error getting unfinished tasks');
        this.unfinishedLoading.set(false);
      },
    });
  }

  loadUserTasks(page: number, limit: number) {
    this.pendingLoading.set(true);
    this.taskService.getUserTasks(page, limit).subscribe({
      next: (response) => {
        if (response.status === 'success' && response.data) {
          this.pendingTasks.set(response.data.tasks || []);
          this.pendingTotalPages.set(response.data.totalPages || 1);
          this.pendingCurrentPage.set(response.data.currentPage || 1);
          this.pendingTotalTasks.set(response.data.totalTasks || 0);
          this.pendingPaginatedTasks.set(response.data.tasks || []);
        } else {
          this.pendingError.set('Invalid response format from server');
        }
        this.pendingLoading.set(false);
      },
      error: (error) => {
        console.error('Error getting user tasks:', error);
        this.pendingError.set('Error getting user tasks');
        this.pendingLoading.set(false);
      },
    });
  }

  loadAllTasks() {
  this.taskService.getUserTasks(1, 1000).subscribe({
    next: (response) => {
      if (response.status === 'success' && response.data) {
        this.allTasks.set(response.data.tasks || []);
        this.checkGentleReminder();

        const user = this.userSignal();
        if (user) {
          this.checkBadgeMilestone(user); // ✅ safe, user is loaded
        }
      }
    },
    error: (error) => {
      console.error('Error getting all tasks:', error);
    },
  });
}

  // Returns progress percentage (100% = just created, 0% = deadline reached)
getTaskProgress(task: any): number {
  const now = new Date().getTime();
  const created = new Date(task.createdAt).getTime();
  const deadline = new Date(task.deadline).getTime();

  if (now >= deadline) return 0;

  const totalDuration = deadline - created;
  const elapsed = now - created;

  return Math.max(0, Math.min(100, ((totalDuration - elapsed) / totalDuration) * 100));
}

// Returns color based on remaining time
getTaskProgressColor(task: any): string {
  const progress = this.getTaskProgress(task);
  if (progress > 50) return '#10b981';   // green
  if (progress > 20) return '#f59e0b';   // yellow
  return '#ef4444';                      // red
}

isTaskNearDeadline(task: Task) {
  const now = Date.now();
  const deadline = new Date(task.deadline).getTime();
  const start = task.startDate ? new Date(task.startDate).getTime() : deadline - 86400000; // fallback 1 day
  const totalDuration = deadline - start;
  const timeLeft = deadline - now;
  const percentLeft = (timeLeft / totalDuration) * 100;

  return percentLeft <= 10 && timeLeft > 0;
}

  // These methods are not currently needed since we're using server-side pagination
  // but kept for potential client-side pagination fallback
  updateCompletedPaginatedTasks() {
    const startIndex =
      (this.completedCurrentPage() - 1) * this.completedItemsPerPage();
    const endIndex = startIndex + this.completedItemsPerPage();
    // Update to use the renamed signal
    this.completedPaginatedTasks.set(
      this.completedTasks().slice(startIndex, endIndex)
    );
  }

  updatePendingPaginatedTasks() {
    const startIndex =
      (this.pendingCurrentPage() - 1) * this.pendingItemsPerPage();
    const endIndex = startIndex + this.pendingItemsPerPage();
    this.pendingPaginatedTasks.set(
      this.pendingTasks().slice(startIndex, endIndex)
    );
  }
toggleSortOrder() {
  this.ongoingSortOrder = this.ongoingSortOrder === 'asc' ? 'desc' : 'asc';
}

getSortedPendingTasks() {
  const tasks = [...this.pendingTasks()];
  let sorted = tasks;

  switch (this.ongoingSortType) {
    case 'deadline':
      sorted = tasks.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
      break;
    case 'priority':
      const priorityOrder: any = { High: 1, Medium: 2, Low: 3 };
      sorted = tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
      break;
    case 'alphabetical':
      sorted = tasks.sort((a, b) => a.title.localeCompare(b.title));
      break;
  }

  if (this.ongoingSortOrder === 'desc') sorted.reverse();
  return sorted;
}

  checkOverdueTasks() {
  if (this.hasCheckedOverdue) return;

  const now = new Date();

  const overdue = this.unfinishedTasks().filter(task => {
    if (!task.deadline) return false;
    return new Date(task.deadline) < now;
  });

  if (overdue.length > 0) {
    this.overdueTasks.set(overdue);
    this.showOverdueAlert.set(true);
    this.hasCheckedOverdue = true;
    this.closingOverdueAlert.set(false);
    }
  }

  closeOverdueAlert() {
  this.closingOverdueAlert.set(true);

  setTimeout(() => {
    this.showOverdueAlert.set(false);
    this.closingOverdueAlert.set(false);
    }, 400); 
  }

  playAlertSound() {
  const audio = new Audio('assets/sounds/alert-popup.wav')
  audio.play().catch(err => console.error('Error playing sound:', err));
  }

  nextCompletedPage() {
    if (this.completedCurrentPage() < this.completedTotalPages()) {
      this.completedCurrentPage.set(this.completedCurrentPage() + 1);
      this.loadCompletedTasks(
        this.completedCurrentPage(),
        this.completedItemsPerPage()
      );
    } else {
      console.log('No more pages to display.');
    }
  }

  nextPendingPage() {
    if (this.pendingCurrentPage() < this.pendingTotalPages()) {
      this.pendingCurrentPage.set(this.pendingCurrentPage() + 1);
      this.loadPendingTasks(
        this.pendingCurrentPage(),
        this.pendingItemsPerPage()
      );
    } else {
      console.log('No more pages to display.');
    }
  }

  previousCompletedPage() {
    if (this.completedCurrentPage() > 1) {
      this.completedCurrentPage.set(this.completedCurrentPage() - 1);
      this.loadCompletedTasks(
        this.completedCurrentPage(),
        this.completedItemsPerPage()
      );
    } else {
      console.log('Already on the first page.');
    }
  }

  previousPendingPage() {
    if (this.pendingCurrentPage() > 1) {
      this.pendingCurrentPage.set(this.pendingCurrentPage() - 1);
      this.loadPendingTasks(
        this.pendingCurrentPage(),
        this.pendingItemsPerPage()
      );
    } else {
      console.log('Already on the first page.');
    }
  }

  nextUnfinishedPage() {
    if (this.unfinishedCurrentPage() < this.unfinishedTotalPages()) {
      this.unfinishedCurrentPage.set(this.unfinishedCurrentPage() + 1);
      this.loadUnfinishedTasks(
        this.unfinishedCurrentPage(),
        this.unfinishedItemsPerPage()
      );
    } else {
      console.log('No more pages to display.');
    }
  }

  previousUnfinishedPage() {
    if (this.unfinishedCurrentPage() > 1) {
      this.unfinishedCurrentPage.set(this.unfinishedCurrentPage() - 1);
      this.loadUnfinishedTasks(
        this.unfinishedCurrentPage(),
        this.unfinishedItemsPerPage()
      );
    } else {
      console.log('Already on the first page.');
    }
  }

  refreshData() {
    this.pendingLoading.set(true);
    this.completedLoading.set(true);
    this.unfinishedLoading.set(true);
    this.pendingError.set('');
    this.completedError.set('');
    this.unfinishedError.set('');

    this.loadCompletedTasks(this.completedCurrentPage(), this.completedItemsPerPage());
    this.loadPendingTasks(this.pendingCurrentPage(), this.pendingItemsPerPage());
    this.loadUnfinishedTasks(this.unfinishedCurrentPage(), this.unfinishedItemsPerPage());
     this.loadAllTasks(); // ADD THIS
  }



  checkReminders() {
    const now = new Date();
    const pendingTasks = this.pendingTasks();

    pendingTasks.forEach(task => {
      if (task.deadline) {
        const deadline = new Date(task.deadline);
        const startDate = task.startDate ? new Date(task.startDate) : null;

        // Calculate duration between start and deadline
        let durationDays = 1; // Default to 1 day if no start date
        if (startDate) {
          const diffTime = Math.abs(deadline.getTime() - startDate.getTime());
          durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        let reminderTime: Date;
        if (durationDays <= 1) {
          // Remind 5 hours before deadline
          reminderTime = new Date(deadline.getTime() - 5 * 60 * 60 * 1000);
        } else {
          // Remind 1 day before deadline
          reminderTime = new Date(deadline.getTime() - 24 * 60 * 60 * 1000);
        }

        // Check if it's time to show the reminder
        if (now >= reminderTime && now < deadline) {
          const timeUntilDeadline = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 1000));
          const message = `⏰ Reminder: "${task.title}" is due in ${timeUntilDeadline} hours!`;

          // Show browser notification if supported
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Task Reminder', {
              body: message,
              //icon: '/favicon.ico'
            });
          }

          // Also log to console for debugging
          console.log(message);
        }
      }
    });
  }

  checkGentleReminder() {
  const todayKey = new Date().toDateString();

  // Tasks created today
  const tasksToday = this.allTasks().filter(task => {
    if (!task.createdAt) return false;
    return new Date(task.createdAt).toDateString() === todayKey;
  });

  const count = tasksToday.length;

  const milestone = Math.floor(count / 5) * 5; // 5,10,15...
  const milestoneKey = `tasksCreatedToday_${todayKey}_${milestone}`;

  if (milestone >= 5 && !localStorage.getItem(milestoneKey)) {
    this.reminderMessage.set(
      `That's quite a lot of tasks you made today (${count}). Remember to prioritize and take breaks. Productivity matters, but so does your well-being.`
    );

    this.showReminder.set(true);

    localStorage.setItem(milestoneKey, 'true');
  }
}



    dismissReminder() {
      this.showReminder.set(false);
    }

  async checkBadgeMilestone(user: User) {
  console.log('[Badge] checkBadgeMilestone called');

  if (!user?._id) {
    console.log('[Badge] Invalid user, exiting.');
    return;
  }

  const userId = user._id;

  // Count completed tasks
  const completedTasks = this.allTasks().filter(t => t.completed);
  const count = completedTasks.length;
  const milestone = Math.floor(count / 5) * 5;

  if (milestone < 5) return;

  try {
    // Fetch existing badges
    const existingBadges: any[] = await firstValueFrom(
      this.badgeService.getUserBadges(userId)
    );

    // Check if this milestone is already awarded
    const hasMilestone = existingBadges.some(b => b.milestone === milestone);
    if (hasMilestone) {
      console.log('[Badge] User already has this exact milestone, skipping');
      return;
    }

    // Optional: debounce / lock to prevent multiple simultaneous calls
    if (this.badgeAwardingInProgress) return;
    this.badgeAwardingInProgress = true;

    // Create new badge object
    const badge = {
      userId,
      milestone,
      name: `${milestone} Tasks Completed`,
      icon: this.getBadgeIcon(milestone),
      type: 'lifetime' as 'lifetime'
    };

    // Call backend
    const awardedResponse: any = await firstValueFrom(
      this.badgeService.createBadge(badge)
    );

    if (awardedResponse?.status === 'success' && awardedResponse.data) {
      this.currentBadge.set(awardedResponse.data);
      this.showBadgeModal.set(true);
      this.badgeService.emitBadgeChange();
      console.log('[Badge] Badge awarded and modal shown');
    }

    this.badgeAwardingInProgress = false;

  } catch (err: any) {
    // If backend returns duplicate key error, just ignore
    if (err?.error?.message === 'Badge already awarded') {
      console.log('[Badge] Duplicate prevented by backend');
    } else {
      console.error('[Badge] Error awarding badge:', err);
    }
    this.badgeAwardingInProgress = false;
  }
}


getBadgeIcon(milestone: number) {
  if (milestone >= 100) return '👑';    // Crown – ultimate achiever
  if (milestone >= 90) return '💎';     // Diamond – near perfection
  if (milestone >= 75) return '🏆';     // Trophy – mastery level
  if (milestone >= 60) return '🥇';     // Gold medal – expert
  if (milestone >= 50) return '🎖️';     // Ribbon – high achiever
  if (milestone >= 40) return '🥈';     // Silver medal – advanced
  if (milestone >= 30) return '🥉';     // Bronze medal – progressing
  if (milestone >= 20) return '🏅';     // Medal – beginner achiever
  if (milestone >= 10) return '⭐';     // Star – first milestone
  if (milestone >= 5) return '✨';      // Sparkle – starter milestone
  return '🔹';                           // Small diamond – very first tasks
}

}