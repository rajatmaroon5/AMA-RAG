namespace AmaRAGBackend.Services;

using AmaRAGBackend.Models;

/// <summary>
/// Mock embedding service for local development and testing
/// Generates deterministic embeddings based on text hash to ensure consistency
/// </summary>
public class MockEmbeddingService : IEmbeddingService
{
    private readonly ILogger<MockEmbeddingService> _logger;
    private const int EMBEDDING_DIMENSION = 384; // Match HuggingFace all-MiniLM-L6-v2 dimensions

    public MockEmbeddingService(ILogger<MockEmbeddingService> logger)
    {
        _logger = logger;
        _logger.LogInformation("MockEmbeddingService initialized for local development");
    }

    public Task<float[]> GetEmbeddingAsync(string text, EmbeddingProvider provider = EmbeddingProvider.OpenAI)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(text))
                throw new ArgumentException("Text cannot be empty");

            var embedding = GenerateDeterministicEmbedding(text);
            return Task.FromResult(embedding);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating mock embedding");
            throw;
        }
    }

    public Task<List<float[]>> GetEmbeddingsAsync(List<string> texts, EmbeddingProvider provider = EmbeddingProvider.OpenAI)
    {
        try
        {
            var embeddings = texts.Select(text => GenerateDeterministicEmbedding(text)).ToList();
            return Task.FromResult(embeddings);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating mock embeddings");
            throw;
        }
    }

    /// <summary>
    /// Generate a deterministic embedding based on text content.
    /// Uses hash algorithm to create consistent vectors for the same text.
    /// </summary>
    private float[] GenerateDeterministicEmbedding(string text)
    {
        // Create a deterministic hash from the text
        using (var sha256 = System.Security.Cryptography.SHA256.Create())
        {
            var hashBytes = sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(text));
            
            // Convert hash bytes to embedding vector
            var embedding = new float[EMBEDDING_DIMENSION];
            
            for (int i = 0; i < EMBEDDING_DIMENSION; i++)
            {
                // Use modulo to cycle through hash bytes
                int byteIndex = i % hashBytes.Length;
                // Normalize to [-1, 1] range
                embedding[i] = (float)(hashBytes[byteIndex] - 128) / 128f;
            }

            // Normalize the vector to unit length (important for cosine similarity)
            NormalizeVector(embedding);

            return embedding;
        }
    }

    /// <summary>
    /// Normalize a vector to unit length (L2 normalization)
    /// </summary>
    private void NormalizeVector(float[] vector)
    {
        double magnitude = 0;
        for (int i = 0; i < vector.Length; i++)
        {
            magnitude += vector[i] * vector[i];
        }
        magnitude = Math.Sqrt(magnitude);

        if (magnitude > 0)
        {
            for (int i = 0; i < vector.Length; i++)
            {
                vector[i] = (float)(vector[i] / magnitude);
            }
        }
    }
}
