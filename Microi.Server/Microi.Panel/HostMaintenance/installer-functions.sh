# 此模板由 tools/sync-disk-guard-installer.mjs 展开为自包含安装器；不要手工编辑生成段。
microi_install_disk_guard() (
  set -e
  [ "$(id -u)" = 0 ] || { printf 'Microi：宿主维护安装需要 root。\n' >&2; exit 1; }
  local base=/opt/microi-disk-guard stage selected='' candidate runtime_tmp archive mode
  for candidate in / /opt "$base"; do
    [ ! -L "$candidate" ] || { printf 'Microi：维护安装路径不能是软链接。\n' >&2; exit 1; }
    if [ -e "$candidate" ]; then
      mode=$(stat -c %a "$candidate")
      [ "$(stat -c %u "$candidate")" = 0 ] && [ "$((8#$mode & 8#022))" = 0 ] || { printf 'Microi：维护安装目录不受 root 控制。\n' >&2; exit 1; }
    fi
  done
  if [ -e "$base" ] && [ "$(stat -c %a "$base")" != 700 ]; then printf 'Microi：已有维护目录权限异常，保留现场。\n' >&2; exit 1; fi
  install -d -m 700 "$base"
  stage=$(mktemp -d "$base/.source.XXXXXXXX")
  trap 'case "$stage" in /opt/microi-disk-guard/.source.*) [ ! -L "$stage" ] && rm -r -- "$stage";; esac' EXIT
  for candidate in "${MICROI_INSTALL_DISK_GUARD_PYTHON:-}" "$base/python-3.11.18/python/bin/python3" /opt/microi-panel-runtime-3.11.18-20261026/python/bin/python3 "$(command -v python3 || true)"; do
    if [ -n "$candidate" ] && [ -x "$candidate" ] && "$candidate" -E -s -B -c 'import sys,sqlite3,socket; assert sys.version_info >= (3,9)' >/dev/null 2>&1; then selected=$candidate; break; fi
  done
  if [ -z "$selected" ]; then
    # 精确固定官方独立运行时及哈希；只补本服务依赖，不替换系统或宝塔 Python。
    [ "$(uname -m)" = x86_64 ] || { printf 'Microi：请为此架构配置 root 控制的 Python 3.9+。\n' >&2; exit 1; }
    runtime_tmp="$stage/runtime"
    archive="$stage/python-runtime.tar.gz"
    curl --fail --location --proto '=https' --tlsv1.2 --connect-timeout 15 --max-time 600 \
      'https://github.com/astral-sh/python-build-standalone/releases/download/20261026/cpython-3.11.18%2B20261026-x86_64-unknown-linux-gnu-install_only_stripped.tar.gz' -o "$archive"
    printf '%s  %s\n' 17c4978a36c496dc53c08899ef8dad1ad2734f6325f08d6033a1e66419e0af26 "$archive" | sha256sum -c -
    install -d -m 700 "$runtime_tmp"
    tar -tzf "$archive" > "$stage/runtime-files.txt"
    if grep -E '(^/|(^|/)\.\.(/|$))' "$stage/runtime-files.txt"; then printf 'Microi：运行时归档路径异常。\n' >&2; exit 1; fi
    tar -xzf "$archive" --no-same-owner -C "$runtime_tmp"
    "$runtime_tmp/python/bin/python3" -E -s -B -c 'import sys,sqlite3; assert sys.version_info >= (3,9)'
    if [ -e "$base/python-3.11.18" ]; then printf 'Microi：独立运行时目录已存在但未通过选择检查，停止覆盖。\n' >&2; exit 1; fi
    mv -- "$runtime_tmp" "$base/python-3.11.18"
    selected="$base/python-3.11.18/python/bin/python3"
  fi
  cat > "$stage/daemon.py" <<'MICROI_DISK_GUARD_DAEMON_SOURCE'
@@DAEMON_SOURCE@@
MICROI_DISK_GUARD_DAEMON_SOURCE
  cat > "$stage/install.sh" <<'MICROI_DISK_GUARD_INSTALL_SOURCE'
@@INSTALL_SOURCE@@
MICROI_DISK_GUARD_INSTALL_SOURCE
  chmod 600 "$stage/daemon.py" "$stage/install.sh"
  bash "$stage/install.sh" --python "$selected"
  "$selected" -E -s -B -c 'import os,sys; print(os.path.realpath(sys.executable))' > "$stage/python-path"
  install -m 600 "$stage/python-path" "$base/python-path"
)

microi_disk_guard_connect() {
  [ ! -L /opt/microi-disk-guard ] && [ "$(stat -c %u:%a /opt/microi-disk-guard 2>/dev/null)" = 0:700 ] || return 1
  [ -f /opt/microi-disk-guard/python-path ] && [ ! -L /opt/microi-disk-guard/python-path ] || return 1
  [ "$(stat -c %u:%a /opt/microi-disk-guard/python-path)" = 0:600 ] || return 1
  MICROI_DISK_GUARD_PYTHON=$(cat /opt/microi-disk-guard/python-path)
  [ -x "$MICROI_DISK_GUARD_PYTHON" ] || return 1
  case "$MICROI_DISK_GUARD_PYTHON" in /*) ;; *) return 1;; esac
  "$MICROI_DISK_GUARD_PYTHON" -E -s -B /opt/microi-disk-guard/current/daemon.py status >/dev/null
}

microi_disk_run() {
  # 只拦截拉取/创建路径；只读 config/version 等仍沿用原调用，维护命令不进入业务 API。
  local mutation=0 argument operation pins
  for argument in "$@"; do case "$argument" in pull|up) mutation=1;; esac; done
  if [ "$mutation" != 1 ]; then "$@"; return $?; fi
  if ! microi_disk_guard_connect; then
    microi_install_disk_guard && microi_disk_enroll_existing || { printf 'Microi：宿主磁盘维护未就绪，保持原服务并停止新增下载/编排。\n' >&2; return 1; }
  fi
  operation="install-$$-$(cat /proc/sys/kernel/random/uuid)"
  pins=$("$MICROI_DISK_GUARD_PYTHON" -E -s -B -c 'import json,sys;print(json.dumps([x for x in sys.argv[1:] if x]))' "${API_IMAGE:-}" "${CLIENT_IMAGE:-}") || return 1
  "$MICROI_DISK_GUARD_PYTHON" -E -s -B /opt/microi-disk-guard/current/daemon.py guarded \
    --operation "$operation" --images "$pins" --required-bytes "${MICROI_INSTALL_DISK_REQUIRED_BYTES:-2147483648}" -- "$@"
}

microi_disk_enroll_existing() {
  local name role expected count=0
  microi_disk_guard_connect || return 1
  for name in microi-install-api microi-install-client microi-install-database microi-install-redis microi-install-mongodb microi-install-minio microi-panel microi-ops; do
    if ! docker container inspect "$name" >/dev/null 2>&1; then continue; fi
    role=data; expected=''
    case "$name" in
      microi-install-api) role=api; expected="${API_IMAGE:-registry.cn-hangzhou.aliyuncs.com/microios/microi-api:latest}";;
      microi-install-client) role=web; expected="${CLIENT_IMAGE:-registry.cn-hangzhou.aliyuncs.com/microios/microi-client:latest}";;
    esac
    "$MICROI_DISK_GUARD_PYTHON" -E -s -B /opt/microi-disk-guard/current/daemon.py enroll --name "$name" --role "$role" --expected-repository "$expected" >/dev/null || return 1
    count=$((count+1))
  done
  printf 'Microi：本次按实际容器登记 %s 个维护对象；data 仅监测数据盘，数据库数据卷不参与清理。\n' "$count"
}
