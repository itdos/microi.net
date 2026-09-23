ARG MICROI_NODE_IMAGE=docker.io/library/node:22-bookworm-slim@sha256:48e4b67d85f87bd551df43704e24d252f56cc5f8e9718841aace50f19948f0f9
ARG MICROI_ASPNET_IMAGE=registry.cn-hangzhou.aliyuncs.com/microios/dotnet-aspnet:10.0
FROM ${MICROI_NODE_IMAGE} AS node-runtime
FROM ${MICROI_ASPNET_IMAGE} AS base
COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
COPY publish/ /app
WORKDIR /app
EXPOSE 80
RUN ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && echo 'Asia/Shanghai' >/etc/timezone
CMD ["dotnet", "Microi.net.Api.dll", "--urls", "http://0.0.0.0:80"]
