namespace AmaRAGBackend.Services;

using System.Diagnostics;
using System.Text;
using System.Text.Json;

/// <summary>
/// Bridges .NET to the Python Gmail MCP server over stdio.
/// </summary>
public class GmailMcpService : IGmailMcpService
{
    private readonly ILogger<GmailMcpService> _logger;
    private readonly IConfiguration _configuration;

    public GmailMcpService(ILogger<GmailMcpService> logger, IConfiguration configuration)
    {
        _logger = logger;
        _configuration = configuration;
    }

    public Task<GmailMcpToolResult> GetUnreadEmailsAsync()
        => CallToolAsync("get-unread-emails", new Dictionary<string, object>());

    public Task<GmailMcpToolResult> ReadEmailAsync(string emailId)
        => CallToolAsync("read-email", new Dictionary<string, object> { ["email_id"] = emailId });

    public Task<GmailMcpToolResult> SendEmailAsync(string recipientId, string subject, string message)
        => CallToolAsync("send-email", new Dictionary<string, object>
        {
            ["recipient_id"] = recipientId,
            ["subject"] = subject,
            ["message"] = message
        });

    public Task<GmailMcpToolResult> TrashEmailAsync(string emailId)
        => CallToolAsync("trash-email", new Dictionary<string, object> { ["email_id"] = emailId });

    public Task<GmailMcpToolResult> MarkEmailAsReadAsync(string emailId)
        => CallToolAsync("mark-email-as-read", new Dictionary<string, object> { ["email_id"] = emailId });

    private async Task<GmailMcpToolResult> CallToolAsync(string toolName, Dictionary<string, object> arguments)
    {
        var result = new GmailMcpToolResult
        {
            ToolName = toolName,
            Success = false
        };

        var scriptPath = _configuration["GmailMcp:ScriptPath"];
        var credsPath = _configuration["GmailMcp:CredentialsFilePath"];
        var tokenPath = _configuration["GmailMcp:TokenPath"];
        var pythonExe = _configuration["GmailMcp:PythonExecutable"] ?? "python";
        var oauthPort = _configuration.GetValue<int?>("GmailMcp:OAuthPort") ?? 8080;
        var startupTimeoutSeconds = _configuration.GetValue<int?>("GmailMcp:StartupTimeoutSeconds") ?? 20;
        var toolTimeoutSeconds = _configuration.GetValue<int?>("GmailMcp:ToolTimeoutSeconds") ?? 45;

        if (string.IsNullOrWhiteSpace(scriptPath) || string.IsNullOrWhiteSpace(credsPath) || string.IsNullOrWhiteSpace(tokenPath))
        {
            result.ErrorMessage = "GmailMcp configuration is incomplete. Set ScriptPath, CredentialsFilePath, and TokenPath.";
            return result;
        }

        if (!File.Exists(scriptPath))
        {
            result.ErrorMessage = $"Gmail MCP script not found: {scriptPath}";
            return result;
        }

        if (!File.Exists(credsPath))
        {
            result.ErrorMessage = $"Gmail credentials file not found: {credsPath}";
            return result;
        }

        if (!File.Exists(tokenPath))
        {
            result.ErrorMessage =
                "Gmail token file not found. Run one-time OAuth bootstrap: " +
                $"{pythonExe} \"{scriptPath}\" --creds-file-path \"{credsPath}\" --token-path \"{tokenPath}\" --oauth-port {oauthPort} " +
                "and complete authorization in the browser. Then retry your Gmail chat request.";
            return result;
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = pythonExe,
            Arguments = $"\"{scriptPath}\" --creds-file-path \"{credsPath}\" --token-path \"{tokenPath}\" --oauth-port {oauthPort}",
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = new Process { StartInfo = startInfo };
        Task<string>? stderrTask = null;

        try
        {
            process.Start();
            stderrTask = process.StandardError.ReadToEndAsync();

            // Initialize handshake
            var initRequest = new
            {
                jsonrpc = "2.0",
                id = 1,
                method = "initialize",
                @params = new
                {
                    protocolVersion = "2024-11-05",
                    capabilities = new { },
                    clientInfo = new { name = "ama-rag-backend", version = "1.0.0" }
                }
            };

            await WriteMcpMessageAsync(process.StandardInput, initRequest);

            using var startupCts = new CancellationTokenSource(TimeSpan.FromSeconds(startupTimeoutSeconds));
            var initResponse = await ReadMcpMessageAsync(process.StandardOutput, startupCts.Token);
            if (!HasJsonRpcSuccess(initResponse))
            {
                var stderr = stderrTask != null ? await stderrTask : string.Empty;
                result.ErrorMessage = $"MCP initialize failed. Stderr: {stderr}";
                return result;
            }

            // Initialized notification
            var initializedNotification = new
            {
                jsonrpc = "2.0",
                method = "notifications/initialized",
                @params = new { }
            };
            await WriteMcpMessageAsync(process.StandardInput, initializedNotification);

            // Optional tool list call to verify server state
            var listToolsRequest = new
            {
                jsonrpc = "2.0",
                id = 2,
                method = "tools/list",
                @params = new { }
            };
            await WriteMcpMessageAsync(process.StandardInput, listToolsRequest);
            _ = await ReadMcpMessageAsync(process.StandardOutput, startupCts.Token);

            var toolCallRequest = new
            {
                jsonrpc = "2.0",
                id = 3,
                method = "tools/call",
                @params = new
                {
                    name = toolName,
                    arguments
                }
            };

            await WriteMcpMessageAsync(process.StandardInput, toolCallRequest);

            using var toolCts = new CancellationTokenSource(TimeSpan.FromSeconds(toolTimeoutSeconds));
            var toolResponse = await ReadMcpMessageAsync(process.StandardOutput, toolCts.Token);

            result.RawResponse = toolResponse.RootElement.GetRawText();
            result.Success = HasJsonRpcSuccess(toolResponse) && !IsToolError(toolResponse);

            if (!result.Success)
            {
                var stderr = stderrTask != null ? await stderrTask : string.Empty;
                var extractedError = ExtractError(toolResponse);
                result.ErrorMessage = !string.IsNullOrWhiteSpace(extractedError)
                    ? extractedError
                    : (!string.IsNullOrWhiteSpace(stderr) ? stderr : "Gmail MCP tool call returned an error.");
            }

            return result;
        }
        catch (OperationCanceledException)
        {
            var stderr = stderrTask != null ? await stderrTask : string.Empty;
            result.ErrorMessage = !string.IsNullOrWhiteSpace(stderr)
                ? $"Gmail MCP call timed out. Stderr: {stderr}"
                : "Gmail MCP call timed out.";
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling Gmail MCP tool {ToolName}", toolName);
            var stderr = stderrTask != null ? await stderrTask : string.Empty;
            result.ErrorMessage = !string.IsNullOrWhiteSpace(ex.Message)
                ? ex.Message
                : (!string.IsNullOrWhiteSpace(stderr) ? stderr : "Unexpected error while calling Gmail MCP tool.");
            return result;
        }
        finally
        {
            try
            {
                if (!process.HasExited)
                {
                    process.Kill(entireProcessTree: true);
                }
            }
            catch
            {
                // no-op
            }
        }
    }

    private static async Task WriteMcpMessageAsync(StreamWriter writer, object payload)
    {
        var json = JsonSerializer.Serialize(payload);
        var bytes = Encoding.UTF8.GetBytes(json);

        await writer.WriteAsync($"Content-Length: {bytes.Length}\r\n\r\n{json}");
        await writer.FlushAsync();
    }

    private static async Task<JsonDocument> ReadMcpMessageAsync(StreamReader reader, CancellationToken cancellationToken)
    {
        int contentLength = 0;

        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var line = await ReadLineWithCancellationAsync(reader, cancellationToken);
            if (line == null)
            {
                throw new InvalidOperationException("MCP server closed stream unexpectedly.");
            }

            if (string.IsNullOrWhiteSpace(line))
            {
                break;
            }

            if (line.StartsWith("Content-Length:", StringComparison.OrdinalIgnoreCase))
            {
                var value = line.Substring("Content-Length:".Length).Trim();
                if (!int.TryParse(value, out contentLength) || contentLength <= 0)
                {
                    throw new InvalidOperationException("Invalid MCP Content-Length header.");
                }
            }
        }

        if (contentLength <= 0)
        {
            throw new InvalidOperationException("Missing MCP Content-Length header.");
        }

        var buffer = new char[contentLength];
        int read = 0;
        while (read < contentLength)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var chunk = await reader.ReadAsync(buffer, read, contentLength - read);
            if (chunk == 0)
            {
                throw new InvalidOperationException("MCP payload ended unexpectedly.");
            }
            read += chunk;
        }

        var payload = new string(buffer);
        return JsonDocument.Parse(payload);
    }

    private static async Task<string?> ReadLineWithCancellationAsync(StreamReader reader, CancellationToken cancellationToken)
    {
        var readLineTask = reader.ReadLineAsync();
        var completed = await Task.WhenAny(readLineTask, Task.Delay(Timeout.Infinite, cancellationToken));
        if (completed != readLineTask)
        {
            throw new OperationCanceledException(cancellationToken);
        }

        return await readLineTask;
    }

    private static bool HasJsonRpcSuccess(JsonDocument response)
    {
        return response.RootElement.TryGetProperty("error", out _ ) == false
               && response.RootElement.TryGetProperty("result", out _);
    }

    private static bool IsToolError(JsonDocument response)
    {
        if (!response.RootElement.TryGetProperty("result", out var result))
            return true;

        if (result.TryGetProperty("isError", out var isError) && isError.ValueKind == JsonValueKind.True)
            return true;

        return false;
    }

    private static string? ExtractError(JsonDocument response)
    {
        if (response.RootElement.TryGetProperty("error", out var error))
        {
            return error.TryGetProperty("message", out var msg)
                ? msg.GetString()
                : error.GetRawText();
        }

        if (response.RootElement.TryGetProperty("result", out var result)
            && result.TryGetProperty("content", out var content)
            && content.ValueKind == JsonValueKind.Array
            && content.GetArrayLength() > 0)
        {
            var first = content[0];
            if (first.TryGetProperty("text", out var text))
                return text.GetString();
        }

        return null;
    }
}
