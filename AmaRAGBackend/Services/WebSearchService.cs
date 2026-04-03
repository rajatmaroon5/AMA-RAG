namespace AmaRAGBackend.Services;

using AmaRAGBackend.Models;
using System.Text.RegularExpressions;

/// <summary>
/// Result from web search
/// </summary>
public class WebSearchResult
{
    public bool Success { get; set; }
    public string Query { get; set; } = string.Empty;
    public List<SearchResultItem> Results { get; set; } = new();
    public string Summary { get; set; } = string.Empty;
}

/// <summary>
/// Individual search result
/// </summary>
public class SearchResultItem
{
    public string Title { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string Snippet { get; set; } = string.Empty;
}

/// <summary>
/// DuckDuckGo web search service (free, no API key required)
/// </summary>
public class WebSearchService : IWebSearchService
{
    private readonly ILogger<WebSearchService> _logger;
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public WebSearchService(
        ILogger<WebSearchService> logger,
        HttpClient httpClient,
        IConfiguration configuration)
    {
        _logger = logger;
        _httpClient = httpClient;
        _configuration = configuration;
    }

    public async Task<WebSearchResult> SearchAsync(string query, int maxResults = 3)
    {
        var result = new WebSearchResult
        {
            Query = query,
            Success = false
        };

        try
        {
            // Using DuckDuckGo instant answer API (free, no auth required)
            var searchUrl = $"https://api.duckduckgo.com/?q={Uri.EscapeDataString(query)}&format=json&no_html=1";

            if (!_httpClient.DefaultRequestHeaders.UserAgent.Any())
            {
                _httpClient.DefaultRequestHeaders.UserAgent.Add(
                    new System.Net.Http.Headers.ProductInfoHeaderValue("AMA-RAG", "1.0"));
            }

            var response = await _httpClient.GetAsync(searchUrl);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("DuckDuckGo search failed with status {Status}", response.StatusCode);
                return result;
            }

            var content = await response.Content.ReadAsStringAsync();
            await ParseDuckDuckGoResponseAsync(content, result, maxResults);

            result.Success = result.Results.Count > 0;

            if (result.Success)
            {
                // Generate summary from results
                result.Summary = GenerateSummary(result.Results);
            }

            _logger.LogInformation(
                "Web search completed. Query: '{Query}'. Results: {Count}. Success: {Success}",
                query, result.Results.Count, result.Success);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error performing web search");
        }

        return result;
    }

    private async Task ParseDuckDuckGoResponseAsync(string json, WebSearchResult result, int maxResults)
    {
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            var root = doc.RootElement;

            // Try to get instant answer first
            if (root.TryGetProperty("AbstractText", out var abstractText) &&
                !string.IsNullOrEmpty(abstractText.GetString()))
            {
                var snippet = abstractText.GetString();
                if (!string.IsNullOrEmpty(snippet))
                {
                    result.Results.Add(new SearchResultItem
                    {
                        Title = "Direct Answer",
                        Snippet = snippet,
                        Url = root.TryGetProperty("AbstractURL", out var url) ? url.GetString() ?? "" : ""
                    });
                }
            }

            // Get related topics (web results)
            if (root.TryGetProperty("RelatedTopics", out var relatedTopics) &&
                relatedTopics.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                var count = 0;
                foreach (var topic in relatedTopics.EnumerateArray())
                {
                    if (count >= maxResults) break;

                    if (topic.TryGetProperty("Text", out var text) &&
                        topic.TryGetProperty("FirstURL", out var url) &&
                        !string.IsNullOrEmpty(text.GetString()))
                    {
                        var snippet = text.GetString() ?? "";
                        // Clean snippet (remove HTML and truncate)
                        snippet = Regex.Replace(snippet, "<[^>]*>", "");
                        snippet = snippet.Length > 200 ? snippet.Substring(0, 200) + "..." : snippet;

                        result.Results.Add(new SearchResultItem
                        {
                            Title = snippet.Length > 60 ? snippet.Substring(0, 60) + "..." : snippet,
                            Snippet = snippet,
                            Url = url.GetString() ?? ""
                        });
                        count++;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing DuckDuckGo response");
        }
    }

    private string GenerateSummary(List<SearchResultItem> results)
    {
        if (results.Count == 0)
            return "";

        var snippets = results
            .Where(r => !string.IsNullOrEmpty(r.Snippet))
            .Select(r => r.Snippet)
            .Take(3)
            .ToList();

        var summary = string.Join(" ", snippets);
        return summary.Length > 500 ? summary.Substring(0, 500) + "..." : summary;
    }
}
