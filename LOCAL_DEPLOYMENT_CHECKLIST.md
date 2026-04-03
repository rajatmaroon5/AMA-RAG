# Local Deployment Checklist

Complete this checklist to deploy AMA RAG with SharePoint integration locally.

## Prerequisites

- [ ] .NET 8.0 SDK installed (`dotnet --version`)
- [ ] Node.js 16+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] SharePoint Online access
- [ ] Valid OpenAI API key
- [ ] Valid Pinecone API key

## Backend Preparation

### Step 1: Configure Backend

- [ ] Open `AmaRAGBackend/appsettings.json`
- [ ] Update `SharePoint:SiteUrl` (your SharePoint site URL)
- [ ] Update `SharePoint:DocumentFolderPath` (folder containing documents)
- [ ] Update `SharePoint:Username` (service account email)
- [ ] Update `SharePoint:Password` (service account password)
- [ ] Verify OpenAI and Pinecone keys are set
- [ ] Save the file

Example SharePoint configuration:
```json
"SharePoint": {
  "SiteUrl": "https://yourtenant.sharepoint.com/sites/YourTeam",
  "DocumentFolderPath": "/sites/YourTeam/Shared Documents/RAG Docs",
  "Username": "service@yourtenant.onmicrosoft.com",
  "Password": "YourPassword"
}
```

### Step 2: Prepare Backend

```powershell
cd AmaRAGBackend

# Check .NET version
dotnet --version

# Restore packages
dotnet restore

# Build to check for errors
dotnet build
```

- [ ] Build succeeds without errors

### Step 3: Database Setup (Choose One)

**Option A: Automatic (Easiest)**
```powershell
# Database will be created automatically on first run
# Skip to Step 4
```

**Option B: Manual Migration**
```powershell
# Create initial migration
dotnet ef migrations add InitialCreate -c AmaRagDbContext

# Update database (creates amaRAG.db)
dotnet ef database update -c AmaRagDbContext

# Verify amaRAG.db exists in AmaRAGBackend directory
```

- [ ] Database created (automatic or manual)
- [ ] `amaRAG.db` file exists in `AmaRAGBackend` directory

### Step 4: Start Backend

```powershell
# From AmaRAGBackend directory
dotnet run

# Backend should start on https://localhost:5000
# You should see: "Now listening on: https://localhost:5000"
```

- [ ] Backend starts successfully
- [ ] No connection errors
- [ ] Server listening on port 5000

### Step 5: Test Backend

```powershell
# In a new terminal/PowerShell window
Invoke-WebRequest https://localhost:5000/swagger -SkipCertificateCheck
```

- [ ] Swagger API docs load at https://localhost:5000/swagger

## Frontend Preparation

### Step 6: Install Frontend Dependencies

```powershell
cd AmaRAGUI

# Install npm packages
npm install

# Should complete without major errors (warnings OK)
```

- [ ] npm install completes successfully
- [ ] `node_modules` directory created
- [ ] `package-lock.json` updated

### Step 7: Start Frontend

```powershell
# From AmaRAGUI directory
ng serve

# Frontend should start on http://localhost:4200
# You should see: "Application bundle generation complete"
```

- [ ] Frontend starts successfully
- [ ] Listening on port 4200
- [ ] No compile errors

## Smoke Testing

### Step 8: Access Application

```
Open browser: http://localhost:4200
```

- [ ] Application loads
- [ ] Header displays "AMA RAG Chatbot"
- [ ] 4 tabs visible: Upload Documents, Chat, Documents, SharePoint Sync

### Step 9: Test Each Component

#### Tab 1: Upload Documents
- [ ] No errors on load
- [ ] Drag-drop area displays
- [ ] Can see "Upload" button

#### Tab 2: Chat
- [ ] No errors on load
- [ ] Text input visible
- [ ] Ask button present

#### Tab 3: Documents
- [ ] No errors on load
- [ ] Documents table displays
- [ ] No errors in console

#### Tab 4: SharePoint Sync
- [ ] Tab loads without errors
- [ ] Three sub-tabs visible:
  - [ ] Custom Folder Sync
  - [ ] Default Folder Sync  
  - [ ] Sync History

### Step 10: Test SharePoint Connection

In the "SharePoint Sync" tab:

- [ ] Navigate to "Default Folder Sync" tab
- [ ] Click "Start Default Sync"
- [ ] One of:
  - [ ] Sync starts successfully (Status: "Running")
  - [ ] Error message appears (diagnose below)

**If error occurs**:
- [ ] Check backend console for detailed error
- [ ] Verify SharePoint credentials in appsettings.json
- [ ] Re-run with correct configuration
- [ ] Check "Troubleshooting" section below

## Operational Testing

### Step 11: Upload Sample Documents

In "Upload Documents" tab:
- [ ] Select 1-2 PDF or DOCX files
- [ ] Files upload successfully
- [ ] Documents appear in "Documents" tab

### Step 12: Test Chat

In "Chat" tab:
- [ ] Ask a question about uploaded documents
- [ ] Answer displays with citations
- [ ] Quality score shows
- [ ] No JavaScript errors in browser console

### Step 13: Run Sync

In "SharePoint Sync" tab:
- [ ] Click "Start Default Sync"
- [ ] Monitor progress in real-time
- [ ] Sync completes or shows errors

### Step 14: Verify Synced Documents

In "Documents" tab:
- [ ] Synced documents appear in list
- [ ] Check "Sync History" tab to see operation details

## File & Directory Verification

After deployment, verify all files exist:

```
AMA-RAG/
├── AmaRAGBackend/
│   ├── amaRAG.db                        [✓ should exist]
│   ├── bin/
│   ├── obj/
│   ├── Services/
│   │   ├── SharePointService.cs         [✓ should exist]
│   │   ├── SyncPipelineService.cs       [✓ should exist]
│   │   └── ...other services
│   ├── Endpoints/
│   │   ├── SyncEndpoints.cs             [✓ should exist]
│   │   └── ...other endpoints
│   ├── Data/
│   │   └── AmaRagDbContext.cs           [✓ should be updated]
│   ├── Program.cs                        [✓ should be updated]
│   └── appsettings.json                  [✓ verify SharePoint config]
├── AmaRAGUI/
│   ├── node_modules/
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── sync/
│   │   │   │   │   ├── sync.component.ts      [✓ should exist]
│   │   │   │   │   ├── sync.component.html    [✓ should exist]
│   │   │   │   │   └── sync.component.scss    [✓ should exist]
│   │   │   │   └── ...other components
│   │   │   ├── services/
│   │   │   │   └── api.service.ts             [✓ should be updated]
│   │   │   └── app.component.ts               [✓ should be updated]
│   │   └── ...other files
│   └── package.json                     [✓ check Angular version]
├── SHAREPOINT_DEPLOYMENT.md             [✓ should exist]
├── PHASE_3_IMPLEMENTATION.md            [✓ should exist]
└── README.md                            [✓ core documentation]
```

- [ ] All files listed above exist (or noted as updated)

## Troubleshooting

### Issue: Backend won't start

**Error**: "Failed to bind to address"
- [ ] Port 5000 already in use
- [ ] Solution: Change port in `launchSettings.json` or kill process using port

**Error**: "Connection to Pinecone failed"
- [ ] Verify Pinecone API key in `appsettings.json`
- [ ] Check network connectivity
- [ ] Verify Pinecone index exists

**Error**: "Certificate cannot be verified"
- [ ] Normal for localhost HTTPS
- [ ] Frontend should work anyway
- [ ] In PowerShell: Use `-SkipCertificateCheck` flag

### Issue: Frontend won't start

**Error**: "Port 4200 already in use"
- [ ] Solution: `ng serve --port 4300` (or different port)
- [ ] Or kill process using port 4200

**Error**: "Module not found"
- [ ] Solution: Delete `node_modules` and `package-lock.json`
- [ ] Run `npm install` again

### Issue: SharePoint sync shows 0 files

**Possible causes**:
- [ ] Folder path incorrect (check URL in SharePoint)
- [ ] No supported files (need PDF or DOCX)
- [ ] Permission denied (check service account permissions)
- [ ] Network connectivity (can you access SharePoint in browser?)

**Solutions**:
- [ ] Verify folder path: navigate to folder in SharePoint and copy its URL
- [ ] Add sample PDF/DOCX files to folder
- [ ] Test with different service account
- [ ] Check backend logs for specific error

### Issue: Sync starts but hangs

**Possible causes**:
- [ ] Large files taking time to download/process
- [ ] Network latency
- [ ] embeddings API slow

**Solutions**:
- [ ] Wait longer (large files can take several minutes)
- [ ] Check logs: `logs/app-*.txt`
- [ ] Try with smaller files first
- [ ] Check OpenAI/Pinecone status

### Issue: Database locked error

**Solution**:
- [ ] Close all connections to backend
- [ ] Stop backend (`Ctrl+C`)
- [ ] Delete `amaRAG.db`
- [ ] Restart backend (new database will be created)

### Issue: Connection refused errors in frontend

**Possible causes**:
- [ ] Backend not running on port 5000
- [ ] CORS not configured
- [ ] Backend crashed

**Solutions**:
- [ ] Check backend is running (`dotnet run`)
- [ ] Check backend console for errors
- [ ] Verify `Program.cs` has CORS setup for `localhost:4200`
- [ ] Check browser console for error details

## Logs

### Check Backend Logs

```powershell
Get-Content logs/app-*.txt -Tail 50
```

### Check Frontend Logs

1. Open browser developer tools (F12)
2. Check Console tab
3. Look for errors/warnings

### Enable Debug Logging

Update `AmaRAGBackend/appsettings.json`:

```json
{
  "Serilog": {
    "MinimumLevel": "Debug"
  }
}
```

Restart backend and check logs for more detail.

## Next Steps

After successful deployment:

1. **Add Documents**: Upload PDFs/DOCX files
2. **Test Chat**: Ask questions about documents
3. **Sync from SharePoint**: Start sync to import files
4. **Explore Sync History**: Check past operations
5. **Monitor Performance**: Note sync times for your file sizes
6. **Configure Schedules**: Plan regular sync timing (future)

## Rollback

If something goes wrong:

```powershell
# Stop backend and frontend
Ctrl+C  # in both terminals

# Delete database
Remove-Item AmaRAGBackend/amaRAG.db

# Restore appsettings.json from backup
# Or reconfigure manually

# Restart
cd AmaRAGBackend
dotnet run

# New terminal
cd AmaRAGUI
ng serve
```

## Success Indicators

✅ Deployment successful when:
- [ ] Backend runs without errors
- [ ] Frontend loads without errors
- [ ] All 4 tabs visible and working
- [ ] Can upload documents
- [ ] Can ask questions
- [ ] Can start sync from SharePoint
- [ ] Can see sync history

🎉 **Local deployment complete!**

## Support

- **Setup Issues**: See [SHAREPOINT_DEPLOYMENT.md](./SHAREPOINT_DEPLOYMENT.md)
- **Technical Details**: See [PHASE_3_IMPLEMENTATION.md](./PHASE_3_IMPLEMENTATION.md)
- **General Info**: See [README.md](./README.md)

---

**Checklist Version**: 1.0  
**Last Updated**: Jan 2024
