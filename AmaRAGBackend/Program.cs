using AmaRAGBackend.Data;
using AmaRAGBackend.Services;
using AmaRAGBackend.Endpoints;
using Serilog;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.OpenApi;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddUserSecrets<Program>(optional: true);

// Add services
// Dynamic CORS: always allow local dev origins + any origins listed in CORS_ALLOWED_ORIGINS env var
var corsOrigins = new List<string>
{
    "http://localhost:4200",
    "http://localhost:4201",
    "http://127.0.0.1:4200",
    "http://127.0.0.1:4201"
};
var extraOrigins = builder.Configuration["CORS_ALLOWED_ORIGINS"] ?? "";
foreach (var origin in extraOrigins.Split(' ', StringSplitOptions.RemoveEmptyEntries))
    corsOrigins.Add(origin.TrimEnd('/'));

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins([.. corsOrigins])
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// builder.Services.AddOpenApi();
builder.Services.AddSwaggerGen();

// Serilog configuration
builder.Host.UseSerilog((context, configuration) =>
    configuration.ReadFrom.Configuration(context.Configuration)
                 .WriteTo.Console()
                 .WriteTo.File("logs/app-.txt", rollingInterval: RollingInterval.Day));

// Add application services
builder.Services.AddScoped<IDocumentService, DocumentService>();

// Use mock embedding service for local development if configured
var useMockEmbeddings = builder.Configuration.GetValue<bool>("MockEmbeddings:Enabled", false);
if (useMockEmbeddings)
{
    builder.Services.AddScoped<IEmbeddingService, MockEmbeddingService>();
}
else
{
    builder.Services.AddScoped<IEmbeddingService, EmbeddingService>();
}

builder.Services.AddSingleton<IPineconeService, LocalVectorStoreService>();
builder.Services.AddScoped<IChatService, ChatService>();
builder.Services.AddScoped<IChunkingService, ChunkingService>();
builder.Services.AddScoped<IQueryTransformationService, QueryTransformationService>();
builder.Services.AddScoped<IAnswerGradingService, AnswerGradingService>();
builder.Services.AddScoped<IWebSearchService, WebSearchService>();
builder.Services.AddScoped<IWeatherMcpService, WeatherMcpService>();
builder.Services.AddScoped<IGmailMcpService, GmailMcpService>();
builder.Services.AddScoped<ISharePointService, SharePointService>();
// builder.Services.AddScoped<ISyncPipelineService, SyncPipelineService>();

// Add Entity Framework Core with SQLite
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Data Source=amaRAG.db";
builder.Services.AddDbContext<AmaRagDbContext>(options =>
    options.UseSqlite(connectionString));

// Add HTTP client factory
builder.Services.AddHttpClient();

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    // app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowAngular");

// Health check endpoint (used by Railway and Docker HEALTHCHECK)
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }));


// Initialize database
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AmaRagDbContext>();
    await dbContext.Database.EnsureCreatedAsync();
}

// Map API endpoints
app.MapGroup("/api/v1")
    .RequireCors("AllowAngular")
    .AddDocumentEndpoints()
    .AddChatEndpoints()
    .AddGmailEndpoints()
    .AddSharePointEndpoints()
    .WithName("AMA RAG API");

// Map sync endpoints
// app.MapSyncEndpoints();

app.Run();
