# syntax=docker/dockerfile:1.7
# Altaris API — multi-stage build
FROM mcr.microsoft.com/dotnet/sdk:9.0-alpine AS build
WORKDIR /src

# Copy csproj first for layer cache
COPY Altaris.sln ./
COPY src/Altaris.Api/*.csproj                src/Altaris.Api/
COPY src/Altaris.Domain/*.csproj             src/Altaris.Domain/
COPY src/Altaris.Infrastructure/*.csproj     src/Altaris.Infrastructure/
COPY src/Altaris.Modules.Sessions/*.csproj   src/Altaris.Modules.Sessions/
COPY src/Altaris.Modules.Tenants/*.csproj    src/Altaris.Modules.Tenants/
COPY src/Altaris.Modules.Users/*.csproj      src/Altaris.Modules.Users/
RUN dotnet restore Altaris.sln

# Build
COPY . .
RUN dotnet publish src/Altaris.Api/Altaris.Api.csproj \
    -c Release -o /app/out \
    --no-restore /p:UseAppHost=false

# Runtime — debian-slim (NOT alpine). CLI binary host'tan bind mount ile
# /usr/local/bin/altaris'a geliyor; bun-compiled binary glibc'e bağımlı.
# Alpine musl libc'de "not found" veriyordu (CLI subprocess pattern).
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
RUN groupadd -r altaris && useradd -r -g altaris altaris \
    && apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/out .
USER altaris
ENV ASPNETCORE_URLS=http://+:5000 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true \
    DOTNET_NOLOGO=true
EXPOSE 5000
HEALTHCHECK --interval=20s --timeout=3s --start-period=15s --retries=3 \
    CMD curl -fsS http://localhost:5000/health/live || exit 1
ENTRYPOINT ["dotnet", "Altaris.Api.dll"]
