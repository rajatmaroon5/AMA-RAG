# Advanced RAG Configuration Guide

## Overview

This guide shows how to configure and fine-tune the advanced RAG pipeline for your specific use case.

## Configuration Profiles

### Profile 1: Accuracy-First (Production Documents)

Use when working with critical documents and accuracy is paramount.

**File**: `appsettings.json`
```json
{
  "Chat": {
    "MaxRetries": 3,
    "RelevancyThreshold": 0.75,
    "SimilarityThreshold": 0.8,
    "EnableQueryTransformation": true,
    "EnableAnswerGrading": true,
    "EnableWebFallback": false
  }
}
```

**Characteristics**:
- Strict grading (75% relevancy required)
- More retries (up to 3)
- High similarity threshold
- No web fallback (documents only)

**Best for**: Medical documents, legal documentation, financial data

### Profile 2: Balanced (Recommended Default)

Use for general-purpose RAG with good accuracy and reasonable latency.

```json
{
  "Chat": {
    "MaxRetries": 2,
    "RelevancyThreshold": 0.6,
    "SimilarityThreshold": 0.7,
    "EnableQueryTransformation": true,
    "EnableAnswerGrading": true,
    "EnableWebFallback": true
  }
}
```

**Characteristics**:
- Moderate grading (60% relevancy)
- 2 retries for poor answers
- Standard similarity threshold
- Web fallback enabled

**Best for**: Knowledge bases, blogs, general information

### Profile 3: Speed-Optimized (Real-time Chat)

Use for interactive chat where latency matters more than perfect accuracy.

```json
{
  "Chat": {
    "MaxRetries": 1,
    "RelevancyThreshold": 0.5,
    "SimilarityThreshold": 0.65,
    "EnableQueryTransformation": false,
    "EnableAnswerGrading": false,
    "EnableWebFallback": true
  }
}
```

**Characteristics**:
- Lenient grading (50% relevancy)
- Only 1 retry
- Relaxed similarity threshold
- No query transformation (saves time)
- No answer grading (saves time)

**Best for**: Chat interfaces, real-time support, customer service

### Profile 4: Exploration Mode (Research)

Use when exploring large document collections and want comprehensive answers.

```json
{
  "Chat": {
    "MaxRetries": 3,
    "RelevancyThreshold": 0.5,
    "SimilarityThreshold": 0.6,
    "EnableQueryTransformation": true,
    "EnableAnswerGrading": true,
    "EnableWebFallback": true,
    "MaxContextChunks": 10
  }
}
```

**Characteristics**:
- Low relevancy threshold (exploratory)
- More retries
- Relaxed similarity threshold
- Query transformation enabled
- Web fallback enabled
- More context chunks

**Best for**: Research, literature surveys, exploring new domains

## Advanced Tuning Parameters

### Query Transformation Settings

```csharp
// In QueryTransformationService
private const int EXPANSION_VARIATIONS = 3;  // Number of expanded queries
private const double EXPANSION_TEMPERATURE = 0.7;  // Creativity level
```

**Tuning Tips**:
- **Higher temperature** → More creative query variations (slower but broader)
- **More variations** → Better coverage but slower (and higher cost)
- **Disable for simple** → Skip transformation for single-word queries

### Answer Grading Settings

```csharp
// In AnswerGradingService
private const double RELEVANCY_THRESHOLD = 0.6;
private const double GRADING_TEMPERATURE = 0.3;  // Low = strict grading
```

**Tuning Tips**:
- **Lower threshold** → Accept more answers (faster, but lower quality)
- **Higher threshold** → Stricter grading (slower, but higher quality)
- **Lower temperature** → More consistent grading across queries

### Web Search Settings

```csharp
// In WebSearchService
private const int MAX_RESULTS = 3;  // Max results from search
```

**Tuning Tips**:
- **More results** → Better coverage, but slower
- **Fewer results** → Faster, but might miss relevant info

### Retry Logic Settings

```csharp
// In ChatService
private const int MAX_RETRIES = 2;
private const double SIMILARITY_REDUCTION = 0.2;  // Per retry
private const int MAX_CHUNKS_INCREASE = 3;  // Per retry
```

**Tuning Tips**:
- **More retries** → Better chance of finding answer (slower)
- **Larger reduction** → Bigger changes between retries (risk vs coverage)
- **More chunks** → Broader but slower retrieval

## Gradual Configuration Changes

### Step 1: Measure Baseline
```sql
-- Track these metrics for 1 week
SELECT 
  AVG(RelevancyScore) as AvgRelevancy,
  COUNT(*) FILTER (WHERE IsRelevant) as PassCount,
  COUNT(*) - COUNT(*) FILTER (WHERE IsRelevant) as FailCount,
  COUNT(CASE WHEN UsedWebFallback THEN 1 END) as WebFallbackCount,
  AVG(LatencyMs) as AvgLatency
FROM ChatResponses
WHERE CreatedAt >= NOW() - INTERVAL 7 DAY
```

### Step 2: Identify Issues
- **High web fallback rate** → Increase retries or lower similarity threshold
- **Slow responses** → Disable query transformation or reduce retries
- **Low relevancy scores** → Enable answer grading or increase similarity threshold
- **User complaints about wrong answers** → Increase relevancy threshold

### Step 3: Make Incremental Changes

**Example**: Too many web searches
```json
// Before
"MaxRetries": 1,
"SimilarityThreshold": 0.75

// After
"MaxRetries": 2,
"SimilarityThreshold": 0.65
```

### Step 4: Monitor Impact

```csharp
// Measure after changes
var metrics = new {
  RelevancyScore = responses.Average(r => r.AnswerGrade?.RelevancyScore ?? 0),
  WebFallbackRate = responses.Count(r => r.WebSource?.UsedWebSearch == true) / (double)responses.Count,
  AverageLatency = responses.Average(r => r.ExecutionTimeMs),
  UserSatisfaction = surveyResults.Average(s => s.Score)
};
```

## Environment-Specific Configuration

### Development
```json
{
  "Chat": {
    "MaxRetries": 2,
    "RelevancyThreshold": 0.5,
    "EnableQueryTransformation": true,
    "EnableAnswerGrading": true,
    "LogLevel": "Debug"
  }
}
```

### Staging
```json
{
  "Chat": {
    "MaxRetries": 2,
    "RelevancyThreshold": 0.6,
    "EnableQueryTransformation": true,
    "EnableAnswerGrading": true,
    "LogLevel": "Information"
  }
}
```

### Production
```json
{
  "Chat": {
    "MaxRetries": 2,
    "RelevancyThreshold": 0.65,
    "EnableQueryTransformation": true,
    "EnableAnswerGrading": true,
    "EnableCaching": true,
    "LogLevel": "Warning"
  }
}
```

## Cost Optimization

### Scenario 1: Reduce OpenAI API Costs

OpenAI charges per token. Here's how to reduce usage:

```json
{
  "Chat": {
    "EnableQueryTransformation": false,      // Save ~50 tokens per query
    "EnableAnswerGrading": false,             // Save ~200 tokens per answer
    "MaxContextChunks": 3,                    // Instead of 5
    "Embedding": "HuggingFace"                // Free alternative
  }
}
```

**Estimated Savings**: 75% reduction in OpenAI API usage

**Trade-off**: Slightly lower accuracy and no self-grading

### Scenario 2: Optimize for High Volume

When handling many queries, optimize latency and throughput:

```json
{
  "Chat": {
    "EnableQueryTransformation": false,
    "MaxRetries": 1,
    "SimilarityThreshold": 0.65,
    "ExecutionTimeout": "5000ms",
    "CacheEnabled": true,
    "CacheTTL": "3600s"
  }
}
```

## Monitoring Dashboard Metrics

Create dashboards to track:

```
Query Transformation:
  - Enabled: Yes/No
  - Avg Expansion Count: X
  - Decomposition Success Rate: X%

Answer Grading:
  - Enabled: Yes/No
  - Avg Relevancy Score: 0.XX
  - Pass Rate (>0.6): XX%
  - Fail Rate requiring retries: XX%

Retry Logic:
  - Rate needing retries: XX%
  - Success after retry: XX%
  - Avg retries: X.X

Web Fallback:
  - Fallback rate: XX%
  - Avg web search result quality: X/10
  - Users satisfied with web results: XX%

Overall:
  - Avg latency: XXXms
  - API cost per query: $X.XX
  - Upstream service errors: X%
  - User satisfaction: X/10
```

## Troubleshooting Configuration Issues

### "Answers taking too long (>5s)"
```json
{
  "EnableQueryTransformation": false,
  "MaxRetries": 1,
  "ExecutionTimeout": "4000ms",
  "SimilarityThreshold": 0.65
}
```

### "Too many web searches"
```json
{
  "MaxRetries": 3,
  "SimilarityThreshold": 0.5,
  "RelevancyThreshold": 0.4
}
```

### "Answers often wrong or hallucinated"
```json
{
  "RelevancyThreshold": 0.8,
  "EnableAnswerGrading": true,
  "MaxRetries": 3,
  "GradingTemperature": 0.2
}
```

### "OpenAI API costs too high"
```json
{
  "EnableQueryTransformation": false,
  "EnableAnswerGrading": false,
  "Embedding": "HuggingFace",
  "MaxContextChunks": 3
}
```

## A/B Testing Framework

```csharp
// Run two configurations in parallel and compare
public class ABTestConfig {
  public string ControlProfile = "Balanced";
  public string TreatmentProfile = "AccuracyFirst";
  public int SampleSize = 100;
}

// Track metrics for comparison
var metrics = new {
  GroupA = new {
    AvgRelevancy = 0.65,
    AvgLatency = 2500,
    WebFallbackRate = 0.15,
    UserSatisfaction = 4.2
  },
  GroupB = new {
    AvgRelevancy = 0.72,
    AvgLatency = 3200,
    WebFallbackRate = 0.08,
    UserSatisfaction = 4.6
  }
}
```

---

**Last Updated**: March 2026
