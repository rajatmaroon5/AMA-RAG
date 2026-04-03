import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpErrorResponse } from '@angular/common/http';
import { SharePointDocument, SharePointLibrary, SharePointService, SharePointSite } from '../../services/sharepoint.service';

@Component({
  selector: 'app-sharepoint-connect-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  template: `
    <h2 mat-dialog-title>Connect to SharePoint</h2>

    <div mat-dialog-content class="sp-dialog-content">
      <p class="sp-help">
        1) Click Open Microsoft Sign-in. 2) Complete sign-in in the new tab. 3) Paste the authorization code below.
      </p>

      <div class="sp-auth-row">
        <button mat-stroked-button type="button" (click)="openOAuth()" [disabled]="isBusy">
          Open Microsoft Sign-in
        </button>
        <button mat-button type="button" (click)="clearToken()" [disabled]="isBusy || !hasToken">
          Disconnect
        </button>
      </div>

      <label class="sp-label" for="authCode">Authorization code</label>
      <textarea
        id="authCode"
        [(ngModel)]="authCode"
        [disabled]="isBusy"
        rows="3"
        class="sp-input"
        placeholder="Paste code from redirect URL..."></textarea>

      <div class="sp-auth-row">
        <button mat-raised-button color="primary" type="button" (click)="connect()" [disabled]="isBusy || !authCode.trim()">
          Connect
        </button>
        <button mat-button type="button" (click)="loadSites()" [disabled]="isBusy || !hasToken">
          Refresh Sites
        </button>
      </div>

      <div class="sp-loading" *ngIf="isBusy">
        <mat-spinner diameter="28"></mat-spinner>
        <span>{{ busyMessage }}</span>
      </div>

      <div class="sp-error" *ngIf="errorMessage">{{ errorMessage }}</div>

      <div class="sp-section" *ngIf="sites.length > 0">
        <label class="sp-label" for="site">Site</label>
        <select id="site" class="sp-select" [(ngModel)]="selectedSiteId" (ngModelChange)="onSiteChange()" [disabled]="isBusy">
          <option [ngValue]="''">Select a site</option>
          <option *ngFor="let site of sites" [ngValue]="site.id">{{ site.displayName }}</option>
        </select>
      </div>

      <div class="sp-section" *ngIf="libraries.length > 0">
        <label class="sp-label" for="library">Library</label>
        <select id="library" class="sp-select" [(ngModel)]="selectedLibraryId" (ngModelChange)="onLibraryChange()" [disabled]="isBusy">
          <option [ngValue]="''">Select a library</option>
          <option *ngFor="let library of libraries" [ngValue]="library.id">{{ library.name }}</option>
        </select>
      </div>

      <div class="sp-section" *ngIf="documents.length > 0">
        <div class="sp-doc-head">
          <span>Documents</span>
          <button mat-button type="button" (click)="toggleSelectAll()" [disabled]="isBusy">
            {{ allSelected ? 'Clear all' : 'Select all' }}
          </button>
        </div>

        <div class="sp-doc-list">
          <label class="sp-doc-item" *ngFor="let doc of documents">
            <input type="checkbox" [checked]="isSelected(doc.id)" (change)="toggleSelection(doc.id)" [disabled]="isBusy" />
            <span class="sp-doc-name">{{ doc.name }}</span>
            <span class="sp-doc-meta">{{ doc.lastModifiedDateTime | date:'short' }}</span>
          </label>
        </div>

        <div class="sp-auth-row">
          <button mat-raised-button color="primary" type="button" (click)="importSelected()" [disabled]="isBusy || selectedDocIds.size === 0">
            Import selected
          </button>
        </div>
      </div>

      <div class="sp-success" *ngIf="successMessage">{{ successMessage }}</div>
    </div>

    <div mat-dialog-actions align="end">
      <button mat-button type="button" (click)="close(false)">Close</button>
      <button mat-flat-button color="primary" type="button" (click)="close(importedAny)">Done</button>
    </div>
  `,
  styles: [`
    .sp-dialog-content {
      min-width: 560px;
      max-width: 680px;
      color: #e5e7eb;
    }

    .sp-help {
      margin: 0 0 10px;
      font-size: 13px;
      color: #cbd5e1;
    }

    .sp-label {
      display: block;
      margin: 10px 0 6px;
      font-size: 12px;
      color: #f8fafc;
    }

    .sp-input,
    .sp-select {
      width: 100%;
      box-sizing: border-box;
      background: #0b0b0b;
      color: #f8fafc;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 8px 10px;
      outline: none;
    }

    .sp-auth-row {
      margin-top: 10px;
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .sp-loading {
      margin-top: 10px;
      display: flex;
      align-items: center;
      gap: 10px;
      color: #cbd5e1;
    }

    .sp-error {
      margin-top: 10px;
      color: #fca5a5;
      font-size: 13px;
    }

    .sp-success {
      margin-top: 10px;
      color: #86efac;
      font-size: 13px;
    }

    .sp-section {
      margin-top: 12px;
    }

    .sp-doc-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
      color: #f8fafc;
      font-size: 13px;
    }

    .sp-doc-list {
      max-height: 220px;
      overflow-y: auto;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.35);
    }

    .sp-doc-item {
      display: grid;
      grid-template-columns: 20px 1fr auto;
      gap: 8px;
      align-items: center;
      padding: 8px 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    }

    .sp-doc-item:last-child {
      border-bottom: none;
    }

    .sp-doc-name {
      color: #f8fafc;
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sp-doc-meta {
      color: #94a3b8;
      font-size: 12px;
    }

    @media (max-width: 720px) {
      .sp-dialog-content {
        min-width: 0;
      }

      .sp-doc-item {
        grid-template-columns: 20px 1fr;
      }

      .sp-doc-meta {
        display: none;
      }
    }
  `]
})
export class SharePointConnectDialogComponent {
  authCode = '';
  isBusy = false;
  busyMessage = '';
  errorMessage = '';
  successMessage = '';
  importedAny = false;

  sites: SharePointSite[] = [];
  libraries: SharePointLibrary[] = [];
  documents: SharePointDocument[] = [];

  selectedSiteId = '';
  selectedLibraryId = '';
  selectedDocIds = new Set<string>();

  constructor(
    private dialogRef: MatDialogRef<SharePointConnectDialogComponent>,
    private sharePointService: SharePointService
  ) {
    if (this.hasToken) {
      this.loadSites();
    }
  }

  get hasToken(): boolean {
    return !!this.sharePointService.getStoredAuthToken();
  }

  get allSelected(): boolean {
    return this.documents.length > 0 && this.selectedDocIds.size === this.documents.length;
  }

  openOAuth(): void {
    this.errorMessage = '';
    this.successMessage = '';

    this.setBusy(true, 'Generating sign-in URL...');
    this.sharePointService.getOAuthUrl().subscribe({
      next: (url) => {
        window.open(url, '_blank', 'noopener');
        this.setBusy(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage = this.extractErrorMessage(error, 'Unable to start SharePoint sign-in. Check backend configuration.');
        this.setBusy(false);
      }
    });
  }

  connect(): void {
    this.errorMessage = '';
    this.successMessage = '';

    const code = this.authCode.trim();
    if (!code) {
      this.errorMessage = 'Authorization code is required.';
      return;
    }

    this.setBusy(true, 'Exchanging authorization code...');
    this.sharePointService.exchangeAuthCode(code).subscribe({
      next: (tokenResponse) => {
        this.sharePointService.storeAuthToken(tokenResponse.accessToken);
        this.authCode = '';
        this.successMessage = 'Connected to SharePoint successfully.';
        this.loadSites();
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage = this.extractErrorMessage(error, 'Authorization failed. Verify the code and try again.');
        this.setBusy(false);
      }
    });
  }

  clearToken(): void {
    this.sharePointService.clearAuthToken();
    this.selectedSiteId = '';
    this.selectedLibraryId = '';
    this.sites = [];
    this.libraries = [];
    this.documents = [];
    this.selectedDocIds.clear();
    this.successMessage = 'Disconnected from SharePoint.';
    this.errorMessage = '';
  }

  loadSites(): void {
    const token = this.sharePointService.getStoredAuthToken();
    if (!token) {
      this.errorMessage = 'Connect to SharePoint first.';
      return;
    }

    this.errorMessage = '';
    this.setBusy(true, 'Loading sites...');
    this.sharePointService.getSites(token).subscribe({
      next: (sites) => {
        this.sites = sites;
        this.libraries = [];
        this.documents = [];
        this.selectedSiteId = '';
        this.selectedLibraryId = '';
        this.selectedDocIds.clear();
        this.setBusy(false);
      },
      error: () => {
        this.errorMessage = 'Could not load SharePoint sites. Reconnect and try again.';
        this.setBusy(false);
      }
    });
  }

  onSiteChange(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.libraries = [];
    this.documents = [];
    this.selectedLibraryId = '';
    this.selectedDocIds.clear();

    const token = this.sharePointService.getStoredAuthToken();
    if (!token || !this.selectedSiteId) {
      return;
    }

    this.setBusy(true, 'Loading libraries...');
    this.sharePointService.getLibraries(this.selectedSiteId, token).subscribe({
      next: (libraries) => {
        this.libraries = libraries;
        this.setBusy(false);
      },
      error: () => {
        this.errorMessage = 'Could not load document libraries for this site.';
        this.setBusy(false);
      }
    });
  }

  onLibraryChange(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.documents = [];
    this.selectedDocIds.clear();

    const token = this.sharePointService.getStoredAuthToken();
    if (!token || !this.selectedSiteId || !this.selectedLibraryId) {
      return;
    }

    this.setBusy(true, 'Loading documents...');
    this.sharePointService.getDocuments(this.selectedSiteId, this.selectedLibraryId, token).subscribe({
      next: (documents) => {
        this.documents = documents.filter(doc => {
          const lower = doc.name.toLowerCase();
          return lower.endsWith('.pdf') || lower.endsWith('.docx') || lower.endsWith('.doc');
        });
        this.selectedDocIds.clear();
        this.setBusy(false);
      },
      error: () => {
        this.errorMessage = 'Could not load documents from this library.';
        this.setBusy(false);
      }
    });
  }

  isSelected(documentId: string): boolean {
    return this.selectedDocIds.has(documentId);
  }

  toggleSelection(documentId: string): void {
    if (this.selectedDocIds.has(documentId)) {
      this.selectedDocIds.delete(documentId);
      return;
    }

    this.selectedDocIds.add(documentId);
  }

  toggleSelectAll(): void {
    if (this.allSelected) {
      this.selectedDocIds.clear();
      return;
    }

    this.selectedDocIds = new Set(this.documents.map(doc => doc.id));
  }

  importSelected(): void {
    const token = this.sharePointService.getStoredAuthToken();
    if (!token || !this.selectedSiteId || !this.selectedLibraryId || this.selectedDocIds.size === 0) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    const ids = Array.from(this.selectedDocIds);
    let completed = 0;
    let failed = 0;

    this.setBusy(true, 'Importing documents...');

    const importNext = (index: number): void => {
      if (index >= ids.length) {
        this.importedAny = completed > 0;
        this.successMessage = `Imported ${completed} document(s).${failed > 0 ? ` Failed: ${failed}.` : ''}`;
        this.setBusy(false);
        if (this.importedAny) {
          window.dispatchEvent(new CustomEvent('ama-rag-trigger-documents-refresh'));
          this.selectedDocIds.clear();
        }
        return;
      }

      this.sharePointService.importDocument(this.selectedSiteId, this.selectedLibraryId, ids[index], token).subscribe({
        next: () => {
          completed++;
          importNext(index + 1);
        },
        error: () => {
          failed++;
          importNext(index + 1);
        }
      });
    };

    importNext(0);
  }

  close(refetch: boolean): void {
    this.dialogRef.close(refetch);
  }

  private setBusy(value: boolean, message: string = ''): void {
    this.isBusy = value;
    this.busyMessage = message;
  }

  private extractErrorMessage(error: HttpErrorResponse, fallback: string): string {
    const payload = error?.error;

    if (typeof payload === 'string' && payload.trim().length > 0) {
      return payload;
    }

    if (payload?.error && typeof payload.error === 'string') {
      return payload.error;
    }

    if (payload?.title && typeof payload.title === 'string') {
      return payload.title;
    }

    return fallback;
  }
}
