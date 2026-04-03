namespace AmaRAGBackend.Services;

using AmaRAGBackend.Models;

/// <summary>
/// Service for document processing
/// </summary>
public interface IDocumentService
{
    Task<UploadDocumentResponse> UploadDocumentAsync(IFormFile file);
    Task<List<DocumentListResponse>> GetDocumentsAsync();
    Task<Document?> GetDocumentAsync(Guid documentId);
    Task DeleteDocumentAsync(Guid documentId);
    Task<List<DocumentChunk>> GetDocumentChunksAsync(Guid documentId);
}

/// <summary>
/// Service for generating embeddings
/// </summary>
public interface IEmbeddingService
{
    Task<float[]> GetEmbeddingAsync(string text, EmbeddingProvider provider = EmbeddingProvider.OpenAI);
    Task<List<float[]>> GetEmbeddingsAsync(List<string> texts, EmbeddingProvider provider = EmbeddingProvider.OpenAI);
}

/// <summary>
/// Service for Pinecone vector database operations
/// </summary>
public interface IPineconeService
{
    Task<List<RetrievedChunk>> SearchSimilarChunksAsync(float[] queryEmbedding, int topK = 5, double threshold = 0.7, Guid? documentId = null);
    Task UpsertVectorsAsync(List<VectorData> vectors);
    Task DeleteVectorAsync(string vectorId);
    Task DeleteVectorsByDocumentAsync(Guid documentId);
}

/// <summary>
/// Service for RAG chat functionality
/// </summary>
public interface IChatService
{
    Task<ChatResponse> GetAnswerAsync(ChatRequest request);
}

/// <summary>
/// Service for text chunking
/// </summary>
public interface IChunkingService
{
    List<string> ChunkText(string text, int chunkSize = 1000, int overlapSize = 100);
}

/// <summary>
/// Service for query transformation
/// </summary>
public interface IQueryTransformationService
{
    Task<QueryTransformationResult> TransformQueryAsync(string originalQuery);
}

/// <summary>
/// Service for answer grading
/// </summary>
public interface IAnswerGradingService
{
    Task<AnswerGradeResult> GradeAnswerAsync(string question, string answer, List<RetrievedChunk> context);
}

/// <summary>
/// Service for web search
/// </summary>
public interface IWebSearchService
{
    Task<WebSearchResult> SearchAsync(string query, int maxResults = 3);
}

/// <summary>
/// Service for fetching live weather data (backed by wttr.in, same as the MCP weather tools)
/// </summary>
public interface IWeatherMcpService
{
    Task<WeatherMcpResult> GetCurrentWeatherAsync(string location);
    Task<WeatherMcpResult> GetWeatherForecastAsync(string location, int days = 3);
}

/// <summary>
/// Service for calling Gmail MCP tools through a stdio bridge
/// </summary>
public interface IGmailMcpService
{
    Task<GmailMcpToolResult> GetUnreadEmailsAsync();
    Task<GmailMcpToolResult> ReadEmailAsync(string emailId);
    Task<GmailMcpToolResult> SendEmailAsync(string recipientId, string subject, string message);
    Task<GmailMcpToolResult> TrashEmailAsync(string emailId);
    Task<GmailMcpToolResult> MarkEmailAsReadAsync(string emailId);
}

/// <summary>
/// Generic response wrapper for Gmail MCP tool calls
/// </summary>
public class GmailMcpToolResult
{
    public bool Success { get; set; }
    public string ToolName { get; set; } = string.Empty;
    public string RawResponse { get; set; } = string.Empty;
    public string ErrorMessage { get; set; } = string.Empty;
}

/// <summary>
/// Embedding provider enum
/// </summary>
public enum EmbeddingProvider
{
    OpenAI,
    HuggingFace
}

/// <summary>
/// Vector data for Pinecone
/// </summary>
public class VectorData
{
    public string Id { get; set; } = string.Empty;
    public float[] Values { get; set; } = Array.Empty<float>();
    public Dictionary<string, string> Metadata { get; set; } = new();
}
