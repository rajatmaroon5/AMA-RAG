namespace AmaRAGBackend.Services;

using AmaRAGBackend.Models;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

/// <summary>
/// Result of query transformation with multiple variations
/// </summary>
public class QueryTransformationResult
{
    public string OriginalQuery { get; set; } = string.Empty;
    public List<string> ExpandedQueries { get; set; } = new();
    public List<string> DecomposedQuestions { get; set; } = new();
    public string PrimaryQuery { get; set; } = string.Empty;
}

/// <summary>
/// Implementation of query transformation service
/// </summary>
public class QueryTransformationService : IQueryTransformationService
{
    private readonly ILogger<QueryTransformationService> _logger;
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public QueryTransformationService(
        ILogger<QueryTransformationService> logger,
        HttpClient httpClient,
        IConfiguration configuration)
    {
        _logger = logger;
        _httpClient = httpClient;
        _configuration = configuration;
    }

    public async Task<QueryTransformationResult> TransformQueryAsync(string originalQuery)
    {
        var result = new QueryTransformationResult
        {
            OriginalQuery = originalQuery,
            PrimaryQuery = originalQuery
        };

        try
        {
            // 1. Query Expansion - add related terms and synonyms
            result.ExpandedQueries = await ExpandQueryAsync(originalQuery);

            // 2. Query Decomposition - break into sub-questions
            result.DecomposedQuestions = DecomposeQuery(originalQuery);

            _logger.LogInformation(
                "Query transformation completed. Original: '{Original}'. Expanded queries: {ExpandedCount}. Sub-questions: {SubCount}",
                originalQuery, result.ExpandedQueries.Count, result.DecomposedQuestions.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in query transformation");
            // Fallback to original query
            result.ExpandedQueries = new List<string> { originalQuery };
            result.DecomposedQuestions = new List<string> { originalQuery };
        }

        return result;
    }

    /// <summary>
    /// Expand query with synonyms and related terms using LLM
    /// </summary>
    private async Task<List<string>> ExpandQueryAsync(string query)
    {
        var queries = new List<string> { query };

        try
        {
            if (!HasHuggingFaceGenerationConfig())
                return queries;

            var prompt = $@"Generate 3 alternative ways to ask this question, focusing on finding relevant information:
Question: {query}

Return ONLY the 3 alternative versions, one per line, without numbers or bullets. Focus on synonyms and rephrasing.";

            var response = await CallHuggingFaceAsync(prompt);
            if (!string.IsNullOrEmpty(response))
            {
                var alternatives = response
                    .Split(new[] { '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
                    .Where(q => q.Length > 3)
                    .Take(3)
                    .ToList();

                queries.AddRange(alternatives);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Query expansion failed, using original query only");
        }

        return queries;
    }

    private bool HasHuggingFaceGenerationConfig()
    {
        var apiKey = _configuration["HuggingFace:ApiKey"];
        return !string.IsNullOrWhiteSpace(apiKey) && apiKey != "your-huggingface-api-key";
    }

    private string GetHuggingFaceGenerationModel()
    {
        return _configuration["HuggingFace:GenerationModel"] ?? "openai/gpt-oss-120b:fastest";
    }

    private string GetHuggingFaceChatEndpoint()
    {
        return _configuration["HuggingFace:ChatEndpoint"] ?? "https://router.huggingface.co/v1/chat/completions";
    }

    /// <summary>
    /// Decompose complex questions into sub-questions
    /// </summary>
    private List<string> DecomposeQuery(string query)
    {
        var questions = new List<string> { query };

        // Simple heuristic: if query has multiple clauses, suggest decomposition
        var conjunctions = new[] { "and", "or", "but", "however", "also", "additionally" };
        var containsConjunction = conjunctions.Any(c => 
            Regex.IsMatch(query, $@"\b{c}\b", RegexOptions.IgnoreCase));

        if (containsConjunction)
        {
            // Split by conjunctions
            var parts = Regex.Split(query, @"\b(and|or|but|however|also|additionally)\b", 
                RegexOptions.IgnoreCase);

            foreach (var part in parts)
            {
                var cleanPart = part.Trim()
                    .Where(c => !Regex.IsMatch(c.ToString(), @"(and|or|but|however|also|additionally)"))
                    .Aggregate("", (a, b) => a + b)
                    .Trim();

                if (cleanPart.Length > 5 && !questions.Contains(cleanPart))
                    questions.Add(cleanPart);
            }
        }

        return questions;
    }

    private async Task<string> CallHuggingFaceAsync(string prompt)
    {
        var apiKey = _configuration["HuggingFace:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
            return string.Empty;

        var request = new
        {
            model = GetHuggingFaceGenerationModel(),
            messages = new[]
            {
                new { role = "system", content = "You are a query optimization assistant. Provide concise, focused responses." },
                new { role = "user", content = prompt }
            },
            temperature = 0.7,
            max_tokens = 200
        };

        var content = new StringContent(
            System.Text.Json.JsonSerializer.Serialize(request),
            System.Text.Encoding.UTF8,
            "application/json");

        _httpClient.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);

        var response = await _httpClient.PostAsync(
            GetHuggingFaceChatEndpoint(),
            content);

        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"HuggingFace generation API error: {response.StatusCode}");

        var jsonResponse = await response.Content.ReadAsStringAsync();
        using var doc = System.Text.Json.JsonDocument.Parse(jsonResponse);
        var messageElement = doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message");

        var messageContent = messageElement.TryGetProperty("content", out var contentElement)
            ? contentElement.GetString()
            : null;

        if (!string.IsNullOrWhiteSpace(messageContent))
            return messageContent;

        var reasoning = messageElement.TryGetProperty("reasoning", out var reasoningElement)
            ? reasoningElement.GetString()
            : null;

        return reasoning ?? string.Empty;
    }
}
