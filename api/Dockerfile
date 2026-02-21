# ── Build stage ──────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy csproj files first for layer caching
COPY Api/CollectionsUltimate.Api.csproj             Api/
COPY Application/CollectionsUltimate.Application.csproj Application/
COPY Domain/CollectionsUltimate.Domain.csproj        Domain/
COPY Infrastructure/CollectionsUltimate.Infrastructure.csproj Infrastructure/
RUN dotnet restore Api/CollectionsUltimate.Api.csproj

# Copy everything and publish
COPY . .
RUN dotnet publish Api/CollectionsUltimate.Api.csproj -c Release -o /app/publish --no-restore

# ── Runtime stage ────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Create directory for local cover image uploads
RUN mkdir -p /app/wwwroot/uploads

COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:5259
EXPOSE 5259

ENTRYPOINT ["dotnet", "CollectionsUltimate.Api.dll"]
