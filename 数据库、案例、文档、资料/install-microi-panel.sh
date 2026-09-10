#!/usr/bin/env bash
# 吾码服务器运维面板独立安装器。只创建本面板编排，不变更其它面板、Docker配置或业务数据。
set -Eeuo pipefail
umask 077
PANEL_ROOT=/microi/panel
PANEL_PORT=61890
PANEL_BIND=0.0.0.0
PANEL_HOST=''
PANEL_IMAGE=registry.cn-hangzhou.aliyuncs.com/microios/microi-panel:v2.0.0
PANEL_OFFLINE=0
PANEL_UPGRADE=0
PANEL_CHECK=0
PANEL_DOCKER_INSTALL=0
PANEL_YES=0
PANEL_PREVIOUS_IMAGE=''
PANEL_ORIGINAL_ARGS=("$@")
fail(){ printf 'Microi.Panel：%s\n' "$*" >&2; exit 1; }
usage(){
  cat <<'HELP'
吾码服务器运维面板安装器 v2.0.0
  bash install-microi-panel.sh [选项]
  --host <域名或IPv4>   浏览器使用的地址，交互安装时询问
  --port <端口>         独立HTTPS端口，默认61890
  --bind <IPv4>         监听地址，默认0.0.0.0；内网代理可设127.0.0.1
  --root <目录>         独立目录，默认/microi/panel
  --image <镜像>        指定已校验的面板镜像
  --offline             只使用已经docker load导入的本地镜像
  --install-docker      新主机缺少Docker时安装Docker Engine
  --upgrade             使用原账号、证书、配置和数据更新面板
  --check               只读检查参数、Docker、目录和端口，不安装
  --yes                 非交互执行；新安装必须同时明确--host
  --help                查看帮助
已有宝塔/1Panel无需停止。端口已占用时请改用独立端口；安装器不抢占端口。
HELP
}
while (($#)); do
  case "$1" in
    --host|--port|--bind|--root|--image)
      (($#>=2)) || fail "$1 缺少值"
      case "$1" in --host) PANEL_HOST=$2;; --port) PANEL_PORT=$2;; --bind) PANEL_BIND=$2;; --root) PANEL_ROOT=$2;; --image) PANEL_IMAGE=$2;; esac
      shift 2;;
    --offline) PANEL_OFFLINE=1; shift;; --upgrade) PANEL_UPGRADE=1; shift;;
    --check) PANEL_CHECK=1; shift;; --install-docker) PANEL_DOCKER_INSTALL=1; shift;;
    --yes) PANEL_YES=1; shift;; --help|-h) usage; exit 0;; *) fail "未知参数：$1";;
  esac
done
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
      fail "检测到已有容器运行时包 $existing_package，请先按Docker文档处理兼容性；未卸载或替换它"
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
  PANEL_PREVIOUS_IMAGE=$(docker inspect --format '{{.Image}}' microi-panel)
fi
if ((PANEL_CHECK)); then printf 'Microi.Panel：只读检查通过，未写入或启动服务。\n'; exit 0; fi
((EUID==0)) || fail '写入面板配置需要root，请以root运行'
if ((PANEL_OFFLINE)); then docker image inspect "$PANEL_IMAGE" >/dev/null || fail '本地缺少所选镜像'
else docker pull "$PANEL_IMAGE"; fi
# 拉取完成再生成配置或停止旧控制器；下载失败不改变既有入口。
PANEL_IMAGE_ID=$(docker image inspect --format '{{.Id}}' "$PANEL_IMAGE")
[[ $(docker image inspect --format '{{index .Config.Labels "io.microi.panel.controller"}}' "$PANEL_IMAGE_ID") == true ]] || fail '所选镜像未声明吾码面板身份'
[[ $(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.version"}}' "$PANEL_IMAGE_ID") == 2.* ]] || fail '此安装器只接受2.x面板；跨主版本需要对应迁移方案'
if ((PANEL_UPGRADE==0)); then
  mkdir -p "$PANEL_ROOT"
  docker run --rm --name microi-panel-bootstrap --network none --memory 256m --cpus 1 \
    --security-opt no-new-privileges:true -v "$PANEL_ROOT:$PANEL_ROOT" \
    -e "PANEL_INSTALL_ROOT=$PANEL_ROOT" -e "PANEL_INSTALL_PORT=$PANEL_PORT" -e "PANEL_INSTALL_URL=$PANEL_URL" \
    -e "PANEL_INSTALL_BIND=$PANEL_BIND" -e "PANEL_INSTALL_IMAGE=$PANEL_IMAGE" "$PANEL_IMAGE_ID" --init-panel
else
  # 升级先保留一份精确编排，使用独立override避免重写用户已有端口/挂载/环境。
  cp -p "$PANEL_COMPOSE" "$PANEL_ROOT/docker-compose.before-panel-upgrade.$(date -u +%Y%m%dT%H%M%SZ).yml"
  if [[ -f "$PANEL_ROOT/docker-compose.image.yml" ]]; then cp -p "$PANEL_ROOT/docker-compose.image.yml" "$PANEL_ROOT/docker-compose.image.before-upgrade.yml"; fi
fi
printf 'services:\n  microi-panel:\n    image: %s\n' "$PANEL_IMAGE_ID" > "$PANEL_ROOT/docker-compose.image.yml"
docker compose -f "$PANEL_COMPOSE" -f "$PANEL_ROOT/docker-compose.image.yml" config --quiet
PANEL_STARTED=0
if docker compose -f "$PANEL_COMPOSE" -f "$PANEL_ROOT/docker-compose.image.yml" up -d --no-deps microi-panel; then PANEL_STARTED=1; fi
for ((panel_attempt=0;PANEL_STARTED && panel_attempt<60;panel_attempt++)); do
  if docker exec microi-panel dotnet Microi.Panel.dll --health-check >/dev/null 2>&1; then
    printf 'Microi.Panel：安装完成。入口 %s\n账号 paneladmin；密码文件 %s/config/admin-password\n' "$PANEL_URL" "$PANEL_ROOT"
    printf '请在云安全组按需放行TCP %s。首次自签证书请核对安装输出的SHA-256指纹。\n' "$PANEL_PORT"
    printf '升级/重建时同时加载 docker-compose.yml 和 docker-compose.image.yml。\n'
    exit 0
  fi
  sleep 2
done
if ((PANEL_UPGRADE)) && [[ -n "$PANEL_PREVIOUS_IMAGE" ]]; then
  # 仅在当前容器仍为本次候选时回退，避免覆盖其它运维工具在此期间作出的替换。
  PANEL_CURRENT_IMAGE=$(docker inspect --format '{{.Image}}' microi-panel 2>/dev/null || true)
  [[ -z "$PANEL_CURRENT_IMAGE" || "$PANEL_CURRENT_IMAGE" == "$PANEL_IMAGE_ID" || "$PANEL_CURRENT_IMAGE" == "$PANEL_PREVIOUS_IMAGE" ]] || fail '更新期间容器已被外部替换，保留现场并停止自动回退'
  printf 'Microi.Panel：新面板健康检查失败，正在恢复此前镜像；业务插件保持当前状态。\n' >&2
  printf 'services:\n  microi-panel:\n    image: %s\n' "$PANEL_PREVIOUS_IMAGE" > "$PANEL_ROOT/docker-compose.image.yml"
  docker compose -f "$PANEL_COMPOSE" -f "$PANEL_ROOT/docker-compose.image.yml" up -d --no-deps microi-panel
  for ((panel_attempt=0;panel_attempt<30;panel_attempt++)); do
    if docker exec microi-panel dotnet Microi.Panel.dll --health-check >/dev/null 2>&1; then fail '新版本未通过检查，已恢复原面板。请保留日志并核对候选版本'; fi
    sleep 2
  done
fi
fail '面板尚未通过健康检查，配置和数据已保留。请查看docker logs microi-panel'
