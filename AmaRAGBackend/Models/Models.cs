namespace AmaRAGBackend.Models;

/// <summary>
/// Represents a document uploaded to the system
/// </summary>
public class Document
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public DateTime UploadedAt { get; set; }
    public string FilePath { get; set; } = string.Empty;
    public bool IsProcessed { get; set; }
    public int ChunkCount { get; set; }
    public string? ErrorMessage { get; set; }
}

/// <summary>
/// Represents a chunk of text extracted from a document
/// </summary>
public class DocumentChunk
{
    public Guid Id { get; set; }
    public Guid DocumentId { get; set; }
    public string Content { get; set; } = string.Empty;
    public int ChunkIndex { get; set; }
    public string? VectorId { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// Request model for uploading documents
/// </summary>
public class UploadDocumentRequest
{
    public required IFormFile File { get; set; }
    public string? Description { get; set; }
}

/// <summary>
/// Request model for chat/question
/// </summary>
public class ChatRequest
{
    public string Question { get; set; } = string.Empty;
    public int MaxContextChunks { get; set; } = 5;
    public double SimilarityThreshold { get; set; } = 0.5;
    public double Temperature { get; set; } = 0.7;
    public Guid? DocumentId { get; set; }
}

/// <summary>
/// Response model for chat
/// </summary>
public class ChatResponse
{
    public string Answer { get; set; } = string.Empty;
    public List<RetrievedChunk> RetrievedChunks { get; set; } = new();
    public string Model { get; set; } = string.Empty;
    public int TokensUsed { get; set; }
    public LlmPromptTrace? LlmPrompt { get; set; }
    
    // Advanced RAG features
    public QueryTransformationInfo? QueryTransformation { get; set; }
    public AnswerGradeInfo? AnswerGrade { get; set; }
    public WebSourceInfo? WebSource { get; set; }
    public int RetryCount { get; set; }
    
    // Detailed execution logs
    public RagLogs? Logs { get; set; }
}

/// <summary>
/// Exact prompt payload used for LLM generation.
/// Useful for test diagnostics and prompt inspection.
/// </summary>
public class LlmPromptTrace
{
    public string Provider { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string SystemPrompt { get; set; } = string.Empty;
    public string UserPrompt { get; set; } = string.Empty;
    public string CombinedPrompt { get; set; } = string.Empty;
    public bool SentToLlm { get; set; }
    public string Notes { get; set; } = string.Empty;
}

/// <summary>
/// Query transformation details shown to user
/// </summary>
public class QueryTransformationInfo
{
    public List<string> ExpandedQueries { get; set; } = new();
    public List<string> DecomposedQuestions { get; set; } = new();
    public string TransformationStrategy { get; set; } = string.Empty;
}

/// <summary>
/// Answer grading details
/// </summary>
public class AnswerGradeInfo
{
    public double RelevancyScore { get; set; }
    public bool IsRelevant { get; set; }
    public string Reasoning { get; set; } = string.Empty;
    public List<string> Issues { get; set; } = new();
}

/// <summary>
/// Web source information when fallback is used
/// </summary>
public class WebSourceInfo
{
    public bool UsedWebSearch { get; set; }
    public string SearchQuery { get; set; } = string.Empty;
    public List<WebSourceReference> Sources { get; set; } = new();
    public string Disclaimer { get; set; } = "[⚠️ Web Search Result - Limited Knowledge] ";
}

/// <summary>
/// Individual web source reference
/// </summary>
public class WebSourceReference
{
    public string Title { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string Snippet { get; set; } = string.Empty;
}

/// <summary>
/// Represents a chunk retrieved by semantic search
/// </summary>
public class RetrievedChunk
{
    public string Content { get; set; } = string.Empty;
    public string DocumentName { get; set; } = string.Empty;
    public Guid DocumentId { get; set; }
    public double SimilarityScore { get; set; }
}

/// <summary>
/// Response model for document upload
/// </summary>
public class UploadDocumentResponse
{
    public Guid DocumentId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int ChunkCount { get; set; }
    public bool IsProcessed { get; set; }
    public List<string> KeyTopics { get; set; } = new();
}

/// <summary>
/// Response model for document list
/// </summary>
public class DocumentListResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime UploadedAt { get; set; }
    public bool IsProcessed { get; set; }
    public int ChunkCount { get; set; }
    public string? ErrorMessage { get; set; }
}

/// <summary>
/// Represents a single step in the RAG pipeline with timing information
/// </summary>
public class RagLogEntry
{
    public string Step { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public long DurationMs { get; set; }
    public DateTime Timestamp { get; set; }
    public string Status { get; set; } = "Success"; // "Success", "Warning", "Error"
    public List<string> Details { get; set; } = new();
}

/// <summary>
/// Complete RAG pipeline execution logs
/// </summary>
public class RagLogs
{
    public List<RagLogEntry> Entries { get; set; } = new();
    public long TotalDurationMs { get; set; }
    
    public void AddEntry(RagLogEntry entry)
    {
        Entries.Add(entry);
    }
}
