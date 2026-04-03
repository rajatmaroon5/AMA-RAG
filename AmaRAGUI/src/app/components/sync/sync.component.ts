import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatListModule } from '@angular/material/list';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { interval, Subject, takeUntil } from 'rxjs';
import { ApiService } from '../../services/api.service';

interface SyncJobStatus {
  syncJobId: string;
  status: string;
  filesDiscovered: number;
  filesProcessed: number;
  filesFailed: number;
  filesSkipped: number;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  progressPercentage: number;
}

interface SyncJobHistory {
  syncJobId: string;
  startedAt: string;
  completedAt: string | null;
  filesProcessed: number;
  filesSuccessful: number;
  filesFailed: number;
  filesSkipped: number;
  status: string;
  notes: string | null;
}

@Component({
  selector: 'app-sync',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressBarModule,
    MatListModule,
    MatInputModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatTabsModule
  ],
  templateUrl: './sync.component.html',
  styleUrls: ['./sync.component.scss']
})
export class SyncComponent implements OnInit, OnDestroy {
  readonly statusCheckInterval = 2000; // 2 seconds
  
  currentSyncJobId: string | null = null;
  currentSyncStatus: SyncJobStatus | null = null;
  syncHistory: SyncJobHistory[] = [];
  
  isLoading = false;
  isSyncing = false;
  folderPath = '';
  errorMessage = '';
  successMessage = '';
  
  private destroy$ = new Subject<void>();

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadSyncHistory();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async startSync(): Promise<void> {
    if (!this.folderPath.trim()) {
      this.errorMessage = 'Please enter a folder path';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const result = await this.apiService.startSync(this.folderPath);
      this.currentSyncJobId = result.syncJobId;
      this.isSyncing = true;
      this.successMessage = 'Sync started successfully';
      
      // Start polling for status
      this.pollSyncStatus();
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'Failed to start sync';
    } finally {
      this.isLoading = false;
    }
  }

  async startDefaultSync(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const result = await this.apiService.startDefaultSync();
      this.currentSyncJobId = result.syncJobId;
      this.isSyncing = true;
      this.successMessage = 'Sync started successfully';
      
      // Start polling for status
      this.pollSyncStatus();
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'Failed to start sync';
    } finally {
      this.isLoading = false;
    }
  }

  async retryFailedDocuments(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      await this.apiService.retryFailedSync();
      this.successMessage = 'Failed documents marked for retry';
      await this.loadSyncHistory();
    } catch (error: any) {
      this.errorMessage = error?.error?.message || 'Failed to retry failed documents';
    } finally {
      this.isLoading = false;
    }
  }

  private pollSyncStatus(): void {
    if (!this.currentSyncJobId) return;

    interval(this.statusCheckInterval)
      .pipe(takeUntil(this.destroy$))
      .subscribe(async () => {
        try {
          const status = await this.apiService.getSyncStatus(this.currentSyncJobId!);
          this.currentSyncStatus = status;

          if (status.status !== 'Running') {
            this.isSyncing = false;
            await this.loadSyncHistory();
          }
        } catch (error) {
          console.error('Error polling sync status', error);
        }
      });
  }

  async loadSyncHistory(): Promise<void> {
    try {
      this.syncHistory = await this.apiService.getSyncHistory();
    } catch (error) {
      console.error('Error loading sync history', error);
    }
  }

  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'status-completed';
      case 'running':
        return 'status-running';
      case 'failed':
        return 'status-failed';
      default:
        return 'status-unknown';
    }
  }

  getProgressColor(percentage: number): 'primary' | 'accent' | 'warn' {
    if (percentage < 50) return 'primary';
    if (percentage < 90) return 'accent';
    return 'warn';
  }

  formatDate(dateString: string | null): string {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  }

  getDuration(startDate: string, endDate: string | null): string {
    if (!endDate) return 'In progress';
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const seconds = Math.floor((end.getTime() - start.getTime()) / 1000);
      
      if (seconds < 60) return `${seconds}s`;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
      const hours = Math.floor(minutes / 60);
      return `${hours}h ${minutes % 60}m`;
    } catch {
      return 'N/A';
    }
  }
}
