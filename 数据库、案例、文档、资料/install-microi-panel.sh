#!/usr/bin/env bash
# 吾码服务器运维面板独立安装器。安装本面板与宿主防护，不变更其它面板、Docker配置或业务数据。
set -Eeuo pipefail
umask 077
PANEL_ROOT=/microi/panel
PANEL_PORT=61890
PANEL_BIND=0.0.0.0
PANEL_HOST=''
PANEL_IMAGE=registry.cn-hangzhou.aliyuncs.com/microios/microi-panel:v2.0.0
PANEL_IMAGE_EXPLICIT=0
PANEL_LEGACY_PANEL_ONLY=0
PANEL_STABLE_DEFAULT=0
PANEL_OFFLINE=0
PANEL_UPGRADE=0
PANEL_CHECK=0
PANEL_DOCKER_INSTALL=0
PANEL_YES=0
PANEL_PREVIOUS_IMAGE=''
PANEL_PREVIOUS_CONTAINER_ID=''
PANEL_EXPECTED_MOUNTS=''
PANEL_ORIGINAL_MOUNTS=''
PANEL_CANDIDATE_CONTAINER_ID=''
PANEL_HAS_AUTH_GUARD=0
PANEL_GUARD_EXPORT_ID=''
PANEL_GUARD_STAGE=''
PANEL_OVERRIDE_RECEIPT=''
PANEL_GUARD_PREVIOUS_TREE=''
PANEL_GUARD_CANDIDATE_TREE=''
PANEL_GUARD_CANDIDATE_UNIT=''
PANEL_GUARD_PREVIOUS_ACTIVE=''
PANEL_GUARD_PREVIOUS_ENABLED=''
PANEL_GUARD_PREVIOUS_UNIT=''
PANEL_GUARD_PREVIOUS_SERVICE=''
PANEL_GUARD_CANDIDATE_SERVICE=''
PANEL_ORIGINAL_ARGS=("$@")
fail(){ printf 'Microi.Panel：%s\n' "$*" >&2; exit 1; }
panel_select_install_scope(){
  # 官网既有无--image命令固定保留已发布稳定版；这不是候选下载失败后的回退，也不授予显式镜像旧版豁免。
  PANEL_STABLE_DEFAULT=0
  if ((PANEL_IMAGE_EXPLICIT==0)); then
    [[ "$PANEL_IMAGE" == registry.cn-hangzhou.aliyuncs.com/microios/microi-panel:v2.0.0 ]] || fail '未指定镜像时只允许已发布的稳定默认镜像，请使用--image明确选择并校验其它镜像'
    PANEL_STABLE_DEFAULT=1
    printf 'Microi.Panel：使用默认稳定版v2.0.0：仅旧版面板，不含SSH/数据库认证防护。2.0.1新防护尚未正式发布，须使用--image显式选择已验证候选；本地候选同时使用--offline。\n' >&2
  fi
}
# 主机只允许一个安装/升级进程，锁覆盖盘点、下载、切换和恢复；退出后由内核释放，不删除共享锁文件。
panel_acquire_install_lock(){
  command -v flock >/dev/null 2>&1 || fail '缺少util-linux flock，不能安全串行安装或升级面板'
  local lock_file=/run/microi-panel-install.lock
  [[ ! -L "$lock_file" ]] || fail '安装锁不能是符号链接'
  exec {PANEL_INSTALL_LOCK_FD}>"$lock_file" || fail '无法打开面板安装锁'
  flock -n "$PANEL_INSTALL_LOCK_FD" || fail '另一个面板安装或升级正在执行，请等待其完成后重试'
}
# 一次 inspect 取得同一容器的身份与挂载；只读失败不是“容器不存在”，禁止据此覆盖未知现场。
panel_inspect_target(){
  local identity
  identity=$(docker inspect --format '{{.Id}}|{{.Image}}|{{index .Config.Labels "io.microi.panel.controller"}}|{{index .Config.Labels "io.microi.panel.installer-operation"}}|{{range .Mounts}}{{printf "%s=%s:%t;" .Destination .Source .RW}}{{end}}' microi-panel) || return 1
  IFS='|' read -r PANEL_CURRENT_ID PANEL_CURRENT_IMAGE PANEL_CURRENT_LABEL PANEL_CURRENT_OPERATION PANEL_CURRENT_MOUNTS <<< "$identity"
  # Docker返回挂载数组的顺序不构成身份，按完整挂载记录排序后比较，避免无变化重建被误拒绝。
  local -a mount_entries
  IFS=';' read -r -a mount_entries <<< "$PANEL_CURRENT_MOUNTS"
  PANEL_CURRENT_MOUNTS=$(printf '%s\n' "${mount_entries[@]}" | LC_ALL=C sort | paste -sd ';' -) || return 1
  PANEL_CURRENT_MOUNTS+=';'
  [[ "$PANEL_CURRENT_ID" =~ ^[a-f0-9]{64}$ && "$PANEL_CURRENT_IMAGE" =~ ^sha256:[a-f0-9]{64}$ && "$PANEL_CURRENT_LABEL" == true ]] || return 1
  [[ "$PANEL_CURRENT_MOUNTS" == *"/microi/ops/data=$PANEL_ROOT/data:true;"* ]] || return 1
}
panel_assert_target(){
  panel_inspect_target || fail '无法确认面板容器身份或原数据挂载，保留现场并停止操作'
  [[ "$PANEL_CURRENT_IMAGE" == "$1" ]] || fail '面板运行镜像与本次候选不一致，保留现场并停止操作'
  [[ -z "$2" || "$PANEL_CURRENT_ID" == "$2" ]] || fail '面板容器已被外部替换，保留现场并停止自动回退'
  [[ -z "$3" || "$PANEL_CURRENT_OPERATION" == "$3" ]] || fail '面板容器不属于本次安装操作，保留现场并停止自动回退'
  [[ -z "$4" || "$PANEL_CURRENT_MOUNTS" == "$4" ]] || fail '面板挂载已变化，保留现场并停止自动回退'
}
panel_file_receipt(){
  local path=$1 identity digest
  [[ ! -L "$path" ]] || return 1
  if [[ ! -e "$path" ]]; then printf missing; return 0; fi
  [[ -f "$path" ]] || return 1
  identity=$(stat -c '%d:%i:%f:%u:%g:%s:%Y' -- "$path") || return 1
  digest=$(sha256sum -- "$path") || return 1
  printf '%s:%s' "$identity" "${digest%% *}"
}
panel_capture_image_override(){
  local path="$PANEL_ROOT/docker-compose.image.yml" before after
  before=$(panel_file_receipt "$path") || fail '镜像override不是普通独立文件，保留并停止覆盖'
  if [[ "$before" != missing ]]; then
    [[ $(stat -c '%s' -- "$path") -le 8192 ]] || fail '镜像override超出安装器格式，保留自定义配置'
    local -a lines
    mapfile -t lines < "$path"
    # 只识别安装器写出的有限格式；其它字段、重复键、YAML引用或自定义挂载都不能静默丢弃。
    [[ ${#lines[@]} == 3 || ${#lines[@]} == 5 || ${#lines[@]} == 7 ]] || fail '镜像override含自定义内容，请先将自定义设置合并到docker-compose.yml；原文件未覆盖'
    [[ "${lines[0]}" == services: && "${lines[1]}" == '  microi-panel:' && "${lines[2]}" =~ ^'    image: '[a-z0-9][a-z0-9./:_@-]{1,220}$ ]] || fail '镜像override不属于安装器已知格式，保留并停止覆盖'
    if ((${#lines[@]}>=5)); then
      [[ "${lines[3]}" == '    labels:' && "${lines[4]}" =~ ^'      io.microi.panel.installer-operation: "'[a-zA-Z0-9_-]{1,128}'"'$ ]] || fail '镜像override包含自定义标签，保留并停止覆盖'
    fi
    if ((${#lines[@]}==7)); then
      [[ "${lines[5]}" == '    volumes:' && "${lines[6]}" == '      - /run/microi-auth-guard:/run/microi-auth-guard:ro' ]] || fail '镜像override包含自定义挂载，保留并停止覆盖'
    fi
  fi
  after=$(panel_file_receipt "$path") || fail '镜像override读取期间变化，停止覆盖'
  [[ "$before" == "$after" ]] || fail '镜像override读取期间变化，停止覆盖'
  PANEL_OVERRIDE_RECEIPT=$after
}
panel_assert_image_override(){
  local actual
  actual=$(panel_file_receipt "$PANEL_ROOT/docker-compose.image.yml") || fail '镜像override身份已变化，保留现场并停止覆盖'
  [[ -n "$PANEL_OVERRIDE_RECEIPT" && "$actual" == "$PANEL_OVERRIDE_RECEIPT" ]] || fail '镜像override已被外部修改，保留现场并停止覆盖'
}
panel_render_image_override(){
  # 镜像固定到不可变ID；操作标签使同镜像的外部重建也不会被误认成本轮候选。
  printf 'services:\n  microi-panel:\n    image: %s\n    labels:\n      io.microi.panel.installer-operation: "%s"\n' "$1" "$PANEL_OPERATION_ID"
  if ((PANEL_HAS_AUTH_GUARD)); then
    # socket目录只读绑定仍支持Unix协议连接，防止容器删除宿主socket；旧Compose按目标路径合并这个明确新增项。
    printf '    volumes:\n      - /run/microi-auth-guard:/run/microi-auth-guard:ro\n'
  fi
}
panel_write_image_override(){
  local pending="$PANEL_ROOT/.docker-compose.image.$PANEL_OPERATION_ID.pending"
  panel_assert_image_override
  [[ ! -e "$pending" && ! -L "$pending" ]] || fail '本轮镜像override暂存路径已存在，停止覆盖'
  (set -o noclobber; panel_render_image_override "$1" > "$pending") || fail '无法生成本轮镜像override'
  panel_assert_image_override
  mv -T -- "$pending" "$PANEL_ROOT/docker-compose.image.yml"
  PANEL_OVERRIDE_RECEIPT=$(panel_file_receipt "$PANEL_ROOT/docker-compose.image.yml") || fail '镜像override写入后无法回读'
}
panel_guard_feature(){
  local protocol
  protocol=$(docker image inspect --format '{{index .Config.Labels "io.microi.panel.authguard.protocol"}}' "$PANEL_IMAGE_ID") || fail '无法读取候选面板防护协议'
  case "$protocol" in
    1) PANEL_HAS_AUTH_GUARD=1;;
    ''|'<no value>')
      ((PANEL_LEGACY_PANEL_ONLY || ${PANEL_STABLE_DEFAULT:-0})) || fail '所选镜像缺少io.microi.panel.authguard.protocol=1；显式镜像默认要求主机认证防护，已停止安装。只有明确接受旧版面板不含防护时才使用--legacy-panel-only'
      PANEL_HAS_AUTH_GUARD=0
      printf 'Microi.Panel：所选镜像仅旧版面板，不含SSH/数据库认证防护；不能视为SSH或数据库已受保护。\n' >&2;;
    *) fail '候选面板防护协议不受当前安装器支持，停止升级';;
  esac
}
panel_guard_upgrade_compatibility(){
  ((PANEL_UPGRADE && PANEL_HAS_AUTH_GUARD==0)) || return 0
  local previous_protocol
  [[ "$PANEL_PREVIOUS_IMAGE" =~ ^sha256:[a-f0-9]{64}$ ]] || fail '原面板镜像身份缺失，无法确认旧版兼容性，停止升级'
  previous_protocol=$(docker image inspect --format '{{index .Config.Labels "io.microi.panel.authguard.protocol"}}' "$PANEL_PREVIOUS_IMAGE") || fail '无法回读原镜像防护协议，停止降级'
  case "$previous_protocol" in
    ''|'<no value>') return 0;;
    *) fail '原面板已使用主机防护协议，禁止降级到无协议旧镜像；--legacy-panel-only不能绕过Redis隔离配置与账本兼容保护';;
  esac
}
panel_report_completion(){
  if ((PANEL_HAS_AUTH_GUARD)); then
    printf 'Microi.Panel：安装完成，宿主防护控制面已回读；各服务实际覆盖仍以安全防护状态为准。\n'
  else
    ((PANEL_LEGACY_PANEL_ONLY || ${PANEL_STABLE_DEFAULT:-0})) || fail '缺少默认主机防护回执，不能报告安装完成'
    printf 'Microi.Panel：安装完成：仅旧版面板，不含SSH/数据库认证防护。\n'
  fi
  printf '入口 %s\n账号 paneladmin；密码文件 %s/config/admin-password\n' "$PANEL_URL" "$PANEL_ROOT"
  printf '请在云安全组按需放行TCP %s。首次自签证书请核对安装输出的SHA-256指纹。\n' "$PANEL_PORT"
  printf '升级/重建时同时加载 docker-compose.yml 和 docker-compose.image.yml。\n'
}
panel_guard_cleanup(){
  # 导出容器从不启动，只按本轮Id和标签删除；无法核对时保留，绝不按名字强制清理。
  if [[ -n "$PANEL_GUARD_EXPORT_ID" ]]; then
    local owner
    owner=$(docker inspect --format '{{index .Config.Labels "io.microi.panel.installer-export"}}' "$PANEL_GUARD_EXPORT_ID" 2>/dev/null) || owner=''
    if [[ "$owner" == "$PANEL_OPERATION_ID" ]]; then docker rm "$PANEL_GUARD_EXPORT_ID" >/dev/null || true; fi
  fi
  if [[ -n "$PANEL_GUARD_STAGE" && "$PANEL_GUARD_STAGE" == "$PANEL_ROOT"/.authguard-stage.* && ! -L "$PANEL_GUARD_STAGE" ]]; then
    local file
    for file in manifest.json daemon.py store.py firewall.py collectors.py redis_proxy.py run.sh microi-auth-guard.service README.md; do
      [[ ! -f "$PANEL_GUARD_STAGE/$file" || -L "$PANEL_GUARD_STAGE/$file" ]] || rm -- "$PANEL_GUARD_STAGE/$file"
    done
    rmdir -- "$PANEL_GUARD_STAGE" 2>/dev/null || printf 'Microi.Panel：防护暂存目录有待诊断内容，已保留 %s\n' "$PANEL_GUARD_STAGE" >&2
  fi
}
panel_guard_tree_receipt(){
  # 目录inode和整个文件树进入回执；移动到本轮备份目录不改变身份，替换/增删/改写任何文件都会拒绝恢复。
  python3 - "$1" <<'PANEL_GUARD_TREE'
import hashlib,json,os,pathlib,stat,sys
root=pathlib.Path(sys.argv[1]); required={'daemon.py','store.py','firewall.py','collectors.py','redis_proxy.py','run.sh','microi-auth-guard.service'}
if root.is_symlink() or not root.is_dir(): raise SystemExit('AuthGuard directory invalid')
manifest=root/'manifest.json'
if manifest.is_symlink() or not manifest.is_file() or manifest.stat().st_size>65536: raise SystemExit('AuthGuard manifest invalid')
data=json.loads(manifest.read_text(encoding='utf-8'))
if data.get('protocol')!=1 or data.get('entrypoint')!='daemon.py' or not required.issubset(set(data.get('files',[]))): raise SystemExit('AuthGuard manifest ownership mismatch')
for name in required:
    if (root/name).is_symlink() or not (root/name).is_file(): raise SystemExit('AuthGuard required file invalid')
rows=[]
for path in [root,*sorted(root.rglob('*'))]:
    item=path.lstat()
    if not (stat.S_ISREG(item.st_mode) or stat.S_ISDIR(item.st_mode)): raise SystemExit('AuthGuard contains unsupported link/type')
    if len(rows)>1000 or item.st_size>32*1024*1024: raise SystemExit('AuthGuard tree exceeds expected bounds')
    content=hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else ''
    rows.append([str(path.relative_to(root)),item.st_dev,item.st_ino,item.st_mode,item.st_uid,item.st_gid,item.st_size if content else 0,item.st_mtime_ns if content else 0,content])
print(hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest())
PANEL_GUARD_TREE
}
panel_guard_service_receipt(){
  local fragment dropins invocation enabled
  fragment=$(systemctl show microi-auth-guard.service --property=FragmentPath --value) || return 1
  dropins=$(systemctl show microi-auth-guard.service --property=DropInPaths --value) || return 1
  [[ "$fragment" == /etc/systemd/system/microi-auth-guard.service && -z "$dropins" ]] || return 1
  invocation=$(systemctl show microi-auth-guard.service --property=InvocationID --value) || return 1
  enabled=$(systemctl is-enabled microi-auth-guard.service) || [[ "$enabled" == disabled ]] || return 1
  [[ "$enabled" == enabled || "$enabled" == disabled ]] || return 1
  printf '%s|%s' "$invocation" "$enabled"
}
panel_guard_assert_rollback_files(){
  local target=/opt/microi-auth-guard backup="/opt/microi-auth-guard.before-$PANEL_OPERATION_ID" actual
  [[ -n "$PANEL_GUARD_PREVIOUS_TREE" && -n "$PANEL_GUARD_CANDIDATE_TREE" && -n "$PANEL_GUARD_CANDIDATE_UNIT" ]] || return 1
  [[ ! -L "$target/.installer-operation" && $(cat "$target/.installer-operation") == "$PANEL_OPERATION_ID" ]] || return 1
  actual=$(panel_guard_tree_receipt "$target") || return 1
  [[ "$actual" == "$PANEL_GUARD_CANDIDATE_TREE" ]] || return 1
  actual=$(panel_guard_tree_receipt "$backup") || return 1
  [[ "$actual" == "$PANEL_GUARD_PREVIOUS_TREE" ]] || return 1
  actual=$(panel_file_receipt /etc/systemd/system/microi-auth-guard.service) || return 1
  [[ "$actual" == "$PANEL_GUARD_CANDIDATE_UNIT" ]] || return 1
  cmp -s "$target/microi-auth-guard.service" /etc/systemd/system/microi-auth-guard.service || return 1
}
panel_guard_wait_ready(){
  local attempt
  for ((attempt=0;attempt<15;attempt++)); do
    if python3 -B /opt/microi-auth-guard/daemon.py --verify-ready --socket /run/microi-auth-guard/control.sock; then return 0; fi
    sleep 1
  done
  return 1
}
panel_guard_rollback(){
  local target=/opt/microi-auth-guard backup="/opt/microi-auth-guard.before-$PANEL_OPERATION_ID" failed="/opt/microi-auth-guard.failed-$PANEL_OPERATION_ID" actual
  if ! panel_guard_assert_rollback_files; then printf 'Microi.Panel：没有完整原防护回执，或防护文件已被外部修改；保留现场，不自动回退。\n' >&2; return 1; fi
  actual=$(panel_guard_service_receipt) || return 1
  [[ -n "$PANEL_GUARD_CANDIDATE_SERVICE" && "$actual" == "$PANEL_GUARD_CANDIDATE_SERVICE" ]] || { printf 'Microi.Panel：防护运行实例或服务设置已变化，停止自动回退。\n' >&2; return 1; }
  [[ ! -e "$failed" && ! -L "$failed" ]] || return 1
  systemctl stop microi-auth-guard.service || return 1
  panel_guard_assert_rollback_files || return 1
  # 不覆盖目标目录；失败候选保留为本轮诊断材料。任何新出现的路径都会使后续身份核验失败并停止。
  mv -T -n -- "$target" "$failed" || return 1
  [[ ! -e "$target" && ! -L "$target" ]] || return 1
  actual=$(panel_guard_tree_receipt "$failed") || return 1
  [[ "$actual" == "$PANEL_GUARD_CANDIDATE_TREE" ]] || return 1
  mv -T -n -- "$backup" "$target" || return 1
  [[ ! -e "$backup" && ! -L "$backup" ]] || return 1
  actual=$(panel_guard_tree_receipt "$target") || return 1
  [[ "$actual" == "$PANEL_GUARD_PREVIOUS_TREE" ]] || return 1
  actual=$(panel_file_receipt /etc/systemd/system/microi-auth-guard.service) || return 1
  [[ "$actual" == "$PANEL_GUARD_CANDIDATE_UNIT" ]] || return 1
  install -m 644 "$target/microi-auth-guard.service" /etc/systemd/system/microi-auth-guard.service || return 1
  cmp -s "$target/microi-auth-guard.service" /etc/systemd/system/microi-auth-guard.service || return 1
  systemctl daemon-reload || return 1
  if [[ "$PANEL_GUARD_PREVIOUS_ENABLED" == enabled ]]; then systemctl enable microi-auth-guard.service || return 1
  else systemctl disable microi-auth-guard.service || return 1; fi
  if [[ "$PANEL_GUARD_PREVIOUS_ACTIVE" == active ]]; then
    systemctl restart microi-auth-guard.service || return 1
    panel_guard_wait_ready || { printf 'Microi.Panel：原防护源码已恢复，但控制面回读仍未就绪，不能报告恢复成功。\n' >&2; return 1; }
    printf 'Microi.Panel：原宿主防护已恢复并通过控制面回读；失败候选保留于 %s。\n' "$failed" >&2
  else
    actual=$(systemctl is-active microi-auth-guard.service) || true
    [[ "$actual" == inactive || "$actual" == failed ]] || return 1
    printf 'Microi.Panel：原宿主防护文件与未运行状态已恢复；未宣称网络保护就绪，失败候选保留于 %s。\n' "$failed" >&2
  fi
}
panel_guard_abort(){
  panel_guard_rollback || printf 'Microi.Panel：自动恢复未取得完整回执，请保留防护候选、备份及日志，由主机控制台核对。\n' >&2
  fail "$1；本次安装仍记为失败，面板与业务数据保留"
}
panel_install_auth_guard(){
  ((PANEL_HAS_AUTH_GUARD)) || return 0
  command -v python3 >/dev/null 2>&1 || fail '宿主防护需要Python 3，请安装后重试；尚未变更面板服务'
  command -v systemctl >/dev/null 2>&1 || fail '宿主防护需要systemd，当前系统不支持默认主机守护服务'
  local target=/opt/microi-auth-guard backup="/opt/microi-auth-guard.before-$PANEL_OPERATION_ID" prepared="/opt/microi-auth-guard.candidate-$PANEL_OPERATION_ID" file
  for file in /opt /etc /var/lib /run "$target" /etc/microi-auth-guard /var/lib/microi-auth-guard /run/microi-auth-guard; do
    [[ ! -L "$file" ]] || fail "防护路径不能是符号链接：$file"
  done
  [[ ! -L /etc/systemd/system/microi-auth-guard.service ]] || fail '既有防护服务定义是符号链接，停止覆盖'
  if [[ -e /etc/systemd/system/microi-auth-guard.service ]]; then
    [[ -f "$target/microi-auth-guard.service" ]] && cmp -s "$target/microi-auth-guard.service" /etc/systemd/system/microi-auth-guard.service || fail '既有同名服务定义无法确认归属或有本地修改，保留并停止覆盖'
  fi
  if [[ -e "$target" ]]; then
    PANEL_GUARD_PREVIOUS_TREE=$(panel_guard_tree_receipt "$target") || fail '既有防护文件树或manifest无法确认，停止覆盖'
    PANEL_GUARD_PREVIOUS_UNIT=$(panel_file_receipt /etc/systemd/system/microi-auth-guard.service) || fail '既有防护unit无法回读'
    [[ "$PANEL_GUARD_PREVIOUS_UNIT" != missing ]] || fail '既有防护unit缺失，停止覆盖'
    PANEL_GUARD_PREVIOUS_SERVICE=$(panel_guard_service_receipt) || fail '既有防护来自其他unit路径、drop-in或非标准启用状态，保留现场'
    PANEL_GUARD_PREVIOUS_ENABLED=${PANEL_GUARD_PREVIOUS_SERVICE##*|}
    PANEL_GUARD_PREVIOUS_ACTIVE=$(systemctl is-active microi-auth-guard.service) || true
    [[ "$PANEL_GUARD_PREVIOUS_ACTIVE" == active || "$PANEL_GUARD_PREVIOUS_ACTIVE" == inactive || "$PANEL_GUARD_PREVIOUS_ACTIVE" == failed ]] || fail '既有防护正在切换状态，稍后重试'
  else
    [[ $(systemctl show microi-auth-guard.service --property=LoadState --value) == not-found ]] || fail '同名防护服务已有非本安装器定义，停止覆盖'
  fi
  mkdir -p "$PANEL_ROOT"
  PANEL_GUARD_STAGE=$(mktemp -d "$PANEL_ROOT/.authguard-stage.XXXXXX") || fail '无法创建本轮防护暂存目录'
  PANEL_GUARD_EXPORT_ID=$(docker create --name "microi-panel-guard-export-$PANEL_OPERATION_ID" --label "io.microi.panel.installer-export=$PANEL_OPERATION_ID" --network none "$PANEL_IMAGE_ID") || fail '无法只读导出候选防护文件'
  docker cp "$PANEL_GUARD_EXPORT_ID:/app/AuthGuard/." "$PANEL_GUARD_STAGE" || fail '新候选声明防护能力但缺少完整产物，停止安装'
  # 镜像协议与实际文件同时成立，旧镜像和缺文件不能靠生成空白配置冒充已交付。
  python3 - "$PANEL_GUARD_STAGE" <<'PANEL_GUARD_MANIFEST'
import json,pathlib,sys
root=pathlib.Path(sys.argv[1]); required={'daemon.py','store.py','firewall.py','collectors.py','redis_proxy.py','run.sh','microi-auth-guard.service'}
manifest=root/'manifest.json'
if manifest.is_symlink() or not manifest.is_file() or manifest.stat().st_size>65536: raise SystemExit('AuthGuard manifest missing or invalid')
data=json.loads(manifest.read_text(encoding='utf-8'))
if data.get('protocol')!=1 or data.get('entrypoint')!='daemon.py' or not required.issubset(set(data.get('files',[]))): raise SystemExit('AuthGuard manifest protocol/files mismatch')
for name in required:
    path=root/name
    if path.is_symlink() or not path.is_file(): raise SystemExit('AuthGuard required file missing: '+name)
PANEL_GUARD_MANIFEST
  python3 -B "$PANEL_GUARD_STAGE/daemon.py" --check --config /etc/microi-auth-guard/config.json || fail '宿主防护前置检查失败，原面板与数据库保持原状'
  [[ ! -e "$prepared" && ! -L "$prepared" ]] || fail '本轮防护候选目录已存在，停止覆盖'
  mkdir -m 700 -- "$prepared"
  for file in manifest.json daemon.py store.py firewall.py collectors.py redis_proxy.py run.sh microi-auth-guard.service; do
    install -m 600 "$PANEL_GUARD_STAGE/$file" "$prepared/$file"
  done
  chmod 700 "$prepared/run.sh"
  printf '%s\n' "$PANEL_OPERATION_ID" > "$prepared/.installer-operation"
  PANEL_GUARD_CANDIDATE_TREE=$(panel_guard_tree_receipt "$prepared") || fail '候选防护文件无法取得完整回执'
  if [[ -e "$target" ]]; then
    [[ -d "$target" && -f "$target/manifest.json" && ! -e "$backup" ]] || fail '既有防护目录无法确认归属，停止覆盖'
    [[ $(panel_guard_tree_receipt "$target") == "$PANEL_GUARD_PREVIOUS_TREE" && $(panel_file_receipt /etc/systemd/system/microi-auth-guard.service) == "$PANEL_GUARD_PREVIOUS_UNIT" && $(panel_guard_service_receipt) == "$PANEL_GUARD_PREVIOUS_SERVICE" ]] || fail '防护导出期间原文件或服务已变化，停止覆盖'
    mv -T -n -- "$target" "$backup"
    [[ ! -e "$target" && ! -L "$target" && $(panel_guard_tree_receipt "$backup") == "$PANEL_GUARD_PREVIOUS_TREE" ]] || fail '原防护目录未能安全保留，停止安装'
  else
    [[ -z "$PANEL_GUARD_PREVIOUS_TREE" && $(panel_file_receipt /etc/systemd/system/microi-auth-guard.service) == missing ]] || fail '防护准备期间原目录或服务定义已变化，停止覆盖'
  fi
  mv -T -n -- "$prepared" "$target"
  [[ ! -e "$prepared" && ! -L "$prepared" && $(panel_guard_tree_receipt "$target") == "$PANEL_GUARD_CANDIDATE_TREE" ]] || fail '防护候选目录切换身份不符，停止修改服务定义'
  install -d -m 700 /etc/microi-auth-guard /var/lib/microi-auth-guard /run/microi-auth-guard
  [[ $(panel_file_receipt /etc/systemd/system/microi-auth-guard.service) == "${PANEL_GUARD_PREVIOUS_UNIT:-missing}" ]] || fail '防护unit在切换期间被外部修改，停止覆盖'
  install -m 644 "$target/microi-auth-guard.service" /etc/systemd/system/microi-auth-guard.service
  PANEL_GUARD_CANDIDATE_UNIT=$(panel_file_receipt /etc/systemd/system/microi-auth-guard.service) || fail '候选防护unit无法取得回执'
  # config与state从不覆盖；控制面就绪不等于每个既有数据库已接入，后者由状态回读明确报告。
  if ! systemctl daemon-reload || ! systemctl enable microi-auth-guard.service || ! systemctl restart microi-auth-guard.service; then
    PANEL_GUARD_CANDIDATE_SERVICE=$(panel_guard_service_receipt) || PANEL_GUARD_CANDIDATE_SERVICE=''
    panel_guard_abort '候选宿主防护启动失败'
  fi
  PANEL_GUARD_CANDIDATE_SERVICE=$(panel_guard_service_receipt) || panel_guard_abort '候选防护服务身份无法回读'
  panel_guard_wait_ready || panel_guard_abort '候选宿主防护未取得防火墙真实生效回执'
  printf 'Microi.Panel：宿主防护控制面已回读。上方状态中的待接入、待验证或迁移项仍未完全保护；原数据库不会自动重建。\n'
  [[ ! -d "$backup" ]] || printf 'Microi.Panel：先前防护源码已保留供恢复：%s\n' "$backup"
}
usage(){
  cat <<'HELP'
吾码服务器运维面板安装器 v2.0.1（源码候选，尚未正式发布）
  bash install-microi-panel.sh [选项]
  --host <域名或IPv4>   浏览器使用的地址，交互安装时询问
  --port <端口>         独立HTTPS端口，默认61890
  --bind <IPv4>         监听地址，默认0.0.0.0；内网代理可设127.0.0.1
  --root <目录>         独立目录，默认/microi/panel
  --image <镜像>        显式选择已校验镜像，默认要求主机防护协议1
  --offline             只使用已经docker load导入的本地镜像
  --legacy-panel-only   仅首装或旧版升级旧版可用；仅旧版面板，不含SSH/数据库认证防护
  --install-docker      新主机缺少Docker时安装Docker Engine
  --upgrade             使用原账号、证书、配置和数据更新面板
  --check               只读检查参数、Docker、目录和端口，不安装
  --yes                 非交互执行；新安装必须同时明确--host
  --help                查看帮助
已有宝塔/1Panel无需停止。端口已占用时请改用独立端口；安装器不抢占端口。
未传--image时使用默认稳定版v2.0.0：仅旧版面板，不含SSH/数据库认证防护。
2.0.1新防护尚未正式发布，须用--image选择已验证候选；本地候选同时传--offline。
显式旧版镜像须加--legacy-panel-only；已安装主机防护协议的面板禁止降级到旧版。
HELP
}
while (($#)); do
  case "$1" in
    --host|--port|--bind|--root|--image)
      (($#>=2)) || fail "$1 缺少值"
      case "$1" in --host) PANEL_HOST=$2;; --port) PANEL_PORT=$2;; --bind) PANEL_BIND=$2;; --root) PANEL_ROOT=$2;; --image) PANEL_IMAGE=$2; PANEL_IMAGE_EXPLICIT=1;; esac
      shift 2;;
    --offline) PANEL_OFFLINE=1; shift;; --upgrade) PANEL_UPGRADE=1; shift;;
    --legacy-panel-only) PANEL_LEGACY_PANEL_ONLY=1; shift;;
    --check) PANEL_CHECK=1; shift;; --install-docker) PANEL_DOCKER_INSTALL=1; shift;;
    --yes) PANEL_YES=1; shift;; --help|-h) usage; exit 0;; *) fail "未知参数：$1";;
  esac
done
panel_select_install_scope
if ((EUID!=0 && PANEL_CHECK==0)); then
  command -v sudo >/dev/null 2>&1 || fail '需要root权限，当前系统没有sudo；请su -后重新运行本命令'
  exec sudo -- bash "$0" "${PANEL_ORIGINAL_ARGS[@]}"
fi
[[ "$PANEL_ROOT" =~ ^/([a-zA-Z0-9_-]+/)*[a-zA-Z0-9_-]+$ ]] || fail '安装目录必须是由字母、数字、短横线和下划线组成的独立绝对目录'
[[ "$PANEL_PORT" =~ ^[0-9]{4,5}$ ]] && ((10#$PANEL_PORT>=1024 && 10#$PANEL_PORT<=65535)) || fail 'HTTPS端口须为1024–65535'
[[ "$PANEL_BIND" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail '监听地址必须为IPv4'
[[ "$PANEL_IMAGE" =~ ^[a-z0-9][a-z0-9./:_@-]+$ ]] || fail '镜像引用格式无效'
PANEL_PORT=$((10#$PANEL_PORT))
PANEL_PARENT=$PANEL_ROOT
while [[ "$PANEL_PARENT" != / ]]; do
  [[ ! -L "$PANEL_PARENT" ]] || fail "目录包含符号链接，停止写入：$PANEL_PARENT"
  PANEL_PARENT=$(dirname "$PANEL_PARENT")
done
if ((PANEL_CHECK==0)); then
  panel_acquire_install_lock
  PANEL_OPERATION_ID=$(cat /proc/sys/kernel/random/uuid) || fail '无法生成本次面板安装操作标识'
  [[ "$PANEL_OPERATION_ID" =~ ^[a-f0-9-]{36}$ ]] || fail '本次面板安装操作标识无效'
  trap panel_guard_cleanup EXIT
fi
if ((PANEL_UPGRADE)); then
  [[ -r "$PANEL_ROOT/config/panel.env" ]] || fail '升级需要原安装目录中的config/panel.env'
  PANEL_URL=$(sed -n 's/^OPS_PUBLIC_URL=//p' "$PANEL_ROOT/config/panel.env")
  [[ "$PANEL_URL" =~ ^https://[a-zA-Z0-9.-]+:([0-9]{4,5})$ ]] || fail '原面板HTTPS地址不符合独立安装格式，请核对原配置'
  PANEL_PORT=${BASH_REMATCH[1]}
else
  if [[ -z "$PANEL_HOST" ]]; then
    if ((PANEL_YES || PANEL_CHECK)); then fail '请使用--host指定浏览器实际使用的域名或IPv4'; fi
    read -r -p '浏览器访问使用的域名或服务器IPv4：' PANEL_HOST
  fi
  [[ "$PANEL_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]] || fail '访问地址只填写域名或IPv4，不包含协议、路径和端口'
  PANEL_URL="https://${PANEL_HOST}:${PANEL_PORT}"
fi
printf 'Microi.Panel：目录 %s；HTTPS入口 %s；镜像 %s\n' "$PANEL_ROOT" "$PANEL_URL" "$PANEL_IMAGE"

download(){
  if command -v curl >/dev/null 2>&1; then curl --fail --location --retry 3 --connect-timeout 20 --max-time 180 "$1" -o "$2"
  elif command -v wget >/dev/null 2>&1; then wget --timeout=30 --tries=3 -O "$2" "$1"
  else fail '缺少curl或wget，请先安装一个下载工具'; fi
}
install_docker_apt(){
  local distro=$1 codename=$2 existing_package repository key_fingerprint candidate_dir selected_repository=''
  [[ "$distro" == ubuntu || "$distro" == debian ]] && [[ "$codename" =~ ^[a-z]+$ ]] || fail 'Docker APT发行版或代号无效'
  # 不为安装面板卸载用户已有的容器运行时；如存在冲突，由管理员选择保留或迁移。
  for existing_package in docker.io docker-compose docker-compose-v2 podman-docker containerd runc; do
    if [[ $(dpkg-query -W -f='${Status}' "$existing_package" 2>/dev/null || true) == 'install ok installed' ]]; then
      fail "检测到已有容器运行时包 ${existing_package}，请先按Docker文档处理兼容性；未卸载或替换它"
    fi
  done
  DEBIAN_FRONTEND=noninteractive apt-get -o Acquire::Retries=3 -o DPkg::Lock::Timeout=300 update
  DEBIAN_FRONTEND=noninteractive apt-get -o Acquire::Retries=3 -o DPkg::Lock::Timeout=300 install -y --no-install-recommends ca-certificates curl gnupg
  candidate_dir=$(mktemp -d /tmp/microi-panel-docker-apt.XXXXXX)
  # 只用Docker签名的软件包；国内镜像只是传输回退，不能替换签名身份。
  for repository in "https://download.docker.com/linux/$distro" "https://mirrors.aliyun.com/docker-ce/linux/$distro"; do
    if curl --fail --silent --show-error --location --retry 2 --retry-all-errors --connect-timeout 8 --max-time 30 "$repository/gpg" -o "$candidate_dir/docker.asc" \
      && curl --fail --silent --show-error --location --retry 2 --retry-all-errors --connect-timeout 8 --max-time 30 "$repository/dists/$codename/InRelease" -o "$candidate_dir/InRelease"; then
      key_fingerprint=$(gpg --batch --show-keys --with-colons "$candidate_dir/docker.asc" 2>/dev/null | awk -F: '$1=="fpr" {print $10; exit}')
      [[ "$key_fingerprint" == 9DC858229FC7DD38854AE2D88D81803C0EBFCD88 ]] || fail 'Docker仓库签名公钥身份不符，停止安装'
      selected_repository=$repository
      break
    fi
  done
  [[ -n "$selected_repository" ]] || fail 'Docker官方及国内软件包仓库均不可达；未创建面板配置，请恢复网络后重试'
  printf 'Microi.Panel：Docker软件包仓库 %s；已核对Docker签名公钥。\n' "$selected_repository"
  install -m 0755 -d /etc/apt/keyrings
  install -m 0644 "$candidate_dir/docker.asc" /etc/apt/keyrings/microi-panel-docker.asc
  cat > "$candidate_dir/microi-panel-docker.sources" <<REPO
Types: deb
URIs: $selected_repository
Suites: $codename
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/microi-panel-docker.asc
REPO
  if [[ -e /etc/apt/sources.list.d/microi-panel-docker.sources ]]; then
    cmp -s "$candidate_dir/microi-panel-docker.sources" /etc/apt/sources.list.d/microi-panel-docker.sources || fail '已有不同的面板Docker仓库配置，请先核对；未覆盖它'
  else
    install -m 0644 "$candidate_dir/microi-panel-docker.sources" /etc/apt/sources.list.d/microi-panel-docker.sources
  fi
  DEBIAN_FRONTEND=noninteractive apt-get -o Acquire::Retries=3 -o DPkg::Lock::Timeout=300 update
  DEBIAN_FRONTEND=noninteractive apt-get -o Acquire::Retries=3 -o DPkg::Lock::Timeout=300 install -y --no-install-recommends docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}
install_docker(){
  ((PANEL_OFFLINE==0)) || fail '离线模式要求先准备Docker Engine和Compose插件'
  [[ -r /etc/os-release ]] || fail '无法识别Linux发行版'
  # Docker安装属于主机运行时。仅在缺少Docker时执行，禁止更改已经工作的Docker守护进程配置。
  . /etc/os-release
  case "$ID" in
    ubuntu|debian)
      install_docker_apt "$ID" "${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
      ;;
    centos|rhel|fedora|raspbian)
      local script_dir
      script_dir=$(mktemp -d /tmp/microi-panel-docker.XXXXXX)
      download https://get.docker.com "$script_dir/install-docker.sh"
      sh "$script_dir/install-docker.sh"
      ;;
    alinux|anolis|rocky|almalinux)
      command -v dnf >/dev/null 2>&1 || fail '此发行版需要dnf，请按Docker官方文档先安装Docker'
      # 衍生发行版不能把自身releasever=3传入CentOS仓库；仓库文件限定EL兼容分支，不修改全局releasever。
      local el_major
      if [[ "$ID" == alinux || "$ID" == anolis ]]; then el_major=8; else el_major=${VERSION_ID%%.*}; fi
      [[ "$el_major" =~ ^(8|9|10)$ ]] || fail "未验证的EL兼容版本：$VERSION_ID"
      [[ ! -e /etc/yum.repos.d/microi-panel-docker.repo ]] || fail '已有面板Docker仓库文件，请核对后继续'
      cat > /etc/yum.repos.d/microi-panel-docker.repo <<REPO
[microi-panel-docker]
name=Docker CE stable for Microi.Panel
baseurl=https://download.docker.com/linux/centos/$el_major/\$basearch/stable
enabled=1
gpgcheck=1
gpgkey=https://download.docker.com/linux/centos/gpg
REPO
      dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
      ;;
    *) fail "暂未提供此发行版的自动Docker安装：$ID；按Docker官方文档安装后可继续";;
  esac
  systemctl enable --now docker
}
if ! command -v docker >/dev/null 2>&1; then
  if ((PANEL_CHECK)); then fail 'Docker尚未安装；只读检查已结束'; fi
  if ((PANEL_DOCKER_INSTALL==0)); then
    ((PANEL_YES==0)) || fail '缺少Docker；非交互安装请明确传入--install-docker'
    read -r -p '此主机尚无Docker，是否安装Docker Engine？[y/N] ' panel_answer
    [[ "$panel_answer" == y || "$panel_answer" == Y ]] || fail '已停止；未安装Docker'
  fi
  ((EUID==0)) || fail '安装Docker需要root，请以root运行本命令'
  install_docker
fi
command -v timeout >/dev/null 2>&1 || fail '缺少coreutils timeout，请先安装系统基础工具'
timeout 15 docker info >/dev/null || fail '现有Docker不可用；请先核对docker服务，安装器不会重置或替换它'
docker compose version >/dev/null || fail '需要Docker Compose v2插件；不会替换现有Docker'
[[ $(docker info --format '{{.OSType}}') == linux ]] || fail '面板仅支持Linux Docker Engine'
PANEL_COMPOSE="$PANEL_ROOT/docker-compose.yml"
panel_capture_image_override
# 兼容Docker对同一key/不同key过滤的行为，单独盘点旧Ops与新Panel后去重。
PANEL_EXISTING_NEW=$(docker ps -aq --filter label=io.microi.panel.controller=true) || fail '无法读取既有Panel控制器清单，停止安装'
PANEL_EXISTING_OPS=$(docker ps -aq --filter label=io.microi.ops.controller=true) || fail '无法读取既有Ops控制器清单，停止安装'
PANEL_CONTROLLERS=$(printf '%s\n%s\n' "$PANEL_EXISTING_NEW" "$PANEL_EXISTING_OPS" | sed '/^$/d' | sort -u)
if ((PANEL_UPGRADE==0)); then
  [[ -z "$PANEL_CONTROLLERS" ]] || fail '本机已有吾码Ops/Panel（包含停止状态）；请使用原编排升级，避免两个控制器管理同一主机'
  [[ ! -e "$PANEL_COMPOSE" && ! -e "$PANEL_ROOT/config/panel.env" ]] || fail '已有配置，请使用--upgrade保留账号和数据升级'
  [[ -z $(docker ps -aq --filter 'name=^/microi-panel$') ]] || fail 'microi-panel容器名已存在，停止覆盖'
  if command -v ss >/dev/null 2>&1 && [[ -n $(ss -Hln "sport = :$PANEL_PORT" 2>/dev/null) ]]; then fail '选定端口已占用，请改用--port；已有服务保持不变'; fi
else
  [[ -f "$PANEL_COMPOSE" && -f "$PANEL_ROOT/config/panel.env" ]] || fail '升级需要既有独立Panel编排；旧Ops请按兼容迁移文档使用原Compose'
  [[ -f "$PANEL_ROOT/config/admin-password" && -f "$PANEL_ROOT/config/panel.pfx" ]] || fail '原凭据或证书文件缺失，停止升级'
  [[ $(docker inspect --format '{{index .Config.Labels "io.microi.panel.controller"}}' microi-panel) == true ]] || fail '同名容器不是吾码面板，停止升级'
  [[ $(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/microi/ops/data"}}{{.Source}}{{end}}{{end}}' microi-panel) == "$PANEL_ROOT/data" ]] || fail '原面板数据目录与--root不一致，停止升级'
  while read -r panel_controller; do
    [[ -z "$panel_controller" || $(docker inspect --format '{{.Name}}' "$panel_controller") == /microi-panel ]] || fail '存在另一个Ops/Panel控制器（包含停止状态），停止竞争更新'
  done <<< "$PANEL_CONTROLLERS"
  PANEL_URL=$(sed -n 's/^OPS_PUBLIC_URL=//p' "$PANEL_ROOT/config/panel.env")
  panel_inspect_target || fail '无法完整回读原面板身份与数据挂载，停止升级'
  PANEL_PREVIOUS_IMAGE=$PANEL_CURRENT_IMAGE
  PANEL_PREVIOUS_CONTAINER_ID=$PANEL_CURRENT_ID
  PANEL_EXPECTED_MOUNTS=$PANEL_CURRENT_MOUNTS
  PANEL_ORIGINAL_MOUNTS=$PANEL_CURRENT_MOUNTS
fi
if ((PANEL_CHECK)); then printf 'Microi.Panel：只读检查通过，未写入或启动服务。\n'; exit 0; fi
((EUID==0)) || fail '写入面板配置需要root，请以root运行'
if ((PANEL_OFFLINE)); then docker image inspect "$PANEL_IMAGE" >/dev/null || fail '本地缺少所选镜像'
else docker pull "$PANEL_IMAGE"; fi
# 拉取完成再生成配置或停止旧控制器；下载失败不改变既有入口。
PANEL_IMAGE_ID=$(docker image inspect --format '{{.Id}}' "$PANEL_IMAGE")
[[ $(docker image inspect --format '{{index .Config.Labels "io.microi.panel.controller"}}' "$PANEL_IMAGE_ID") == true ]] || fail '所选镜像未声明吾码面板身份'
[[ $(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.version"}}' "$PANEL_IMAGE_ID") == 2.* ]] || fail '此安装器只接受2.x面板；跨主版本需要对应迁移方案'
panel_guard_feature
panel_guard_upgrade_compatibility
if ((PANEL_UPGRADE)); then panel_assert_target "$PANEL_PREVIOUS_IMAGE" "$PANEL_PREVIOUS_CONTAINER_ID" '' "$PANEL_ORIGINAL_MOUNTS"; fi
panel_assert_image_override
panel_install_auth_guard
if ((PANEL_UPGRADE==0)); then
  mkdir -p "$PANEL_ROOT"
  docker run --rm --name microi-panel-bootstrap --network none --memory 256m --cpus 1 \
    --security-opt no-new-privileges:true -v "$PANEL_ROOT:$PANEL_ROOT" \
    -e "PANEL_INSTALL_ROOT=$PANEL_ROOT" -e "PANEL_INSTALL_PORT=$PANEL_PORT" -e "PANEL_INSTALL_URL=$PANEL_URL" \
    -e "PANEL_INSTALL_BIND=$PANEL_BIND" -e "PANEL_INSTALL_IMAGE=$PANEL_IMAGE" "$PANEL_IMAGE_ID" --init-panel
else
  # 下载期间其它工具可能重建面板；重新核对原容器而不是仅比较可复用的镜像名称。
  panel_assert_target "$PANEL_PREVIOUS_IMAGE" "$PANEL_PREVIOUS_CONTAINER_ID" '' "$PANEL_EXPECTED_MOUNTS"
  # 升级先保留一份精确编排，使用独立override避免重写用户已有端口/挂载/环境。
  panel_assert_image_override
  cp -p -n "$PANEL_COMPOSE" "$PANEL_ROOT/docker-compose.before-panel-upgrade.$PANEL_OPERATION_ID.yml"
  if [[ -f "$PANEL_ROOT/docker-compose.image.yml" ]]; then cp -p -n "$PANEL_ROOT/docker-compose.image.yml" "$PANEL_ROOT/docker-compose.image.before-upgrade.$PANEL_OPERATION_ID.yml"; fi
fi
if ((PANEL_HAS_AUTH_GUARD && PANEL_UPGRADE)); then
  if [[ "$PANEL_EXPECTED_MOUNTS" == *'/run/microi-auth-guard='* ]]; then
    [[ "$PANEL_EXPECTED_MOUNTS" == *'/run/microi-auth-guard=/run/microi-auth-guard:false;'* ]] || fail '既有防护socket挂载不符合只读约定，停止改写'
  else
    PANEL_EXPECTED_MOUNTS+='/run/microi-auth-guard=/run/microi-auth-guard:false;'
    IFS=';' read -r -a panel_mount_entries <<< "$PANEL_EXPECTED_MOUNTS"
    PANEL_EXPECTED_MOUNTS=$(printf '%s\n' "${panel_mount_entries[@]}" | LC_ALL=C sort | paste -sd ';' -)';'
  fi
fi
panel_write_image_override "$PANEL_IMAGE_ID"
docker compose -f "$PANEL_COMPOSE" -f "$PANEL_ROOT/docker-compose.image.yml" config --quiet
if ((PANEL_UPGRADE)); then
  panel_assert_target "$PANEL_PREVIOUS_IMAGE" "$PANEL_PREVIOUS_CONTAINER_ID" '' "$PANEL_ORIGINAL_MOUNTS"
else
  PANEL_NAMED_CONTAINER=$(docker ps -aq --no-trunc --filter 'name=^/microi-panel$') || fail '无法回读安装前容器状态，停止创建'
  [[ -z "$PANEL_NAMED_CONTAINER" ]] || fail '安装期间同名容器已出现，保留现场并停止创建'
fi
PANEL_STARTED=0
if docker compose -f "$PANEL_COMPOSE" -f "$PANEL_ROOT/docker-compose.image.yml" up -d --no-deps microi-panel; then PANEL_STARTED=1; fi
if ((PANEL_STARTED)); then
  panel_assert_target "$PANEL_IMAGE_ID" '' "$PANEL_OPERATION_ID" "$PANEL_EXPECTED_MOUNTS"
  PANEL_CANDIDATE_CONTAINER_ID=$PANEL_CURRENT_ID
  if ((PANEL_HAS_AUTH_GUARD)); then [[ "$PANEL_CURRENT_MOUNTS" == *'/run/microi-auth-guard=/run/microi-auth-guard:false;'* ]] || fail '新候选缺少宿主防护socket只读挂载'; fi
fi
for ((panel_attempt=0;PANEL_STARTED && panel_attempt<60;panel_attempt++)); do
  panel_assert_target "$PANEL_IMAGE_ID" "$PANEL_CANDIDATE_CONTAINER_ID" "$PANEL_OPERATION_ID" "$PANEL_EXPECTED_MOUNTS"
  if docker exec "$PANEL_CANDIDATE_CONTAINER_ID" dotnet Microi.Panel.dll --health-check >/dev/null 2>&1; then
    if ((PANEL_HAS_AUTH_GUARD)) && ! docker exec "$PANEL_CANDIDATE_CONTAINER_ID" dotnet Microi.Panel.dll --ready-check >/dev/null 2>&1; then sleep 2; continue; fi
    panel_assert_target "$PANEL_IMAGE_ID" "$PANEL_CANDIDATE_CONTAINER_ID" "$PANEL_OPERATION_ID" "$PANEL_EXPECTED_MOUNTS"
    panel_report_completion
    exit 0
  fi
  sleep 2
done
if ((PANEL_UPGRADE)) && [[ -n "$PANEL_PREVIOUS_IMAGE" ]]; then
  # 只有明确查无同名容器、仍为原容器或仍为本轮候选时恢复；Docker不可达及同镜像外部替换都失败关闭。
  PANEL_NAMED_CONTAINER=$(docker ps -aq --no-trunc --filter 'name=^/microi-panel$') || fail '无法确认失败后的容器状态，停止自动回退'
  if [[ -n "$PANEL_NAMED_CONTAINER" ]]; then
    if [[ "$PANEL_NAMED_CONTAINER" == "$PANEL_PREVIOUS_CONTAINER_ID" ]]; then
      panel_assert_target "$PANEL_PREVIOUS_IMAGE" "$PANEL_PREVIOUS_CONTAINER_ID" '' "$PANEL_ORIGINAL_MOUNTS"
    else
      panel_assert_target "$PANEL_IMAGE_ID" "$PANEL_CANDIDATE_CONTAINER_ID" "$PANEL_OPERATION_ID" "$PANEL_EXPECTED_MOUNTS"
    fi
  fi
  printf 'Microi.Panel：新面板健康检查失败，正在恢复此前镜像；业务插件保持当前状态。\n' >&2
  panel_write_image_override "$PANEL_PREVIOUS_IMAGE"
  docker compose -f "$PANEL_COMPOSE" -f "$PANEL_ROOT/docker-compose.image.yml" up -d --no-deps microi-panel
  panel_assert_target "$PANEL_PREVIOUS_IMAGE" '' "$PANEL_OPERATION_ID" "$PANEL_EXPECTED_MOUNTS"
  PANEL_ROLLBACK_CONTAINER_ID=$PANEL_CURRENT_ID
  for ((panel_attempt=0;panel_attempt<30;panel_attempt++)); do
    panel_assert_target "$PANEL_PREVIOUS_IMAGE" "$PANEL_ROLLBACK_CONTAINER_ID" "$PANEL_OPERATION_ID" "$PANEL_EXPECTED_MOUNTS"
    if docker exec "$PANEL_ROLLBACK_CONTAINER_ID" dotnet Microi.Panel.dll --health-check >/dev/null 2>&1; then
      panel_assert_target "$PANEL_PREVIOUS_IMAGE" "$PANEL_ROLLBACK_CONTAINER_ID" "$PANEL_OPERATION_ID" "$PANEL_EXPECTED_MOUNTS"
      fail '新版本未通过检查，已恢复原面板。请保留日志并核对候选版本'
    fi
    sleep 2
  done
fi
fail '面板尚未通过健康检查，配置和数据已保留。请查看docker logs microi-panel'
