namespace AmaRAGBackend.Services;

using System.Text.Json;

/// <summary>
/// Result returned by the weather MCP service
/// </summary>
public class WeatherMcpResult
{
    public bool Success { get; set; }
    public string Location { get; set; } = string.Empty;
    public string FormattedData { get; set; } = string.Empty;
}

/// <summary>
/// Fetches live weather data via wttr.in — the same source used by the VS Code MCP weather tools.
/// </summary>
public class WeatherMcpService : IWeatherMcpService
{
    private readonly ILogger<WeatherMcpService> _logger;
    private readonly HttpClient _httpClient;

    public WeatherMcpService(ILogger<WeatherMcpService> logger, HttpClient httpClient)
    {
        _logger = logger;
        _httpClient = httpClient;
    }

    public async Task<WeatherMcpResult> GetCurrentWeatherAsync(string location)
    {
        var result = new WeatherMcpResult { Location = location };

        try
        {
            var url = $"https://wttr.in/{Uri.EscapeDataString(location)}?format=j1";
            SetUserAgentIfAbsent();

            var response = await _httpClient.GetAsync(url);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("wttr.in request failed for '{Location}' with status {Status}", location, response.StatusCode);
                return result;
            }

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var current  = root.GetProperty("current_condition")[0];
            var temp      = current.GetProperty("temp_C").GetString() ?? "?";
            var feelsLike = current.GetProperty("FeelsLikeC").GetString() ?? "?";
            var desc      = current.GetProperty("weatherDesc")[0].GetProperty("value").GetString() ?? "Unknown";
            var humidity  = current.GetProperty("humidity").GetString() ?? "?";
            var wind      = current.GetProperty("windspeedKmph").GetString() ?? "?";

            result.FormattedData =
                $"Current weather in {location}:\n" +
                $"  Temperature: {temp}°C (feels like {feelsLike}°C)\n" +
                $"  Condition: {desc}\n" +
                $"  Humidity: {humidity}%\n" +
                $"  Wind speed: {wind} km/h";

            result.Success = true;
            _logger.LogInformation("Weather fetched for '{Location}': {Desc}, {Temp}°C", location, desc, temp);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching current weather for '{Location}'", location);
        }

        return result;
    }

    public async Task<WeatherMcpResult> GetWeatherForecastAsync(string location, int days = 3)
    {
        var result = new WeatherMcpResult { Location = location };

        try
        {
            var url = $"https://wttr.in/{Uri.EscapeDataString(location)}?format=j1";
            SetUserAgentIfAbsent();

            var response = await _httpClient.GetAsync(url);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("wttr.in forecast request failed for '{Location}'", location);
                return result;
            }

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var current  = root.GetProperty("current_condition")[0];
            var temp     = current.GetProperty("temp_C").GetString() ?? "?";
            var desc     = current.GetProperty("weatherDesc")[0].GetProperty("value").GetString() ?? "Unknown";
            var humidity = current.GetProperty("humidity").GetString() ?? "?";
            var wind     = current.GetProperty("windspeedKmph").GetString() ?? "?";

            var sb = new System.Text.StringBuilder();
            sb.AppendLine($"Current weather in {location}:");
            sb.AppendLine($"  Temperature: {temp}°C | Condition: {desc} | Humidity: {humidity}% | Wind: {wind} km/h");
            sb.AppendLine();
            sb.AppendLine($"{Math.Min(days, 3)}-day forecast:");

            var weather = root.GetProperty("weather");
            int count = Math.Min(days, weather.GetArrayLength());
            for (int i = 0; i < count; i++)
            {
                var day     = weather[i];
                var date    = day.GetProperty("date").GetString();
                var maxTemp = day.GetProperty("maxtempC").GetString();
                var minTemp = day.GetProperty("mintempC").GetString();
                var dayDesc = day.GetProperty("hourly")[4]
                                 .GetProperty("weatherDesc")[0]
                                 .GetProperty("value").GetString() ?? "--";
                sb.AppendLine($"  {date}: High {maxTemp}°C / Low {minTemp}°C — {dayDesc}");
            }

            result.FormattedData = sb.ToString().TrimEnd();
            result.Success = true;
            _logger.LogInformation("Weather forecast fetched for '{Location}' ({Days} days)", location, days);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching weather forecast for '{Location}'", location);
        }

        return result;
    }

    private void SetUserAgentIfAbsent()
    {
        if (!_httpClient.DefaultRequestHeaders.UserAgent.Any())
        {
            _httpClient.DefaultRequestHeaders.UserAgent.Add(
                new System.Net.Http.Headers.ProductInfoHeaderValue("ama-rag-weather-mcp", "1.0"));
        }
    }
}
