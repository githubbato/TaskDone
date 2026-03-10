import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TaskService } from '../../../services/task.service';
import { DatePipe, NgClass, CommonModule, NgFor, NgIf } from '@angular/common';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-task-detail',
    imports: [DatePipe, NgClass, RouterLink, CommonModule, NgIf, NgFor, FormsModule],
    standalone: true,
    templateUrl: './task-detail.component.html',
})
export class TaskDetailComponent implements OnInit {
  task = signal<any>(null);
  isCompleted = signal<boolean>(false);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  deleting = signal<boolean>(false);
  showCongratsModal = signal(false);
  autoClosing = signal(false);
  mood = signal<string | null>(null);
  moodNote = signal<string>('');
  allTasks = signal<any[]>([]);
  unfinishedTasks = computed(() =>
  this.allTasks().filter(t => !t.completed && t._id !== this.task()?._id)
);

  getTaskStatus() {
    const currentTask = this.task();
    if (!currentTask) return 'In Progress';

    if (currentTask.completed) {
      return 'Completed';
    }

    if (currentTask.deadline) {
      const deadline = new Date(currentTask.deadline);
      const now = new Date();
      if (deadline < now) {
        return 'Overdue';
      }
    }

    return 'In Progress';
  }

  

  isOverdue() {
    const currentTask = this.task();
    if (!currentTask || currentTask.completed) return false;

    if (currentTask.deadline) {
      const deadline = new Date(currentTask.deadline);
      const now = new Date();
      return deadline < now;
    }

    return false;
  }

  getStatusClass() {
    const status = this.getTaskStatus();
    switch (status) {
      case 'Completed':
        return 'text-green-700';
      case 'Overdue':
        return 'text-red-700';
      default:
        return 'text-blue-700';
    }
  }

  getStatusIcon() {
    const status = this.getTaskStatus();
    switch (status) {
      case 'Completed':
        return 'fa-check-circle';
      default:
        return 'fa-clock';
    }
  }

  router = inject(Router);
  taskService = inject(TaskService);
  route = inject(ActivatedRoute);
  location = inject(Location);

  constructor() {}

  ngOnInit() {
  this.loading.set(true);
  const id = this.route.snapshot.paramMap.get('id') || '';

  // Load current task
  this.loadTaskDetails(id);
  this.loadIncompleteTasks();
  }

 
 loadIncompleteTasks() {
    this.taskService.getIncompleteTasks().subscribe({
      next: (res: any) => {
        if (res.data && Array.isArray(res.data.tasks)) {
          this.allTasks.set(res.data.tasks);
        } else if (res.data && Array.isArray(res.data)) {
          // fallback if tasks are directly in res.data
          this.allTasks.set(res.data);
        } else {
          this.allTasks.set([]);
        }
        console.log('UNFINISHED TASKS SET:', this.allTasks());
      },
      error: (err) => {
        console.error('Error loading incomplete tasks:', err);
        this.allTasks.set([]);
      }
    });
  }
   loadTaskDetails(id: string) {
    this.taskService.getTaskById(id).subscribe({
      next: response => {
        this.task.set(response.data);
        this.isCompleted.set(this.task()?.completed || false);
        this.loading.set(false);
      },
      error: error => {
        console.error('Error getting task:', error);
        this.error.set(error?.error?.message || 'Error getting task');
        this.loading.set(false);
      }
    });
  }

   goBack(): void {
    // Replace location.back() with direct navigation
    this.router.navigate(['/tasks']);
  }


 
  completeTask() {
    if (!this.task() || this.task().completed) return;

    this.loading.set(true);
    const taskId = this.task()._id;

    this.taskService.updateTask(taskId, { completed: true }).subscribe({
      next: (response) => {
        const updated = response?.data;
        if (updated) {
          this.task.set(updated);
          this.isCompleted.set(true);

          this.allTasks.update(tasks =>
            tasks.map(t => t._id === updated._id ? updated : t)
          );
        }
        this.loading.set(false);
        this.showCongratsModal.set(true);
      },
      error: (error) => {
        console.error('Error completing task:', error);
        this.error.set(error?.error?.message || 'Error marking task as complete');
        this.loading.set(false);
      }
    });
  }

submitMood() {
  if (!this.task()?._id) return;

  const validEmojis = ['😃','🙂','😐','😔','😢'];
  const selectedMood = this.mood()?.trim();

  if (!selectedMood || !validEmojis.includes(selectedMood)) {
    alert('Please select a valid mood emoji');
    return;
  }

  const updatedTask: any = {
    mood: {
      emoji: selectedMood,
      note: this.moodNote()?.trim() || ''
    }
  };

  this.taskService.updateTask(this.task()._id, updatedTask).subscribe({
    next: (response) => {
      console.log('Mood saved:', response.data);
      this.task.set(response.data);

      // Optionally close modal or show confirmation
      this.showCongratsModal.set(false);

      // Reset mood signals
      this.mood.set(null);
      this.moodNote.set('');
    },
    error: (err) => {
      console.error('Error saving mood:', err);
      alert('Failed to save mood. Try again.');
    }
  });
}

  editTask() {
    if (!this.task()?._id) {
      this.error.set('Cannot edit task: Invalid task ID');
      return;
    }
    this.router.navigate(['/tasks/edit', this.task()._id]);
  }

  deleteTask() {
    if (!this.task()?._id) {
      this.error.set('Cannot delete task: Invalid task ID');
      return;
    }
    
    if (confirm('Are you sure you want to delete this task?')) {
      this.deleting.set(true);
      this.error.set(null);
      
      this.taskService.deleteTask(this.task()._id).subscribe({
        next: (response) => {
          console.log('Task deleted successfully:', response);
          this.router.navigate(['/tasks']);
        },
        error: (error) => {
          console.error('Error deleting task:', error);
          this.error.set(error?.error?.message || 'Error deleting task. Please try again.');
          this.deleting.set(false);
        }
      });
    }
  }
  saveMoodAndClose() {
  if (!this.task()?._id) return;

  const validEmojis = ['😃','🙂','😐','😔','😢'];
  const selectedMood = this.mood()?.trim();

  if (!selectedMood || !validEmojis.includes(selectedMood)) {
    alert('Please select a valid mood emoji');
    return;
  }

  const updatedTask: any = {
    mood: {
      emoji: selectedMood,
      note: this.moodNote()?.trim() || ''
    }
  };

  // Call backend to save mood
  this.taskService.updateTask(this.task()._id, updatedTask).subscribe({
    next: (response) => {
      console.log('Mood saved:', response.data);
      this.task.set(response.data);

      // Reset mood signals
      this.mood.set(null);

      // Close modal
      this.closeCongratsModal();

      // Redirect to /tasks
      this.router.navigate(['/tasks']);
    },
    error: (err) => {
      console.error('Error saving mood:', err);
      alert('Failed to save mood. Try again.');

      // Close modal anyway
      this.closeCongratsModal();

      // Optional: redirect even on error
      // this.router.navigate(['/tasks']);
    }
  });

}
  closeCongratsModal() {
    this.autoClosing.set(true);
    setTimeout(() => {
      this.showCongratsModal.set(false);
      this.autoClosing.set(false);
    }, 500);
  }

}
