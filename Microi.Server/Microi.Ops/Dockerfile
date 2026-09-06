# 从仓库根目录：docker build -f Microi.Server/Microi.Ops/Dockerfile -t microi-ops:1.0.1 .
FROM node:22-bookworm-slim AS ui
WORKDIR /src
COPY Microi.UI/ Microi.UI/
COPY Microi.Server/Microi.Ops/Client/ Microi.Server/Microi.Ops/Client/
WORKDIR /src/Microi.Server/Microi.Ops/Client
RUN npm ci --no-fund --no-audit && npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Microi.Server/Microi.Ops/ .
COPY --from=ui /src/Microi.Server/Microi.Ops/wwwroot/ wwwroot/
RUN dotnet publish Microi.Ops.csproj -c Release -o /out -m:1 -p:UseSharedCompilation=false --disable-build-servers

FROM mcr.microsoft.com/dotnet/aspnet:10.0
LABEL io.microi.ops.controller="true" org.opencontainers.image.title="Microi.Ops" org.opencontainers.image.version="1.0.1"
WORKDIR /app
COPY --from=build /out/ .
ENV ASPNETCORE_URLS=http://+:8080 OPS_DATA_DIR=/microi/ops/data OPS_LOG_DIR=/microi/logs/ops
EXPOSE 8080
ENTRYPOINT ["dotnet", "Microi.Ops.dll"]
