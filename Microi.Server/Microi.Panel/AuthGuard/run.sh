#!/bin/sh
# 固定宿主入口；不读取浏览器参数或动态 shell 代码。
set -eu
exec /usr/bin/python3 -B /opt/microi-auth-guard/daemon.py "$@"
