export interface Document {
  id: string;
  name: string;
  uploadedAt: Date;
  isProcessed: boolean;
  chunkCount: number;
  errorMessage?: string;
}

export interface ChatRequest {
  question: string;
  maxContextChunks?: number;
  similarityThreshold?: number;
  temperature?: number;
  documentId?: string;
}

export interface ChatResponse {
  answer: string;
  retrievedChunks: RetrievedChunk[];
  model: string;
  tokensUsed: number;
  llmPrompt?: LlmPromptTrace;
  queryTransformation?: QueryTransformationInfo;
  answerGrade?: AnswerGradeInfo;
  webSource?: WebSourceInfo;
  retryCount: number;
  logs?: RagLogs;
}

export interface RagLogEntry {
  step: string;
  description: string;
  durationMs: number;
  timestamp: string;
  status: string;
  details: string[];
}

export interface RagLogs {
  entries: RagLogEntry[];
  totalDurationMs: number;
}

export interface LlmPromptTrace {
  provider: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  combinedPrompt: string;
  sentToLlm: boolean;
  notes: string;
}

export interface QueryTransformationInfo {
  expandedQueries: string[];
  decomposedQuestions: string[];
  transformationStrategy: string;
}

export interface AnswerGradeInfo {
  relevancyScore: number;
  isRelevant: boolean;
  reasoning: string;
  issues: string[];
}

export interface WebSourceInfo {
  usedWebSearch: boolean;
  searchQuery: string;
  sources: WebSourceReference[];
  disclaimer: string;
}

export interface WebSourceReference {
  title: string;
  url: string;
  snippet: string;
}

export interface RetrievedChunk {
  content: string;
  documentName: string;
  documentId: string;
  similarityScore: number;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  vectorId: string;
  createdAt: Date;
}

export interface UploadDocumentResponse {
  documentId: string;
  name: string;
  chunkCount: number;
  isProcessed: boolean;
  keyTopics: string[];
}
