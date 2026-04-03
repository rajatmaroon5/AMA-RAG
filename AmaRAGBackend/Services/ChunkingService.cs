namespace AmaRAGBackend.Services;

using AmaRAGBackend.Models;
using System.Text;

/// <summary>
/// Implementation of text chunking service
/// </summary>
public class ChunkingService : IChunkingService
{
    private readonly ILogger<ChunkingService> _logger;

    public ChunkingService(ILogger<ChunkingService> logger)
    {
        _logger = logger;
    }

    public List<string> ChunkText(string text, int chunkSize = 1000, int overlapSize = 100)
    {
        if (string.IsNullOrEmpty(text))
            return new List<string>();

        var chunks = new List<string>();
        var words = text.Split(new[] { ' ', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries);
        
        var currentChunk = new StringBuilder();
        var currentSize = 0;

        foreach (var word in words)
        {
            if (currentSize + word.Length > chunkSize && currentChunk.Length > 0)
            {
                chunks.Add(currentChunk.ToString().Trim());
                
                // Add overlap - include last few words from previous chunk
                var overlapWords = currentChunk.ToString().Split().TakeLast(overlapSize / 20).ToList();
                currentChunk.Clear();
                currentChunk.AppendJoin(" ", overlapWords);
                currentSize = currentChunk.Length;
            }

            currentChunk.Append(word).Append(" ");
            currentSize += word.Length + 1;
        }

        if (currentChunk.Length > 0)
            chunks.Add(currentChunk.ToString().Trim());

        _logger.LogInformation("Chunked text into {ChunkCount} chunks with size {ChunkSize}", chunks.Count, chunkSize);
        return chunks;
    }
}
