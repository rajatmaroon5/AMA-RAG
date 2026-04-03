namespace AmaRAGBackend.Services;

using AmaRAGBackend.Models;
using System.Text.Json;

/// <summary>
/// Implementation of chat service with advanced RAG capabilities
/// </summary>
public class ChatService : IChatService
{
    private enum QueryRouteType
    {
        Conversational,
        Weather,
        Gmail,
        Rag
    }

    private sealed class QueryRouteDecision
    {
        public QueryRouteType Route { get; set; } = QueryRouteType.Rag;
        public string Reason { get; set; } = "Defaulted to RAG";
        public string? Location { get; set; }
    }

    private readonly ILogger<ChatService> _logger;
    private readonly IEmbeddingService _embeddingService;
    private readonly IPineconeService _pineconeService;
    private readonly IQueryTransformationService _queryTransformationService;
    private readonly IAnswerGradingService _answerGradingService;
    private readonly IWebSearchService _webSearchService;
    private readonly IWeatherMcpService _weatherMcpService;
    private readonly IGmailMcpService _gmailMcpService;
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;

    private const int MAX_RETRIES = 2;
    private const double RELEVANCY_THRESHOLD = 0.5;

    public ChatService(
        ILogger<ChatService> logger,
        IEmbeddingService embeddingService,
        IPineconeService pineconeService,
        IQueryTransformationService queryTransformationService,
        IAnswerGradingService answerGradingService,
        IWebSearchService webSearchService,
        IWeatherMcpService weatherMcpService,
        IGmailMcpService gmailMcpService,
        IConfiguration configuration,
        HttpClient httpClient)
    {
        _logger = logger;
        _embeddingService = embeddingService;
        _pineconeService = pineconeService;
        _queryTransformationService = queryTransformationService;
        _answerGradingService = answerGradingService;
        _webSearchService = webSearchService;
        _weatherMcpService = weatherMcpService;
        _gmailMcpService = gmailMcpService;
        _configuration = configuration;
        _httpClient = httpClient;
    }

    public async Task<ChatResponse> GetAnswerAsync(ChatRequest request)
    {
        var response = new ChatResponse();
        var logs = new RagLogs();
        var overallStopwatch = System.Diagnostics.Stopwatch.StartNew();

        try
        {
            request.Temperature = Math.Clamp(request.Temperature, 0.0, 1.0);

            // Step 0: LLM query router (first step)
            var routingStopwatch = System.Diagnostics.Stopwatch.StartNew();
            var routeDecision = await RouteQueryAsync(request.Question);
            routingStopwatch.Stop();

            logs.AddEntry(new RagLogEntry
            {
                Step = "LLM Query Router",
                Description = "Classified query as conversational, weather, gmail, or document/RAG",
                DurationMs = routingStopwatch.ElapsedMilliseconds,
                Timestamp = DateTime.UtcNow,
                Status = "Success",
                Details = new List<string>
                {
                    $"Query: {request.Question}",
                    $"Route: {routeDecision.Route}",
                    $"Reason: {routeDecision.Reason}",
                    $"Location: {(string.IsNullOrWhiteSpace(routeDecision.Location) ? "n/a" : routeDecision.Location)}"
                }
            });

            if (routeDecision.Route == QueryRouteType.Conversational)
            {
                _logger.LogInformation("Conversational message detected for query '{Query}'. Returning LLM-generated response.", request.Question);

                var conversationalStopwatch = System.Diagnostics.Stopwatch.StartNew();
                var conversationalResponse = await GetConversationalResponseAsync(request.Question, request.Temperature);
                conversationalStopwatch.Stop();

                logs.AddEntry(new RagLogEntry
                {
                    Step = "Conversational Response",
                    Description = "Message identified as conversational and answered directly by LLM",
                    DurationMs = conversationalStopwatch.ElapsedMilliseconds,
                    Timestamp = DateTime.UtcNow,
                    Status = "Success",
                    Details = new List<string> { $"Query: {request.Question}" }
                });

                response.Logs = logs;
                return new ChatResponse
                {
                    Answer = conversationalResponse,
                    Model = GetHuggingFaceGenerationModel(),
                    TokensUsed = EstimateTokens(conversationalResponse),
                    RetrievedChunks = new List<RetrievedChunk>(),
                    QueryTransformation = new QueryTransformationInfo
                    {
                        ExpandedQueries = new List<string>(),
                        DecomposedQuestions = new List<string>(),
                        TransformationStrategy = "Conversational short-circuit"
                    },
                    RetryCount = 0,
                    WebSource = new WebSourceInfo
                    {
                        UsedWebSearch = false,
                        SearchQuery = request.Question,
                        Sources = new List<WebSourceReference>(),
                        Disclaimer = string.Empty
                    },
                    Logs = logs
                };
            }

            if (routeDecision.Route == QueryRouteType.Weather)
            {
                _logger.LogInformation("Weather query detected for '{Query}'. Using live weather MCP tool.", request.Question);
                return await GetWeatherAnswerAsync(request, logs, routeDecision.Location);
            }

            if (routeDecision.Route == QueryRouteType.Gmail)
            {
                _logger.LogInformation("Gmail query detected for '{Query}'. Using Gmail MCP bridge.", request.Question);
                return await GetGmailAnswerAsync(request, logs);
            }

            // Step 1: Transform the query for better retrieval
            var transformStopwatch = System.Diagnostics.Stopwatch.StartNew();
            var transformedQuery = await TransformQueryAsync(request.Question);
            transformStopwatch.Stop();
            response.QueryTransformation = transformedQuery;

            logs.AddEntry(new RagLogEntry
            {
                Step = "Query Transformation",
                Description = "Original query expanded and decomposed for better retrieval",
                DurationMs = transformStopwatch.ElapsedMilliseconds,
                Timestamp = DateTime.UtcNow,
                Status = "Success",
                Details = new List<string>
                {
                    $"Original Query: {request.Question}",
                    $"Expanded Queries: {string.Join(", ", transformedQuery.ExpandedQueries)}",
                    $"Decomposed Questions: {string.Join(", ", transformedQuery.DecomposedQuestions)}",
                    $"Strategy: {transformedQuery.TransformationStrategy}"
                }
            });

            // Step 2: Try to get answer from documents with retry logic
            var retrievalStopwatch = System.Diagnostics.Stopwatch.StartNew();
            var answer = await GetAnswerWithRetryAsync(
                request,
                transformedQuery);
            retrievalStopwatch.Stop();

            if (answer != null)
            {
                response.Answer = answer.Value.Answer;
                response.RetrievedChunks = answer.Value.RetrievedChunks;
                response.AnswerGrade = answer.Value.Grade;
                response.RetryCount = answer.Value.RetryCount;
                response.Model = answer.Value.Model;
                response.LlmPrompt = answer.Value.PromptTrace;
                response.TokensUsed = EstimateTokens(response.Answer + string.Join("", response.RetrievedChunks.Select(c => c.Content)));

                logs.AddEntry(new RagLogEntry
                {
                    Step = "Query Embedding",
                    Description = "Query transformed into vector space",
                    DurationMs = 0,
                    Timestamp = DateTime.UtcNow,
                    Status = "Success",
                    Details = new List<string>
                    {
                        $"Query Used: {answer.Value.QueryUsed}",
                        $"Embedding Provider: {answer.Value.EmbeddingProvider}",
                        $"Embedding Dimensions: {answer.Value.EmbeddingDimensions}",
                        $"Embedding Norm: {answer.Value.EmbeddingNorm:F4}",
                        $"Vector Preview (first 8): [{answer.Value.EmbeddingPreview}]"
                    }
                });

                var rankedChunks = response.RetrievedChunks
                    .OrderByDescending(chunk => chunk.SimilarityScore)
                    .ToList();

                logs.AddEntry(new RagLogEntry
                {
                    Step = "Semantic Similarity Search",
                    Description = "Computed similarity against nearby document chunks",
                    DurationMs = 0,
                    Timestamp = DateTime.UtcNow,
                    Status = "Success",
                    Details = rankedChunks.Select((chunk, index) =>
                        $"Rank {index + 1}: {chunk.DocumentName} | Similarity: {chunk.SimilarityScore:F4}")
                        .ToList()
                });

                var selectedChunk = rankedChunks.FirstOrDefault();
                if (selectedChunk != null)
                {
                    logs.AddEntry(new RagLogEntry
                    {
                        Step = "Chunk Selection",
                        Description = "Top chunk selected for response grounding",
                        DurationMs = 0,
                        Timestamp = DateTime.UtcNow,
                        Status = "Success",
                        Details = new List<string>
                        {
                            $"Selected Chunk: {selectedChunk.DocumentName}",
                            $"Similarity: {selectedChunk.SimilarityScore:F4}",
                            $"Content Preview: {TruncateForLog(selectedChunk.Content, 220)}"
                        }
                    });
                }

                logs.AddEntry(new RagLogEntry
                {
                    Step = "Final Prompt Sent To LLM",
                    Description = "Exact prompt payload used for answer generation",
                    DurationMs = 0,
                    Timestamp = DateTime.UtcNow,
                    Status = response.LlmPrompt?.SentToLlm == true ? "Success" : "Warning",
                    Details = new List<string>
                    {
                        $"Provider: {response.LlmPrompt?.Provider}",
                        $"Model: {response.LlmPrompt?.Model}",
                        $"Prompt Notes: {response.LlmPrompt?.Notes}",
                        $"Combined Prompt: {response.LlmPrompt?.CombinedPrompt}"
                    }
                });

                logs.AddEntry(new RagLogEntry
                {
                    Step = "LLM Raw Output",
                    Description = "Direct answer text returned by the model",
                    DurationMs = 0,
                    Timestamp = DateTime.UtcNow,
                    Status = "Success",
                    Details = new List<string>
                    {
                        $"LLM Returned: {TruncateForLog(response.Answer, 500)}"
                    }
                });

                logs.AddEntry(new RagLogEntry
                {
                    Step = "Document Retrieval & Answer Generation",
                    Description = "Retrieved documents and generated answer using LLM",
                    DurationMs = retrievalStopwatch.ElapsedMilliseconds,
                    Timestamp = DateTime.UtcNow,
                    Status = "Success",
                    Details = new List<string>
                    {
                        $"Chunks Retrieved: {response.RetrievedChunks.Count}",
                        $"Retry Count: {response.RetryCount}",
                        $"Model: {response.Model}",
                        $"Relevancy Score: {response.AnswerGrade?.RelevancyScore ?? 0}",
                        $"Is Relevant: {response.AnswerGrade?.IsRelevant ?? false}",
                        $"Tokens Used: {response.TokensUsed}"
                    }
                });

                // Add chunk details
                if (response.RetrievedChunks.Any())
                {
                    logs.AddEntry(new RagLogEntry
                    {
                        Step = "Retrieved Chunks",
                        Description = $"Total of {response.RetrievedChunks.Count} chunks retrieved from documents",
                        DurationMs = 0,
                        Timestamp = DateTime.UtcNow,
                        Status = "Success",
                        Details = response.RetrievedChunks.Select((c, i) =>
                            $"Chunk {i + 1}: {c.DocumentName} (Similarity: {c.SimilarityScore:F4})")
                            .ToList()
                    });
                }

                // Add answer grading details
                if (response.AnswerGrade != null)
                {
                    logs.AddEntry(new RagLogEntry
                    {
                        Step = "Answer Quality Grading",
                        Description = "LLM evaluated answer relevancy and quality",
                        DurationMs = 0,
                        Timestamp = DateTime.UtcNow,
                        Status = response.AnswerGrade.IsRelevant ? "Success" : "Warning",
                        Details = new List<string>
                        {
                            $"Relevancy Score: {response.AnswerGrade.RelevancyScore:F4}",
                            $"Verdict: {(response.AnswerGrade.IsRelevant ? "RELEVANT" : "NOT RELEVANT")}",
                            $"LLM Self Grade: {(response.AnswerGrade.IsRelevant ? "PASS" : "FAIL")}",
                            $"Reasoning: {response.AnswerGrade.Reasoning}"
                        }.Concat(response.AnswerGrade.Issues.Select(i => $"Issue: {i}")).ToList()
                    });
                }

                logs.AddEntry(new RagLogEntry
                {
                    Step = "Final Answer",
                    Description = "Final response sent to the client",
                    DurationMs = 0,
                    Timestamp = DateTime.UtcNow,
                    Status = "Success",
                    Details = new List<string>
                    {
                        $"Final Relevancy Score: {response.AnswerGrade?.RelevancyScore:F4}",
                        $"Final Answer: {TruncateForLog(response.Answer, 500)}"
                    }
                });
            }
            else
            {
                // Step 3: Question not found in documents - return out of scope message
                _logger.LogInformation("No answer found in documents for query '{Query}'. Query is out of scope.", request.Question);
                
                logs.AddEntry(new RagLogEntry
                {
                    Step = "Document Retrieval Failed",
                    Description = "No relevant documents found",
                    DurationMs = retrievalStopwatch.ElapsedMilliseconds,
                    Timestamp = DateTime.UtcNow,
                    Status = "Warning",
                    Details = new List<string> { "No matching documents found for the query" }
                });

                response.Answer = "I apologize, but I can only answer questions related to your uploaded documents. This question appears to be outside the scope of the provided documents. Please upload relevant documents or ask questions specific to your existing files.";
                response.RetrievedChunks = new List<RetrievedChunk>();
                response.Model = "out-of-scope";
                response.TokensUsed = EstimateTokens(response.Answer);
                response.RetryCount = 0;
                response.WebSource = new WebSourceInfo
                {
                    UsedWebSearch = false,
                    SearchQuery = string.Empty,
                    Sources = new List<WebSourceReference>(),
                    Disclaimer = "This response is not from your documents."
                };
            }

            overallStopwatch.Stop();
            logs.TotalDurationMs = overallStopwatch.ElapsedMilliseconds;
            response.Logs = logs;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting answer from chat service");
            throw;
        }

        return response;
    }

    private static bool IsConversationalMessage(string? question)
    {
        if (string.IsNullOrWhiteSpace(question))
            return false;

        var normalized = question.Trim().ToLowerInvariant();
        normalized = normalized
            .Replace("!", string.Empty)
            .Replace("?", string.Empty)
            .Replace(".", string.Empty)
            .Replace(",", string.Empty)
            .Replace("'", string.Empty)
            .Replace("\"", string.Empty);

        var containsSignals = new[]
        {
            "thank you", "thanks", "thats very helpful", "that isnt helpful", "have a good day", "have a nice day"
        };

        if (containsSignals.Any(signal => normalized.Contains(signal)))
            return true;

        return normalized is "hi"
            or "hello"
            or "hey"
            or "hey there"
            or "hello there"
            or "good morning"
            or "good afternoon"
            or "good evening"
            or "greetings"
            or "yo"
            or "thank you"
            or "thanks"
            or "thats very helpful"
            or "that isnt helpful"
            or "have a good day"
            or "have a nice day"
            or "bye"
            or "goodbye";
    }

    private async Task<QueryRouteDecision> RouteQueryAsync(string question)
    {
        if (string.IsNullOrWhiteSpace(question))
        {
            return new QueryRouteDecision
            {
                Route = QueryRouteType.Rag,
                Reason = "Empty question defaulted to RAG"
            };
        }

        const string systemPrompt = @"You are a strict query router for a RAG chatbot.
Classify the user query into exactly one route:
1) conversational: greetings, thanks, compliments, casual chit-chat only (no information lookup intent)
2) weather: user asks weather, temperature, forecast, rain, humidity, wind, climate for any location
    3) gmail: user asks to read/list/send/trash/mark emails, inbox, unread emails, gmail actions
    4) rag: any document-related question or any other informational query that should go through retrieval

Respond with STRICT JSON only, no markdown, no extra text:
    {""route"":""conversational|weather|gmail|rag"",""reason"":""short reason"",""location"":""city/region if weather else empty""}";

        var userPrompt = $"User query: {question}";

        try
        {
            var raw = await GetHuggingFaceAnswer(systemPrompt, userPrompt, 0.1);
            var parsed = ParseRouteDecision(raw);
            if (parsed != null)
                return parsed;

            _logger.LogWarning("Router LLM output was not parseable. Falling back to heuristic router for query '{Query}'. Raw: {Raw}", question, raw);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Router LLM failed for query '{Query}'. Falling back to heuristic router.", question);
        }

        // Safe fallback if router output fails
        if (IsWeatherQuery(question))
        {
            return new QueryRouteDecision
            {
                Route = QueryRouteType.Weather,
                Reason = "Heuristic fallback detected weather keywords",
                Location = ExtractLocationFromQuery(question)
            };
        }

        if (IsGmailQuery(question))
        {
            return new QueryRouteDecision
            {
                Route = QueryRouteType.Gmail,
                Reason = "Heuristic fallback detected Gmail keywords"
            };
        }

        if (IsConversationalMessage(question))
        {
            return new QueryRouteDecision
            {
                Route = QueryRouteType.Conversational,
                Reason = "Heuristic fallback detected conversational message"
            };
        }

        return new QueryRouteDecision
        {
            Route = QueryRouteType.Rag,
            Reason = "Heuristic fallback defaulted to RAG"
        };
    }

    private QueryRouteDecision? ParseRouteDecision(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return null;

        var trimmed = raw.Trim();
        var start = trimmed.IndexOf('{');
        var end = trimmed.LastIndexOf('}');
        if (start >= 0 && end > start)
            trimmed = trimmed[start..(end + 1)];

        try
        {
            using var doc = JsonDocument.Parse(trimmed);
            var root = doc.RootElement;

            if (!root.TryGetProperty("route", out var routeElement))
                return null;

            var routeRaw = routeElement.GetString()?.Trim().ToLowerInvariant();
            var reason = root.TryGetProperty("reason", out var reasonElement)
                ? (reasonElement.GetString() ?? "Routed by LLM")
                : "Routed by LLM";
            var location = root.TryGetProperty("location", out var locationElement)
                ? locationElement.GetString()?.Trim()
                : null;

            var route = routeRaw switch
            {
                "conversational" => QueryRouteType.Conversational,
                "weather" => QueryRouteType.Weather,
                "gmail" => QueryRouteType.Gmail,
                "rag" => QueryRouteType.Rag,
                _ => QueryRouteType.Rag
            };

            if (route == QueryRouteType.Weather && string.IsNullOrWhiteSpace(location))
            {
                location = null;
            }

            return new QueryRouteDecision
            {
                Route = route,
                Reason = reason,
                Location = location
            };
        }
        catch
        {
            return null;
        }
    }

    private async Task<string> GetConversationalResponseAsync(string question, double temperature)
    {
        var systemPrompt = @"You are a polite assistant in a document Q&A app.
The user sent a conversational message (for example: greeting, thanks, positive/negative feedback, or goodbye).
Reply briefly in 1-2 sentences, in a friendly professional tone.
If feedback is negative, acknowledge it and invite the user to ask a clearer document-related question.";

        var userPrompt = $@"User message: {question}

Generate an appropriate conversational reply.";

        try
        {
            var answer = await GetHuggingFaceAnswer(systemPrompt, userPrompt, temperature);
            if (!string.IsNullOrWhiteSpace(answer))
                return answer.Trim();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to generate conversational response from LLM for query '{Query}'.", question);
        }

        return "Thanks for your message. Feel free to ask another question about your documents.";
    }

    private static bool IsWeatherQuery(string? question)
    {
        if (string.IsNullOrWhiteSpace(question))
            return false;

        var normalized = question.Trim().ToLowerInvariant();

        var weatherKeywords = new[]
        {
            "weather", "temperature", "forecast", "humidity", "rain", "raining", "sunny", "cloudy",
            "windy", "wind speed", "hot outside", "cold outside", "storm", "snow", "snowing",
            "climate", "°c", "°f", "celsius", "fahrenheit", "precipitation", "drizzle", "haze", "fog"
        };

        return weatherKeywords.Any(kw => normalized.Contains(kw));
    }

    private static bool IsGmailQuery(string? question)
    {
        if (string.IsNullOrWhiteSpace(question))
            return false;

        var normalized = question.Trim().ToLowerInvariant();
        var gmailKeywords = new[]
        {
            "gmail", "inbox", "unread email", "unread emails", "my emails",
            "read email", "send email", "trash email", "mark as read", "email id"
        };

        return gmailKeywords.Any(kw => normalized.Contains(kw));
    }

    private static string ExtractLocationFromQuery(string question)
    {
        var match = System.Text.RegularExpressions.Regex.Match(
            question,
            @"\b(?:in|for|at|of)\s+([A-Za-z][\w\s]{1,30}?)(?:\s*[?,]|\s*today|\s*tomorrow|\s*this\s+week|\s*tonight|\s*now|$)",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        if (match.Success)
        {
            var candidate = match.Groups[1].Value.Trim();
            var nonLocations = new[] { "the", "weather", "forecast", "temperature", "a", "an", "my", "your", "current" };
            if (!nonLocations.Contains(candidate.ToLowerInvariant()))
                return candidate;
        }

        return "Mumbai";
    }

    private async Task<ChatResponse> GetWeatherAnswerAsync(ChatRequest request, RagLogs logs, string? routedLocation = null)
    {
        var weatherStopwatch = System.Diagnostics.Stopwatch.StartNew();
        var location = string.IsNullOrWhiteSpace(routedLocation)
            ? ExtractLocationFromQuery(request.Question)
            : routedLocation;

        var question = request.Question.ToLowerInvariant();
        bool isForecast = question.Contains("forecast") || question.Contains("tomorrow") ||
                          question.Contains("this week") || question.Contains("next week") ||
                          question.Contains("coming days") || question.Contains("few days");

        WeatherMcpResult weatherResult = isForecast
            ? await _weatherMcpService.GetWeatherForecastAsync(location, 3)
            : await _weatherMcpService.GetCurrentWeatherAsync(location);

        weatherStopwatch.Stop();

        string answer;
        if (weatherResult.Success && !string.IsNullOrWhiteSpace(weatherResult.FormattedData))
        {
            var systemPrompt = "You are a helpful assistant. Answer the user's weather question using only the live weather data provided below. Be concise and friendly.";
            var userPrompt = $"Live weather data (fetched via weather MCP tool / wttr.in):\n{weatherResult.FormattedData}\n\nUser question: {request.Question}";

            try
            {
                var llmAnswer = await GetHuggingFaceAnswer(systemPrompt, userPrompt, request.Temperature);
                answer = string.IsNullOrWhiteSpace(llmAnswer) ? weatherResult.FormattedData : llmAnswer.Trim();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "LLM formatting of weather data failed; returning raw weather data.");
                answer = weatherResult.FormattedData;
            }
        }
        else
        {
            answer = $"I'm sorry, I wasn't able to retrieve the current weather for '{location}'. Please try again shortly.";
        }

        logs.AddEntry(new RagLogEntry
        {
            Step = "Weather MCP Tool",
            Description = $"Fetched live weather for '{location}' via weather MCP (wttr.in)",
            DurationMs = weatherStopwatch.ElapsedMilliseconds,
            Timestamp = DateTime.UtcNow,
            Status = weatherResult.Success ? "Success" : "Warning",
            Details = new List<string>
            {
                $"Location: {location}",
                $"Query type: {(isForecast ? "Forecast" : "Current conditions")}",
                $"Success: {weatherResult.Success}",
                $"Data preview: {(weatherResult.FormattedData.Length > 200 ? weatherResult.FormattedData[..200] + "..." : weatherResult.FormattedData)}"
            }
        });

        return new ChatResponse
        {
            Answer = answer,
            Model = GetHuggingFaceGenerationModel(),
            TokensUsed = EstimateTokens(answer),
            RetrievedChunks = new List<RetrievedChunk>(),
            QueryTransformation = new QueryTransformationInfo
            {
                ExpandedQueries = new List<string>(),
                DecomposedQuestions = new List<string>(),
                TransformationStrategy = "Weather MCP tool"
            },
            RetryCount = 0,
            WebSource = new WebSourceInfo
            {
                UsedWebSearch = false,
                SearchQuery = request.Question,
                Sources = new List<WebSourceReference>(),
                Disclaimer = "Live weather data from wttr.in via weather MCP tool. Not from uploaded documents."
            },
            Logs = logs
        };
    }

    private async Task<ChatResponse> GetGmailAnswerAsync(ChatRequest request, RagLogs logs)
    {
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();
        var question = request.Question.Trim();
        var normalized = question.ToLowerInvariant();

        string answer;
        var action = "unknown";

        if (normalized.Contains("unread") || normalized.Contains("inbox") || normalized.Contains("new email"))
        {
            action = "get-unread-emails";
            var result = await _gmailMcpService.GetUnreadEmailsAsync();
            answer = BuildGmailAnswerFromToolResult(result, "I couldn't fetch unread emails from Gmail MCP.");
        }
        else if (normalized.Contains("read email"))
        {
            action = "read-email";
            var emailId = ExtractEmailId(question);
            if (string.IsNullOrWhiteSpace(emailId))
            {
                answer = "Please provide the email ID to read. Example: read email id 18fabc123";
            }
            else
            {
                var result = await _gmailMcpService.ReadEmailAsync(emailId);
                answer = BuildGmailAnswerFromToolResult(result, $"I couldn't read email '{emailId}'.");
            }
        }
        else if (normalized.Contains("mark") && normalized.Contains("read"))
        {
            action = "mark-email-as-read";
            var emailId = ExtractEmailId(question);
            if (string.IsNullOrWhiteSpace(emailId))
            {
                answer = "Please provide the email ID to mark as read. Example: mark email id 18fabc123 as read";
            }
            else
            {
                var result = await _gmailMcpService.MarkEmailAsReadAsync(emailId);
                answer = BuildGmailAnswerFromToolResult(result, $"I couldn't mark email '{emailId}' as read.");
            }
        }
        else if (normalized.Contains("trash") || normalized.Contains("delete email"))
        {
            action = "trash-email";
            if (!normalized.Contains("confirm"))
            {
                answer = "I can move that email to trash, but I need explicit confirmation first. Repeat with: confirm trash email id <email-id>.";
            }
            else
            {
                var emailId = ExtractEmailId(question);
                if (string.IsNullOrWhiteSpace(emailId))
                {
                    answer = "Please provide the email ID to trash. Example: confirm trash email id 18fabc123";
                }
                else
                {
                    var result = await _gmailMcpService.TrashEmailAsync(emailId);
                    answer = BuildGmailAnswerFromToolResult(result, $"I couldn't trash email '{emailId}'.");
                }
            }
        }
        else if (normalized.Contains("send email"))
        {
            action = "send-email";
            if (!normalized.Contains("confirm"))
            {
                answer = "I can send the email, but I need explicit confirmation first. Use: confirm send email to user@example.com subject: <subject> body: <message>.";
            }
            else
            {
                var recipient = ExtractRecipientEmail(question);
                var subject = ExtractLabeledSegment(question, "subject:", new[] { "body:" });
                var message = ExtractLabeledSegment(question, "body:", Array.Empty<string>());

                if (string.IsNullOrWhiteSpace(recipient) || string.IsNullOrWhiteSpace(subject) || string.IsNullOrWhiteSpace(message))
                {
                    answer = "Missing send details. Please provide recipient, subject, and body. Example: confirm send email to user@example.com subject: Hello body: Test message";
                }
                else
                {
                    var result = await _gmailMcpService.SendEmailAsync(recipient, subject, message);
                    answer = BuildGmailAnswerFromToolResult(result, "I couldn't send the email.");
                }
            }
        }
        else
        {
            answer = "I can help with Gmail actions: unread emails, read email by id, mark as read, send email (with confirm), or trash email (with confirm).";
        }

        stopwatch.Stop();

        logs.AddEntry(new RagLogEntry
        {
            Step = "Gmail MCP Tool",
            Description = "Handled Gmail request via Python MCP stdio bridge",
            DurationMs = stopwatch.ElapsedMilliseconds,
            Timestamp = DateTime.UtcNow,
            Status = "Success",
            Details = new List<string>
            {
                $"Action: {action}",
                $"Query: {question}"
            }
        });

        return new ChatResponse
        {
            Answer = answer,
            Model = "gmail-mcp-bridge",
            TokensUsed = EstimateTokens(answer),
            RetrievedChunks = new List<RetrievedChunk>(),
            QueryTransformation = new QueryTransformationInfo
            {
                ExpandedQueries = new List<string>(),
                DecomposedQuestions = new List<string>(),
                TransformationStrategy = "Gmail MCP tool"
            },
            RetryCount = 0,
            WebSource = new WebSourceInfo
            {
                UsedWebSearch = false,
                SearchQuery = request.Question,
                Sources = new List<WebSourceReference>(),
                Disclaimer = "Live Gmail actions executed through Python MCP bridge."
            },
            Logs = logs
        };
    }

    private static string BuildGmailAnswerFromToolResult(GmailMcpToolResult result, string fallbackMessage)
    {
        if (!result.Success)
        {
            return string.IsNullOrWhiteSpace(result.ErrorMessage)
                ? fallbackMessage
                : $"{fallbackMessage} Error: {result.ErrorMessage}";
        }

        if (string.IsNullOrWhiteSpace(result.RawResponse))
            return "Gmail MCP action completed successfully.";

        try
        {
            using var doc = JsonDocument.Parse(result.RawResponse);
            if (!doc.RootElement.TryGetProperty("result", out var resultElement))
                return result.RawResponse;

            if (!resultElement.TryGetProperty("content", out var contentElement) || contentElement.ValueKind != JsonValueKind.Array)
                return result.RawResponse;

            var texts = new List<string>();
            foreach (var item in contentElement.EnumerateArray())
            {
                if (item.TryGetProperty("text", out var textElement))
                {
                    var text = textElement.GetString();
                    if (!string.IsNullOrWhiteSpace(text))
                        texts.Add(text.Trim());
                }
            }

            return texts.Count > 0 ? string.Join("\n", texts) : result.RawResponse;
        }
        catch
        {
            return result.RawResponse;
        }
    }

    private static string? ExtractEmailId(string query)
    {
        var match = System.Text.RegularExpressions.Regex.Match(
            query,
            @"\b(?:email\s*)?id\s*[:#]?\s*([A-Za-z0-9_-]{6,})",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        if (match.Success)
            return match.Groups[1].Value.Trim();

        return null;
    }

    private static string? ExtractRecipientEmail(string query)
    {
        var match = System.Text.RegularExpressions.Regex.Match(
            query,
            @"\bto\s+([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        if (match.Success)
            return match.Groups[1].Value.Trim();

        return null;
    }

    private static string? ExtractLabeledSegment(string input, string label, string[] stopLabels)
    {
        var index = input.IndexOf(label, StringComparison.OrdinalIgnoreCase);
        if (index < 0)
            return null;

        var start = index + label.Length;
        var remaining = input[start..].Trim();
        if (remaining.Length == 0)
            return null;

        int endIndex = remaining.Length;
        foreach (var stopLabel in stopLabels)
        {
            var stopIndex = remaining.IndexOf(stopLabel, StringComparison.OrdinalIgnoreCase);
            if (stopIndex >= 0 && stopIndex < endIndex)
                endIndex = stopIndex;
        }

        var value = remaining[..endIndex].Trim();
        return value.Length == 0 ? null : value;
    }

    private static bool ShouldUseGeneralKnowledgeFallback(string? question)
    {
        if (string.IsNullOrWhiteSpace(question))
            return false;

        var normalized = question.Trim().ToLowerInvariant();

        var documentSpecificSignals = new[]
        {
            "document", "documents", "uploaded", "upload", "file", "files", "pdf", "docx",
            "according to", "based on the context", "based on the document", "from the document",
            "from the documents", "from my", "in my", "our document", "our policy", "this policy",
            "attached", "source document", "retrieved context", "knowledge base", "rag"
        };

        if (documentSpecificSignals.Any(signal => normalized.Contains(signal)))
            return false;

        var conversationalSignals = new[]
        {
            "how are you", "who are you", "what can you do", "thank you", "thanks", "bye", "goodbye",
            "nice to meet you", "can you help me", "could you help me", "what's up", "whats up"
        };

        if (conversationalSignals.Any(signal => normalized.Contains(signal)))
            return true;

        var generalQuestionPrefixes = new[]
        {
            "what is", "what are", "who is", "who are", "when is", "where is", "why is", "why are",
            "how is", "how do", "how does", "explain", "tell me about", "give me an overview of",
            "summarize", "compare", "define"
        };

        return generalQuestionPrefixes.Any(prefix => normalized.StartsWith(prefix, StringComparison.Ordinal));
    }

    private async Task<ChatResponse?> TryGetGeneralKnowledgeAnswerAsync(string question, ChatResponse response)
    {
        if (!HasHuggingFaceGenerationConfig())
            return null;

        const string systemPrompt = @"You are a helpful assistant.
Answer using your built-in general knowledge only.
Do not claim to have read uploaded documents or private files when none were retrieved.
If the user is asking about a specific document or private source you cannot see, say that you do not have enough document context.";

        var userPrompt = $@"The user's question did not match any retrieved document context.
If this is a general or conversational question, answer it normally using your pre-trained knowledge.
If it actually requires private document context, say that you could not find relevant uploaded content.

Question: {question}";

        var promptTrace = new LlmPromptTrace
        {
            Provider = "HuggingFace",
            Model = GetHuggingFaceGenerationModel(),
            SystemPrompt = systemPrompt,
            UserPrompt = userPrompt,
            CombinedPrompt = $"System:\n{systemPrompt}\n\nUser:\n{userPrompt}",
            SentToLlm = false,
            Notes = "Prompt prepared for general-knowledge fallback because retrieval returned no relevant documents."
        };

        try
        {
            promptTrace.SentToLlm = true;
            promptTrace.Notes = "Prompt sent to HuggingFace for general-knowledge fallback.";

            var answer = await GetHuggingFaceAnswer(systemPrompt, userPrompt);
            if (string.IsNullOrWhiteSpace(answer))
                return null;

            response.Answer = "[General knowledge answer - not from your uploaded documents]\n\n" + answer.Trim();
            response.RetrievedChunks = new List<RetrievedChunk>();
            response.Model = GetHuggingFaceGenerationModel();
            response.TokensUsed = EstimateTokens(response.Answer);
            response.LlmPrompt = promptTrace;
            response.AnswerGrade = new AnswerGradeInfo
            {
                RelevancyScore = 1.0,
                IsRelevant = true,
                Reasoning = "Answered using model knowledge because retrieval returned no relevant document context and the question appeared to be general or conversational.",
                Issues = new List<string>()
            };

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "General-knowledge fallback failed for query '{Query}'. Falling back to web search.",
                question);

            promptTrace.SentToLlm = true;
            promptTrace.Notes = $"General-knowledge fallback failed: {ex.Message}";
            response.LlmPrompt = promptTrace;
            return null;
        }
    }

    private async Task<QueryTransformationInfo> TransformQueryAsync(string originalQuery)
    {
        try
        {
            var transformationResult = await _queryTransformationService.TransformQueryAsync(originalQuery);

            return new QueryTransformationInfo
            {
                ExpandedQueries = transformationResult.ExpandedQueries,
                DecomposedQuestions = transformationResult.DecomposedQuestions,
                TransformationStrategy = "Query Expansion + Decomposition"
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Query transformation failed, proceeding with original query");
            return new QueryTransformationInfo
            {
                ExpandedQueries = new List<string>(),
                DecomposedQuestions = new List<string>(),
                TransformationStrategy = "None (failed)"
            };
        }
    }

    private async Task<(string Answer, List<RetrievedChunk> RetrievedChunks, AnswerGradeInfo Grade, string Model, LlmPromptTrace PromptTrace, int RetryCount, string QueryUsed, string EmbeddingProvider, int EmbeddingDimensions, double EmbeddingNorm, string EmbeddingPreview)?> GetAnswerWithRetryAsync(
        ChatRequest request,
        QueryTransformationInfo transformedQuery)
    {
        var queriesToTry = new List<string> { request.Question };
        queriesToTry.AddRange(transformedQuery.ExpandedQueries);
        queriesToTry.AddRange(transformedQuery.DecomposedQuestions);

        int retryCount = 0;
        for (int attempt = 0; attempt <= MAX_RETRIES; attempt++)
        {
            retryCount = attempt;

            // Try each query variant
            foreach (var query in queriesToTry)
            {
                var result = await AttemptAnswerAsync(query, request);

                if (result != null)
                {
                    return (
                        result.Value.Answer,
                        result.Value.RetrievedChunks,
                        result.Value.Grade,
                        result.Value.Model,
                        result.Value.PromptTrace,
                        retryCount,
                        query,
                        result.Value.EmbeddingProvider,
                        result.Value.EmbeddingDimensions,
                        result.Value.EmbeddingNorm,
                        result.Value.EmbeddingPreview);
                }
            }

            // If we haven't met our threshold, try with relaxed parameters
            if (attempt < MAX_RETRIES)
            {
                _logger.LogInformation("Attempt {Attempt} failed, retrying with relaxed parameters", attempt + 1);
                // Reduce similarity threshold for next attempt
                request.SimilarityThreshold = Math.Max(0.3, request.SimilarityThreshold - 0.1);
                request.MaxContextChunks += 3;
            }
        }

        return null;
    }

    private async Task<(string Answer, List<RetrievedChunk> RetrievedChunks, AnswerGradeInfo Grade, string Model, LlmPromptTrace PromptTrace, string EmbeddingProvider, int EmbeddingDimensions, double EmbeddingNorm, string EmbeddingPreview)?> AttemptAnswerAsync(
        string query,
        ChatRequest request)
    {
        try
        {
            // Get embedding for the question
            var embeddingProvider = _configuration["Embedding:Provider"] == "HuggingFace"
                ? EmbeddingProvider.HuggingFace
                : EmbeddingProvider.OpenAI;

            var questionEmbedding = await _embeddingService.GetEmbeddingAsync(query, embeddingProvider);
            var embeddingDimensions = questionEmbedding.Length;
            double squaredNormSum = 0;
            for (var i = 0; i < questionEmbedding.Length; i++)
            {
                squaredNormSum += questionEmbedding[i] * questionEmbedding[i];
            }
            var embeddingNorm = Math.Sqrt(squaredNormSum);

            var previewValues = new List<string>();
            var previewCount = Math.Min(8, questionEmbedding.Length);
            for (var i = 0; i < previewCount; i++)
            {
                previewValues.Add(questionEmbedding[i].ToString("F4"));
            }
            var embeddingPreview = string.Join(", ", previewValues);

            // Search for relevant chunks
            var retrievedChunks = await _pineconeService.SearchSimilarChunksAsync(
                questionEmbedding,
                request.MaxContextChunks,
                request.SimilarityThreshold,
                request.DocumentId);

            if (retrievedChunks.Count == 0)
                return null;

            // Build context from retrieved chunks
            var context = string.Join("\n\n",
                retrievedChunks.Select(c => $"[From {c.DocumentName}]\n{c.Content}"));

            // Generate answer
            var systemPrompt = @"You are a helpful assistant that answers questions based on provided context. 
If the context doesn't contain relevant information, say you don't have enough information to answer.
Do not include citations in the middle of the answer.
Do not include a sources/citations section yourself. The system will append citations at the end.";

            var userPrompt = $@"Context:
{context}

Question: {query}

Please answer the question based on the context provided above.";

            var promptTrace = new LlmPromptTrace
            {
                Provider = "HuggingFace",
                Model = GetHuggingFaceGenerationModel(),
                SystemPrompt = systemPrompt,
                UserPrompt = userPrompt,
                CombinedPrompt = $"System:\n{systemPrompt}\n\nUser:\n{userPrompt}",
                SentToLlm = false,
                Notes = "Prompt prepared after retrieval."
            };

            string answer;
            AnswerGradeInfo grade;
            string modelUsed;

            if (HasHuggingFaceGenerationConfig())
            {
                try
                {
                    promptTrace.SentToLlm = true;
                    promptTrace.Notes = "Prompt sent to HuggingFace generation endpoint.";
                    answer = await GetHuggingFaceAnswer(systemPrompt, userPrompt, request.Temperature);
                    answer = AppendCitationsAtEnd(answer, retrievedChunks);
                    modelUsed = GetHuggingFaceGenerationModel();

                    // Grade the answer
                    var gradeResult = await _answerGradingService.GradeAnswerAsync(query, answer, retrievedChunks);

                    _logger.LogInformation(
                        "Answer generated. Query: '{Query}'. Relevancy Score: {Score}. Grade: {Grade}",
                        query, gradeResult.RelevancyScore, gradeResult.IsRelevant ? "PASS" : "FAIL");

                    // Only return if answer meets relevancy threshold
                    if (!gradeResult.IsRelevant)
                        return null;

                    grade = new AnswerGradeInfo
                    {
                        RelevancyScore = gradeResult.RelevancyScore,
                        IsRelevant = gradeResult.IsRelevant,
                        Reasoning = gradeResult.Reasoning,
                        Issues = gradeResult.Issues
                    };
                }
                catch (HttpRequestException ex)
                {
                    _logger.LogWarning(ex,
                        "HuggingFace generation failed for query '{Query}'. Falling back to extractive response.",
                        query);

                    promptTrace.SentToLlm = true;
                    promptTrace.Notes = $"Generation call failed: {ex.Message}";

                    answer = AppendCitationsAtEnd(BuildExtractiveAnswer(retrievedChunks), retrievedChunks);
                    grade = new AnswerGradeInfo
                    {
                        RelevancyScore = Math.Max(RELEVANCY_THRESHOLD, retrievedChunks.Max(chunk => chunk.SimilarityScore)),
                        IsRelevant = true,
                        Reasoning = "Generated from retrieved document content because HuggingFace generation was temporarily unavailable.",
                        Issues = new List<string>()
                    };
                    modelUsed = "extractive-fallback";
                }
            }
            else
            {
                answer = AppendCitationsAtEnd(BuildExtractiveAnswer(retrievedChunks), retrievedChunks);
                grade = new AnswerGradeInfo
                {
                    RelevancyScore = Math.Max(RELEVANCY_THRESHOLD, retrievedChunks.Max(chunk => chunk.SimilarityScore)),
                    IsRelevant = true,
                    Reasoning = "Returned directly from retrieved document content because HuggingFace generation is not configured.",
                    Issues = new List<string>()
                };
                modelUsed = "extractive-fallback";
                promptTrace.SentToLlm = false;
                promptTrace.Notes = "Generation was not attempted because HuggingFace generation is not configured.";
            }

            return (
                Answer: answer,
                RetrievedChunks: retrievedChunks,
                Grade: grade,
                Model: modelUsed,
                PromptTrace: promptTrace,
                EmbeddingProvider: embeddingProvider.ToString(),
                EmbeddingDimensions: embeddingDimensions,
                EmbeddingNorm: embeddingNorm,
                EmbeddingPreview: embeddingPreview
            );
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error in attempt with query: {Query}", query);
            return null;
        }
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

    private static string BuildExtractiveAnswer(List<RetrievedChunk> retrievedChunks)
    {
        var topChunk = retrievedChunks
            .OrderByDescending(chunk => chunk.SimilarityScore)
            .First();

        var sentences = topChunk.Content
            .Split(new[] { '.', '!', '?' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(sentence => sentence.Trim())
            .Where(sentence => !string.IsNullOrWhiteSpace(sentence))
            .ToList();

        var bestSentence = sentences.FirstOrDefault() ?? topChunk.Content.Trim();
        return $"{bestSentence}.";
    }

    private static string AppendCitationsAtEnd(string answer, List<RetrievedChunk> retrievedChunks)
    {
        var cleaned = RemoveExistingCitationLines(answer);
        if (retrievedChunks.Count == 0)
            return cleaned;

        var uniqueSources = retrievedChunks
            .OrderByDescending(chunk => chunk.SimilarityScore)
            .GroupBy(chunk => chunk.DocumentName, StringComparer.OrdinalIgnoreCase)
            .Select(group => $"- {group.First().DocumentName} ({group.Max(c => c.SimilarityScore):F3})")
            .ToList();

        return $"{cleaned}\n\nCitations:\n{string.Join("\n", uniqueSources)}";
    }

    private static string RemoveExistingCitationLines(string answer)
    {
        if (string.IsNullOrWhiteSpace(answer))
            return string.Empty;

        var lines = answer
            .Split('\n')
            .Select(line => line.TrimEnd('\r'))
            .Where(line =>
            {
                var normalized = line.Trim().ToLowerInvariant();
                return !normalized.StartsWith("source:")
                    && !normalized.StartsWith("sources:")
                    && !normalized.StartsWith("citation:")
                    && !normalized.StartsWith("citations:");
            })
            .ToList();

        return string.Join("\n", lines).Trim();
    }

    private static string TruncateForLog(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        var normalized = value.Replace("\r", " ").Replace("\n", " ").Trim();
        if (normalized.Length <= maxLength)
            return normalized;

        return normalized[..maxLength] + "...";
    }

    private async Task<ChatResponse> GetAnswerFromWebAsync(string question, ChatResponse response)
    {
        try
        {
            var searchResult = await _webSearchService.SearchAsync(question, maxResults: 3);

            if (searchResult.Success && !string.IsNullOrEmpty(searchResult.Summary))
            {
                // Generate answer based on web search results
                var webPrompt = $@"Based on these web search results, answer the question briefly:

Question: {question}

Web Results:
{searchResult.Summary}

Provide a concise answer based on the web results.";

                var answer = await CallHuggingFaceWithContextAsync(webPrompt);

                response.Answer = searchResult.Summary.Length > 500
                    ? $"{answer}\n\n{searchResult.Summary.Substring(0, 500)}..."
                    : $"{answer}\n\n{searchResult.Summary}";

                response.WebSource = new WebSourceInfo
                {
                    UsedWebSearch = true,
                    SearchQuery = question,
                    Sources = searchResult.Results
                        .Select(r => new WebSourceReference
                        {
                            Title = r.Title,
                            Url = r.Url,
                            Snippet = r.Snippet
                        })
                        .ToList(),
                    Disclaimer = "[⚠️ Web Search Result - Limited Knowledge, not from your documents]"
                };

                response.Answer = response.WebSource.Disclaimer + "\n\n" + response.Answer;
            }
            else
            {
                response.Answer = "I couldn't find relevant information in your documents or web search. " +
                    "Please try rephrasing your question or uploading more relevant documents.";
            }

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error performing web search fallback");
            response.Answer = "Unable to find an answer to your question. Please try again or upload more documents.";
            return response;
        }
    }

    private async Task<string> GetHuggingFaceAnswer(string systemPrompt, string userPrompt, double temperature = 0.7)
    {
        var apiKey = _configuration["HuggingFace:ApiKey"];
        if (string.IsNullOrEmpty(apiKey))
            throw new InvalidOperationException("HuggingFace API key not configured");

        var model = GetHuggingFaceGenerationModel();
        var endpoint = GetHuggingFaceChatEndpoint();

        var request = new
        {
            model,
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userPrompt }
            },
            temperature = temperature,
            max_tokens = 600
        };

        _httpClient.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);

        for (int attempt = 0; attempt < 3; attempt++)
        {
            var content = new StringContent(
                System.Text.Json.JsonSerializer.Serialize(request),
                System.Text.Encoding.UTF8,
                "application/json");

            var response = await _httpClient.PostAsync(
                endpoint,
                content);

            if ((int)response.StatusCode == 429 || (int)response.StatusCode >= 500)
            {
                if (attempt < 2)
                {
                    await Task.Delay(TimeSpan.FromMilliseconds(800 * (attempt + 1)));
                    continue;
                }
            }

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

        throw new HttpRequestException("HuggingFace generation failed after retries");
    }

    private async Task<string> CallHuggingFaceWithContextAsync(string prompt, double temperature = 0.7)
    {
        var apiKey = _configuration["HuggingFace:ApiKey"];
        if (string.IsNullOrEmpty(apiKey))
            return prompt;

        try
        {
            var endpoint = GetHuggingFaceChatEndpoint();
            var request = new
            {
                model = GetHuggingFaceGenerationModel(),
                messages = new[]
                {
                    new { role = "system", content = "You are a helpful assistant." },
                    new { role = "user", content = prompt }
                },
                temperature = temperature,
                max_tokens = 1000
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

            if (!response.IsSuccessStatusCode)
                return prompt;

            var jsonResponse = await response.Content.ReadAsStringAsync();
            using var doc = System.Text.Json.JsonDocument.Parse(jsonResponse);
            var message = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            return message ?? prompt;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error calling HuggingFace generation endpoint");
            return prompt;
        }
    }

    private int EstimateTokens(string text)
    {
        // Rough estimation: 1 token ≈ 4 characters
        return (text.Length / 4) + 10;
    }
}



