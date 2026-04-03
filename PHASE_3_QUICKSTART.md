# Phase 3 Quick Start - SharePoint Integration

## What's New in Phase 3

Local deployment with SharePoint document synchronization. Sync documents from SharePoint, store metadata locally, and keep embeddings in Pinecone.

## 30-Second Setup

```powershell
# Terminal 1 - Backend
cd AmaRAGBackend
# Edit appsettings.json with your SharePoint credentials
dotnet run

# Terminal 2 - Frontend
cd AmaRAGUI
ng serve

# Open browser
# http://localhost:4200 → SharePoint Sync tab → Start Sync
```

## What You Need

1. **SharePoint Site URL**: `https://yourtenant.sharepoint.com/sites/yoursite`
2. **Folder Path**: `/sites/yoursite/Shared Documents/Folder`
3. **Service Account**: Email and password with folder access
4. **OpenAI & Pinecone Keys**: (already configured from Phase 1)

## Configuration

Edit `AmaRAGBackend/appsettings.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Data Source=amaRAG.db"
  },
  "SharePoint": {
    "SiteUrl": "https://yourtenant.sharepoint.com/sites/yoursite",
    "DocumentFolderPath": "/sites/yoursite/Shared Documents/RAG Docs",
    "Username": "service@yourtenant.onmicrosoft.com",
    "Password": "YourPassword"
  }
}
```

## How It Works

```
SharePoint Folder
    ↓ (Download)
Extract Text
    ↓ (Existing pipeline)
Create Embeddings
    ↓
Store in Pinecone
    ↓
Track in Local DB (amaRAG.db)
    ↓
Use in Chat
```

## UI Workflow

### Tab: SharePoint Sync

**Custom Folder Sync**
- Enter any SharePoint folder path
- Click "Start Sync"
- Watch progress in real-time

**Default Folder Sync**
- Uses folder from appsettings.json
- One-click sync

**Sync History**
- View past operations
- See success/failed counts
- Retry failed documents

## API Endpoints

| Action | Endpoint |
|--------|----------|
| Start sync | POST `/api/v1/sync/start` |
| Custom sync | POST `/api/v1/sync/start/{folderPath}` |
| Check status | GET `/api/v1/sync/status/{jobId}` |
| View history | GET `/api/v1/sync/history` |
| Retry failed | POST `/api/v1/sync/retry` |

## Database

- **Type**: SQLite (local file)
- **Location**: `AmaRAGBackend/amaRAG.db`
- **Auto-created**: Yes, on first backend startup
- **Tables**: DocumentSync (tracks files), SyncJob (audit trail)

## File Changes

### Backend
- ✅ New: `SharePointService.cs` (authentication + downloads)
- ✅ New: `SyncPipelineService.cs` (orchestration)
- ✅ New: `SyncEndpoints.cs` (REST API)
- ✅ Updated: `Program.cs` (register services)
- ✅ Updated: `appsettings.json` (add SharePoint config)
- ✅ Updated: `AmaRagDbContext.cs` (new entities)

### Frontend
- ✅ New: `components/sync/` (sync component + template + styles)
- ✅ Updated: `api.service.ts` (add sync methods)
- ✅ Updated: `app.component.ts` (add sync tab)

### Docs
- ✅ New: `SHAREPOINT_DEPLOYMENT.md` (setup guide)
- ✅ New: `PHASE_3_IMPLEMENTATION.md` (technical details)
- ✅ New: `LOCAL_DEPLOYMENT_CHECKLIST.md` (step-by-step)

## Common Tasks

### Find SharePoint Folder Path

1. Open SharePoint in browser
2. Navigate to desired folder
3. Copy URL from address bar
4. Extract server-relative path

Example:
- URL: `https://yourtenant.sharepoint.com/:f:/s/YourTeam/Folder`
- Path: `/sites/YourTeam/Shared Documents/Folder`

### Check Sync Status

In Angular UI:
- Go to "SharePoint Sync" tab
- See "Current Sync Status" section
- Shows: files discovered, processed, failed, skipped
- Percentage progress with color coding

### Retry Failed Documents

1. After sync completes with failures
2. Click "Retry Failed Documents"
3. Failed docs marked for re-processing
4. Run sync again to process

### View Sync History

1. Click "Sync History" tab
2. Shows all past syncs
3. Each entry shows: status, duration, file counts, errors

## Troubleshooting

### Sync shows 0 files

- Verify folder path is correct (check URL)
- Add PDF/DOCX files to folder (other types ignored)
- Check service account permissions
- Enable debug logging in appsettings.json

### Connection refused

- Backend not running? `dotnet run` in `AmaRAGBackend`
- Wrong port? Backend uses 5000, frontend uses 4200
- Check firewall/network access

### Database locked

- Only one sync at a time
- Wait for current sync to complete
- Restart backend if stuck

### SharePoint auth fails

- Verify email format: `user@tenant.onmicrosoft.com`
- Check password is correct
- Confirm user has folder read permission
- Try different account if available

## Performance

- **Small folder (10-50 files)**: 30s - 2 min
- **Medium folder (50-500 files)**: 2-10 min
- **Large folder (500+ files)**: 10+ min

Depends on: file size, network, embedding API speed

## Production Considerations

### Security
- Store credentials in Azure Key Vault (not appsettings.json)
- Use app-only authentication instead of username/password
- Implement certificate-based auth

### Scaling
- SQLite good for <100K documents
- Upgrade to SQL Server for larger deployments
- Add Hangfire for scheduled syncs
- Implement parallel processing for speed

### Monitoring
- Check logs in `logs/` directory
- Monitor Pinecone usage
- Track OpenAI API costs
- Set up alerts for sync failures

## Next Steps

1. **Configure**: Update appsettings.json
2. **Deploy**: Start backend and frontend
3. **Test**: Run first sync
4. **Monitor**: Check sync history
5. **Integrate**: Ask chat questions about synced docs
6. **Optimize**: Note sync times and adjust as needed

## Documentation

- **Full Setup**: [SHAREPOINT_DEPLOYMENT.md](./SHAREPOINT_DEPLOYMENT.md)
- **Technical**: [PHASE_3_IMPLEMENTATION.md](./PHASE_3_IMPLEMENTATION.md)
- **Checklist**: [LOCAL_DEPLOYMENT_CHECKLIST.md](./LOCAL_DEPLOYMENT_CHECKLIST.md)
- **Overall**: [README.md](./README.md)

## Support

**Having issues?**
1. Check troubleshooting above
2. Read detailed guides
3. Check backend logs: `logs/app-*.txt`
4. Check browser console (F12)
5. Enable debug logging in appsettings.json

---

**Version**: 3.0  
**Status**: ✅ Ready to Deploy  
**Last Updated**: Jan 2024
