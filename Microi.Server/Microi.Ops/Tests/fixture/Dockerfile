FROM alpine:3.21
RUN apk add --no-cache busybox-extras
ARG RELEASE=v1
ARG HEALTH=ready
RUN mkdir -p /www /data && printf 'microi-ops-fixture-%s' "$RELEASE" > /www/index.html && printf '%s' "$HEALTH" > /health-state
VOLUME /data
HEALTHCHECK --interval=1s --timeout=1s --start-period=1s --retries=2 CMD test "$(cat /health-state)" = ready && wget -q -O- http://127.0.0.1/ >/dev/null
EXPOSE 80
CMD ["httpd", "-f", "-p", "80", "-h", "/www"]
