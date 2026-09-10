# 从仓库根目录：docker build -f Microi.Server/Microi.Panel/Dockerfile -t microi-panel:v2.0.0 .
FROM node:24-bookworm-slim AS ui
WORKDIR /src
COPY Microi.UI/ Microi.UI/
COPY Microi.Server/Microi.Panel/Client/ Microi.Server/Microi.Panel/Client/
WORKDIR /src/Microi.Server/Microi.Panel/Client
RUN npm ci --no-fund --no-audit && npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Microi.Server/Microi.Panel/ .
COPY --from=ui /src/Microi.Server/Microi.Panel/wwwroot/ wwwroot/
RUN dotnet publish Microi.Panel.csproj -c Release -o /out -m:1 -p:UseSharedCompilation=false --disable-build-servers

FROM mcr.microsoft.com/dotnet/aspnet:10.0
LABEL io.microi.ops.controller="true" io.microi.panel.controller="true" org.opencontainers.image.title="Microi.Panel" org.opencontainers.image.version="2.0.0"
WORKDIR /app
COPY --from=build /out/ .
ENV ASPNETCORE_URLS=http://+:8080 OPS_DATA_DIR=/microi/ops/data OPS_LOG_DIR=/microi/logs/ops
EXPOSE 8080 8443
HEALTHCHECK --interval=15s --timeout=8s --start-period=30s --retries=3 CMD ["dotnet", "Microi.Panel.dll", "--health-check"]
ENTRYPOINT ["dotnet", "Microi.Panel.dll"]
