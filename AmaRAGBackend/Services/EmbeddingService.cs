namespace AmaRAGBackend.Services;

using AmaRAGBackend.Models;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

/// <summary>
/// Implementation of embedding service
/// </summary>
public class EmbeddingService : IEmbeddingService
{
    private readonly ILogger<EmbeddingService> _logger;
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public EmbeddingService(ILogger<EmbeddingService> logger, HttpClient httpClient, IConfiguration configuration)
    {
        _logger = logger;
        _httpClient = httpClient;
        _configuration = configuration;
    }

    public async Task<float[]> GetEmbeddingAsync(string text, EmbeddingProvider provider = EmbeddingProvider.OpenAI)
    {
        try
        {
            if (provider == EmbeddingProvider.OpenAI)
                return await GetOpenAIEmbeddingAsync(text);
            else
                return await GetHuggingFaceEmbeddingAsync(text);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting embedding for text provider={Provider}", provider);
            throw;
        }
    }

    public async Task<List<float[]>> GetEmbeddingsAsync(List<string> texts, EmbeddingProvider provider = EmbeddingProvider.OpenAI)
    {
        var embeddings = new List<float[]>();

        foreach (var text in texts)
        {
            var embedding = await GetEmbeddingAsync(text, provider);
            embeddings.Add(embedding);
        }

        return embeddings;
    }

    private async Task<float[]> GetOpenAIEmbeddingAsync(string text)
    {
        var apiKey = _configuration["OpenAI:ApiKey"];
        if (string.IsNullOrEmpty(apiKey))
            throw new InvalidOperationException("OpenAI API key not configured");

        var request = new
        {
            input = text,
            model = "text-embedding-3-small"
        };

        var content = new StringContent(
            JsonSerializer.Serialize(request),
            Encoding.UTF8,
            "application/json");

        _httpClient.DefaultRequestHeaders.Authorization = 
            new AuthenticationHeaderValue("Bearer", apiKey);

        var response = await _httpClient.PostAsync(
            "https://api.openai.com/v1/embeddings",
            content);

        response.EnsureSuccessStatusCode();

        var jsonResponse = await response.Content.ReadAsStringAsync();
        using var doc = System.Text.Json.JsonDocument.Parse(jsonResponse);
        var data = doc.RootElement.GetProperty("data")[0];
        var embedding = data.GetProperty("embedding");

        var floatArray = new float[embedding.GetArrayLength()];
        for (int i = 0; i < embedding.GetArrayLength(); i++)
        {
            floatArray[i] = embedding[i].GetSingle();
        }

        return floatArray;
    }

    private async Task<float[]> GetHuggingFaceEmbeddingAsync(string text)
    {
        var useLocal = bool.TryParse(_configuration["HuggingFace:UseLocal"], out var parsedUseLocal) && parsedUseLocal;
        var model = _configuration["HuggingFace:Model"] ?? "sentence-transformers/all-MiniLM-L6-v2";
        var configuredEndpoint = _configuration["HuggingFace:Endpoint"];

        var endpoint = useLocal
            ? (string.IsNullOrWhiteSpace(configuredEndpoint) ? "http://localhost:8080/embed" : configuredEndpoint)
            : (string.IsNullOrWhiteSpace(configuredEndpoint)
                ? $"https://api-inference.huggingface.co/models/{model}"
                : configuredEndpoint);

        var apiKey = _configuration["HuggingFace:ApiKey"];
        if (!useLocal && string.IsNullOrEmpty(apiKey))
            throw new InvalidOperationException("HuggingFace API key not configured");

        var request = new
        {
            inputs = text,
            normalize = true,
            truncate = true
        };

        using var content = new StringContent(
            JsonSerializer.Serialize(request),
            Encoding.UTF8,
            "application/json");

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = content
        };

        if (!useLocal)
        {
            httpRequest.Headers.Authorization =
                new AuthenticationHeaderValue("Bearer", apiKey);
            httpRequest.Headers.Add("x-wait-for-model", "true");
        }

        var response = await _httpClient.SendAsync(httpRequest);

        if (response.StatusCode == HttpStatusCode.ServiceUnavailable)
        {
            var loadingBody = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"HuggingFace model is not ready yet: {loadingBody}");
        }

        response.EnsureSuccessStatusCode();

        var jsonResponse = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(jsonResponse);
        var embedding = ResolveEmbeddingArray(doc.RootElement);

        var floatArray = new float[embedding.GetArrayLength()];
        for (int i = 0; i < embedding.GetArrayLength(); i++)
        {
            floatArray[i] = embedding[i].GetSingle();
        }

        return floatArray;
    }

    private static JsonElement ResolveEmbeddingArray(JsonElement root)
    {
        if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("error", out var error))
            throw new InvalidOperationException($"HuggingFace API error: {error.GetString()}");

        // Supports hosted HF array output, and common local endpoint object outputs.
        if (root.ValueKind == JsonValueKind.Array)
        {
            if (root.GetArrayLength() == 0)
                throw new InvalidOperationException("Embedding response array is empty");

            var first = root[0];
            if (first.ValueKind == JsonValueKind.Number)
                return root;
            if (first.ValueKind == JsonValueKind.Array)
                return first;
            if (first.ValueKind == JsonValueKind.Object && first.TryGetProperty("embedding", out var firstEmbedding))
                return firstEmbedding;
        }

        if (root.ValueKind == JsonValueKind.Object)
        {
            if (root.TryGetProperty("embedding", out var embedding))
                return embedding;

            if (root.TryGetProperty("embeddings", out var embeddings))
            {
                if (embeddings.ValueKind == JsonValueKind.Array && embeddings.GetArrayLength() > 0)
                {
                    var first = embeddings[0];
                    if (first.ValueKind == JsonValueKind.Number)
                        return embeddings;
                    if (first.ValueKind == JsonValueKind.Array)
                        return first;
                    if (first.ValueKind == JsonValueKind.Object && first.TryGetProperty("embedding", out var nestedEmbedding))
                        return nestedEmbedding;
                }
            }
        }

        throw new InvalidOperationException("Unexpected HuggingFace embedding response format");
    }
}
