import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable, lastValueFrom } from 'rxjs';
import { Document, ChatRequest, ChatResponse, UploadDocumentResponse, DocumentChunk } from '../models/models';
import { environment } from '../../environments/environment';

interface SyncJobResult {
  syncJobId: string;
  status: string;
  message: string;
  startedAt: string;
}

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

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Document endpoints
  uploadDocument(file: File): Observable<UploadDocumentResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadDocumentResponse>(`${this.apiUrl}/documents/upload`, formData);
  }

  uploadDocumentWithProgress(file: File): Observable<HttpEvent<UploadDocumentResponse>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadDocumentResponse>(`${this.apiUrl}/documents/upload`, formData, {
      reportProgress: true,
      observe: 'events'
    });
  }

  getDocuments(): Observable<Document[]> {
    return this.http.get<Document[]>(`${this.apiUrl}/documents`);
  }

  getDocument(documentId: string): Observable<Document> {
    return this.http.get<Document>(`${this.apiUrl}/documents/${documentId}`);
  }

  deleteDocument(documentId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/documents/${documentId}`);
  }

  getDocumentChunks(documentId: string): Observable<DocumentChunk[]> {
    return this.http.get<DocumentChunk[]>(`${this.apiUrl}/documents/${documentId}/chunks`);
  }

  // Chat endpoints
  askQuestion(request: ChatRequest): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.apiUrl}/chat/ask`, request);
  }

  // Sync endpoints
  startSync(folderPath: string): Promise<SyncJobResult> {
    return lastValueFrom(
      this.http.post<SyncJobResult>(`${this.apiUrl}/sync/start/${encodeURIComponent(folderPath)}`, {})
    );
  }

  startDefaultSync(): Promise<SyncJobResult> {
    return lastValueFrom(
      this.http.post<SyncJobResult>(`${this.apiUrl}/sync/start`, {})
    );
  }

  getSyncStatus(jobId: string): Promise<SyncJobStatus> {
    return lastValueFrom(
      this.http.get<SyncJobStatus>(`${this.apiUrl}/sync/status/${jobId}`)
    );
  }

  getSyncHistory(limit: number = 50): Promise<SyncJobHistory[]> {
    return lastValueFrom(
      this.http.get<SyncJobHistory[]>(`${this.apiUrl}/sync/history?limit=${limit}`)
    );
  }

  retryFailedSync(): Promise<any> {
    return lastValueFrom(
      this.http.post(`${this.apiUrl}/sync/retry`, {})
    );
  }
}
