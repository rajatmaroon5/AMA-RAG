# Quick Start Guide

## 5-Minute Setup

### 1. Set Up API Keys

Create `AmaRAGBackend/appsettings.json` with your credentials:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "OpenAI": {
    "ApiKey": "sk-..."
  },
  "HuggingFace": {
    "ApiKey": "hf_..."
  },
  "Pinecone": {
    "ApiKey": "YOUR_PINECONE_KEY",
    "Environment": "gcp-starter",
    "IndexName": "ama-rag-index"
  },
  "Embedding": {
    "Provider": "OpenAI"
  },
  "Upload": {
    "Directory": "uploads",
    "MaxFileSizeMB": 50
  }
}
```

### 2. Start Backend

```bash
cd AmaRAGBackend
dotnet run
```

Backend runs on: `https://localhost:5000`
API Docs: `https://localhost:5000/swagger`

### 3. Start Frontend

```bash
cd AmaRAGUI
npm install
ng serve
```

Frontend runs on: `http://localhost:4200`

## What to Do Next

1. **Upload Documents** - Go to "Upload Documents" tab, drag and drop PDFs or DOCX files
2. **Ask Questions** - Go to "Chat" tab, type your question
3. **View Documents** - Check "Documents" tab to see all indexed documents

## API Key Setup

### OpenAI
1. Visit https://platform.openai.com/api-keys
2. Create new API key
3. Add to `appsettings.json`

### Pinecone
1. Create account at https://www.pinecone.io/
2. Create free starter index
3. Get API key and environment

### HuggingFace (Optional)
1. Visit https://huggingface.co/settings/tokens
2. Create user access token
3. Add to `appsettings.json`

## First Test

1. Open `http://localhost:4200`
2. Click "Upload Documents"
3. Select any PDF or DOCX file
4. Click "Upload"
5. Go to "Chat" tab
6. Ask a question about your document
7. Get AI-powered answer

## Troubleshooting

### Backend won't start?
```bash
# Check if port is in use
netstat -ano | findstr :5000

# Use different port
dotnet run --urls=https://localhost:5001
```

### Frontend not connecting?
- Check backend is running
- Verify API URL in `src/app/services/api.service.ts`
- Check browser console (F12) for CORS errors

### Embeddings failing?
- Verify API keys are correct
- Check API rate limits
- Try HuggingFace provider as fallback

## Performance Tips

- **Smaller chunks** = faster but less context
- **Higher similarity threshold** = more specific results
- **Fewer max chunks** = faster but might miss info

## Next Steps

- Read full [README.md](../README.md)
- Check API documentation at `/swagger`
- Explore Angular Material components
- Customize styling in `src/styles.scss`
