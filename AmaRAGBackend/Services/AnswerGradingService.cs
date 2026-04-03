namespace AmaRAGBackend.Services;

using AmaRAGBackend.Models;

/// <summary>
/// Result of answer grading
/// </summary>
public class AnswerGradeResult
{
    public double RelevancyScore { get; set; } // 0.0 to 1.0
    public bool IsRelevant { get; set; }
    public string Reasoning { get; set; } = string.Empty;
    public List<string> Issues { get; set; } = new();
}

/// <summary>
/// Implementation of answer grading service
/// </summary>
public class AnswerGradingService : IAnswerGradingService
{
    private readonly ILogger<AnswerGradingService> _logger;
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private const double RELEVANCY_THRESHOLD = 0.6; // Moderate strictness

    public AnswerGradingService(
        ILogger<AnswerGradingService> logger,
        HttpClient httpClient,
        IConfiguration configuration)
    {
        _logger = logger;
        _httpClient = httpClient;
        _configuration = configuration;
    }

    public async Task<AnswerGradeResult> GradeAnswerAsync(string question, string answer, List<RetrievedChunk> context)
    {
        var result = new AnswerGradeResult();

        try
        {
            // Build context text for evaluation
            var contextText = string.Join("\n\n", 
                context.Select(c => $"[{c.DocumentName}]\n{c.Content}"));

            if (string.IsNullOrEmpty(contextText))
            {
                result.RelevancyScore = 0.3;
                result.IsRelevant = false;
                result.Issues.Add("No context provided");
                return result;
            }

            var gradePrompt = BuildGradingPrompt(question, answer, contextText);
            var gradeResponse = await GetGradingFromLLMAsync(gradePrompt);

            // Parse grading response
            ParseGradingResponse(gradeResponse, result);

            // Determine if relevant based on threshold
            result.IsRelevant = result.RelevancyScore >= RELEVANCY_THRESHOLD;

            _logger.LogInformation(
                "Answer graded. Question: '{Question}'. Score: {Score}. Relevant: {IsRelevant}",
                question, result.RelevancyScore, result.IsRelevant);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error grading answer");
            // On error, assume answer is questionable
            result.RelevancyScore = 0.5;
            result.IsRelevant = false;
            result.Issues.Add("Grading service error");
        }

        return result;
    }

    private string BuildGradingPrompt(string question, string answer, string context)
    {
        return $@"You are an AI evaluator. Grade the following answer based on:
1. Is the answer grounded in the provided context? (Not hallucinated)
2. Does it directly answer the question?
3. Is the information accurate based on context?
4. Are there any contradictions?

Question: {question}

Provided Context:
{context}

Generated Answer:
{answer}

Provide your grading in this exact format:
SCORE: [0.0-1.0]
RELEVANT: [YES/NO]
REASONING: [Brief explanation]
ISSUES: [Comma-separated list of issues, or 'None']

Be strict. Only score high if the answer is clearly grounded in the context and directly answers the question.";
    }

    private async Task<string> GetGradingFromLLMAsync(string prompt)
    {
        var apiKey = _configuration["HuggingFace:ApiKey"];
        if (string.IsNullOrEmpty(apiKey))
            throw new InvalidOperationException("HuggingFace API key not configured");

        var endpoint = _configuration["HuggingFace:ChatEndpoint"] ?? "https://router.huggingface.co/v1/chat/completions";
        var model = _configuration["HuggingFace:GenerationModel"] ?? "openai/gpt-oss-120b:fastest";

        var request = new
        {
            model,
            messages = new[]
            {
                new { role = "system", content = "You are a strict evaluator of AI-generated answers. Be critical and precise." },
                new { role = "user", content = prompt }
            },
            temperature = 0.3, // Low temperature for consistent grading
            max_tokens = 300
        };

        var content = new StringContent(
            System.Text.Json.JsonSerializer.Serialize(request),
            System.Text.Encoding.UTF8,
            "application/json");

        _httpClient.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);

        var response = await _httpClient.PostAsync(
            endpoint,
            content);

        response.EnsureSuccessStatusCode();

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

    private void ParseGradingResponse(string response, AnswerGradeResult result)
    {
        try
        {
            var lines = response.Split(new[] { '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries);

            foreach (var line in lines)
            {
                var trimmedLine = line.Trim();

                if (trimmedLine.StartsWith("SCORE:", StringComparison.OrdinalIgnoreCase))
                {
                    var scoreStr = trimmedLine.Substring(6).Trim();
                    if (double.TryParse(scoreStr, out var score))
                        result.RelevancyScore = Math.Clamp(score, 0.0, 1.0);
                }
                else if (trimmedLine.StartsWith("RELEVANT:", StringComparison.OrdinalIgnoreCase))
                {
                    var relevant = trimmedLine.Substring(9).Trim();
                    // Already set based on score, but can override if needed
                }
                else if (trimmedLine.StartsWith("REASONING:", StringComparison.OrdinalIgnoreCase))
                {
                    result.Reasoning = trimmedLine.Substring(10).Trim();
                }
                else if (trimmedLine.StartsWith("ISSUES:", StringComparison.OrdinalIgnoreCase))
                {
                    var issuesStr = trimmedLine.Substring(7).Trim();
                    if (issuesStr != "None" && !string.IsNullOrEmpty(issuesStr))
                    {
                        result.Issues = issuesStr
                            .Split(',')
                            .Select(i => i.Trim())
                            .Where(i => !string.IsNullOrEmpty(i))
                            .ToList();
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error parsing grading response");
            result.RelevancyScore = 0.5;
            result.Reasoning = "Could not parse grading response";
        }
    }
}
