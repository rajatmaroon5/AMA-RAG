import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { DocumentChunk } from '../../models/models';

interface ChunksDialogData {
  documentName: string;
  chunks: DocumentChunk[];
}

@Component({
  selector: 'app-chunks-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatExpansionModule,
    MatCardModule,
    MatDividerModule
  ],
  template: `
    <div class="chunks-dialog">
      <div class="header">
        <h2>{{ data.documentName }}</h2>
        <p class="chunk-count">Total Chunks: <strong>{{ data.chunks.length }}</strong></p>
      </div>

      <mat-accordion class="chunks-list">
        <mat-expansion-panel *ngFor="let chunk of data.chunks; let i = index" class="chunk-panel">
          <mat-expansion-panel-header>
            <mat-panel-title>
              <span class="chunk-number">Chunk {{ chunk.chunkIndex + 1 }}</span>
              <span class="chunk-preview">{{ chunk.content | slice: 0: 60 }}...</span>
            </mat-panel-title>
            <mat-panel-description>
              <span class="vector-id">{{ chunk.vectorId }}</span>
            </mat-panel-description>
          </mat-expansion-panel-header>

          <div class="chunk-content">
            <div class="chunk-info">
              <div class="info-item">
                <strong>Vector ID:</strong>
                <code>{{ chunk.vectorId }}</code>
              </div>
              <div class="info-item">
                <strong>Chunk Index:</strong>
                <span>{{ chunk.chunkIndex }}</span>
              </div>
              <div class="info-item">
                <strong>Created At:</strong>
                <span>{{ chunk.createdAt | date: 'short' }}</span>
              </div>
            </div>

            <mat-divider></mat-divider>

            <div class="chunk-text">
              <strong>Content:</strong>
              <p class="content-preview">{{ chunk.content }}</p>
            </div>

            <div class="chunk-actions">
              <button mat-button color="primary" (click)="copyToClipboard(chunk.content)">
                <mat-icon>content_copy</mat-icon>
                Copy Content
              </button>
              <button mat-button (click)="copyToClipboard(chunk.vectorId)">
                <mat-icon>content_copy</mat-icon>
                Copy Vector ID
              </button>
            </div>
          </div>
        </mat-expansion-panel>
      </mat-accordion>
    </div>
  `,
  styles: [`
    .chunks-dialog {
      padding: 0;
      min-height: 400px;
      max-height: 100%;
    }

    .header {
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-bottom: 2px solid #667eea;
    }

    .header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }

    .chunk-count {
      margin: 10px 0 0 0;
      font-size: 14px;
      opacity: 0.9;
    }

    .chunks-list {
      display: block;
      padding: 20px;
      background: #f9f9f9;
    }

    .chunk-panel {
      margin-bottom: 10px;
      border-left: 4px solid #667eea;
    }

    .chunk-number {
      font-weight: 600;
      color: #667eea;
      min-width: 80px;
      display: inline-block;
    }

    .chunk-preview {
      color: #666;
      font-size: 12px;
      flex: 1;
      margin-left: 20px;
    }

    .vector-id {
      color: #999;
      font-size: 11px;
      font-family: monospace;
      word-break: break-all;
    }

    .chunk-content {
      padding: 20px;
      background: white;
    }

    .chunk-info {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 15px;
      margin-bottom: 15px;
    }

    .info-item {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .info-item strong {
      color: #333;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .info-item code {
      font-family: 'Courier New', monospace;
      background: #f5f5f5;
      padding: 5px 8px;
      border-radius: 3px;
      font-size: 12px;
      word-break: break-all;
      color: #d9534f;
    }

    .info-item span {
      font-size: 14px;
      color: #666;
    }

    .chunk-text {
      margin: 20px 0;
    }

    .chunk-text strong {
      display: block;
      margin-bottom: 10px;
      color: #333;
    }

    .content-preview {
      line-height: 1.6;
      color: #555;
      padding: 15px;
      background: #f5f5f5;
      border-radius: 4px;
      border-left: 3px solid #667eea;
      margin: 0;
      max-height: 300px;
      overflow-y: auto;
    }

    .chunk-actions {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }

    mat-divider {
      margin: 15px 0;
    }

    mat-expansion-panel-header {
      display: flex;
      align-items: center;
    }

    mat-panel-title {
      display: flex;
      align-items: center;
      flex: 1;
      width: 100%;
    }

    mat-panel-description {
      justify-content: flex-end;
      align-items: center;
    }
  `]
})
export class ChunksDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: ChunksDialogData) {}

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      console.log('Copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }
}
