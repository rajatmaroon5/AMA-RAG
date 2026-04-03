import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ChatComponent } from './components/chat/chat.component';
import { DocumentListComponent } from './components/document-list/document-list.component';
import { SharePointConnectDialogComponent } from './components/sharepoint-connect/sharepoint-connect-dialog.component';

interface TourStep {
  title: string;
  description: string;
  targetId: string;
  view: 'chat' | 'documents';
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatDialogModule,
    MatIconModule,
    MatSnackBarModule,
    ChatComponent,
    DocumentListComponent
  ],
  template: `
    <div
      class="app-shell"
      [class.theme-dark]="isDarkTheme"
      [class.sidebar-collapsed]="sidebarCollapsed"
      [style.--app-accent]="accentColor"
      [style.--tour-pulse-color]="tourPulseColor"
      [style.--tour-pulse-rgb]="tourPulseRgb">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <button 
            class="hamburger-btn" 
            (click)="toggleSidebar()" 
            [attr.aria-label]="sidebarCollapsed ? 'Expand menu' : 'Collapse menu'" 
            type="button"
            title="Toggle menu">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <div class="brand" *ngIf="!sidebarCollapsed">
            <h1>
              <img src="assets/chatbot.gif" alt="DocuSense logo" class="brand-logo">
              <span>DocuSense</span>
            </h1>
            <p>RAG powered chatbot</p>
          </div>
        </div>

        <nav class="menu" aria-label="Main navigation">
          <button
            id="tour-nav-ask"
            type="button"
            mat-stroked-button
            class="menu-item"
            [class.active]="activeView === 'chat'"
            (click)="setActiveView('chat')"
            [title]="'Ask'">
            <img src="assets/ask-for-help.png" alt="Ask" class="menu-icon">
            <span *ngIf="!sidebarCollapsed">Ask</span>
          </button>

          <button
            id="tour-nav-knowledge-bank"
            type="button"
            mat-stroked-button
            class="menu-item"
            [class.active]="activeView === 'documents'"
            (click)="setActiveView('documents')"
            [title]="'Knowledge Bank'">
            <img src="assets/brain.png" alt="Knowledge Bank" class="menu-icon">
            <span *ngIf="!sidebarCollapsed">Knowledge Bank</span>
          </button>

          <button
            type="button"
            mat-stroked-button
            class="menu-item"
            [class.active]="activeView === 'documentation'"
            (click)="setActiveView('documentation')"
            [title]="'Documentation'">
            <img src="assets/document.png" alt="Documentation" class="menu-icon">
            <span *ngIf="!sidebarCollapsed">Documentation</span>
          </button>

          <button
            type="button"
            mat-stroked-button
            class="menu-item coming-soon"
            disabled
            [title]="'SharePoint (Coming soon)'">
            <mat-icon class="menu-icon-material">cloud</mat-icon>
            <span *ngIf="!sidebarCollapsed">SharePoint</span>
            <span *ngIf="!sidebarCollapsed" class="menu-tag">Coming soon</span>
          </button>
        </nav>

        <div class="sidebar-tools">
          <div class="theme-toggle-wrapper">
            <svg class="theme-icon-label" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <mat-slide-toggle
              [(ngModel)]="isDarkTheme"
              class="theme-slide-toggle"
              [attr.aria-label]="'Toggle ' + (isDarkTheme ? 'light' : 'dark') + ' theme'">
            </mat-slide-toggle>
            <svg class="theme-icon-label" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </div>

          <div class="weather-widget" *ngIf="!sidebarCollapsed">
            <span *ngIf="weatherLoading" class="weather-loading">Loading weather…</span>
            <ng-container *ngIf="!weatherLoading && mumbaiWeather">
              <span class="weather-temp">{{ mumbaiWeather.temp }}°C</span>
              <span class="weather-desc">{{ mumbaiWeather.desc }}</span>
              <span class="weather-meta">💧{{ mumbaiWeather.humidity }}% · 💨{{ mumbaiWeather.wind }} km/h</span>
              <span class="weather-loc">📍 Mumbai</span>
            </ng-container>
            <span *ngIf="!weatherLoading && weatherError" class="weather-error">⚠ Weather unavailable</span>
          </div>

          <div class="accent-picker" *ngIf="!sidebarCollapsed" aria-label="Accent color selector">
            <span class="accent-picker-label">Accent</span>
            <div class="accent-swatch-list">
              <button
                type="button"
                class="accent-swatch"
                *ngFor="let option of accentOptions"
                [class.active]="accentColor === option.value"
                [style.background]="option.value"
                [attr.aria-label]="'Set accent to ' + option.label"
                [title]="option.label"
                (click)="setAccentColor(option.value)">
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main class="content" [class.documents-content]="activeView === 'documents'">
        <section id="tour-chat-view" class="view-container" [hidden]="activeView !== 'chat'">
          <app-chat></app-chat>
        </section>

        <section id="tour-documents-view" class="view-container" *ngIf="activeView === 'documents'">
          <div class="documents-shell">
            <section class="documents-pane list-pane">
              <div class="documents-pane-header">
                <h2 class="documents-pane-title">Knowledge Bank</h2>
                <div class="documents-pane-actions" aria-label="Knowledge Bank actions">
                  <button
                    id="tour-upload-action"
                    type="button"
                    class="documents-pane-action-btn"
                    (click)="triggerKnowledgeBankUpload()"
                    title="Upload files"
                    aria-label="Upload files">
                    <img src="assets/upload.png" alt="Upload" class="documents-pane-action-icon">
                  </button>
                  <button
                    type="button"
                    class="documents-pane-action-btn"
                    (click)="triggerKnowledgeBankRefresh()"
                    title="Refresh documents"
                    aria-label="Refresh documents">
                    <img src="assets/refresh.png" alt="Refresh" class="documents-pane-action-icon">
                  </button>
                </div>
              </div>
              <app-document-list></app-document-list>
            </section>
          </div>
        </section>

        <section class="view-container documentation-view" *ngIf="activeView === 'documentation'">
          <div class="docs-shell">
            <header class="docs-header">
              <h2>DocuSense Technical Documentation</h2>
              <p>End-to-end implementation details for APIs, contracts, services, RAG stages, and fallback strategies.</p>
            </header>

            <section class="docs-section docs-flow-section">
              <h3>0) End-to-End Flowchart</h3>
              <div class="flowchart-wrap" aria-label="DocuSense end-to-end technical flow">
                <div class="flow-node">UI<br><span>Angular Chat + Upload</span></div>
                <div class="flow-arrow">--&gt;</div>
                <div class="flow-node">API Layer<br><span>Minimal APIs /api/v1</span></div>
                <div class="flow-arrow">--&gt;</div>
                <div class="flow-node">Ingestion Path<br><span>Extract - Chunk - Embed - Index</span></div>
                <div class="flow-arrow">--&gt;</div>
                <div class="flow-node">Retrieval Path<br><span>Vector Search + Context Build</span></div>
                <div class="flow-arrow">--&gt;</div>
                <div class="flow-node">Generation + Grading<br><span>LLM Answer + Self-Eval + Retry/Fallback</span></div>
                <div class="flow-arrow">--&gt;</div>
                <div class="flow-node">Response<br><span>Answer + Citations + Logs</span></div>
              </div>
            </section>

            <section class="docs-section">
              <h3>1) API Surface and Contracts</h3>
              <div class="docs-table-wrap">
                <table class="docs-table">
                  <thead>
                    <tr>
                      <th>Method</th>
                      <th>Route</th>
                      <th>Request Contract</th>
                      <th>Response Contract</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>POST</td>
                      <td>/api/v1/documents/upload</td>
                      <td>multipart/form-data with field file (PDF/DOCX/DOC/TXT/XLSX)</td>
                      <td>UploadDocumentResponse: documentId, name, chunkCount, isProcessed, keyTopics</td>
                    </tr>
                    <tr>
                      <td>GET</td>
                      <td>/api/v1/documents</td>
                      <td>None</td>
                      <td>List&lt;DocumentListResponse&gt;: id, name, uploadedAt, isProcessed, chunkCount, errorMessage</td>
                    </tr>
                    <tr>
                      <td>GET</td>
                      <td>/api/v1/documents/&#123;documentId&#125;</td>
                      <td>Path: documentId (Guid)</td>
                      <td>DocumentListResponse</td>
                    </tr>
                    <tr>
                      <td>DELETE</td>
                      <td>/api/v1/documents/&#123;documentId&#125;</td>
                      <td>Path: documentId (Guid)</td>
                      <td>Status + message</td>
                    </tr>
                    <tr>
                      <td>GET</td>
                      <td>/api/v1/documents/&#123;documentId&#125;/chunks</td>
                      <td>Path: documentId (Guid)</td>
                      <td>List&lt;DocumentChunk&gt;: id, documentId, content, chunkIndex, vectorId, createdAt</td>
                    </tr>
                    <tr>
                      <td>GET</td>
                      <td>/api/v1/documents/&#123;documentId&#125;/preview</td>
                      <td>Path: documentId (Guid)</td>
                      <td>Binary file stream (range-enabled)</td>
                    </tr>
                    <tr>
                      <td>POST</td>
                      <td>/api/v1/chat/ask</td>
                      <td>ChatRequest: question, temperature, similarityThreshold, maxContextChunks, documentId(optional)</td>
                      <td>ChatResponse: answer, model, tokensUsed, retrievedChunks, queryTransformation, answerGrade, logs, llmPrompt, webSource, retryCount</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section class="docs-section">
              <h3>2) Backend Services</h3>
              <ul>
                <li>DocumentService: upload persistence, text extraction, chunk creation, embedding generation, vector upsert, metadata lifecycle.</li>
                <li>EmbeddingService: provider abstraction for OpenAI embeddings and HuggingFace embeddings.</li>
                <li>ChunkingService: custom word-based chunker with overlap window.</li>
                <li>ChatService: orchestration of query transformation, retrieval, prompt building, generation, grading, retries, and fallback.</li>
                <li>QueryTransformationService: expanded query generation + decomposition of compound questions.</li>
                <li>AnswerGradingService: LLM-driven self-evaluation for grounding/relevancy quality gate.</li>
                <li>LocalVectorStoreService (current runtime binding): in-memory vector index + cosine similarity search.</li>
                <li>WebSearchService: optional external retrieval augmentation path.</li>
              </ul>
            </section>

            <section class="docs-section">
              <h3>3) External Providers and Dependencies</h3>
              <ul>
                <li>Embedding generation (current): HuggingFace endpoint configured under HuggingFace:Endpoint with model sentence-transformers/all-MiniLM-L6-v2.</li>
                <li>LLM text generation (current): HuggingFace chat endpoint configured under HuggingFace:ChatEndpoint using model from HuggingFace:GenerationModel.</li>
                <li>Alternative embedding provider: OpenAI embeddings model text-embedding-3-small.</li>
                <li>Document extraction libraries: iTextSharp (PDF), OpenXml (DOCX/DOC).</li>
                <li>Vector layer abstraction: IPineconeService; currently wired to LocalVectorStoreService in Program.cs for local runtime.</li>
              </ul>
            </section>

            <section class="docs-section">
              <h3>4) RAG Pipeline</h3>
              <ol>
                <li>Ingest document and extract normalized text.</li>
                <li>Chunk text into context windows (chunk size + overlap).</li>
                <li>Create embedding vectors per chunk.</li>
                <li>Store vectors and metadata in vector retrieval layer.</li>
                <li>For user query, perform transformation (expansion/decomposition).</li>
                <li>Embed query and retrieve top-K relevant chunks by cosine similarity threshold.</li>
                <li>Construct system + user prompt with retrieved context.</li>
                <li>Generate answer via LLM endpoint.</li>
                <li>Grade answer relevancy/grounding.</li>
                <li>Return response with citations, logs, grading, and model metadata.</li>
              </ol>
            </section>

            <section class="docs-section">
              <h3>5) Document Upload Lifecycle</h3>
              <ol>
                <li>Client submits file to /documents/upload.</li>
                <li>Backend validates file, stores original asset in uploads directory.</li>
                <li>Text extraction executed per mime/extension handler.</li>
                <li>ChunkingService splits text into overlapping chunks.</li>
                <li>EmbeddingService generates vector for each chunk.</li>
                <li>Vectors are upserted via IPineconeService implementation.</li>
                <li>Document metadata and chunk metadata are updated and exposed via list/chunks endpoints.</li>
              </ol>
            </section>

            <section class="docs-section">
              <h3>6) Query-to-Answer Lifecycle</h3>
              <ol>
                <li>Client sends ChatRequest (question + retrieval settings).</li>
                <li>Conversational short-circuit check runs for greeting/small-talk.</li>
                <li>QueryTransformationService expands/decomposes question.</li>
                <li>EmbeddingService embeds each query attempt.</li>
                <li>Vector search retrieves chunks filtered by threshold and topK.</li>
                <li>Prompt assembled with context + question; LLM call executed.</li>
                <li>AnswerGradingService scores output relevancy and groundedness.</li>
                <li>If low grade/no retrieval, retry loop relaxes similarity threshold and increases chunk count.</li>
                <li>If generation unavailable/unconfigured, extractive fallback answer is returned from top chunk.</li>
                <li>Response includes citations, debug logs, prompt trace metadata, and retry count.</li>
              </ol>
            </section>

            <section class="docs-section">
              <h3>7) Techniques and Safeguards</h3>
              <ul>
                <li>Query transformation: expanded variants + decomposed sub-questions.</li>
                <li>Self-grading: LLM evaluates answer relevance against retrieved context.</li>
                <li>Retry strategy: adaptive retrieval with relaxed threshold and enlarged context window.</li>
                <li>Fallback worksheet path: extractive response synthesis when generation is unavailable.</li>
                <li>Citation handling: source aggregation and appended citation list.</li>
                <li>Observability: RAG logs include transformation, retrieval ranking, prompt trace, and raw LLM output summary.</li>
              </ul>
            </section>
          </div>
        </section>
      </main>

      <div class="tour-backdrop" *ngIf="showTour">
        <div class="tour-card" [ngStyle]="tourCardStyle">
          <h2>Welcome to DocuSense</h2>
          <p class="tour-step">Step {{ tourStep + 1 }} of {{ tourSteps.length }}</p>
          <h3>{{ tourSteps[tourStep].title }}</h3>
          <p>{{ tourSteps[tourStep].description }}</p>
          <div class="tour-actions">
            <button mat-button class="tour-text-btn" (click)="skipTour()">Skip tour</button>
            <button mat-button class="tour-text-btn" (click)="prevTour()" [disabled]="tourStep === 0">Back</button>
            <button mat-raised-button color="primary" (click)="nextTour()">
              {{ tourStep === tourSteps.length - 1 ? 'Ask question' : 'Next' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
    }

    .app-shell {
      --page-bg: linear-gradient(135deg, #050505 0%, #0b0b0b 52%, #111111 100%);
      --sidebar-bg: #030303;
      --sidebar-text: #f3f4f6;
      --sidebar-border: rgba(255, 255, 255, 0.1);
      --brand-heading: #ffffff;
      --menu-border: rgba(255, 255, 255, 0.24);
      --menu-bg: rgba(255, 255, 255, 0.04);
      --menu-text: #f3f4f6;
      --menu-active-bg: var(--app-accent, #111111);
      --menu-active-text: #ffffff;
      --menu-active-shadow: rgba(0, 0, 0, 0.35);
      --content-overlay: radial-gradient(circle at 85% 10%, rgba(0, 0, 0, 0.08), transparent 38%);
      --theme-toggle-bg: rgba(255, 255, 255, 0.08);
      --theme-toggle-text: #f3f4f6;
      --theme-toggle-border: rgba(255, 255, 255, 0.35);

      min-height: 100vh;
      display: grid;
      grid-template-columns: 240px 1fr;
      background: var(--page-bg);
      transition: grid-template-columns 240ms ease, background 240ms ease;
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    }

    .app-shell.sidebar-collapsed {
      grid-template-columns: 70px 1fr;
    }

    .app-shell.theme-dark {
      --page-bg: linear-gradient(135deg, #000000 0%, #050505 52%, #0b0b0b 100%);
      --sidebar-bg: #000000;
      --sidebar-text: #f9fafb;
      --sidebar-border: rgba(255, 255, 255, 0.12);
      --brand-heading: #ffffff;
      --menu-border: rgba(255, 255, 255, 0.28);
      --menu-bg: rgba(255, 255, 255, 0.03);
      --menu-text: #f3f4f6;
      --menu-active-bg: var(--app-accent, #111111);
      --menu-active-text: #ffffff;
      --menu-active-shadow: rgba(0, 0, 0, 0.35);
      --content-overlay: radial-gradient(circle at 80% 8%, rgba(0, 0, 0, 0.11), transparent 42%);
      --theme-toggle-bg: rgba(255, 255, 255, 0.06);
      --theme-toggle-text: #f9fafb;
      --theme-toggle-border: rgba(255, 255, 255, 0.4);
    }

    /* Hamburger Button */
    .hamburger-btn {
      width: 44px;
      height: 44px;
      background: transparent;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
      transition: background 150ms;
      flex-shrink: 0;
    }

    .hamburger-btn:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .hamburger-btn svg {
      width: 24px;
      height: 24px;
      stroke: var(--sidebar-text);
    }

    /* Sidebar Overlay */
    .sidebar-overlay {
      position: fixed;
      inset: 0;
      background: rgba(2, 8, 23, 0.5);
      z-index: 90;
      animation: fadeIn 200ms ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* Sidebar */
    .sidebar {
      background: var(--sidebar-bg);
      color: var(--sidebar-text);
      padding: 12px;
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--sidebar-border);
      transition: background 240ms ease, color 240ms ease, padding 240ms ease;
      overflow: hidden;
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      min-height: 44px;
    }

    .brand {
      flex: 1;
      padding: 0 8px;
      overflow: hidden;
    }

    .brand h1 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--brand-heading);
      font-size: 1.1rem;
      letter-spacing: 0.04em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .brand-logo {
      width: 20px;
      height: 20px;
      object-fit: contain;
      flex-shrink: 0;
    }

    .brand p {
      margin: 2px 0 0;
      font-size: 0.75rem;
      opacity: 0.85;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .weather-widget {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 0 10px;
      border-top: 1px solid rgba(128,128,128,0.2);
      margin-bottom: 4px;
    }

    .weather-temp {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--brand-heading);
    }

    .weather-desc {
      font-size: 0.72rem;
      opacity: 0.9;
      text-transform: capitalize;
    }

    .weather-meta, .weather-loc {
      font-size: 0.68rem;
      opacity: 0.7;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .weather-loading {
      font-size: 0.68rem;
      opacity: 0.6;
    }

    .weather-error {
      font-size: 0.68rem;
      opacity: 0.6;
      color: #ef4444;
    }

    .app-shell.sidebar-collapsed .brand {
      display: none;
    }

    .menu {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
    }

    .menu-item {
      width: 100%;
      justify-content: flex-start;
      display: inline-flex;
      align-items: center;
      gap: 12px;
      height: 44px;
      border-color: var(--menu-border);
      color: var(--menu-text);
      background: var(--menu-bg);
      text-align: left;
      padding: 0 10px;
      transition: all 180ms ease;
      border-radius: 8px;
      border: 1px solid transparent;
      cursor: pointer;
    }

    .menu-item:hover {
      background: rgba(255, 255, 255, 0.06);
      border-color: var(--menu-border);
    }

    .menu-item.coming-soon,
    .menu-item.coming-soon:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      pointer-events: none;
    }

    .menu-item span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--menu-text);
    }

    .menu-tag {
      margin-left: auto;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--app-accent, #111111);
      border: 1px solid var(--app-accent, #111111);
      color: #ffffff;
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.01em;
      flex-shrink: 0;
    }

    .app-shell.sidebar-collapsed .menu-item {
      justify-content: center;
      padding: 0;
    }

    .menu-icon {

          .menu-icon-material {
            width: 24px;
            height: 24px;
            font-size: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
      width: 24px;
      height: 24px;
      flex-shrink: 0;
      object-fit: contain;
    }

    .menu-item.active {
      background: var(--menu-active-bg);
      color: var(--menu-active-text);
      border-color: var(--menu-active-bg);
      box-shadow: 0 4px 12px var(--menu-active-shadow);
    }

    .menu-item.active .menu-icon {
      filter: brightness(1.3);
    }

    .sidebar-tools {
      margin-top: auto;
      padding-top: 12px;
      border-top: 1px solid var(--sidebar-border);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .accent-picker {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 6px 4px 2px;
    }

    .accent-picker-label {
      font-size: 0.72rem;
      color: var(--sidebar-text);
      opacity: 0.85;
      letter-spacing: 0.02em;
    }

    .accent-swatch-list {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 6px;
    }

    .accent-swatch {
      width: 100%;
      height: 18px;
      border: 1px solid rgba(255, 255, 255, 0.22);
      border-radius: 999px;
      cursor: pointer;
      padding: 0;
      transition: transform 120ms ease, box-shadow 120ms ease;
    }

    .accent-swatch:hover {
      transform: translateY(-1px);
    }

    .accent-swatch.active {
      box-shadow: 0 0 0 2px #ffffff;
    }

    .theme-toggle-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 4px;
      justify-content: center;
    }

    .app-shell.sidebar-collapsed .theme-toggle-wrapper {
      flex-direction: column;
      gap: 4px;
    }

    .theme-icon-label {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
      stroke: var(--sidebar-text);
      fill: none;
    }

    ::ng-deep .theme-slide-toggle {
      transform: scale(0.8);
      transform-origin: left center;
    }

    ::ng-deep .theme-slide-toggle .mdc-switch {
      height: auto;
    }

    ::ng-deep .theme-slide-toggle.mdc-switch--checked .mdc-switch__track {
      background-color: var(--app-accent, #111111);
    }

    ::ng-deep .theme-slide-toggle.mdc-switch--checked .mdc-switch__handle::after {
      background-color: var(--app-accent, #111111);
    }

    .app-shell.sidebar-collapsed .theme-toggle-wrapper::before {
      content: '';
      width: 24px;
      height: 24px;
      background:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>');
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      opacity: 0.7;
    }

    .theme-toggle {
      width: 100%;
      display: inline-flex;
      justify-content: flex-start;
      align-items: center;
      gap: 12px;
      height: 44px;
      border-color: var(--theme-toggle-border);
      color: var(--theme-toggle-text);
      background: var(--theme-toggle-bg);
      padding: 0 10px;
      transition: all 180ms ease;
      border-radius: 8px;
      border: 1px solid transparent;
      cursor: pointer;
    }

    .theme-toggle:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: var(--theme-toggle-border);
    }

    .app-shell.sidebar-collapsed .theme-toggle {
      justify-content: center;
      padding: 0;
    }

    .theme-toggle span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 0.95rem;
      font-weight: 500;
    }

    .theme-icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      stroke: currentColor;
      fill: none;
    }

    .tour-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(2, 8, 23, 0.55);
      z-index: 2147483000;
      pointer-events: auto;
    }

    .tour-card {
      position: fixed;
      width: min(380px, calc(100vw - 24px));
      background: #ffffff;
      border-radius: 16px;
      padding: 20px;
      border: 1px solid #e5e7eb;
      box-shadow: 0 24px 50px rgba(2, 6, 23, 0.25);
      z-index: 2147483002;
    }

    :host ::ng-deep .tour-highlight {
      position: relative !important;
      z-index: 2147483001 !important;
      pointer-events: none;
      border-radius: 10px;
      box-shadow: 0 0 0 3px var(--tour-pulse-color, #38bdf8), 0 0 0 8px rgba(var(--tour-pulse-rgb, 56, 189, 248), 0.22);
      transition: box-shadow 180ms ease;
      animation: tourPulse 1400ms ease-in-out infinite;
    }

    @keyframes tourPulse {
      0% {
        box-shadow: 0 0 0 3px var(--tour-pulse-color, #38bdf8), 0 0 0 8px rgba(var(--tour-pulse-rgb, 56, 189, 248), 0.18);
      }
      50% {
        box-shadow: 0 0 0 3px var(--tour-pulse-color, #38bdf8), 0 0 0 14px rgba(var(--tour-pulse-rgb, 56, 189, 248), 0.34);
      }
      100% {
        box-shadow: 0 0 0 3px var(--tour-pulse-color, #38bdf8), 0 0 0 8px rgba(var(--tour-pulse-rgb, 56, 189, 248), 0.18);
      }
    }

    .tour-card h2 {
      margin: 0;
      color: #111827;
      font-size: 1.2rem;
    }

    .tour-step {
      margin: 8px 0 4px;
      color: #64748b;
      font-size: 0.85rem;
    }

    .tour-card h3 {
      margin: 0 0 6px;
      color: #0f172a;
      font-size: 1.05rem;
    }

    .tour-card p {
      margin: 0;
      color: #334155;
      line-height: 1.5;
    }

    .tour-actions {
      margin-top: 18px;
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      flex-wrap: wrap;
    }

    .app-shell.theme-dark .tour-card {
      background: #0f172a;
      border-color: #334155;
    }

    .app-shell.theme-dark .tour-card h2 { color: #93c5fd; }
    .app-shell.theme-dark .tour-card h3 { color: #e2e8f0; }
    .app-shell.theme-dark .tour-card p,
    .app-shell.theme-dark .tour-step { color: #cbd5e1; }
    .app-shell.theme-dark .tour-actions .tour-text-btn {
      color: #ffffff !important;
    }
    .app-shell.theme-dark .tour-actions .tour-text-btn[disabled] {
      color: rgba(255, 255, 255, 0.45) !important;
    }

    .content {
      min-width: 0;
      min-height: 100vh;
      padding: 18px 22px;
      overflow: auto;
      position: relative;
      animation: reveal 260ms ease;
    }

    .content.documents-content {
      overflow: hidden;
    }

    .content::before {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: var(--content-overlay);
    }

    .view-container {
      min-height: calc(100vh - 36px);
      position: relative;
      z-index: 1;
    }

    .documentation-view {
      padding: 0;
    }

    .docs-shell {
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 14px;
      background: rgba(0, 0, 0, 0.58);
      backdrop-filter: blur(2px);
      padding: 18px;
      color: #e5e7eb;
    }

    .docs-header h2 {
      margin: 0;
      font-size: 1.2rem;
      color: #f8fafc;
    }

    .docs-header p {
      margin: 6px 0 0;
      color: #cbd5e1;
      font-size: 0.92rem;
    }

    .docs-section {
      margin-top: 18px;
      padding-top: 14px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .docs-flow-section {
      margin-top: 14px;
    }

    .flowchart-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      overflow-x: auto;
      padding: 10px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 10px;
      background: rgba(2, 6, 23, 0.45);
    }

    .flow-node {
      min-width: 170px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 10px;
      padding: 10px;
      background: rgba(0, 0, 0, 0.45);
      color: #f8fafc;
      font-size: 0.84rem;
      font-weight: 600;
      line-height: 1.35;
      text-align: left;
    }

    .flow-node span {
      display: block;
      margin-top: 4px;
      color: #cbd5e1;
      font-size: 0.76rem;
      font-weight: 500;
    }

    .flow-arrow {
      color: var(--app-accent, #111111);
      font-size: 0.92rem;
      font-weight: 700;
      flex-shrink: 0;
    }

    .docs-section h3 {
      margin: 0 0 10px;
      color: #f8fafc;
      font-size: 1rem;
    }

    .docs-section ul,
    .docs-section ol {
      margin: 0;
      padding-left: 18px;
      color: #d1d5db;
      line-height: 1.55;
      font-size: 0.92rem;
    }

    .docs-section li {
      margin-bottom: 6px;
    }

    .docs-table-wrap {
      overflow-x: auto;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.35);
    }

    .docs-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 980px;
      font-size: 0.88rem;
    }

    .docs-table th,
    .docs-table td {
      text-align: left;
      vertical-align: top;
      padding: 10px 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      color: #e5e7eb;
    }

    .docs-table th {
      background: rgba(0, 0, 0, 0.58);
      color: #f8fafc;
      position: sticky;
      top: 0;
      z-index: 1;
    }

    .documents-shell {
      display: grid;
      gap: 18px;
      height: 100%;
    }

    .documents-pane {
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 14px;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(2px);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    #tour-documents-view {
      height: calc(100vh - 36px);
      min-height: 0;
    }

    .documents-pane app-document-list {
      display: block;
      flex: 1;
      min-height: 0;
    }

    .documents-pane-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    }

    .documents-pane-title {
      margin: 0;
      font-size: 1rem;
      color: #e5e7eb;
    }

    .documents-pane-actions {
      display: inline-flex;
      align-items: center;
      gap: 12px;
    }

    .documents-pane-action-btn {
      border: none;
      background: transparent;
      padding: 0;
      width: auto;
      height: auto;
      min-width: 0;
      min-height: 0;
      line-height: 0;
      border-radius: 0;
      cursor: pointer;
      transition: transform 120ms ease, opacity 120ms ease;
    }

    .documents-pane-action-btn:hover {
      transform: scale(1.06);
      opacity: 0.9;
    }

    .documents-pane-action-icon {
      width: 26px;
      height: 26px;
      object-fit: contain;
      display: block;
    }

    @keyframes reveal {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `]
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  activeView: 'chat' | 'documents' | 'documentation' = 'chat';
  isDarkTheme = true;
  accentColor = '#111111';
  tourPulseColor = '#38bdf8';
  tourPulseRgb = '56, 189, 248';
  readonly accentOptions = [
    { label: 'Black', value: '#111111' },
    { label: 'Blue', value: '#2563eb' },
    { label: 'Green', value: '#16a34a' },
    { label: 'Red', value: '#dc2626' },
    { label: 'Orange', value: '#ea580c' },
    { label: 'Purple', value: '#7c3aed' },
    { label: 'Teal', value: '#0f766e' }
  ];
  sidebarCollapsed = false;
  showTour = true;
  mumbaiWeather: { temp: string; desc: string; humidity: string; wind: string } | null = null;
  weatherLoading = false;
  weatherError = false;
  tourStep = 0;
  tourCardStyle: Record<string, string> = { top: '16px', left: '16px' };
  private highlightedElement: HTMLElement | null = null;
  private readonly resizeHandler = () => this.positionTourForCurrentStep();

  tourSteps: TourStep[] = [
    {
      title: 'Open Knowledge Bank',
      description: 'Start here. Use this menu option to open your Knowledge Bank.',
      targetId: 'tour-nav-knowledge-bank',
      view: 'documents'
    },
    {
      title: 'Upload Documents',
      description: 'Click the upload option to add PDF, DOCX, or XLSX files for indexing.',
      targetId: 'tour-upload-action',
      view: 'documents'
    },
    {
      title: 'Open Ask',
      description: 'Use this menu option to switch to Ask.',
      targetId: 'tour-nav-ask',
      view: 'chat'
    },
    {
      title: 'Chat Window',
      description: 'Type your question here and review the response with citations.',
      targetId: 'tour-chat-input',
      view: 'chat'
    }
  ];

  constructor(
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    const savedAccent = localStorage.getItem('ama-rag-accent-color');
    if (savedAccent) {
      this.accentColor = savedAccent;
    }
    this.updateTourPulseFromAccent();
  }

  ngOnInit(): void {
    this.fetchMumbaiWeather();
  }

  private fetchMumbaiWeather(): void {
    this.weatherLoading = true;
    this.weatherError = false;
    fetch('https://wttr.in/Mumbai?format=j1', {
      headers: { 'Accept': 'application/json', 'User-Agent': 'ama-rag-ui/1.0' }
    })
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then((data: any) => {
        const c = data?.current_condition?.[0];
        if (c) {
          this.mumbaiWeather = {
            temp: c.temp_C ?? '--',
            desc: c.weatherDesc?.[0]?.value ?? 'Unknown',
            humidity: c.humidity ?? '--',
            wind: c.windspeedKmph ?? '--'
          };
        } else {
          this.weatherError = true;
        }
      })
      .catch(() => { this.weatherError = true; })
      .finally(() => { this.weatherLoading = false; });
  }

  ngAfterViewInit(): void {
    if (this.showTour) {
      this.activateTourStep();
    }
    window.addEventListener('resize', this.resizeHandler);
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.resizeHandler);
    this.clearHighlight();
  }

  setActiveView(view: 'chat' | 'documents' | 'documentation'): void {
    this.activeView = view;
  }

  toggleTheme(): void {
    this.isDarkTheme = !this.isDarkTheme;
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  nextTour(): void {
    if (this.tourStep < this.tourSteps.length - 1) {
      this.tourStep++;
      this.activateTourStep();
      return;
    }

    this.skipTour();
  }

  prevTour(): void {
    this.tourStep = Math.max(0, this.tourStep - 1);
    this.activateTourStep();
  }

  skipTour(): void {
    this.showTour = false;
    this.clearHighlight();
    this.activeView = 'chat';
  }

  triggerKnowledgeBankUpload(): void {
    window.dispatchEvent(new CustomEvent('ama-rag-trigger-upload-browse'));
  }

  triggerKnowledgeBankRefresh(): void {
    window.dispatchEvent(new CustomEvent('ama-rag-trigger-documents-refresh'));
  }

  openSharePointDialog(): void {
    const dialogRef = this.dialog.open(SharePointConnectDialogComponent, {
      width: '760px',
      maxWidth: '95vw',
      panelClass: 'sharepoint-dialog-panel'
    });

    dialogRef.afterClosed().subscribe((refetch: boolean) => {
      if (refetch) {
        this.activeView = 'documents';
        this.triggerKnowledgeBankRefresh();
      }
    });
  }

  setAccentColor(color: string): void {
    this.accentColor = color;
    this.updateTourPulseFromAccent();
    localStorage.setItem('ama-rag-accent-color', color);
  }

  private updateTourPulseFromAccent(): void {
    const rgb = this.hexToRgb(this.accentColor);
    if (!rgb) {
      this.tourPulseColor = '#38bdf8';
      this.tourPulseRgb = '56, 189, 248';
      return;
    }

    const [h, s] = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
    const complementaryHue = (h + 180) % 360;
    const tunedSaturation = Math.max(65, s);
    const tunedLightness = 58;
    const compRgb = this.hslToRgb(complementaryHue, tunedSaturation, tunedLightness);

    this.tourPulseColor = this.rgbToHex(compRgb.r, compRgb.g, compRgb.b);
    this.tourPulseRgb = `${compRgb.r}, ${compRgb.g}, ${compRgb.b}`;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const normalized = hex.replace('#', '').trim();
    const value = normalized.length === 3
      ? normalized.split('').map(char => char + char).join('')
      : normalized;

    if (!/^[0-9a-fA-F]{6}$/.test(value)) {
      return null;
    }

    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16)
    };
  }

  private rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const delta = max - min;
    let hue = 0;

    if (delta !== 0) {
      if (max === rn) {
        hue = ((gn - bn) / delta) % 6;
      } else if (max === gn) {
        hue = (bn - rn) / delta + 2;
      } else {
        hue = (rn - gn) / delta + 4;
      }
    }

    hue = Math.round(hue * 60);
    if (hue < 0) {
      hue += 360;
    }

    const lightness = (max + min) / 2;
    const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

    return [hue, Math.round(saturation * 100), Math.round(lightness * 100)];
  }

  private hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    const hue = h / 360;
    const sat = s / 100;
    const light = l / 100;
    const hueToRgb = (p: number, q: number, t: number): number => {
      let tn = t;
      if (tn < 0) {
        tn += 1;
      }
      if (tn > 1) {
        tn -= 1;
      }
      if (tn < 1 / 6) {
        return p + (q - p) * 6 * tn;
      }
      if (tn < 1 / 2) {
        return q;
      }
      if (tn < 2 / 3) {
        return p + (q - p) * (2 / 3 - tn) * 6;
      }
      return p;
    };

    if (sat === 0) {
      const gray = Math.round(light * 255);
      return { r: gray, g: gray, b: gray };
    }

    const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
    const p = 2 * light - q;

    return {
      r: Math.round(hueToRgb(p, q, hue + 1 / 3) * 255),
      g: Math.round(hueToRgb(p, q, hue) * 255),
      b: Math.round(hueToRgb(p, q, hue - 1 / 3) * 255)
    };
  }

  private rgbToHex(r: number, g: number, b: number): string {
    const toHex = (value: number): string => value.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  private activateTourStep(): void {
    const step = this.tourSteps[this.tourStep];
    if (!step) {
      return;
    }

    if (this.activeView !== step.view) {
      this.activeView = step.view;
    }

    setTimeout(() => this.positionTourForCurrentStep(), 80);
  }

  private positionTourForCurrentStep(attempt = 0): void {
    if (!this.showTour) {
      return;
    }

    const step = this.tourSteps[this.tourStep];
    const targetElement = document.getElementById(step.targetId);

    if (!targetElement) {
      if (attempt < 8) {
        setTimeout(() => this.positionTourForCurrentStep(attempt + 1), 120);
      }
      return;
    }

    this.clearHighlight();
    targetElement.classList.add('tour-highlight');
    this.highlightedElement = targetElement;
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

    const rect = targetElement.getBoundingClientRect();
    const cardWidth = Math.min(380, window.innerWidth - 24);
    const estimatedCardHeight = 240;
    const gap = 12;
    const maxLeft = Math.max(12, window.innerWidth - cardWidth - 12);

    let left = Math.min(Math.max(12, rect.left), maxLeft);
    let top = rect.bottom + gap;

    if (top + estimatedCardHeight > window.innerHeight - 12) {
      top = Math.max(12, rect.top - estimatedCardHeight - gap);
    }

    this.tourCardStyle = {
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`
    };
  }

  private clearHighlight(): void {
    if (!this.highlightedElement) {
      return;
    }

    this.highlightedElement.classList.remove('tour-highlight');
    this.highlightedElement = null;
  }
}
