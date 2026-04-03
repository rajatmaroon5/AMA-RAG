import { AfterViewInit, Component, ElementRef, Inject, OnDestroy, OnInit, ViewChild, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ApiService } from '../../services/api.service';
import { Document, DocumentChunk } from '../../models/models';
import { ChunksDialogComponent } from './chunks-dialog.component';

type UploadStage = 'uploading' | 'processing' | 'completed' | 'failed';

interface UploadFileState {
  name: string;
  uploadPercent: number;
  stage: UploadStage;
}

@Component({
  selector: 'app-document-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    ChunksDialogComponent,
    forwardRef(() => DeleteConfirmationDialogComponent)
  ],
  template: `
    <div class="document-list-container">
      <input
        #uploadInput
        type="file"
        multiple
        hidden
        accept=".pdf,.docx,.doc,.xlsx"
        (change)="onFilesSelected($event)">

      <div *ngIf="isLoading" class="loading">
        <mat-spinner diameter="40"></mat-spinner>
        <p>Loading documents...</p>
      </div>

      <div class="upload-progress" *ngIf="isUploading">
        <div class="upload-progress-text">
          {{ uploadPhaseMessage }} {{ uploadCompletedCount }}/{{ uploadTotalCount }} files ({{ uploadProgressPercent }}%)
        </div>
        <div class="upload-progress-subtext" *ngIf="uploadEstimatedRemainingLabel">
          {{ uploadEstimatedRemainingLabel }}
        </div>
        <mat-progress-bar mode="determinate" [value]="uploadProgressPercent"></mat-progress-bar>
      </div>

      <div class="documents-grid-scroll" *ngIf="!isLoading && dataSource.data.length > 0">
        <table
          mat-table
          [dataSource]="dataSource"
          matSort
          class="document-table">
        <!-- Name Column -->
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef mat-sort-header="name">Document Name</th>
          <td mat-cell *matCellDef="let element">
            <div class="document-name">
              <img src="assets/documents.png" alt="Document" class="document-icon">
              <span>{{ element.name }}</span>
              <mat-icon class="doc-verified-icon">check_circle</mat-icon>
            </div>
          </td>
        </ng-container>

        <!-- Uploaded Date Column -->
        <ng-container matColumnDef="uploadedAt">
          <th mat-header-cell *matHeaderCellDef mat-sort-header="uploadedAt">Uploaded On</th>
          <td mat-cell *matCellDef="let element">
            {{ element.uploadedAt | date: 'short' }}
          </td>
        </ng-container>

        <!-- Indexed Sections Column -->
        <ng-container matColumnDef="chunks">
          <th mat-header-cell *matHeaderCellDef>Indexed Sections</th>
          <td mat-cell *matCellDef="let element">
            <button mat-button class="chunks-btn" (click)="viewChunks(element)" [disabled]="!element.isProcessed" matTooltip="View indexed sections">
              <mat-icon>view_list</mat-icon>
              <span class="chunks-badge">{{ element.chunkCount }} sections</span>
            </button>
          </td>
        </ng-container>

        <!-- Error Column -->
        <ng-container matColumnDef="error">
          <th mat-header-cell *matHeaderCellDef>Error</th>
          <td mat-cell *matCellDef="let element">
            <span *ngIf="element.errorMessage" class="error-message" [title]="element.errorMessage">
              Error: {{ element.errorMessage }}
            </span>
            <span *ngIf="!element.errorMessage" class="no-error">-</span>
          </td>
        </ng-container>

        <!-- Actions Column -->
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef>Actions</th>
          <td mat-cell *matCellDef="let element">
            <button mat-icon-button color="warn" (click)="deleteDocument(element)" [title]="'Delete ' + element.name">
              <mat-icon>delete</mat-icon>
            </button>
          </td>
        </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
      </div>

      <div class="paginator-row" *ngIf="!isLoading && dataSource.data.length > pageSize">
        <mat-paginator
          class="compact-paginator"
          [length]="dataSource.data.length"
          [pageSize]="pageSize"
          [pageSizeOptions]="[8]"
          [hidePageSize]="true"
          [showFirstLastButtons]="true">
        </mat-paginator>
      </div>

      <div *ngIf="!isLoading && dataSource.data.length === 0" class="empty-state">
        <img src="assets/documents.png" alt="Document" class="document-icon empty-state-icon">
        <p>No documents uploaded yet. Use the Upload section above to get started.</p>
      </div>
    </div>
  `,
  styles: [`
    .document-list-container {
      padding: 8px 30px 30px;
      height: 100%;
      min-height: 0;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }

    .documents-grid-scroll {
      height: 340px;
    }

    .paginator-row {
      display: flex;
      justify-content: flex-end;
      margin-top: 33px;
      padding-top: 57px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .compact-paginator {
      width: auto;
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 8px;
    }

    :host ::ng-deep .compact-paginator .mat-mdc-paginator-container {
      min-height: 40px;
      padding: 0 6px;
      justify-content: flex-end;
      gap: 2px;
    }

    :host ::ng-deep .compact-paginator .mat-mdc-icon-button {
      color: var(--app-accent, #111111);
    }

    :host ::ng-deep .compact-paginator .mat-mdc-paginator-navigation-previous,
    :host ::ng-deep .compact-paginator .mat-mdc-paginator-navigation-next,
    :host ::ng-deep .compact-paginator .mat-mdc-paginator-navigation-first,
    :host ::ng-deep .compact-paginator .mat-mdc-paginator-navigation-last {
      color: var(--app-accent, #111111);
    }

    :host ::ng-deep .compact-paginator .mat-mdc-paginator-icon {
      fill: var(--app-accent, #111111) !important;
    }

    :host ::ng-deep .compact-paginator .mat-mdc-paginator-range-label {
      color: var(--app-accent, #111111);
      opacity: 1;
    }

    :host ::ng-deep .compact-paginator .mat-mdc-icon-button[disabled] .mat-mdc-paginator-icon,
    :host ::ng-deep .compact-paginator .mat-mdc-icon-button.mat-mdc-button-disabled .mat-mdc-paginator-icon {
      fill: color-mix(in srgb, var(--app-accent, #111111) 45%, #ffffff 55%) !important;
      opacity: 1;
    }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
    }

    .loading p {
      margin-top: 20px;
      color: #9ca3af;
      font-size: 16px;
    }

    .upload-progress {
      margin-bottom: 16px;
      padding: 10px 12px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.45);
    }

    .chunks-btn {
      color: var(--app-accent, #111111);
    }

    .upload-progress-text {
      font-size: 0.9rem;
      color: #d1d5db;
      margin-bottom: 8px;
      font-weight: 500;
    }

    .upload-progress-subtext {
      font-size: 0.82rem;
      color: #9ca3af;
      margin-bottom: 8px;
    }

    .document-table {
      width: 100%;
      background-color: transparent;
      border-collapse: collapse;
    }

    th {
      font-weight: 600;
      color: #ffffff;
      text-align: left;
      padding: 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    }

    td {
      padding: 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      color: #e5e7eb;
    }

    tr.mat-mdc-header-row,
    tr.mat-mdc-row {
      height: 32px;
    }

    .document-table .mat-mdc-header-row {
      background-color: #000000;
    }

    .document-table .mat-mdc-header-cell {
      background-color: transparent;
      color: #ffffff;
      position: sticky;
      top: 0;
      z-index: 3;
    }

    .document-table .mat-mdc-cell,
    .document-table .mat-mdc-header-cell {
      min-height: 32px;
      box-sizing: border-box;
      line-height: 1.2;
    }

    tr:hover {
      background-color: rgba(255, 255, 255, 0.03);
    }

    .document-name {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 500;
    }

    .doc-verified-icon {
      margin-left: 2px;
      color: #22c55e;
      font-size: 18px;
      width: 18px;
      height: 18px;
      line-height: 18px;
    }

    .document-icon {
      width: 24px;
      height: 24px;
      object-fit: contain;
      flex-shrink: 0;
    }

    .empty-state-icon {
      width: 64px;
      height: 64px;
      margin-bottom: 20px;
      opacity: 0.5;
    }

    .chunks-badge {
      background-color: rgba(17, 17, 17, 0.12);
      color: var(--app-accent, #111111);
      padding: 4px 12px;
      border-radius: 20px;
      font-weight: 500;
      font-size: 0.9em;
    }

    .error-message {
      color: #d32f2f;
      font-size: 0.9em;
    }

    .no-error {
      color: #9ca3af;
    }

    button[color="warn"] {
      color: #d32f2f;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #9ca3af;
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 20px;
      opacity: 0.5;
    }

    .empty-state p {
      font-size: 16px;
      margin: 0;
    }
  `]
})
export class DocumentListComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(MatPaginator)
  set paginator(value: MatPaginator | undefined) {
    this._paginator = value;
    this.bindTableFeatures();
  }

  @ViewChild(MatSort)
  set sort(value: MatSort | undefined) {
    this._sort = value;
    this.bindTableFeatures();
  }

  @ViewChild('uploadInput') uploadInputRef?: ElementRef<HTMLInputElement>;
  dataSource = new MatTableDataSource<Document>([]);
  isLoading = false;
  isUploading = false;
  uploadProgressPercent = 0;
  uploadCompletedCount = 0;
  uploadTotalCount = 0;
  uploadPhaseMessage = 'Uploading files...';
  uploadEstimatedRemainingLabel = '';
  readonly pageSize = 8;
  private _paginator?: MatPaginator;
  private _sort?: MatSort;
  private readonly triggerUploadBrowseHandler = () => this.triggerUploadBrowse();
  private readonly triggerRefreshHandler = () => this.loadDocuments();
  private uploadBatchStartMs = 0;
  private uploadTimer?: ReturnType<typeof setInterval>;

  get displayedColumns(): string[] {
    const cols = ['name', 'uploadedAt', 'chunks', 'actions'];
    if (this.dataSource.data.some(d => d.errorMessage)) {
      cols.splice(3, 0, 'error');
    }
    return cols;
  }

  constructor(
    private apiService: ApiService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.dataSource.sortingDataAccessor = (item: Document, property: string): string | number => {
      if (property === 'uploadedAt') {
        return new Date(item.uploadedAt).getTime();
      }

      if (property === 'name') {
        return item.name.toLowerCase();
      }

      return (item as unknown as Record<string, string | number>)[property] ?? '';
    };

    window.addEventListener('ama-rag-trigger-upload-browse', this.triggerUploadBrowseHandler as EventListener);
    window.addEventListener('ama-rag-trigger-documents-refresh', this.triggerRefreshHandler as EventListener);
  }

  ngOnInit(): void {
    this.loadDocuments();
  }

  ngAfterViewInit(): void {
    this.bindTableFeatures();
  }

  ngOnDestroy(): void {
    window.removeEventListener('ama-rag-trigger-upload-browse', this.triggerUploadBrowseHandler as EventListener);
    window.removeEventListener('ama-rag-trigger-documents-refresh', this.triggerRefreshHandler as EventListener);
    this.clearUploadTimer();
  }

  loadDocuments(): void {
    this.isLoading = true;
    this.apiService.getDocuments().subscribe({
      next: (documents) => {
        this.dataSource.data = this.orderByNewestFirst(documents);
        this._paginator?.firstPage();
        this.bindTableFeatures();
        this.isLoading = false;
      },
      error: (error) => {
        this.isLoading = false;

        if (this.isNoDocumentsResponse(error)) {
          this.dataSource.data = [];
          this._paginator?.firstPage();
          this.bindTableFeatures();
          return;
        }

        this.snackBar.open('Error loading documents', 'Close', { duration: 3000 });
        console.error('Error:', error);
      }
    });
  }

  private isNoDocumentsResponse(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse)) {
      return false;
    }

    if (error.status === 404 || error.status === 204) {
      return true;
    }

    const message = this.extractErrorMessage(error.error).toLowerCase();
    return message.includes('no document') || message.includes('not found');
  }

  private extractErrorMessage(errorBody: unknown): string {
    if (!errorBody) {
      return '';
    }

    if (typeof errorBody === 'string') {
      return errorBody;
    }

    if (typeof errorBody === 'object' && errorBody !== null && 'message' in errorBody) {
      const maybeMessage = (errorBody as { message?: unknown }).message;
      return typeof maybeMessage === 'string' ? maybeMessage : '';
    }

    return '';
  }

  triggerUploadBrowse(): void {
    this.uploadInputRef?.nativeElement.click();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];

    if (files.length === 0) {
      return;
    }

    this.isUploading = true;
    this.uploadProgressPercent = 0;
    this.uploadCompletedCount = 0;
    this.uploadTotalCount = files.length;
    this.uploadPhaseMessage = 'Uploading files...';
    this.uploadEstimatedRemainingLabel = '';
    this.uploadBatchStartMs = Date.now();
    this.startUploadTimer();

    const fileStates = new Map<string, UploadFileState>();
    files.forEach(file => fileStates.set(file.name, {
      name: file.name,
      uploadPercent: 0,
      stage: 'uploading'
    }));

    let completed = 0;
    let failed = 0;

    files.forEach(file => {
      this.apiService.uploadDocumentWithProgress(file).subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            const percent = Math.round((100 * event.loaded) / event.total);
            const state = fileStates.get(file.name);
            if (state) {
              state.uploadPercent = Math.min(100, percent);
              if (state.uploadPercent >= 100 && state.stage === 'uploading') {
                state.stage = 'processing';
              }
            }
            this.updateUploadProgress(fileStates);
          }

          if (event.type === HttpEventType.Response) {
            const state = fileStates.get(file.name);
            if (state) {
              state.uploadPercent = 100;
              state.stage = 'completed';
            }
            completed++;
            this.uploadCompletedCount = completed;
            this.updateUploadProgress(fileStates);
            if (completed === files.length) {
              this.finishUploadBatch(files.length, failed, input);
            }
          }
        },
        error: (error) => {
          completed++;
          failed++;
          const state = fileStates.get(file.name);
          if (state) {
            state.uploadPercent = 100;
            state.stage = 'failed';
          }
          this.uploadCompletedCount = completed;
          this.updateUploadProgress(fileStates);
          console.error('Error uploading file:', file.name, error);
          if (completed === files.length) {
            this.finishUploadBatch(files.length, failed, input);
          }
        }
      });
    });
  }

  private finishUploadBatch(total: number, failed: number, input: HTMLInputElement): void {
    this.isUploading = false;
    this.uploadProgressPercent = 100;
    this.uploadPhaseMessage = 'Upload complete';
    this.uploadEstimatedRemainingLabel = '';
    this.clearUploadTimer();
    input.value = '';

    if (failed === 0) {
      this.snackBar.open(
        `${total} ${total === 1 ? 'document' : 'documents'} uploaded successfully`,
        'Close',
        { duration: 3000 }
      );
    } else {
      this.snackBar.open(
        `${total - failed} uploaded, ${failed} failed`,
        'Close',
        { duration: 4000 }
      );
    }

    this.loadDocuments();
  }

  private updateUploadProgress(fileStates: Map<string, UploadFileState>): void {
    if (fileStates.size === 0) {
      this.uploadProgressPercent = 0;
      this.uploadPhaseMessage = 'Uploading files...';
      return;
    }

    const states = Array.from(fileStates.values());
    const totalUploadPercent = states.reduce((sum, state) => sum + state.uploadPercent, 0);
    const uploadPercent = totalUploadPercent / states.length;
    const processedCount = states.filter(state => state.stage === 'completed' || state.stage === 'failed').length;
    const processingPercent = (processedCount / states.length) * 100;

    // Keep progress below 100% until embedding/indexing responses are completed.
    this.uploadProgressPercent = Math.min(99, Math.round((uploadPercent * 0.6) + (processingPercent * 0.4)));

    const hasUploading = states.some(state => state.stage === 'uploading');
    const hasProcessing = states.some(state => state.stage === 'processing');

    if (hasUploading) {
      this.uploadPhaseMessage = 'Uploading files...';
    } else if (hasProcessing) {
      this.uploadPhaseMessage = 'Embedding and indexing in progress...';
    } else {
      this.uploadPhaseMessage = 'Finalizing...';
    }

    this.updateEstimatedRemaining();
  }

  private startUploadTimer(): void {
    this.clearUploadTimer();
    this.uploadTimer = setInterval(() => this.updateEstimatedRemaining(), 1000);
  }

  private clearUploadTimer(): void {
    if (this.uploadTimer) {
      clearInterval(this.uploadTimer);
      this.uploadTimer = undefined;
    }
  }

  private updateEstimatedRemaining(): void {
    if (!this.isUploading || this.uploadProgressPercent <= 0) {
      this.uploadEstimatedRemainingLabel = '';
      return;
    }

    const elapsedSeconds = Math.max(1, Math.floor((Date.now() - this.uploadBatchStartMs) / 1000));
    const remainingPercent = Math.max(0, 100 - this.uploadProgressPercent);
    const estimatedRemainingSeconds = Math.round((elapsedSeconds * remainingPercent) / this.uploadProgressPercent);

    this.uploadEstimatedRemainingLabel = `Estimated time remaining: ${this.formatDuration(estimatedRemainingSeconds)}`;
  }

  private formatDuration(totalSeconds: number): string {
    if (totalSeconds < 60) {
      return `${totalSeconds}s`;
    }

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  }

  private orderByNewestFirst(documents: Document[]): Document[] {
    return documents
      .slice()
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  deleteDocument(document: Document): void {
    this.dialog.open(DeleteConfirmationDialogComponent, {
      width: '460px',
      maxWidth: '95vw',
      data: { documentName: document.name }
    }).afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) {
        return;
      }

      this.apiService.deleteDocument(document.id).subscribe({
        next: () => {
          this.dataSource.data = this.dataSource.data.filter(d => d.id !== document.id);
          this._paginator?.firstPage();
          this.snackBar.open('Document deleted successfully', 'Close', { duration: 3000 });
        },
        error: (error) => {
          this.snackBar.open('Error deleting document', 'Close', { duration: 3000 });
          console.error('Error:', error);
        }
      });
    });
  }

  viewChunks(document: Document): void {
    this.apiService.getDocumentChunks(document.id).subscribe({
      next: (chunks: DocumentChunk[]) => {
        this.dialog.open(ChunksDialogComponent, {
          width: '900px',
          maxHeight: '90vh',
          data: {
            documentName: document.name,
            chunks: chunks
          }
        });
      },
      error: (error) => {
        this.snackBar.open('Error loading chunks', 'Close', { duration: 3000 });
        console.error('Error:', error);
      }
    });
  }

  private bindTableFeatures(): void {
    if (this._sort) {
      this.dataSource.sort = this._sort;
    }
    if (this._paginator) {
      this.dataSource.paginator = this._paginator;
    }
  }
}

interface DeleteConfirmationDialogData {
  documentName: string;
}

@Component({
  selector: 'app-delete-confirmation-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Delete Document?</h2>
    <mat-dialog-content>
      <p>
        You are about to delete
        <strong>{{ data.documentName }}</strong>
        and all its embeddings.
      </p>
      <p>This action cannot be undone.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="close(false)">Cancel</button>
      <button mat-flat-button color="warn" (click)="close(true)">Delete</button>
    </mat-dialog-actions>
  `
})
export class DeleteConfirmationDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<DeleteConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DeleteConfirmationDialogData
  ) {}

  close(confirmed: boolean): void {
    this.dialogRef.close(confirmed);
  }
}
