namespace AmaRAGBackend.Endpoints;

using AmaRAGBackend.Models;
using AmaRAGBackend.Services;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Threading.Tasks;

/// <summary>
/// Extension methods for SharePoint endpoints
/// </summary>
public static class SharePointEndpoints
{
    public static RouteGroupBuilder AddSharePointEndpoints(this RouteGroupBuilder group)
    {
        var sharepointGroup = group.MapGroup("/sharepoint")
            .WithName("SharePoint")
            .WithOpenApi();

        sharepointGroup.MapGet("/auth/oauth-url", GetOAuthUrl)
            .WithName("SharePoint Get OAuth URL")
            .WithDescription("Get SharePoint OAuth authorization URL")
            .Produces<string>(StatusCodes.Status200OK);

        sharepointGroup.MapPost("/auth/token", ExchangeAuthCode)
            .WithName("SharePoint Exchange Auth Code")
            .WithDescription("Exchange authorization code for access token")
            .Accepts<AuthCodeRequest>("application/json")
            .Produces<SharePointTokenResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest);

        sharepointGroup.MapGet("/sites", GetSites)
            .WithName("SharePoint Get Sites")
            .WithDescription("Get list of accessible SharePoint sites")
            .Produces<List<SharePointSite>>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status401Unauthorized);

        sharepointGroup.MapGet("/sites/{siteId}/libraries", GetLibraries)
            .WithName("SharePoint Get Libraries")
            .WithDescription("Get document libraries in a SharePoint site")
            .Produces<List<SharePointLibrary>>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status401Unauthorized);

        sharepointGroup.MapGet("/sites/{siteId}/libraries/{libraryId}/documents", GetDocuments)
            .WithName("SharePoint Get Documents")
            .WithDescription("Get documents in a SharePoint library")
            .Produces<List<SharePointDocument>>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status401Unauthorized);

        sharepointGroup.MapPost("/sites/{siteId}/libraries/{libraryId}/documents/{documentId}/import", ImportDocument)
            .WithName("SharePoint Import Document")
            .WithDescription("Download and import a document from SharePoint")
            .Produces<UploadDocumentResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status401Unauthorized);

        return sharepointGroup;
    }

    private static async Task<IResult> GetOAuthUrl(ISharePointService sharePointService)
    {
        try
        {
            var url = await sharePointService.GetOAuthUrlAsync();
            return Results.Ok(url);
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> ExchangeAuthCode(
        [FromBody] AuthCodeRequest request,
        ISharePointService sharePointService)
    {
        try
        {
            if (string.IsNullOrEmpty(request.Code))
                return Results.BadRequest(new { error = "Authorization code is required" });

            var token = await sharePointService.ExchangeAuthCodeAsync(request.Code);
            return Results.Ok(token);
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> GetSites(
        [FromHeader(Name = "Authorization")] string authorization,
        ISharePointService sharePointService,
        ILogger<SharePointEndpointLog> logger)
    {
        try
        {
            var token = ExtractTokenFromHeader(authorization);
            if (string.IsNullOrEmpty(token))
                return Results.Unauthorized();

            var sites = await sharePointService.GetSitesAsync(token);
            return Results.Ok(sites);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error getting sites");
            return Results.Problem(ex.Message, statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    private static async Task<IResult> GetLibraries(
        string siteId,
        [FromHeader(Name = "Authorization")] string authorization,
        ISharePointService sharePointService,
        ILogger<SharePointEndpointLog> logger)
    {
        try
        {
            var token = ExtractTokenFromHeader(authorization);
            if (string.IsNullOrEmpty(token))
                return Results.Unauthorized();

            var libraries = await sharePointService.GetLibrariesAsync(siteId, token);
            return Results.Ok(libraries);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error getting libraries");
            return Results.Problem(ex.Message, statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    private static async Task<IResult> GetDocuments(
        string siteId,
        string libraryId,
        [FromHeader(Name = "Authorization")] string authorization,
        ISharePointService sharePointService,
        ILogger<SharePointEndpointLog> logger)
    {
        try
        {
            var token = ExtractTokenFromHeader(authorization);
            if (string.IsNullOrEmpty(token))
                return Results.Unauthorized();

            var documents = await sharePointService.GetDocumentsAsync(siteId, libraryId, token);
            return Results.Ok(documents);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error getting documents");
            return Results.Problem(ex.Message, statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    private static async Task<IResult> ImportDocument(
        string siteId,
        string libraryId,
        string documentId,
        [FromHeader(Name = "Authorization")] string authorization,
        ISharePointService sharePointService,
        IDocumentService documentService,
        ILogger<SharePointEndpointLog> logger)
    {
        try
        {
            var token = ExtractTokenFromHeader(authorization);
            if (string.IsNullOrEmpty(token))
                return Results.Unauthorized();

            // Get the document to retrieve download URL
            var documents = await sharePointService.GetDocumentsAsync(siteId, libraryId, token);
            var document = documents.FirstOrDefault(d => d.Id == documentId);

            if (document == null)
                return Results.NotFound(new { error = "Document not found" });

            // Download the document
            var fileBytes = await sharePointService.DownloadDocumentAsync(document.WebUrl, token);

            // Create a temporary file and upload it as a form file
            var fileName = document.Name;
            var extension = System.IO.Path.GetExtension(fileName);
            var tempPath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), Guid.NewGuid() + extension);

            try
            {
                // Save to temporary location
                await System.IO.File.WriteAllBytesAsync(tempPath, fileBytes);

                // Create form file
                using (var stream = System.IO.File.OpenRead(tempPath))
                {
                    var formFile = new FormFile(
                        stream,
                        0,
                        fileBytes.Length,
                        "file",
                        fileName)
                    {
                        Headers = new Microsoft.AspNetCore.Http.HeaderDictionary(),
                        ContentType = document.ContentType
                    };

                    // Upload using document service
                    var result = await documentService.UploadDocumentAsync(formFile);
                    return Results.Ok(result);
                }
            }
            finally
            {
                // Cleanup temp file
                if (System.IO.File.Exists(tempPath))
                    System.IO.File.Delete(tempPath);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error importing document from SharePoint");
            return Results.Problem(ex.Message, statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    private static string ExtractTokenFromHeader(string authorization)
    {
        if (string.IsNullOrEmpty(authorization))
            return null;

        const string bearerPrefix = "Bearer ";
        if (authorization.StartsWith(bearerPrefix, StringComparison.OrdinalIgnoreCase))
            return authorization.Substring(bearerPrefix.Length);

        return null;
    }
}

public sealed class SharePointEndpointLog
{
}

/// <summary>
/// Request model for auth code exchange
/// </summary>
public class AuthCodeRequest
{
    public string Code { get; set; }
}
