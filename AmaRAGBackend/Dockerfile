# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project file
COPY ["AmaRAGBackend.csproj", "."]
RUN dotnet restore "AmaRAGBackend.csproj"

# Copy source code
COPY . .
RUN dotnet build "AmaRAGBackend.csproj" -c Release -o /app/build

# Publish stage
FROM build AS publish
RUN dotnet publish "AmaRAGBackend.csproj" -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=publish /app/publish .

# Create uploads and logs directories, create non-root user
RUN mkdir -p uploads logs \
    && adduser --disabled-password --gecos '' appuser \
    && chown -R appuser:appuser /app
USER appuser

# Railway injects PORT at runtime; default to 8080
EXPOSE 8080

# Health check (uses runtime PORT)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

# Use shell form so ${PORT} is expanded at container start
CMD ASPNETCORE_HTTP_PORTS=${PORT:-8080} dotnet AmaRAGBackend.dll
