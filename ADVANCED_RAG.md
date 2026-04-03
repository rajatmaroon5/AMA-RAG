# Advanced RAG Pipeline - Technical Documentation

## Overview

The AMA RAG Chatbot now includes sophisticated techniques for improving answer quality:

1. **Query Transformation** - Optimize user queries before retrieval
2. **Answer Grading** - Self-evaluate answer relevancy
3. **Smart Retry Logic** - Re-retrieve with adjusted parameters if needed
4. **Web Fallback** - Use web search when documents don't have the answer

## Architecture Diagram

```
User Question
    ↓
[Query Transformation Service]
    ├─ Query Expansion (synonyms, related terms)
    └─ Query Decomposition (break into sub-questions)
    ↓
[Multiple Query Attempts with Retry Loop]
    ├─ Attempt 1: Original + Expanded Queries
    ├─ Attempt 2: Reduced similarity threshold (if failed)
    └─ Attempt 3: Further relaxed parameters (if failed)
    ↓
[For Each Query Variant]
    ├─ Embed question
    ├─ Search Pinecone
    ├─ Retrieve chunks
    └─ Generate answer
    ↓
[Answer Grading Service]
    ├─ Evaluate groundedness (is answer from context?)
    ├─ Check relevancy to question
    ├─ Look for hallucinations
    └─ Return relevancy score (0.0-1.0)
    ↓
IF Score >= 0.6 (Threshold)
    → Return Answer with Grade
ELSE
    → Retry with Different Query
    → If all retries fail → Web Search Fallback
```

## Components

### 1. Query Transformation Service

**Purpose**: Improve query quality to get better retrieval results

**Techniques Implemented**:

#### a) Query Expansion
```csharp
Original: "How do I fix memory leaks?"
Expanded:
1. "Methods to resolve memory leaks"
2. "Memory leak debugging techniques"
3. "Memory management troubleshooting"
```

Uses OpenAI's language model to generate semantically similar queries.

#### b) Query Decomposition
```csharp
Original: "What is machine learning and how does deep learning work?"
Decomposed:
1. "What is machine learning?"
2. "How does deep learning work?"
```

Automatically detects conjunctions and breaks complex questions into simpler ones.

**Code Location**: `Services/QueryTransformationService.cs`

**Usage**:
```csharp
var transformedQueries = await _queryTransformationService.TransformQueryAsync(userQuestion);
```

### 2. Answer Grading Service

**Purpose**: Evaluate whether the LLM's answer is grounded in retrieved context

**Grading Criteria**:
- Is the answer actually from the provided context (not hallucinated)?
- Does it directly answer the user's question?
- Is the information accurate based on the context?
- Are there any contradictions?

**Output**: 
```json
{
  "relevancyScore": 0.85,      // 0.0 to 1.0
  "isRelevant": true,            // true if >= 0.6
  "reasoning": "Answer is well-grounded in context and directly addresses the question.",
  "issues": []
}
```

**Grading Prompt**: Uses lower temperature (0.3) for consistent, strict evaluation

**Code Location**: `Services/AnswerGradingService.cs`

**Threshold**: 0.6 (Moderate strictness)
- **>0.8**: Very high quality answer
- **0.6-0.8**: Good answer, acceptable
- **<0.6**: Requires retry or fallback

### 3. Web Search Service

**Purpose**: Fallback mechanism when documents don't have answers

**Implementation**: 
- Uses **DuckDuckGo API** (free, no API key required)
- Extracts instant answers and related topics
- Marks results clearly as "web search" not from documents

**Response Format**:
```json
{
  "usedWebSearch": true,
  "searchQuery": "original question",
  "disclaimer": "[⚠️ Web Search Result - Limited Knowledge, not from your documents]",
  "sources": [
    {
      "title": "Result Title",
      "url": "https://...",
      "snippet": "Relevant excerpt from result"
    }
  ]
}
```

**Code Location**: `Services/WebSearchService.cs`

### 4. Smart Retry Logic

**Flow**:
```
Attempt 1: Original + Expanded Queries (Similarity: 0.7)
  ↓ If fails
Attempt 2: Sub-questions with relaxed similarity (0.5)
  ↓ If fails  
Attempt 3: Further relaxed parameters, more chunks (0.3)
  ↓ If all fail
Fallback to Web Search
```

**Parameters Adjusted**:
- **Max Retries**: 2
- **Similarity Threshold Reduction**: -0.2 per retry
- **Max Chunks Increase**: +3 per retry

**Example**:
```
Attempt 1: threshold=0.7, maxChunks=5
Attempt 2: threshold=0.5, maxChunks=8
Attempt 3: threshold=0.3, maxChunks=11
```

## Data Flow

### Request Processing

```javascript
// User asks a question
ChatRequest {
  question: "How do I use transactions in databases?",
  maxContextChunks: 5,
  similarityThreshold: 0.7
}

// Response includes all pipeline steps
ChatResponse {
  answer: "...",
  retrievedChunks: [...],
  
  // New fields
  queryTransformation: {
    expandedQueries: [
      "Transaction usage in database systems",
      "Database transaction management"
    ],
    decomposedQuestions: [
      "How do I use transactions in databases?"
    ],
    transformationStrategy: "Query Expansion + Decomposition"
  },
  
  answerGrade: {
    relevancyScore: 0.82,
    isRelevant: true,
    reasoning: "Answer is grounded in context",
    issues: []
  },
  
  webSource: null,  // null if from documents
  
  retryCount: 0  // number of retries needed
}
```

## Configuration

### appsettings.json

```json
{
  "Embedding": {
    "Provider": "OpenAI"  // or "HuggingFace"
  },
  "OpenAI": {
    "ApiKey": "sk-..."  // Required for query expansion, answer grading
  }
}
```

### Service Registration (Program.cs)

```csharp
builder.Services.AddScoped<IQueryTransformationService, QueryTransformationService>();
builder.Services.AddScoped<IAnswerGradingService, AnswerGradingService>();
builder.Services.AddScoped<IWebSearchService, WebSearchService>();
builder.Services.AddScoped<IChatService, ChatService>();
```

## Performance Considerations

### Costs
- **Query Transformation**: ~50 tokens per question (OpenAI API call)
- **Answer Grading**: ~200 tokens per answer (OpenAI API call)
- **Web Search**: Free (DuckDuckGo)

### Latency
- Query Transformation: ~500ms
- Answer generation: ~1-2s
- Answer grading: ~500ms
- **Total per question**: ~2-3s (first attempt)
- **With retries**: +2-3s per attempt

### Optimization Tips
1. **Cache transformed queries** for similar questions
2. **Batch grade operations** if processing multiple answers
3. **Skip grading** for very obvious relevant answers (optional)
4. **Limit retries** based on user tolerance for latency

## Configuration Parameters

### Recommendation Profiles

#### Strict Mode (Production)
```json
{
  "MaxRetries": 3,
  "RelevancyThreshold": 0.7,
  "SimilarityThreshold": 0.75
}
```
Best for: High-accuracy requirements, important documents

#### Balanced Mode (Default)
```json
{
  "MaxRetries": 2,
  "RelevancyThreshold": 0.6,
  "SimilarityThreshold": 0.7
}
```
Best for: General use cases

#### Fast Mode (Real-time)
```json
{
  "MaxRetries": 0,
  "RelevancyThreshold": 0.5,
  "SimilarityThreshold": 0.65
}
```
Best for: Chat-like interactions needing quick responses

## Monitoring & Debugging

### Logging

All services log detailed information:

```
[INF] Query transformation completed. Original: 'How to debug?'. Expanded: 3. Sub-questions: 1
[INF] Answer graded. Question: 'How to debug?'. Score: 0.82. Relevant: PASS
[INF] Web search completed. Query: 'database transactions'. Results: 3. Success: True
[INF] Answer generated from attempt 1 with original query
```

### Metrics to Track

1. **Answer Relevancy Score**: Average score across all answers
2. **Retry Success Rate**: % of answers that needed retries vs succeeded
3. **Web Fallback Rate**: % of queries requiring web search
4. **Latency**: Response time for each stage
5. **Query Transformation Impact**: Better retrieval from transformed queries?

## Frontend Integration

The Angular UI displays all pipeline information:

1. **Query Optimization Section**
   - Shows expanded queries attempted
   - Shows decomposed questions
   - Displays transformation strategy used

2. **Answer Quality Card**
   - Relevancy score (visual bar)
   - Pass/fail badge
   - Detailed reasoning from grader
   - Issues identified

3. **Web Source Info** (if used)
   - Warning disclaimer
   - Source links
   - Snippets

4. **Retry Count**
   - Shows in subtitle if retries were needed

## Advanced Use Cases

### Case 1: Complex Multi-Part Question
```
Q: "What are transactions and ACID properties in databases?"
→ Decomposed into:
   1. "What are transactions in databases?"
   2. "What are ACID properties?"
→ Each answered separately and combined
```

### Case 2: Poorly Phrased Question
```
Q: "DB stuff with rollback thingies"
→ Expanded to:
   1. "Database rollback functionality"
   2. "Transaction rollback mechanisms"
   3. "How to rollback database changes"
→ Retrieved much better results
```

### Case 3: Documents Don't Have Answer
```
Q: "Latest AI developments in 2026"
→ Attempt 1-3: No relevant chunks found
→ Fallback to Web Search
→ Returns current web results with disclaimer
```

## Troubleshooting

### Issue: Always getting grading failures

**Solution**: Lower relevancy threshold or disable grading
```csharp
// In ChatService
private const double RELEVANCY_THRESHOLD = 0.5; // was 0.6
```

### Issue: Slow response times

**Solution**: 
1. Reduce max retries (set to 1)
2. Skip query transformation for simple queries
3. Use HuggingFace embeddings instead of OpenAI
4. Cache embedding results

### Issue: Web search results are poor

**Solution**:
1. Use more specific queries
2. Combine document answer with web search
3. Switch to different search provider if implementing

## Future Enhancements

- [ ] HyDE (Hypothetical Document Embeddings) for query transformation
- [ ] Multi-hop reasoning for complex questions
- [ ] Source attribution at chunk level
- [ ] Confidence scores for each step
- [ ] A/B testing framework for different strategies
- [ ] Fine-tuned grading model instead of prompt-based
- [ ] Local LLM option for grading (faster)
- [ ] Query caching and reuse
- [ ] Batch processing for multiple questions

## References

- [Query Expansion in IR](https://en.wikipedia.org/wiki/Query_expansion)
- [Hypothetical Document Embeddings (HyDE)](https://arxiv.org/abs/2212.10496)
- [Self-Grading LLMs](https://arxiv.org/abs/2310.18504)
- [DuckDuckGo API](https://duckduckgo.com/api)

---

**Last Updated**: March 2026
