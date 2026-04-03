import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { ApiService } from '../../services/api.service';
import { ChatResponse, Document, DocumentChunk, RagLogs, RetrievedChunk } from '../../models/models';

interface CitationSource {
  documentId: string;
  documentName: string;
  similarityScore: number;
  excerpt: string;
}

interface CitationDialogData extends CitationSource {
  documentExcerpt: string;
}

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  response?: ChatResponse;
  question?: string;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatDialogModule,
    MatMenuModule
  ],
  template: `
    <div class="gpt-shell">

      <div class="chat-controls">
        <div class="search-scope-container" (focusout)="onFilterFocusOut($event)">
          <button class="filter-toggle" (click)="showDocumentFilter = !showDocumentFilter" type="button">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
            </svg>
            Search scope ({{ selectAllDocuments ? 'All' : selectedDocumentIds.size }})
          </button>
          
          <div class="document-filter-menu" *ngIf="showDocumentFilter">
            <div class="filter-option">
              <input 
                type="checkbox" 
                id="selectAllCheckbox" 
                [checked]="selectAllDocuments"
                (change)="onSelectAllChange($any($event.target).checked)"
                class="checkbox-input">
              <label for="selectAllCheckbox" class="checkbox-label">Select All</label>
            </div>

            <div class="filter-search-wrap" *ngIf="availableDocuments.length > 0">
              <input
                type="text"
                class="filter-search-input"
                placeholder="Find document..."
                [(ngModel)]="documentFilterQuery"
                aria-label="Find document" />
            </div>
            
            <div class="filter-divider" *ngIf="availableDocuments.length > 0"></div>

            <div class="filter-list" *ngIf="availableDocuments.length > 0">
              <div class="filter-option" *ngFor="let doc of filteredDocuments">
                <input 
                  type="checkbox" 
                  [id]="'doc-' + doc.id"
                  [checked]="selectedDocumentIds.has(doc.id)"
                  (change)="onDocumentCheck(doc.id, $any($event.target).checked)"
                  class="checkbox-input">
                <label [for]="'doc-' + doc.id" class="checkbox-label">{{ doc.name }}</label>
              </div>

              <div class="filter-empty" *ngIf="filteredDocuments.length === 0">
                No matching documents.
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state shown before first message -->
      <div class="empty-state" *ngIf="messages.length === 0">
        <div class="empty-icon">
          <svg viewBox="0 0 41 41" fill="none" xmlns="http://www.w3.org/2000/svg" class="rag-logo">
            <path d="M37.532 16.87a9.963 9.963 0 0 0-.856-8.184 10.078 10.078 0 0 0-10.855-4.835 9.964 9.964 0 0 0-6.205-3.498 10.079 10.079 0 0 0-10.44 4.992 9.963 9.963 0 0 0-6.67 4.828 10.079 10.079 0 0 0 1.24 11.817 9.963 9.963 0 0 0 .856 8.185 10.079 10.079 0 0 0 10.855 4.835 9.965 9.965 0 0 0 6.205 3.498 10.079 10.079 0 0 0 10.44-4.993 9.963 9.963 0 0 0 6.67-4.827 10.079 10.079 0 0 0-1.24-11.818z" fill="currentColor"/>
          </svg>
        </div>
        <h2>How can I help you today?</h2>
        <p>Ask anything about your uploaded documents.</p>
        <div class="suggestions">
          <button class="suggestion-chip" *ngFor="let s of suggestions" (click)="applySuggestion(s)">
            <span>{{ s }}</span>
          </button>
        </div>
      </div>

      <!-- Message thread -->
      <div class="messages-area" #messagesArea *ngIf="messages.length > 0">
        <div *ngFor="let msg of messages; let i = index" class="message-row" [class.user-row]="msg.role === 'user'" [class.ai-row]="msg.role === 'ai'">

          <!-- AI avatar -->
          <div class="avatar ai-avatar" *ngIf="msg.role === 'ai'">
            <img src="assets/assistant.png" alt="Assistant avatar" class="avatar-image" />
          </div>

          <div class="bubble-col">
            <!-- Bubble -->
            <div class="bubble" [class.user-bubble]="msg.role === 'user'" [class.ai-bubble]="msg.role === 'ai'">
              <p class="bubble-role" *ngIf="msg.role === 'ai'">Assistant 🤖</p>
              <p class="bubble-text" *ngIf="msg.role === 'user'">{{ msg.text }}</p>
              <p class="bubble-text" *ngIf="msg.role === 'ai'" [innerHTML]="getFormattedAnswer(msg)"></p>

              <!-- Metadata chips for AI messages -->
              <div class="msg-meta" *ngIf="msg.role === 'ai' && msg.response">
                <span class="chip" *ngIf="msg.response?.model">Model: {{ msg.response?.model }}</span>
                <span class="chip" *ngIf="msg.response?.tokensUsed">Tokens used: {{ msg.response?.tokensUsed }}</span>
                <span class="chip retry" *ngIf="(msg.response?.retryCount ?? 0) > 0">⚠ {{ msg.response?.retryCount }} {{ (msg.response?.retryCount ?? 0) === 1 ? 'retry' : 'retries' }}</span>
              </div>
            </div>

            <div class="answer-sources" *ngIf="msg.role === 'ai' && msg.response && getMessageSources(msg).length > 0">
              <span class="sources-label">📚 Citations:</span>
              <button
                type="button"
                class="source-link"
                *ngFor="let source of getMessageSources(msg)"
                (click)="openCitation(source)">
                {{ source.documentName }} ({{ (source.similarityScore * 100).toFixed(0) }}%)
              </button>
            </div>

            <!-- Action row -->
            <div class="bubble-actions" *ngIf="msg.role === 'ai' && msg.response">
              <button class="action-btn" (click)="copyText(msg.text)" matTooltip="Copy answer">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>

              <button class="action-btn" (click)="toggleSection(i, 'details')" matTooltip="Sources & Quality">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </button>

              <button class="action-btn" *ngIf="msg.response?.llmPrompt" (click)="toggleSection(i, 'prompt')" matTooltip="LLM Prompt">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              </button>

              <button class="action-btn" *ngIf="msg.response?.llmPrompt" (click)="copyPromptTrace(msg.response)" matTooltip="Copy Prompt">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
              </button>
            </div>

            <!-- Expandable details accordion -->
            <div class="accordion" *ngIf="msg.role === 'ai' && msg.response && openSection[i] === 'details'">

              <!-- Sources -->
              <div class="acc-section" *ngIf="(msg.response?.retrievedChunks?.length ?? 0) > 0">
                <div class="acc-heading">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  Retrieved Sources
                </div>
                <div class="source-list">
                  <div *ngFor="let chunk of msg.response?.retrievedChunks" class="source-item">
                    <div class="source-meta">
                      <span class="source-name">{{ chunk.documentName }}</span>
                      <span class="sim-badge">{{ (chunk.similarityScore * 100).toFixed(0) }}% match</span>
                    </div>
                    <p class="source-text">{{ chunk.content }}</p>
                  </div>
                </div>
              </div>

              <!-- Query info -->
              <div class="acc-section" *ngIf="msg.response?.queryTransformation">
                <div class="acc-heading">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  How your question was interpreted
                  <span class="acc-badge">{{ msg.response?.queryTransformation?.transformationStrategy }}</span>
                </div>
                <ul class="acc-list" *ngIf="(msg.response?.queryTransformation?.expandedQueries?.length ?? 0) > 0">
                  <li *ngFor="let q of msg.response?.queryTransformation?.expandedQueries">{{ q }}</li>
                </ul>
                <ul class="acc-list" *ngIf="(msg.response?.queryTransformation?.decomposedQuestions?.length ?? 0) > 0">
                  <li *ngFor="let q of msg.response?.queryTransformation?.decomposedQuestions">{{ q }}</li>
                </ul>
              </div>

              <!-- Answer grading -->
              <div class="acc-section" *ngIf="msg.response?.answerGrade">
                <div class="acc-heading">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                  Confidence Score
                  <span class="acc-badge" [class.badge-high]="(msg.response?.answerGrade?.relevancyScore ?? 0) > 0.7" [class.badge-low]="(msg.response?.answerGrade?.relevancyScore ?? 0) <= 0.4">
                    {{ ((msg.response?.answerGrade?.relevancyScore ?? 0) * 100).toFixed(0) }}% relevance
                  </span>
                </div>
                <p class="acc-text">{{ msg.response?.answerGrade?.reasoning }}</p>
              </div>

              <!-- Web sources -->
              <div class="acc-section" *ngIf="msg.response?.webSource?.usedWebSearch">
                <div class="acc-heading">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  Web Sources
                </div>
                <div *ngFor="let src of msg.response?.webSource?.sources" class="web-source-row">
                  <a [href]="src.url" target="_blank" rel="noopener noreferrer">{{ src.title }}</a>
                  <p>{{ src.snippet }}</p>
                </div>
              </div>
            </div>

            <!-- LLM prompt accordion -->
            <div class="accordion prompt-accordion" *ngIf="msg.role === 'ai' && msg.response?.llmPrompt && openSection[i] === 'prompt'">
              <div class="acc-section">
                <div class="acc-heading">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                  Exact Prompt Sent to LLM
                  <span class="acc-badge">{{ msg.response?.llmPrompt?.provider }} / {{ msg.response?.llmPrompt?.model }}</span>
                  <span class="acc-badge" [class.badge-high]="msg.response?.llmPrompt?.sentToLlm" [class.badge-low]="!msg.response?.llmPrompt?.sentToLlm">
                    {{ msg.response?.llmPrompt?.sentToLlm ? 'sent' : 'not sent' }}
                  </span>
                </div>
                <p class="acc-text" *ngIf="msg.response?.llmPrompt?.notes">{{ msg.response?.llmPrompt?.notes }}</p>
                <pre class="prompt-pre">{{ msg.response?.llmPrompt?.combinedPrompt }}</pre>
              </div>
            </div>
          </div>

          <!-- User avatar -->
          <div class="avatar user-avatar" *ngIf="msg.role === 'user'">
            <img src="assets/problem.png" alt="User avatar" class="avatar-image" />
          </div>
        </div>

        <!-- Typing indicator -->
        <div class="message-row ai-row" *ngIf="isLoading">
          <div class="avatar ai-avatar">
            <img src="assets/assistant.png" alt="Assistant avatar" class="avatar-image" />
          </div>
          <div class="bubble-col">
            <div class="bubble ai-bubble typing-bubble">
              <span class="dot"></span><span class="dot"></span><span class="dot"></span>
              <span class="thinking-text">Thinking...</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom input bar -->
      <div id="tour-chat-input" class="input-bar">
        <form [formGroup]="chatForm" class="input-row" (ngSubmit)="askQuestion()">
          <div class="input-wrapper">
            <textarea
              #inputTextarea
              formControlName="question"
              class="chat-input"
              placeholder='Ask a question about your documents...'
              rows="1"
              (keydown.enter)="onEnterKey($any($event))"
              (input)="autoResize($event)"></textarea>
            
            <!-- Chat options menu -->
            <button type="button" class="settings-btn" [matMenuTriggerFor]="chatOptionsMenu" matTooltip="Options">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
            </button>

            <mat-menu #chatOptionsMenu="matMenu">
              <button mat-menu-item (click)="openSettingsDialog()">
                <span>Settings</span>
              </button>
              <button mat-menu-item (click)="openSessionLogsDialog()">
                <span>Session Logs</span>
              </button>
            </mat-menu>

            <button
              type="submit"
              class="send-btn"
              [disabled]="isLoading || !chatForm.get('question')?.value?.trim()"
              matTooltip="Send message">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </div>
        </form>
        <p class="disclaimer">DocuSense may produce inaccurate information. Verify important claims.</p>
      </div>
    </div>
  `,
  styles: [`
    /* ─── Shell ─────────────────────────────────────── */
    .gpt-shell {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 36px);
      background: transparent;
      --user-bg: var(--app-accent, #111111);
      --ai-bg: #edf4ff;
      --ai-text: #0d0d0d;
      --user-text: #fff;
      --border: rgba(0,0,0,0.1);
      --placeholder: #8e8ea0;
      --input-bg: #ffffff;
      --input-border: #d1d5db;
      --action-color: #6b7280;
      --acc-bg: #f9f9f9;
      --badge-bg: #e5e7eb;
      --badge-text: #374151;
      --source-bg: #ffffff;
    }

    .chat-controls {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      padding: 8px 28px 4px;
      width: 100%;
      position: relative;
    }

    .search-scope-container {
      position: relative;
    }

    .filter-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 0.85rem;
      color: #475569;
      cursor: pointer;
      transition: border-color 150ms, background 150ms;
    }

    .filter-toggle:hover {
      background: #f8fafc;
      border-color: #94a3b8;
    }

    .filter-toggle svg {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
      stroke-width: 2;
    }

    .document-filter-menu {
      position: absolute;
      top: calc(100% + 4px);
      right: 0;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      min-width: 220px;
      z-index: 1000;
      overflow: hidden;
      animation: slideDown 150ms ease;
    }

    .filter-search-wrap {
      padding: 6px 10px;
    }

    .filter-search-input {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 7px 10px;
      font-size: 0.84rem;
      color: #1f2937;
      background: #ffffff;
      outline: none;
    }

    .filter-search-input:focus {
      border-color: var(--app-accent, #111111);
      box-shadow: 0 0 0 1px var(--app-accent, #111111);
    }

    .filter-list {
      max-height: 190px;
      overflow-y: auto;
      overscroll-behavior: contain;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .filter-option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      cursor: pointer;
    }

    .filter-option:hover {
      background: #f8fafc;
    }

    .checkbox-input {
      width: 18px;
      height: 18px;
      cursor: pointer;
      accent-color: var(--app-accent, #111111);
      flex-shrink: 0;
    }

    .checkbox-label {
      font-size: 0.87rem;
      color: #374151;
      cursor: pointer;
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      user-select: none;
    }

    .filter-divider {
      height: 1px;
      background: #e5e7eb;
      margin: 4px 0;
    }

    .filter-empty {
      padding: 10px 12px;
      color: #6b7280;
      font-size: 0.82rem;
    }

    .doc-filter-select {
      min-width: 260px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.84rem;
      padding: 6px 10px;
      color: #1e293b;
      background: #ffffff;
    }

    /* ─── Empty state ───────────────────────────────── */
    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      text-align: center;
      color: #0d0d0d;
    }

    .empty-icon { margin-bottom: 20px; }

    .rag-logo {
      width: 52px;
      height: 52px;
      color: #10a37f;
    }

    .empty-state h2 {
      font-size: 1.85rem;
      font-weight: 700;
      margin: 0 0 10px;
    }

    .empty-state p {
      color: #6b7280;
      margin: 0 0 28px;
      font-size: 1rem;
    }

    .suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: center;
      max-width: 640px;
    }

    .suggestion-chip {
      padding: 10px 16px;
      background: #f4f4f4;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      cursor: pointer;
      font-size: 0.9rem;
      color: #374151;
      transition: background 150ms, border-color 150ms;
      line-height: 1.4;
      text-align: left;
    }

    .suggestion-chip:hover {
      background: #e9e9e9;
      border-color: #9ca3af;
    }

    /* ─── Messages ──────────────────────────────────── */
    .messages-area {
      flex: 1;
      overflow-y: auto;
      padding: 20px 0 10px;
      scroll-behavior: smooth;
    }

    .message-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 6px 28px;
      max-width: 820px;
      margin: 0 auto;
    }

    .user-row { flex-direction: row-reverse; }

    /* ─── Avatars ────────────────────────────────────── */
    .avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .avatar-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
      display: block;
    }

    .ai-avatar {
      background: transparent;
      padding: 0;
    }

    .user-avatar {
      background: transparent;
      padding: 0;
    }

    /* ─── Bubbles ────────────────────────────────────── */
    .bubble-col {
      display: flex;
      flex-direction: column;
      max-width: calc(100% - 58px);
    }

    .user-row .bubble-col { align-items: flex-end; }
    .ai-row .bubble-col   { align-items: flex-start; }

    .bubble {
      padding: 10px 13px;
      border-radius: 16px;
      font-size: 0.78rem;
      line-height: 1.5;
      max-width: 100%;
    }

    .user-bubble {
      background: var(--user-bg);
      color: var(--user-text);
      border-bottom-right-radius: 4px;
    }

    .ai-bubble {
      background: var(--ai-bg);
      color: var(--ai-text);
      border-bottom-left-radius: 4px;
    }

    .bubble-text { margin: 0; white-space: pre-wrap; }

    .ellipse-highlight {
      display: inline-block;
      padding: 0 8px;
      margin: 0 1px;
      border-radius: 999px;
      background: rgba(17, 17, 17, 0.12);
      color: var(--app-accent, #111111);
      font-weight: 700;
    }

    .bubble-role {
      margin: 0 0 4px;
      font-size: 0.58rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      opacity: 0.8;
      text-transform: uppercase;
    }

    .answer-sources {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px dashed rgba(100, 116, 139, 0.35);
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      align-items: center;
    }

    .sources-label {
      font-size: 0.76rem;
      color: #475569;
      font-weight: 700;
    }

    .source-link {
      border: none;
      background: #f3f4f6;
      color: var(--app-accent, #111111);
      border-radius: 999px;
      padding: 3px 10px;
      font-size: 0.75rem;
      cursor: pointer;
    }

    .source-link:hover {
      background: #e5e7eb;
      color: #000000;
    }

    /* ─── Metadata chips ─────────────────────────────── */
    .msg-meta {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 8px;
    }

    .chip {
      font-size: 0.72rem;
      padding: 2px 8px;
      border-radius: 20px;
      background: var(--badge-bg);
      color: var(--badge-text);
    }

    .chip.retry { background: #fef3c7; color: #92400e; }

    /* ─── Typing dots ────────────────────────────────── */
    .typing-bubble {
      padding: 14px 18px;
      display: flex;
      gap: 5px;
      align-items: center;
    }

    .thinking-text {
      margin-left: 4px;
      color: #64748b;
      font-size: 0.84rem;
      font-weight: 600;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #9ca3af;
      animation: blink 1.2s infinite;
    }
    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes blink {
      0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
      40%            { opacity: 1;   transform: scale(1);   }
    }

    /* ─── Bubble actions ─────────────────────────────── */
    .bubble-actions {
      display: flex;
      gap: 4px;
      margin-top: 4px;
      opacity: 0.35;
      transition: opacity 150ms;
    }

    .ai-row:hover .bubble-actions { opacity: 1; }

    .action-btn {
      width: 28px;
      height: 28px;
      padding: 5px;
      border: none;
      background: transparent;
      cursor: pointer;
      border-radius: 6px;
      color: var(--action-color);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 130ms, color 130ms;
    }

    .action-btn svg { width: 100%; height: 100%; }

    .action-btn:hover {
      background: #e5e7eb;
      color: #111827;
    }

    /* ─── Accordions ─────────────────────────────────── */
    .accordion {
      margin-top: 6px;
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      background: var(--acc-bg);
      animation: slideDown 180ms ease;
      max-width: 720px;
    }

    .prompt-accordion { font-family: "Fira Mono", "Cascadia Code", monospace; }

    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .acc-section {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
    }

    .acc-section:last-child { border-bottom: none; }

    .acc-heading {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      font-size: 0.85rem;
      color: #374151;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }

    .acc-heading svg {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      stroke: #6b7280;
    }

    .acc-badge {
      font-size: 0.72rem;
      font-weight: 500;
      padding: 2px 8px;
      border-radius: 20px;
      background: var(--badge-bg);
      color: var(--badge-text);
    }

    .acc-badge.badge-high { background: #d1fae5; color: #065f46; }
    .acc-badge.badge-low  { background: #fee2e2; color: #991b1b; }

    .acc-text {
      margin: 0;
      font-size: 0.87rem;
      color: #4b5563;
      line-height: 1.55;
    }

    .acc-list {
      margin: 0;
      padding-left: 18px;
      font-size: 0.87rem;
      color: #374151;
    }

    .acc-list li { margin: 3px 0; }

    .source-list { display: flex; flex-direction: column; gap: 8px; }

    .source-item {
      background: var(--source-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 12px;
    }

    .source-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .source-name {
      font-weight: 600;
      font-size: 0.85rem;
      color: #111827;
    }

    .sim-badge {
      font-size: 0.72rem;
      padding: 2px 8px;
      border-radius: 20px;
      background: #d1fae5;
      color: #065f46;
      font-weight: 500;
    }

    .source-text {
      margin: 0;
      font-size: 0.85rem;
      color: #4b5563;
      line-height: 1.5;
    }

    .web-source-row {
      padding: 6px 0;
      border-bottom: 1px solid var(--border);
    }

    .web-source-row:last-child { border-bottom: none; }

    .web-source-row a {
      color: var(--app-accent, #111111);
      font-weight: 500;
      font-size: 0.87rem;
      text-decoration: none;
    }

    .web-source-row a:hover { text-decoration: underline; }

    .web-source-row p {
      margin: 3px 0 0;
      font-size: 0.83rem;
      color: #6b7280;
    }

    .prompt-pre {
      white-space: pre-wrap;
      font-size: 0.8rem;
      line-height: 1.55;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      margin: 0;
      max-height: 320px;
      overflow-y: auto;
    }

    /* ─── Input bar ──────────────────────────────────── */
    .input-bar {
      position: sticky;
      bottom: 0;
      z-index: 4;
      padding: 12px 28px 14px;
      border-top: 1px solid var(--border);
      background: linear-gradient(to top, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.88));
      backdrop-filter: blur(4px);
    }

    .input-wrapper {
      display: flex;
      align-items: flex-end;
      gap: 8px;
    }

    .input-row {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
    }

    .input-wrapper {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: 14px;
      padding: 10px 12px;
      box-shadow: 0 1px 8px rgba(0,0,0,0.08);
      transition: border-color 160ms, box-shadow 160ms;
    }

    .input-wrapper:focus-within {
      border-color: var(--app-accent, #111111);
      box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.18);
    }

    .chat-input {
      flex: 1;
      border: none;
      outline: none;
      resize: none;
      font-size: 0.97rem;
      line-height: 1.55;
      font-family: inherit;
      background: transparent;
      color: #0d0d0d;
      max-height: 200px;
      overflow-y: auto;
    }

    .chat-input::placeholder { color: var(--placeholder); }

    .settings-btn {
      width: 34px;
      height: 34px;
      flex-shrink: 0;
      background: transparent;
      color: #6b7280;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 6px;
      transition: background 140ms, color 140ms, border-color 140ms;
    }

    .settings-btn svg { width: 100%; height: 100%; }

    .settings-btn:hover {
      background: #f3f4f6;
      color: #374151;
      border-color: #9ca3af;
    }

    .send-btn {
      width: 34px;
      height: 34px;
      flex-shrink: 0;
      background: var(--app-accent, #111111);
      color: #fff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 7px;
      transition: background 140ms, transform 120ms;
    }

    .send-btn svg { width: 100%; height: 100%; }

    .send-btn:disabled { background: #d1d5db; cursor: not-allowed; }

    .send-btn:not(:disabled):hover {
      background: #000000;
      transform: scale(1.05);
    }

    .input-settings {
      display: none;
    }

    .disclaimer {
      text-align: center;
      font-size: 0.72rem;
      color: #9ca3af;
      margin: 8px 0 0;
    }

    /* ─── Dark theme override ────────────────────────── */
    :host-context(.theme-dark) .gpt-shell {
      --ai-bg: #1f2937;
      --ai-text: #ececec;
      --border: rgba(255,255,255,0.1);
      --placeholder: #9ca3af;
      --input-bg: #1e1e1e;
      --input-border: #3d3d3d;
      --action-color: #9ca3af;
      --acc-bg: #252525;
      --badge-bg: #374151;
      --badge-text: #d1d5db;
      --source-bg: #2a2a2a;
    }

    :host-context(.theme-dark) .chat-controls label { color: #cbd5e1; }
    :host-context(.theme-dark) .filter-toggle {
      background: #1e1e1e;
      border-color: #3d3d3d;
      color: #d1d5db;
    }
    :host-context(.theme-dark) .filter-toggle:hover {
      background: #2a2a2a;
      border-color: #4b5563;
    }
    :host-context(.theme-dark) .document-filter-menu {
      background: #1e1e1e;
      border-color: #3d3d3d;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }
    :host-context(.theme-dark) .filter-search-input {
      background: #111827;
      color: #e5e7eb;
      border-color: #334155;
    }
    :host-context(.theme-dark) .filter-option {
      color: #d1d5db;
    }
    :host-context(.theme-dark) .filter-option:hover {
      background: #2a2a2a;
    }
    :host-context(.theme-dark) .checkbox-label {
      color: #d1d5db;
    }
    :host-context(.theme-dark) .filter-divider {
      background: #3d3d3d;
    }
    :host-context(.theme-dark) .filter-empty {
      color: #9ca3af;
    }
    :host-context(.theme-dark) .doc-filter-select {
      background: #111827;
      color: #e5e7eb;
      border-color: #334155;
    }
    :host-context(.theme-dark) .sources-label { color: #cbd5e1; }
    :host-context(.theme-dark) .source-link {
      background: var(--app-accent, #111111);
      color: #f3f4f6;
    }
    :host-context(.theme-dark) .source-link:hover {
      background: #1f2937;
      color: #eff6ff;
    }
    :host-context(.theme-dark) .thinking-text { color: #cbd5e1; }
    :host-context(.theme-dark) .input-bar {
      background: linear-gradient(to top, rgba(2, 6, 23, 0.95), rgba(2, 6, 23, 0.75));
    }

    :host-context(.theme-dark) .empty-state { color: #f3f4f6; }
    :host-context(.theme-dark) .empty-state p { color: #9ca3af; }
    :host-context(.theme-dark) .suggestion-chip {
      background: #2d2d2d;
      border-color: #4b5563;
      color: #d1d5db;
    }
    :host-context(.theme-dark) .suggestion-chip:hover {
      background: #374151;
      border-color: #6b7280;
    }
    :host-context(.theme-dark) .chat-input { color: #f3f4f6; }
    :host-context(.theme-dark) .acc-heading { color: #d1d5db; }
    :host-context(.theme-dark) .source-name { color: #f9fafb; }
    :host-context(.theme-dark) .action-btn:hover { background: #374151; color: #f9fafb; }
    :host-context(.theme-dark) .disclaimer { color: #6b7280; }
    :host-context(.theme-dark) .prompt-pre { background: #1a1a1a; border-color: #374151; color: #d1d5db; }
    :host-context(.theme-dark) .settings-btn { background: #374151; color: #d1d5db; border-color: #4b5563; }
    :host-context(.theme-dark) .settings-btn:hover { background: #4b5563; color: #f3f4f6; border-color: #6b7280; }
  `]
})
export class ChatComponent implements OnInit, AfterViewChecked {
  @ViewChild('messagesArea') messagesAreaRef!: ElementRef<HTMLDivElement>;
  @ViewChild('inputTextarea') inputTextareaRef!: ElementRef<HTMLTextAreaElement>;

  chatForm: FormGroup;
  messages: ChatMessage[] = [];
  openSection: Record<number, 'details' | 'prompt' | null> = {};
  isLoading = false;
  maxContextChunks = 5;
  similarityThreshold = 0.5;
  private shouldScroll = false;
  temperature = 0.7;
  sessionLogs: SessionLogItem[] = [];
  availableDocuments: Document[] = [];
  selectedDocumentId = '';
  selectedDocumentIds: Set<string> = new Set();
  selectAllDocuments = true;
  showDocumentFilter = false;
  documentFilterQuery = '';

  suggestions = [
    'What are the main topics in my documents?',
    'Summarize the key points from uploaded files.',
    'What does the document say about policies?',
    'List important terms and definitions.'
  ];

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.chatForm = this.fb.group({ question: ['', [Validators.required]] });
  }

  ngOnInit(): void {
    this.apiService.getDocuments().subscribe({
      next: (docs) => {
        this.availableDocuments = docs.filter((doc) => doc.isProcessed);
        // Initialize all documents as selected by default
        this.availableDocuments.forEach(doc => this.selectedDocumentIds.add(doc.id));
      },
      error: () => {
        this.availableDocuments = [];
        this.selectedDocumentIds.clear();
      }
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  onEnterKey(event: KeyboardEvent): void {
    if (!event.shiftKey) {
      event.preventDefault();
      this.askQuestion();
    }
  }

  autoResize(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }

  applySuggestion(text: string): void {
    this.chatForm.patchValue({ question: text });
    this.inputTextareaRef?.nativeElement?.focus();
  }

  onSelectAllChange(checked: boolean): void {
    this.selectAllDocuments = checked;
    if (checked) {
      this.availableDocuments.forEach(doc => this.selectedDocumentIds.add(doc.id));
    } else {
      this.selectedDocumentIds.clear();
    }
  }

  onDocumentCheck(docId: string, checked: boolean): void {
    if (checked) {
      this.selectedDocumentIds.add(docId);
    } else {
      this.selectedDocumentIds.delete(docId);
    }
    this.selectAllDocuments = this.selectedDocumentIds.size === this.availableDocuments.length;
  }

  onFilterFocusOut(event: FocusEvent): void {
    const host = event.currentTarget as HTMLElement | null;
    const nextFocused = event.relatedTarget as Node | null;
    if (host && nextFocused && host.contains(nextFocused)) {
      return;
    }
    this.showDocumentFilter = false;
  }

  get filteredDocuments(): Document[] {
    const query = this.documentFilterQuery.trim().toLowerCase();
    if (!query) {
      return this.availableDocuments;
    }
    return this.availableDocuments.filter(doc => doc.name.toLowerCase().includes(query));
  }

  getSelectedDocumentIdsAsString(): string {
    if (this.selectAllDocuments || this.selectedDocumentIds.size === 0) {
      return '';
    }
    return Array.from(this.selectedDocumentIds)[0] || '';
  }

  askQuestion(): void {
    const question = (this.chatForm.get('question')?.value ?? '').toString().trim();
    if (!question) return;

    this.messages.push({ role: 'user', text: question });
    this.chatForm.reset();
    if (this.inputTextareaRef?.nativeElement) {
      this.inputTextareaRef.nativeElement.style.height = 'auto';
    }
    this.isLoading = true;
    this.shouldScroll = true;
    this.openSection = {};

    const request = {
      question,
      maxContextChunks: this.maxContextChunks,
      similarityThreshold: this.similarityThreshold,
      temperature: this.temperature,
      documentId: this.getSelectedDocumentIdsAsString() || undefined
    };

    this.apiService.askQuestion(request).subscribe({
      next: (response) => {
        this.messages.push({ role: 'ai', text: response.answer, response, question });
        this.sessionLogs.unshift({
          question,
          answer: response.answer,
          model: response.model,
          timestamp: new Date(),
          logs: response.logs
        });
        this.isLoading = false;
        this.shouldScroll = true;
      },
      error: () => {
        this.messages.push({ role: 'ai', text: 'Sorry, something went wrong. Please try again.' });
        this.isLoading = false;
        this.shouldScroll = true;
        this.snackBar.open('Error getting answer. Please try again.', 'Close', { duration: 3000 });
      }
    });
  }

  toggleSection(index: number, section: 'details' | 'prompt'): void {
    this.openSection[index] = this.openSection[index] === section ? null : section;
  }

  clearChat(): void {
    this.messages = [];
    this.openSection = {};
    this.chatForm.reset();
  }

  openSettingsDialog(): void {
    this.dialog.open(SettingsDialogComponent, {
      width: '400px',
      data: {
        maxContextChunks: this.maxContextChunks,
        similarityThreshold: this.similarityThreshold,
        temperature: this.temperature
      }
    }).afterClosed().subscribe((result) => {
      if (result) {
        if (result.clearChat) {
          this.clearChat();
        }
        this.maxContextChunks = result.maxContextChunks;
        this.similarityThreshold = result.similarityThreshold;
        this.temperature = result.temperature;
      }
    });
  }

  openSessionLogsDialog(): void {
    this.dialog.open(SessionLogsDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      data: {
        sessions: this.sessionLogs
      }
    });
  }

  copyText(text: string): void {
    navigator.clipboard.writeText(text)
      .then(() => this.snackBar.open('Copied to clipboard.', 'Close', { duration: 2000 }))
      .catch(() => this.snackBar.open('Could not copy.', 'Close', { duration: 2000 }));
  }

  copyPromptTrace(response: ChatResponse): void {
    const prompt = response?.llmPrompt?.combinedPrompt;
    if (!prompt) {
      this.snackBar.open('Prompt trace not available.', 'Close', { duration: 2500 });
      return;
    }
    navigator.clipboard.writeText(prompt)
      .then(() => this.snackBar.open('LLM prompt copied.', 'Close', { duration: 2500 }))
      .catch(() => this.snackBar.open('Could not copy prompt.', 'Close', { duration: 2500 }));
  }

  getAnswerBody(answer: string): string {
    if (!answer) {
      return '';
    }

    // Remove inline citations like: 【From file.pdf】 and trailing citation blocks.
    let cleaned = answer;
    cleaned = cleaned.replace(/\s*【\s*From[^】]*】\s*/gi, ' ');
    cleaned = cleaned.replace(/\n{1,}(?:citations?|sources?)\s*:[\s\S]*$/i, '');
    cleaned = cleaned.replace(/\n\s*(?:[-*]\s*)?(?:from|source|sources?)\s*[:\-].*$/gim, '');
    cleaned = cleaned.replace(/\n\s*(?:[-*]\s*)?[^\n]*\.(?:pdf|docx?|txt)(?:\s*\([^\n]*\))?\s*$/gim, '');

    return cleaned
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  getFormattedAnswer(message: ChatMessage): string {
    const answer = this.getAnswerBody(message.text || '');
    if (!answer) {
      return '';
    }

    const escaped = this.escapeHtml(answer);
    const keywords = this.extractImportantKeywords(message.question || '');
    const highlighted = keywords.reduce((acc, keyword) => {
      const pattern = new RegExp(`\\b(${this.escapeRegExp(keyword)})\\b`, 'gi');
      return acc.replace(pattern, '<span class="ellipse-highlight">$1</span>');
    }, escaped);

    return highlighted.replace(/\n/g, '<br>');
  }

  private extractImportantKeywords(question: string): string[] {
    if (!question) {
      return [];
    }

    const stopWords = new Set([
      'about', 'after', 'again', 'also', 'been', 'being', 'between', 'could', 'does', 'from', 'have', 'into',
      'just', 'more', 'over', 'should', 'some', 'than', 'that', 'their', 'there', 'these', 'they', 'this',
      'those', 'what', 'when', 'where', 'which', 'with', 'would', 'your', 'tell', 'show', 'explain'
    ]);

    const words = question
      .toLowerCase()
      .match(/[a-z][a-z0-9-]{3,}/g) ?? [];

    const unique = Array.from(new Set(words.filter(word => !stopWords.has(word))));
    return unique.slice(0, 5);
  }

  private escapeHtml(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  getMessageSources(message: ChatMessage): CitationSource[] {
    const chunks = message.response?.retrievedChunks ?? [];
    const byDocument = new Map<string, CitationSource>();

    chunks.forEach((chunk: RetrievedChunk) => {
      const existing = byDocument.get(chunk.documentId);
      if (!existing || chunk.similarityScore > existing.similarityScore) {
        byDocument.set(chunk.documentId, {
          documentId: chunk.documentId,
          documentName: chunk.documentName,
          similarityScore: chunk.similarityScore,
          excerpt: chunk.content
        });
      }
    });

    return Array.from(byDocument.values()).sort((a, b) => b.similarityScore - a.similarityScore);
  }

  openCitation(source: CitationSource): void {
    this.apiService.getDocumentChunks(source.documentId).subscribe({
      next: (chunks: DocumentChunk[]) => {
        const fallback = source.excerpt.trim();
        const matchingChunk = chunks.find((chunk) => {
          const probe = fallback.slice(0, Math.min(80, fallback.length));
          return probe.length > 20 && chunk.content.includes(probe);
        });

        const evidence = (matchingChunk?.content ?? chunks[0]?.content ?? fallback).trim();
        this.dialog.open(CitationDialogComponent, {
          width: '760px',
          maxWidth: '95vw',
          data: {
            ...source,
            documentExcerpt: evidence
          } as CitationDialogData
        });
      },
      error: () => {
        this.dialog.open(CitationDialogComponent, {
          width: '760px',
          maxWidth: '95vw',
          data: {
            ...source,
            documentExcerpt: source.excerpt
          } as CitationDialogData
        });
      }
    });
  }

  private scrollToBottom(): void {
    const el = this.messagesAreaRef?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}

interface SessionLogItem {
  question: string;
  answer: string;
  model: string;
  timestamp: Date;
  logs?: RagLogs;
}

@Component({
  selector: 'app-citation-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>Source Evidence</h2>
    <mat-dialog-content>
      <p class="doc-name">{{ data.documentName }}</p>
      <p class="doc-score">Similarity: {{ (data.similarityScore * 100).toFixed(0) }}%</p>
      <p class="doc-content" [innerHTML]="highlightedExcerpt"></p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-raised-button color="primary" (click)="close()">Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .doc-name {
      margin: 0;
      font-weight: 700;
      color: #0f172a;
    }

    .doc-score {
      margin: 4px 0 12px;
      font-size: 0.84rem;
      color: #475569;
    }

    .doc-content {
      margin: 0;
      white-space: pre-wrap;
      line-height: 1.6;
      color: #1e293b;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px;
    }

    .doc-content mark {
      background: #fde68a;
      color: #78350f;
      padding: 0 2px;
      border-radius: 2px;
    }
  `]
})
export class CitationDialogComponent {
  highlightedExcerpt: string;

  constructor(
    public dialogRef: MatDialogRef<CitationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CitationDialogData
  ) {
    const sourceText = data.documentExcerpt || data.excerpt || 'No source excerpt available.';
    const safeSource = this.escapeHtml(sourceText);
    const safeQuote = this.escapeHtml((data.excerpt || '').trim());

    if (safeQuote.length > 20 && safeSource.includes(safeQuote)) {
      this.highlightedExcerpt = safeSource.replace(safeQuote, `<mark>${safeQuote}</mark>`);
    } else {
      this.highlightedExcerpt = `<mark>${safeSource}</mark>`;
    }
  }

  close(): void {
    this.dialogRef.close();
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

@Component({
  selector: 'app-settings-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <div class="dialog-container">
      <h2 mat-dialog-title>Settings</h2>
      
      <mat-dialog-content>
        <!-- Search Width slider -->
        <div class="setting-item">
          <label class="setting-label">Search Width</label>
          <div class="slider-container">
            <input type="range" min="1" max="10" [(ngModel)]="data.maxContextChunks" class="settings-slider">
            <span class="slider-value">{{ data.maxContextChunks }} chunks</span>
          </div>
          <div class="slider-ends">
            <span>Narrow</span>
            <span>Broad</span>
          </div>
          <p class="setting-help">Narrow (1) retrieves fewer, more focused results — Broad (10) casts a wider net across your documents</p>
        </div>

        <!-- Answer Precision slider -->
        <div class="setting-item">
          <label class="setting-label">Answer Precision</label>
          <div class="slider-container">
            <input type="range" min="0.3" max="1" step="0.05" [(ngModel)]="data.similarityThreshold" class="settings-slider">
            <span class="slider-value">{{ (data.similarityThreshold * 100).toFixed(0) }}%</span>
          </div>
          <div class="slider-ends">
            <span>Loose match</span>
            <span>Exact match</span>
          </div>
          <p class="setting-help">Lower: accepts loosely related results — Higher: requires a closer match to your question</p>
        </div>

        <!-- Factual to Creative slider -->
        <div class="setting-item">
          <label class="setting-label">Factual to Creative</label>
          <div class="slider-container">
            <input type="range" min="0" max="1" step="0.05" [(ngModel)]="data.temperature" class="settings-slider">
            <span class="slider-value">{{ (data.temperature * 100).toFixed(0) }}%</span>
          </div>
          <div class="slider-ends">
            <span>Factual</span>
            <span>Creative</span>
          </div>
          <p class="setting-help">Factual (0%): deterministic, focused answers — Creative (100%): more varied and exploratory responses</p>
        </div>
        <!-- Clear Chat button -->
        <button mat-stroked-button (click)="clearChat()" class="clear-chat-btn">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          Clear Conversation
        </button>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="onCancel()">Cancel</button>
        <button mat-raised-button color="primary" (click)="onSave()">Save</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-container {
      padding: 8px;
    }

    h2 {
      margin: 0 0 20px 0;
      font-size: 1.3rem;
      font-weight: 600;
    }

    mat-dialog-content {
      display: flex;
      flex-direction: column;
      gap: 24px;
      padding: 16px 0;
    }

    .setting-item {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .setting-label {
      font-weight: 600;
      font-size: 0.95rem;
      color: #1f2937;
    }

    .slider-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .settings-slider {
      flex: 1;
      height: 6px;
      border-radius: 3px;
      background: linear-gradient(to right, #e5e7eb, #d1d5db);
      outline: none;
      -webkit-appearance: none;
      appearance: none;
    }

    .settings-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--app-accent, #111111);
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      transition: all 140ms;
    }

    .settings-slider::-webkit-slider-thumb:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
    }

    .settings-slider::-moz-range-thumb {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--app-accent, #111111);
      cursor: pointer;
      border: none;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      transition: all 140ms;
    }

    .settings-slider::-moz-range-thumb:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
    }

    .slider-value {
      font-weight: 600;
      font-size: 1rem;
      color: var(--app-accent, #111111);
      min-width: 46px;
      text-align: right;
    }

    .slider-ends {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: #9ca3af;
      margin-top: -2px;
    }

    .setting-help {
      font-size: 0.8rem;
      color: #6b7280;
      margin: 0;
      line-height: 1.4;
    }

    .clear-chat-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
    }

    .clear-chat-btn svg {
      width: 18px;
      height: 18px;
    }

    mat-dialog-actions {
      padding: 16px 0 0 0;
      gap: 8px;
    }
  `]
})
export class SettingsDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<SettingsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { maxContextChunks: number; similarityThreshold: number; temperature: number }
  ) {}

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    this.dialogRef.close({ maxContextChunks: this.data.maxContextChunks, similarityThreshold: this.data.similarityThreshold, temperature: this.data.temperature });
  }

  clearChat(): void {
    // This will be handled by the parent component
    this.dialogRef.close({ clearChat: true, maxContextChunks: this.data.maxContextChunks, similarityThreshold: this.data.similarityThreshold, temperature: this.data.temperature });
  }
}

@Component({
  selector: 'app-session-logs-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>Session Logs</h2>
    <mat-dialog-content>
      <div *ngIf="!data.sessions?.length" class="empty-logs">
        No session logs yet. Ask a question to generate logs.
      </div>

      <div *ngFor="let session of data.sessions; let idx = index" class="session-card">
        <div class="session-header">
          <div class="session-title">{{ session.question.length > 70 ? (session.question | slice:0:70) + '...' : session.question }}</div>
          <div class="session-meta">{{ session.model }} | {{ relativeTime(session.timestamp) }}</div>
        </div>

        <div class="qa-block">
          <div class="qa-label">Question</div>
          <pre class="qa-pre">{{ session.question }}</pre>
        </div>

        <div class="qa-block">
          <div class="qa-label">Final Answer</div>
          <pre class="qa-pre">{{ session.answer }}</pre>
        </div>

        <div class="log-meta" *ngIf="session.logs">
          Total Duration: {{ session.logs.totalDurationMs }} ms
        </div>

        <div *ngFor="let entry of session.logs?.entries" class="log-entry">
          <div class="log-head">
            <span class="log-step">{{ entry.step }}</span>
            <span class="log-status">{{ entry.status }}</span>
            <span class="log-duration">{{ entry.durationMs }} ms</span>
          </div>
          <p class="log-description">{{ entry.description }}</p>
          <ul class="log-details">
            <li *ngFor="let detail of entry.details">{{ detail }}</li>
          </ul>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-raised-button color="primary" (click)="close()">Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      max-height: 75vh;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .empty-logs {
      color: #6b7280;
      padding: 14px;
      border: 1px dashed #d1d5db;
      border-radius: 8px;
      background: #fafafa;
    }

    .session-card {
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 12px;
      background: #fff;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .session-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }

    .session-title {
      font-weight: 700;
      color: #111827;
    }

    .session-meta {
      font-size: 0.8rem;
      color: #6b7280;
    }

    .qa-block {
      border: 1px solid #f1f5f9;
      border-radius: 8px;
      background: #f8fafc;
      padding: 8px;
    }

    .qa-label {
      font-size: 0.78rem;
      font-weight: 600;
      color: #475569;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .qa-pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 0.84rem;
      color: #0f172a;
    }

    .log-meta {
      font-size: 0.82rem;
      color: #475569;
      font-weight: 600;
    }

    .log-entry {
      border-top: 1px solid #f1f5f9;
      padding-top: 8px;
    }

    .log-head {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }

    .log-step {
      font-weight: 600;
      color: #1f2937;
    }

    .log-status {
      font-size: 0.75rem;
      border-radius: 999px;
      background: #e2e8f0;
      color: #334155;
      padding: 2px 8px;
    }

    .log-duration {
      font-size: 0.75rem;
      color: #64748b;
    }

    .log-description {
      margin: 6px 0;
      font-size: 0.84rem;
      color: #475569;
    }

    .log-details {
      margin: 0;
      padding-left: 18px;
      font-size: 0.82rem;
      color: #0f172a;
      line-height: 1.45;
      word-break: break-word;
    }
  `]
})
export class SessionLogsDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<SessionLogsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { sessions: SessionLogItem[] }
  ) {}

  relativeTime(date: Date): string {
    const diffMs = Date.now() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return new Date(date).toLocaleDateString();
  }

  close(): void {
    this.dialogRef.close();
  }
}




