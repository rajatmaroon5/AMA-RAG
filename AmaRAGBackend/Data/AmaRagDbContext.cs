namespace AmaRAGBackend.Data;

using Microsoft.EntityFrameworkCore;
using AmaRAGBackend.Models;

/// <summary>
/// Entity Framework Core DB Context for local SQLite database
/// </summary>
public class AmaRagDbContext : DbContext
{
    public DbSet<DocumentSync> DocumentSyncs { get; set; }
    public DbSet<SyncJob> SyncJobs { get; set; }

    public AmaRagDbContext(DbContextOptions<AmaRagDbContext> options) : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure DocumentSync
        modelBuilder.Entity<DocumentSync>()
            .HasKey(d => d.Id);
        modelBuilder.Entity<DocumentSync>()
            .Property(d => d.CreatedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP");

        // Configure SyncJob
        modelBuilder.Entity<SyncJob>()
            .HasKey(s => s.Id);
        modelBuilder.Entity<SyncJob>()
            .Property(s => s.StartedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP");
    }
}

/// <summary>
/// Tracks documents synced from SharePoint
/// </summary>
public class DocumentSync
{
    public Guid Id { get; set; }
    public string SharePointItemId { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string RelativePath { get; set; } = string.Empty;  // Relative to SharePoint folder
    public string SharePointUrl { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public DateTime ModifiedDateUtc { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastSyncedAt { get; set; }
    public SyncStatus Status { get; set; }  // Synced, Failed, Processing
    public string? LastError { get; set; }
    public Guid? DocumentId { get; set; }  // Reference to Document in Pinecone
    public int ChunkCount { get; set; }
    public string ETag { get; set; } = string.Empty;  // For change detection
}

/// <summary>
/// Tracks sync jobs for logging and auditing
/// </summary>
public class SyncJob
{
    public Guid Id { get; set; }
    public string JobType { get; set; } = string.Empty;  // "FullSync", "IncrementalSync"
    public string FolderPath { get; set; } = string.Empty;
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public SyncJobStatus Status { get; set; }
    public int FilesProcessed { get; set; }
    public int FilesSuccessful { get; set; }
    public int FilesFailed { get; set; }
    public int FilesSkipped { get; set; }
    public string? ErrorLog { get; set; }
}

/// <summary>
/// Sync status enum
/// </summary>
public enum SyncStatus
{
    Pending = 0,
    Processing = 1,
    Synced = 2,
    Failed = 3,
    Modified = 4
}

/// <summary>
/// Sync job status enum
/// </summary>
public enum SyncJobStatus
{
    Running = 0,
    Completed = 1,
    Failed = 2,
    Cancelled = 3
}
