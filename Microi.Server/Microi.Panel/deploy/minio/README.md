# MinIO Community compatibility image

This image packages the unmodified upstream source at `RELEASE.2025-10-15T17-29-55Z`, commit `9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a`. The upstream repository is archived and is no longer maintained. This package does not imply ongoing upstream security support. Operators requiring maintained vendor support should evaluate MinIO AIStor.

Source: https://github.com/minio/minio/tree/9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a

The source archive, AGPLv3 license and these build instructions are included in `/usr/share/microi/minio/`. No MinIO source patches are applied. Transitive Go dependencies are fixed by the upstream `go.mod` and `go.sum`; the Go compiler and base images are pinned by digest in the Dockerfile.

Rebuild in an empty staging directory containing this `Dockerfile` and `README.md`:

```sh
curl -fL --retry 3 'https://codeload.github.com/minio/minio/tar.gz/refs/tags/RELEASE.2025-10-15T17-29-55Z' -o minio-source.tar.gz
echo 'be6d0bd3696c3a13a35f02d3a0280b64319c67918b4501c5c3d87f96d000085c  minio-source.tar.gz' | sha256sum -c -
docker buildx build --platform linux/amd64 --load -t microi-minio:2025-10-15-microi1 .
```

Use `linux/arm64` for an ARM64 image. Publish a multi-platform index only after verifying each architecture. The panel supplies an independent persistent volume and explicit credentials; this image never grants Docker socket access or host privileges.

When the Go download endpoint is unreachable, an optional build argument such as `--build-arg GO_MODULE_PROXY=https://goproxy.cn,direct` changes only the download transport. Keep `go.sum` and Go checksum verification enabled.
