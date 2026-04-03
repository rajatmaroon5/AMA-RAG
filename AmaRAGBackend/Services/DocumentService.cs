namespace AmaRAGBackend.Services;

using AmaRAGBackend.Models;
using iTextSharp.text.pdf;
using iTextSharp.text.pdf.parser;
using DocumentFormat.OpenXml.Packaging;
using WordprocessingOpenXml = DocumentFormat.OpenXml.Wordprocessing;
using SpreadsheetOpenXml = DocumentFormat.OpenXml.Spreadsheet;
using System.IO;

/// <summary>
/// Implementation of document service
/// </summary>
public class DocumentService : IDocumentService
{
    private readonly ILogger<DocumentService> _logger;
    private readonly IEmbeddingService _embeddingService;
    private readonly IPineconeService _pineconeService;
    private readonly IChunkingService _chunkingService;
    private readonly IConfiguration _configuration;

    private static List<Document> _documents = new();
    private static List<DocumentChunk> _documentChunks = new();

    private sealed class ChunkPreparation
    {
        public string Content { get; set; } = string.Empty;
        public Dictionary<string, string> Metadata { get; set; } = new();
    }

    public DocumentService(
        ILogger<DocumentService> logger,
        IEmbeddingService embeddingService,
        IPineconeService pineconeService,
        IChunkingService chunkingService,
        IConfiguration configuration)
    {
        _logger = logger;
        _embeddingService = embeddingService;
        _pineconeService = pineconeService;
        _chunkingService = chunkingService;
        _configuration = configuration;
    }

    public async Task<UploadDocumentResponse> UploadDocumentAsync(IFormFile file)
    {
        try
        {
            if (file.Length == 0)
                throw new ArgumentException("File is empty");

            DebugBreak("Upload.Start");

            var uploadDir = _configuration["Upload:Directory"] ?? "uploads";
            Directory.CreateDirectory(uploadDir);

            var extension = System.IO.Path.GetExtension(file.FileName);
            var fileName = Guid.NewGuid().ToString() + extension;
            var filePath = System.IO.Path.Combine(uploadDir, fileName);

            // Save file
            using (var stream = System.IO.File.Create(filePath))
            {
                await file.CopyToAsync(stream);
            }

            DebugBreak("Upload.FileSaved");

            var isExcel = IsExcelFile(extension, file.ContentType);

            // Create document record
            var document = new Document
            {
                Id = Guid.NewGuid(),
                Name = file.FileName,
                ContentType = file.ContentType,
                FileSize = file.Length,
                UploadedAt = DateTime.UtcNow,
                FilePath = filePath,
                IsProcessed = false
            };

            _documents.Add(document);

            DebugBreak("Upload.DocumentRecordCreated", document.Id);

            // Chunk and embed
            List<ChunkPreparation> preparedChunks;
            if (isExcel)
            {
                preparedChunks = ExtractExcelRowChunks(filePath);
            }
            else
            {
                preparedChunks = BuildStandardChunks(filePath, file.ContentType);
            }

            if (preparedChunks.Count == 0)
                throw new InvalidOperationException("No readable content was extracted from the document");

            DebugBreak("Upload.ChunksPrepared", document.Id);

            var embeddingProvider = _configuration["Embedding:Provider"] == "HuggingFace" 
                ? EmbeddingProvider.HuggingFace 
                : EmbeddingProvider.OpenAI;

            var vectors = new List<VectorData>();

            for (int i = 0; i < preparedChunks.Count; i++)
            {
                var preparedChunk = preparedChunks[i];
                var chunk = preparedChunk.Content;

                if (i == 0 || i == preparedChunks.Count - 1)
                {
                    DebugBreak("Upload.EmbeddingBoundaryChunk", document.Id, i);
                }

                var embedding = await _embeddingService.GetEmbeddingAsync(chunk, embeddingProvider);

                var documentChunk = new DocumentChunk
                {
                    Id = Guid.NewGuid(),
                    DocumentId = document.Id,
                    Content = chunk,
                    ChunkIndex = i,
                    VectorId = $"{document.Id}_{i}",
                    CreatedAt = DateTime.UtcNow
                };

                _documentChunks.Add(documentChunk);

                var metadata = new Dictionary<string, string>
                {
                    { "documentId", document.Id.ToString() },
                    { "documentName", document.Name },
                    { "content", chunk },
                    { "chunkIndex", i.ToString() }
                };

                foreach (var item in preparedChunk.Metadata)
                {
                    metadata[item.Key] = item.Value;
                }

                vectors.Add(new VectorData
                {
                    Id = documentChunk.VectorId,
                    Values = embedding,
                    Metadata = metadata
                });
            }

            // Upsert to Pinecone
            DebugBreak("Upload.BeforePineconeUpsert", document.Id);
            await _pineconeService.UpsertVectorsAsync(vectors);

            document.IsProcessed = true;
            document.ChunkCount = preparedChunks.Count;
            var keyTopics = ExtractKeyTopics(string.Join("\n", preparedChunks.Select(chunk => chunk.Content)));

            _logger.LogInformation("Document {DocumentName} processed with {ChunkCount} chunks", document.Name, preparedChunks.Count);

            DebugBreak("Upload.Completed", document.Id);

            return new UploadDocumentResponse
            {
                DocumentId = document.Id,
                Name = document.Name,
                ChunkCount = preparedChunks.Count,
                IsProcessed = true,
                KeyTopics = keyTopics
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading document");
            throw;
        }
    }

    public Task<List<DocumentListResponse>> GetDocumentsAsync()
    {
        var documents = _documents.Select(d => new DocumentListResponse
        {
            Id = d.Id,
            Name = d.Name,
            UploadedAt = d.UploadedAt,
            IsProcessed = d.IsProcessed,
            ChunkCount = d.ChunkCount,
            ErrorMessage = d.ErrorMessage
        }).ToList();

        return Task.FromResult(documents);
    }

    public Task<List<DocumentChunk>> GetDocumentChunksAsync(Guid documentId)
    {
        var chunks = _documentChunks
            .Where(c => c.DocumentId == documentId)
            .OrderBy(c => c.ChunkIndex)
            .ToList();

        return Task.FromResult(chunks);
    }

    private void DebugBreak(string stage, Guid? documentId = null, int? chunkIndex = null)
    {
#if DEBUG
        if (System.Diagnostics.Debugger.IsAttached)
        {
            _logger.LogInformation(
                "Debug breakpoint: {Stage} | DocumentId: {DocumentId} | ChunkIndex: {ChunkIndex}",
                stage,
                documentId,
                chunkIndex);

            System.Diagnostics.Debugger.Break();
        }
#endif
    }

    public Task<Document?> GetDocumentAsync(Guid documentId)
    {
        var document = _documents.FirstOrDefault(d => d.Id == documentId);
        return Task.FromResult(document);
    }

    public async Task DeleteDocumentAsync(Guid documentId)
    {
        var document = _documents.FirstOrDefault(d => d.Id == documentId);
        if (document != null)
        {
            // Delete vectors from Pinecone
            var chunks = _documentChunks.Where(c => c.DocumentId == documentId).ToList();
            foreach (var chunk in chunks)
            {
                if (!string.IsNullOrEmpty(chunk.VectorId))
                    await _pineconeService.DeleteVectorAsync(chunk.VectorId);
            }

            // Clean up
            _documents.Remove(document);
            _documentChunks.RemoveAll(c => c.DocumentId == documentId);

            if (System.IO.File.Exists(document.FilePath))
                System.IO.File.Delete(document.FilePath);

            _logger.LogInformation("Document {DocumentId} deleted", documentId);
        }
    }

    private string ExtractTextFromFile(string filePath, string? contentType)
    {
        var extension = System.IO.Path.GetExtension(filePath).ToLower();

        return contentType switch
        {
            "application/pdf" => ExtractTextFromPdf(filePath),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" => ExtractTextFromDocx(filePath),
            "application/msword" => ExtractTextFromDocx(filePath),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" => ExtractTextFromXlsx(filePath),
            "text/plain" => System.IO.File.ReadAllText(filePath),
            _ => extension switch
            {
                ".pdf" => ExtractTextFromPdf(filePath),
                ".docx" => ExtractTextFromDocx(filePath),
                ".doc" => ExtractTextFromDocx(filePath),
                ".xlsx" => ExtractTextFromXlsx(filePath),
                ".txt" => System.IO.File.ReadAllText(filePath),
                _ => throw new NotSupportedException($"File format {extension} is not supported")
            }
        };
    }

    private bool IsExcelFile(string extension, string? contentType)
    {
        return extension.Equals(".xlsx", StringComparison.OrdinalIgnoreCase)
            || string.Equals(contentType, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", StringComparison.OrdinalIgnoreCase);
    }

    private List<ChunkPreparation> BuildStandardChunks(string filePath, string? contentType)
    {
        var text = ExtractTextFromFile(filePath, contentType);
        var chunks = _chunkingService.ChunkText(text);

        var prepared = new List<ChunkPreparation>();
        for (var i = 0; i < chunks.Count; i++)
        {
            prepared.Add(new ChunkPreparation
            {
                Content = chunks[i],
                Metadata = new Dictionary<string, string>
                {
                    { "sourceType", "text" }
                }
            });
        }

        return prepared;
    }

    private string ExtractTextFromXlsx(string filePath)
    {
        return string.Join("\n", ExtractExcelRowChunks(filePath).Select(chunk => chunk.Content));
    }

    private List<ChunkPreparation> ExtractExcelRowChunks(string filePath)
    {
        var chunks = new List<ChunkPreparation>();

        using var spreadsheet = SpreadsheetDocument.Open(filePath, false);
        var workbookPart = spreadsheet.WorkbookPart;
        if (workbookPart?.Workbook?.Sheets == null)
        {
            return chunks;
        }

        var sharedStrings = workbookPart.SharedStringTablePart?.SharedStringTable;

        foreach (var sheet in workbookPart.Workbook.Sheets.Elements<SpreadsheetOpenXml.Sheet>())
        {
            if (sheet.Id == null)
            {
                continue;
            }

            if (!(workbookPart.GetPartById(sheet.Id) is WorksheetPart worksheetPart))
            {
                continue;
            }

            var sheetData = worksheetPart.Worksheet.GetFirstChild<SpreadsheetOpenXml.SheetData>();
            if (sheetData == null)
            {
                continue;
            }

            var rows = sheetData.Elements<SpreadsheetOpenXml.Row>().ToList();
            if (rows.Count == 0)
            {
                continue;
            }

            var headerRow = rows.FirstOrDefault(row => row.Elements<SpreadsheetOpenXml.Cell>().Any());
            if (headerRow == null)
            {
                continue;
            }

            var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var cell in headerRow.Elements<SpreadsheetOpenXml.Cell>())
            {
                var colRef = GetColumnReference(cell.CellReference?.Value);
                if (string.IsNullOrEmpty(colRef))
                {
                    continue;
                }

                var headerValue = GetCellText(cell, sharedStrings);
                headers[colRef] = string.IsNullOrWhiteSpace(headerValue)
                    ? $"Column {colRef}"
                    : headerValue.Trim();
            }

            foreach (var row in rows)
            {
                if (row.RowIndex == headerRow.RowIndex)
                {
                    continue;
                }

                var pairs = new List<string>();
                foreach (var cell in row.Elements<SpreadsheetOpenXml.Cell>())
                {
                    var colRef = GetColumnReference(cell.CellReference?.Value);
                    if (string.IsNullOrEmpty(colRef))
                    {
                        continue;
                    }

                    var value = GetCellText(cell, sharedStrings);
                    if (string.IsNullOrWhiteSpace(value))
                    {
                        continue;
                    }

                    var key = headers.TryGetValue(colRef, out var headerName)
                        ? headerName
                        : $"Column {colRef}";

                    pairs.Add($"{key}={value.Trim()}");
                }

                if (pairs.Count == 0)
                {
                    continue;
                }

                var rowNumber = row.RowIndex?.Value.ToString() ?? "0";
                var sheetName = sheet.Name?.Value ?? "Sheet";
                var rowText = $"Sheet: {sheetName} | Row: {rowNumber} | {string.Join(" | ", pairs)}";

                chunks.Add(new ChunkPreparation
                {
                    Content = rowText,
                    Metadata = new Dictionary<string, string>
                    {
                        { "sourceType", "excel-row" },
                        { "sheetName", sheetName },
                        { "rowNumber", rowNumber }
                    }
                });
            }
        }

        return chunks;
    }

    private static string GetCellText(SpreadsheetOpenXml.Cell cell, SpreadsheetOpenXml.SharedStringTable? sharedStrings)
    {
        if (cell.CellValue == null)
        {
            return string.Empty;
        }

        var rawValue = cell.CellValue.InnerText;
        if (cell.DataType?.Value == SpreadsheetOpenXml.CellValues.SharedString
            && int.TryParse(rawValue, out var sharedIndex)
            && sharedStrings != null
            && sharedIndex >= 0
            && sharedIndex < sharedStrings.Count())
        {
            return sharedStrings.ElementAt(sharedIndex).InnerText;
        }

        return rawValue;
    }

    private static string GetColumnReference(string? cellReference)
    {
        if (string.IsNullOrWhiteSpace(cellReference))
        {
            return string.Empty;
        }

        return new string(cellReference.Where(char.IsLetter).ToArray());
    }

    private string ExtractTextFromPdf(string filePath)
    {
        var text = new System.Text.StringBuilder();

        using (var reader = new PdfReader(filePath))
        {
            for (int i = 1; i <= reader.NumberOfPages; i++)
            {
                var strategy = new SimpleTextExtractionStrategy();
                var pageText = PdfTextExtractor.GetTextFromPage(reader, i, strategy);
                text.AppendLine(pageText);
            }
        }

        return text.ToString();
    }

    private string ExtractTextFromDocx(string filePath)
    {
        var text = new System.Text.StringBuilder();

        try
        {
            using (var document = DocumentFormat.OpenXml.Packaging.WordprocessingDocument.Open(filePath, false))
            {
                if (document?.MainDocumentPart?.Document?.Body != null)
                {
                    var body = document.MainDocumentPart.Document.Body;
                    foreach (var paragraph in body.Elements<WordprocessingOpenXml.Paragraph>())
                    {
                        foreach (var textElement in paragraph.Elements<WordprocessingOpenXml.Run>())
                        {
                            foreach (var textNode in textElement.Elements<WordprocessingOpenXml.Text>())
                            {
                                text.Append(textNode.Text);
                            }
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error extracting text from docx");
        }

        return text.ToString();
    }

    private static List<string> ExtractKeyTopics(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return new List<string>();
        }

        var stopWords = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "the", "and", "for", "that", "with", "this", "from", "have", "were", "been", "your", "you",
            "our", "their", "they", "them", "what", "when", "where", "which", "shall", "will", "would",
            "could", "should", "about", "into", "also", "than", "then", "such", "these", "those", "there",
            "here", "after", "before", "while", "under", "over", "between", "within", "without", "because",
            "each", "other", "some", "more", "most", "many", "very", "only", "just", "into", "onto", "upon",
            "is", "am", "are", "was", "be", "to", "of", "in", "on", "at", "as", "it", "an", "or", "by"
        };

        var words = System.Text.RegularExpressions.Regex
            .Matches(text.ToLowerInvariant(), "[a-z][a-z0-9-]{2,}")
            .Select(match => match.Value)
            .Where(word => !stopWords.Contains(word))
            .GroupBy(word => word)
            .OrderByDescending(group => group.Count())
            .ThenBy(group => group.Key)
            .Select(group => group.Key)
            .Take(3)
            .ToList();

        return words;
    }
}
