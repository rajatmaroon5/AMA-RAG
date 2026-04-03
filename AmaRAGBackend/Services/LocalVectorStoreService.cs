namespace AmaRAGBackend.Services;

using AmaRAGBackend.Models;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

/// <summary>
/// In-memory vector store implementation using cosine similarity for local development
/// </summary>
public class LocalVectorStoreService : IPineconeService
{
    private readonly ILogger<LocalVectorStoreService> _logger;
    
    // Thread-safe in-memory store: vectorId -> (vector, metadata, documentInfo)
    private readonly Dictionary<string, VectorEntry> _vectorStore = new();
    private readonly object _lockObject = new();

    private class VectorEntry
    {
        public float[] Values { get; set; } = Array.Empty<float>();
        public Dictionary<string, string> Metadata { get; set; } = new();
        public string Content { get; set; } = string.Empty;
        public string DocumentName { get; set; } = string.Empty;
        public Guid DocumentId { get; set; }
    }

    public LocalVectorStoreService(ILogger<LocalVectorStoreService> logger)
    {
        _logger = logger;
        _logger.LogInformation("LocalVectorStoreService initialized (in-memory store)");
    }

    public Task<List<RetrievedChunk>> SearchSimilarChunksAsync(float[] queryEmbedding, int topK = 5, double threshold = 0.7, Guid? documentId = null)
    {
        try
        {
            var results = new List<(string id, RetrievedChunk chunk, double score)>();

            lock (_lockObject)
            {
                foreach (var entry in _vectorStore.Values)
                {
                    if (documentId.HasValue && entry.DocumentId != documentId.Value)
                    {
                        continue;
                    }

                    var similarity = CosineSimilarity(queryEmbedding, entry.Values);

                    if (similarity >= threshold)
                    {
                        results.Add((
                            entry.Metadata.GetValueOrDefault("id", Guid.NewGuid().ToString()),
                            new RetrievedChunk
                            {
                                Content = entry.Content,
                                DocumentName = entry.DocumentName,
                                DocumentId = entry.DocumentId,
                                SimilarityScore = similarity
                            },
                            similarity
                        ));
                    }
                }
            }

            // Sort by similarity score (highest first) and take top K
            var topResults = results
                .OrderByDescending(r => r.score)
                .Take(topK)
                .Select(r => r.chunk)
                .ToList();

            _logger.LogInformation($"Found {topResults.Count} similar chunks from {_vectorStore.Count} total vectors");

            return Task.FromResult(topResults);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching similar chunks in local vector store");
            throw;
        }
    }

    public Task UpsertVectorsAsync(List<VectorData> vectors)
    {
        try
        {
            lock (_lockObject)
            {
                foreach (var vector in vectors)
                {
                    var entry = new VectorEntry
                    {
                        Values = vector.Values,
                        Metadata = vector.Metadata,
                        Content = vector.Metadata.GetValueOrDefault("content", string.Empty),
                        DocumentName = vector.Metadata.GetValueOrDefault("documentName", string.Empty),
                        DocumentId = Guid.TryParse(
                            vector.Metadata.GetValueOrDefault("documentId", Guid.Empty.ToString()),
                            out var docId) ? docId : Guid.Empty
                    };

                    _vectorStore[vector.Id] = entry;
                }
            }

            _logger.LogInformation($"Successfully upserted {vectors.Count} vectors to local store. Total vectors: {_vectorStore.Count}");

            return Task.CompletedTask;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error upserting vectors to local store");
            throw;
        }
    }

    public Task DeleteVectorAsync(string vectorId)
    {
        try
        {
            lock (_lockObject)
            {
                if (_vectorStore.Remove(vectorId))
                {
                    _logger.LogInformation($"Deleted vector {vectorId}. Remaining vectors: {_vectorStore.Count}");
                }
                else
                {
                    _logger.LogWarning($"Vector {vectorId} not found for deletion");
                }
            }

            return Task.CompletedTask;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting vector from local store");
            throw;
        }
    }

    public Task DeleteVectorsByDocumentAsync(Guid documentId)
    {
        try
        {
            lock (_lockObject)
            {
                var idsToDelete = _vectorStore
                    .Where(kvp => kvp.Value.DocumentId == documentId)
                    .Select(kvp => kvp.Key)
                    .ToList();

                foreach (var id in idsToDelete)
                {
                    _vectorStore.Remove(id);
                }

                _logger.LogInformation($"Deleted {idsToDelete.Count} vectors for document {documentId}. Remaining vectors: {_vectorStore.Count}");
            }

            return Task.CompletedTask;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting vectors by document");
            throw;
        }
    }

    public int GetVectorCount()
    {
        lock (_lockObject)
        {
            return _vectorStore.Count;
        }
    }

    /// <summary>
    /// Calculate cosine similarity between two vectors
    /// Formula: similarity = (A · B) / (||A|| * ||B||)
    /// </summary>
    private static double CosineSimilarity(float[] vectorA, float[] vectorB)
    {
        if (vectorA.Length != vectorB.Length)
            throw new ArgumentException("Vectors must have the same length");

        // Calculate dot product
        double dotProduct = 0;
        for (int i = 0; i < vectorA.Length; i++)
        {
            dotProduct += vectorA[i] * vectorB[i];
        }

        // Calculate magnitude of A
        double magnitudeA = 0;
        for (int i = 0; i < vectorA.Length; i++)
        {
            magnitudeA += vectorA[i] * vectorA[i];
        }
        magnitudeA = Math.Sqrt(magnitudeA);

        // Calculate magnitude of B
        double magnitudeB = 0;
        for (int i = 0; i < vectorB.Length; i++)
        {
            magnitudeB += vectorB[i] * vectorB[i];
        }
        magnitudeB = Math.Sqrt(magnitudeB);

        // Avoid division by zero
        if (magnitudeA == 0 || magnitudeB == 0)
            return 0;

        return dotProduct / (magnitudeA * magnitudeB);
    }
}
