:<<'WIN'
@echo off
chcp 65001 2>nul
setlocal EnableDelayedExpansion
rem ════════════════════════════════════════════════════════════════
rem  Microi 一键编译发布助手 - Windows 自动启动器
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
echo.
echo   ^> Bash: !BASH_EXE!
echo.
"!BASH_EXE!" "%~f0"
set EC=!ERRORLEVEL!
echo.
pause
exit /b !EC!
:wsl_run
echo.
echo   ^> WSL: 执行中...
echo.
for /f "delims=" %%p in ('wsl wslpath -u "%~f0"') do set "WSLP=%%p"
wsl bash "!WSLP!"
set EC=!ERRORLEVEL!
echo.
pause
exit /b !EC!
WIN
#!/usr/bin/env bash
# 如果用户在 macOS/Linux 上用 `sh Microi一键编译发布.sh` 启动，
# 这里先切回 bash；脚本后续依赖数组、[[ ]]、process substitution 等 bash 语法。
if [ -z "${BASH_VERSION:-}" ]; then
    if command -v bash >/dev/null 2>&1; then
        exec bash "$0" "$@"
    fi
    printf '%s\n' "ERROR: 未找到 bash，请安装 bash 后执行：bash $0" >&2
    exit 1
fi
set +o posix 2>/dev/null || true

# ════════════════════════════════════════════════════════════════
#  Microi 一键编译发布助手
#  适用于 Microi 低代码平台的后端 (.NET) 和前端 (Vue3) 一键编译发布
#  macOS / Linux:  bash Microi一键编译发布.sh（也兼容 sh Microi一键编译发布.sh）
#  Windows:        在 Git Bash 终端中运行同样的命令即可
#                  bash Microi一键编译发布.sh
#  开源地址: https://gitee.com/ITdos/microi.net
# ════════════════════════════════════════════════════════════════
set -e
set -o pipefail

# Windows (Git Bash) 下：正常结束时暂停便于查看结果；关闭窗口/Ctrl+C 时立即清理，不再卡在 read。
MICROI_SKIP_EXIT_PAUSE=false
MICROI_ACTIVE_BUILD_PID=""
MICROI_ACTIVE_GUARD_PID_FILE=""

is_windows_shell() {
    [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || -n "$WINDIR" ]]
}

stop_active_client_build() {
    local _pid="${MICROI_ACTIVE_BUILD_PID:-}"
    [ -z "$_pid" ] && return 0

    kill -TERM "$_pid" 2>/dev/null || true
    local _wait_count=0
    while kill -0 "$_pid" 2>/dev/null && [ $_wait_count -lt 20 ]; do
        sleep 0.1
        ((_wait_count++)) || true
    done

    # Node guard 会把真实 Windows PID 写入此文件。若优雅退出失败，精确清理它的整个子进程树。
    if is_windows_shell && [ -n "${MICROI_ACTIVE_GUARD_PID_FILE:-}" ] && [ -f "$MICROI_ACTIVE_GUARD_PID_FILE" ]; then
        local _guard_pid
        _guard_pid=$(tr -cd '0-9' < "$MICROI_ACTIVE_GUARD_PID_FILE")
        if [[ "$_guard_pid" =~ ^[0-9]+$ ]] && [ "$_guard_pid" -gt 0 ]; then
            taskkill.exe /PID "$_guard_pid" /T /F >/dev/null 2>&1 || true
        fi
    fi

    kill -KILL "$_pid" 2>/dev/null || true
    wait "$_pid" 2>/dev/null || true
    MICROI_ACTIVE_BUILD_PID=""
}

handle_session_interrupt() {
    local _signal="${1:-TERM}"
    MICROI_SKIP_EXIT_PAUSE=true
    stop_active_client_build
    trap - EXIT INT TERM HUP
    [ "$_signal" = "INT" ] && exit 130
    exit 143
}

finish_windows_session() {
    local _exit_code=$?
    trap - EXIT
    if [ "$MICROI_SKIP_EXIT_PAUSE" != true ] && [ -t 0 ]; then
        echo ""
        read -r -p "  按回车键关闭窗口..." _w || true
    fi
    exit "$_exit_code"
}

if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || -n "$WINDIR" ]]; then
    trap finish_windows_session EXIT
    trap 'handle_session_interrupt INT' INT
    trap 'handle_session_interrupt TERM' TERM
    trap 'handle_session_interrupt HUP' HUP
    # 将 Windows 常见 Node.js 安装路径加入 PATH，确保 npm/pnpm 可用
    for _np in \
        "/c/Program Files/nodejs" \
        "/c/Program Files (x86)/nodejs" \
        "$APPDATA/npm" \
        "$LOCALAPPDATA/pnpm" \
        "$LOCALAPPDATA/Yarn/bin"; do
        [ -d "$_np" ] && export PATH="$_np:$PATH"
    done
fi

# ════════════════════════════════════════════════════════════════
# ⚙️  用户配置区域（请根据您的环境修改以下配置）
# ════════════════════════════════════════════════════════════════
#
# 【Docker 镜像仓库配置】
# 使用阿里云容器镜像服务，请修改为您自己的配置
# 注意：如果配置文件（Microi一键编译发布配置.json）中存在 Docker 配置，
#       将优先使用配置文件中的值（配置文件已被 .gitignore 忽略，适合存放私有凭据）
#
DOCKER_REGION="hangzhou"                     # 地域（hangzhou/shanghai/beijing/shenzhen/chengdu 等）
DOCKER_NAMESPACE="your-namespace"            # 命名空间
DOCKER_USERNAME="your-username"              # 帐号
DOCKER_PASSWORD="your-password"              # 密码
#
# 【Docker 镜像推送方案】
# 每个方案定义要构建和推送的镜像列表，发布时选择一个方案执行
# 格式: "方案显示名|类型|本地镜像名|远程镜像名1:tag1,远程镜像名2:tag2"
#   类型: api 或 client
#   tag 支持占位符: {latest}=latest, {version}=当前版本号
#
# 示例（开源用户只需修改上面的 Docker 凭据，方案保持默认即可）:
DOCKER_PLANS=(
    "后端镜像-仅测试|api|microi-api-dev|microi-api-dev:{latest}"
    "后端镜像-正式和测试|api|microi-api|microi-api:{latest},microi-api:{version},microi-api-dev:{latest}"
    "前端镜像-测试|client|microi-web-dev|microi-web-dev:{latest},microi-web-dev:{version},microi-client-dev:{latest},microi-client-dev:{version}"
    "前端镜像-正式和测试|client|microi-web-dev|microi-web-dev:{latest},microi-web-dev:{version},microi-client-dev:{latest},microi-client-dev:{version}"
)
#
# 【前端 package.json 文件路径列表】（用于同步更新版本号）
PACKAGE_JSON_FILES=(
    "Microi.Client/package.json"
    "microi.webos/package.json"
)
# ════════════════════════════════════════════════════════════════
# ⚙️  以下为脚本核心逻辑，通常无需修改
# ════════════════════════════════════════════════════════════════

# 切换到脚本所在目录（确保所有相对路径正确）
cd "$(dirname "$0")"
START_TIME=$(date +%s)

# ──────────────────────────────────────────────────────────────
# 工具函数
# ──────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

print_banner() {
    echo ""
    echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    printf "${BOLD}${BLUE}║${NC}  ${BOLD}%-58s${NC}${BOLD}${BLUE}║${NC}\n" "$1"
    echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_phase() {
    PHASE_NUM=$((PHASE_NUM + 1))
    echo ""
    echo -e "${BOLD}${CYAN}┌──────────────────────────────────────────────────────────────┐${NC}"
    printf "${BOLD}${CYAN}│${NC}  ${BOLD}阶段 %d: %-54s${NC}${BOLD}${CYAN}│${NC}\n" "$PHASE_NUM" "$1"
    echo -e "${BOLD}${CYAN}└──────────────────────────────────────────────────────────────┘${NC}"
    echo ""
}

print_step() {
    echo -e "  ${CYAN}▸${NC} $1"
}

print_success() {
    echo -e "  ${GREEN}✅ $1${NC}"
}

print_fail() {
    echo -e "  ${RED}❌ $1${NC}"
    echo ""
    echo -e "  ${RED}════════════════════════════════════════════════════════════${NC}"
    echo -e "  ${RED}${BOLD}发布流程已中止！请修复上述错误后重新执行。${NC}"
    echo -e "  ${RED}════════════════════════════════════════════════════════════${NC}"
    exit 1
}

print_warning() {
    echo -e "  ${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "  ${DIM}ℹ  $1${NC}"
}

print_divider() {
    echo -e "  ${DIM}────────────────────────────────────────────────────────${NC}"
}

# 直接启动前端构建守护器，避免 Git Bash + nvm-windows 的 npm POSIX 包装器
# 在异常关闭时留下多层 bash/npm 残留进程。
run_client_build() {
    local _node_cmd="node"
    if is_windows_shell && command -v node.exe >/dev/null 2>&1; then
        _node_cmd="node.exe"
    fi
    if ! command -v "$_node_cmd" >/dev/null 2>&1; then
        echo "未找到 Node.js：$_node_cmd" >&2
        return 127
    fi
    if [ ! -f "scripts/build-with-memory-guard.mjs" ]; then
        echo "未找到前端构建守护器 scripts/build-with-memory-guard.mjs" >&2
        return 1
    fi

    MICROI_ACTIVE_GUARD_PID_FILE="$PWD/.tmp/build-logs/guard.pid"
    rm -f "$MICROI_ACTIVE_GUARD_PID_FILE"
    "$_node_cmd" scripts/build-with-memory-guard.mjs &
    MICROI_ACTIVE_BUILD_PID=$!

    local _exit_code=0
    wait "$MICROI_ACTIVE_BUILD_PID" || _exit_code=$?
    MICROI_ACTIVE_BUILD_PID=""
    rm -f "$MICROI_ACTIVE_GUARD_PID_FILE"
    return "$_exit_code"
}

# 跨平台 sed -i
sed_inplace() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "$@"
    else
        sed -i "$@"
    fi
}

# 读取 JSON 字段值（简易解析器，适用于扁平JSON）
json_value() {
    grep "\"$1\"" "$2" 2>/dev/null | head -1 | sed 's/.*"'"$1"'"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/'
}

# 自动递增版本号：patch+1，满10进位（如 4.8.9→4.9.0，4.9.9→5.0.0）
auto_increment_version() {
    local IFS=.
    local parts=($1)
    local major=${parts[0]} minor=${parts[1]} patch=${parts[2]}
    patch=$((patch + 1))
    if [ $patch -ge 10 ]; then patch=0; minor=$((minor + 1)); fi
    if [ $minor -ge 10 ]; then minor=0; major=$((major + 1)); fi
    echo "${major}.${minor}.${patch}"
}

PHASE_NUM=0

#
# 【DLL加密项目列表】（仅源码作者使用，开源用户请忽略）
ENCRYPTED_PROJECTS=("Microi.net" "Microi.AI")
#

# ──────────────────────────────────────────────────────────────
# 环境检测
# ──────────────────────────────────────────────────────────────
print_banner "🔍 Microi 一键编译发布助手"

echo -e "  ${BOLD}📋 环境检测${NC}"
echo ""

# 后端源码
if [ ! -d "Microi.Server" ]; then
    print_fail "未找到 Microi.Server 目录，请在工作区根目录运行此脚本"
fi
print_success "后端源码: Microi.Server/"

# 前端源码
HAS_CLIENT=false
if [ -d "Microi.Client" ]; then
    HAS_CLIENT=true
    print_success "前端源码: Microi.Client/"
else
    print_warning "未找到 Microi.Client 目录，前端编译将不可用"
fi

# 解决方案文件
SLN_FILE=""
if [ -f "Microi.Server/Microi.Anderson.sln" ]; then
    SLN_FILE="Microi.Server/Microi.Anderson.sln"
elif [ -f "Microi.Server/Microi.net.sln" ]; then
    SLN_FILE="Microi.Server/Microi.net.sln"
else
    print_fail "未找到解决方案文件（.sln），请确认 Microi.Server 目录结构完整"
fi
print_success "解决方案: $(basename "$SLN_FILE")"

# NuGet 配置
CONFIG_FILE="Microi一键编译发布配置.json"
HAS_NUGET=false
NUGET_API_KEY=""
NUGET_SOURCE="https://api.nuget.org/v3/index.json"
if [ -f "$CONFIG_FILE" ]; then
    NUGET_API_KEY=$(json_value "ApiKey" "$CONFIG_FILE")
    _source_val=$(json_value "Source" "$CONFIG_FILE")
    if [ -n "$_source_val" ]; then NUGET_SOURCE="$_source_val"; fi
    if [ -n "$NUGET_API_KEY" ] && [ "$NUGET_API_KEY" != "your-nuget-api-key-here" ]; then
        HAS_NUGET=true
        print_success "NuGet 配置: 已加载（ApiKey 已配置）"
    else
        print_info "NuGet 配置: $CONFIG_FILE 存在但 ApiKey 未填写，跳过 NuGet 推送"
    fi

    # 从配置文件加载 Docker 私有凭据（覆盖脚本顶部的默认值）
    _docker_region=$(json_value "Region" "$CONFIG_FILE")
    _docker_ns=$(json_value "Namespace" "$CONFIG_FILE")
    _docker_user=$(json_value "Username" "$CONFIG_FILE")
    _docker_pwd=$(json_value "Password" "$CONFIG_FILE")
    if [ -n "$_docker_region" ]; then DOCKER_REGION="$_docker_region"; fi
    if [ -n "$_docker_ns" ]; then DOCKER_NAMESPACE="$_docker_ns"; fi
    if [ -n "$_docker_user" ]; then DOCKER_USERNAME="$_docker_user"; fi
    if [ -n "$_docker_pwd" ]; then DOCKER_PASSWORD="$_docker_pwd"; fi
else
    print_info "NuGet 配置: 未找到 $CONFIG_FILE，跳过 NuGet 推送"
fi

# Docker 配置检测
HAS_DOCKER=false
if [ "$DOCKER_NAMESPACE" != "your-namespace" ] && [ "$DOCKER_USERNAME" != "your-username" ]; then
    HAS_DOCKER=true
    DOCKER_REGISTRY="registry.cn-${DOCKER_REGION}.aliyuncs.com"
    print_success "Docker 配置: ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}（帐号: ${DOCKER_USERNAME}）"
else
    print_info "Docker 配置: 未配置（请修改脚本顶部的 DOCKER_* 变量或配置文件）"
fi

# DLL 加密能力检测
HAS_ENCRYPT=false
ENCRYPT_SCRIPT="Microi.Server/Microi.net/License/scripts/encrypt-dll.sh"
if [ -d "Microi.Server/Microi.net" ] && [ -d "Microi.Server/Microi.AI" ]; then
    if [ -f "$ENCRYPT_SCRIPT" ]; then
        HAS_ENCRYPT=true
        print_success "DLL 加密: 可用（检测到 Microi.net + Microi.AI 源码）"
    else
        print_warning "DLL 加密: 源码存在但加密脚本缺失: $ENCRYPT_SCRIPT"
    fi
else
    print_info "DLL 加密: 跳过（开源版本无需加密）"
fi

# ──────────────────────────────────────────────────────────────
# 版本信息
# ──────────────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}📋 版本信息${NC}"
echo ""

if [ ! -f "Microi.Server/Directory.Build.props" ]; then
    print_fail "未找到 Microi.Server/Directory.Build.props，无法读取版本号"
fi

CURRENT_VERSION=$(grep -o '<MicroiNetVersion>[0-9]*\.[0-9]*\.[0-9]*</MicroiNetVersion>' Microi.Server/Directory.Build.props | grep -o '[0-9]*\.[0-9]*\.[0-9]*')
if [ -z "$CURRENT_VERSION" ]; then
    print_fail "无法从 Directory.Build.props 读取 MicroiNetVersion"
fi

NEXT_VERSION=$(auto_increment_version "$CURRENT_VERSION")
echo -e "  当前版本: ${BOLD}${CURRENT_VERSION}${NC}"
echo -e "  默认版本: ${BOLD}${GREEN}${NEXT_VERSION}${NC}（自动递增）"

echo ""
read -r -p "  是否手动指定版本号？直接回车使用默认版本 ${NEXT_VERSION}: " _version_input
if [ -n "$_version_input" ]; then
    if [[ ! "$_version_input" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        print_fail "版本号格式无效: $_version_input（请输入三段数字，例如 6.4.3）"
    fi
    NEXT_VERSION="$_version_input"
    print_success "已指定本次发布版本: $NEXT_VERSION"
else
    print_info "使用默认发布版本: $NEXT_VERSION"
fi

# ══════════════════════════════════════════════════════════════
# 前置交互：所有需要人工选择的内容集中在此
# ══════════════════════════════════════════════════════════════
echo ""
echo -e "  ${BOLD}────────────────────────────────────────────────────────${NC}"
echo -e "  ${BOLD}📋 请先完成以下选择，之后将全自动执行${NC}"
echo -e "  ${BOLD}────────────────────────────────────────────────────────${NC}"
echo ""

# --- 发布模式（6选1）---
echo -e "  ${BOLD}【发布模式】${NC}"
echo "    1) 只编译前端和后端（含DLL加密+NuGet替换，不推送、版本号不变）"
echo "    2) 只发布后端（推送Docker、推送NuGet可选跳过、更新版本号）"
if [ "$HAS_CLIENT" = true ]; then
    echo "    3) 只发布前端（推送Docker、不推送NuGet、版本号不变）"
    echo "    4) 发布前端和后端（推送Docker、推送NuGet可选跳过、更新版本号）"
else
    echo -e "    ${DIM}3) 只发布前端（未检测到前端源码，不可用）${NC}"
    echo "    4) 只发布后端（推送Docker、推送NuGet可选跳过、更新版本号）"
fi
    echo "    5) 仅推送Docker镜像（跳过编译，直接使用已有产物推送）"
    echo "    6) 只编译和推送【官方网站文档】"
    echo ""
    read -p "  请输入选项 [1/2/3/4/5/6]: " DEPLOY_MODE
    case "$DEPLOY_MODE" in
        1|2|3|4|5|6) ;;
        *) print_fail "无效选项: $DEPLOY_MODE（仅支持 1/2/3/4/5/6）" ;;
    esac

    # 模式3需要前端源码
    if [ "$DEPLOY_MODE" = "3" ] && [ "$HAS_CLIENT" != true ]; then
        print_fail "未找到 Microi.Client 目录，无法发布前端"
    fi

# --- 根据模式设置执行标志 ---
BUMP_VERSION=false      # 是否更新版本号
BUILD_BACKEND=false     # 是否编译后端（dotnet build）
BUILD_CLIENT=false      # 是否编译前端（npm run build）
PUBLISH_BACKEND=false   # 是否发布后端（dotnet publish + 冒烟 + 加密）
PUSH_NUGET=false        # 是否推送 NuGet
PUSH_DOCKER=false       # 是否推送 Docker

case "$DEPLOY_MODE" in
    1)  # 只编译前端和后端（含DLL加密+NuGet替换，不推送）
        BUILD_BACKEND=true; PUBLISH_BACKEND=true
        if [ "$HAS_CLIENT" = true ]; then BUILD_CLIENT=true; fi
        ;;
    2)  # 只发布后端
        BUMP_VERSION=true; BUILD_BACKEND=true; PUBLISH_BACKEND=true
        PUSH_NUGET=true; PUSH_DOCKER=true
        ;;
    3)  # 只发布前端（版本号不变）
        BUILD_CLIENT=true; PUSH_DOCKER=true
        ;;
    4)  # 发布前端和后端
        BUMP_VERSION=true; BUILD_BACKEND=true; PUBLISH_BACKEND=true
        PUSH_NUGET=true; PUSH_DOCKER=true
        if [ "$HAS_CLIENT" = true ]; then BUILD_CLIENT=true; fi
        ;;
    5)  # 仅推送Docker镜像（跳过编译，使用已有产物）
        PUSH_DOCKER=true
        ;;
    6)  # 只编译和推送官方网站文档（由后续专属块处理）
        ;;
esac

# 确定最终版本号
if [ "$BUMP_VERSION" = true ]; then
    VERSION="$NEXT_VERSION"
else
    VERSION="$CURRENT_VERSION"
fi

# --- NuGet 发布选项（模式2/4）---
SKIP_NUGET_REQUESTED=false
if [ "$PUSH_NUGET" = true ]; then
    if [ "$HAS_NUGET" != true ]; then
        PUSH_NUGET=false
    else
        echo ""
        echo -e "  ${BOLD}【NuGet发布】${NC}"
        echo "    是否跳过 NuGet 发布？"
        echo "    已发布过同版本、仅需继续前端/Docker 发布时请选择 1。"
        read -r -p "  请输入选项 [0=否，正常推送/1=是，跳过NuGet，直接回车=否]: " _skip_nuget_choice
        case "$_skip_nuget_choice" in
            0|"") ;;
            1)
                PUSH_NUGET=false
                SKIP_NUGET_REQUESTED=true
                print_info "已选择跳过 NuGet 发布"
                ;;
            *) print_fail "无效选项: $_skip_nuget_choice（仅支持 0/1）" ;;
        esac
    fi
fi

# --- Docker 方案选择（仅发布模式需要）---
SELECTED_API_PLANS=()
SELECTED_CLIENT_PLANS=()

if [ "$PUSH_DOCKER" = true ] && [ "$HAS_DOCKER" = true ] && [ ${#DOCKER_PLANS[@]} -gt 0 ]; then
    # 分离 api 和 client 方案
    _api_plans=()
    _client_plans=()
    for plan in "${DOCKER_PLANS[@]}"; do
        _type=$(echo "$plan" | cut -d'|' -f2)
        if [ "$_type" = "api" ]; then
            _api_plans+=("$plan")
        elif [ "$_type" = "client" ]; then
            _client_plans+=("$plan")
        fi
    done

    # 后端 Docker 方案（模式2和4，模式3跳过）
    if [ ${#_api_plans[@]} -gt 0 ] && [ "$DEPLOY_MODE" != "3" ]; then
        echo ""
        echo -e "  ${BOLD}【后端Docker方案】${NC}"
        echo "    0) 跳过后端Docker推送"
        for i in "${!_api_plans[@]}"; do
            _name=$(echo "${_api_plans[$i]}" | cut -d'|' -f1)
            echo "    $((i+1))) $_name"
        done
        echo ""
        read -p "  请输入选项 [0-${#_api_plans[@]}]: " _api_choice
        if [ "$_api_choice" != "0" ]; then
            _idx=$((_api_choice - 1))
            if [ $_idx -lt 0 ] || [ $_idx -ge ${#_api_plans[@]} ]; then
                print_fail "无效选项: $_api_choice"
            fi
            SELECTED_API_PLANS+=("${_api_plans[$_idx]}")
        fi
    fi

    # 前端 Docker 方案（模式3、4、5）
    if [ ${#_client_plans[@]} -gt 0 ] && { [ "$DEPLOY_MODE" = "3" ] || [ "$DEPLOY_MODE" = "4" ] || [ "$DEPLOY_MODE" = "5" ]; }; then
        echo ""
        echo -e "  ${BOLD}【前端Docker方案】${NC}"
        echo "    0) 跳过前端Docker推送"
        for i in "${!_client_plans[@]}"; do
            _name=$(echo "${_client_plans[$i]}" | cut -d'|' -f1)
            echo "    $((i+1))) $_name"
        done
        echo ""
        read -p "  请输入选项 [0-${#_client_plans[@]}]: " _client_choice
        if [ "$_client_choice" != "0" ]; then
            _idx=$((_client_choice - 1))
            if [ $_idx -lt 0 ] || [ $_idx -ge ${#_client_plans[@]} ]; then
                print_fail "无效选项: $_client_choice"
            fi
            SELECTED_CLIENT_PLANS+=("${_client_plans[$_idx]}")
        fi
    fi
elif [ "$PUSH_DOCKER" = true ] && [ "$HAS_DOCKER" != true ]; then
    print_warning "Docker 未配置，将跳过 Docker 推送"
fi

# --- 官方网站文档发布选项 ---
PUBLISH_DOC=false
if [ "$DEPLOY_MODE" = "6" ]; then
    PUBLISH_DOC=true
elif [ -d "microi.doc" ]; then
    echo ""
    echo -e "  ${BOLD}【官方网站文档】${NC}"
    echo "    是否同时发布官方网站文档（构建 VitePress 并推送 Docker 镜像）？"
    read -p "  请输入选项 [0=否/1=是]: " _doc_choice
    case "$_doc_choice" in
        1) PUBLISH_DOC=true ;;
        *) PUBLISH_DOC=false ;;
    esac
fi

# ──────────────────────────────────────────────────────────────
# 打印执行摘要
# ──────────────────────────────────────────────────────────────
_mode_names=(" " "只编译前端和后端" "只发布后端" "只发布前端" "发布前端和后端" "仅推送Docker镜像" "只编译和推送官方网站文档")
echo ""
echo -e "  ${BOLD}════════════════════════════════════════════════════════${NC}"
echo -e "  ${BOLD}✅ 选择完毕，即将开始全自动执行${NC}"
echo -e "  ${BOLD}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  发布模式: ${BOLD}${_mode_names[$DEPLOY_MODE]}${NC}"
if [ "$BUMP_VERSION" = true ]; then
    echo -e "  版本号:   ${BOLD}${CURRENT_VERSION} → ${GREEN}${VERSION}${NC}"
else
    echo -e "  版本号:   ${BOLD}${CURRENT_VERSION}${NC}（不变）"
fi
if [ "$BUILD_BACKEND" = true ]; then
    echo -e "  后端编译: ${GREEN}✔${NC}"
    if [ "$PUBLISH_BACKEND" = true ]; then
        echo -e "  后端发布: ${GREEN}✔${NC}（dotnet publish + 冒烟测试）"
    fi
fi
if [ "$BUILD_CLIENT" = true ]; then
    echo -e "  前端编译: ${GREEN}✔${NC}"
fi
for _p in "${SELECTED_API_PLANS[@]}"; do
    echo -e "  后端Docker: ${GREEN}✔${NC} $(echo "$_p" | cut -d'|' -f1)"
done
for _p in "${SELECTED_CLIENT_PLANS[@]}"; do
    echo -e "  前端Docker: ${GREEN}✔${NC} $(echo "$_p" | cut -d'|' -f1)"
done
if [ "$PUSH_NUGET" = true ]; then
    echo -e "  NuGet:    ${GREEN}✔${NC} 自动推送"
elif [ "$SKIP_NUGET_REQUESTED" = true ]; then
    echo -e "  NuGet:    ${YELLOW}⏭${NC} 已手动跳过"
fi
if [ "$HAS_ENCRYPT" = true ] && [ "$PUBLISH_BACKEND" = true ]; then
    echo -e "  DLL加密:  ${GREEN}✔${NC} 自动加密"
fi
if [ "$PUBLISH_DOC" = true ]; then
    echo -e "  文档发布: ${GREEN}✔${NC} 构建+推送Docker"
fi
echo ""
sleep 1

# ══════════════════════════════════════════════════════════════
# 开始执行
# ══════════════════════════════════════════════════════════════

# ─── 阶段（条件）: 更新版本号 ─────────────────────────────
if [ "$BUMP_VERSION" = true ]; then
    print_phase "更新版本号（前后端统一: ${CURRENT_VERSION} → ${VERSION}）"

    print_step "更新 Directory.Build.props → $VERSION"
    sed_inplace "s/<MicroiNetVersion>[0-9]*\.[0-9]*\.[0-9]*<\/MicroiNetVersion>/<MicroiNetVersion>$VERSION<\/MicroiNetVersion>/g" "Microi.Server/Directory.Build.props"
    print_success "Microi.Server/Directory.Build.props"

    update_count=0
    print_step "更新 .csproj 文件版本号..."
    while IFS= read -r csproj_file; do
        sed_inplace "s/<Version>[0-9]*\.[0-9]*\.[0-9]*<\/Version>/<Version>$VERSION<\/Version>/g" "$csproj_file"
        sed_inplace "s/<AssemblyVersion>[0-9]*\.[0-9]*\.[0-9]*<\/AssemblyVersion>/<AssemblyVersion>$VERSION<\/AssemblyVersion>/g" "$csproj_file"
        sed_inplace "s/<FileVersion>[0-9]*\.[0-9]*\.[0-9]*<\/FileVersion>/<FileVersion>$VERSION<\/FileVersion>/g" "$csproj_file"
        print_success "$(basename "$csproj_file")"
        ((update_count++)) || true
    done < <(find Microi.Server -maxdepth 2 -name "*.csproj" -not -path "*/obj/*" -not -path "*/bin/*" 2>/dev/null | sort)

    if [ $update_count -eq 0 ]; then
        print_fail "未找到任何 .csproj 文件"
    fi

    print_step "更新 package.json 文件版本号..."
    for package_file in "${PACKAGE_JSON_FILES[@]}"; do
        if [ -f "$package_file" ]; then
            sed_inplace "s/\"version\": \"[0-9]*\.[0-9]*\.[0-9]*\",/\"version\": \"$VERSION\",/g" "$package_file"
            print_success "$package_file"
        else
            print_info "跳过（不存在）: $package_file"
        fi
    done

    echo ""
    print_success "共更新 $update_count 个 .csproj + ${#PACKAGE_JSON_FILES[@]} 个 package.json"
fi

# ─── 阶段（条件）: 双向同步官方升级资源 ──────────────────
# 后端发布产物会把 Resource 下的基础应用打入程序集，因此必须在编译前完成
# 本地 / iTdos 官网三方合并。仅官网有更新时无需 Token；需要写回官网时由
# MICROI_UPGRADE_RESOURCE_TOKEN 提供管理员令牌。冲突或发布后回读不一致会终止发布。
if [ "$PUBLISH_BACKEND" = true ]; then
    print_phase "同步 iTdos 官网与后端内置升级资源"
    if ! command -v node >/dev/null 2>&1; then
        print_fail "未找到 Node.js，无法执行升级资源三方同步"
    fi
    if ! node Microi.Server/Microi.Upgrade/Resource/refresh-resources.mjs --publish --allow-verified-offline; then
        print_fail "升级资源同步失败；已阻止后端发布，避免官网与内置应用商城互相覆盖"
    fi
    print_success "升级资源安全检查已完成（实时同步或已验证离线基线，详见上方明细）"
fi

# Windows 并行编译时文件锁竞争问题，强制单线程（macOS/Linux 不需要）
_BUILD_EXTRA_ARGS=""
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || -n "$WINDIR" ]]; then
    _BUILD_EXTRA_ARGS="-m:1 -nodeReuse:false"
    # 终止 Roslyn 编译服务器（VBCSCompiler）——它会在编译完 DLL 后仍持有文件句柄，
    # 导致后续项目引用该 DLL 时报 "file is being used by another process"。
    # VBCSCompiler 是纯后台缓存进程，终止后下次编译会自动重启，无副作用。
    print_step "清理 Roslyn 编译服务进程（VBCSCompiler）..."
    # 用 taskkill 而不是 powershell.exe：
    #   1. PowerShell 启动要加载 .NET（1-2s），VBCSCompiler 进程多时线性变慢；
    #   2. PowerShell 管道 "Get-Process | Stop-Process" 会一直等到进程真正退出，
    #      VBCSCompiler 持有 DLL 文件句柄时强制终止会长时间挂起；
    #   3. Git Bash 重定向 PowerShell 的 stdin 没显式关闭时，
    #      powershell.exe 会等 stdin EOF 才退出，整个脚本就僵在那。
    # taskkill 是原生 exe，无 .NET 依赖，配合 < /dev/null 关闭 stdin、timeout 10 兜底，
    # 即便杀不掉也不会卡住后续流程（VBCSCompiler 下次 build 会自动重启）。
    timeout 10 cmd.exe //c "taskkill /F /IM VBCSCompiler.exe /T 2>nul" </dev/null >/dev/null 2>&1 || true
    print_info "Windows 环境：-m:1 -nodeReuse:false，已清理 VBCSCompiler"
fi

# ─── 阶段（条件）: 编译后端解决方案 ──────────────────────
if [ "$BUILD_BACKEND" = true ]; then
    print_phase "编译后端解决方案"

    print_step "dotnet build $(basename "$SLN_FILE") -c Release --no-incremental $_BUILD_EXTRA_ARGS -p:GeneratePackageOnBuild=false"
    echo ""
    _BUILD_LOG="$(mktemp /tmp/microi-build.XXXXXX.log)"
    if ! dotnet build "$SLN_FILE" -c Release --no-incremental $_BUILD_EXTRA_ARGS -p:GeneratePackageOnBuild=false 2>&1 | tee "$_BUILD_LOG"; then
        echo ""
        echo -e "  ${RED}───── 编译错误摘要（最后30行）─────${NC}"
        grep -E "error |Error |FAILED" "$_BUILD_LOG" 2>/dev/null | tail -20 || tail -30 "$_BUILD_LOG"
        echo -e "  ${RED}───────────────────────────────────${NC}"
        rm -f "$_BUILD_LOG"
        print_fail "后端编译失败，请检查上方编译错误"
    fi
    rm -f "$_BUILD_LOG"
    echo ""
    print_success "后端编译成功"
fi

# ─── 阶段（条件）: 发布 + 冒烟 + 加密 ────────────────────
PUBLISH_DIR="Microi.Server/Microi.net.Api/bin/Release/publish"
DLL_ENCRYPTED=false

if [ "$PUBLISH_BACKEND" = true ]; then
    print_phase "发布 Microi.net.Api"

print_step "清理旧发布文件..."
cd Microi.Server/Microi.net.Api
dotnet clean -c Release > /dev/null 2>&1 || true
rm -rf ./bin/Release/publish

print_step "dotnet publish -c Release $_BUILD_EXTRA_ARGS..."
echo ""
if ! dotnet publish -c Release $_BUILD_EXTRA_ARGS -o ./bin/Release/publish; then
    cd ../..
    print_fail "Microi.net.Api 发布失败"
fi
cd ../..
echo ""
print_success "Microi.net.Api 发布成功"

# --- 生成 NuGet 包（独立打包，避免编译期文件锁）---
# 只在需要 nupkg（推送NuGet 或 加密DLL替换）时执行
if [ "$PUSH_NUGET" = true ] || [ "$HAS_ENCRYPT" = true ]; then
    print_divider
    print_step "dotnet pack 生成 NuGet 包（--no-build，基于已编译产物）..."
    echo ""
    _PACK_LOG="$(mktemp /tmp/microi-pack.XXXXXX.log)"
    if ! dotnet pack "$SLN_FILE" -c Release --no-build $_BUILD_EXTRA_ARGS 2>&1 | tee "$_PACK_LOG"; then
        echo ""
        echo -e "  ${RED}───── Pack 错误摘要─────${NC}"
        grep -E "error |Error |FAILED" "$_PACK_LOG" 2>/dev/null | tail -20 || tail -30 "$_PACK_LOG"
        echo -e "  ${RED}────────────────────────${NC}"
        rm -f "$_PACK_LOG"
        print_fail "NuGet 包生成失败"
    fi
    rm -f "$_PACK_LOG"
    echo ""
    print_success "NuGet 包生成成功"
fi

# --- 冒烟测试前：注入当前环境的 appsettings ---
# Microi.net.Api.csproj 默认 <Content Update="appsettings.*.json" CopyToPublishDirectory="Never" />
# 阻止了 appsettings.{OsClient}.json 被复制到发布目录。但 Microi 启动靠 .microi-local 切换
# 环境名，并依赖 ASP.NET Core 加载 appsettings.{Environment}.json 覆盖 appsettings.json 里的
# 数据库/Redis/Mongo 连接串。如果发布目录里只有空的 appsettings.json，启动会卡在初始化直到超时。
# 这里临时把当前环境的 appsettings.{OsClient}.json 拷贝到发布目录，冒烟测试结束后还原。
SMOKE_BACKUP="$PUBLISH_DIR/appsettings.json.smoke.bak"
SMOKE_INJECTED=false
if [ -f "Microi.Server/Microi.net.Api/.microi-local" ]; then
    _local_env=$(tr -d '\r\n[:space:]' < "Microi.Server/Microi.net.Api/.microi-local")
    _local_appsettings="Microi.Server/Microi.net.Api/appsettings.${_local_env}.json"
    if [ -f "$_local_appsettings" ] && [ -d "$PUBLISH_DIR" ]; then
        [ -f "$PUBLISH_DIR/appsettings.json" ] && cp "$PUBLISH_DIR/appsettings.json" "$SMOKE_BACKUP"
        cp "$_local_appsettings" "$PUBLISH_DIR/appsettings.json"
        SMOKE_INJECTED=true
        print_info "冒烟测试已注入环境配置: $_local_env"
    else
        print_warning ".microi-local=$_local_env，但未找到 $_local_appsettings，冒烟测试将用空配置（必失败）"
    fi
else
    print_warning "未找到 Microi.Server/Microi.net.Api/.microi-local，冒烟测试将用空配置（必失败）"
fi

# --- 冒烟测试前：预检依赖服务连通性 ---
# Microi 启动后会立即尝试连 MySQL/Redis/Mongo。如果任一不可达，程序会卡在初始化阶段
# 静默等到 .NET 默认连接超时（30s+），跟冒烟测试的 30s 超时窗口几乎重叠，
# 看起来像"卡住"，实际是依赖服务问题。提前 3s TCP 探测可快速定位。
if [ "$SMOKE_INJECTED" = true ]; then
    _appsettings_path="Microi.Server/Microi.net.Api/appsettings.${_local_env}.json"
    if [ -f "$_appsettings_path" ]; then
        print_step "预检依赖服务连通性（$_local_env）..."

        _db_conn=$(json_value "OsClientDbConn" "$_appsettings_path")
        _redis_host=$(json_value "OsClientRedisHost" "$_appsettings_path")
        _redis_port=$(json_value "OsClientRedisPort" "$_appsettings_path")
        _mongo_conn=$(json_value "OsClientDbMongoConn" "$_appsettings_path")

        # 解析 MySQL 连接串: "Data Source=HOST;...Port=PORT;..."
        _db_host=$(echo "$_db_conn" | sed -n 's/.*Data Source=\([^;]*\).*/\1/p' | head -1)
        _db_port=$(echo "$_db_conn" | sed -n 's/.*Port=\([0-9]*\).*/\1/p' | head -1)
        [ -z "$_db_port" ] && _db_port=3306

        # 解析 Mongo 连接串: "mongodb://user:pass@HOST:PORT" 或 "...HOST:PORT"
        _mongo_host=$(echo "$_mongo_conn" | sed -n 's|.*@\([^:/@]*\).*|\1|p' | head -1)
        _mongo_port=$(echo "$_mongo_conn" | sed -n 's|.*@\([^:/@]*\):\([0-9]*\).*|\2|p' | head -1)

        _tcp_check() {
            local host=$1 port=$2 name=$3
            if [ -z "$host" ] || [ -z "$port" ]; then
                print_info "  - ${name}: 配置缺失（跳过）"
                return 0
            fi
            if timeout 3 bash -c "</dev/tcp/${host}/${port}" 2>/dev/null; then
                print_info "  ✓ ${name} ${host}:${port} 可达"
                return 0
            else
                print_warning "  ✗ ${name} ${host}:${port} 不可达！"
                return 1
            fi
        }

        _precheck_failed=false
        _tcp_check "$_db_host" "$_db_port" "MySQL"   || _precheck_failed=true
        _tcp_check "$_redis_host" "$_redis_port" "Redis" || _precheck_failed=true
        # MongoDB 不是阻塞 Microi 启动的关键依赖（多数接口引擎不用 Mongo），不可达只警告不中止
        _tcp_check "$_mongo_host" "$_mongo_port" "MongoDB" || print_warning "    MongoDB 不可达，但不会阻塞启动，继续冒烟测试"

        if [ "$_precheck_failed" = true ]; then
            # 先还原 appsettings 备份再中止，避免临时配置遗留
            [ -f "$SMOKE_BACKUP" ] && mv "$SMOKE_BACKUP" "$PUBLISH_DIR/appsettings.json"
            print_fail "依赖服务不可达，冒烟测试必失败。
  排查方向：
    1. DNS / 路由: ping ${_db_host:-net.itdos.net}
    2. 端口: 防火墙是否放行 ${_db_port:-3306} / ${_redis_port:-6379} / ${_mongo_port:-27017}
    3. 服务: MySQL/Redis/Mongo 进程是否在跑
  修好后再重跑，或编辑 appsettings.${_local_env}.json 指向可达的本地服务"
        fi
    fi
fi

# --- 冒烟测试 ---
# 成功标记：Program.cs:506 打印的 "开始访问系统吧"（Kestrel 已绑定端口并接受请求），
# 而 Program.cs:178 打印的 "Microi所有初始化成功" 只是 Quartz 之后、Kestrel 之前，
# 间隔约 5s（看历史日志 .tmp-api-out-run.log）。30s 太短，Quartz 集群锁竞争/加载 Job
# 在数据库/Redis 慢时会超 30s。改成 90s + 以 Kestrel 真开始监听为准。
SMOKE_TIMEOUT=${SMOKE_TIMEOUT:-90}
print_divider
print_step "冒烟测试: 验证程序能否正常启动（超时 ${SMOKE_TIMEOUT}s）..."
SMOKE_LOG="$(mktemp /tmp/microi-smoke-test.XXXXXX.log)"
if ! (
    cd "$PUBLISH_DIR"
    dotnet Microi.net.Api.dll --urls=http://0.0.0.0:8080 > "$SMOKE_LOG" 2>&1 &
    SMOKE_PID=$!
    # 两个任一出现即视为成功：提前的 "Microi所有初始化成功" + 最终的 "开始访问系统吧"
    for i in $(seq 1 "$SMOKE_TIMEOUT"); do
        if grep -qE "开始访问系统吧|Microi所有初始化成功" "$SMOKE_LOG" 2>/dev/null; then
            if grep -q "开始访问系统吧" "$SMOKE_LOG" 2>/dev/null; then
                echo "  ✅ 冒烟测试通过: Kestrel 已开始监听端口！"
            else
                echo "  ✅ 冒烟测试通过: Microi所有初始化成功（${i}s）"
            fi
            kill $SMOKE_PID 2>/dev/null; wait $SMOKE_PID 2>/dev/null || true
            rm -f "$SMOKE_LOG"; exit 0
        fi
        if ! kill -0 $SMOKE_PID 2>/dev/null; then
            if grep -qE "开始访问系统吧|Microi所有初始化成功" "$SMOKE_LOG" 2>/dev/null; then
                echo "  ✅ 冒烟测试通过！（进程已正常退出）"
                rm -f "$SMOKE_LOG"; exit 0
            else
                echo "  ❌ 冒烟测试失败: 程序异常退出！"
                echo "--- 启动日志 ---"; cat "$SMOKE_LOG"; echo "----------------"
                rm -f "$SMOKE_LOG"; exit 1
            fi
        fi
        sleep 1
    done
    echo "  ❌ 冒烟测试失败: 启动超时（${SMOKE_TIMEOUT}秒）！"
    echo "--- 启动日志 ---"; cat "$SMOKE_LOG"; echo "----------------"
    kill $SMOKE_PID 2>/dev/null; wait $SMOKE_PID 2>/dev/null || true
    rm -f "$SMOKE_LOG"; exit 1
); then
    rm -f "$SMOKE_LOG" 2>/dev/null
    # 先还原 appsettings，再让脚本整体中止，避免把临时配置留给发布产物
    if [ "$SMOKE_INJECTED" = true ] && [ -f "$SMOKE_BACKUP" ]; then
        mv "$SMOKE_BACKUP" "$PUBLISH_DIR/appsettings.json"
    fi
    print_fail "冒烟测试失败，请检查编译产物"
fi
rm -f "$SMOKE_LOG" 2>/dev/null

# --- 还原冒烟测试临时注入的 appsettings ---
# 还原发布目录原始的 appsettings.json，避免发布产物带真实数据库/Redis/Mongo 连接串。
if [ "$SMOKE_INJECTED" = true ] && [ -f "$SMOKE_BACKUP" ]; then
    mv "$SMOKE_BACKUP" "$PUBLISH_DIR/appsettings.json"
    print_info "已还原发布目录的 appsettings.json"
fi

# --- DLL 加密（仅源码作者环境） ---
if [ "$HAS_ENCRYPT" = true ]; then
    print_divider
    print_step "加密 DLL（Microi.net.dll + Microi.AI.dll）..."
    if ! bash "$ENCRYPT_SCRIPT" "$PUBLISH_DIR"; then
        print_fail "DLL 加密失败！请查看上方 Obfuscar 具体错误（工具缺失或依赖解析失败）"
    fi
    DLL_ENCRYPTED=true
    print_success "DLL 加密完成"
fi

fi  # END: if PUBLISH_BACKEND

# ─── 阶段（条件）: NuGet 包 DLL 替换（加密版本）──────────
# 只要 DLL 已加密就执行替换，无论是否推送（模式1也会执行）
NUPKG_REPLACED=false
if [ "$DLL_ENCRYPTED" = true ]; then
    print_phase "替换 NuGet 包中的 DLL 为加密版本"

    replace_dll_in_nupkg() {
        local project_name=$1
        local package_dir="Microi.Server/${project_name}/bin/Release"
        local encrypted_dll="$PUBLISH_DIR/${project_name}.dll"

        if [ ! -d "$package_dir" ]; then print_warning "目录不存在: $package_dir"; return 1; fi
        local latest_package=$(find "$package_dir" -name "*.nupkg" -not -name "*.symbols.nupkg" 2>/dev/null | sort -V -r | head -1)
        if [ -z "$latest_package" ]; then print_warning "未找到包文件: $project_name"; return 1; fi
        if [ ! -f "$encrypted_dll" ]; then print_warning "未找到加密DLL: $encrypted_dll"; return 1; fi

        local nupkg_before_md5=$(md5 -q "$latest_package" 2>/dev/null || md5sum "$latest_package" 2>/dev/null | awk '{print $1}')
        local nupkg_before_bytes=$(stat -f%z "$latest_package" 2>/dev/null || stat -c%s "$latest_package" 2>/dev/null)
        local enc_bytes=$(stat -f%z "$encrypted_dll" 2>/dev/null || stat -c%s "$encrypted_dll" 2>/dev/null)

        # 自动检测 DLL 在 nupkg 中的实际路径（支持不同 TFM: netstandard2.1/net6.0/net8.0 等）
        local dll_entry=""
        if command -v unzip &>/dev/null; then
            dll_entry=$(unzip -l "$latest_package" 2>/dev/null | grep -o "lib/[^/]*/$(basename "$encrypted_dll")" | head -1)
        fi
        if [ -z "$dll_entry" ] && [[ -n "$WINDIR" || "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
            local _win_pkg
            _win_pkg=$(cygpath -w "$latest_package" 2>/dev/null || echo "$latest_package" | sed 's|^/\([a-zA-Z]\)/|\1:/|' | sed 's|/|\\|g')
            dll_entry=$(powershell.exe -NoProfile -NonInteractive -Command "
                Add-Type -AssemblyName System.IO.Compression.FileSystem
                \$z = [System.IO.Compression.ZipFile]::OpenRead('${_win_pkg}')
                \$e = \$z.Entries | Where-Object { \$_.FullName -like 'lib/*/${project_name}.dll' } | Select-Object -First 1 -ExpandProperty FullName
                \$z.Dispose(); \$e -replace '\\\\','/'
            " 2>/dev/null | tr -d '\r\n')
        fi
        [ -z "$dll_entry" ] && dll_entry="lib/netstandard2.1/${project_name}.dll"

        print_step "替换 $(basename "$latest_package") 中的 ${project_name}.dll（路径: $dll_entry，加密DLL: $((enc_bytes/1024))KB，nupkg替换前: $((nupkg_before_bytes/1024))KB）"

        local abs_pkg
        abs_pkg="$(cd "$(dirname "$latest_package")" && pwd)/$(basename "$latest_package")"

        # 优先用 zip 命令（macOS/Linux/MSYS2-with-zip），否则降级为 PowerShell（Windows）
        local _update_ok=false
        if command -v zip &>/dev/null; then
            local _tmp_dir
            _tmp_dir=$(mktemp -d)
            mkdir -p "$_tmp_dir/$(dirname "$dll_entry")"
            cp "$encrypted_dll" "$_tmp_dir/$dll_entry"
            if (cd "$_tmp_dir" && zip -u "$abs_pkg" "$dll_entry" > /dev/null 2>&1); then
                _update_ok=true
            fi
            rm -rf "$_tmp_dir"
        fi

        if [ "$_update_ok" != true ] && [[ -n "$WINDIR" || "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
            local _win_pkg _win_dll
            _win_pkg=$(cygpath -w "$abs_pkg" 2>/dev/null || echo "$abs_pkg" | sed 's|^/\([a-zA-Z]\)/|\1:/|' | sed 's|/|\\|g')
            _win_dll=$(cygpath -w "$encrypted_dll" 2>/dev/null || echo "$encrypted_dll" | sed 's|^/\([a-zA-Z]\)/|\1:/|' | sed 's|/|\\|g')
            powershell.exe -NoProfile -NonInteractive -Command "
                Add-Type -AssemblyName System.IO.Compression.FileSystem
                \$z = [System.IO.Compression.ZipFile]::Open('${_win_pkg}', 'Update')
                \$z.Entries | Where-Object { (\$_.FullName -replace '\\\\','/') -eq '${dll_entry}' } | ForEach-Object { \$_.Delete() }
                [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(\$z, '${_win_dll}', '${dll_entry}')
                \$z.Dispose()
            " > /dev/null 2>&1 && _update_ok=true
        fi

        if [ "$_update_ok" != true ]; then
            print_warning "替换失败: $project_name"
            return 1
        fi

        local nupkg_after_md5=$(md5 -q "$latest_package" 2>/dev/null || md5sum "$latest_package" 2>/dev/null | awk '{print $1}')
        local nupkg_after_bytes=$(stat -f%z "$latest_package" 2>/dev/null || stat -c%s "$latest_package" 2>/dev/null)
        if [ "$nupkg_before_md5" = "$nupkg_after_md5" ]; then
            print_fail "$(basename "$latest_package") 替换后MD5未变化，替换未生效！"
        fi
        print_success "${project_name}.dll 替换成功（nupkg: $((nupkg_before_bytes/1024))KB → $((nupkg_after_bytes/1024))KB，MD5已变更）"
    }

    _replace_error=0
    for project in "${ENCRYPTED_PROJECTS[@]}"; do
        replace_dll_in_nupkg "$project" || _replace_error=1
    done
    if [ $_replace_error -ne 0 ]; then
        print_fail "NuGet 包 DLL 替换失败"
    fi
    NUPKG_REPLACED=true
fi

# ─── 阶段（条件）: NuGet 推送 ─────────────────────────────
if [ "$PUSH_NUGET" = true ]; then

    # 安全检查：有加密源码但未加密时禁止推送
    if [ "$HAS_ENCRYPT" = true ] && [ "$DLL_ENCRYPTED" != true ]; then
        print_fail "检测到 Microi.net/Microi.AI 源码但 DLL 未加密，禁止推送未加密的 NuGet 包！"
    fi
    if [ "$HAS_ENCRYPT" = true ] && [ "$NUPKG_REPLACED" != true ]; then
        print_fail "NuGet 包中的 DLL 未被替换为加密版本，禁止推送！"
    fi

    # 推送 NuGet 包
    print_phase "推送 NuGet 包"

    _nupkg_files=$(find Microi.Server -path "*/bin/Release/*.$VERSION.nupkg" -not -name "*.symbols.nupkg" 2>/dev/null | sort)
    if [ -z "$_nupkg_files" ]; then
        print_warning "未找到版本 $VERSION 的 .nupkg 文件"
    else
        _push_count=0
        while IFS= read -r _nupkg; do
            print_step "推送: $(basename "$_nupkg")"
            if ! dotnet nuget push "$_nupkg" --api-key "$NUGET_API_KEY" --source "$NUGET_SOURCE" --skip-duplicate; then
                print_fail "NuGet 推送失败: $(basename "$_nupkg")"
            fi
            print_success "$(basename "$_nupkg")"
            ((_push_count++)) || true
        done <<< "$_nupkg_files"
        echo ""
        print_success "共推送 $_push_count 个 NuGet 包"
    fi
fi

# ─── 阶段（条件）: 编译前端 ───────────────────────────────
if [ "$BUILD_CLIENT" = true ]; then
    print_phase "编译前端 Microi.Client"

    print_step "前端受保护构建（现代 Node 堆最高 6GB、legacy 2GB；全机 95% 自动暂停，恢复后继续）..."
    echo ""
    cd Microi.Client
    if ! run_client_build; then
        cd ..
        print_fail "前端编译失败"
    fi
    cd ..
    echo ""
    print_success "前端编译成功"
fi

# ─── 阶段（条件）: 推送 Docker 镜像 ──────────────────────

# 确保 Docker 已启动（Windows 启动 Docker Desktop，macOS 启动 Docker.app）
ensure_docker_running() {
    if docker info > /dev/null 2>&1; then
        return 0
    fi
    print_step "Docker 未运行，尝试自动启动..."

    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || -n "$WINDIR" ]]; then
        # Windows: 查找并启动 Docker Desktop
        local _docker_desktop=""
        for _p in \
            "/c/Program Files/Docker/Docker/Docker Desktop.exe" \
            "/c/Users/$USERNAME/AppData/Local/Docker/Docker Desktop.exe"; do
            [ -f "$_p" ] && _docker_desktop="$_p" && break
        done
        if [ -z "$_docker_desktop" ]; then
            # 用 PowerShell 找安装路径
            _docker_desktop=$(powershell.exe -NoProfile -NonInteractive -Command \
                "Get-ItemProperty 'HKLM:\SOFTWARE\Docker Inc.\Docker Desktop' -Name InstallLocation -ErrorAction SilentlyContinue | Select-Object -ExpandProperty InstallLocation" 2>/dev/null | tr -d '\r\n')
            [ -n "$_docker_desktop" ] && _docker_desktop="${_docker_desktop}\\Docker Desktop.exe"
        fi
        if [ -n "$_docker_desktop" ]; then
            print_info "启动 Docker Desktop: $_docker_desktop"
            "$_docker_desktop" &
        else
            print_warning "未找到 Docker Desktop，请手动启动后重试"
            return 1
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        print_info "启动 Docker.app..."
        open -a Docker
    else
        print_warning "无法自动启动 Docker，请手动启动后重试"
        return 1
    fi

    # 等待 Docker daemon 就绪（最长 60 秒）
    print_step "等待 Docker 启动..."
    local _waited=0
    while ! docker info > /dev/null 2>&1; do
        if [ $_waited -ge 60 ]; then
            print_fail "Docker 启动超时（60秒），请手动启动"
        fi
        sleep 2
        _waited=$((_waited + 2))
        printf "."
    done
    echo ""
    print_success "Docker 已就绪（等待 ${_waited}s）"
}

# Docker 推送函数（内联执行，不依赖外部脚本）
docker_push_plan() {
    local plan="$1"
    local version="$2"
    local plan_name=$(echo "$plan" | cut -d'|' -f1)
    local plan_type=$(echo "$plan" | cut -d'|' -f2)
    local local_image=$(echo "$plan" | cut -d'|' -f3)
    local remote_images=$(echo "$plan" | cut -d'|' -f4)

    print_step "执行方案: $plan_name"

    # 确定构建目录
    local build_dir=""
    if [ "$plan_type" = "api" ]; then
        build_dir="Microi.Server/Microi.net.Api/bin/Release"
    elif [ "$plan_type" = "client" ]; then
        build_dir="Microi.Client/bin/Release"
    fi

    if [ ! -d "$build_dir" ]; then
        print_fail "构建目录不存在: $build_dir"
    fi

    # 登录 Docker 镜像仓库
    print_step "登录 ${DOCKER_REGISTRY}..."
    docker login --username="${DOCKER_USERNAME}" --password="${DOCKER_PASSWORD}" "${DOCKER_REGISTRY}"

    # 清理闲置镜像，释放 Docker VM 磁盘空间（避免 no space left on device）
    print_step "清理闲置 Docker 镜像..."
    docker image prune -a -f --filter "label!=keep" 2>/dev/null || true
    print_info "磁盘使用: $(docker system df --format '镜像: {{.ImagesSize}}' 2>/dev/null || echo '(无法获取)')"

    # 构建镜像（--no-cache 确保 Dockerfile 修改和最新产物都进入新镜像，避免旧缓存层污染）
    print_step "构建镜像: $local_image"
    (cd "$build_dir" && docker build --no-cache -t "$local_image" .)

    # 推送每个远程镜像
    IFS=',' read -ra _images <<< "$remote_images"
    for _img_tag in "${_images[@]}"; do
        # 替换占位符
        _img_tag=$(echo "$_img_tag" | sed "s/{latest}/latest/g" | sed "s/{version}/v${version}/g")
        local full_tag="${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/${_img_tag}"
        # 镜像名可能和本地镜像名不同，需要 tag
        local _remote_name=$(echo "$_img_tag" | cut -d':' -f1)
        local _remote_tag=$(echo "$_img_tag" | cut -d':' -f2)
        docker tag "$local_image" "$full_tag"
        print_step "推送: $full_tag"
        docker push "$full_tag"
    done

    print_success "$plan_name 推送完成"
}

if [ ${#SELECTED_API_PLANS[@]} -gt 0 ] || [ ${#SELECTED_CLIENT_PLANS[@]} -gt 0 ]; then
    print_phase "推送 Docker 镜像"

    # 确保 Docker 已启动
    ensure_docker_running

    # 模式5（跳过编译直接推送）：通过加密指纹文件 + MD5 验证确认 DLL 已加密
    if [ "$DEPLOY_MODE" = "5" ] && [ "$HAS_ENCRYPT" = true ] && [ "$DLL_ENCRYPTED" != true ]; then
        _sig_file="$PUBLISH_DIR/.microi-encrypted"
        if [ -f "$_sig_file" ]; then
            _match=true
            for _proj in "${ENCRYPTED_PROJECTS[@]}"; do
                _dll="$PUBLISH_DIR/${_proj}.dll"
                if [ ! -f "$_dll" ]; then _match=false; break; fi
                _recorded_md5=$(grep "^${_proj}.dll=" "$_sig_file" 2>/dev/null | cut -d'=' -f2)
                _current_md5=$(md5 -q "$_dll" 2>/dev/null || md5sum "$_dll" 2>/dev/null | awk '{print $1}')
                if [ -z "$_recorded_md5" ] || [ "$_recorded_md5" != "$_current_md5" ]; then
                    _match=false; break
                fi
            done
            if [ "$_match" = true ]; then
                DLL_ENCRYPTED=true
                print_info "模式5：已验证加密指纹文件 + DLL MD5，确认为加密版本"
            else
                print_warning "模式5：加密指纹与当前DLL不符（DLL可能已被覆盖），需重新执行加密"
            fi
        else
            print_warning "模式5：未找到加密指纹文件 (.microi-encrypted)，需先运行模式1或2完成加密"
        fi
    fi

    # 安全检查：有加密源码但未加密时禁止推送后端 Docker
    if [ ${#SELECTED_API_PLANS[@]} -gt 0 ] && [ "$HAS_ENCRYPT" = true ] && [ "$DLL_ENCRYPTED" != true ]; then
        print_fail "检测到 Microi.net/Microi.AI 源码但 DLL 未加密，禁止推送未加密的 Docker 镜像！"
    fi

    # 推送后端 Docker
    for _plan in "${SELECTED_API_PLANS[@]}"; do
        docker_push_plan "$_plan" "$VERSION"
    done

    # 推送前端 Docker
    if [ ${#SELECTED_CLIENT_PLANS[@]} -gt 0 ]; then
        print_divider
    fi
    for _plan in "${SELECTED_CLIENT_PLANS[@]}"; do
        docker_push_plan "$_plan" "$VERSION"
    done
fi

# ─── 阶段（条件）: 发布官方网站文档 ──────────────────────
if [ "$PUBLISH_DOC" = true ]; then
    print_phase "发布官方网站文档"

    # 自动检测可用的包管理器（优先 pnpm，其次 npm，最后 yarn）
    DOC_PKG_MGR=""
    if command -v pnpm &>/dev/null; then
        DOC_PKG_MGR="pnpm"
    elif command -v npm &>/dev/null; then
        DOC_PKG_MGR="npm run"
    elif command -v yarn &>/dev/null; then
        DOC_PKG_MGR="yarn"
    else
        print_fail "未找到 pnpm / npm / yarn，请先安装 Node.js: https://nodejs.org"
    fi
    print_info "使用包管理器: ${DOC_PKG_MGR%% *}"

    print_step "安装依赖（如需）..."
    (cd microi.doc && ${DOC_PKG_MGR%% *} install --frozen-lockfile 2>/dev/null || ${DOC_PKG_MGR%% *} install) || true

    print_step "构建 VitePress 文档..."
    (cd microi.doc && $DOC_PKG_MGR docs:build)
    print_success "VitePress 构建完成"

    # 确保 Docker 已启动
    ensure_docker_running

    print_step "构建 Docker 镜像: microi.doc"
    (cd microi.doc/docs/.vitepress && docker build -t microi.doc .)
    print_success "Docker 镜像构建完成"

    print_step "登录 registry.cn-beijing.aliyuncs.com..."
    docker login --username=admin@itdos.com --password=iTdos#docker.publish registry.cn-beijing.aliyuncs.com

    print_step "推送到北京仓库..."
    docker tag microi.doc registry.cn-beijing.aliyuncs.com/itdos/microi.doc:latest
    docker push registry.cn-beijing.aliyuncs.com/itdos/microi.doc:latest
    print_success "registry.cn-beijing.aliyuncs.com/itdos/microi.doc:latest"

    print_step "推送到杭州仓库..."
    docker tag microi.doc registry.cn-hangzhou.aliyuncs.com/microios/microi-doc:latest
    docker push registry.cn-hangzhou.aliyuncs.com/microios/microi-doc:latest
    print_success "registry.cn-hangzhou.aliyuncs.com/microios/microi-doc:latest"

    print_success "官方网站文档发布成功"
fi

# ─── 本地产物路径提示 ─────────────────────────────────────
if [ "$PUBLISH_BACKEND" != true ] && [ "$BUILD_BACKEND" = true ]; then
    echo ""
    print_info "后端仅编译（未执行 dotnet publish），如需产物请选择发布模式"
fi
if [ "$BUILD_CLIENT" = true ] && [ ${#SELECTED_CLIENT_PLANS[@]} -eq 0 ]; then
    echo ""
    echo -e "  ${BOLD}📁 前端产物:${NC} Microi.Client/bin/Release/dist/"
fi
if [ "$PUBLISH_BACKEND" = true ] && [ ${#SELECTED_API_PLANS[@]} -eq 0 ]; then
    echo ""
    echo -e "  ${BOLD}📁 后端产物:${NC} Microi.Server/Microi.net.Api/bin/Release/publish/"
    echo -e "  ${BOLD}💡 启动方式:${NC} cd Microi.Server/Microi.net.Api/bin/Release/publish && dotnet Microi.net.Api.dll"
fi

# ══════════════════════════════════════════════════════════════
# 完成
# ══════════════════════════════════════════════════════════════
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
MINUTES=$((ELAPSED / 60))
SECONDS_REMAIN=$((ELAPSED % 60))

_mode_names_final=(" " "只编译前端和后端" "只发布后端" "只发布前端" "发布前端和后端" "仅推送Docker镜像" "只编译和推送官方网站文档")
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
printf "${BOLD}${GREEN}║${NC}  ${BOLD}${GREEN}🎉 全部完成！%-46s${NC}${BOLD}${GREEN}║${NC}\n" ""
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  发布模式: ${BOLD}${_mode_names_final[$DEPLOY_MODE]}${NC}"
if [ "$BUMP_VERSION" = true ]; then
    echo -e "  版本号:   ${BOLD}${CURRENT_VERSION} → ${GREEN}${VERSION}${NC}"
else
    echo -e "  版本号:   ${BOLD}${CURRENT_VERSION}${NC}（不变）"
fi
if [ "$BUILD_BACKEND" = true ]; then
    echo -e "  后端编译: ${GREEN}✅${NC}"
fi
if [ "$PUBLISH_BACKEND" = true ]; then
    echo -e "  后端发布: ${GREEN}✅${NC}"
fi
if [ "$DLL_ENCRYPTED" = true ]; then
    echo -e "  DLL加密:  ${GREEN}✅${NC}"
fi
if [ "$PUSH_NUGET" = true ]; then
    echo -e "  NuGet:    ${GREEN}✅${NC}"
elif [ "$SKIP_NUGET_REQUESTED" = true ]; then
    echo -e "  NuGet:    ${YELLOW}⏭ 已手动跳过${NC}"
fi
for _p in "${SELECTED_API_PLANS[@]}"; do
    echo -e "  后端Docker: ${GREEN}✅${NC} $(echo "$_p" | cut -d'|' -f1)"
done
if [ "$BUILD_CLIENT" = true ]; then
    echo -e "  前端编译: ${GREEN}✅${NC}"
fi
for _p in "${SELECTED_CLIENT_PLANS[@]}"; do
    echo -e "  前端Docker: ${GREEN}✅${NC} $(echo "$_p" | cut -d'|' -f1)"
done
if [ "$PUBLISH_DOC" = true ]; then
    echo -e "  文档发布: ${GREEN}✅${NC}"
fi
echo -e "  耗时:     ${BOLD}${MINUTES}分${SECONDS_REMAIN}秒${NC}"
echo ""
