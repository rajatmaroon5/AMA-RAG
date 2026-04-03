namespace AmaRAGBackend.Endpoints;

using AmaRAGBackend.Models;
using AmaRAGBackend.Services;
using Microsoft.AspNetCore.Mvc;

/// <summary>
/// Extension methods for document endpoints
/// </summary>
public static class DocumentEndpoints
{
    public static RouteGroupBuilder AddDocumentEndpoints(this RouteGroupBuilder group)
    {
        var documentGroup = group.MapGroup("/documents")
            .WithName("Documents")
            .WithOpenApi();

        documentGroup.MapPost("/upload", UploadDocument)
            .WithName("Upload Document")
            .WithDescription("Upload a document (PDF, DOCX, or XLSX) to be indexed")
            .Accepts<IFormFile>("multipart/form-data")
            .DisableAntiforgery()
            .Produces<UploadDocumentResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest);

        documentGroup.MapGet("/", GetDocuments)
            .WithName("Get Documents")
            .WithDescription("Get list of all uploaded documents")
            .Produces<List<DocumentListResponse>>(StatusCodes.Status200OK);

        documentGroup.MapGet("/{documentId}", GetDocument)
            .WithName("Get Document")
            .WithDescription("Get details of a specific document")
            .Produces<DocumentListResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);

        documentGroup.MapDelete("/{documentId}", DeleteDocument)
            .WithName("Delete Document")
            .WithDescription("Delete a document and its embeddings")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);

        documentGroup.MapGet("/{documentId}/chunks", GetDocumentChunks)
            .WithName("Get Document Chunks")
            .WithDescription("Get all chunks for a specific document")
            .Produces<List<DocumentChunk>>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);

        documentGroup.MapGet("/{documentId}/preview", PreviewDocument)
            .WithName("Preview Document")
            .WithDescription("Preview the original uploaded document in browser")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);

        return group;
    }

    private static async Task<IResult> UploadDocument(
        [FromForm] IFormFile file,
        IDocumentService documentService)
    {
        try
        {
            var result = await documentService.UploadDocumentAsync(file);
            return Results.Ok(result);
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> GetDocuments(IDocumentService documentService)
    {
        var documents = await documentService.GetDocumentsAsync();
        return Results.Ok(documents);
    }

    private static async Task<IResult> GetDocument(Guid documentId, IDocumentService documentService)
    {
        var document = await documentService.GetDocumentAsync(documentId);
        if (document == null)
            return Results.NotFound();

        var response = new DocumentListResponse
        {
            Id = document.Id,
            Name = document.Name,
            UploadedAt = document.UploadedAt,
            IsProcessed = document.IsProcessed,
            ChunkCount = document.ChunkCount,
            ErrorMessage = document.ErrorMessage
        };

        return Results.Ok(response);
    }

    private static async Task<IResult> DeleteDocument(Guid documentId, IDocumentService documentService)
    {
        var document = await documentService.GetDocumentAsync(documentId);
        if (document == null)
            return Results.NotFound();

        await documentService.DeleteDocumentAsync(documentId);
        return Results.Ok(new { message = "Document deleted successfully" });
    }

    private static async Task<IResult> GetDocumentChunks(Guid documentId, IDocumentService documentService)
    {
        var document = await documentService.GetDocumentAsync(documentId);
        if (document == null)
            return Results.NotFound();

        var chunks = await documentService.GetDocumentChunksAsync(documentId);
        return Results.Ok(chunks);
    }

    private static async Task<IResult> PreviewDocument(Guid documentId, IDocumentService documentService)
    {
        var document = await documentService.GetDocumentAsync(documentId);
        if (document == null || string.IsNullOrWhiteSpace(document.FilePath) || !System.IO.File.Exists(document.FilePath))
            return Results.NotFound();

        return Results.File(
            path: document.FilePath,
            contentType: string.IsNullOrWhiteSpace(document.ContentType) ? "application/octet-stream" : document.ContentType,
            enableRangeProcessing: true);
    }
}
