# Build context contains the unmodified upstream source archive (see README.md).
ARG GO_IMAGE=registry.cn-hangzhou.aliyuncs.com/microios/golang:1.26.7-alpine@sha256:28d89ee9cc0ff9fec75c82ca201e6bf7fdf9a679d4b7b24dfa04f2bb766bb468
ARG RUNTIME_IMAGE=registry.cn-hangzhou.aliyuncs.com/microios/alpine:3.24.1@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b
FROM --platform=$BUILDPLATFORM ${GO_IMAGE} AS build
ARG TARGETOS
ARG TARGETARCH
ARG GO_MODULE_PROXY=https://proxy.golang.org,direct
ENV GOMAXPROCS=2 CGO_ENABLED=0 GOTOOLCHAIN=local
ENV GOPROXY=${GO_MODULE_PROXY} GOSUMDB=sum.golang.org
WORKDIR /source
COPY minio-source.tar.gz /source/minio-source.tar.gz
RUN echo 'be6d0bd3696c3a13a35f02d3a0280b64319c67918b4501c5c3d87f96d000085c  minio-source.tar.gz' | sha256sum -c - \
    && tar -xzf minio-source.tar.gz --strip-components=1
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -p 2 -trimpath \
    -ldflags='-s -w -X github.com/minio/minio/cmd.Version=2025-10-15T17:29:55Z -X github.com/minio/minio/cmd.ReleaseTag=RELEASE.2025-10-15T17-29-55Z -X github.com/minio/minio/cmd.CopyrightYear=2025 -X github.com/minio/minio/cmd.CommitID=9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a -X github.com/minio/minio/cmd.ShortCommitID=9e49d5e7a648' \
    -o /out/minio .

FROM ${RUNTIME_IMAGE}
RUN apk add --no-cache ca-certificates curl tzdata \
    && addgroup -g 10001 minio && adduser -D -u 10001 -G minio minio \
    && mkdir -p /data /usr/share/microi/minio && chown 10001:10001 /data
COPY --from=build /out/minio /usr/local/bin/minio
COPY --from=build /source/LICENSE /source/minio-source.tar.gz /usr/share/microi/minio/
COPY Dockerfile README.md /usr/share/microi/minio/
LABEL org.opencontainers.image.title="Microi MinIO Community" \
      org.opencontainers.image.version="2025-10-15-microi1" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later" \
      org.opencontainers.image.source="https://github.com/minio/minio/tree/9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a" \
      org.opencontainers.image.revision="9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a" \
      org.opencontainers.image.description="Unmodified final MinIO community security release; upstream is archived. Source and build instructions are included."
USER 10001:10001
VOLUME ["/data"]
EXPOSE 9000 9001
HEALTHCHECK --interval=10s --timeout=5s --retries=10 CMD curl -fsS http://127.0.0.1:9000/minio/health/ready || exit 1
ENTRYPOINT ["/usr/local/bin/minio"]
CMD ["server", "/data", "--console-address", ":9001"]
