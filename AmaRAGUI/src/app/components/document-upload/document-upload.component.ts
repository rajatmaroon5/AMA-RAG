import { Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../services/api.service';
import { UploadDocumentResponse } from '../../models/models';

interface IngestionFeedback {
  documentId: string;
  name: string;
  chunkCount: number;
  isProcessed: boolean;
  keyTopics: string[];
  ingestionStatus: 'Processing...' | 'Indexed successfully' | 'Failed';
}

@Component({
  selector: 'app-document-upload',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatProgressBarModule,
    MatIconModule,
    MatSnackBarModule
  ],
  template: `
    <div class="upload-container">
      <div class="upload-section">
        <div class="drag-drop-area"
             (dragover)="onDragOver($event)"
             (dragleave)="onDragLeave($event)"
             (drop)="onDrop($event)"
             [class.drag-over]="isDragOver">
          <mat-icon class="upload-icon">cloud_upload</mat-icon>
          <p class="drag-text">Drag and drop PDF, DOCX, or XLSX files here</p>
          <p class="or-text">or</p>
          <button mat-raised-button color="primary" (click)="openFileBrowser()">
            <mat-icon>browse_files</mat-icon>
            Upload Files
          </button>
          <input #fileInput type="file" multiple hidden
            accept=".pdf,.docx,.doc,.xlsx"
                 (change)="onFileSelected($event)">
        </div>

        <div class="selected-files" *ngIf="selectedFiles.length > 0">
          <h3>Ready to Upload:</h3>
          <div class="file-list">
            <div *ngFor="let file of selectedFiles; let i = index" class="file-item">
              <mat-icon>description</mat-icon>
              <span class="file-name">{{ file.name }}</span>
              <span class="file-size">({{ (file.size / 1024 / 1024).toFixed(2) }} MB)</span>
              <button mat-icon-button (click)="removeFile(i)">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </div>

          <div *ngIf="isUploading" class="progress-bar">
            <mat-progress-bar mode="indeterminate"></mat-progress-bar>
            <p>Uploading and processing documents...</p>
          </div>

          <button mat-raised-button color="accent"
                  (click)="uploadFiles()"
                  [disabled]="isUploading"
                  class="upload-btn">
            <mat-icon>upload</mat-icon>
            Upload {{ selectedFiles.length }} {{ selectedFiles.length === 1 ? 'Document' : 'Documents' }}
          </button>
        </div>

        <div class="uploaded-files" *ngIf="uploadedFiles.length > 0">
          <h3>Ingestion Feedback:</h3>
          <div *ngFor="let file of uploadedFiles" class="uploaded-item">
            <mat-icon [class.success]="file.isProcessed">
              {{ file.isProcessed ? 'check_circle' : 'pending' }}
            </mat-icon>
            <div class="file-info">
              <p class="file-name">{{ file.name }}</p>
              <p class="chunk-info">{{ file.ingestionStatus }}</p>
              <p class="chunk-info" *ngIf="(file.keyTopics?.length ?? 0) > 0">
                {{ file.keyTopics.length }} key topics detected: {{ file.keyTopics.join(', ') }}
              </p>
              <p class="chunk-info" *ngIf="file.isProcessed">{{ file.chunkCount }} indexed sections</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .upload-container {
      padding: 30px;
    }

    .upload-section {
      max-width: 600px;
      margin: 0 auto;
    }

    .drag-drop-area {
      border: 2px dashed #1976d2;
      border-radius: 8px;
      padding: 40px 20px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
      background-color: #f5f5f5;
    }

    .drag-drop-area.drag-over {
      background-color: #e3f2fd;
      border-color: #0d47a1;
    }

    .upload-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #1976d2;
      margin-bottom: 10px;
    }

    .drag-text {
      font-size: 16px;
      color: #333;
      margin: 10px 0;
    }

    .or-text {
      color: #999;
      margin: 15px 0;
    }

    .selected-files {
      margin-top: 20px;
      padding: 20px;
      background-color: #f9f9f9;
      border-radius: 8px;
    }

    .file-list {
      margin: 15px 0;
    }

    .file-item {
      display: flex;
      align-items: center;
      padding: 10px;
      background-color: white;
      border-radius: 4px;
      margin-bottom: 8px;
      gap: 10px;
    }

    .file-name {
      flex: 1;
      font-weight: 500;
    }

    .file-size {
      color: #999;
      font-size: 0.9em;
    }

    .progress-bar {
      margin: 20px 0;
    }

    .upload-btn {
      width: 100%;
      margin-top: 20px;
      height: 40px;
    }

    .uploaded-files {
      margin-top: 30px;
      padding: 20px;
      background-color: #e8f5e9;
      border-radius: 8px;
    }

    .uploaded-item {
      display: flex;
      align-items: center;
      padding: 10px;
      margin-bottom: 10px;
      background-color: white;
      border-radius: 4px;
      gap: 10px;
    }

    .uploaded-item mat-icon.success {
      color: #4caf50;
    }

    .file-info p {
      margin: 0;
      line-height: 1.3;
    }

    .file-info .file-name {
      font-weight: 500;
    }

    .file-info .chunk-info {
      font-size: 0.9em;
      color: #666;
    }
  `]
})
export class DocumentUploadComponent implements OnDestroy {
  @ViewChild('fileInput') fileInputRef?: ElementRef<HTMLInputElement>;
  selectedFiles: File[] = [];
  uploadedFiles: IngestionFeedback[] = [];
  isUploading = false;
  isDragOver = false;
  private readonly triggerUploadBrowseHandler = () => this.openFileBrowser();

  constructor(private apiService: ApiService, private snackBar: MatSnackBar) {
    window.addEventListener('ama-rag-trigger-upload-browse', this.triggerUploadBrowseHandler as EventListener);
  }

  ngOnDestroy(): void {
    window.removeEventListener('ama-rag-trigger-upload-browse', this.triggerUploadBrowseHandler as EventListener);
  }

  openFileBrowser(): void {
    this.fileInputRef?.nativeElement.click();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    if (event.dataTransfer?.files) {
      const files = Array.from(event.dataTransfer.files);
      this.selectedFiles.push(...files);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const files = Array.from(input.files);
      this.selectedFiles.push(...files);
    }
  }

  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
  }

  uploadFiles(): void {
    this.isUploading = true;
    let uploadedCount = 0;

    this.selectedFiles.forEach(file => {
      this.upsertFeedback(file.name, {
        documentId: '',
        name: file.name,
        chunkCount: 0,
        isProcessed: false,
        keyTopics: [],
        ingestionStatus: 'Processing...'
      });

      this.apiService.uploadDocument(file).subscribe({
        next: (response: UploadDocumentResponse) => {
          this.upsertFeedback(file.name, {
            documentId: response.documentId,
            name: response.name,
            chunkCount: response.chunkCount,
            isProcessed: response.isProcessed,
            keyTopics: response.keyTopics ?? [],
            ingestionStatus: 'Indexed successfully'
          });

          uploadedCount++;
          if (uploadedCount === this.selectedFiles.length) {
            this.isUploading = false;
            this.selectedFiles = [];
            this.snackBar.open('All files uploaded successfully!', 'Close', { duration: 3000 });
          }
        },
        error: (error) => {
          uploadedCount++;
          this.upsertFeedback(file.name, {
            documentId: '',
            name: file.name,
            chunkCount: 0,
            isProcessed: false,
            keyTopics: [],
            ingestionStatus: 'Failed'
          });

          this.snackBar.open(`Error uploading ${file.name}`, 'Close', { duration: 3000 });
          if (uploadedCount === this.selectedFiles.length) {
            this.isUploading = false;
          }
          console.error('Error:', error);
        }
      });
    });
  }

  private upsertFeedback(name: string, payload: IngestionFeedback): void {
    const existingIndex = this.uploadedFiles.findIndex(file => file.name === name);
    if (existingIndex >= 0) {
      this.uploadedFiles[existingIndex] = payload;
      return;
    }

    this.uploadedFiles.unshift(payload);
  }
}
