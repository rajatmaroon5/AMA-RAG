# AMA RAG Chatbot

A Retrieval-Augmented Generation (RAG) based chatbot that answers questions based on uploaded documents. Built with ASP.NET Core backend and Angular frontend.

## 📋 Project Overview

This application implements a complete RAG pipeline:
1. **Document Upload** - Upload PDF or DOCX files
2. **Text Extraction** - Automatically extract text from documents
3. **Chunking** - Split text into manageable chunks with overlap
4. **Embedding** - Convert text chunks to vector embeddings
5. **Vector Storage** - Store embeddings in Pinecone
6. **Semantic Search** - Find relevant chunks based on question similarity
7. **Answer Generation** - Use OpenAI LLM to generate answers grounded in retrieved context

## 🏗️ Architecture

### Backend (.NET)
- **Framework**: ASP.NET Core 8.0 Minimal APIs
- **Services**:
  - `DocumentService` - Handle document upload, processing, and management
  - `EmbeddingService` - Generate embeddings using OpenAI or HuggingFace
  - `PineconeService` - Interact with Pinecone vector database
  - `ChatService` - Implement RAG chat logic
  - `ChunkingService` - Split documents into chunks

### Frontend (Angular)
- **Framework**: Angular 17 with standalone components
- **UI Components**:
  - Document Upload (drag-drop support)
  - Chat Interface with adjustable parameters
  - Document List Management
- **Material Design** - Angular Material components

### External Services
- **LLM**: OpenAI (GPT-3.5/GPT-4)
- **Embeddings**: OpenAI Embeddings or HuggingFace
- **Vector DB**: Pinecone

## 🚀 Getting Started

### Prerequisites
- .NET 8.0 SDK
- Node.js 18+ and npm
- OpenAI API Key
- Pinecone API Key and Index
- (Optional) HuggingFace API Key

### Backend Setup

1. Navigate to backend directory:
```bash
cd AmaRAGBackend
```

2. Configure API keys in `appsettings.json`:
```json
{
  "OpenAI": {
    "ApiKey": "your-openai-api-key"
  },
  "HuggingFace": {
    "ApiKey": "your-huggingface-api-key"
  },
  "Pinecone": {
    "ApiKey": "your-pinecone-api-key",
    "Environment": "your-environment",
    "IndexName": "ama-rag-index"
  }
}
```

3. Create uploads directory:
```bash
mkdir uploads
```

4. Run the backend:
```bash
dotnet run
```

The backend will be available at `https://localhost:5000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd AmaRAGUI
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
ng serve
```

The frontend will be available at `http://localhost:4200`

## 📦 API Endpoints

### Documents
- `POST /api/v1/documents/upload` - Upload a document
- `GET /api/v1/documents` - Get all documents
- `GET /api/v1/documents/{id}` - Get specific document
- `DELETE /api/v1/documents/{id}` - Delete document

### Chat
- `POST /api/v1/chat/ask` - Ask a question

### Request Examples

**Upload Document:**
```bash
curl -X POST http://localhost:5000/api/v1/documents/upload \
  -F "file=@document.pdf"
```

**Ask Question:**
```bash
curl -X POST http://localhost:5000/api/v1/chat/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the main topic?",
    "maxContextChunks": 5,
    "similarityThreshold": 0.7
  }'
```

## 🔧 Configuration

### Backend Configuration (`appsettings.json`)

```json
{
  "Embedding": {
    "Provider": "OpenAI"  // or "HuggingFace"
  },
  "Upload": {
    "Directory": "uploads",
    "MaxFileSizeMB": 50
  },
  "Pinecone": {
    "ApiKey": "...",
    "Environment": "...",
    "IndexName": "ama-rag-index"
  }
}
```

### Frontend Configuration (`api.service.ts`)

Update the API URL if needed:
```typescript
private readonly apiUrl = 'http://localhost:5000/api/v1';
```

## 📊 Supported Document Formats

- PDF (.pdf)
- Word Documents (.doc, .docx)
- Text Files (.txt)

## ⚙️ Document Processing

### Chunking Strategy
- **Chunk Size**: 1000 characters (configurable)
- **Overlap**: 100 characters between chunks
- Preserves semantic boundaries

### Embedding
- **Model**: Text Embedding 3 Small (OpenAI) or All-MiniLM-L6-v2 (HuggingFace)
- **Dimension**: 384 (HuggingFace) or 1536 (OpenAI)

### Similarity Search
- Uses cosine similarity in Pinecone
- Configurable similarity threshold (default: 0.7)
- Retrieves top-K chunks (default: 5)

## 🚀 Advanced Features

The chatbot now includes sophisticated RAG enhancements:

- **Query Transformation** - Expand and decompose questions for better retrieval
- **Answer Self-Grading** - LLM evaluates answer relevancy and groundedness
- **Smart Retry Logic** - Auto-retry with adjusted parameters if answer is poor quality
- **Web Search Fallback** - Uses DuckDuckGo when documents don't have the answer

[See Advanced RAG Documentation](ADVANCED_RAG.md) for detailed implementation details.

## 🧠 How It Works

1. **Question Embedding** - Convert user question to embedding
2. **Vector Search** - Find most similar document chunks
3. **Context Building** - Combine retrieved chunks as context
4. **LLM Prompt** - Create prompt with context and question
5. **Answer Generation** - Get response from OpenAI
6. **Response** - Return answer with source attribution

## 📝 Logging

Logs are stored in the `logs/` directory with daily rotation:
- Console output for development
- File output (logs/*.txt) for persistence

## 🔒 Security Considerations

- API keys stored in environment variables or Key Vault
- CORS configured for development (adjust for production)
- Input validation on all endpoints
- File type validation for uploads

## 📈 Performance Tips

1. **Chunk Size**: Adjust based on document type
2. **Max Chunks**: Reduce for faster responses
3. **Similarity Threshold**: Increase for more relevant results
4. **Batch Processing**: Upload multiple documents at once

## 🐛 Troubleshooting

### Backend won't start
- Check .NET SDK version: `dotnet --version`
- Verify port 5000 is available
- Check API key configuration

### Frontend won't load
- Install dependencies: `npm install`
- Clear node_modules: `rm -rf node_modules && npm install`
- Check Angular CLI: `ng version`

### API calls failing
- Verify CORS is enabled in `Program.cs`
- Check backend is running: `http://localhost:5000/swagger`
- Verify API keys in configuration

### Slow embedding generation
- Reduce chunk size
- Use HuggingFace instead of OpenAI for faster local processing
- Batch multiple requests

## 🚀 Deployment

### Backend (Azure/Docker)
```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY . .
ENTRYPOINT ["dotnet", "AmaRAGBackend.dll"]
```

### Frontend (Azure Static Web Apps/Netlify)
```bash
ng build --configuration production
```

## 📚 Dependencies

### Backend
- iTextSharp - PDF processing
- DocumentFormat.OpenXml - DOCX processing
- OpenAI NuGet - LLM integration
- Pinecone - Vector database
- Serilog - Logging
- FluentValidation - Input validation

### Frontend
- Angular 17 - Framework
- Angular Material - UI Components
- RxJS - Reactive programming

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Submit pull request

## 📄 License

MIT License - See LICENSE file for details

## 🆘 Support

For issues or questions:
1. Check troubleshooting section
2. Review logs for errors
3. Check API documentation in Swagger UI
4. Create an issue with details

## 🔄 Future Enhancements

- [ ] Advanced document preprocessing
- [ ] Multi-language support
- [ ] Document versioning
- [ ] Chat history persistence
- [ ] User authentication
- [ ] Advanced filtering and search
- [ ] Real-time document indexing
- [ ] Mobile app version
- [ ] Performance analytics
- [ ] Custom embedding models support

---

**Last Updated**: March 2026
