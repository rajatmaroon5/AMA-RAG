namespace AmaRAGBackend.Services;

using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using System.Linq;

/// <summary>
/// Interface for SharePoint integration
/// </summary>
public interface ISharePointService
{
    Task<string> GetOAuthUrlAsync();
    Task<SharePointTokenResponse> ExchangeAuthCodeAsync(string code);
    Task<List<SharePointSite>> GetSitesAsync(string accessToken);
    Task<List<SharePointLibrary>> GetLibrariesAsync(string siteId, string accessToken);
    Task<List<SharePointDocument>> GetDocumentsAsync(string siteId, string libraryId, string accessToken);
    Task<byte[]> DownloadDocumentAsync(string webUrl, string accessToken);
}

/// <summary>
/// Data models for SharePoint
/// </summary>
public class SharePointTokenResponse
{
    public string AccessToken { get; set; }
    public int ExpiresIn { get; set; }
    public string RefreshToken { get; set; }
}

public class SharePointSite
{
    public string Id { get; set; }
    public string DisplayName { get; set; }
    public string WebUrl { get; set; }
}

public class SharePointLibrary
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
}

public class SharePointDocument
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string WebUrl { get; set; }
    public string LastModifiedDateTime { get; set; }
    public long Size { get; set; }
    public string ContentType { get; set; }
}

/// <summary>
/// Implementation of SharePoint integration service
/// </summary>
public class SharePointService : ISharePointService
{
    private readonly ILogger<SharePointService> _logger;
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    
    private const string MicrosoftGraphBaseUrl = "https://graph.microsoft.com/v1.0";

    public SharePointService(
        ILogger<SharePointService> logger,
        IConfiguration configuration,
        HttpClient httpClient)
    {
        _logger = logger;
        _configuration = configuration;
        _httpClient = httpClient;
    }

    /// <summary>
    /// Get OAuth URL for SharePoint authentication
    /// </summary>
    public Task<string> GetOAuthUrlAsync()
    {
        EnsureOAuthConfiguration(requireClientSecret: false);

        var clientId = _configuration["SharePoint:ClientId"];
        var redirectUri = _configuration["SharePoint:RedirectUri"];
        var tenant = ResolveAuthorityTenant();
        var scopes = Uri.EscapeDataString("https://graph.microsoft.com/.default offline_access");

        var oAuthUrl = $"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize?" +
            $"client_id={clientId}" +
            $"&redirect_uri={Uri.EscapeDataString(redirectUri)}" +
            $"&response_type=code" +
            $"&scope={scopes}";

        _logger.LogInformation("Generated OAuth URL for SharePoint");
        return Task.FromResult(oAuthUrl);
    }

    /// <summary>
    /// Exchange authorization code for access token
    /// </summary>
    public async Task<SharePointTokenResponse> ExchangeAuthCodeAsync(string code)
    {
        try
        {
            EnsureOAuthConfiguration(requireClientSecret: true);

            var clientId = _configuration["SharePoint:ClientId"];
            var clientSecret = _configuration["SharePoint:ClientSecret"];
            var redirectUri = _configuration["SharePoint:RedirectUri"];
            var tenant = ResolveAuthorityTenant();

            var tokenEndpoint = $"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token";

            var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                { "client_id", clientId },
                { "client_secret", clientSecret },
                { "code", code },
                { "redirect_uri", redirectUri },
                { "grant_type", "authorization_code" },
                { "scope", "https://graph.microsoft.com/.default offline_access" }
            });

            var response = await _httpClient.PostAsync(tokenEndpoint, content);
            response.EnsureSuccessStatusCode();

            var jsonResponse = await response.Content.ReadAsStringAsync();
            var jsonDoc = JsonDocument.Parse(jsonResponse);
            var root = jsonDoc.RootElement;

            return new SharePointTokenResponse
            {
                AccessToken = root.GetProperty("access_token").GetString(),
                ExpiresIn = root.GetProperty("expires_in").GetInt32(),
                RefreshToken = root.TryGetProperty("refresh_token", out var refreshToken) 
                    ? refreshToken.GetString() 
                    : null
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error exchanging auth code for token");
            throw;
        }
    }

    /// <summary>
    /// Get list of SharePoint sites accessible to the user
    /// </summary>
    public async Task<List<SharePointSite>> GetSitesAsync(string accessToken)
    {
        try
        {
            var headers = new AuthenticationHeaderValue("Bearer", accessToken);
            _httpClient.DefaultRequestHeaders.Authorization = headers;

            var response = await _httpClient.GetAsync($"{MicrosoftGraphBaseUrl}/me/sites");
            response.EnsureSuccessStatusCode();

            var jsonResponse = await response.Content.ReadAsStringAsync();
            var jsonDoc = JsonDocument.Parse(jsonResponse);
            var sites = new List<SharePointSite>();

            if (jsonDoc.RootElement.TryGetProperty("value", out var values))
            {
                foreach (var site in values.EnumerateArray())
                {
                    sites.Add(new SharePointSite
                    {
                        Id = site.GetProperty("id").GetString(),
                        DisplayName = site.GetProperty("displayName").GetString(),
                        WebUrl = site.GetProperty("webUrl").GetString()
                    });
                }
            }

            _logger.LogInformation("Retrieved {SiteCount} SharePoint sites", sites.Count);
            return sites;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving SharePoint sites");
            throw;
        }
    }

    /// <summary>
    /// Get document libraries in a SharePoint site
    /// </summary>
    public async Task<List<SharePointLibrary>> GetLibrariesAsync(string siteId, string accessToken)
    {
        try
        {
            var headers = new AuthenticationHeaderValue("Bearer", accessToken);
            _httpClient.DefaultRequestHeaders.Authorization = headers;

            var response = await _httpClient.GetAsync($"{MicrosoftGraphBaseUrl}/sites/{siteId}/drives");
            response.EnsureSuccessStatusCode();

            var jsonResponse = await response.Content.ReadAsStringAsync();
            var jsonDoc = JsonDocument.Parse(jsonResponse);
            var libraries = new List<SharePointLibrary>();

            if (jsonDoc.RootElement.TryGetProperty("value", out var values))
            {
                foreach (var drive in values.EnumerateArray())
                {
                    libraries.Add(new SharePointLibrary
                    {
                        Id = drive.GetProperty("id").GetString(),
                        Name = drive.GetProperty("name").GetString(),
                        Description = drive.TryGetProperty("description", out var desc) 
                            ? desc.GetString() 
                            : null
                    });
                }
            }

            _logger.LogInformation("Retrieved {LibraryCount} libraries from site {SiteId}", libraries.Count, siteId);
            return libraries;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving SharePoint libraries");
            throw;
        }
    }

    /// <summary>
    /// Get documents in a SharePoint library
    /// </summary>
    public async Task<List<SharePointDocument>> GetDocumentsAsync(string siteId, string libraryId, string accessToken)
    {
        try
        {
            var headers = new AuthenticationHeaderValue("Bearer", accessToken);
            _httpClient.DefaultRequestHeaders.Authorization = headers;

            // Get all items in the drive, filtering for documents
            var response = await _httpClient.GetAsync(
                $"{MicrosoftGraphBaseUrl}/drives/{libraryId}/root/children?" +
                "$filter=not(endsWith(name, '.aspx')) and not(endsWith(name, '.vti_*'))" +
                "&$select=id,name,webUrl,lastModifiedDateTime,size,file,folder");
            
            response.EnsureSuccessStatusCode();

            var jsonResponse = await response.Content.ReadAsStringAsync();
            var jsonDoc = JsonDocument.Parse(jsonResponse);
            var documents = new List<SharePointDocument>();

            if (jsonDoc.RootElement.TryGetProperty("value", out var values))
            {
                foreach (var item in values.EnumerateArray())
                {
                    // Only include files, not folders
                    if (item.TryGetProperty("file", out _) && !item.TryGetProperty("folder", out _))
                    {
                        documents.Add(new SharePointDocument
                        {
                            Id = item.GetProperty("id").GetString(),
                            Name = item.GetProperty("name").GetString(),
                            WebUrl = item.GetProperty("webUrl").GetString(),
                            LastModifiedDateTime = item.GetProperty("lastModifiedDateTime").GetString(),
                            Size = item.GetProperty("size").GetInt64(),
                            ContentType = GetContentType(item.GetProperty("name").GetString())
                        });
                    }
                }
            }

            _logger.LogInformation("Retrieved {DocumentCount} documents from library {LibraryId}", documents.Count, libraryId);
            return documents;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving SharePoint documents");
            throw;
        }
    }

    /// <summary>
    /// Download a document from SharePoint
    /// </summary>
    public async Task<byte[]> DownloadDocumentAsync(string webUrl, string accessToken)
    {
        try
        {
            var headers = new AuthenticationHeaderValue("Bearer", accessToken);
            _httpClient.DefaultRequestHeaders.Authorization = headers;

            var response = await _httpClient.GetAsync(webUrl + "?download=1");
            response.EnsureSuccessStatusCode();

            return await response.Content.ReadAsByteArrayAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error downloading SharePoint document");
            throw;
        }
    }

    private string GetContentType(string fileName)
    {
        var extension = System.IO.Path.GetExtension(fileName).ToLower();
        return extension switch
        {
            ".pdf" => "application/pdf",
            ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".doc" => "application/msword",
            ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".txt" => "text/plain",
            _ => "application/octet-stream"
        };
    }

    private string ResolveAuthorityTenant()
    {
        var tenantId = _configuration["SharePoint:TenantId"];
        if (string.IsNullOrWhiteSpace(tenantId) || IsPlaceholderValue(tenantId))
        {
            return "common";
        }

        return tenantId.Trim();
    }

    private void EnsureOAuthConfiguration(bool requireClientSecret)
    {
        var clientId = _configuration["SharePoint:ClientId"];
        var redirectUri = _configuration["SharePoint:RedirectUri"];
        var tenantId = _configuration["SharePoint:TenantId"];
        var clientSecret = _configuration["SharePoint:ClientSecret"];

        if (string.IsNullOrWhiteSpace(clientId) || IsPlaceholderValue(clientId))
        {
            throw new InvalidOperationException("SharePoint OAuth is not configured: set SharePoint:ClientId to your Azure App Registration client ID.");
        }

        if (string.IsNullOrWhiteSpace(redirectUri) || IsPlaceholderValue(redirectUri))
        {
            throw new InvalidOperationException("SharePoint OAuth is not configured: set SharePoint:RedirectUri to your registered redirect URI.");
        }

        if (string.IsNullOrWhiteSpace(tenantId) || IsPlaceholderValue(tenantId))
        {
            throw new InvalidOperationException("SharePoint OAuth is not configured: set SharePoint:TenantId to your tenant GUID or domain (for example, publicisgroupe.onmicrosoft.com).");
        }

        if (requireClientSecret && (string.IsNullOrWhiteSpace(clientSecret) || IsPlaceholderValue(clientSecret)))
        {
            throw new InvalidOperationException("SharePoint OAuth is not configured: set SharePoint:ClientSecret to your Azure App Registration client secret.");
        }
    }

    private static bool IsPlaceholderValue(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return true;
        }

        var normalized = value.Trim().ToLowerInvariant();
        return normalized.StartsWith("your-") || normalized.Contains("placeholder");
    }
}
