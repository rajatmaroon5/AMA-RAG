# SharePoint Integration & Local Deployment Guide

This guide explains how to set up and deploy the AMA RAG chatbot with SharePoint document synchronization locally.

## Overview

The SharePoint integration allows the RAG chatbot to:
- Automatically sync documents from SharePoint folders
- Track synced files to avoid re-processing unchanged documents
- Store sync history and audit logs locally
- Handle sync failures with retry mechanisms
- Support both manual (on-demand) and scheduled syncs

## Architecture

### Components

1. **SharePointService** - Handles authentication and SharePoint file operations
2. **SyncPipelineService** - Orchestrates the document sync workflow
3. **SyncEndpoints** - REST API for controlling sync operations
4. **SyncComponent (Angular)** - UI for managing SharePoint sync

### Data Storage

- **Local Database**: SQLite (`amaRAG.db`) - Stores document sync state and job history
- **Document Storage**: Pinecone - Vector embeddings (unchanged from Phase 1 & 2)

### Sync Workflow

```
SharePoint Folder
        ↓
ListFilesAsync (PnP Core)
        ↓
Compare with LocalDB (ETag matching)
        ↓
Download New/Modified Files
        ↓
Extract & Chunk (Existing Pipeline)
        ↓
Generate Embeddings (OpenAI/HuggingFace)
        ↓
Store in Pinecone
        ↓
Update LocalDB (DocumentSync, SyncJob records)
```

## Configuration

### Backend Setup

#### 1. Update `appsettings.json`

Add SharePoint configuration:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Data Source=amaRAG.db"
  },
  "SharePoint": {
    "SiteUrl": "https://yourtenant.sharepoint.com/sites/yoursite",
    "DocumentFolderPath": "/sites/yoursite/Shared Documents/RAG Documents",
    "Username": "your-username@yourtenant.onmicrosoft.com",
    "Password": "your-password"
  }
}
```

**Important**: 
- `SiteUrl`: Your SharePoint site URL
- `DocumentFolderPath`: Server-relative path to the folder containing documents
- `Username`: Service account or user with read access to the folder
- `Password`: Plain text password (consider encryption for production)

#### 2. Get SharePoint Folder Path

To find the correct `DocumentFolderPath`:

1. Navigate to your SharePoint site
2. Go to the folder you want to sync
3. Click the folder and check the URL in the browser
4. The folder path typically follows this pattern: `/sites/sitename/Shared Documents/FolderName`

Example paths:
- `/sites/Engineering/Shared Documents/Technical Docs`
- `/sites/HR/Shared Documents/Policies`

#### 3. Prepare Service Account

You have two authentication options:

**Option A: Username/Password (Current Implementation)**
- Create a service account in your Microsoft 365 tenant
- Grant the account "Reader" permission to the SharePoint folder
- Store credentials securely (encrypted key vault in production)

**Option B: App-Only Auth (Production Recommended)**
- Register an Azure AD application
- Grant "Sites.Selected" permission
- Use certificate-based authentication
- Implement in `SharePointService.cs` for higher security

### Frontend Setup

The Angular component is already integrated into the application and appears as the "SharePoint Sync" tab.

## API Endpoints

All endpoints are prefixed with `/api/v1/sync`

### 1. Start Sync (Custom Folder)
```
POST /api/v1/sync/start/{folderPath}
Response: 202 Accepted
{
  "syncJobId": "00000000-0000-0000-0000-000000000000",
  "status": "Running",
  "message": "Sync started",
  "startedAt": "2024-01-15T10:30:00Z"
}
```

### 2. Start Sync (Default Folder)
```
POST /api/v1/sync/start
Response: 202 Accepted
{
  "syncJobId": "00000000-0000-0000-0000-000000000000",
  "status": "Running",
  "message": "Sync started",
  "startedAt": "2024-01-15T10:30:00Z"
}
```

### 3. Get Sync Status
```
GET /api/v1/sync/status/{jobId}
Response: 200 OK
{
  "syncJobId": "00000000-0000-0000-0000-000000000000",
  "status": "Running",
  "filesDiscovered": 42,
  "filesProcessed": 28,
  "filesFailed": 2,
  "filesSkipped": 12,
  "startedAt": "2024-01-15T10:30:00Z",
  "completedAt": null,
  "errorMessage": null,
  "progressPercentage": 66.7
}
```

### 4. Get Sync History
```
GET /api/v1/sync/history?limit=50
Response: 200 OK
[
  {
    "syncJobId": "00000000-0000-0000-0000-000000000000",
    "startedAt": "2024-01-15T10:30:00Z",
    "completedAt": "2024-01-15T10:45:00Z",
    "filesProcessed": 42,
    "filesSuccessful": 40,
    "filesFailed": 2,
    "filesSkipped": 0,
    "status": "Completed",
    "notes": null
  }
]
```

### 5. Retry Failed Documents
```
POST /api/v1/sync/retry
Response: 200 OK
{
  "message": "Failed documents marked for retry"
}
```

## UI Usage

### SharePoint Sync Tab

#### Tab 1: Custom Folder Sync
- Enter any SharePoint folder path
- Click "Start Sync" to begin synchronization
- Monitor progress in real-time

#### Tab 2: Default Folder Sync
- Syncs from the folder configured in `appsettings.json`
- Click "Start Default Sync"
- Useful for recurring syncs

#### Tab 3: Sync History
- View past sync operations
- See statistics (successful, failed, skipped files)
- Refresh to reload history

### Current Sync Status
- Shown in real-time while sync is running
- Shows files discovered, processed, failed, and skipped
- Displays progress percentage
- Shows errors if sync fails
- Option to retry failed documents

## Local Deployment Steps

### Prerequisites

- .NET 8.0 SDK
- Node.js 16+ and npm
- SQLite (included with .NET)
- SharePoint Online access

### Step 1: Backend Setup

```powershell
cd AmaRAGBackend

# Restore NuGet packages
dotnet restore

# Create initial migration (if needed)
dotnet ef migrations add InitialCreate -c AmaRagDbContext

# Update database (creates amaRAG.db)
dotnet ef database update -c AmaRagDbContext

# Run the backend
dotnet run
```

The backend will:
- Start on `https://localhost:5000`
- Create `amaRAG.db` in the project root
- Initialize database schema

### Step 2: Configure SharePoint

Update `appsettings.json` with your SharePoint credentials:

```json
"SharePoint": {
  "SiteUrl": "https://yourtenant.sharepoint.com/sites/yoursite",
  "DocumentFolderPath": "/sites/yoursite/Shared Documents/YourFolder",
  "Username": "service-account@yourtenant.onmicrosoft.com",
  "Password": "YourPassword"
}
```

### Step 3: Frontend Setup

```powershell
cd AmaRAGUI

# Install dependencies
npm install

# Start Angular dev server
ng serve
```

The frontend will be available at `http://localhost:4200`

### Step 4: Test the Setup

1. Navigate to `http://localhost:4200`
2. Go to the "SharePoint Sync" tab
3. Click "Start Default Sync" or enter a custom folder path
4. Monitor the sync progress
5. Check the "Sync History" tab to see results

## Database Schema

### DocumentSync Table

Tracks which SharePoint files have been synced:

```
Id              | GUID (Primary Key)
SharePointItemId| String (SharePoint Item ID)
FileName        | String
Status          | Enum (Pending, Processing, Synced, Failed, Modified)
DocumentId      | GUID (FK to Pinecone document)
ETag            | String (for change detection)
CreatedAt       | DateTime
LastSyncedAt    | DateTime
LastError       | String (error message if failed)
```

### SyncJob Table

Audit trail for sync operations:

```
Id              | GUID (Primary Key)
FolderPath      | String (SharePoint folder path)
Status          | Enum (Running, Completed, Failed, Cancelled)
StartedAt       | DateTime
CompletedAt     | DateTime (nullable)
FilesProcessed  | Integer
FilesSuccessful | Integer
FilesFailed     | Integer
FilesSkipped    | Integer
ErrorLog        | String (any errors encountered)
```

## Troubleshooting

### Issue: "SharePoint connection test failed"

**Solution**:
- Verify credentials are correct
- Check username format (use full email: user@tenant.onmicrosoft.com)
- Ensure service account has access to SharePoint
- Check if Multi-Factor Authentication is enabled (requires app password)

### Issue: Sync completes with 0 files

**Solution**:
- Verify folder path is correct (check URL in SharePoint)
- Ensure folder contains supported file types (PDF, DOCX)
- Check permissions on the service account
- View sync history for error details

### Issue: Files sync but embeddings not generated

**Solution**:
- Verify OpenAI/HuggingFace API keys are configured
- Check logs for embedding errors
- May need to manually trigger retry

### Issue: Database locked error

**Solution**:
- Only one sync should run at a time
- Wait for current sync to complete
- Check if `amaRAG.db` is locked by another process
- Restart backend if stuck

## Performance Considerations

### Large-Scale Deployments

For deployments with 1000+ documents:

1. **Batch Processing**: Process documents in batches of 50-100
2. **Incremental Sync**: Use ETag to only process changed files
3. **Parallel Processing**: Consider implementing Hangfire for background jobs
4. **Chunking**: Adjust chunk size based on document complexity
5. **Database**: SQLite may need migration to SQL Server for concurrent users

### Optimization Tips

1. Run syncs during off-peak hours
2. Use specific folder paths (not parent folders with many subfolders)
3. Archive old documents to reduce scan time
4. Monitor sync logs for performance patterns
5. Consider implementing scheduled syncs with Hangfire

## Security Notes

### Current Implementation (For Development)

- Username/password stored in `appsettings.json`
- Suitable for local development and testing

### Production Implementation

- Store credentials in Azure Key Vault
- Use app-only authentication (service principal)
- Implement certificate-based authentication
- Encrypt connection strings
- Use SQL Server instead of SQLite
- Implement role-based access control
- Add request signing and validation

### Recommended Production Changes

1. **Update SharePointService.cs** to use app-only auth:
```csharp
var authManager = new PnP.Framework.AuthenticationManager()
    .GetAppOnlyAuthenticatedContext(siteUrl, clientId, clientSecret);
```

2. **Store secrets in Azure Key Vault**:
```csharp
var connectionString = configuration["KeyVault:ConnectionString"];
// Retrieve from Key Vault
```

3. **Implement rate limiting** on sync endpoints
4. **Add audit logging** for all sync operations

## Next Steps

1. **Configure SharePoint** with your credentials
2. **Test local deployment** with sample documents
3. **Monitor sync history** and logs
4. **Set up scheduled syncs** (future enhancement)
5. **Migrate to production** environment

## Additional Resources

- [PnP Core SDK Documentation](https://pnp.github.io/pnpcore/)
- [SharePoint REST API](https://learn.microsoft.com/en-us/sharepoint/dev/apis/rest/)
- [Entity Framework Core SQLite](https://learn.microsoft.com/en-us/ef/core/providers/sqlite)
- [Hangfire Documentation](https://docs.hangfire.io/)

## Support

For issues:
1. Check sync history for error details
2. Review backend logs (`logs/app-*.txt`)
3. Verify SharePoint configuration
4. Test SharePoint connection via connection test endpoint
5. Check database integrity

---

**Last Updated**: Jan 2024  
**Version**: 3.0 (Phase 3: SharePoint Integration)
