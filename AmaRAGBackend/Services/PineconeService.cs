namespace AmaRAGBackend.Services;

using AmaRAGBackend.Models;

/// <summary>
/// Implementation of Pinecone service
/// </summary>
public class PineconeService : IPineconeService
{
    private readonly ILogger<PineconeService> _logger;
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public PineconeService(ILogger<PineconeService> logger, HttpClient httpClient, IConfiguration configuration)
    {
        _logger = logger;
        _httpClient = httpClient;
        _configuration = configuration;
    }

    public async Task<List<RetrievedChunk>> SearchSimilarChunksAsync(float[] queryEmbedding, int topK = 5, double threshold = 0.7, Guid? documentId = null)
    {
        try
        {
            var apiKey = _configuration["Pinecone:ApiKey"];
            var environment = _configuration["Pinecone:Environment"];
            var indexName = _configuration["Pinecone:IndexName"];

            if (string.IsNullOrEmpty(apiKey) || string.IsNullOrEmpty(environment) || string.IsNullOrEmpty(indexName))
                throw new InvalidOperationException("Pinecone configuration not complete");

            var baseUrl = $"https://{indexName}-{environment}.pinecone.io";
            var url = $"{baseUrl}/query";

            object request = new
            {
                vector = queryEmbedding,
                topK = topK,
                includeMetadata = true
            };

            if (documentId.HasValue)
            {
                request = new
                {
                    vector = queryEmbedding,
                    topK = topK,
                    includeMetadata = true,
                    filter = new Dictionary<string, object>
                    {
                        ["documentId"] = new Dictionary<string, string>
                        {
                            ["$eq"] = documentId.Value.ToString()
                        }
                    }
                };
            }

            var content = new StringContent(
                System.Text.Json.JsonSerializer.Serialize(request),
                System.Text.Encoding.UTF8,
                "application/json");

            _httpClient.DefaultRequestHeaders.Authorization = 
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);

            var response = await _httpClient.PostAsync(url, content);
            response.EnsureSuccessStatusCode();

            var jsonResponse = await response.Content.ReadAsStringAsync();
            using var doc = System.Text.Json.JsonDocument.Parse(jsonResponse);
            var matches = doc.RootElement.GetProperty("matches");

            var chunks = new List<RetrievedChunk>();
            
            foreach (var match in matches.EnumerateArray())
            {
                var score = match.GetProperty("score").GetDouble();
                if (score >= threshold)
                {
                    var metadata = match.GetProperty("metadata");
                    chunks.Add(new RetrievedChunk
                    {
                        Content = metadata.GetProperty("content").GetString() ?? string.Empty,
                        DocumentName = metadata.GetProperty("documentName").GetString() ?? string.Empty,
                        DocumentId = Guid.Parse(metadata.GetProperty("documentId").GetString() ?? Guid.Empty.ToString()),
                        SimilarityScore = score
                    });
                }
            }

            return chunks;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching similar chunks in Pinecone");
            throw;
        }
    }

    public async Task UpsertVectorsAsync(List<VectorData> vectors)
    {
        try
        {
            var apiKey = _configuration["Pinecone:ApiKey"];
            var environment = _configuration["Pinecone:Environment"];
            var indexName = _configuration["Pinecone:IndexName"];

            if (string.IsNullOrEmpty(apiKey) || string.IsNullOrEmpty(environment) || string.IsNullOrEmpty(indexName))
                throw new InvalidOperationException("Pinecone configuration not complete");

            var baseUrl = $"https://{indexName}-{environment}.pinecone.io";
            var url = $"{baseUrl}/vectors/upsert";

            var request = new
            {
                vectors = vectors.Select(v => new
                {
                    id = v.Id,
                    values = v.Values,
                    metadata = v.Metadata
                }).ToList()
            };

            var content = new StringContent(
                System.Text.Json.JsonSerializer.Serialize(request),
                System.Text.Encoding.UTF8,
                "application/json");

            _httpClient.DefaultRequestHeaders.Authorization = 
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);

            var response = await _httpClient.PostAsync(url, content);
            response.EnsureSuccessStatusCode();

            _logger.LogInformation("Successfully upserted {VectorCount} vectors to Pinecone", vectors.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error upserting vectors to Pinecone");
            throw;
        }
    }

    public async Task DeleteVectorAsync(string vectorId)
    {
        try
        {
            var apiKey = _configuration["Pinecone:ApiKey"];
            var environment = _configuration["Pinecone:Environment"];
            var indexName = _configuration["Pinecone:IndexName"];

            if (string.IsNullOrEmpty(apiKey) || string.IsNullOrEmpty(environment) || string.IsNullOrEmpty(indexName))
                throw new InvalidOperationException("Pinecone configuration not complete");

            var baseUrl = $"https://{indexName}-{environment}.pinecone.io";
            var url = $"{baseUrl}/vectors/delete";

            var request = new { ids = new[] { vectorId } };

            var content = new StringContent(
                System.Text.Json.JsonSerializer.Serialize(request),
                System.Text.Encoding.UTF8,
                "application/json");

            _httpClient.DefaultRequestHeaders.Authorization = 
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);

            var response = await _httpClient.PostAsync(url, content);
            response.EnsureSuccessStatusCode();

            _logger.LogInformation("Successfully deleted vector {VectorId} from Pinecone", vectorId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting vector from Pinecone");
            throw;
        }
    }

    public async Task DeleteVectorsByDocumentAsync(Guid documentId)
    {
        try
        {
            // Note: Pinecone doesn't support direct filtered delete, so we would need to track vector IDs
            // by document. For now, this is a placeholder implementation.
            _logger.LogWarning("DeleteVectorsByDocumentAsync not fully implemented for Pinecone. Document ID: {DocumentId}", documentId);
            await Task.CompletedTask;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting vectors by document from Pinecone");
            throw;
        }
    }
}
