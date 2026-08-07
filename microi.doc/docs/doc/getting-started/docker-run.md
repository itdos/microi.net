# 🐳 Docker 部署

> **通过 Docker 编排部署 Microi吾码低代码平台全套环境**

## 🚀 一键安装（零门槛部署）

针对不想本地编译代码、打包镜像、安装环境等繁琐操作的用户，提供**一键安装脚本**。

默认安装 **主数据库 + Redis + MinIO + MongoDB + PaddleX/PaddleOCR + LibreTranslate（基础语言套餐）+ Watchtower + 低代码平台程序（API + Web）**。全套服务基于 Docker Compose 独立编排部署，支持宝塔面板 Docker 编排模块可视化管理；各独立编排统一接入 `microi` Docker bridge 网络，API 通过容器 DNS 和内部端口访问数据库、Redis、MongoDB、MinIO。明确不需要动态翻译时可在提示中输入 `0` 跳过 LibreTranslate。

:::: warning 不再推荐安装 Ollama、nomic-embed-text 和 Qdrant
对于 Microi吾码默认的 **NL2SQL、NL2V8、在线 AI 数据分析与 AI 编程** 场景，平台内置的“**大模型关键词扩展 + 当前用户权限范围内的 Schema/Skill 搜索 + 精确表/字段回读**”已经完整替代原来的 **Ollama + `nomic-embed-text` + Qdrant** 方案。一键安装脚本已固定跳过这三项：安装更快、资源占用更低，也不会连接或同步向量数据库。

页面末尾仍保留 Ollama 与 Qdrant 的手动编排，仅用于已有项目兼容、独立本地模型实验，或经过实际召回评测后确认必须使用向量库的特殊场景；它们不是新装环境的推荐依赖。
::::

### 📦 CentOS 7/8/9 / Ubuntu 20/22/24 / Debian 10/11/12 一键安装
```bash
url=https://static.itdos.com/install/install-microi.sh;if command -v curl >/dev/null 2>&1;then curl -fsSL -o install-microi.sh "$url";else wget -O install-microi.sh "$url";fi;sed -i 's/\r$//' install-microi.sh;bash install-microi.sh
```

### ⚠️ 注意事项

| 序号 | 说明 |
| :--: | ---- |
| 1 | 执行脚本时会提示选择【公网 IP `g` / 内网 IP `n`】、主租户 `OsClient`（直接 Enter 默认为 `iTdos`）和主数据库类型/版本 |
| 2 | Docker 环境不存在时脚本会**自动安装** Docker 及 Docker Compose V2 插件 |
| 3 | MySQL 性能配置会**自动根据服务器内存**生成（支持 1G ~ 32G+ 多档位） |
| 4 | 数据库还原后会自动同步 `sys_osclients.OsClient/ClientName` 和 API、Web 编排中的 `OsClient` |
| 5 | MinIO 会自动创建私有桶 `mci-private`、公有桶 `mci-public`，为公有桶开放匿名下载权限，并把端点、密钥、桶名、SSL 等配置写回 `sys_osclients` |
| 6 | 根据安装模式选择的访问 IP 和实际分配端口，自动把 `sys_config.ApiBase` 写为 API 地址，把 `sys_config.FileServer` 写为 `http://<访问IP>:<MinIO API端口>/mci-public` |
| 7 | 端口从 **61600 开始顺序 +1 分配**；基础服务（含 OCR）占用 8 个连续端口，LibreTranslate 增加 1 个端口。候选端口段有冲突时起点每次 +1，最多尝试 100 次 |
| 8 | 安装器始终创建/复用 `microi` 共享 Docker bridge 网络；API 使用容器名和容器内部端口访问数据库、Redis、MongoDB、MinIO，不绕宿主机局域网 IP。宿主机映射端口仍保留给运维/外部访问；OCR 与 LibreTranslate 的诊断端口只绑定 `127.0.0.1` |
| 9 | OCR 国内固定版本镜像会默认安装。服务健康且 API 完成 Upgrade29 后，脚本才把 `OcrEnabled`、服务地址与限额写入当前唯一的 SaaS 主租户，并以数据库回读确认；任一阶段失败都不会启用错误配置 |
| 10 | API/Web 使用官方浮动标签时会在部署前强制回源拉取最新镜像，避免宿主机缓存的旧 `latest` 通过 liveness 后却缺少 Upgrade29/Upgrade31 |
| 11 | 密码与端口生成后若任一后段门禁失败，脚本仍保持非零退出码，同时打印“安装未完成”恢复汇总，包含已分配端口、已生成凭据、数据/编排目录和当前容器状态；该汇总不代表服务可用 |
| 12 | 检测到已有安装或中断编排时不要直接重跑、删卷或删除数据目录；先按失败汇总和 API 日志排查，确需停编排时使用对应目录的 `docker compose down`，禁止附加 `-v` |
| 13 | 若脚本中文显示为乱码/问号，请先执行 `export LANG=en_US.UTF-8` 或 `export LANG=C.UTF-8` 后重新运行 |

### 📋 端口分配表（默认从 61600 开始）

| 端口 | 服务 | 容器内部端口 |
| :--: | ---- | :--: |
| 61600 | Web 前端 | 80 |
| 61601 | API | 80 |
| 61602 | 主数据库（实际内部端口随所选数据库变化） | - |
| 61603 | Redis 7.4 | 6379 |
| 61604 | MongoDB | 27017 |
| 61605 | MinIO API | 9000 |
| 61606 | MinIO Console | 9001 |
| 61607 | PaddleX/PaddleOCR（仅 `127.0.0.1`） | 8080 |
| 61608 | LibreTranslate（默认安装，套餐 1） | 5000 |

> 上表是一直按 Enter 的吾码官方默认组合，共使用 9 个端口。只有明确输入 `0` 跳过 LibreTranslate 时才使用 `61600`～`61607`；若候选段冲突，脚本把起点从 `61600` 逐次加一后重新检查整段。

> 容器内的 `127.0.0.1` / `localhost` 只代表该容器自身，不能作为 API 连接其它容器的地址；宿主机局域网 IP 虽然可通过端口映射访问，但会额外经过宿主机网络、防火墙和 NAT。安装器因此固定采用 Docker DNS：Redis 为 `microi-install-redis:6379`，MongoDB 为 `microi-install-mongodb:27017`，数据库使用实际数据库容器名及内部端口，MinIO 服务端地址为 `microi-install-minio:9000`。只有宿主机本地健康探测才使用 `127.0.0.1:<映射端口>`，浏览器需要访问的 `ApiBase`、`FileServer` 和 MinIO 外网端点仍使用实际公网/局域网访问地址。

> OCR 的宿主机端口不会写入防火墙规则。API 与 OCR 均接入 external bridge 网络 `microi-ocr`，实际调用地址为 `http://microi-install-ocr:8080/ocr`，不经过公网或宿主机 LAN 地址。

### 🔄 一键更新/修复 **API 与 Web 前端**

适用于通过上述一键安装脚本部署的环境，也适用于以下故障：API 报“未检测到 `OsClientRedisHost`”、更新时报同名容器冲突、API/Web 编排在宝塔面板中消失。修复器会从现有容器 Compose 标签及两个标准目录中定位现场编排；多个配置不一致时会在删除容器前停止，不会猜测或覆盖。

```bash
url=https://static.itdos.com/install/install-microi.sh;if command -v curl >/dev/null 2>&1;then curl -fsSL -o install-microi.sh "$url";else wget -O install-microi.sh "$url";fi;sed -i 's/\r$//' install-microi.sh;bash install-microi.sh --repair-app
```

修复流程如下：

1. 回读现有 API/Web 容器的 Compose project、配置文件和镜像，静态校验 API 十项启动配置；先把 Compose、容器元数据和旧镜像恢复点保存到应用编排目录的 `.repair-backups/<时间>/`。
2. 创建/复用 `microi` 共享 bridge 网络，将现有数据库、Redis、MongoDB、MinIO 容器接入该网络；把 API 的数据库、Redis、MongoDB 启动连接迁移为容器 DNS 与内部端口。
3. 按现场 Compose 拉取镜像，临时停止 Watchtower，只删除并重建 `microi-install-api`、`microi-install-client` 两个无状态应用容器，从而接管丢失标签或归属漂移造成的同名容器冲突。
4. 重建后回读十项启动配置和 `microi` 网络，依次验证 API liveness、readiness；失败时自动尝试用修复前镜像恢复。最后恢复原本正在运行的 Watchtower。

> 该命令不会删除或重建主数据库、Redis、MongoDB、MinIO 容器，不会删除它们的数据目录或 Docker volume，也不会执行 `docker compose down -v`。API、Web 前端重建时会有短暂中断。宝塔标准编排目录存在而应用编排仅位于 `/microi/compose` 时，修复器会把已经完整解析的应用配置恢复到宝塔目录后再重建，使编排重新可管理。

### 🗑️ 删除所有已安装容器/编排

::: danger 此操作将导致所有数据丢失
方式一（推荐）：进入各编排目录执行 `docker compose down`

方式二（强制删除所有容器）：
```bash
docker ps -a --format "{{.Names}}" | grep "^microi-install-" | xargs -r docker rm -f
```
:::

### 🔌 离线安装（无互联网环境）

适用于**无法访问互联网**的 Linux 服务器，需要在一台有网络的机器上提前制作离线安装包。

#### 前置要求
- 目标服务器已安装 **Docker** 和 **Docker Compose V2** 插件（离线 Docker 安装请参考 [Docker 官方文档](https://docs.docker.com/engine/install/binaries/)）
- 目标服务器已安装 `unzip`、`openssl` 命令
- 制作离线包的机器需要有互联网且已安装 Docker

#### 第一步：在有网络的机器上制作离线包

```bash
# 下载制作脚本和离线安装脚本
curl -sSO https://static.itdos.com/install/microi-offline-prepare.sh
curl -sSO https://static.itdos.com/install/install-microi-offline.sh
curl -sSO https://static.itdos.com/install/install-microi.sh
sed -i 's/\r$//' microi-offline-prepare.sh install-microi-offline.sh install-microi.sh

# 执行制作脚本（会拉取 Docker 镜像并打包，约需 10-30 分钟）
bash microi-offline-prepare.sh
```

执行完成后会在当前目录生成 `microi-offline.zip`（约 5-10GB，包含所有 Docker 镜像和数据库文件）。

#### 第二步：上传到目标服务器并安装

```bash
# 1. 将 microi-offline.zip 上传到目标服务器（使用 scp、sftp 等工具）
scp microi-offline.zip root@目标服务器IP:/root/

# 2. 在目标服务器上解压
unzip microi-offline.zip -d microi-offline

# 3. 进入目录并执行离线安装
cd microi-offline
bash install-microi-offline.sh
```

::: warning 离线脚本版本边界
- 离线安装器独立维护，不能再假定与当前在线脚本功能完全一致；制作包前必须确认三个脚本版本相同。
- 当前 OCR 默认安装、Upgrade29 字段等待和 SaaS 配置回读以本页在线安装脚本为准。完全离线环境需要额外把固定 OCR 镜像执行 `docker save`/`docker load`，再按下方 OCR 手动编排部署并在健康后配置 SaaS 引擎。
- Watchtower 自动更新服务需要联网才能生效；完全离线环境不应把“容器已启动”当成已完成更新验证。
:::

---

## 🔧 Docker 手动编排部署

::: tip 生产环境建议
- 通过服务器面板**原生安装 MySQL**（低配服务器建议 v5.7.x，高配服务器建议 v8.0.x）
- Redis、MongoDB 根据实际情况自由决定编排部署还是服务器面板部署
:::

::: danger Ubuntu 24 注意
使用宝塔面板在 Ubuntu 24 上原生安装的 Redis、MongoDB，可能会遇到安装失败或修改端口/密码后无法启动服务，建议直接卸载改用 Docker 编排部署。
:::

请将编排中的镜像地址替换为您的实际地址（默认为开源版镜像）。如使用非公开镜像，需先登录：

```bash
# 请替换帐号、密码、地域
docker login --username=帐号 --password=密码 registry.cn-地域.aliyuncs.com
```

如果不使用宝塔等面板在编排界面操作，可使用脚本将编排内容转换成一行命令在SSH中执行，请将以下脚本命名为【一键编排生成.sh】文件然后直接运行

::: details 如果不使用宝塔等面板在编排界面操作，可使用脚本将编排内容置换成一行命令在SSH中执行
```bash
:<<'WIN'
@echo off
chcp 65001 2>nul
setlocal EnableDelayedExpansion
rem ════════════════════════════════════════════════════════════════
rem  Docker 编排 → 一行 SSH 命令生成器 - Windows 自动启动器
rem  自动查找 Git Bash 或 WSL 并执行此脚本
rem ════════════════════════════════════════════════════════════════
set "BASH_EXE="
if exist "%ProgramFiles%\Git\bin\bash.exe"           set "BASH_EXE=%ProgramFiles%\Git\bin\bash.exe"
if exist "%ProgramFiles(x86)%\Git\bin\bash.exe"      if not defined BASH_EXE set "BASH_EXE=%ProgramFiles(x86)%\Git\bin\bash.exe"
if exist "%LOCALAPPDATA%\Programs\Git\bin\bash.exe"  if not defined BASH_EXE set "BASH_EXE=%LOCALAPPDATA%\Programs\Git\bin\bash.exe"
if exist "C:\Git\bin\bash.exe"                       if not defined BASH_EXE set "BASH_EXE=C:\Git\bin\bash.exe"
if exist "C:\msys64\usr\bin\bash.exe"                if not defined BASH_EXE set "BASH_EXE=C:\msys64\usr\bin\bash.exe"
if not defined BASH_EXE (
    for /f "delims=" %%i in ('where bash 2^>nul') do (
        echo %%i | findstr /i "System32" >nul || if not defined BASH_EXE set "BASH_EXE=%%i"
    )
)
if defined BASH_EXE goto :bash_run
where wsl >nul 2>nul
if %ERRORLEVEL% equ 0 goto :wsl_run
echo.
echo   ════════════════════════════════════════════════════════
echo   ERROR: 未找到 Git Bash 或 WSL！请安装以下任意一种:
echo     1. Git for Windows: https://git-scm.com/download/win
echo     2. WSL2: 在管理员 PowerShell 中运行 wsl --install
echo   ════════════════════════════════════════════════════════
echo.
pause
exit /b 1
:bash_run
echo   ^> Bash: !BASH_EXE!
"!BASH_EXE!" "%~f0" %*
set EC=!ERRORLEVEL!
echo.
pause
exit /b !EC!
:wsl_run
echo   ^> WSL: 执行中...
for /f "delims=" %%p in ('wsl wslpath -u "%~f0"') do set "WSLP=%%p"
wsl bash "!WSLP!" %*
set EC=!ERRORLEVEL!
echo.
pause
exit /b !EC!
WIN
#!/usr/bin/env bash
# 如果用户在 macOS/Linux 上用 `sh 一键编排生成.sh` 启动，
# 这里先切回 bash；脚本后续依赖数组、case 等 bash 特性。
if [ -z "${BASH_VERSION:-}" ]; then
    if command -v bash >/dev/null 2>&1; then
        exec bash "$0" "$@"
    fi
    printf '%s\n' "ERROR: 未找到 bash，请安装 bash 后执行: bash $0" >&2
    exit 1
fi
set +o posix 2>/dev/null || true

# ════════════════════════════════════════════════════════════════
#  Docker 编排 → 一行 SSH 命令生成器
#  把任意 docker-compose 编排文件 / 编排内容 转成可在 SSH 终端
#  直接粘贴运行的一行命令：
#      mkdir -p <目录> && echo '<b64>' | base64 -d > <目录>/<文件> \
#          && cd <目录> && <compose命令> up -d
#
#  使用场景：
#      A 电脑有编排文件 → 一键生成一行命令 → 复制粘到 B 电脑的 SSH
#      终端 → 在 C 服务器(CentOS)上一键拉起所有编排容器。
#
#  两种调用方式：
#      [1] 双击 / 无参数    → 交互模式（输入路径或粘贴内容，生成 .sh 文件）
#      [2] bash 一键编排生成.sh <编排文件> [...选项]
#                          → 命令行模式（直接输出命令到屏幕）
#
#  平台支持：
#      macOS / Linux:  bash 一键编排生成.sh [选项]
#      Windows:        在资源管理器双击 .sh（自动调用 Git Bash / WSL）
#                      或 Git Bash 终端中执行同样的 bash 命令
# ════════════════════════════════════════════════════════════════
set -e
set -o pipefail

# 切换到脚本所在目录（确保编排文件相对路径可用，也是生成 .sh 文件的输出目录）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Windows (Git Bash / WSL) 下：异常退出也暂停等待用户确认，避免窗口一闪而过
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || -n "$WINDIR" ]]; then
    trap 'echo ""; read -r -p "  按回车键关闭窗口..." _w' EXIT
fi

# ──────────────────────────────────────────────────────────────
# 工具函数
# ──────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

print_banner() {
    echo ""
    echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    printf "${BOLD}${CYAN}║${NC}  ${BOLD}%-58s${NC}${BOLD}${CYAN}║${NC}\n" "$1"
    echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo -e "  ${CYAN}▸${NC} $1"
}

print_success() {
    echo -e "  ${GREEN}[OK]${NC} $1"
}

print_fail() {
    echo -e "  ${RED}[ERR]${NC} $1" >&2
    echo ""
    echo -e "  ${RED}════════════════════════════════════════════════════════════${NC}" >&2
    echo -e "  ${RED}脚本中止！${NC}" >&2
    echo -e "  ${RED}════════════════════════════════════════════════════════════${NC}" >&2
    exit 1
}

print_warning() {
    echo -e "  ${YELLOW}[WARN]${NC} $1"
}

# 跨平台 base64 编码（Linux 用 -w0，macOS BSD base64 没有 -w）
b64_encode() {
    if echo "test" | base64 -w0 >/dev/null 2>&1; then
        base64 -w0
    else
        base64 | tr -d '\n'
    fi
}

# 跨平台复制到剪贴板
copy_to_clipboard() {
    local content=$1
    if command -v pbcopy >/dev/null 2>&1; then
        printf '%s' "$content" | pbcopy
        print_success "已复制到剪贴板 (pbcopy)"
    elif command -v xclip >/dev/null 2>&1; then
        printf '%s' "$content" | xclip -selection clipboard
        print_success "已复制到剪贴板 (xclip)"
    elif command -v wl-copy >/dev/null 2>&1; then
        printf '%s' "$content" | wl-copy
        print_success "已复制到剪贴板 (wl-copy)"
    elif command -v clip.exe >/dev/null 2>&1; then
        printf '%s' "$content" | clip.exe
        print_success "已复制到剪贴板 (clip.exe)"
    elif command -v powershell.exe >/dev/null 2>&1; then
        printf '%s' "$content" | powershell.exe -NoProfile -Command "$input | Set-Clipboard"
        print_success "已复制到剪贴板 (PowerShell Set-Clipboard)"
    else
        print_warning "未检测到任何剪贴板命令（pbcopy / xclip / wl-copy / clip.exe / powershell.exe），请手动复制"
    fi
}

# Windows 路径转 Git Bash 路径：d:\Work\a.txt → /d/Work/a.txt
# 同时把反斜杠全部转为正斜杠
normalize_path() {
    local p=$1
    # 先把所有 \ 替换为 /
    p="${p//\\//}"
    # 把盘符前缀 X: 转为 /x（小写）
    if [[ "$p" =~ ^([A-Za-z]):(/|$) ]]; then
        local drive="${BASH_REMATCH[1],,}"
        local rest="${BASH_REMATCH[2]}"
        p="/${drive}${rest}"
    fi
    printf '%s' "$p"
}

# ──────────────────────────────────────────────────────────────
# 核心：把内容编码并写入 gen-cmdline-<timestamp>.sh 到 SCRIPT_DIR
# 入参: $1=内容字符串  $2=源描述(用于注释)  $3=是否复制到剪贴板(true/false)
# 副作用: 创建 .sh 文件,打印命令,可选复制剪贴板
# ──────────────────────────────────────────────────────────────
generate_sh_file() {
    local content=$1
    local source_desc=$2
    local copy_clip=${3:-false}

    local content_len=${#content}
    local timestamp
    timestamp=$(date +%Y%m%d-%H%M%S)
    local output_file="${SCRIPT_DIR}/gen-cmdline-${timestamp}.txt"

    # Base64 编码（用 printf 确保不加末尾换行）
    local b64
    b64=$(printf '%s' "$content" | b64_encode)
    local b64_len=${#b64}

    # 拼成最终一行命令（base64 用单引号包裹）
    local cmd="mkdir -p ${REMOTE_DIR} && echo '${b64}' | base64 -d > ${REMOTE_DIR}/${COMPOSE_FILE} && cd ${REMOTE_DIR} && ${COMPOSE_CMD} up -d"
    local cmd_len=${#cmd}

    # 写入新的 .txt 文件（纯文本，方便用记事本/VSCode 直接打开）
    cat > "$output_file" <<HEADER
# ════════════════════════════════════════════════════════════════
#  一行 SSH 命令 - 由 一键编排生成.sh 自动生成
#  生成时间:  $(date '+%Y-%m-%d %H:%M:%S')
#  源:        ${source_desc}
#  内容字节:  ${content_len}
#  Base64:    ${b64_len} 字符
#  写入远程:  ${REMOTE_DIR}/${COMPOSE_FILE}
#  启动命令:  ${COMPOSE_CMD} up -d
#  文件路径:  ${output_file}
# ════════════════════════════════════════════════════════════════
#
#  用法 (任选其一):
#    1) 在 B 电脑的 SSH 终端(C 服务器)直接粘贴下面这一行命令
#    2) 在 A 电脑执行: cat 此文件 | ssh root@C服务器
#    3) 用文本编辑器打开此文件,复制下面这一行命令

${cmd}
HEADER

    # 显示信息
    echo ""
    echo -e "${BOLD}${GREEN}================ 一行 SSH 命令 (复制后粘到 B 电脑 SSH 终端) ================${NC}"
    echo ""
    echo "$cmd"
    echo ""
    echo -e "${BOLD}${GREEN}================ 信息 ================${NC}"
    echo "  源:        $source_desc"
    echo "  内容字节:  $content_len"
    echo "  Base64:    $b64_len 字符"
    echo "  命令总长:  $cmd_len 字符"
    echo "  写入远程:  ${REMOTE_DIR}/${COMPOSE_FILE}"
    echo "  启动命令:  ${COMPOSE_CMD} up -d"
    echo ""
    echo -e "${BOLD}${YELLOW}📁 已生成可重复使用的命令文件:${NC}"
    echo -e "  ${BOLD}${output_file}${NC}"
    echo ""
    echo -e "  💡 以后想再次部署,直接用文本编辑器打开该文件,复制里面那一行命令粘到 SSH 终端即可。"
    echo ""

    if [ "$copy_clip" = true ]; then
        copy_to_clipboard "$cmd"
    fi
}

# ──────────────────────────────────────────────────────────────
# 交互模式（双击 / 无参数 / -i）
# ──────────────────────────────────────────────────────────────
interactive_mode() {
    print_banner "Docker 编排 → 一行 SSH 命令生成器  [交互模式]"

    echo "  请选择输入方式:"
    echo ""
    echo "    [1] 输入编排文件路径 (支持绝对/相对路径)"
    echo "    [2] 直接粘贴编排内容 (YAML 多行,以单独空行结束)"
    echo ""
    echo -n "  请输入选项 [1/2] (直接回车 = 1): "
    IFS= read -r choice
    choice="${choice:-1}"

    case "$choice" in
        2)
            # ─── 内容粘贴模式 ───
            echo ""
            echo "  ┌──────────────────────────────────────────────────────────────┐"
            echo "  │ 请粘贴 docker-compose 编排内容 (YAML)                        │"
            echo "  │ 粘贴完成后,单独输入一个空行 (直接按回车) 即可结束           │"
            echo "  └──────────────────────────────────────────────────────────────┘"
            echo ""
            local content=""
            local line_count=0
            local first_line=1
            while IFS= read -r line; do
                # 第一个空行 = 结束
                if [ -z "$line" ] && [ $first_line -eq 0 ]; then
                    break
                fi
                first_line=0
                # 第一行不空才开始记录;首行若为空也允许(空内容时直接按回车)
                if [ $line_count -eq 0 ]; then
                    content="$line"
                else
                    content="$content"$'\n'"$line"
                fi
                line_count=$((line_count + 1))
            done

            if [ -z "$content" ]; then
                print_fail "未粘贴任何编排内容"
            fi

            echo ""
            print_success "已接收编排内容 (${#content} 字符, $line_count 行)"

            # 可选复制
            echo -n "  是否同时复制生成的命令到剪贴板? [y/N]: "
            IFS= read -r copy_choice
            local want_clip=false
            [[ "$copy_choice" =~ ^[Yy]$ ]] && want_clip=true

            generate_sh_file "$content" "直接粘贴的编排内容 (${line_count} 行)" "$want_clip"
            ;;

        *)
            # ─── 文件路径模式 ───
            echo ""
            echo "  请输入编排文件路径 (支持 Windows 路径 d:\\... 或 POSIX 路径 /d/...):"
            echo ""
            echo -e "  ${DIM}提示: 当前目录 = ${SCRIPT_DIR}${NC}"
            echo -e "  ${DIM}      相对路径示例: ./程序编排.txt  或  程序编排.txt${NC}"
            echo ""
            echo -n "  文件路径: "
            IFS= read -r file_path

            if [ -z "$file_path" ]; then
                print_fail "未输入文件路径"
            fi

            # 去掉首尾空白与可能附带的引号
            file_path="${file_path#"${file_path%%[![:space:]]*}"}"  # 去前导空格
            file_path="${file_path%"${file_path##*[![:space:]]}"}"  # 去尾部空格
            file_path="${file_path%\"}"  # 去尾部引号
            file_path="${file_path#\"}"  # 去前导引号

            # 路径规范化: Windows 路径转 Git Bash 风格
            local normalized
            normalized=$(normalize_path "$file_path")

            # 多候选位置尝试解析(用户输入相对路径时,智能匹配)
            local resolved=""
            if [[ "$normalized" =~ ^/ ]] || [[ "$normalized" =~ ^[A-Za-z]: ]]; then
                # 绝对路径,直接用
                [ -f "$normalized" ] && resolved="$normalized"
            else
                # 相对路径,按顺序尝试以下候选位置,哪个能找到就用哪个:
                local -a candidates=(
                    "$normalized"                          # 1) 原值(纯文件名,依赖 CWD)
                    "${SCRIPT_DIR}/${normalized}"          # 2) 脚本所在目录(最常见,用户双击时)
                    "$(pwd)/${normalized}"                 # 3) 当前工作目录
                    "${SCRIPT_DIR}/../${normalized}"       # 4) 脚本的父目录(可能在 ToDesk 上层)
                    "${SCRIPT_DIR}/../../${normalized}"     # 5) 上两级目录
                    "${HOME:-}/${normalized}"               # 6) 用户 HOME 目录
                )
                for cand in "${candidates[@]}"; do
                    if [ -f "$cand" ]; then
                        resolved="$cand"
                        break
                    fi
                done
                [ -z "$resolved" ] && resolved="${SCRIPT_DIR}/${normalized}"
            fi

            if [ -z "$resolved" ] || [ ! -f "$resolved" ]; then
                echo ""
                echo "  ${RED}[ERR]${NC} 文件不存在: $file_path"
                echo ""
                echo "  已尝试解析为以下路径,均未找到文件:"
                echo "    - $file_path (原始输入)"
                echo "    - ${normalized} (规范化后)"
                if [[ ! "$normalized" =~ ^/ ]] && [[ ! "$normalized" =~ ^[A-Za-z]: ]]; then
                    echo "    - ${SCRIPT_DIR}/${normalized}  (脚本目录)"
                    echo "    - $(pwd)/${normalized}  (当前目录)"
                    echo "    - ${SCRIPT_DIR}/../${normalized}  (上级目录)"
                    echo "    - ${HOME:-}/${normalized}  (HOME)"
                fi
                echo ""
                echo "  当前工作目录: $(pwd)"
                echo "  脚本目录:     ${SCRIPT_DIR}"
                echo ""
                echo "  提示:"
                echo "    1) 直接粘贴文件的完整绝对路径(Windows 路径可: d:\\... 或 /d/...)"
                echo "    2) 确认文件名拼写正确,以及文件确实存在"
                echo "    3) 或者选 [2] 直接粘贴编排内容"
                echo ""
                exit 1
            fi

            local file_size
            file_size=$(wc -c < "$resolved" | tr -d ' ')
            print_success "编排文件: $resolved (${file_size} 字节)"

            # 读取文件内容
            local content
            content=$(cat "$resolved")

            # 可选复制
            echo -n "  是否同时复制生成的命令到剪贴板? [y/N]: "
            IFS= read -r copy_choice
            local want_clip=false
            [[ "$copy_choice" =~ ^[Yy]$ ]] && want_clip=true

            generate_sh_file "$content" "文件: $normalized (${file_size} 字节)" "$want_clip"
            ;;
    esac
}

# ──────────────────────────────────────────────────────────────
# 帮助信息
# ──────────────────────────────────────────────────────────────
print_usage() {
    cat <<EOF

${BOLD}用法:${NC}
  bash 一键编排生成.sh                       [交互模式: 输入路径或粘贴内容]
  bash 一键编排生成.sh <编排文件> [...选项]  [命令行模式]

${BOLD}位置参数 (命令行模式):${NC}
  <编排文件>       必填。要转换的 docker-compose 编排文件路径。
  [远程目录]       可选。远程服务器目标目录，默认 /microi。
  [compose文件名]  可选。远程服务器上落地的文件名，默认 docker-compose.yml。
  [compose命令]    可选。远程服务器上的 compose 命令，默认 docker-compose。

${BOLD}选项 (放任意位置):${NC}
  -i, --interactive   强制进入交互模式。
  --save              同时把生成的一行命令保存为 .sh 文件到本脚本同目录。
  --clip              复制到剪贴板。
  -h, --help          显示帮助。

${BOLD}典型示例:${NC}
  # 1) 双击 .sh / 无参数 → 交互模式
  bash 一键编排生成.sh

  # 2) 命令行: 转换编排文件
  bash 一键编排生成.sh 程序编排.txt

  # 3) 命令行 + 自定义参数 + 保存 + 复制
  bash 一键编排生成.sh app.yml /opt/app docker-compose.yml "docker compose" --save --clip

  # 4) 强制交互
  bash 一键编排生成.sh -i
EOF
}

# ──────────────────────────────────────────────────────────────
# 主入口
# ──────────────────────────────────────────────────────────────
# 先解析选项
FORCE_INTERACTIVE=false
SAVE_TO_FILE=false
COPY_CLIP=false
POSITIONAL=()

for arg in "$@"; do
    case "$arg" in
        -h|--help)
            print_usage
            exit 0
            ;;
        -i|--interactive)
            FORCE_INTERACTIVE=true
            ;;
        --save)
            SAVE_TO_FILE=true
            ;;
        --clip)
            COPY_CLIP=true
            ;;
        *)
            POSITIONAL+=("$arg")
            ;;
    esac
done

# 默认参数 (远端目录 / compose 文件名 / compose 命令)
REMOTE_DIR="${POSITIONAL[1]:-/microi}"
COMPOSE_FILE="${POSITIONAL[2]:-docker-compose.yml}"
COMPOSE_CMD="${POSITIONAL[3]:-docker-compose}"

# 决定模式
if [ "$FORCE_INTERACTIVE" = true ] || [ ${#POSITIONAL[@]} -eq 0 ]; then
    # ── 交互模式 ──
    interactive_mode
else
    # ── 命令行模式 ──
    FILE="${POSITIONAL[0]}"

    # 路径规范化
    FILE=$(normalize_path "$FILE")
    if [[ ! "$FILE" =~ ^/ ]] && [[ ! "$FILE" =~ ^[A-Za-z]: ]]; then
        FILE="${SCRIPT_DIR}/${FILE}"
    fi

    if [ ! -f "$FILE" ]; then
        print_banner "Docker 编排 → 一行 SSH 命令生成器  [命令行模式]"
        print_fail "找不到编排文件: ${POSITIONAL[0]}\n  解析后路径: $FILE"
    fi

    FILE_BYTES=$(wc -c < "$FILE" | tr -d ' ')
    print_banner "Docker 编排 → 一行 SSH 命令生成器  [命令行模式]"
    print_step "读取编排文件: $FILE"
    print_success "编排文件: $FILE (${FILE_BYTES} 字节)"

    print_step "Base64 编码中..."
    CONTENT=$(cat "$FILE")
    B64=$(printf '%s' "$CONTENT" | b64_encode)
    B64_LEN=${#B64}
    print_success "Base64 长度: $B64_LEN"

    # 拼成最终一行命令
    CMD="mkdir -p ${REMOTE_DIR} && echo '${B64}' | base64 -d > ${REMOTE_DIR}/${COMPOSE_FILE} && cd ${REMOTE_DIR} && ${COMPOSE_CMD} up -d"
    CMD_LEN=${#CMD}

    echo ""
    echo -e "${BOLD}${GREEN}================ 一行 SSH 命令 (复制后粘到 B 电脑 SSH 终端) ================${NC}"
    echo ""
    echo "$CMD"
    echo ""
    echo -e "${BOLD}${GREEN}================ 信息 ================${NC}"
    echo "  编排文件:    $FILE"
    echo "  文件字节:    $FILE_BYTES"
    echo "  Base64 长度: $B64_LEN"
    echo "  命令总长度:  $CMD_LEN"
    echo "  写入远程:    ${REMOTE_DIR}/${COMPOSE_FILE}"
    echo "  启动命令:    ${COMPOSE_CMD} up -d"
    echo ""

    if [ "$COPY_CLIP" = true ]; then
        copy_to_clipboard "$CMD"
    fi

    if [ "$SAVE_TO_FILE" = true ]; then
        generate_sh_file "$CONTENT" "文件: $FILE (${FILE_BYTES} 字节)" "$COPY_CLIP"
    fi
fi

# Windows (Git Bash / WSL) 下：正常结束时也给用户看一眼结果再关闭窗口
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || -n "$WINDIR" ]]; then
    echo ""
    read -r -p "  按回车键关闭窗口..." _w
fi
```
::: 

---

### 1️⃣ 安装 MySQL

::: tip 推荐
推荐使用服务器面板进行**原生安装 MySQL**。
:::

::: danger Ubuntu 24 + MySQL 8.0 注意
使用宝塔面板在 Ubuntu 24 上原生安装的 MySQL 8.0，可能遇到修改 3306 端口为其它端口后无法启动的问题，此时直接使用 3306 端口即可。
:::

**安装后操作：**

1. 使用面板的数据库性能配置进行优化
2. 在配置文件 `[mysqld]` 下添加 `lower_case_table_names = 1`
3. 尝试使用服务器面板的数据库管理进行还原数据库

::: warning 还原数据库失败？
若面板还原失败（如视图之间存在关联 SQL），可使用 Navicat 的**数据传输**功能（成功率 100%）。若遇到视图关联问题，请依次单个还原视图。
:::

4. 还原成功后，建议执行以下 SQL：
```sql
-- 若不能通过Navicat连接数据库，如果是docker部署的mysql，先进入mysql的docker容器
docker exec -it 容器Id/Name bash
-- 在服务器执行命令进入mysql
mysql -u root -p
use 您的数据库名称;
-- 1、修改【sys_config】表中的【SysTitle】字段为新系统名称
update sys_config set SysTitle='新系统名称';
-- 2、修改【sys_osclients】表中的【OsClient】字段为新系统key，修改【RedisHost、RedisPort、RedisPwd】字段为空
update sys_osclients set OsClient='新系统key',RedisHost='',RedisPort='',RedisPwd='';
-- 3、为了防止部分定时任务影响原有业务，建议执行sql停止所有定时任务
update diy_schedule_job set Status='暂停';
update microi_job_triggers set TRIGGER_STATE='PAUSED';
```

---

#### MySQL 5.7 编排

::: tip 配置建议
低配服务器建议 v5.7.x（如 4核8G/16G），高配服务器建议 v8.0.x（如 8核8G/16G）
:::
::: details 展开查看 Shell 命令（20 行）
```shell
version: '3.8'
services:
  microi-mysql5.7:
    image: registry.cn-hangzhou.aliyuncs.com/microios/mysql:5.7
    container_name: microi-mysql5.7
    restart: always
    tty: true
    stdin_open: true
    ports:
      - "1306:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=password123456
      - MYSQL_TIME_ZONE=Asia/Shanghai
    volumes:
      - /microi/mysql5.7/data:/var/lib/mysql
      - /microi/mysql5.7/config/microi_mysql.cnf:/etc/mysql/conf.d/microi_mysql.cnf
    logging:
      options:
        max-size: 10m
        max-file: "10"
```
:::
MySQL 5.7 数据库配置文件 `microi_mysql.cnf`：
::: details 展开查看 Shell 命令（51 行）
```shell
[mysqld]
# 基础配置
lower_case_table_names = 1
character_set_server = utf8mb4
collation_server = utf8mb4_unicode_ci
max_allowed_packet = 512M
net_buffer_length = 16384
skip_name_resolve = ON  # 避免DNS解析延迟
sql_mode = ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION # 允许非常规的0000-00-00 00:00:00时间值

# 连接配置
max_connections = 1000
max_connect_errors = 100000  # 防止因错误连接被阻塞
thread_cache_size = 100
table_open_cache = 2000
table_open_cache_instances = 16  # 提升SSD并发访问能力

# 内存配置（8GB优化）
innodb_buffer_pool_size = 5G     # 保留足够内存给OS和其他缓存
innodb_log_buffer_size = 256M
key_buffer_size = 128M           # MyISAM使用少时降低
query_cache_type = 0             # 禁用查询缓存（高并发下易竞争）
query_cache_size = 0
tmp_table_size = 256M
max_heap_table_size = 256M

# InnoDB I/O优化（SSD关键配置）
innodb_io_capacity = 4000        # SSD的IOPS能力（根据SSD性能调整）
innodb_io_capacity_max = 8000    # 突发负载上限
innodb_flush_method = O_DIRECT   # 避免双缓冲，直接访问SSD
innodb_flush_neighbors = 0       # 关闭刷新邻近页（SSD无需寻道优化）
innodb_log_file_size = 2G        # 大日志减少checkpoint
innodb_log_files_in_group = 2    # 总日志大小4G（恢复与性能平衡）
innodb_buffer_pool_instances = 8 # 提升并发访问能力
innodb_read_io_threads = 8       # 增加I/O线程
innodb_write_io_threads = 8
innodb_purge_threads = 4         # 提升清理效率
innodb_adaptive_flushing = ON    # 自适应刷新

# 缓冲配置（每个连接独立，谨慎设置）
sort_buffer_size = 2M
read_buffer_size = 1M
read_rnd_buffer_size = 1M
join_buffer_size = 2M
thread_stack = 512K
binlog_cache_size = 2M

# SSD持久化优化
innodb_flush_log_at_trx_commit = 2  # 事务提交时延后刷盘（SSD安全）
sync_binlog = 1000                  # 批量同步binlog（降低SSD磨损）
innodb_doublewrite = 1              # 保持双写确保崩溃安全（SSD仍需）
```
:::

---

#### MySQL 8.0 编排

::: tip 配置建议
低配服务器建议 v5.7.x，高配服务器建议 v8.0.x
:::
::: details 展开查看 Shell 命令（20 行）
```shell
version: '3.8'
services:
  microi-mysql8.0:
    image: registry.cn-hangzhou.aliyuncs.com/microios/mysql:8.0
    container_name: microi-mysql8.0
    restart: always
    tty: true
    stdin_open: true
    ports:
      - "1307:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=password123456
      - MYSQL_TIME_ZONE=Asia/Shanghai
    volumes:
      - /microi/mysql8.0/data:/var/lib/mysql
      - /microi/mysql8.0/config/microi_mysql8.0.cnf:/etc/mysql/conf.d/microi_mysql8.0.cnf
    logging:
      options:
        max-size: 10m
        max-file: "10"
```
:::
MySQL 8.0 数据库配置文件 `microi_mysql8.0.cnf`：
::: details 展开查看 Shell 命令（61 行）
```shell
[mysqld]
# 基础配置
lower_case_table_names = 1
character_set_server = utf8mb4
collation_server = utf8mb4_unicode_ci
max_allowed_packet = 512M
net_buffer_length = 16384
skip_name_resolve = ON
# MySQL 8.0 SQL模式调整（移除已废弃的NO_AUTO_CREATE_USER）
sql_mode = ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION

# 连接配置
max_connections = 1000
max_connect_errors = 100000
thread_cache_size = 100
table_open_cache = 2000
table_open_cache_instances = 16

# 内存配置（8GB优化）
innodb_buffer_pool_size = 5G
innodb_log_buffer_size = 256M
key_buffer_size = 128M
# MySQL 8.0 已移除查询缓存
# query_cache_type = 0
# query_cache_size = 0
tmp_table_size = 256M
max_heap_table_size = 256M

# InnoDB I/O优化（SSD关键配置）
innodb_io_capacity = 4000
innodb_io_capacity_max = 8000
innodb_flush_method = O_DIRECT
innodb_flush_neighbors = 0
innodb_log_file_size = 2G
innodb_log_files_in_group = 2
innodb_buffer_pool_instances = 8
# MySQL 8.0 默认使用原生AI/O，以下线程参数可保留但实际可能被自动管理
innodb_read_io_threads = 8
innodb_write_io_threads = 8
innodb_purge_threads = 4
innodb_adaptive_flushing = ON

# 缓冲配置（保持与5.7一致）
sort_buffer_size = 2M
read_buffer_size = 1M
read_rnd_buffer_size = 1M
join_buffer_size = 2M
thread_stack = 512K
binlog_cache_size = 2M

# SSD持久化优化
innodb_flush_log_at_trx_commit = 2
sync_binlog = 1000
innodb_doublewrite = 1

# MySQL 8.0 新增推荐配置
default_authentication_plugin = mysql_native_password  # 兼容旧客户端
innodb_dedicated_server = ON  # 自动调整InnoDB内存参数（推荐8G服务器）
log_bin_trust_function_creators = ON  # 允许二进制日志记录存储函数
# 性能Schema优化（根据监控需求调整）
performance_schema = ON
```
:::

---

### 3️⃣ Redis 编排

::: warning 注意
编排中有两个地方包含 `password123456`，请修改为您的自定义密码。
:::
::: details 展开查看 Shell 命令（93 行）
```shell
version: '3.8'
services:
  microi-redis:
    image: registry.cn-hangzhou.aliyuncs.com/microios/redis:7.4.2
    container_name: microi-redis
    volumes:
      - /etc/localtime:/etc/localtime
      - /usr/share/fonts:/usr/share/fonts
      - /microi/redis/data:/data
    environment:  
      - REDIS_PASSWORD=password123456
    ports:
      - "1379:6379"
    command: 
      - redis-server
      - "--requirepass"
      - "password123456"
      - "--maxmemory"
      - "8gb"
      - "--maxmemory-policy"
      - "allkeys-lru"
      - "--timeout"
      - "300"
      - "--tcp-keepalive"
      - "300"
      - "--tcp-backlog"
      - "511"
      - "--maxclients"
      - "10000"
      - "--loglevel"
      - "notice"
      - "--databases"
      - "16"
      - "--save"
      - "900 1"
      - "--save"
      - "300 10"
      - "--save"
      - "60 10000"
      - "--stop-writes-on-bgsave-error"
      - "no"
      - "--rdbcompression"
      - "yes"
      - "--rdbchecksum"
      - "yes"
      - "--dbfilename"
      - "dump.rdb"
      - "--appendonly"
      - "yes"
      - "--appendfilename"
      - "appendonly.aof"
      - "--appendfsync"
      - "everysec"
      - "--no-appendfsync-on-rewrite"
      - "no"
      - "--auto-aof-rewrite-percentage"
      - "100"
      - "--auto-aof-rewrite-min-size"
      - "64mb"
      - "--aof-load-truncated"
      - "yes"
      - "--aof-use-rdb-preamble"
      - "yes"
      - "--lua-time-limit"
      - "5000"
      - "--lazyfree-lazy-eviction"
      - "no"
      - "--lazyfree-lazy-expire"
      - "no"
      - "--lazyfree-lazy-server-del"
      - "no"
      - "--replica-lazy-flush"
      - "no"
      - "--slowlog-log-slower-than"
      - "10000"
      - "--slowlog-max-len"
      - "128"
      - "--hz"
      - "10"
      - "--dynamic-hz"
      - "yes"
      - "--aof-rewrite-incremental-fsync"
      - "yes"
      - "--rdb-save-incremental-fsync"
      - "yes"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
    restart: always
    tty: true
    stdin_open: true
```
:::


---

### 4️⃣ MongoDB 编排

::: warning 注意
请修改默认密码 `password123456`。
:::
::: details 展开查看 Shell 命令（21 行）
```shell
version: '3.8'
services:
  microi-mongodb:
    image: registry.cn-hangzhou.aliyuncs.com/microios/mongo:latest
    container_name: microi-mongodb
    restart: always
    tty: true
    stdin_open: true
    ports:
      - "1017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=root
      - MONGO_INITDB_ROOT_PASSWORD=password123456
    volumes:
      - /microi/mongodb/data:/data/db
      - /etc/localtime:/etc/localtime
      - /usr/share/fonts:/usr/share/fonts
    logging:
      options:
        max-size: 10m
        max-file: "10"
```
:::

---

### 5️⃣ MinIO 编排

::: warning 注意修改默认密码 `password123456`
:::

| 端口 | 说明 |
| :--: | ---- |
| 1011 (9001) | MinIO 后台管理面板，安装后需添加公有桶 `mci-public`（权限设为 public）和私有桶 `mci-private` |
| 1010 (9000) | Endpoint 端口，用于 SaaS 引擎配置 EndPoint，如 `192.168.31.199:1010` |

::: danger MinIO 反向代理注意
必须设置 `proxy_set_header Host $http_host`，否则导致私有桶只能上传无法下载。阿里云 OSS、CDN、负载均衡默认配置不会有此问题。
:::
::: details 展开查看 Shell 命令（25 行）
```shell
version: '3.8'
services:
  microi-minio:
    image:  registry.cn-hangzhou.aliyuncs.com/microios/minio:2023-06-09
    container_name: microi-minio
    volumes:
      - /etc/localtime:/etc/localtime
      - /usr/share/fonts:/usr/share/fonts
      - /microi/minio/data:/data
      - /microi/minio/config:/root/.minio
    environment:  
      - MINIO_ROOT_USER=root
      - MINIO_ROOT_PASSWORD=password123456
    command: server /data --console-address ":9001"
    ports:
      - "1010:9000"
      - "1011:9001"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
    restart: always
    tty: true
    stdin_open: true
```
:::

---

### 6️⃣ 低代码平台程序编排（Api + Web + Watchtower）

::: tip 说明
- 请将所有参数修改为实际参数，以下镜像均为公开开源版镜像
- `microi-web` 编排的 `OsClient` 可不指定，默认为空（SaaS 模式）
- API 容器只允许下面十个启动引导配置：`OsClient`、`OsClientType`、`OsClientNetwork`、`OsClientDbType`、`OsClientDbConn`、`OsClientRedisHost`、`OsClientRedisPort`、`OsClientRedisPwd`、`OsClientRedisDataBase`、`OsClientDbMongoConn`。其它后端运行参数统一在主租户 SaaS 引擎中动态维护，不要再增加 `MICROI_*` 或自定义 `AppSettings` 环境变量。`ASPNETCORE_*` / `DOTNET_*` 仅属于 .NET 宿主配置。
- 下方旧式手工示例中的 `172.27.221.211` 表示 API 容器确实可达的外部数据库/缓存宿主机，并不表示推荐让同机 Docker 依赖绕宿主机端口；同机容器部署应建立共享 bridge 网络，改用对应容器 DNS 与内部端口。无论哪种方式，都不要把 API 容器中的 `127.0.0.1` / `localhost` 当成其它容器。
:::
::: details 展开查看 Shell 命令（70 行）
```shell
version: '3.8'
services:
  microi-api:
    image: registry.cn-hangzhou.aliyuncs.com/microios/microi-api:latest
    container_name: microi-api
    volumes:
      - /etc/localtime:/etc/localtime
      - /usr/share/fonts:/usr/share/fonts
    environment:  
      - OsClient=iTdos
      - OsClientType=Product
      - OsClientNetwork=Internal
      - OsClientDbType=MySql
      - OsClientDbConn=Data Source=172.27.221.211;Database=microi_demo;User Id=microi_demo;Password=password123456;Port=1306;Convert Zero Datetime=True;Allow Zero Datetime=True;Charset=utf8mb4;Max Pool Size=500;sslmode=None;
      - OsClientRedisHost=172.27.221.211
      - OsClientRedisPort=1379
      - OsClientRedisPwd=password123456
      - OsClientRedisDataBase=5
      - OsClientDbMongoConn=mongodb://root:password123456@172.27.221.211:17017/?authSource=admin
    ports:
      - "1000:80"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
    privileged: true
    restart: always
    tty: true
    stdin_open: true

  microi-client:
    image: registry.cn-hangzhou.aliyuncs.com/microios/microi-client:latest
    container_name: microi-client
    volumes:
      - /etc/localtime:/etc/localtime
      - /usr/share/fonts:/usr/share/fonts
    environment:
      - OsClient=
      - ApiBase=https://api.itdos.com
    ports:
      - "1001:80"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
    restart: always
    tty: true
    stdin_open: true

  watchtower:
    image: registry.cn-hangzhou.aliyuncs.com/microios/watchtower:latest
    container_name: watchtower
    restart: always  
    privileged: true
    tty: true
    stdin_open: true
    volumes:  
      - /etc/localtime:/etc/localtime
      - /root/.docker/config.json:/config.json
      - /var/run/docker.sock:/var/run/docker.sock  
    command: --cleanup --include-stopped --interval 10 microi-api microi-web
```
:::

#### 大文件上传的 nginx 反向代理配置

SaaS 引擎中的“单文件上限 MB”和“单次总量上限 MB”只在请求进入吾码 API 后生效，不能放大 nginx 的请求体上限。若 nginx 先返回 `413 Content Too Large`，请在 **API 域名对应的 `server` 块**中加入下面的配置；支持 1000 MB 文件时，需要为 multipart 封装留出余量。下列 `proxy_*` 指令可以放在 `server` 层由真实代理 `location` 继承；如果 `location` 或宝塔 `include` 中重复配置，以更近层级的值为准，必须确认没有重新开启请求缓冲或缩短超时：

```nginx
server {
  # 支持1000MB文件，并为multipart封装留出余量
  client_max_body_size 1024m;

  # 慢速大文件上传：这是两次读取请求体数据之间的超时，不是整个上传总时长
  client_body_timeout 600s;

  # 大文件直接流式转发给吾码API，避免nginx先把整个请求体落到代理临时目录
  proxy_request_buffering off;

  # HTTP/1.1可避免分块请求在关闭request buffering后仍被强制缓冲
  proxy_http_version 1.1;
  proxy_connect_timeout 60s;
  proxy_send_timeout 600s;
  proxy_read_timeout 600s;

  error_page 413 = @microi_upload_too_large;
  location @microi_upload_too_large {
      default_type application/json;
      charset utf-8;
      add_header Cache-Control "no-store" always;
      # 若Web与API跨域，必须在这里显式复用正常API代理的CORS白名单/include。
      # 请求已被nginx拒绝，不会进入ASP.NET Core，因此不能依赖后端补CORS响应头。
      return 200 '{"Code":0,"Data":null,"Msg":"上传请求超过了反向代理允许的最大容量。SaaS引擎中的上传额度不能放大nginx或API启动级上限，请联系运维同步提高client_max_body_size以及吾码API请求体上限。","DataAppend":{"ErrorType":"UploadRequestTooLarge","Layer":"ReverseProxy"}}';
  }
}
```

吾码 API 已内置统一的 2048 MB HTTP/Multipart 接收硬顶，不需要再为上传大小增加额外环境变量；真正的单文件、单次文件数、单次总量及帐号/租户日额度统一在 SaaS 引擎中配置。`proxy_request_buffering off` 只关闭 nginx 的请求体预缓冲，不代表绕过吾码 API 的 Multipart、权限、配额和 HDFS 校验，也不能用响应方向的 `proxy_buffering off` 代替。

修改后先执行 `nginx -t`，确认成功再 reload nginx。若仍返回原生 413 HTML，请继续检查宝塔生成的全局配置和 `include` 文件中是否存在更小的 `client_max_body_size`；若大文件上传到固定时长后中断，则继续检查 CDN、WAF、负载均衡、Ingress 及宝塔上游是否还有独立的请求体或空闲超时限制。


---

### 7️⃣ PaddleX / PaddleOCR 文字识别服务编排（默认安装）

Microi API 内置统一 OCR 网关，模型推理由独立的 PaddleX 服务承载。一键安装使用吾码杭州镜像源中的固定版本 `PaddleX 3.6.1 + PaddlePaddle 3.2.2` CPU 镜像，并已在发布镜像阶段预置默认 OCR 产线模型。PaddlePaddle 3.3.0 当前存在 CPU oneDNN PIR 推理兼容问题，请勿自行替换为 3.3.0。因此服务器只需拉取一个经过固定版本验证的镜像，不再现场安装 Python 依赖或重新下载模型。

:::: tip 一键安装会自动完成
一键安装会创建 `microi-install-ocr` 独立编排和 `microi-ocr` 内部网络，等待容器进入 `healthy`，再由 API Upgrade29 创建 SaaS 引擎的“OCR识别”Tab。API/Web 的官方 `latest` 会强制回源拉取，API 存活后脚本立即回读 9 个物理字段，每秒一次、最多 15 秒；正常升级通常首轮通过，镜像过旧或迁移失败会快速报错，不再等待 5 分钟。只有数据库回读确认全部字段和唯一主租户后，才写入 `OcrEnabled=1` 与正确内网地址并重启 API 使配置生效，脚本不会绕过 Upgrade29 直接伪造元数据。若门禁失败，终端会继续打印已生成的端口、凭据、目录和容器状态，但标题明确为“安装未完成”且退出码仍非零。
::::

当前公开基线为 `linux/amd64`。建议整机至少 4 核 16 GB 内存，并根据真实图片尺寸、PDF 页数及并发压测调整；ARM64 或 GPU 服务器应使用仓库 Dockerfile/官方 Paddle 镜像构建对应架构版本，不要强行运行 amd64 CPU 镜像。

手动部署可使用以下 Compose：

:::: details 展开查看 OCR 编排
```yaml
name: microi-ocr

services:
  microi-ocr:
    image: registry.cn-hangzhou.aliyuncs.com/microios/paddlex-ocr:3.6.1-paddle3.2.2-cpu
    container_name: microi-ocr
    init: true
    restart: unless-stopped
    ports:
      # 仅允许宿主机访问；不要直接暴露到公网。
      - "127.0.0.1:18080:8080"
    shm_size: "4gb"
    cpus: "4.0"
    mem_limit: "8g"
    stop_grace_period: 90s
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    volumes:
      - microi-ocr-models:/home/microi/.paddlex
    healthcheck:
      test: ["CMD", "python", "-c", "import socket; s=socket.create_connection(('127.0.0.1',8080),3); s.close()"]
      interval: 30s
      timeout: 5s
      retries: 10
      start_period: 10m
    logging:
      driver: json-file
      options:
        max-size: 20m
        max-file: "3"
    networks:
      - microi-ocr

volumes:
  microi-ocr-models:
    name: microi-ocr-models

networks:
  microi-ocr:
    name: microi-ocr
    driver: bridge
```
::::

启动并检查健康状态：

```bash
docker compose up -d
docker compose ps
docker inspect microi-ocr --format '{{.State.Health.Status}}'
```

如果 Microi API 也在 Docker 中，把 API 服务加入同一个 external 网络：

```yaml
services:
  microi-api:
    networks:
      - microi-ocr

networks:
  microi-ocr:
    external: true
    name: microi-ocr
```

随后在 `SaaS引擎 → OCR识别` 设置：`OcrEnabled=1`、`OcrProvider=PaddleX`、`OcrEndpoint=http://microi-ocr:8080/ocr`、`OcrTimeoutSeconds=120`、`OcrMaxFileMB=20`、`OcrMaxPages=10`、`OcrMinConfidence=0`。若 API 运行在宿主机，则端点改为 `http://127.0.0.1:18080/ocr`。`OcrApiKey` 和 `OcrHeadersJson` 仅在接入自建鉴权代理时配置，不应写进 V8 脚本。

V8 接口引擎通过租户绑定网关调用，不直接接触 OCR 地址或密钥：

```javascript
var result = await V8.OCR.Recognize({
  FileByteBase64: V8.FilesByteBase64.invoice,
  FileName: 'invoice.png',
  TextRecScoreThresh: 0.5,
  ReturnWordBox: false
});
return result;
```

完整参数、PDF/图片格式、统一返回结构与安全边界见 [V8.OCR 官方文档](/doc/v8-engine/v8-server.html#v8-ocr)。PaddleX 的基础服务接口为 `POST /ocr`，官方服务化方式及协议可参考 [PaddleX Serving 文档](https://www.paddleocr.ai/main/en/version3.x/inference_deployment/serving/serving.html)。

---

### 8️⃣ LibreTranslate 开源翻译服务编排（默认安装）

LibreTranslate 用于动态内容翻译，不影响 `diy_lang` 固定界面词条。加载的语言越多，首次下载模型的时间和磁盘占用越大，因此建议从基础套餐开始：

| 套餐 | 语言 |
| ---- | ---- |
| 1（推荐） | 简体中文 `zh`、繁体中文 `zt`、英语 `en` |
| 2 | 套餐 1 + 日语 `ja`、韩语 `ko`、越南语 `vi`、泰语 `th`、印度尼西亚语 `id`、马来语 `ms`、菲律宾语 `tl` |
| 3 | 全部支持语言 |

全部可选语言如下：

| 中文名 | Key | 中文名 | Key | 中文名 | Key |
| ---- | ---- | ---- | ---- | ---- | ---- |
| 简体中文 | `zh` | 繁体中文 | `zt` | 英语 | `en` |
| 日语 | `ja` | 韩语 | `ko` | 越南语 | `vi` |
| 泰语 | `th` | 印度尼西亚语 | `id` | 马来语 | `ms` |
| 菲律宾语 | `tl` | 印地语 | `hi` | 乌尔都语 | `ur` |
| 阿拉伯语 | `ar` | 俄语 | `ru` | 德语 | `de` |
| 法语 | `fr` | 西班牙语 | `es` | 葡萄牙语 | `pt` |
| 意大利语 | `it` | 荷兰语 | `nl` | 土耳其语 | `tr` |
| 波兰语 | `pl` | 乌克兰语 | `uk` |  |  |

一键安装脚本默认安装 LibreTranslate：安装选择直接按 Enter 等同于 `1`，语言套餐直接按 Enter 等同于基础套餐 `1`（简体中文、繁体中文、英语）。因此用户一路按 Enter 就会使用吾码官方推荐组合；明确不安装时在第一处提示输入 `0`。选择安装后仍可改选套餐 2/3 或输入额外语言 Key。脚本会自动分配只绑定 `127.0.0.1` 的诊断端口、生成并回读随机 API Key 数据库。平台 API 启动后，脚本立即回读 Upgrade31 的 4 个翻译物理字段，每秒一次、最多 15 秒；正常升级通常首轮通过，镜像过旧或迁移失败会快速报错。字段齐全后脚本才通过内部 Docker 地址写入主租户并回读验证，兼容没有 `TranslateProvider` 等新列的旧恢复库，且不会绕过 Upgrade31 直接伪造元数据。

字段前置迁移完成不等于整条平台升级链成功。一键安装还会在重启 API 前等待并回读 `sys_config.ServerVersion` 至少达到脚本要求的版本；如果应用商城、SaaS 运行字段或其它中间迁移失败，脚本会明确停止，不会把“部分字段已创建”误报为安装完成，也不会用紧接着的重启打断尚未结束的升级事务。

手动部署时可使用项目中的 `数据库、案例、文档、资料/docker-compose.libretranslate.yml`，并根据服务器修改宿主机目录、端口、`LT_LOAD_ONLY` 和 API Key。由于 Docker Compose 可能把全中文目录名归一化为空项目名，建议复制到 ASCII 目录，并始终显式指定项目名：

```bash
mkdir -p /microi/compose/libretranslate
cp "数据库、案例、文档、资料/docker-compose.libretranslate.yml" /microi/compose/libretranslate/docker-compose.yml
cd /microi/compose/libretranslate
docker compose -p microi-libretranslate up -d
```

如果直接在源码目录运行，也必须使用 `docker compose -p microi-libretranslate -f "数据库、案例、文档、资料/docker-compose.libretranslate.yml" up -d`。正式使用前请替换示例 API Key；不要把 LibreTranslate 端口直接暴露到公网。一键安装脚本会在容器启动前独立生成并回读 Key 数据库，让语言模型后台初始化，不会用 LibreTranslate 自带的“booting 即 healthy”检查冒充 HTTP 已就绪。

下面是适用于 `/microi` 目录的等价编排：

:::: details 展开查看 LibreTranslate 编排
```yaml
services:
  microi-translate:
    image: registry.cn-hangzhou.aliyuncs.com/microios/libretranslate:1.9.6-microi1
    container_name: microi-translate
    user: "0:0"
    security_opt:
      - apparmor=unconfined
    volumes:
      - /microi/libretranslate/models:/home/libretranslate/.local
      - /microi/libretranslate/api-keys:/app/db
    environment:
      - LT_UPDATE_MODELS=true
      # 基础套餐；按上表追加语言 Key。加载全部语言会显著增加首次下载时间。
      - LT_LOAD_ONLY=zh,zt,en
      - LT_API_KEYS=true
      - LT_API_KEYS_DB_PATH=/app/db/api_keys.db
      # 仅用于首次向 LibreTranslate 注册密钥；请替换为随机强密钥。
      - LT_BOOTSTRAP_API_KEY=replace-with-a-random-strong-key
      - LT_WORKERS=1
      - LT_TIMEOUT=120
    entrypoint: /bin/sh
    command: >
      -lc "set -e;
      ./scripts/entrypoint.sh &
      (
        for i in $$(seq 1 90); do
          if [ -f \"$${LT_API_KEYS_DB_PATH:-/app/db/api_keys.db}\" ]; then
            ltmanage keys --api-keys-db-path \"$${LT_API_KEYS_DB_PATH:-/app/db/api_keys.db}\" add 1000000 --key \"$${LT_BOOTSTRAP_API_KEY}\" || true;
            break;
          fi;
          sleep 2;
        done
      ) &
      wait"
    ports:
      - "1469:5000"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
    restart: unless-stopped
    tty: true
    stdin_open: true
```
::::

Microi API 不需要增加翻译环境变量。请在 SaaS 引擎主租户记录中设置 `TranslateProvider=LibreTranslate`、`TranslateUrl=http://宿主机IP:1469`、`TranslateApiKey=与上面一致的随机强密钥`、`TranslateTimeout=120`；保存后由 SaaS 引擎刷新共享 Redis 配置。一键安装脚本会自动写入并回读验证这些字段。

---

### 9️⃣ Ollama 编排（不推荐，仅兼容特殊场景）

:::: warning 新装环境请跳过本节
Microi 默认 NL2SQL/NL2V8/在线 AI 数据分析已经由内置的关键词扩展、权限感知 Schema/Skill 搜索和精确字段回读完整承接，不再推荐部署 Ollama、`nomic-embed-text` 与 Qdrant。仅当已有系统必须兼容旧向量链路，或独立召回评测证明内置能力无法满足特殊语义检索时，才同时部署本节和下一节。
::::

>* Docker会自动创建所需的数据目录，无需手动创建
>* 通过docker编排部署
::: details 展开查看 Shell 命令（50 行）
```shell
version: '3.8'
services:
  # Ollama AI 服务（使用阿里云镜像加速）
  microi-ollama:
    image: registry.cn-hangzhou.aliyuncs.com/microios/ollama:latest  # 使用阿里云镜像，也可使用日期版本如 :20260129
    container_name: microi-ollama
    ports:
      - "1434:11434"  # 如需修改端口，直接改这里，如 "8080:11434"
    volumes:
      - /microi/ollama/data:/root/.ollama  # 持久化模型数据（统一存储在/microi目录下）
    restart: always  # 开机自动启动
    environment:
      - OLLAMA_HOST=0.0.0.0:11434
    healthcheck:
      test: ["CMD", "/bin/sh", "-c", "ollama list || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - microi-ollama-network

networks:
  microi-ollama-network:
    driver: bridge

# =====================================================
# Microi.net 专用 Ollama + DeepSeek 部署方案
# 使用阿里云镜像加速
# =====================================================
#
# 【验证部署】
#   curl http://localhost:1434/api/tags
#   docker exec microi-ollama ollama list
#
# 【测试AI对话】
#   curl http://localhost:1434/v1/chat/completions \
#     -H "Content-Type: application/json" \
#     -d '{
#       "model": "deepseek-r1:1.5b",
#       "messages": [{"role": "user", "content": "你好"}]
#     }'
#
# 【下载其他模型】
#   docker exec microi-ollama ollama pull deepseek-r1:7b # 下载7B模型
#   docker exec microi-ollama ollama pull deepseek-coder:1.3b # 下载Coder模型
#   docker exec microi-ollama ollama pull deepseek-coder:6.7b # 下载Coder 6.7B模型
#   docker logs -f microi-ollama # 查看下载进度
#   docker exec microi-ollama ollama list # 查看已安装模型
# =====================================================
```
:::

>* 拉取 nomic-embed-text 模型（当前 Microi Ollama HTTP 向量链路使用 768 维，用于中英文文本）
```shell
docker exec microi-ollama ollama pull nomic-embed-text
```

>* 测试API
```
curl http://localhost:1434/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model": "nomic-embed-text", "input": "测试"}'
```

### 🔟 Qdrant 向量数据库编排（不推荐，仅兼容特殊场景）
::: details 展开查看 Shell 命令（93 行）
```shell
version: '3.8'
services:
  # Qdrant向量数据库服务
  microi-qdrant:
    image: registry.cn-hangzhou.aliyuncs.com/microios/qdrant:latest
    container_name: microi-qdrant
    restart: unless-stopped
    
    # 端口映射
    ports:
      - "1333:6333"      # HTTP API端口
      - "1334:6334"      # gRPC端口（可选，高性能场景）
      
    # 数据卷挂载（持久化存储）
    volumes:
      - /microi/qdrant/storage:/qdrant/storage          # 主存储目录
      - /microi/qdrant/snapshots:/qdrant/snapshots      # 快照目录
      - /microi/qdrant/config:/qdrant/config            # 配置文件目录（可选）

    # 环境变量配置（所有优化配置）
    environment:
      # 安全配置（生产环境建议启用）
      - QDRANT__SERVICE__API_KEY=password123456         # API密钥（取消注释后启用）
      - QDRANT__SERVICE__ENABLE_TLS=false               # TLS加密（本地部署可关闭）

      # 核心配置
      - QDRANT__SERVICE__HTTP_PORT=6333
      - QDRANT__SERVICE__GRPC_PORT=6334
      
      # 性能优化配置
      - QDRANT__STORAGE__PERFORMANCE__MAX_SEARCH_THREADS=4          # 搜索线程数
      - QDRANT__STORAGE__PERFORMANCE__MAX_OPTIMIZATION_THREADS=2    # 优化线程数
      - QDRANT__STORAGE__PERFORMANCE__UPDATE_QUEUE_SIZE=100         # 更新队列大小
      
      # HNSW索引优化（提升搜索速度）
      - QDRANT__STORAGE__HNSW_INDEX__M=16                           # HNSW图的连接数（默认16）
      - QDRANT__STORAGE__HNSW_INDEX__EF_CONSTRUCT=100               # 构建时的搜索深度（默认100）
      
      # 内存优化
      - QDRANT__STORAGE__ON_DISK_PAYLOAD=true                       # 将Payload存储到磁盘（节省内存）
      - QDRANT__STORAGE__MMAP_THRESHOLD_KB=102400                   # 100MB以上使用mmap（减少内存占用）
      
      # 持久化与恢复
      - QDRANT__STORAGE__WAL__WAL_CAPACITY_MB=32                    # WAL日志容量（MB）
      - QDRANT__STORAGE__WAL__WAL_SEGMENTS_AHEAD=0                  # 提前创建WAL段数
      - QDRANT__STORAGE__SNAPSHOT_PATH=/qdrant/snapshots            # 快照路径
      
      # 日志配置
      - QDRANT__LOG_LEVEL=INFO                                      # 日志级别: TRACE, DEBUG, INFO, WARN, ERROR
      
      # 集群配置（单机部署可忽略）
      - QDRANT__CLUSTER__ENABLED=false                              # 是否启用集群模式
      
      # 资源限制（防止OOM）
      - QDRANT__STORAGE__OPTIMIZERS__MEMMAP_THRESHOLD_KB=102400     # mmap阈值
      - QDRANT__STORAGE__OPTIMIZERS__INDEXING_THRESHOLD_KB=20480    # 索引阈值（20MB）
        
    # 资源限制（根据服务器实际情况调整）
    #deploy:
    #  resources:
    #    limits:
    #      cpus: '4.0'              # 最大CPU核心数
    #      memory: 8G               # 最大内存
    
    # 健康检查（可选，如不需要可删除）
    # 作用：监控服务状态，自动重启失败的容器
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    
    # 网络配置
    networks:
      - microi-qdrant-network
    
    # 标签（便于管理）
    labels:
      - "com.microi.service=qdrant"
      - "com.microi.description=Qdrant Vector Database for AI"
      - "com.microi.version=1.0"

# 网络定义
networks:
  microi-qdrant-network:
    driver: bridge  # 简单桥接网络，无需固定IP

# http://localhost:1333/healthz # 健康检查接口
# 管理界面: http://localhost:1333/dashboard
# 检查向量数据是否已初始化：
# http://localhost:1333/collections/microi_schema
# 查看 points_count 是否>0
```
:::

---

## 💻 本地 Docker 环境

### 1️⃣ 本地安装 Docker Desktop

- 下载地址：[Docker Desktop](https://docs.docker.com/get-started/get-docker/)

::: warning Windows 用户注意
需要 **Windows 专业版**及以上，不支持 Windows 家庭版。
:::

---

### 2️⃣ 本地打包并上传 Docker 镜像 - 后端

- 容器镜像服务可使用阿里云免费服务：[阿里云容器镜像服务](https://cr.console.aliyun.com/cn-hangzhou/instances)
- 也可自行搭建 [Harbor](https://goharbor.io/) 容器镜像服务
- 编译打包到 `/Microi.net.Api/bin/Release/net8.0/`

在 `/Microi.net.Api/bin/Release/` 处创建 `Dockerfile`：
```powershell
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
MAINTAINER iTdos
LABEL description="iTdos"
COPY net8.0/ /app
WORKDIR /app
EXPOSE 80
RUN ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
RUN echo 'Asia/Shanghai' >/etc/timezone
CMD ["dotnet", "Microi.net.Api.dll", "--urls", "http://0.0.0.0:80"]
```
在同目录创建 `publish.sh`（Windows 为 `publish.bat`）：
```powershell
echo "请输入本次要发布的api版本号："
read version
docker login --username=镜像服务帐号 --password=镜像服务帐号密码 registry.cn-地域.aliyuncs.com
docker build -t microi-api .
docker tag microi-api registry.cn-地域.aliyuncs.com/命名空间/microi-api:latest
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-api:latest
docker tag microi-api registry.cn-地域.aliyuncs.com/命名空间/microi-api:$version
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-api:$version
```
在 cmd 中执行 `publish.sh` 或 `publish.bat`。

---

### 3️⃣ 本地打包并上传 Docker 镜像 - 前端

- 使用 `npm run build` 打包前端
- 在打包输出目录创建 `Dockerfile`：
```powershell
#Vue2
FROM registry.cn-hangzhou.aliyuncs.com/acs-sample/nginx
COPY dist/  /usr/share/nginx/html/
COPY default.conf /etc/nginx/conf.d/default.conf
CMD ["/bin/bash", "-c", "sed -i \"s@var OsClient = '';@var OsClient = '$OsClient';@;s@var ApiBase = '';@var ApiBase = '$ApiBase';@\" /usr/share/nginx/html/index.html; nginx -g \"daemon off;\""]

#Vue3
FROM registry.cn-hangzhou.aliyuncs.com/acs-sample/nginx
COPY dist/  /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/nginx.conf
COPY default.conf /etc/nginx/conf.d/default.conf
RUN chmod -R 755 /usr/share/nginx/html
CMD ["/bin/bash", "-c", "sed -i \"s@window.OsClient = '';@window.OsClient = '$OsClient';@;s@window.ApiBase = '';@window.ApiBase = '$ApiBase';@;s@window.ApiCustom = '';@window.ApiCustom = '$ApiCustom';@\" /usr/share/nginx/html/index.html && nginx -g \"daemon off;\""]
```
在同目录创建 `publish.sh`（Windows 为 `publish.bat`）：
```powershell
echo "请输入本次要发布的api版本号："
read version
docker login --username=镜像服务帐号 --password=镜像服务帐号密码 registry.cn-地域.aliyuncs.com
docker build -t microi-os .
docker tag microi-os registry.cn-地域.aliyuncs.com/命名空间/microi-os:latest
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-os:latest
docker tag microi-os registry.cn-地域.aliyuncs.com/命名空间/microi-os:$version
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-os:$version
```
在同目录创建 `default.conf`：
```json
server {
	listen	0.0.0.0:80;
	#server_name	127.0.0.1 localhost;
	root	/usr/share/nginx/html;
	index	index.html;
	location / {
		try_files $uri $uri/ /index.html;
		add_header Access-Control-Allow-Origin '*';
		# 允许所有内容类型
		if (-f $request_filename) {
			break;
		}
	}
	location = / {
		add_header Access-Control-Allow-Origin '*';
	}
}
```
在 cmd 中执行 `publish.sh` 或 `publish.bat`。

---

### 5️⃣ 登录 Docker 容器镜像服务
```powershell
docker login --username=帐号 --password=密码 registry.cn-地域.aliyuncs.com
```

---

## 🛠️ 服务器安装 Docker 环境

可通过 Linux 命令安装，也可通过宝塔、1Panel 等面板工具安装：
```powershell
curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
systemctl start docker
systemctl enable docker.service
```

---

## 📝 Docker 常用命令
::: details 展开查看 powershell 代码（42 行）
```powershell
批量清理docker日志文件（第一个符号#要一并执行）
#!/bin/bash
logfiles=$(find /var/lib/docker/containers/ -type f -name *-json.log)  
for logfile in $logfiles  
    do 
        cat /dev/null > $logfile  
    done

#docker restart 容器名称/容器Id  //重启docker
#docker stop 容器名称/容器Id  //停止docker
#docker rm -f 容器名称/容器Id  //强制删除docker
#docker inspect 容器名称/容器Id //查看容器信息
#docker exec -it 容器Id bash //进入容器
进入docker容器后使用vim：
#apt-get update
#apt-get install -y vim
#vim xxxx.json
按键i开始编辑，按键ESC后输入:wq保存并退出

cd /
# 查看空间占用
du -h --max-depth=1 | sort -h
# 看哪个目录占用空间大
du -s * | sort -rn
# 查找大文件（超过100M）
find / -size +100M -exec ls -lh {}
# 根据情况进行移动或者卸载，
# 软件包可以rpm –e卸载，
# 文件可以使用rm -rf dir删除；
# 常用命令
ls -lh
# 显示当前目录
pwd
# 显示当前目录所有文件的体积，以M为单位，正序排，不显示文件夹
find . -maxdepth 1 -type f -exec du -m {} \; | sort -n
# 清理docker悬空镜像
docker image prune -a -f
# 清理docker无用的卷
docker image prune -a -f
# 清理docker构建缓存
docker image prune -a -f

```
:::

---

## ⚙️ MySQL 注意事项

::: tip 核心要点
- 建议使用宝塔、1Panel 等服务器面板工具原生安装 MySQL
- 安装成功后，一定要根据服务器实际配置设置 MySQL 的性能配置
- **必须设置**：`lower_case_table_names = 1`
- 还原数据库前，若旧库不为空，请先删除并重新创建数据库
:::

::: danger Ubuntu 24 + MySQL 8.0
使用宝塔在 Ubuntu 24 上原生安装的 MySQL 8.0，可能遇到修改 3306 端口后无法启动的问题。
:::

::: warning 宝塔 MySQL 5.7 性能调整缺陷
宝塔的 MySQL 5.7 性能调整存在缺陷，例如优化方案选择 48-64GB 时，`table_open_cache=4096` 但 `table_definition_cache` 只有 400，可能出现 `1615 - Prepared statement needs to be re-prepared` 错误。

**解决方案：** 在配置文件中添加 `table_definition_cache = 2000`（可为 `table_open_cache` 值的一半或 75%）。临时方案：`SET GLOBAL table_definition_cache = 2000;`
:::

::: warning Navicat 数据传输报错
若报错 `Incorrect datetime value: '0000-00-00 00:00:00'`，先查询 `SELECT @@GLOBAL.sql_mode;`，然后删除 `NO_ZERO_DATE` 和 `NO_ZERO_IN_DATE`：
:::
```json
[mysqld]
sql_mode = ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION
```

::: warning 还原数据库报错
若报错 `Dumping data for table [SQL] Process terminated`，需增加配置：
:::
```json
[mysqld]
max_allowed_packet = 512M
net_buffer_length = 16384
```

**宝塔安装后 root 无法外网登录？** 在服务器执行以下命令开放（项目上线后为了安全性可关闭防火墙 MySQL 端口）：
```sql
mysql -u root -p
show databases;
use mysql;
select host,user from user;
update user set host='%' where user='root';
flush privileges;
```
**MySQL 问题排查常用 SQL：**
```sql
-- 查看当前连接数和使用情况
SHOW STATUS LIKE 'Threads_connected';
-- 查看连接详细
SHOW PROCESSLIST;
-- 查看连接来源
SELECT user, host, db, command, time, state, info 
FROM information_schema.processlist 
WHERE command != 'Sleep';
-- 查看连接历史峰值
SHOW STATUS LIKE 'Max_used_connections';
```

---

## 📦 Redis 注意事项
```cmd
//检查Redis运行状态
docker exec -it redis容器名称 redis-cli -a 'redis密码' info stats

//监控Redis性能
docker exec -it redis容器名称 redis-cli -a 'redis密码' monitor
//监控原生安装的redis
redis-cli -p 3306 -a 'redis密码' monitor

//检查连接数
docker exec -it redis容器名称 redis-cli -a 'redis密码' info clients
```

---

## 📂 MinIO 注意事项

::: danger 反向代理必须配置
MinIO 在做反向代理时，必须设置 `proxy_set_header Host $http_host`，否则会导致私有桶只能上传无法下载。阿里云 OSS、CDN、负载均衡默认配置不会有此问题。
:::
