ARG BASE_IMAGE=registry.cn-hangzhou.aliyuncs.com/microios/libretranslate:1.9.6@sha256:ec34530bb41a2f18907220740e51bdda21cfabeb296af5aceb778c5cce20eb5f
FROM ${BASE_IMAGE}

# LibreTranslate 1.9.6 currently resolves chardet 7.x while requests 2.31.0
# accepts chardet 3.x-5.x. Keep the upstream application unchanged and pin
# only the incompatible transitive dependency.
RUN /app/venv/bin/pip install --no-cache-dir --no-deps "chardet==5.2.0" \
    && /app/venv/bin/pip check \
    && /app/venv/bin/python -W error -c "import requests; print(requests.__version__)"
