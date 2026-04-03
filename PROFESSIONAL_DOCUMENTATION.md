# AMA RAG CHATBOT
## Professional Project Documentation

**Version**: 3.0  
**Date**: March 2026  
**Project Status**: Complete with Phase 3 Integration  
**Document Classification**: Technical & User Documentation

---

## TABLE OF CONTENTS

1. Executive Summary
2. Project Objectives
3. Technical Architecture
4. Technologies & Stack
5. Advanced Techniques
6. System Workflows & Flowcharts
7. Database Design
8. User Interface Wireframes
9. User Guide - Using the Chatbot
10. API Reference
11. Configuration Guide
12. Deployment Instructions
13. Troubleshooting & Support

---

## 1. EXECUTIVE SUMMARY

### Project Overview

The AMA RAG Chatbot is an enterprise-grade Retrieval-Augmented Generation (RAG) application designed to answer user questions based on uploaded documents. By combining document analysis, semantic search, and advanced language models, the system provides accurate, context-aware answers with source attribution.

### Key Capabilities

- **Document Management**: Upload, store, and manage PDF and DOCX documents
- **Intelligent Retrieval**: Semantic search using vector embeddings
- **Query Intelligence**: Automatic query optimization and expansion
- **Answer Quality**: Self-grading mechanism with relevancy scoring
- **Fallback Mechanisms**: Web search integration when document knowledge is insufficient
- **Local Deployment**: Full on-premises deployment with SharePoint integration
- **Change Detection**: Automatic sync with change tracking using ETags

### Business Value

- Reduces document search time through semantic understanding
- Improves answer accuracy through multi-layered quality checks
- Enables enterprise document governance via SharePoint integration
- Maintains data privacy with local deployment option
- Reduces manual knowledge base maintenance

---

## 2. PROJECT OBJECTIVES

### Primary Objectives

1. **Enable Rapid Question Answering**
   - Users can ask natural language questions about uploaded documents
   - System retrieves relevant information and generates contextual answers
   - Responses include source citations for verification

2. **Ensure Answer Quality**
   - Implement self-grading to identify hallucinations
   - Use retry logic to find better answers if initial retrieval fails
   - Provide relevancy scoring for transparency

3. **Support Enterprise Deployment**
   - Integrate with SharePoint for document governance
   - Local deployment capability for data privacy
   - Change detection to prevent duplicate processing
   - Audit trail for compliance and troubleshooting

4. **Provide Superior User Experience**
   - Intuitive web interface with Material Design
   - Real-time progress indicators during processing
   - Clear presentation of answer quality and sources
   - Multi-tab interface for different workflows

### Success Metrics

- Average response time: < 5 seconds for question answering
- Answer accuracy: > 90% for in-document questions
- System availability: > 99.5% uptime
- User adoption: Minimal training required
- Scalability: Support for 1000+ documents and concurrent users

---

## 3. TECHNICAL ARCHITECTURE

### System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT TIER                              │
│                     Angular 17 Web Application                   │
│  ┌───────────────────┬────────────────┬──────────────────────┐  │
│  │ Upload Component  │ Chat Component │ Sync Component       │  │
│  │                   │                │ (SharePoint)         │  │
│  └─────────┬─────────┴────────┬───────┴──────────┬───────────┘  │
│            │                  │                  │                │
└────────────┼──────────────────┼──────────────────┼────────────────┘
             │                  │                  │
             ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API GATEWAY & MIDDLEWARE                      │
│              CORS • Authentication • Error Handling              │
└────┬────────────────────┬─────────────────────┬──────────────────┘
     │                    │                      │
     ▼                    ▼                      ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ DOCUMENT         │ │ CHAT             │ │ SYNC             │
│ ENDPOINTS        │ │ ENDPOINTS        │ │ ENDPOINTS        │
│                  │ │                  │ │                  │
│ • Upload         │ │ • Ask Question   │ │ • Start Sync     │
│ • List           │ │                  │ │ • Check Status   │
│ • Get            │ │                  │ │ • Get History    │
│ • Delete         │ │                  │ │ • Retry Failed   │
└────┬──────────────┘ └────┬─────────────┘ └────┬──────────────┘
     │                     │                     │
     ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BUSINESS LOGIC LAYER                        │
│                  (.NET Core Services)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  DocumentService         ChatService        SyncPipelineService │
│  ├─ Upload/Extract       ├─ Query Transform ├─ List Files      │
│  ├─ Parse PDF/DOCX       ├─ Retrieve Chunks ├─ Download        │
│  └─ Manage Metadata      ├─ Grade Answers   └─ Track Changes    │
│                          └─ Web Fallback                        │
│                                                                   │
│  EmbeddingService        QueryTransform     SharePointService   │
│  ├─ OpenAI Embeddings    ├─ Query Expansion │                   │
│  ├─ HuggingFace Alt      └─ Decomposition   │                   │
│  └─ Fallback Logic                          │                   │
│                                                                   │
│  ChunkingService         AnswerGrading      SyncStatusTracker   │
│  ├─ Text Splitting       ├─ Relevancy Score │                   │
│  └─ Overlap Strategy     └─ Issue Detection │                   │
│                                                                   │
│  PineconeService         WebSearchService                       │
│  ├─ Vector Search        └─ DuckDuckGo API                      │
│  ├─ Upsert               └─ Result Parsing                      │
│  └─ Delete                                                       │
│                                                                   │
└────┬─────────┬────────────────┬──────────────┬──────────────────┘
     │         │                │              │
     ▼         ▼                ▼              ▼
┌──────────────────┐ ┌──────────────────┐ ┌────────────────────┐
│ EXTERNAL APIs    │ │ DATA STORAGE     │ │ SYNC STORAGE       │
├──────────────────┤ ├──────────────────┤ ├────────────────────┤
│                  │ │                  │ │                    │
│ OpenAI           │ │ Pinecone Vector  │ │ SQLite Local DB    │
│ • Embeddings     │ │ Database         │ │                    │
│ • Chat/GPT       │ │ • Stores vectors │ │ • DocumentSync     │
│ • Text-to-vector │ │ • Semantic search│ │ • SyncJob History  │
│                  │ │ • Cosine sim     │ │ • Audit Trail      │
│ HuggingFace      │ │                  │ │                    │
│ (Alternative)    │ │                  │ │                    │
│                  │ │                  │ │                    │
│ SharePoint       │ │                  │ │                    │
│ • File Download  │ │                  │ │                    │
│ • Folder Browse  │ │                  │ │                    │
│                  │ │                  │ │                    │
│ DuckDuckGo       │ │                  │ │                    │
│ • Web Search     │ │                  │ │                    │
│                  │ │                  │ │                    │
└──────────────────┘ └──────────────────┘ └────────────────────┘
```

### Layered Architecture

#### **Data Layer**
- **Pinecone**: Cloud vector database for embeddings
- **SQLite**: Local database for sync state and audit logs
- **SharePoint**: Enterprise document source

#### **Service Layer**
Eight specialized services handle different aspects:

| Service | Responsibility |
|---------|-----------------|
| **DocumentService** | File upload, parsing, lifecycle management |
| **ChunkingService** | Text splitting with overlap |
| **EmbeddingService** | Vector generation (OpenAI/HuggingFace) |
| **PineconeService** | Vector database operations |
| **ChatService** | RAG orchestration and answer generation |
| **QueryTransformationService** | Query optimization |
| **AnswerGradingService** | Answer quality validation |
| **SharePointService** | SharePoint integration |
| **SyncPipelineService** | Document synchronization |
| **WebSearchService** | Web search fallback |

#### **API Layer**
RESTful endpoints following minimal API pattern:
- Document management endpoints
- Chat interaction endpoints
- Sync control endpoints

#### **Presentation Layer**
Angular 17 standalone components with Material Design:
- **DocumentUploadComponent** - Drag-drop file upload
- **ChatComponent** - Question answering interface
- **DocumentListComponent** - Document management view
- **SyncComponent** - SharePoint synchronization control

---

## 4. TECHNOLOGIES & STACK

### Backend Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Framework** | ASP.NET Core | 8.0 | Web API foundation |
| **API Pattern** | Minimal APIs | Built-in | Lightweight routing |
| **Logging** | Serilog | Latest | Structured logging |
| **Database ORM** | Entity Framework Core | 8.0 | Data access & migrations |
| **Database** | SQLite | Latest | Local persistence |
| **Document Parsing** | iTextSharp | Latest | PDF extraction |
| **Document Parsing** | OpenXML SDK | Latest | DOCX processing |
| **HTTP Client** | HttpClient | Built-in | External API calls |

### Frontend Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Framework** | Angular | 17 | SPA framework |
| **Language** | TypeScript | Latest | Type-safe JavaScript |
| **Component Model** | Standalone | 17+ | Module-free architecture |
| **UI Library** | Angular Material | Latest | Component library |
| **State** | RxJS Observables | Latest | Reactive programming |
| **Forms** | Reactive Forms | Built-in | Form handling |
| **HTTP** | HttpClient | Built-in | API communication |
| **Build** | Webpack | Latest | Module bundling |

### External Services

| Service | Purpose | Fallback |
|---------|---------|----------|
| **OpenAI GPT-3.5/4** | LLM for answer generation | N/A (primary) |
| **OpenAI Embeddings** | Text to vector conversion | HuggingFace |
| **Pinecone** | Vector database | N/A (primary) |
| **HuggingFace** | Alternative embeddings | N/A (fallback) |
| **SharePoint Online** | Enterprise documents | Local uploads |
| **DuckDuckGo** | Web search fallback | N/A (fallback) |

### Development Tools

- **SDK**: .NET 8.0 SDK
- **Runtime**: .NET Runtime 8.0
- **Node.js**: 16+ for Angular
- **npm**: 7+ for dependencies
- **IDE**: Visual Studio 2022 / VS Code
- **Containerization**: Docker (optional)
- **Database Admin**: DB Browser for SQLite

### NuGet Packages (Key Dependencies)

```xml
<!-- API & Web -->
<PackageReference Include="Serilog.AspNetCore" />

<!-- Data Access -->
<PackageReference Include="Microsoft.EntityFrameworkCore.Sqlite" />
<PackageReference Include="Microsoft.EntityFrameworkCore.Tools" />

<!-- Document Processing -->
<PackageReference Include="iTextSharp" />
<PackageReference Include="DocumentFormat.OpenXml" />

<!-- SharePoint Integration -->
<PackageReference Include="PnP.Core" />
<PackageReference Include="Microsoft.SharePointOnline.CSOM" />

<!-- Background Jobs -->
<PackageReference Include="Hangfire.Core" />
<PackageReference Include="Hangfire.Sqlite" />
<PackageReference Include="Hangfire.AspNetCore" />
```

---

## 5. ADVANCED TECHNIQUES

### 5.1 Query Transformation

**Objective**: Improve retrieval by optimizing user queries

**Techniques**:

#### Query Expansion
Generates alternative phrasings of the user's question:

```
User Input: "How do I fix memory leaks?"

Generated Variations:
1. "Methods to resolve memory leaks"
2. "Memory leak debugging techniques"
3. "Memory management troubleshooting strategies"
4. "Resolving memory leak issues"
5. "How to identify and fix memory leaks"
```

**Algorithm**:
- Uses OpenAI to generate semantically similar queries
- Maintains semantic meaning while varying phrasing
- Generates 3-5 variations
- Increases chance of finding relevant chunks

#### Query Decomposition
Breaks complex questions into simpler sub-questions:

```
User Input: "What is machine learning and how does deep learning work?"

Decomposed Queries:
1. "What is machine learning?"
2. "How does deep learning work?"
3. "Relationship between machine learning and deep learning"
```

**Algorithm**:
- Detects conjunctions (AND, OR, but, while, etc.)
- Uses regex patterns to split at logical boundaries
- Creates sub-questions for each component
- Searches each independently for comprehensive coverage

**Code Implementation**:
```csharp
// Query transformation orchestration
var transformedQueries = await _queryTransformationService.TransformQueryAsync(question);
// Result includes:
// - Original query
// - Expanded variations
// - Decomposed sub-questions
```

### 5.2 Answer Grading & Validation

**Objective**: Ensure answers are grounded in retrieved context (prevent hallucinations)

**Grading Criteria**:

| Criterion | Definition | Weight |
|-----------|-----------|--------|
| **Groundedness** | Is answer supported by context? | 40% |
| **Relevancy** | Does answer address the question? | 40% |
| **Accuracy** | Are facts correct per context? | 15% |
| **Completeness** | Does it cover key aspects? | 5% |

**Scoring**:
- Score Range: 0.0 to 1.0
- Threshold for "Good Answer": ≥ 0.6
- Below threshold triggers retry logic

**Grading Prompt Example**:
```
Evaluate if the provided answer is grounded in the context and 
answers the question accurately:

Question: [USER_QUESTION]
Context: [RETRIEVED_CHUNKS]
Answer: [GENERATED_ANSWER]

Provide:
1. Relevancy score (0.0-1.0)
2. Is it relevant? (true/false)
3. Reasoning (1-2 sentences)
4. Any issues detected
```

**Implementation**:
- Uses low temperature (0.3) for strict evaluation
- Explicit prompt engineering for consistency
- Regex parsing of structured response
- Logging for analysis

### 5.3 Intelligent Retry Logic

**Objective**: Improve answer quality through progressive relaxation of search parameters

**Retry Strategy**:

```
Attempt 1: Strict Parameters
├─ Similarity Threshold: 0.7
├─ Top K Chunks: 5
└─ Queries: Original + Expanded

        ↓ (If score < 0.6)

Attempt 2: Relaxed Parameters
├─ Similarity Threshold: 0.5
├─ Top K Chunks: 7
└─ Queries: Decomposed

        ↓ (If score < 0.6)

Attempt 3: Very Relaxed
├─ Similarity Threshold: 0.3
├─ Top K Chunks: 10
└─ Queries: All variations combined

        ↓ (If score < 0.6)

Web Search Fallback
└─ DuckDuckGo integration
```

**Configuration Profiles**:

| Profile | Threshold | Retries | Web Fallback | Use Case |
|---------|-----------|---------|--------------|----------|
| **Accuracy-First** | 0.75 | 3 | No | Production docs |
| **Balanced** | 0.6 | 2 | Yes | General use |
| **Speed-Optimized** | 0.5 | 1 | No | Chat interactions |
| **Exploration** | 0.5 | 3 | Yes | Research mode |

### 5.4 Web Search Fallback

**Objective**: Provide answers from web when document knowledge insufficient

**Integration**:
- **Provider**: DuckDuckGo (free, no API key required)
- **Trigger**: When document search returns score < 0.6 after retries
- **De-duplication**: Removes duplicate results
- **Attribution**: Clearly marks web sources

**Result Format**:
```json
{
  "source": "web",
  "disclaimer": "This answer is from web search, not from uploaded documents",
  "results": [
    {
      "title": "Result Title",
      "url": "https://...",
      "snippet": "Result excerpt..."
    }
  ]
}
```

### 5.5 Change Detection & Incremental Sync

**Objective**: Avoid re-processing unchanged files

**Mechanism**: ETag Comparison

```
First Sync:
┌──────────────┐
│ File: doc.pdf│
│ ETag: "abc123"
├──────────────┤
│ Extract text │
│ Create chunks│
│ Generate emb │
│ Store in DB  │
└──────────────┘
      ↓
[Store ETag in DocumentSync table]

Subsequent Syncs:
┌──────────────────────────────────┐
│ Check SharePoint file ETag       │
├──────────────────────────────────┤
│ Compare with stored ETag         │
├──────────────────────────────────┤
│ IF same: SKIP                    │
│ IF different: RE-PROCESS         │
└──────────────────────────────────┘
```

**Efficiency Gains**:
- Skip 80-95% of files in incremental syncs
- Reduces API costs (OpenAI, Pinecone)
- Faster sync operations
- Bandwidth savings from SharePoint

---

## 6. SYSTEM WORKFLOWS & FLOWCHARTS

### 6.1 Document Upload Workflow

```
┌─────────────────────┐
│  User Uploads File  │
│  (PDF or DOCX)      │
└────────┬────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Validation                       │
├─────────────────────────────────┤
│ • File type check (PDF/DOCX)     │
│ • File size limit (50 MB)        │
│ • Virus scanning (optional)      │
└────────┬────────────────────────┘
         │
    ✓    │    ✗ Rejected
         │    (User notified)
         ▼
┌─────────────────────────────────┐
│ Save File                        │
│ └─ /uploads directory           │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Extract Text                     │
├─────────────────────────────────┤
│ • PDF → iTextSharp              │
│ • DOCX → OpenXml SDK            │
│ • Preserves formatting           │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Create Chunks                    │
├─────────────────────────────────┤
│ • Size: 1000 characters         │
│ • Overlap: 100 characters       │
│ • Preserves context              │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Generate Embeddings             │
├─────────────────────────────────┤
│ • Provider: OpenAI (primary)     │
│ • Fallback: HuggingFace          │
│ • Dimensions: 1536 or 384        │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Store in Pinecone               │
├─────────────────────────────────┤
│ • Metadata: file, chunk ID,      │
│   timestamp, source              │
│ • Vector index: cosine distance  │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Success Response                │
├─────────────────────────────────┤
│ {                               │
│   "id": "doc123",               │
│   "filename": "document.pdf",    │
│   "chunks": 45,                 │
│   "status": "Ready"              │
│ }                               │
└─────────────────────────────────┘
```

**Processing Time**: 2-30 seconds (depends on file size)

### 6.2 Chat Question Answering Workflow

```
┌────────────────────────────┐
│ User Enters Question       │
│ + Optional Settings        │
│ • Max chunks: 5            │
│ • Threshold: 0.7           │
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Query Transformation       │
├────────────────────────────┤
│ • Expansion (3-5 variants) │
│ • Decomposition (if needed)│
│ • 1-2 seconds              │
└────────┬───────────────────┘
         │
         ▼
   ┌─────────────────────────────────────────┐
   │         RETRY LOOP (Up to 3 times)      │
   │                                         │
   │  ┌──────────────────────────────────┐   │
   │  │ Attempt N                        │   │
   │  ├──────────────────────────────────┤   │
   │  │ • Embed all query variants       │   │
   │  │ • Search Pinecone               │   │
   │  │ • Retrieve top K chunks         │   │
   │  │ • Generate answer with OpenAI   │   │
   │  │ • Grade answer (0-1.0 score)    │   │
   │  │ • Time: 2-5 seconds              │   │
   │  └────────────┬─────────────────────┘   │
   │              │                         │
   │         Score >= 0.6?                 │
   │         /           \                 │
   │       YES             NO               │
   │       │               │                │
   │       ▼               ▼                │
   │   [RETURN]      Relax Params          │
   │   (Score: High) (Threshold↓,          │
   │               K↑, Variants)            │
   │                                        │
   │       (Next Attempt)                   │
   └─────────────────────────────────────────┘
              │
              ▼
         Score >= 0.6? (Final check)
         /              \
       YES              NO
       │                │
       ▼                ▼
   ┌────────────┐  ┌──────────────────────┐
   │ Return     │  │ Web Search Fallback   │
   │ Answer     │  ├──────────────────────┤
   │ with:      │  │ • Query DuckDuckGo   │
   │ • Text     │  │ • Get snippets       │
   │ • Score    │  │ • Compile results    │
   │ • Sources  │  │ • Add disclaimer     │
   │ • Grade    │  └──────────────────────┘
   │ • Retries  │           │
   └────────────┘           │
       │                     │
       │◄────────────────────┘
       │
       ▼
   ┌──────────────────────┐
   │ Response to User:    │
   │ {                    │
   │  "answer": "...",    │
   │  "score": 0.85,      │
   │  "sources": [...],   │
   │  "retries": 1        │
   │ }                    │
   └──────────────────────┘
```

**Total Response Time**: 3-10 seconds (including all retries)

### 6.3 SharePoint Sync Workflow

```
┌───────────────────────────────┐
│ User Triggers Sync            │
│ (Default or Custom Folder)    │
└────────┬──────────────────────┘
         │
         ▼
┌───────────────────────────────┐
│ Create Sync Job Record        │
│ • Job ID: GUID                │
│ • Start Time: Now             │
│ • Status: Running             │
└────────┬──────────────────────┘
         │
         ▼
┌───────────────────────────────┐
│ Connect to SharePoint         │
│ • Auth: Username/Password     │
│ • List Files in Folder        │
│ • Get ETag, Size, ModDate     │
└────────┬──────────────────────┘
         │
         ▼
┌───────────────────────────────┐
│ For Each File                 │
│ (Parallel Processing)         │
└────────┬──────────────────────┘
         │
         ▼
   ┌─────────────────────────────┐
   │ Check if Already Synced     │
   ├─────────────────────────────┤
   │ Query: DocumentSync table    │
   │ Match: SharePointItemId      │
   └────────┬────────────────────┘
            │
       Has Record?
       /         \
      YES        NO
      │           │
      ▼           ▼
   ┌─────────┐  ┌──────────────────────┐
   │ Compare │  │ New File             │
   │ ETags   │  ├──────────────────────┤
   │         │  │ • Download from SP   │
   │  Same?  │  │ • Extract text       │
   │ /   \   │  │ • Create chunks      │
   │Y     N  │  │ • Generate embedding │
   ││      │ │  │ • Store in Pinecone  │
   ││      │ │  │ • Update DocumentSync│
   ││      │ │  │ • Mark: Synced       │
   ││      │ └──────────────────────┘
   ││      │
   │▼      ▼
   │┌─────────────┐
   ││ Skip File   │  [Modified File]
   ││ • Status:   │  ├─ Re-download
   ││   Synced    │  ├─ Re-process
   ││ • Skipped++ │  ├─ Update Embedding
   │└─────────────┘  ├─ Update Status
   │                 └─ Modified++
   └─────────────────────────────┘
         │
         ▼ (Loop continues for all files)
         │
         ▼
┌───────────────────────────────┐
│ Complete Sync Job             │
├───────────────────────────────┤
│ • End Time: Now               │
│ • Status: Completed           │
│ • Stats:                      │
│   - FilesProcessed: N         │
│   - FilesSuccessful: M        │
│   - FilesFailed: X            │
│   - FilesSkipped: Y           │
└────────┬──────────────────────┘
         │
         ▼
┌───────────────────────────────┐
│ Update SyncJob Record         │
│ + Return Status to UI         │
│ • Display summary             │
│ • Show errors (if any)        │
│ • Allow retry of failures     │
└───────────────────────────────┘
```

**Sync Time**: 1 minute - several hours (depends on folder size and file counts)

---

## 7. DATABASE DESIGN

### 7.1 Data Model

#### DocumentSync Table
Tracks SharePoint files for change detection:

```
DocumentSync
├─ Id (GUID, Primary Key)
├─ SharePointItemId (String) [Index]
├─ FileName (String)
├─ RelativePath (String)
├─ Status (Enum: Pending, Processing, Synced, Failed, Modified)
├─ DocumentId (GUID, FK to Pinecone document)
├─ ETag (String) - For change detection
├─ FileSizeBytes (Long)
├─ CreatedAt (DateTime)
├─ LastSyncedAt (DateTime)
├─ ModifiedDateUtc (DateTime)
├─ LastError (String, nullable)
└─ ChunkCount (Integer)
```

**Purpose**: 
- Prevents duplicate processing via ETag comparison
- Tracks sync status for each file
- Maintains audit trail of modifications

#### SyncJob Table
Audit trail for sync operations:

```
SyncJob
├─ Id (GUID, Primary Key)
├─ FolderPath (String)
├─ JobType (String: FullSync, IncrementalSync)
├─ Status (Enum: Running, Completed, Failed, Cancelled)
├─ StartedAt (DateTime)
├─ CompletedAt (DateTime, nullable)
├─ FilesProcessed (Integer)
├─ FilesSuccessful (Integer)
├─ FilesFailed (Integer)
├─ FilesSkipped (Integer)
├─ Duration (TimeSpan, calculated)
└─ ErrorLog (String, nullable)
```

**Purpose**:
- Complete audit trail for compliance
- Performance metrics for optimization
- Error tracking for troubleshooting
- Historical trending

### 7.2 Database Schema Diagram

```
┌──────────────────────────────────────┐
│         DocumentSync                 │
├──────────────────────────────────────┤
│ PK: Id (GUID)                        │
│ UK: SharePointItemId + FolderPath    │
├──────────────────────────────────────┤
│ SharePointItemId      String (IX)    │
│ FileName              String         │
│ RelativePath          String         │
│ SharePointUrl         String         │
│ Status                Enum (1)        │──┐
│ DocumentId (FK)       GUID           │  │
│ ETag                  String         │  │
│ FileSizeBytes         Long           │  │
│ ModifiedDateUtc       DateTime       │  │
│ CreatedAt             DateTime (2)   │  │
│ LastSyncedAt          DateTime       │  │
│ LastError             String?        │  │
│ ChunkCount            Integer        │  │
└──────────────────────────────────────┘  │
                                          │
┌──────────────────────────────────────┐  │
│         SyncJob                      │  │
├──────────────────────────────────────┤  │
│ PK: Id (GUID)                        │  │
├──────────────────────────────────────┤  │
│ FolderPath            String         │  │
│ JobType               String         │  │
│ Status                Enum           │  │
│ StartedAt             DateTime (IX)  │  │
│ CompletedAt           DateTime       │  │
│ FilesProcessed        Integer        │  │
│ FilesSuccessful       Integer        │  │
│ FilesFailed           Integer        │  │
│ FilesSkipped          Integer        │  │
│ ErrorLog              String?        │  │
└──────────────────────────────────────┘  │
                                          │
(1) SyncStatus Enum Values:               │
    • Pending (0)                        │
    • Processing (1)                     │
    • Synced (2)                         │
    • Failed (3)                         │
    • Modified (4)                       │
                                          │
(2) Automatically set by database          │
    on record creation                    │
                                          │
External References:                      │
  DocumentId → Pinecone Vector Store ────┘
  (No FK constraint - Pinecone is cloud)
```

### 7.3 Pinecone Vector Store Schema

**Index Name**: ama-rag-index

**Vector Configuration**:
- **Dimension**: 1536 (OpenAI) or 384 (HuggingFace)
- **Metric**: Cosine Distance
- **Cloud Provider**: Pinecone Serverless

**Stored Metadata** (per vector):
```json
{
  "id": "doc123-chunk-45",
  "values": [0.123, 0.456, ...1536 dimensions],
  "metadata": {
    "document_id": "doc123",
    "filename": "document.pdf",
    "chunk_index": 45,
    "chunk_text": "First 50 chars of chunk...",
    "timestamp": "2026-03-28T10:30:00Z",
    "source": "manual_upload|sharepoint_sync|web_search",
    "embedding_model": "text-embedding-3-small",
    "language": "en",
    "tokens": 150
  }
}
```

---

## 8. USER INTERFACE WIREFRAMES

### 8.1 Main Application Layout

```
┌───────────────────────────────────────────────────────────────┐
│                         AMA RAG CHATBOT                       │
│                 Document-Based Question Answering             │
├───────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ [Upload] [Chat] [Documents] [SharePoint Sync]          │   │
│ └─────────────────────────────────────────────────────────┘   │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│                     [TAB CONTENT AREA]                        │
│                                                               │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 8.2 Upload Documents Tab

```
┌─────────────────────────────────────────────────────┐
│ UPLOAD DOCUMENTS                                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │                                               │ │
│  │      📁 Drag and drop files here              │ │
│  │         or click to browse                    │ │
│  │                                               │ │
│  │  Supported: PDF, DOCX (Max 50 MB)            │ │
│  │                                               │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌────────────────────────────────────────────────┐ │
│  │ Selected Files:                                 │ │
│  ├────────────────────────────────────────────────┤ │
│  │ ☑ document1.pdf (2.5 MB)                      │ │
│  │ ☑ document2.docx (1.2 MB)                     │ │
│  │ ☑ document3.pdf (4.8 MB)                      │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  [ Cancel ]  [ Upload ]                            │
│                                                     │
│  ┌────────────────────────────────────────────────┐ │
│  │ Upload Progress:                                │ │
│  │ document1.pdf: ████████████░░ 85% - 2 seconds  │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 8.3 Chat Tab

```
┌──────────────────────────────────────────────────────┐
│ CHAT                                           [⚙️]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  📋 Query Optimization                              │
│  ├─ Original Query: "What is X?"                    │
│  ├─ Expanded Queries:                               │
│  │  • "Define X"                                    │
│  │  • "Explanation of X"                            │
│  └─ Decomposed: "What" → "X"                        │
│                                                      │
│  ───────────────────────────────────────────────────│
│                                                      │
│  💭 Answer:                                         │
│  │ The answer is... [full answer text]             │
│  │                                                  │
│  │ Source 1: document.pdf - Page 5                 │
│  │ Source 2: guide.docx - Section 3.2              │
│                                                      │
│  ───────────────────────────────────────────────────│
│                                                      │
│  ✅ Answer Quality Assessment                       │
│  ├─ Score: 0.87/1.0 (High Relevancy) [████████░░] │
│  ├─ Groundedness: Well-supported by context         │
│  └─ Retries: 1                                      │
│                                                      │
│  ───────────────────────────────────────────────────│
│                                                      │
│  🌐 Web Search Results (if applicable)              │
│  ├─ Source: DuckDuckGo (Not from documents)         │
│  └─ Result snippet with link                        │
│                                                      │
│  ───────────────────────────────────────────────────│
│                                                      │
│  Question: ┌──────────────────────────────────────┐ │
│            │ Ask your question here...            │ │
│            │                                      │ │
│            │ Max chunks: [5] Threshold: [0.7]    │ │
│            └──────────────────────────────────────┘ │
│            [ Ask ]                                  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 8.4 Documents Tab

```
┌─────────────────────────────────────────────────────┐
│ DOCUMENTS                                    [🔄]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Search: ┌─────────────────────────────────────┐   │
│         │ 🔍 Filter documents...              │   │
│         └─────────────────────────────────────┘   │
│                                                     │
│ ┌────────────────────────────────────────────────┐ │
│ │ Document Name      │ Type │ Chunks │ Date      │ │
│ ├────────────────────────────────────────────────┤ │
│ │ document1.pdf      │ PDF  │  45    │ 3/25/26   │ │
│ │   Synced: Yes (SP) │      │        │ (Synced)  │ │
│ │ [View] [Delete]    │      │        │           │ │
│ ├────────────────────────────────────────────────┤ │
│ │ guide.docx         │ DOCX │  23    │ 3/22/26   │ │
│ │   Uploaded: Manual │      │        │           │ │
│ │ [View] [Delete]    │      │        │           │ │
│ ├────────────────────────────────────────────────┤ │
│ │ report.pdf         │ PDF  │  89    │ 3/20/26   │ │
│ │   Synced: Yes (SP) │      │        │ (Synced)  │ │
│ │ [View] [Delete]    │      │        │           │ │
│ └────────────────────────────────────────────────┘ │
│                                                     │
│ Total: 3 documents | 157 chunks                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 8.5 SharePoint Sync Tab

```
┌───────────────────────────────────────────────────┐
│ SHAREPOINT SYNC                                   │
├───────────────────────────────────────────────────┤
│                                                   │
│ [Custom Sync] [Default Sync] [History]          │
│                                                   │
│ ┌─────────────────────────────────────────────┐  │
│ │ CUSTOM FOLDER SYNC                          │  │
│ ├─────────────────────────────────────────────┤  │
│ │                                             │  │
│ │ Folder Path:                                │  │
│ │ ┌─────────────────────────────────────────┐ │  │
│ │ │ /sites/team/Shared Documents/RAG Docs   │ │  │
│ │ └─────────────────────────────────────────┘ │  │
│ │                                             │  │
│ │ [ Start Sync ]                              │  │
│ │                                             │  │
│ └─────────────────────────────────────────────┘  │
│                                                   │
│ ┌─────────────────────────────────────────────┐  │
│ │ SYNC IN PROGRESS 🔄                         │  │
│ ├─────────────────────────────────────────────┤  │
│ │                                             │  │
│ │ Status: Running                             │  │
│ │ Files Discovered: 42                        │  │
│ │ Files Processed: 28                         │  │
│ │ Files Failed: 2                             │  │
│ │ Files Skipped: 12                           │  │
│ │                                             │  │
│ │ Progress: 66.7% ████████░░                  │  │
│ │                                             │  │
│ │ ⚠️ Errors:                                  │  │
│ │ • file1.pdf: Corrupted file                 │  │
│ │ • file2.docx: Read timeout                  │  │
│ │                                             │  │
│ │ [ Retry Failed Documents ]                  │  │
│ │                                             │  │
│ └─────────────────────────────────────────────┘  │
│                                                   │
│ ┌─────────────────────────────────────────────┐  │
│ │ SYNC HISTORY                                │  │
│ ├─────────────────────────────────────────────┤  │
│ │ [  ] Completed   3/28/2026 10:30 - 10:45   │  │
│ │      ✓ 42 successful  ✗ 2 failed           │  │
│ │ [  ] Completed   3/28/2026 09:00 - 09:15   │  │
│ │      ✓ 38 successful  ✗ 0 failed           │  │
│ │ [  ] Failed      3/27/2026 08:30 - 08:32   │  │
│ │      ✗ 0 successful  ✗ 5 failed            │  │
│ │      Error: Network timeout                 │  │
│ └─────────────────────────────────────────────┘  │
│                                                   │
└───────────────────────────────────────────────────┘
```

---

## 9. USER GUIDE - USING THE CHATBOT

### 9.1 Getting Started

#### First Time Setup

1. **Access the Application**
   - Open browser
   - Navigate to `http://localhost:4200`
   - You should see the AMA RAG Chatbot homepage

2. **Verify All Components Working**
   - Check all 4 tabs are visible:
     - ✓ Upload Documents
     - ✓ Chat
     - ✓ Documents
     - ✓ SharePoint Sync
   - If any tab is missing or shows errors, check backend connection

### 9.2 Uploading Documents

#### Step-by-Step Process

**Tab: Upload Documents**

1. **Prepare Files**
   - Supported formats: PDF, DOCX
   - Maximum file size: 50 MB per file
   - Multiple files can be uploaded at once

2. **Upload Method A: Drag & Drop**
   - Drag files from File Explorer
   - Drop into the designated area
   - Files will start uploading automatically

3. **Upload Method B: Browse**
   - Click anywhere in the upload area
   - Select files from file picker
   - Confirm selection

4. **Monitor Progress**
   - Progress bar shows upload status
   - File name and percentage displayed
   - Time remaining estimate shown

5. **Verification**
   - Success message appears
   - Document appears in "Documents" tab
   - Status shows as "Ready"

#### Common Issues

| Issue | Solution |
|-------|----------|
| File too large | Compress PDF or convert images to lower quality |
| Unsupported format | Ensure file is PDF or DOCX (not PNG, JPG, etc.) |
| Upload fails | Check network connection, try again |
| Server error | Verify backend is running (`dotnet run`) |

### 9.3 Asking Questions

#### Tab: Chat

**Basic Question**

1. **Type Your Question**
   - Click in the text area at bottom
   - Type your question in natural language
   - Examples:
     - "What is the main topic of the document?"
     - "How do I use feature X?"
     - "Summarize the key points"

2. **Configure (Optional)**
   - **Max Chunks**: Number of document sections to retrieve
     - Default: 5
     - Range: 1-20
     - Higher = more context, slower response
   - **Similarity Threshold**: 0.0 to 1.0
     - Default: 0.7
     - Higher = stricter matching, fewer results
     - Lower = more loose matching

3. **Submit Question**
   - Click "Ask" button
   - Or press Enter key
   - System begins processing

4. **View Response**

   **Query Optimization Section**:
   - Shows original question
   - Lists expanded query variations
   - Shows decomposed sub-questions
   - Indicates queries used in search

   **Answer Section**:
   - Full text answer to your question
   - Source citations with document name and page/section
   - Click sources to view document

   **Quality Assessment**:
   - Relevancy score (0.0-1.0)
   - Quality indicator (Low/Medium/High)
   - Color-coded: Red (Low), Orange (Medium), Green (High)
   - Shows how many retries were needed

   **Web Results** (if applicable):
   - Appears if document knowledge insufficient
   - Clearly marked as "from web search"
   - Disclaimer about external sources

#### Advanced Question Techniques

**Technique 1: Multi-Part Questions**
- System automatically decomposes complex questions
- Each part is searched independently
- Results are compiled for comprehensive answer
- Example: "What is feature X and how does it work?"

**Technique 2: Refinement Questions**
- Ask follow-up questions to narrow down
- System maintains context
- Example:
  1. "What is X?" → Answer provided
  2. "How is it implemented?" → System understands context

**Technique 3: Specific Knowledge Requests**
- Ask for specific types of information
- Examples:
  - "Give me step-by-step instructions for..."
  - "Compare X and Y from the documents"
  - "What are the advantages of..."

#### Understanding the Response Quality Score

```
Score Range | Rating | Meaning | Action
──────────────────────────────────────────────────────
0.9 - 1.0   │ High   │ Answer is well-grounded in  │ Accept
            │        │ documents, likely accurate  │ answer
──────────────────────────────────────────────────────
0.7 - 0.89  │ Med    │ Answer is mostly accurate,  │ Accept
            │        │ minor uncertainties         │ but verify
──────────────────────────────────────────────────────
0.5 - 0.69  │ Low    │ Answer has gaps or missing  │ Cross-
            │        │ context, questionable       │ reference
──────────────────────────────────────────────────────
< 0.5       │ Very   │ Answer may not be grounded  │ Don't
            │ Low    │ in documents, questionable  │ rely on
```

### 9.4 Managing Documents

#### Tab: Documents

**View All Uploaded Documents**

1. **Document List**
   - Shows all documents in your system
   - Columns: Name, Type, Chunks Count, Upload Date
   - Source indicator (Manual Upload vs SharePoint Sync)

2. **Search/Filter**
   - Type in search box to filter by name
   - Case-insensitive search
   - Real-time filtering

3. **Document Actions**

   **View Document**
   - Click "View" button
   - Opens document in new window
   - View original PDF/DOCX

   **Delete Document**
   - Click "Delete" button
   - Confirmation dialog appears
   - Document removed from system
   - Embeddings removed from Pinecone
   - Local records updated

4. **Document Statistics**
   - Total documents count
   - Total chunks across all documents
   - Storage usage estimate

#### Document Lifecycle

```
Upload → Processing → Ready → Searchable → (Optional) Delete

States:
├─ Processing: Extracting, chunking, embedding
├─ Ready: Available for search
├─ Error: Failed during processing
└─ Archived: Marked for deletion (queued)
```

### 9.5 SharePoint Synchronization

#### Tab: SharePoint Sync

**Prerequisites**
- SharePoint Online access
- SharePoint folder URL
- Service account credentials (or use your account)
- Documents folder must contain PDF/DOCX files

**Option 1: Sync Default Folder**

1. Click "Default Folder Sync" tab
2. System uses folder configured in backend
3. Click "Start Default Sync"
4. Monitor progress in status section

**Option 2: Sync Custom Folder**

1. Click "Custom Folder Sync" tab
2. Enter SharePoint folder path
   - Example: `/sites/MyTeam/Shared Documents/RAG Docs`
   - Full URL format: `https://tenant.sharepoint.com/sites/site/Shared Documents/Folder`
   - How to find: Navigate to folder in SharePoint, copy URL, extract path
3. Click "Start Sync"
4. Monitor progress

**Monitor Sync Progress**

```
Sync Status Display:
├─ Status: Running / Completed / Failed
├─ Files Discovered: Total files found
├─ Files Processed: Completed processing
├─ Files Failed: Errors encountered
├─ Files Skipped: Unchanged (already synced)
├─ Progress: Percentage bar
└─ Errors: List of any failures
```

**After Sync Completes**

1. **Check Results**
   - View "Sync History" tab
   - Successful documents appear in "Documents" tab
   - Ask questions about newly synced documents

2. **Handle Failures**
   - If some files failed:
     - Review error messages
     - Fix issues (e.g., corrupted files)
     - Click "Retry Failed Documents"
     - Run sync again

3. **Incremental Syncs**
   - Subsequent syncs only process changed files
   - Saves time and API costs
   - Uses ETag for change detection

**Sync History**

1. Click "Sync History" tab
2. View past sync operations
3. For each sync:
   - Completion status
   - Date and time
   - Duration
   - File counts (successful, failed, skipped)
   - Error messages if any
4. Click refresh to reload

#### Finding SharePoint Folder Path

**Method 1: From Browser URL**
1. Open SharePoint in browser
2. Navigate to desired folder
3. URL appears: `https://tenant.sharepoint.com/:f:/s/sitename/Folder`
4. Extract path: `/sites/sitename/Shared Documents/Folder`

**Method 2: From Folder Properties**
1. Right-click folder in SharePoint
2. Select "Details"
3. Copy relative path

**Method 3: Full Folder URL**
1. Right-click folder
2. Select "Share"
3. Copy full URL
4. Extract server-relative path

**Example Paths**
- `/sites/Engineering/Shared Documents/Technical Docs`
- `/sites/HR/Shared Documents/Policies and Procedures`
- `/sites/Sales/Shared Documents/Customer Contracts`

### 9.6 Troubleshooting User Issues

#### Issue: No Results for My Question

**Possible Causes**:
1. Document doesn't contain relevant information
2. Question phrased differently than document language
3. Similarity threshold too high

**Solutions**:
- Try rephrasing question
- Lower similarity threshold (set to 0.5)
- Upload additional documents
- Check if documents uploaded successfully
- Look for answer in web search results (if available)

#### Issue: Low Quality Score

**Possible Causes**:
1. Answer not well-supported by document text
2. System generated partially correct answer
3. Question requires external knowledge

**Solutions**:
- Refine your question to be more specific
- Upload additional related documents
- Check web search results
- Ask a simpler follow-up question
- Verify document contains the information

#### Issue: Upload Failed

**Check**:
- [ ] File is PDF or DOCX format
- [ ] File size < 50 MB
- [ ] File not corrupted (open in PDF reader first)
- [ ] Internet connection active
- [ ] Backend server running

**Resolution**:
- Check browser console (F12) for error details
- Try uploading again
- Contact support if persists

#### Issue: Sync Not Starting

**Check**:
- [ ] SharePoint folder path is correct
- [ ] Service account has read access
- [ ] Network can reach SharePoint
- [ ] Backend server running

**Test Connection**:
- Check for test connection endpoint in Settings
- Verify SharePoint credentials are correct

---

## 10. API REFERENCE

### 10.1 Base URL

```
Production:  https://yourdomain.com/api/v1
Development: https://localhost:5000/api/v1
```

All requests should include:
- Content-Type: application/json
- No authentication currently required (enable in production)

### 10.2 Document Endpoints

#### Upload Document
```
POST /documents/upload
Content-Type: multipart/form-data

Request:
  file: (binary) PDF or DOCX file

Response (200 OK):
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "document.pdf",
  "fileSize": 2500000,
  "uploadedAt": "2026-03-28T10:30:00Z",
  "status": "Processing",
  "chunks": 0
}

Response (400 Bad Request):
{
  "error": "File type not supported. Only PDF and DOCX allowed."
}

Response (413 Payload Too Large):
{
  "error": "File exceeds maximum size of 50 MB."
}
```

#### List Documents
```
GET /documents

Response (200 OK):
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "filename": "document.pdf",
    "fileSize": 2500000,
    "uploadedAt": "2026-03-28T10:30:00Z",
    "status": "Ready",
    "chunks": 45,
    "chunkSize": 1000,
    "source": "manual_upload"
  },
  ...
]
```

#### Get Document
```
GET /documents/{id}

Response (200 OK):
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "document.pdf",
  "content": "Document text content...",
  "chunks": [
    {
      "index": 0,
      "text": "Chunk 0 content...",
      "tokens": 150
    },
    ...
  ]
}

Response (404 Not Found):
{
  "error": "Document not found"
}
```

#### Delete Document
```
DELETE /documents/{id}

Response (200 OK):
{
  "success": true,
  "message": "Document deleted successfully"
}

Response (404 Not Found):
{
  "error": "Document not found"
}
```

### 10.3 Chat Endpoints

#### Ask Question
```
POST /chat/ask
Content-Type: application/json

Request:
{
  "question": "What is the main topic of the document?",
  "maxContextChunks": 5,
  "similarityThreshold": 0.7,
  "profile": "balanced"
}

Query Parameters (optional):
  profile: accuracy-first | balanced | speed-optimized | exploration
           (default: balanced)

Response (200 OK):
{
  "question": "What is the main topic?",
  "answer": "The main topic is...",
  "relevancyScore": 0.85,
  "isRelevant": true,
  "sources": [
    {
      "documentId": "550e8400-e29b-41d4-a716-446655440000",
      "filename": "document.pdf",
      "chunkIndex": 5,
      "similarity": 0.92,
      "text": "Source chunk text..."
    },
    ...
  ],
  "queryTransformationInfo": {
    "originalQuery": "What is the main topic?",
    "expandedQueries": [
      "Main subject of document",
      "Primary topic discussed"
    ],
    "decomposedQueries": []
  },
  "answerGradeInfo": {
    "relevancyScore": 0.85,
    "reasoning": "Answer is well-grounded in context",
    "issues": []
  },
  "webSourceInfo": null,
  "retryCount": 0,
  "processingTimeMs": 4523
}

Response (200 OK) - With Web Search:
{
  "answer": "...",
  "sources": [...],
  "webSourceInfo": {
    "source": "web",
    "disclaimer": "This answer includes web search results",
    "results": [
      {
        "title": "Result Title",
        "url": "https://example.com",
        "snippet": "Result excerpt..."
      }
    ]
  },
  ...
}

Response (400 Bad Request):
{
  "error": "Question cannot be empty"
}

Response (500 Internal Server Error):
{
  "error": "Error processing question",
  "details": "No documents available for search"
}
```

### 10.4 Sync Endpoints

#### Start Sync (Default Folder)
```
POST /sync/start

Response (202 Accepted):
{
  "syncJobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "Running",
  "message": "Sync started",
  "startedAt": "2026-03-28T10:30:00Z"
}
```

#### Start Sync (Custom Folder)
```
POST /sync/start/{folderPath}

Parameters:
  folderPath: URL-encoded SharePoint folder path
              Example: %2Fsites%2FMyTeam%2FShared%20Documents%2FRAG%20Docs

Response (202 Accepted):
{
  "syncJobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "Running",
  "message": "Sync started",
  "startedAt": "2026-03-28T10:30:00Z"
}
```

#### Get Sync Status
```
GET /sync/status/{jobId}

Response (200 OK) - Running:
{
  "syncJobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "Running",
  "filesDiscovered": 42,
  "filesProcessed": 28,
  "filesFailed": 2,
  "filesSkipped": 12,
  "startedAt": "2026-03-28T10:30:00Z",
  "completedAt": null,
  "errorMessage": null,
  "progressPercentage": 66.7
}

Response (200 OK) - Completed:
{
  "syncJobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "Completed",
  "filesDiscovered": 42,
  "filesProcessed": 42,
  "filesFailed": 0,
  "filesSkipped": 0,
  "startedAt": "2026-03-28T10:30:00Z",
  "completedAt": "2026-03-28T10:45:00Z",
  "errorMessage": null,
  "progressPercentage": 100.0
}

Response (404 Not Found):
{
  "error": "Sync job not found"
}
```

#### Get Sync History
```
GET /sync/history?limit=50

Query Parameters (optional):
  limit: Number of records to return (1-1000, default 50)

Response (200 OK):
[
  {
    "syncJobId": "550e8400-e29b-41d4-a716-446655440000",
    "startedAt": "2026-03-28T10:30:00Z",
    "completedAt": "2026-03-28T10:45:00Z",
    "filesProcessed": 42,
    "filesSuccessful": 40,
    "filesFailed": 2,
    "filesSkipped": 0,
    "status": "Completed",
    "notes": null
  },
  ...
]
```

#### Retry Failed Documents
```
POST /sync/retry

Response (200 OK):
{
  "message": "Failed documents marked for retry",
  "count": 3
}
```

### 10.5 Error Handling

**Standard Error Response Format**:
```json
{
  "error": "Error message",
  "details": "Additional details (optional)",
  "code": "ERROR_CODE (optional)",
  "timestamp": "2026-03-28T10:30:00Z"
}
```

**Common HTTP Status Codes**:

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | Successful request |
| 202 | Accepted | Async job accepted (e.g., sync started) |
| 400 | Bad Request | Invalid parameters |
| 404 | Not Found | Resource doesn't exist |
| 413 | Payload Too Large | File too large |
| 500 | Internal Error | Server error |
| 503 | Service Error | External service unavailable (OpenAI, Pinecone) |

---

## 11. CONFIGURATION GUIDE

### 11.1 Backend Configuration (appsettings.json)

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  
  "AllowedHosts": "*",
  
  // SQLite Local Database
  "ConnectionStrings": {
    "DefaultConnection": "Data Source=amaRAG.db"
  },
  
  // SharePoint Configuration
  "SharePoint": {
    "SiteUrl": "https://yourtenant.sharepoint.com/sites/yoursite",
    "DocumentFolderPath": "/sites/yoursite/Shared Documents/RAG Documents",
    "Username": "your-username@yourtenant.onmicrosoft.com",
    "Password": "your-password"
  },
  
  // OpenAI Configuration
  "OpenAI": {
    "ApiKey": "sk-...",
    "Model": "gpt-3.5-turbo",
    "EmbeddingModel": "text-embedding-3-small",
    "MaxTokens": 2000,
    "Temperature": 0.7
  },
  
  // HuggingFace Configuration (Fallback)
  "HuggingFace": {
    "ApiKey": "hf_...",
    "Model": "sentence-transformers/all-MiniLM-L6-v2"
  },
  
  // Pinecone Configuration
  "Pinecone": {
    "ApiKey": "your-pinecone-api-key",
    "Environment": "us-east1-aws",
    "IndexName": "ama-rag-index",
    "TopK": 5,
    "SimilarityThreshold": 0.7
  },
  
  // Embedding Service
  "Embedding": {
    "Provider": "OpenAI",  // or "HuggingFace"
    "ChunkSize": 1000,
    "ChunkOverlap": 100,
    "BatchSize": 10
  },
  
  // File Upload
  "Upload": {
    "Directory": "uploads",
    "MaxFileSizeMB": 50,
    "AllowedExtensions": [".pdf", ".docx"]
  },
  
  // RAG Parameters
  "RAG": {
    "DefaultProfile": "balanced",  // accuracy-first, balanced, speed-optimized, exploration
    "MaxRetries": 2,
    "DefaultSimilarityThreshold": 0.7,
    "DefaultMaxChunks": 5,
    "EnableWebFallback": true
  },
  
  // Logging
  "Serilog": {
    "MinimumLevel": "Information",
    "WriteTo": [
      {
        "Name": "Console"
      },
      {
        "Name": "File",
        "Args": {
          "path": "logs/app-.txt",
          "rollingInterval": "Day",
          "fileSizeLimitBytes": 31457280,
          "retainedFileCountLimit": 30
        }
      }
    ]
  }
}
```

### 11.2 Configuration Profiles

#### Accuracy-First Profile
```json
{
  "similarity_threshold": 0.75,
  "max_retries": 3,
  "max_chunks": 7,
  "enable_web_fallback": false,
  "use_case": "Production documents where accuracy is critical"
}
```

#### Balanced Profile (Default)
```json
{
  "similarity_threshold": 0.6,
  "max_retries": 2,
  "max_chunks": 5,
  "enable_web_fallback": true,
  "use_case": "General purpose Q&A"
}
```

#### Speed-Optimized Profile
```json
{
  "similarity_threshold": 0.5,
  "max_retries": 1,
  "max_chunks": 3,
  "enable_web_fallback": false,
  "use_case": "Interactive chat, quick responses"
}
```

#### Exploration Profile
```json
{
  "similarity_threshold": 0.5,
  "max_retries": 3,
  "max_chunks": 10,
  "enable_web_fallback": true,
  "use_case": "Research mode, finding all relevant information"
}
```

### 11.3 Environment Variables

For sensitive configuration, use environment variables:

```bash
# OpenAI
export OPENAI_API_KEY=sk-...

# Pinecone
export PINECONE_API_KEY=...
export PINECONE_ENVIRONMENT=us-east1-aws
export PINECONE_INDEX_NAME=ama-rag-index

# SharePoint
export SHAREPOINT_SITE_URL=https://...
export SHAREPOINT_USERNAME=...
export SHAREPOINT_PASSWORD=...

# Database
export CONNECTION_STRING=Data Source=amaRAG.db

# Application
export ASPNETCORE_ENVIRONMENT=Production
export ASPNETCORE_URLS=https://0.0.0.0:5000
```

---

## 12. DEPLOYMENT INSTRUCTIONS

### 12.1 Local Development Deployment

**Prerequisites**:
- .NET 8.0 SDK
- Node.js 16+
- npm or yarn
- Internet connection (for API keys)

**Backend Setup**:
```powershell
cd AmaRAGBackend

# Restore packages
dotnet restore

# Build
dotnet build

# Run (creates database automatically)
dotnet run
# Backend available at: https://localhost:5000
```

**Frontend Setup**:
```powershell
cd AmaRAGUI

# Install dependencies
npm install

# Start development server
ng serve
# Frontend available at: http://localhost:4200
```

**Access Application**:
```
http://localhost:4200
```

### 12.2 Production Deployment (Azure)

**Backend (App Service)**:
```bash
# Create resource group
az group create --name amara-rg --location eastus

# Create App Service Plan
az appservice plan create --name amara-plan --resource-group amara-rg --sku B2

# Create App Service
az webapp create --resource-group amara-rg --plan amara-plan --name amara-backend

# Deploy
cd AmaRAGBackend
dotnet publish -c Release
# Upload to App Service
```

**Frontend (Static Web Apps)**:
```bash
# Create Static Web App
az staticwebapp create --name amara-frontend \
  --resource-group amara-rg \
  --location eastus \
  --source /AmaRAGUI \
  --branch main
```

**Database (CosmosDB for Pinecone integration)**:
```bash
az cosmosdb create --resource-group amara-rg \
  --name amara-db \
  --kind GlobalDocumentDB
```

### 12.3 Docker Deployment

**Dockerfile (Backend)**:
```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/runtime:8.0
WORKDIR /app
COPY --from=build /app .
EXPOSE 5000
CMD ["dotnet", "AmaRAGBackend.dll"]
```

**Build and Run**:
```bash
docker build -t amara-backend .
docker run -p 5000:5000 -e OPENAI_API_KEY=sk-... amara-backend
```

### 12.4 Scaling Considerations

**For 1K-10K Documents**:
- Single App Service (B2-B3)
- Standard Pinecone tier
- SQLite acceptable

**For 10K-100K+ Documents**:
- App Service Plan: Standard (S1-S2)
- Pinecone: Production tier
- Upgrade to SQL Server
- Add caching layer (Redis)
- Enable CDN for frontend

**Monitoring**:
- Application Insights
- Log Analytics
- Pinecone metrics
- Database performance

---

## 13. TROUBLESHOOTING & SUPPORT

### 13.1 Common Issues

#### Backend Won't Start

**Error**: "Failed to bind to address"
- **Solution**: Port 5000 already in use
  ```
  taskkill /PID {process_id} /F
  # Or change port in launchSettings.json
  ```

**Error**: "Connection to OpenAI failed"
- **Check**:
  - [ ] API key is correct
  - [ ] Network can reach openai.com
  - [ ] API key has sufficient quota
- **Solution**: Verify credentials in appsettings.json

**Error**: "Pinecone index not found"
- **Check**:
  - [ ] Index exists in Pinecone
  - [ ] Index name matches appsettings.json
  - [ ] API key has access
- **Solution**: Create index or update configuration

#### Frontend Won't Load

**Error**: "Cannot GET /"
- **Solution**: Frontend server not running
  ```
  cd AmaRAGUI
  ng serve
  ```

**Error**: "CORS error in console"
- **Check**:
  - [ ] Backend CORS configured for localhost:4200
  - [ ] Backend running on correct port
- **Solution**: Update CORS in Program.cs

#### Document Upload Fails

**Error**: "File type not supported"
- **Solution**: Upload only PDF or DOCX files

**Error**: "413 Payload Too Large"
- **Solution**: File exceeds 50 MB limit
  - Compress images in PDF
  - Split large documents
  - Upload separately

#### Chat Returns No Results

**Cause**: Documents don't contain relevant information

**Debug Steps**:
1. Check documents uploaded successfully (Documents tab)
2. Lower similarity threshold (try 0.5)
3. Increase max chunks (try 10)
4. Rephrase question differently
5. Upload additional documents

#### SharePoint Sync Fails

**Error**: "SharePoint connection test failed"
- **Check**:
  - [ ] Username format: `user@tenant.onmicrosoft.com`
  - [ ] Password is correct
  - [ ] Account has read access to folder
  - [ ] Network can reach SharePoint
- **Solution**: Verify credentials in appsettings.json

**Error**: "0 files found"
- **Check**:
  - [ ] Folder path is correct
  - [ ] Folder contains PDF/DOCX files
  - [ ] Service account has permission
- **Solution**: Verify folder path and permissions

### 13.2 Logs and Debugging

**Backend Logs**:
```
Location: /AmaRAGBackend/logs/
File pattern: app-YYYY-MM-DD.txt
Open latest file to see recent errors
```

**Frontend Logs**:
```
Browser Console (F12)
Network Tab (F12 → Network tab)
Check for CORS or 404 errors
```

**Enable Debug Logging**:
```json
{
  "Serilog": {
    "MinimumLevel": "Debug"
  }
}
```

### 13.3 Performance Optimization

**Improve Response Time**:
1. Reduce max chunks (5 to 3)
2. Increase similarity threshold (0.7 to 0.8)
3. Use speed-optimized profile
4. Cache frequently asked questions

**Reduce API Costs**:
1. Use HuggingFace embeddings (free)
2. Batch embedding requests
3. Implement caching layer
4. Limit retry attempts

**Database Optimization**:
1. Index optimization
2. Archive old documents
3. Migrate to SQL Server for scale
4. Implement incremental syncs only

### 13.4 Getting Help

**Resources**:
- Check documentation in `/docs` directory
- Review API reference above
- Check logs for detailed error messages
- Test individual components (API endpoints)

**Support Channels**:
- GitHub Issues (if applicable)
- Email support
- Documentation wiki
- Community forums

---

## APPENDIX A: QUICK REFERENCE

### Quick Start Commands

```bash
# Backend
cd AmaRAGBackend && dotnet run

# Frontend
cd AmaRAGUI && ng serve

# Access
http://localhost:4200

# Swagger API Docs
https://localhost:5000/swagger
```

### Key Configuration Items

| Setting | Location | Purpose |
|---------|----------|---------|
| OpenAI API Key | appsettings.json | LLM and embeddings |
| Pinecone Key | appsettings.json | Vector database |
| SharePoint Creds | appsettings.json | Document sync |
| Database | amaRAG.db | Local persistence |

### Default Ports

| Component | Port | URL |
|-----------|------|-----|
| Backend | 5000 | https://localhost:5000 |
| Frontend | 4200 | http://localhost:4200 |
| Database | N/A | amaRAG.db (file-based) |

---

**Document Version**: 3.0  
**Last Updated**: March 2026  
**Project Status**: Production Ready  
**Confidentiality**: Internal Use
