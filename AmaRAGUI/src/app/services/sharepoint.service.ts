import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SharePointSite {
  id: string;
  displayName: string;
  webUrl: string;
}

export interface SharePointLibrary {
  id: string;
  name: string;
  description?: string;
}

export interface SharePointDocument {
  id: string;
  name: string;
  webUrl: string;
  lastModifiedDateTime: string;
  size: number;
  contentType: string;
}

export interface SharePointOAuthResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SharePointService {
  private readonly apiBaseUrl = `${this.resolveApiUrl()}/sharepoint`;

  constructor(private http: HttpClient) {}

  private resolveApiUrl(): string {
    const host = window.location.hostname.toLowerCase();
    const localHosts = new Set(['localhost', '127.0.0.1']);

    if (localHosts.has(host)) {
      return 'http://localhost:5000/api/v1';
    }

    return 'https://www.docuSense.com/api/v1';
  }

  /**
   * Initiate OAuth flow with SharePoint
   */
  getOAuthUrl(): Observable<string> {
    return this.http.get<string>(`${this.apiBaseUrl}/auth/oauth-url`);
  }

  /**
   * Exchange auth code for access token
   */
  exchangeAuthCode(code: string): Observable<SharePointOAuthResponse> {
    return this.http.post<SharePointOAuthResponse>(`${this.apiBaseUrl}/auth/token`, { code });
  }

  /**
   * Get list of SharePoint sites accessible to user
   */
  getSites(accessToken: string): Observable<SharePointSite[]> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${accessToken}`
    });
    return this.http.get<SharePointSite[]>(`${this.apiBaseUrl}/sites`, { headers });
  }

  /**
   * Get document libraries in a SharePoint site
   */
  getLibraries(siteId: string, accessToken: string): Observable<SharePointLibrary[]> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${accessToken}`
    });
    return this.http.get<SharePointLibrary[]>(`${this.apiBaseUrl}/sites/${siteId}/libraries`, { headers });
  }

  /**
   * Get documents in a SharePoint library
   */
  getDocuments(siteId: string, libraryId: string, accessToken: string): Observable<SharePointDocument[]> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${accessToken}`
    });
    return this.http.get<SharePointDocument[]>(
      `${this.apiBaseUrl}/sites/${siteId}/libraries/${libraryId}/documents`,
      { headers }
    );
  }

  /**
   * Download and import a document from SharePoint
   */
  importDocument(siteId: string, libraryId: string, documentId: string, accessToken: string): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${accessToken}`
    });
    return this.http.post(
      `${this.apiBaseUrl}/sites/${siteId}/libraries/${libraryId}/documents/${documentId}/import`,
      null,
      { headers }
    );
  }

  /**
   * Store OAuth token locally (encrypted in production)
   */
  storeAuthToken(token: string): void {
    localStorage.setItem('sharepoint-auth-token', token);
  }

  /**
   * Retrieve stored OAuth token
   */
  getStoredAuthToken(): string | null {
    return localStorage.getItem('sharepoint-auth-token');
  }

  /**
   * Clear stored OAuth token
   */
  clearAuthToken(): void {
    localStorage.removeItem('sharepoint-auth-token');
  }

  /**
   * Check if user has valid SharePoint authentication
   */
  isAuthenticated(): boolean {
    return !!this.getStoredAuthToken();
  }
}
