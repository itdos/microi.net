#!/bin/bash
# 同一份宿主服务由平台/独立面板安装器调用；已有策略、镜像历史、保护和回执全部保留。
set -euo pipefail
if [ "$(id -u)" != 0 ]; then printf 'Microi：宿主磁盘维护安装需要 root。\n' >&2; exit 1; fi
source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
python_path=''
while [ "$#" -gt 0 ]; do
  case "$1" in --python) [ "$#" -ge 2 ] || exit 2; python_path=$2; shift 2;; *) printf 'Microi：未知维护安装参数。\n' >&2; exit 2;; esac
done
for candidate in "$python_path" /opt/microi-disk-guard/python-3.11.18/python/bin/python3 /opt/microi-panel-runtime-3.11.18-20261026/python/bin/python3 "$(command -v python3 || true)"; do
  if [ -n "$candidate" ] && [ -x "$candidate" ] && "$candidate" -E -s -B -c 'import sys,sqlite3,socket; assert sys.version_info >= (3,9)' >/dev/null 2>&1; then python_path=$candidate; break; fi
done
if [ -z "$python_path" ] || ! "$python_path" -E -s -B -c 'import sys; assert sys.version_info >= (3,9)' >/dev/null 2>&1; then
  printf 'Microi：磁盘维护需要 root 控制的 Python 3.9+，请用 --python 指定独立运行时；不替换系统或宝塔 Python。\n' >&2
  exit 1
fi
python_path=$("$python_path" -E -s -B -c 'import os,sys; print(os.path.realpath(sys.executable))')
"$python_path" -E -s -B - "$python_path" "$source_dir" <<'PY'
import ast,os,pathlib,stat,sys
for raw in sys.argv[1:]:
    path=pathlib.Path(raw)
    for part in [path,*path.parents]:
        info=part.lstat()
        if part.is_symlink() or info.st_uid!=0 or info.st_mode&0o022:raise SystemExit('Microi: maintenance installation source/runtime is not root-controlled')
root=pathlib.Path(sys.argv[2]);source=root/'daemon.py'
if source.is_symlink() or not source.is_file() or source.stat().st_size>256*1024:raise SystemExit('Microi: invalid maintenance source')
ast.parse(source.read_text(encoding='utf-8'))
PY
if [ "$(cat /proc/1/comm)" != systemd ]; then printf 'Microi：宿主维护需要 systemd，尚未修改服务。\n' >&2; exit 1; fi
systemd_version=$(systemctl --version | awk 'NR==1{print $2}')
if ! [[ "$systemd_version" =~ ^[0-9]+$ ]] || [ "$systemd_version" -lt 219 ]; then printf 'Microi：宿主维护需要 systemd 219+。\n' >&2; exit 1; fi
base=/opt/microi-disk-guard
state=/var/lib/microi-disk-guard
runtime=/run/microi-disk-guard
unit=/etc/systemd/system/microi-disk-guard.service
"$python_path" -E -s -B - "$base" "$state" "$runtime" <<'PY'
import pathlib,sys
for raw in sys.argv[1:]:
    p=pathlib.Path(raw)
    for part in [p,*p.parents]:
        if part.is_symlink() or part.exists() and (part.stat().st_uid!=0 or part.stat().st_mode&0o022):raise SystemExit('Microi: maintenance target is not root-controlled')
    if p.exists() and p.stat().st_mode&0o077:raise SystemExit('Microi: existing maintenance directory is not private')
PY
install -d -m 700 "$base" "$state" "$runtime" "$base/releases"
exec 9>"$runtime/install.lock"
flock -n 9 || { printf 'Microi：其它安装器正在维护磁盘服务。\n' >&2; exit 1; }
release_hash=$(sha256sum "$source_dir/daemon.py" | awk '{print $1}')
release="$base/releases/$release_hash"
stage=$(mktemp -d "$base/.install.XXXXXXXX")
trap 'case "$stage" in /opt/microi-disk-guard/.install.*) [ ! -L "$stage" ] && rm -r -- "$stage";; esac' EXIT
old_active=inactive; old_enabled=disabled; old_target=''; existed=0; activated=0; success=0
if [ -L "$unit" ]; then printf 'Microi：现有维护单元不能是符号链接。\n' >&2; exit 1; fi
if [ -e "$unit" ]; then
  [ -f "$base/installed.service" ] && [ ! -L "$base/installed.service" ] && cmp -s "$unit" "$base/installed.service" || { printf 'Microi：同名服务归属不明或已有自定义修改，停止覆盖。\n' >&2; exit 1; }
  [ "$(systemctl show microi-disk-guard.service -p DropInPaths)" = DropInPaths= ] || { printf 'Microi：维护服务存在自定义 drop-in，停止覆盖。\n' >&2; exit 1; }
  existed=1
  cp -- "$unit" "$stage/before.service"
  old_active=$(systemctl is-active microi-disk-guard.service || true)
  old_enabled=$(systemctl is-enabled microi-disk-guard.service || true)
fi
if [ -L "$base/current" ]; then old_target=$(readlink "$base/current"); elif [ -e "$base/current" ]; then printf 'Microi：维护 current 路径被其它文件占用。\n' >&2; exit 1; fi
if [ -n "$old_target" ]; then
  case "$old_target" in "$base"/releases/*) ;; *) printf 'Microi：原维护代码指向范围外，停止覆盖。\n' >&2; exit 1;; esac
  old_hash=${old_target##*/}
  [[ "$old_hash" =~ ^[a-f0-9]{64}$ ]] && [ ! -L "$old_target" ] && [ ! -L "$old_target/daemon.py" ] && [ "$(sha256sum "$old_target/daemon.py" | awk '{print $1}')" = "$old_hash" ] || { printf 'Microi：原维护发行身份不符。\n' >&2; exit 1; }
fi
finish(){
  local code=$?
  trap - EXIT
  if [ "$success" != 1 ] && [ "$activated" = 1 ]; then
    # 只有本次写入的单元仍逐字匹配时才能回退，保留管理员并发改动与全部运行态数据。
    if cmp -s "$unit" "$stage/new.service"; then
      systemctl stop microi-disk-guard.service || true
      if [ "$existed" = 1 ]; then install -m 644 "$stage/before.service" "$unit"; else systemctl disable microi-disk-guard.service >/dev/null 2>&1 || true; rm -- "$unit"; fi
      if [ -n "$old_target" ]; then ln -s "$old_target" "$stage/rollback-current"; mv -T -- "$stage/rollback-current" "$base/current"; fi
      systemctl daemon-reload
      if [ "$old_active" = active ]; then systemctl start microi-disk-guard.service || true; fi
      printf 'Microi：新维护服务未通过验收，已尝试恢复原单元；策略与数据保留。\n' >&2
    else printf 'Microi：服务单元已被外部修改，保留现场，不自动覆盖。\n' >&2; fi
  fi
  case "$stage" in "$base"/.install.*) [ ! -L "$stage" ] && rm -r -- "$stage";; esac
  exit "$code"
}
trap finish EXIT
if [ ! -e "$release" ]; then
  install -d -m 700 "$release"
  install -m 600 "$source_dir/daemon.py" "$release/daemon.py"
fi
[ ! -L "$release" ] && [ ! -L "$release/daemon.py" ] && [ "$(sha256sum "$release/daemon.py" | awk '{print $1}')" = "$release_hash" ] || { printf 'Microi：维护发行目录身份校验失败。\n' >&2; exit 1; }
isolation='ProtectSystem=strict
ReadWritePaths=/run /var/lib/microi-disk-guard
MemoryMax=128M
TasksMax=64'
if [ "$systemd_version" -lt 232 ]; then isolation='ReadOnlyDirectories=/
ReadWriteDirectories=/run /var/lib/microi-disk-guard
MemoryLimit=128M'; fi
cat > "$stage/new.service" <<EOF
[Unit]
Description=Microi independent host disk maintenance
After=docker.service
Wants=docker.service
[Service]
Type=simple
User=root
Group=root
UMask=0077
# Docker 自动重启可能先创建 bind-mount 目录为 0755；由 systemd 在启动服务前
# 设置自身运行目录。重启服务保留目录 inode，避免面板持有已被删除目录的挂载。
RuntimeDirectory=microi-disk-guard
RuntimeDirectoryMode=0700
RuntimeDirectoryPreserve=yes
ExecStart=$python_path -E -s -B $release/daemon.py serve
Restart=on-failure
RestartSec=10
TimeoutStopSec=45
NoNewPrivileges=true
# 在线安装器的数据默认位于 /home；需要 statvfs 读取这些实际挂载点。
# 只读暴露仍禁止宿主维护修改用户目录，写入范围仅保留上方运行态和自身账本。
ProtectHome=read-only
PrivateTmp=true
CapabilityBoundingSet=
RestrictAddressFamilies=AF_UNIX
$isolation
[Install]
WantedBy=multi-user.target
EOF
systemd-analyze verify "$stage/new.service" > "$stage/verify.log" 2>&1 || { cat "$stage/verify.log" >&2; exit 1; }
if grep -F "$stage/new.service:" "$stage/verify.log" | grep -Ei 'Unknown (lvalue|key)|Unknown assignment|Failed to parse|Ignoring.*(ReadWrite|ReadOnly|Protect|Memory|Capability)'; then printf 'Microi：systemd 忽略了关键维护限制，停止安装。\n' >&2; exit 1; fi
ln -s "$release" "$stage/new-current"
mv -T -- "$stage/new-current" "$base/current"
install -m 644 "$stage/new.service" "$unit"
activated=1
systemctl daemon-reload
if [ "$existed" = 0 ] || [ "$old_enabled" = enabled ]; then systemctl enable microi-disk-guard.service >/dev/null; fi
if [ "$existed" = 1 ] && [ "$old_active" != active ]; then
  printf '%s\n' "$python_path" > "$stage/python-path"
  install -m 600 "$stage/python-path" "$base/python-path"
  install -m 600 "$stage/new.service" "$base/installed.service"
  printf 'Microi：宿主维护代码已更新，保留原服务的停止状态。\n'
  success=1; exit 0
fi
systemctl restart microi-disk-guard.service
for attempt in $(seq 1 20); do
  if "$python_path" -E -s -B "$base/current/daemon.py" status > "$stage/status.json" 2>/dev/null \
    && "$python_path" -E -s -B - "$stage/status.json" "$release_hash" <<'PY'
import json,sys
x=json.load(open(sys.argv[1]));sys.exit(0 if x['protocol']==1 and x['sourceHash']==sys.argv[2] and x['monitoringFresh'] and not x['error'] and x['volumesNeverDeleted'] else 1)
PY
  then
    printf '%s\n' "$python_path" > "$stage/python-path"
    install -m 600 "$stage/python-path" "$base/python-path"
    install -m 600 "$stage/new.service" "$base/installed.service"
    success=1
    printf 'Microi：独立宿主磁盘维护已启动并完成真实监测回读；既有策略保留，新装默认开启安全清理。\n'
    exit 0
  fi
  sleep 1
done
printf 'Microi：宿主维护未通过实际监测验收。\n' >&2
exit 1
