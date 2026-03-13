import {
  Component,
  inject,
  OnInit,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  ChangeDetectorRef,
} from '@angular/core';
import { TaskService } from '../../services/task.service';
import { Chart, registerables } from 'chart.js';
import { NgIf } from '@angular/common';

Chart.register(...registerables);

interface TaskItem {
 _id: string;
  title?: string;
  description?: string;
  userId?: string;
  createdAt?: string | Date;
  completedAt?: string | Date;
  completed?: boolean;
  priority?: string;
  deadline?: string | Date; // <-- add this
}

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [NgIf],
  templateUrl: './progress.component.html',
})
export class ProgressComponent implements OnInit, AfterViewInit, OnDestroy {
  private taskService = inject(TaskService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('progressCanvas') progressCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('monthlyCanvas') monthlyCanvas!: ElementRef<HTMLCanvasElement>;

  completedTasks = 0;
  pendingTasks = 0;
  overdueTasks = 0;
  overallProgress = 0;
  totalTasks = 0;
  
  // Daily
  dailyCompleted = 0;
  dailyCreated = 0;
  dailyCompletionRate = 0;

  // Weekly
  weeklyCompleted = 0;
  weeklyCreated = 0;
  weeklyCompletionRate = 0;

  pieChart!: Chart;
  barChart!: Chart;

  quotes: string[] = [
  "Don't watch the clock; do what it does. Keep going.",
  "The secret of getting ahead is getting started.",
  "Progress is progress, no matter how small.",
  "Dream big. Start small. Act now.",
  "Success is the sum of small efforts repeated daily.",
  "Small steps every day lead to big results.",
  "Do something today that your future self will thank you for.",
  "Every accomplishment starts with the decision to try.",
  "Keep going. You’re getting there.",
  "Great things never come from comfort zones.",
  "Push yourself because no one else is going to do it for you.",
  "Focus on progress, not perfection.",
  "Your only limit is you.",
  "Don’t wait for opportunity. Create it.",
  "Believe you can and you’re halfway there.",
  "Consistency is the key to success.",
  "The harder you work for something, the greater you’ll feel when you achieve it.",
  "Strive for progress, not perfection.",
  "Success doesn’t come from what you do occasionally; it comes from what you do consistently.",
  "Keep your eyes on the stars, and your feet on the ground.",
  "What you do today can improve all your tomorrows.",
  "You don’t have to be perfect to make progress.",
  "Little by little, a little becomes a lot.",
  "Don’t stop until you’re proud.",
  "The best time to start was yesterday. The next best time is now.",
  "Mistakes are proof that you are trying.",
  "Success is the result of preparation, hard work, and learning from failure.",
  "Stay patient and trust your journey.",
  "You are capable of amazing things.",
  "Do what you can, with what you have, where you are.",
  "Your progress is your power."
];

// Selected quote
currentQuote: string = "";


  private resizeListener = () => {
    if (this.pieChart) this.pieChart.resize();
    if (this.barChart) this.barChart.resize();
  };

  ngOnInit(): void {
    this.displayRandomQuote();
    this.loadProgressStats();
  }

  ngAfterViewInit(): void {
    window.addEventListener('resize', this.resizeListener);
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.resizeListener);
  }

displayRandomQuote(): void {
  const index = Math.floor(Math.random() * this.quotes.length);
  this.currentQuote = this.quotes[index];
}
  
loadProgressStats(): void {
  this.taskService.getProgressStats().subscribe({
    next: (response) => {
      console.log('=== RAW RESPONSE ===', response);

      // =========================
      // Assign summary stats
      // =========================
      this.completedTasks = response.data.completedTasks;
      this.pendingTasks = response.data.pendingTasks;
      this.overdueTasks = response.data.overdueTasks;
      this.overallProgress = response.data.overallProgress;
      this.totalTasks = this.completedTasks + this.pendingTasks + this.overdueTasks;

      const tasksRaw: TaskItem[] = response.data.tasks || [];
      console.log('=== TASKS ARRAY ===', tasksRaw);

      const now = new Date();
      console.log('=== NOW ===', now);

      // =========================
      // Convert backend dates to JS Date objects safely
      // =========================
      const tasks = tasksRaw.map(t => ({
        ...t,
        createdAt: t.createdAt ? new Date(t.createdAt) : null,
        completedAt: t.completedAt ? new Date(t.completedAt) : null,
        deadline: t.deadline ? new Date(t.deadline) : null,
      }));

      // =========================
      // Helper: get local year/month/day
      // =========================
      const getLocalYMD = (date: Date | null) => {
        if (!date) return null;
        return { y: date.getFullYear(), m: date.getMonth(), d: date.getDate() };
      };

      const todayYMD = getLocalYMD(now);
      if (!todayYMD) {
        console.error('Invalid current date');
        return;
      }

      const isSameDay = (date: Date | null) => {
        if (!date) return false;
        const d = getLocalYMD(date);
        return d!.y === todayYMD.y && d!.m === todayYMD.m && d!.d === todayYMD.d;
      };

      // =========================
      // Start of the week (Sunday)
      // =========================
      const startOfWeek = new Date(now);
      startOfWeek.setHours(0, 0, 0, 0);
      startOfWeek.setDate(now.getDate() - now.getDay());

      const isThisWeek = (date: Date | null) => {
        if (!date) return false;
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d.getTime() >= startOfWeek.getTime();
      };

      // =========================
      // DAILY REPORT
      // =========================
      this.dailyCreated = tasks.filter(t => t.createdAt && isSameDay(t.createdAt)).length;
      this.dailyCompleted = tasks.filter(t => t.completedAt && isSameDay(t.completedAt)).length;
      this.dailyCompletionRate = this.dailyCreated > 0
        ? Math.round((this.dailyCompleted / this.dailyCreated) * 100)
        : 0;

      console.log('=== DAILY RESULTS ===');
      console.log('Daily Created:', this.dailyCreated);
      console.log('Daily Completed:', this.dailyCompleted);
      console.log('Daily Completion Rate:', this.dailyCompletionRate);

      // =========================
      // WEEKLY REPORT
      // =========================
      this.weeklyCreated = tasks.filter(t => t.createdAt && isThisWeek(t.createdAt)).length;
      this.weeklyCompleted = tasks.filter(t => t.completedAt && isThisWeek(t.completedAt)).length;
      this.weeklyCompletionRate = this.weeklyCreated > 0
        ? Math.round((this.weeklyCompleted / this.weeklyCreated) * 100)
        : 0;

      console.log('=== WEEKLY RESULTS ===');
      console.log('Weekly Created:', this.weeklyCreated);
      console.log('Weekly Completed:', this.weeklyCompleted);
      console.log('Weekly Completion Rate:', this.weeklyCompletionRate);

      // =========================
      // CHARTS
      // =========================
      // CHARTS
if (this.totalTasks > 0) {
  if (!this.pieChart) this.createPieChart();
  else this.updatePieChart();

  // Fixed 6-month window
  const months = this.getSixMonthLabels(); // March → August if today is March
  const monthlyCounts: number[] = Array(6).fill(0);
  const currentMonth = new Date().getMonth();

  tasks.forEach(t => {
    if (t.completedAt) {
      const taskMonth = t.completedAt.getMonth();
      const diff = (taskMonth - currentMonth + 12) % 12;
      if (diff >= 0 && diff < 6) {
        monthlyCounts[diff] += 1;
      }
    }
  });

  if (!this.barChart) this.createBarChart();
  this.updateBarChart(months, monthlyCounts);
}

      // Force Angular to update template
      this.cdr.detectChanges();
    },
    error: (error) => console.error('Error loading progress stats:', error),
  });
}
  // ======================
  // PIE CHART
  // ======================
  createPieChart() {
    if (!this.progressCanvas) return;

    this.pieChart = new Chart(this.progressCanvas.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Completed', 'Pending', 'Overdue'],
        datasets: [
          {
            data: [this.completedTasks, this.pendingTasks, this.overdueTasks],
            backgroundColor: ['#16a34a', '#facc15', '#ef4444'],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        animation: { duration: 1000 },
        plugins: { legend: { position: 'bottom' } },
      },
    });
  }

  updatePieChart() {
    if (!this.pieChart) return;
    this.pieChart.data.datasets[0].data = [
      this.completedTasks,
      this.pendingTasks,
      this.overdueTasks,
    ];
    this.pieChart.update();
  }

 // ======================
// BAR CHART
// ======================

getSixMonthLabels(startMonth?: number) {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const today = new Date();
  const start = startMonth ?? today.getMonth(); // 0 = Jan, 2 = Mar

  const labels = [];
  for (let i = 0; i < 6; i++) {
    const monthIndex = (start + i) % 12;
    labels.push(monthNames[monthIndex]);
  }
  return labels;
}
createBarChart() {
  if (!this.monthlyCanvas) return;

  const labels = this.getSixMonthLabels(); // always start from current month

  this.barChart = new Chart(this.monthlyCanvas.nativeElement, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Tasks Completed',
          data: Array(6).fill(0), // start with empty data
          backgroundColor: '#3b82f6',
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1000 },
      plugins: {
        legend: { display: true, position: 'top', labels: { font: { size: 14, weight: 'bold' }, color: '#374151' } },
        tooltip: { enabled: true },
      },
      scales: {
       y: { 
  beginAtZero: true,
  ticks: {
    precision: 0, // removes decimals
    callback: function(value) {
      return Number.isInteger(value) ? value : null; // hide decimal ticks
    }
  },
  title: { 
    display: true, 
    text: 'Number of Tasks Completed', 
    color: '#374151', 
    font: { size: 14, weight: 'bold' } 
  } 
},
        x: { title: { display: true, text: 'Month', color: '#374151', font: { size: 14, weight: 'bold' } } },
      },
    },
  });
}

  updateBarChart(labels: string[], data: number[]) {
    if (!this.barChart) return;
    this.barChart.data.labels = labels;
    this.barChart.data.datasets[0].data = data;
    this.barChart.update();
  }
}