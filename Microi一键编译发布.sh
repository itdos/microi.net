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
if exist "D:\Program Files\Git\bin\bash.exe"       if not defined BASH_EXE set "BASH_EXE=D:\Program Files\Git\bin\bash.exe"
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
"!BASH_EXE!" "%~f0" %*
set EC=!ERRORLEVEL!
echo.
pause
exit /b !EC!
:wsl_run
echo.
echo   ^> WSL: 执行中...
echo.
for /f "delims=" %%p in ('wsl wslpath -u "%~f0"') do set "WSLP=%%p"
wsl bash "!WSLP!" %*
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

# macOS 默认没有 GNU timeout；探针仍必须有时限，不能误判健康的 Docker。
run_with_timeout() {
    if command -v timeout >/dev/null 2>&1; then
        timeout "$@"
    elif command -v gtimeout >/dev/null 2>&1; then
        gtimeout "$@"
    else
        node "$PWD/Microi.Server/tools/run-with-timeout.mjs" "$@"
    fi
}

# Microi Agent 使用独立内部 GitLab 仓库；桌面构建不进入平台 Docker/NuGet 发布流程。
# --microi-code 保留为兼容别名，所有桌面入口统一使用官方 DeepSeek 源码装配。
# bash Microi一键编译发布.sh --microi-agent [--win|--mac] [--arm64|--x64]
if [ "${1:-}" = "--microi-agent" ] || [ "${1:-}" = "--microi-code" ]; then
    cd "$(dirname "$0")"
    shift
    if [ ! -f "Microi.Agent/apps/official-desktop/package.json" ]; then
        printf '%s\n' '缺少内部 Microi.Agent 仓库。请从公司 GitLab 克隆；禁止加入根公开仓库。' >&2
        exit 1
    fi
    # 桌面安装包只占 Agent 锁，不占平台 Docker/服务锁；退出只释放本次令牌。
    _agent_owner_pid="${BASHPID:-$$}"
    if [[ "$OSTYPE" == msys* || "$OSTYPE" == cygwin* || -n "$WINDIR" ]]; then
        # MSYS PID 不是 Windows PID；先保存长寿命 shell PID，再读取 ps 的 WINPID，不能取命令替换子 shell 的 process.ppid。
        _agent_owner_pid=$(LC_ALL=C ps -p "$_agent_owner_pid" | awk -v pid="$_agent_owner_pid" 'NR > 1 && $1 == pid {print $4}')
        [[ "$_agent_owner_pid" =~ ^[1-9][0-9]*$ ]] || { printf '%s\n' '无法取得当前 Git Bash 的 Windows 持锁 PID，已停止发布。' >&2; exit 1; }
    fi
    _agent_lock_token=$(node -e 'process.stdout.write(require("node:crypto").randomUUID())')
    node Microi.Server/tools/release-lock.mjs acquire agent "$PWD" "$_agent_owner_pid" "$_agent_lock_token"
    _agent_workspace="$PWD"
    trap 'node "$_agent_workspace/Microi.Server/tools/release-lock.mjs" release agent "$_agent_workspace" "$_agent_owner_pid" "$_agent_lock_token"' EXIT
    case "${1:-}" in
      --mac) bash Microi.Agent/一键打包Mac.sh "${@:2}" ;;
      --win|'')
        command -v powershell.exe >/dev/null 2>&1 || { printf '%s\n' 'Windows 安装包必须在 Windows 本机构建；Mac 请使用 --mac。' >&2; exit 1; }
        powershell.exe -NoProfile -ExecutionPolicy Bypass -File Microi.Agent/一键打包Windows.ps1 "${@:2}"
        ;;
      *) printf '%s\n' 'Microi Agent 仅支持 --win 或 --mac。' >&2; exit 1 ;;
    esac
    exit $?
fi

# 依赖镜像同步不编译/发布平台业务代码；凭据仅由工具读取配置，经 stdin 登录。
if [ "${1:-}" = "--mirror-dependencies" ]; then
    cd "$(dirname "$0")"
    shift
    node Microi.Server/tools/dependency-images.mjs copy "$@"
    exit $?
fi

# 同版本 Docker 热修复只发布经过完整测试的本地候选，不升版、不发布 NuGet，
# 不同步官方数据库资源；与正式发布相同，必须通过平台回归和最终混淆产物冒烟。
MICROI_FULL_ONLY=false
MICROI_COMPLETE_PLATFORM_RELEASE=false
MICROI_REQUESTED_RELEASE_VERSION=""
MICROI_RELEASE_VERSION_EXPLICIT=false
if [ "${1:-}" = "--full-only" ]; then
    MICROI_FULL_ONLY=true
fi
MICROI_DOCKER_ONLY_HOTFIX=false
if [ "${1:-}" = "--docker-only-hotfix" ]; then
    MICROI_DOCKER_ONLY_HOTFIX=true
fi
for _release_argument in "$@"; do
    case "$_release_argument" in
        --full-only) MICROI_FULL_ONLY=true ;;
        --docker-only-hotfix) MICROI_DOCKER_ONLY_HOTFIX=true ;;
        --release-version=*)
            if [ -n "$MICROI_REQUESTED_RELEASE_VERSION" ]; then
                echo "--release-version 只能指定一次，不能合并多个发布版本。" >&2; exit 1
            fi
            MICROI_REQUESTED_RELEASE_VERSION="${_release_argument#--release-version=}"
            if [[ ! "$MICROI_REQUESTED_RELEASE_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                echo "--release-version 必须为三段数字，例如 --release-version=8.6.8。" >&2; exit 1
            fi
            ;;
        --release-version)
            echo "请使用 --release-version=<x.y.z> 明确指定已核验候选的版本。" >&2; exit 1 ;;
    esac
    if [ "$_release_argument" = "--platform-release" ]; then
        MICROI_COMPLETE_PLATFORM_RELEASE=true
    fi
    if [ "$_release_argument" = "--skip-tests" ]; then
        echo "--skip-tests 已停用；正式发布及 Docker 热修复都必须通过冻结候选的平台自动化测试。" >&2
        exit 1
    fi
done
if [ "$MICROI_COMPLETE_PLATFORM_RELEASE" = true ] && { [ "$MICROI_FULL_ONLY" = true ] || [ "$MICROI_DOCKER_ONLY_HOTFIX" = true ]; }; then
    echo "完整平台正式发布不能与 --full-only 或 --docker-only-hotfix 混用。" >&2
    exit 1
fi
if [ -n "$MICROI_REQUESTED_RELEASE_VERSION" ] && { [ "$MICROI_FULL_ONLY" = true ] || [ "$MICROI_DOCKER_ONLY_HOTFIX" = true ]; }; then
    echo "--release-version 不能与不升版的 Full 或 Docker 热修复入口混用。" >&2
    exit 1
fi
# 平台发行与独立桌面产品、深度业务测试分开；只有显式 --full-only 才运行 Full。
# 不继承历史进程的策略，禁止通过环境变量跳过测试。
export MICROI_RELEASE_TEST_POLICY=PlatformRelease
if [ "$MICROI_FULL_ONLY" = true ]; then
    export MICROI_RELEASE_TEST_POLICY=Full
fi

# 从交互选项完成开始计时，所有重任务共用同一个 30 分钟目标；超过目标仍继续发布。
# 保留 DEADLINE 变量名兼容时序回执，但它仅用于衡量耗时，不能中止命令或改写真实退出码。
MICROI_RELEASE_DEADLINE=""
MICROI_RELEASE_PHASE=""
MICROI_RELEASE_BUDGET_TOOL=""
MICROI_RELEASE_TARGET_WARNED=false
check_release_budget() {
    if [ -n "$MICROI_RELEASE_DEADLINE" ] && [ "$(date +%s)" -gt "$MICROI_RELEASE_DEADLINE" ] && [ "$MICROI_RELEASE_TARGET_WARNED" != true ]; then
        echo "平台发布已超过 30 分钟耗时目标，记录未达标并继续发布；真实错误和单项超时仍会阻止失败步骤。" >&2
        MICROI_RELEASE_TARGET_WARNED=true
    fi
    return 0
}
run_release_command() {
    if [ -n "$MICROI_RELEASE_DEADLINE" ]; then
        check_release_budget
        node "$MICROI_RELEASE_BUDGET_TOOL" run-target "$MICROI_RELEASE_DEADLINE" "$@"
    else
        "$@"
    fi
}

# Windows (Git Bash) 下：正常结束时暂停便于查看结果；关闭窗口/Ctrl+C 时立即清理，不再卡在 read。
MICROI_SKIP_EXIT_PAUSE=false
MICROI_ACTIVE_BUILD_PID=""
MICROI_ACTIVE_GUARD_PID_FILE=""
MICROI_RELEASE_LOCK_HELD=false
MICROI_RELEASE_LOCK_DIR=""
MICROI_RELEASE_SCRATCH=""
MICROI_RELEASE_SCRATCH_TOOL="$PWD/Microi.Server/tools/release-scratch.mjs"

# 只清理本进程新建并登记的 scratch；不扫描共享 .tmp，也不清空发布报告。
cleanup_release_scratch() {
    [ -z "$MICROI_RELEASE_SCRATCH" ] && return 0
    node "$MICROI_RELEASE_SCRATCH_TOOL" cleanup "$MICROI_RELEASE_SCRATCH"
}

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

release_workspace_lock() {
    [ "$MICROI_RELEASE_LOCK_HELD" != true ] && return 0
    local _domain _failed=false
    for _domain in "${MICROI_RELEASE_LOCK_DOMAINS[@]}"; do
        node "$MICROI_RELEASE_WORKSPACE/Microi.Server/tools/release-lock.mjs" release "$_domain" "$MICROI_RELEASE_WORKSPACE" "$MICROI_RELEASE_OWNER_PID" "$MICROI_RELEASE_LOCK_TOKEN" || _failed=true
    done
    [ "$_failed" = false ] || return 1
    MICROI_RELEASE_LOCK_DOMAINS=()
    MICROI_RELEASE_LOCK_HELD=false
}

acquire_workspace_lock() {
    MICROI_RELEASE_WORKSPACE="$PWD"
    MICROI_RELEASE_OWNER_PID="${BASHPID:-$$}"
    if [[ "$OSTYPE" == msys* || "$OSTYPE" == cygwin* || -n "$WINDIR" ]]; then
        MICROI_RELEASE_OWNER_PID=$(LC_ALL=C ps -p "$MICROI_RELEASE_OWNER_PID" | awk -v pid="$MICROI_RELEASE_OWNER_PID" 'NR > 1 && $1 == pid {print $4}')
        [[ "$MICROI_RELEASE_OWNER_PID" =~ ^[1-9][0-9]*$ ]] || { print_fail '无法取得当前 Git Bash 的 Windows 持锁 PID，已停止发布。'; return 1; }
    fi
    MICROI_RELEASE_LOCK_TOKEN=$(node -e 'process.stdout.write(require("node:crypto").randomUUID())')
    MICROI_RELEASE_LOCK_DOMAINS=()
    local _requested=() _domain
    if [ "$BUILD_BACKEND" = true ] || [ ${#SELECTED_API_PLANS[@]} -gt 0 ]; then _requested+=(api); fi
    if [ "$BUILD_CLIENT" = true ] || [ ${#SELECTED_CLIENT_PLANS[@]} -gt 0 ]; then _requested+=(pc); fi
    if [ "$PUBLISH_DOC" = true ]; then _requested+=(website); fi
    # Full-only 同时验收 PC/API；普通单项发布仅持有自身范围。
    if [ "$MICROI_FULL_ONLY" = true ]; then _requested=(api pc); fi
    MICROI_RELEASE_LOCK_HELD=true
    for _domain in "${_requested[@]}"; do
        if ! node "$PWD/Microi.Server/tools/release-lock.mjs" acquire "$_domain" "$PWD" "$MICROI_RELEASE_OWNER_PID" "$MICROI_RELEASE_LOCK_TOKEN"; then
            release_workspace_lock || return 1
            print_fail "$_domain 发布锁被占用，已释放本次取得的锁并停止发布。"
            return 1
        fi
        MICROI_RELEASE_LOCK_DOMAINS+=("$_domain")
    done
    export MICROI_RELEASE_LOCK_TOKEN
    print_info "已取得发布锁：${MICROI_RELEASE_LOCK_DOMAINS[*]}；API、PC、官网、Agent 各自独立，同类发布互斥。"
}

prepare_release_workspace() {
    if ! is_windows_shell; then
        print_info "非 Windows 环境无需处理 DLL 文件锁；所选发布范围的互斥锁仍然生效。"
        return 0
    fi

    local _powershell_cmd=""
    if command -v powershell.exe >/dev/null 2>&1; then
        _powershell_cmd="powershell.exe"
    elif command -v pwsh.exe >/dev/null 2>&1; then
        _powershell_cmd="pwsh.exe"
    else
        echo "未找到 PowerShell，无法安全识别并清理当前工作区的本地开发进程。" >&2
        return 1
    fi

    local _manager_script="$PWD/Microi.Server/tools/Microi.LocalProcessManager.ps1"
    if [ ! -f "$_manager_script" ]; then
        echo "未找到进程管理器: $_manager_script" >&2
        return 1
    fi

    local _manager_windows_path="$_manager_script"
    local _workspace_windows_path="$PWD"
    if command -v cygpath >/dev/null 2>&1; then
        _manager_windows_path=$(cygpath -w "$_manager_script")
        _workspace_windows_path=$(cygpath -w "$PWD")
    fi

    local _scope=all
    if [ "$BUILD_BACKEND" = true ] && [ "$BUILD_CLIENT" != true ]; then _scope=api; fi
    if [ "$BUILD_CLIENT" = true ] && [ "$BUILD_BACKEND" != true ]; then _scope=pc; fi
    run_release_command "$_powershell_cmd" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass \
        -File "$_manager_windows_path" \
        -Action PrepareRelease -ReleaseScope "$_scope" \
        -WorkspaceRoot "$_workspace_windows_path" \
        -BackendPort "${MICROI_RELEASE_BACKEND_PORT:-61501}" \
        -FrontendPort "${MICROI_RELEASE_FRONTEND_PORT:-61500}" </dev/null
}

handle_session_interrupt() {
    local _signal="${1:-TERM}"
    MICROI_SKIP_EXIT_PAUSE=true
    stop_active_client_build
    trap - INT TERM HUP
    [ "$_signal" = "INT" ] && exit 130
    exit 143
}

finish_windows_session() {
    local _exit_code=$?
    trap - EXIT
    stop_active_client_build
    if ! cleanup_release_scratch; then
        echo "临时文件清理未完成，已保留路径及错误回执：$MICROI_RELEASE_SCRATCH" >&2
        [ "$_exit_code" -ne 0 ] || _exit_code=1
    fi
    release_workspace_lock
    if [ -n "$MICROI_RELEASE_DEADLINE" ]; then
        check_release_budget
        node "$MICROI_RELEASE_BUDGET_TOOL" record "$MICROI_RELEASE_TIMING_FILE" "$START_TIME" "${MICROI_RELEASE_PHASE:-结束}" "$_exit_code" || { [ "$_exit_code" -ne 0 ] || _exit_code=1; }
    fi
    if is_windows_shell && [ "$MICROI_SKIP_EXIT_PAUSE" != true ] && [ -t 0 ]; then
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
else
    trap finish_windows_session EXIT
    trap 'handle_session_interrupt INT' INT
    trap 'handle_session_interrupt TERM' TERM
    trap 'handle_session_interrupt HUP' HUP
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
    "前端镜像-正式和测试|client|microi-web|microi-web:{latest},microi-web:{version},microi-client:{latest},microi-client:{version},microi-web-dev:{latest},microi-web-dev:{version},microi-client-dev:{latest},microi-client-dev:{version}"
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
MICROI_RELEASE_BUDGET_TOOL="$PWD/Microi.Server/tools/release-budget.mjs"
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
    check_release_budget
    if [ -n "$MICROI_RELEASE_DEADLINE" ] && [ -n "$MICROI_RELEASE_PHASE" ]; then
        node "$MICROI_RELEASE_BUDGET_TOOL" record "$MICROI_RELEASE_TIMING_FILE" "$START_TIME" "$MICROI_RELEASE_PHASE" 0
    fi
    MICROI_RELEASE_PHASE="$1"
    PHASE_NUM=$((PHASE_NUM + 1))
    echo ""
    echo -e "${BOLD}${CYAN}┌──────────────────────────────────────────────────────────────┐${NC}"
    printf "${BOLD}${CYAN}│${NC}  ${BOLD}阶段 %d: %-54s${NC}${BOLD}${CYAN}│${NC}\n" "$PHASE_NUM" "$1"
    echo -e "${BOLD}${CYAN}└──────────────────────────────────────────────────────────────┘${NC}"
    echo ""
}

print_step() {
    check_release_budget
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
    check_release_budget
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

# 发布进程专用输出目录。空间紧张时可指向其它盘的绝对路径；不进入生产 API 配置。
# 默认目录保持兼容，所有候选、Full 结果和制品回执必须位于同一位置。
MICROI_RELEASE_GATE_DIR="${MICROI_RELEASE_GATE_DIR:-$PWD/.tmp/microi-release-gate}"
if is_windows_shell && [[ "$MICROI_RELEASE_GATE_DIR" =~ ^[A-Za-z]:[\\/] ]]; then
    command -v cygpath >/dev/null 2>&1 || print_fail "无法转换 Windows 发布结果目录；请使用 Git Bash 绝对路径。"
    MICROI_RELEASE_GATE_DIR=$(cygpath -u "$MICROI_RELEASE_GATE_DIR")
fi
case "$MICROI_RELEASE_GATE_DIR" in
    /|/[A-Za-z]|/[A-Za-z]/) print_fail "发布结果目录不能是文件系统或盘符根目录。" ;;
    /*) ;;
    *) print_fail "MICROI_RELEASE_GATE_DIR 必须是绝对路径。" ;;
esac
if ! mkdir -p "$MICROI_RELEASE_GATE_DIR"; then
    print_fail "无法创建发布结果目录。"
fi
MICROI_RELEASE_GATE_DIR=$(cd "$MICROI_RELEASE_GATE_DIR" && pwd -P)
if [ "$MICROI_RELEASE_GATE_DIR" = / ] || [[ "$MICROI_RELEASE_GATE_DIR" =~ ^/[A-Za-z]$ ]]; then
    print_fail "发布结果目录不能是文件系统或盘符根目录。"
fi
export MICROI_RELEASE_GATE_DIR

MICROI_RELEASE_SCRATCH=$(node "$MICROI_RELEASE_SCRATCH_TOOL" create "$MICROI_RELEASE_GATE_DIR")
# Node 返回 Windows 原生路径；只在 shell 文件操作前转成 Git Bash 路径。
if is_windows_shell; then
    MICROI_RELEASE_SCRATCH=$(cygpath -u "$MICROI_RELEASE_SCRATCH")
fi

# 直接启动前端构建守护器，避免 Git Bash + nvm-windows 的 npm POSIX 包装器
# 在异常关闭时留下多层 bash/npm 残留进程。
# Interrupted runs may leave an owner-verified stale lock. Recover it before
# any temporary test service is started by a release wrapper.
if [ "${1:-}" = "--recover-stale-lock" ]; then
    acquire_workspace_lock
    release_workspace_lock
    print_success "已核验并释放本工作区的过期发布锁"
    exit 0
fi

run_client_build() {
    local _node_cmd="node"
    local _build_args=()
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

    if [ "${BUILD_CLIENT_LEGACY:-false}" = true ]; then
        _build_args+=(--with-legacy)
    fi

    MICROI_ACTIVE_GUARD_PID_FILE="$PWD/.tmp/build-logs/guard.pid"
    rm -f "$MICROI_ACTIVE_GUARD_PID_FILE"
    # Bash 非交互脚本会默认把后台命令的 stdin 指向 /dev/null；显式继承当前 stdin，
    # 让构建守护器在内存等待期间可以读取 s/skip 指令。CI 等非终端场景仍保持自动等待。
    if [ -t 0 ]; then
        MICROI_BUILD_INTERACTIVE=1 run_release_command "$_node_cmd" scripts/build-with-memory-guard.mjs "${_build_args[@]}" <&0 &
    else
        run_release_command "$_node_cmd" scripts/build-with-memory-guard.mjs "${_build_args[@]}" &
    fi
    MICROI_ACTIVE_BUILD_PID=$!

    local _exit_code=0
    wait "$MICROI_ACTIVE_BUILD_PID" || _exit_code=$?
    MICROI_ACTIVE_BUILD_PID=""
    rm -f "$MICROI_ACTIVE_GUARD_PID_FILE"
    return "$_exit_code"
}

# 在版本号和其它源码被修改前先检查前端构建资源。资源不足时快速失败，
# 避免后端已编译/发布后才长时间等待内存恢复。
run_client_preflight() {
    local _node_cmd="node"
    local _preflight_args=(--preflight-only)
    if is_windows_shell && command -v node.exe >/dev/null 2>&1; then
        _node_cmd="node.exe"
    fi
    if ! command -v "$_node_cmd" >/dev/null 2>&1; then
        echo "未找到 Node.js：$_node_cmd" >&2
        return 127
    fi
    if [ "${BUILD_CLIENT_LEGACY:-false}" = true ]; then
        _preflight_args+=(--with-legacy)
    fi
    (
        cd Microi.Client
        "$_node_cmd" scripts/build-with-memory-guard.mjs "${_preflight_args[@]}"
    )
}

# publish 是唯一后端镜像输入。日志/spool 属于节点运行态，PDB 属于调试符号，
# 两者都不能进入正式发布目录。只允许清理固定的 publish 目录，避免误删源码日志。
cleanup_publish_artifacts() {
    local target_dir="$1"
    if [ ! -d "$target_dir" ]; then
        print_fail "发布目录不存在，拒绝清理: $target_dir"
    fi

    local resolved_target expected_target
    resolved_target=$(cd "$target_dir" && pwd -P)
    expected_target=$(cd "Microi.Server/Microi.net.Api/bin/Release/publish" && pwd -P)
    if [ "$resolved_target" != "$expected_target" ]; then
        print_fail "发布目录越界，拒绝清理: $resolved_target"
    fi

    local pdb_count=0
    pdb_count=$(find "$target_dir" -type f -iname '*.pdb' 2>/dev/null | wc -l | tr -d '[:space:]')
    rm -rf "$target_dir/logs"
    find "$target_dir" -type f -iname '*.pdb' -delete
    print_info "发布产物清理完成：logs 已移除，PDB 已移除 ${pdb_count:-0} 个"
}

validate_publish_artifacts() {
    local target_dir="$1"
    for required_file in Microi.net.Api.dll Microi.net.Api.deps.json Microi.net.Api.runtimeconfig.json; do
        if [ ! -f "$target_dir/$required_file" ]; then
            print_fail "发布产物缺少必需文件: $required_file"
        fi
    done
    if [ -d "$target_dir/logs" ]; then
        print_fail "发布产物仍包含运行态 logs 目录"
    fi
    if find "$target_dir" -type f -iname '*.pdb' -print -quit | grep -q .; then
        print_fail "发布产物仍包含 PDB 调试符号"
    fi
    print_info "发布产物守卫通过：必需运行文件完整，logs/PDB 均为 0"
}

# 保留原文件换行字节；GNU sed -i 在 Git Bash 中会把 CRLF 改成 LF，
# 即使版本号相同也会使刚通过 Full 的候选摘要失效。
sed_inplace() {
    node - "$1" "$2" <<'MICROI_PRESERVE_VERSION_EOL'
const fs = require('node:fs');
const [expression, file] = process.argv.slice(2);
const before = fs.readFileSync(file);

function readPart(source, start, delimiter) {
  let value = '';
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === '\\' && source[index + 1] === delimiter) {
      value += delimiter;
      index += 1;
      continue;
    }
    if (char === delimiter) return { value, next: index + 1 };
    value += char;
  }
  throw new Error(`unterminated sed expression: ${source}`);
}

if (!expression.startsWith('s') || expression.length < 4) {
  throw new Error(`unsupported sed expression: ${expression}`);
}
const delimiter = expression[1];
const patternPart = readPart(expression, 2, delimiter);
const replacementPart = readPart(expression, patternPart.next, delimiter);
const flags = expression.slice(replacementPart.next);
if (!/^g?$/.test(flags)) throw new Error(`unsupported sed flags: ${flags}`);

const text = before.toString('utf8');
const afterText = text.replace(new RegExp(patternPart.value, flags.includes('g') ? 'g' : ''), replacementPart.value);
const after = Buffer.from(afterText, 'utf8');
if (!before.equals(after)) fs.writeFileSync(file, after);
MICROI_PRESERVE_VERSION_EOL
}

# 读取 JSON 标量，兼容嵌套 AppSettings、数字端口、转义字符和 UTF-8 BOM。
json_value() {
    node - "$1" "$2" <<'MICROI_JSON_VALUE'
const fs = require('node:fs');
const [key, filename] = process.argv.slice(2);
if (!fs.existsSync(filename)) process.exit(0);
const value = JSON.parse(fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, ''));
function find(node) {
    if (!node || typeof node !== 'object') return undefined;
    for (const [name, child] of Object.entries(node)) {
        if (name === key) return child;
        const nested = find(child);
        if (nested !== undefined) return nested;
    }
}
const result = find(value);
if (result !== undefined && result !== null && typeof result !== 'object') process.stdout.write(String(result));
MICROI_JSON_VALUE
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
ENCRYPTED_PROJECTS=("Microi.net" "Microi.AI" "Microi.MCP" "Microi.WorkFlow" "Microi.Vision")
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
if [ -f "$CONFIG_FILE" ]; then
    # 私有密钥仅在受信任的 Node 上传进程中读取；shell 不持有、也不作为子进程参数。
    if node Microi.Server/tools/secure-nuget-push.mjs probe "$CONFIG_FILE" >/dev/null; then
        HAS_NUGET=true
        print_success "NuGet 配置: 已校验（私有密钥由安全推送进程读取）"
    else
        print_info "NuGet 配置: 不可用，跳过 NuGet 推送"
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
MICROI_ENCRYPTION_RECEIPT="$MICROI_RELEASE_GATE_DIR/api-encryption.json"
# 闭源源码存在时只能进入完整加密链，缺项目或缺工具都不是开源模式。
# 在任何编译/上传之前失败，避免 HAS_ENCRYPT=false 让后续门禁失效。
_closed_source_count=0
for _closed_project in "${ENCRYPTED_PROJECTS[@]}"; do
    if [ -f "Microi.Server/${_closed_project}/${_closed_project}.csproj" ]; then
        _closed_source_count=$((_closed_source_count + 1))
    fi
done
if [ "$_closed_source_count" -gt 0 ]; then
    if [ "$_closed_source_count" -ne "${#ENCRYPTED_PROJECTS[@]}" ]; then
        print_fail "闭源源码不完整；五个闭源项目必须全部存在并统一加密，禁止降级为无需加密发布。"
    fi
    if [ ! -f "$ENCRYPT_SCRIPT" ]; then
        print_fail "闭源源码存在但加密脚本缺失: $ENCRYPT_SCRIPT；禁止发布 NuGet 或后端 Docker。"
    fi
    HAS_ENCRYPT=true
    print_success "DLL 加密: 可用（检测到 Microi.net + Microi.AI + Microi.MCP + Microi.WorkFlow + Microi.Vision 源码）"
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

HEAD_VERSION=""
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    HEAD_VERSION=$(git show HEAD:Microi.Server/Directory.Build.props 2>/dev/null \
        | grep -o '<MicroiNetVersion>[0-9]*\.[0-9]*\.[0-9]*</MicroiNetVersion>' \
        | grep -o '[0-9]*\.[0-9]*\.[0-9]*' \
        | head -1 || true)
fi

# 局部入口保留历史版本建议。dirty 版本不能证明是同一未完成候选：
# 新完整发布始终从当前版本递增；只有明确指定版本才用于已核验候选的续发。
REUSE_CURRENT_VERSION=false
DEFAULT_INCREMENTED_VERSION=$(auto_increment_version "$CURRENT_VERSION")
if [ "$MICROI_COMPLETE_PLATFORM_RELEASE" != true ] && [ -n "$HEAD_VERSION" ] && [ "$HEAD_VERSION" != "$CURRENT_VERSION" ]; then
    NEXT_VERSION="$CURRENT_VERSION"
    REUSE_CURRENT_VERSION=true
else
    NEXT_VERSION="$DEFAULT_INCREMENTED_VERSION"
fi
echo -e "  当前版本: ${BOLD}${CURRENT_VERSION}${NC}"
if [ "$REUSE_CURRENT_VERSION" = true ]; then
    echo -e "  局部入口默认版本: ${BOLD}${GREEN}${NEXT_VERSION}${NC}（HEAD=${HEAD_VERSION}；完整发布默认使用 ${DEFAULT_INCREMENTED_VERSION}）"
else
    echo -e "  默认版本: ${BOLD}${GREEN}${NEXT_VERSION}${NC}（自动递增）"
fi

echo ""
if [ "$MICROI_FULL_ONLY" = true ]; then
    _version_input="$CURRENT_VERSION"
elif [ -n "$MICROI_REQUESTED_RELEASE_VERSION" ]; then
    _version_input="$MICROI_REQUESTED_RELEASE_VERSION"
elif [ "$MICROI_COMPLETE_PLATFORM_RELEASE" = true ]; then
    _version_input=""
else
    read -r -p "  是否手动指定版本号？直接回车使用默认版本 ${NEXT_VERSION}: " _version_input
fi
if [ -n "$_version_input" ]; then
    if [[ ! "$_version_input" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        print_fail "版本号格式无效: $_version_input（请输入三段数字，例如 6.4.3）"
    fi
    NEXT_VERSION="$_version_input"
    MICROI_RELEASE_VERSION_EXPLICIT=true
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

# --- 发布模式：完整正式发布为默认，局部入口保留 ---
echo -e "  ${BOLD}【发布模式】${NC}"
echo "    8) 完整正式发布（默认：版本+1、NuGet、API/PC Docker、官方网站）"
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
    if [ "$MICROI_FULL_ONLY" = true ]; then
        DEPLOY_MODE=7
    elif [ "$MICROI_COMPLETE_PLATFORM_RELEASE" = true ]; then
        DEPLOY_MODE=8
    else
        read -r -p "  请输入选项 [1/2/3/4/5/6/8，直接回车=8]: " DEPLOY_MODE
        DEPLOY_MODE="${DEPLOY_MODE:-8}"
    fi
    case "$DEPLOY_MODE" in
        1|2|3|4|5|6) ;;
        7) [ "$MICROI_FULL_ONLY" = true ] || print_fail "Full 专用入口必须显式使用 --full-only" ;;
        8) MICROI_COMPLETE_PLATFORM_RELEASE=true ;;
        *) print_fail "无效选项: $DEPLOY_MODE（仅支持 1/2/3/4/5/6/8）" ;;
    esac

    # 完整指全部正式渠道；缺配置不能静默降为只编译或部分发布。
    if [ "$MICROI_COMPLETE_PLATFORM_RELEASE" = true ]; then
        if [ "$MICROI_RELEASE_VERSION_EXPLICIT" != true ]; then
            NEXT_VERSION="$DEFAULT_INCREMENTED_VERSION"
            REUSE_CURRENT_VERSION=false
        fi
        [ "$HAS_CLIENT" = true ] || print_fail "完整正式发布需要 Microi.Client 源码；仅发布后端请显式选择模式2。"
        [ "$HAS_NUGET" = true ] || print_fail "完整正式发布缺少有效 NuGet 配置，不能跳过 NuGet。"
        [ "$HAS_DOCKER" = true ] || print_fail "完整正式发布缺少有效 Docker 配置。"
        [ -f "microi.doc/package.json" ] || print_fail "完整正式发布缺少官方网站源码。"
    fi

    # 模式3需要前端源码
    if [ "$DEPLOY_MODE" = "3" ] && [ "$HAS_CLIENT" != true ]; then
        print_fail "未找到 Microi.Client 目录，无法发布前端"
    fi

# --- 根据模式设置执行标志 ---
BUMP_VERSION=false      # 是否更新版本号
BUILD_BACKEND=false     # 是否编译后端（dotnet build）
BUILD_CLIENT=false      # 是否编译前端（npm run build）
BUILD_CLIENT_LEGACY=false # 是否额外生成 Chrome 49 legacy 产物
CLIENT_BUILD_OUTPUT_LABEL="现代版"
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
    4|8)  # 完整入口复用前后端链路，官网在同一轮后续执行，不再次升版。
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
if [ "$PUSH_NUGET" = true ] && [ "$MICROI_COMPLETE_PLATFORM_RELEASE" != true ]; then
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

if [ "$MICROI_COMPLETE_PLATFORM_RELEASE" = true ]; then
    # 正式版本标签是渠道身份，不能把仅测试方案当作 API/PC 正式发布；沿用同一方案的全部别名。
    for plan in "${DOCKER_PLANS[@]}"; do
        _type=$(echo "$plan" | cut -d'|' -f2)
        _targets=$(echo "$plan" | cut -d'|' -f4)
        case "$_type|,$_targets," in
            'api|'*',microi-api:{version},'*) SELECTED_API_PLANS+=("$plan") ;;
            'client|'*',microi-client:{version},'*) SELECTED_CLIENT_PLANS+=("$plan") ;;
        esac
    done
    [ ${#SELECTED_API_PLANS[@]} -eq 1 ] && [ ${#SELECTED_CLIENT_PLANS[@]} -eq 1 ] || print_fail "完整正式发布必须唯一匹配 API/PC 正式版本镜像方案；请检查 Docker 方案配置。"
elif [ "$PUSH_DOCKER" = true ] && [ "$HAS_DOCKER" = true ] && [ ${#DOCKER_PLANS[@]} -gt 0 ]; then
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
if [ "$DEPLOY_MODE" = "6" ] || [ "$MICROI_COMPLETE_PLATFORM_RELEASE" = true ]; then
    PUBLISH_DOC=true
elif [ "$MICROI_FULL_ONLY" != true ] && [ -d "microi.doc" ]; then
    echo ""
    echo -e "  ${BOLD}【官方网站文档】${NC}"
    echo "    是否同时发布官方网站文档（构建 VitePress 并推送 Docker 镜像）？"
    read -p "  请输入选项 [0=否/1=是]: " _doc_choice
    case "$_doc_choice" in
        1) PUBLISH_DOC=true ;;
        *) PUBLISH_DOC=false ;;
    esac
fi
# 同轮包含官网时纳入同一个候选；独立官网模式仍复用原有官网内容/提交门禁。
export MICROI_RELEASE_INCLUDE_DOCUMENTATION="$PUBLISH_DOC"

# --- Chrome 49 兼容产物（仅前端构建时询问；默认不生成）---
if [ "$BUILD_CLIENT" = true ]; then
    case "${MICROI_BUILD_CHROME49_LEGACY:-}" in
        1|true|TRUE|True|yes|YES|Yes|on|ON|On)
            BUILD_CLIENT_LEGACY=true
            print_info "已通过 MICROI_BUILD_CHROME49_LEGACY 启用 Chrome 49 legacy 产物"
            ;;
        0|false|FALSE|False|no|NO|No|off|OFF|Off)
            BUILD_CLIENT_LEGACY=false
            print_info "已通过 MICROI_BUILD_CHROME49_LEGACY 使用仅现代版产物"
            ;;
        "")
            echo ""
            echo -e "  ${BOLD}【旧浏览器兼容】${NC}"
            echo "    默认仅生成现代版；只有明确仍需 Chrome 49 的客户环境才启用 legacy。"
            echo "    0) 仅现代版（默认，推荐）"
            echo "    1) 现代版 + Chrome 49 legacy（显著延长构建）"
            if [ "$MICROI_COMPLETE_PLATFORM_RELEASE" = true ]; then
                _legacy_choice=0
            else
                read -r -p "  请输入选项 [0/1，直接回车=0]: " _legacy_choice || _legacy_choice=""
            fi
            case "$_legacy_choice" in
                0|"") BUILD_CLIENT_LEGACY=false ;;
                1) BUILD_CLIENT_LEGACY=true ;;
                *) print_fail "无效选项: $_legacy_choice（仅支持 0/1）" ;;
            esac
            ;;
        *)
            print_fail "MICROI_BUILD_CHROME49_LEGACY 仅支持 true/false 或 1/0"
            ;;
    esac

    if [ "$BUILD_CLIENT_LEGACY" = true ]; then
        CLIENT_BUILD_OUTPUT_LABEL="现代版 + Chrome 49 legacy"
    fi
fi

# ──────────────────────────────────────────────────────────────
# 打印执行摘要
# ──────────────────────────────────────────────────────────────
if [ "$MICROI_DOCKER_ONLY_HOTFIX" = true ]; then
    if [ "$PUBLISH_BACKEND" != true ] || [ ${#SELECTED_API_PLANS[@]} -eq 0 ] || [ "$PUBLISH_DOC" = true ]; then
        print_fail "Docker 热修复必须选择后端镜像发布，且不能包含官网文档发布。"
    fi
    VERSION="$CURRENT_VERSION"
    BUMP_VERSION=false
    PUSH_NUGET=false
    SKIP_NUGET_REQUESTED=true
    print_info "同版本 Docker 热修复：版本保持 ${VERSION}，只发布 Docker，不写官方应用源。"
fi
_mode_names=(" " "只编译前端和后端" "只发布后端" "只发布前端" "发布前端和后端" "仅推送Docker镜像" "只编译和推送官方网站文档" "只执行完整 Full（不构建发行物、不上传）" "完整正式发布：NuGet + API/PC Docker + 官网")
echo ""
echo -e "  ${BOLD}════════════════════════════════════════════════════════${NC}"
echo -e "  ${BOLD}✅ 选择完毕，即将开始全自动执行${NC}"
echo -e "  ${BOLD}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  发布模式: ${BOLD}${_mode_names[$DEPLOY_MODE]}${NC}"
if [ "$MICROI_COMPLETE_PLATFORM_RELEASE" = true ]; then
    print_info "默认验收：常规 Microi.Tests + 全部通用前端测试 + 接口检查 + 程序启动运行与冒烟。"
    print_info "本次不适用：真实付费 AI、JUNCHI/XJY 客户数据、SQL Server 专项；这些范围保留独立显式入口。"
fi
if [ "$BUMP_VERSION" = true ]; then
    if [ "$CURRENT_VERSION" = "$VERSION" ]; then
        echo -e "  版本号:   ${BOLD}${GREEN}${VERSION}${NC}（继续当前未提交版本）"
    else
        echo -e "  版本号:   ${BOLD}${CURRENT_VERSION} → ${GREEN}${VERSION}${NC}"
    fi
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
    echo -e "  前端编译: ${GREEN}✔${NC}（${CLIENT_BUILD_OUTPUT_LABEL}）"
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
START_TIME=$(date +%s)
if [ "$MICROI_FULL_ONLY" != true ]; then
    MICROI_RELEASE_DEADLINE=$((START_TIME + 1800))
    MICROI_RELEASE_TIMING_FILE="$MICROI_RELEASE_GATE_DIR/release-timing-${START_TIME}-$$.jsonl"
    if is_windows_shell; then MICROI_RELEASE_TIMING_FILE=$(cygpath -m "$MICROI_RELEASE_TIMING_FILE"); fi
    print_info "普通发布耗时目标 30 分钟；超过后告警并继续，阶段耗时记录: $MICROI_RELEASE_TIMING_FILE"
fi

# 按所选产品取得锁；Full 构建使用本次结果目录隔离，服务保持运行供业务回归。
PLATFORM_DOCKER_SELECTED=false
if [ ${#SELECTED_API_PLANS[@]} -gt 0 ] || [ ${#SELECTED_CLIENT_PLANS[@]} -gt 0 ]; then
    PLATFORM_DOCKER_SELECTED=true
fi
if [ "$MICROI_FULL_ONLY" = true ] || [ "$BUILD_BACKEND" = true ] || [ "$BUILD_CLIENT" = true ] || [ "$PUBLISH_DOC" = true ] || [ "$PLATFORM_DOCKER_SELECTED" = true ]; then
    print_phase "取得所选范围发布独占权"
    acquire_workspace_lock
fi

# 合并发布先验证官网已有门禁，避免平台渠道已上传才发现官网源码尚未成为可发布候选。
if [ "$PUBLISH_DOC" = true ]; then
    print_step "预检官方网站候选..."
    run_release_command node microi.doc/scripts/check-account-portal.mjs --require-committed
fi

# 前端资源预检必须发生在版本号、升级资源和其它源码变更之前。
if [ "$BUILD_CLIENT" = true ]; then
    print_phase "发布前资源预检"
    print_step "检查前端构建所需内存（${CLIENT_BUILD_OUTPUT_LABEL}）..."
    if ! run_client_preflight; then
        print_fail "前端构建资源不足，尚未修改版本号或启动其它重任务。请释放内存后重新执行。"
    fi
    print_success "前端构建资源预检通过"
fi

# ─── 阶段（条件）: 更新版本号 ─────────────────────────────
if [ "$BUMP_VERSION" = true ]; then
    if [ "$CURRENT_VERSION" = "$VERSION" ]; then
        print_phase "确认版本号（前后端统一继续发布: ${VERSION}）"
    else
        print_phase "更新版本号（前后端统一: ${CURRENT_VERSION} → ${VERSION}）"
    fi

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
    done < <(
        {
            find Microi.Server -maxdepth 2 -name "*.csproj" -not -path "*/obj/*" -not -path "*/bin/*" -not -path "*/Microi.Panel/*" 2>/dev/null
            # Windows 目录联接可以被 dotnet 正常编译，但 MSYS find 不会穿越联接枚举子仓项目。
            # 闭源包必须与平台版本同步，否则 pack 会生成上一版并被发布门禁拒绝。
            for closed_source_project in \
                "Microi.Server/Microi.net/Microi.net.csproj" \
                "Microi.Server/Microi.AI/Microi.AI.csproj" \
                "Microi.Server/Microi.MCP/Microi.MCP.csproj" \
                "Microi.Server/Microi.WorkFlow/Microi.WorkFlow.csproj" \
                "Microi.Server/Microi.Vision/Microi.Vision.csproj"; do
                if [ -f "$closed_source_project" ]; then
                    printf '%s\n' "$closed_source_project"
                fi
            done
        } | sort -u
    )

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

# 前后端可以分别发布。前端镜像必须使用本次实际构建的 package.json 版本，
# 不能在“版本号不变”模式下被后端较旧的版本号重新标记；统一升级仍由上方版本更新完成。
CLIENT_VERSION="$VERSION"
if [ "$BUILD_CLIENT" = true ] || [ ${#SELECTED_CLIENT_PLANS[@]} -gt 0 ]; then
    CLIENT_VERSION=$(json_value "version" "Microi.Client/package.json")
    if [[ ! "$CLIENT_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        print_fail "无法读取前端 package.json 的三段发布版本，禁止使用后端版本代替。"
    fi
    print_info "前端发行版本: ${CLIENT_VERSION}；后端发行版本: ${VERSION}（各自保持源码声明）"
fi

# 选定版本已准备；在官方资源写入、NuGet/Docker 推送之前执行平台自动化回归。
# 常规发行验证 Microi.Tests、全部通用前端、接口及启动运行；不新建租户、不安装聊天应用、不运行独立 Code/Agent 产品测试。
# 真实付费 AI、JUNCHI/XJY 客户数据及 SQL Server 验收属于独立专项，不进入默认平台发布。
# 显式 Full 保留真实业务深度验收；两种范围分别冻结和验证，失败均停止发布。
if [ "$MICROI_FULL_ONLY" = true ] || [ "$PUBLISH_BACKEND" = true ] || [ "$BUILD_CLIENT" = true ] || [ "${PLATFORM_DOCKER_SELECTED:-false}" = true ]; then
    # bin/Release/Dockerfile 是已跟踪的 Docker 构建配方投影。必须在冻结候选前
    # 从单一事实源同步，否则 Docker 阶段再复制会导致 Full 后候选漂移。
    if [ ${#SELECTED_API_PLANS[@]} -gt 0 ] && [ -f "Microi.Server/Microi.net.Api/Dockerfile.runtime" ]; then
        if ! cmp -s "Microi.Server/Microi.net.Api/Dockerfile.runtime" "Microi.Server/Microi.net.Api/bin/Release/Dockerfile"; then
            cp "Microi.Server/Microi.net.Api/Dockerfile.runtime" "Microi.Server/Microi.net.Api/bin/Release/Dockerfile"
            print_info "已在冻结候选前同步后端 Docker 构建配方。"
        fi
    fi
    print_phase "发布前 ${MICROI_RELEASE_TEST_POLICY} 自动化测试（失败即停止）"
    MICROI_RELEASE_CANDIDATE="$MICROI_RELEASE_GATE_DIR/candidate-$(date +%Y%m%d-%H%M%S)-$$.json"
    if is_windows_shell; then MICROI_RELEASE_CANDIDATE=$(cygpath -m "$MICROI_RELEASE_CANDIDATE"); fi
    export MICROI_RELEASE_CANDIDATE
    if ! run_release_command node Microi.Server/tools/release-candidate.mjs capture "$MICROI_RELEASE_CANDIDATE"; then
        print_fail "无法记录所选产品范围的候选源码；已停止发布。"
    fi
    if command -v pwsh >/dev/null 2>&1; then
        _test_powershell="pwsh"
    elif command -v powershell.exe >/dev/null 2>&1; then
        _test_powershell="powershell.exe"
    else
        print_fail "缺少 PowerShell，无法执行 Microi.Tests 发布门禁。"
    fi
    _full_test_results="$MICROI_RELEASE_GATE_DIR/$(date +%Y%m%d-%H%M%S)-$$"
    # 使用本轮所选测试策略的实际回执；历史跳过例外不能作为发布入口。
    if [ "$MICROI_FULL_ONLY" = true ] && [ -n "${MICROI_TEST_SQLSERVER_EXEMPTION_RECEIPT:-}${MICROI_TEST_SQLSERVER_EXEMPTION_SHA256:-}" ]; then
        print_fail "SQL Server 跳过例外已停用；请使用冻结依赖矩阵及零跳过 Full。"
    fi
    _release_test_scope_args=()
    if [ "$MICROI_COMPLETE_PLATFORM_RELEASE" = true ]; then _release_test_scope_args+=(-PlatformFrontendTests); fi
    if ! run_release_command "$_test_powershell" -NoProfile -ExecutionPolicy Bypass \
        -File Microi.Server/Microi.Tests/run-tests.ps1 -Mode "$MICROI_RELEASE_TEST_POLICY" -Configuration Release -SolutionPath "$SLN_FILE" \
        -ResultsDirectory "$_full_test_results" "${_release_test_scope_args[@]}"; then
        print_fail "${MICROI_RELEASE_TEST_POLICY} 测试未通过；已停止官方应用资源写入和平台发布，禁止跳过失败用例。"
    fi
    if [ "$MICROI_FULL_ONLY" = true ]; then
      if ! node Microi.Server/Microi.Tests/ReleaseGate/release-test-matrix.mjs verify \
        "$_full_test_results/release-test-matrix.json" "$_full_test_results/release-test-matrix-outcomes.json" \
        "$_full_test_results/release-test-matrix-result.json"; then
        print_fail "Full 依赖矩阵、原始 TRX、浏览器或实际存储回执无效；已停止发布。"
      fi
    else
      if ! node Microi.Server/Microi.Tests/ReleaseGate/release-test-matrix.mjs verify-platform \
        "$_full_test_results/platform-release-plan.json" "$_full_test_results/platform-release-tests.json" \
        "$_full_test_results/platform-release-result.json"; then
        print_fail "平台自动化原始 TRX 或 Node 回执无效；已停止发布。"
      fi
      MICROI_RELEASE_TEST_RECEIPT="$_full_test_results/platform-release-result.json"
      if is_windows_shell; then MICROI_RELEASE_TEST_RECEIPT=$(cygpath -m "$MICROI_RELEASE_TEST_RECEIPT"); fi
      export MICROI_RELEASE_TEST_RECEIPT
    fi
    if ! run_release_command node Microi.Server/tools/release-candidate.mjs verify "$MICROI_RELEASE_CANDIDATE"; then
        print_fail "验收期间源码发生变化；必须对最终候选重新执行所选范围的测试。"
    fi
    print_success "Microi.Tests ${MICROI_RELEASE_TEST_POLICY} 冻结候选回归通过"
fi

# 插件发行修复等需要复验 Full，但不能重新生成或覆盖已成功发布的不可变平台制品。
# 复用上方 PC/API 范围锁、候选冻结、完整用例及漂移检查；不提供跳过或放宽门禁的路径。
if [ "$MICROI_FULL_ONLY" = true ]; then
    print_success "完整 Full 及候选一致性验收完成；未升版、未改写发行目录、未上传 NuGet/Docker/官网或官方应用。"
    exit 0
fi

# 发布只清理所选范围的开发服务：API 对应后端与 Release DLL，PC 对应 Vite。
# 官网不会停止 API/PC；身份核验及禁止按进程名全杀的规则保持不变。
if [ "$BUILD_BACKEND" = true ] || [ "$BUILD_CLIENT" = true ] || [ "$PUBLISH_DOC" = true ]; then
    if [ "$BUILD_BACKEND" = true ] || [ "$BUILD_CLIENT" = true ]; then
        print_step "识别并停止所选发布范围的开发服务，API 发布检查 Release DLL 文件锁..."
        if ! prepare_release_workspace; then
            print_fail "本地开发进程无法安全收尾；已阻止编译，避免误杀其它应用或再次遇到 DLL 文件锁。"
        fi
        print_success "共享开发服务已安全收尾，Release DLL 文件锁为 0"
    fi
fi

# ─── 阶段（条件）: 双向同步官方升级资源 ──────────────────
if [ "$PUBLISH_BACKEND" = true ] || [ "$BUILD_CLIENT" = true ]; then
    if ! run_release_command node Microi.Server/tools/release-candidate.mjs verify "$MICROI_RELEASE_CANDIDATE"; then
        print_fail "当前版本源码尚未通过所选范围测试；请用最终候选重跑发布。Microi.Ops 保持独立版本。"
    fi
fi
# 后端发布产物会把 Resource 下的基础应用打入程序集，因此必须在编译前校验资源。
# 常规流程会同步并写回 iTdos；正式发布可显式延后官方应用写回，先完成平台渠道。
# 延后模式要求发布前已完成只读三方预合并，渠道成功后再按远端哈希并发保护写回。
if [ "$PUBLISH_BACKEND" = true ] && [ "$MICROI_DOCKER_ONLY_HOTFIX" != true ]; then
    print_phase "同步 iTdos 官网与后端内置升级资源"
    if ! command -v node >/dev/null 2>&1; then
        print_fail "未找到 Node.js，无法执行升级资源三方同步"
    fi
    if [ "$MICROI_DEFER_OFFICIAL_RESOURCE_PUBLISH" = "1" ]; then
        if ! run_release_command node Microi.Server/OfficialApplications/Resource/refresh-resources.mjs --validate-only; then
            print_fail "内置升级资源校验失败；已阻止后端发布"
        fi
        print_info "官方应用写回已安排在平台渠道与插件成功后执行；本阶段仅校验本地候选。"
    elif ! run_release_command node Microi.Server/OfficialApplications/Resource/refresh-resources.mjs --publish --allow-verified-offline --require-unchanged-candidate; then
        print_fail "升级资源同步失败；已阻止后端发布，避免官网与内置应用商城互相覆盖"
    fi
    print_success "升级资源安全检查已完成（实时同步或已验证离线基线，详见上方明细）"
fi

# 前端优先于 .NET 全量编译执行，避免后端编译产生的文件缓存和短期内存占用
# 挤压 Vite 启动空间；Chrome 49 兼容包只在显式选择后生成。
if [ "$BUILD_CLIENT" = true ]; then
    print_phase "编译前端 Microi.Client"

    if [ "$BUILD_CLIENT_LEGACY" = true ]; then
        print_step "前端受保护构建（现代 Vite 6GB、现代 JS 串行压缩 1.5GB、Chrome 49 legacy 2GB；各阶段峰值不叠加）..."
    else
        print_step "前端受保护构建（仅现代版：Vite 6GB、JS 串行压缩 1.5GB；已跳过 Chrome 49 legacy）..."
    fi
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

# Windows 并行编译时文件锁竞争问题，强制单线程（macOS/Linux 不需要）
_BUILD_EXTRA_ARGS=""
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || -n "$WINDIR" ]]; then
    _BUILD_EXTRA_ARGS="-m:1 -nodeReuse:false -p:UseSharedCompilation=false"
fi

# ─── 阶段（条件）: 编译后端解决方案 ──────────────────────
if [ "$BUILD_BACKEND" = true ]; then
    print_phase "编译后端解决方案"

    # Microi.net 是可独立发布的私有源码子仓，当它不在主解决方案项目清单中时，
    # 只通过 ProjectReference 参与解决方案编译可能仅刷新 Debug 输出。发布和打包会读取
    # bin/Release，所以必须先显式生成同版本 Release DLL，避免 API 引用新版本而发布物
    # 夹带旧 DLL。这里不改变类库 TFM，仅固定发布配置。
    _MICROI_NET_PROJECT="Microi.Server/Microi.net/Microi.net.csproj"
    if [ -f "$_MICROI_NET_PROJECT" ]; then
        print_step "显式编译 Microi.net Release 产物（防止子仓误用 Debug/旧版本 DLL）..."
        echo ""
        if ! run_release_command dotnet build "$_MICROI_NET_PROJECT" -c Release --no-incremental $_BUILD_EXTRA_ARGS -p:GeneratePackageOnBuild=false; then
            print_fail "Microi.net Release 编译失败"
        fi
        print_success "Microi.net Release 产物已就绪"
        echo ""
    fi

    print_step "dotnet build $(basename "$SLN_FILE") -c Release --no-incremental $_BUILD_EXTRA_ARGS -p:GeneratePackageOnBuild=false -p:ShouldUnsetParentConfigurationAndPlatform=false"
    echo ""
    _BUILD_LOG="$(mktemp "$MICROI_RELEASE_SCRATCH/build.XXXXXX.log")"
    # 方案外的 NPOI 等引用同样必须产出 Release，不能被 SDK 回退成 Debug。
    if ! run_release_command dotnet build "$SLN_FILE" -c Release --no-incremental $_BUILD_EXTRA_ARGS -p:GeneratePackageOnBuild=false -p:ShouldUnsetParentConfigurationAndPlatform=false 2>&1 | tee "$_BUILD_LOG"; then
        echo ""
        echo -e "  ${RED}───── 编译错误摘要（最后30行）─────${NC}"
        grep -E "error |Error |FAILED" "$_BUILD_LOG" 2>/dev/null | tail -20 || tail -30 "$_BUILD_LOG"
        echo -e "  ${RED}───────────────────────────────────${NC}"
        print_fail "后端编译失败，请检查上方编译错误"
    fi
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
# 完整删除旧 publish 即可；不能 dotnet clean，否则会把刚完成的解决方案编译产物删掉，
# 导致 publish 再次编译整条项目引用链。
rm -rf ./bin/Release/publish

print_step "dotnet publish -c Release --no-build --no-restore $_BUILD_EXTRA_ARGS（复用已验证的 Release 编译产物）..."
echo ""
if ! run_release_command dotnet publish -c Release --no-build --no-restore $_BUILD_EXTRA_ARGS \
    -p:DebugType=None -p:DebugSymbols=false \
    -o ./bin/Release/publish; then
    cd ../..
    print_fail "Microi.net.Api 发布失败"
fi
cd ../..
echo ""
print_step "打包在线 AI 使用的同版 Microi MCP 运行时..."
if ! run_release_command node Microi.Server/tools/pack-online-ai-mcp.mjs "$PUBLISH_DIR"; then
    print_fail "在线 AI MCP 运行时打包失败，禁止发布只有 AI 对话而没有 MCP 工具的后端。"
fi
cleanup_publish_artifacts "$PUBLISH_DIR"
validate_publish_artifacts "$PUBLISH_DIR"
print_success "Microi.net.Api 发布成功"

# --- 生成 NuGet 包（独立打包，避免编译期文件锁）---
# 同版本 NuGet 已发布并选择跳过时，镜像仍会加密 DLL，但不重新打包
# 已发布的不可变包。模式 1 保留本地包替换的原有用途。
if [ "$PUSH_NUGET" = true ] || { [ "$HAS_ENCRYPT" = true ] && [ "$DEPLOY_MODE" = "1" ]; }; then
    print_divider
    print_step "dotnet pack 生成 NuGet 包（--no-build，基于已编译产物）..."
    echo ""
    _PACK_LOG="$(mktemp "$MICROI_RELEASE_SCRATCH/pack.XXXXXX.log")"
    _PACK_FAILED=0
    # Pack 与 Release 编译保持相同配置，避免方案外项目引用被 SDK 重置为 Debug。
    if [ -f "${_MICROI_NET_PROJECT:-}" ]; then
        run_release_command dotnet pack "$_MICROI_NET_PROJECT" -c Release --no-build $_BUILD_EXTRA_ARGS -p:GeneratePackageOnBuild=false -p:BuildProjectReferences=false -p:ShouldUnsetParentConfigurationAndPlatform=false 2>&1 | tee "$_PACK_LOG" || _PACK_FAILED=1
    fi
    # NPOI 五个工程由 Office 引用，但不在两套平台方案中；SDK Pack 只读取引用版本，
    # 不会递归生成它们的包。按依赖顺序显式打包，继续复用本次 Release 编译产物。
    for _npoi_project in \
        Microi.NPOI.Core/Microi.NPOI.Core.csproj \
        Microi.NPOI.OpenXml4Net/Microi.NPOI.OpenXml4Net.csproj \
        Microi.NPOI.OpenXmlFormats/Microi.NPOI.OpenXmlFormats.csproj \
        Microi.NPOI.OOXML/Microi.NPOI.OOXML.csproj \
        Microi.NPOI.csproj; do
        run_release_command dotnet pack "Microi.Server/Microi.NPOI/$_npoi_project" -c Release --no-build $_BUILD_EXTRA_ARGS -p:GeneratePackageOnBuild=false -p:BuildProjectReferences=false -p:ShouldUnsetParentConfigurationAndPlatform=false 2>&1 | tee -a "$_PACK_LOG" || _PACK_FAILED=1
    done
    # 方案 Pack 的输出组目标仍需解析引用，禁止该遍历重新进入 Build。
    run_release_command dotnet pack "$SLN_FILE" -c Release --no-build $_BUILD_EXTRA_ARGS -p:GeneratePackageOnBuild=false -p:BuildProjectReferences=false -p:ShouldUnsetParentConfigurationAndPlatform=false 2>&1 | tee -a "$_PACK_LOG" || _PACK_FAILED=1
    if [ "$_PACK_FAILED" -ne 0 ]; then
        echo ""
        echo -e "  ${RED}───── Pack 错误摘要─────${NC}"
        grep -E "error |Error |FAILED" "$_PACK_LOG" 2>/dev/null | tail -20 || tail -30 "$_PACK_LOG"
        echo -e "  ${RED}────────────────────────${NC}"
        print_fail "NuGet 包生成失败"
    fi
    if [ -f "${_MICROI_NET_PROJECT:-}" ] && [ ! -f "Microi.Server/Microi.net/bin/Release/Microi.net.${VERSION}.nupkg" ]; then
        print_fail "Microi.net.${VERSION}.nupkg 未生成，禁止用旧版本包继续发布"
    fi
    echo ""
    print_success "NuGet 包生成成功"
fi

# --- DLL 加密（仅源码作者环境） ---
# 必须发生在冒烟测试之前，确保最终进入 NuGet 和 Docker 的混淆后 DLL
# 已经真实完成启动验证，而不是只验证未混淆原件。
if [ "$HAS_ENCRYPT" = true ]; then
    print_divider
    print_step "加密 DLL（Microi.net.dll + Microi.AI.dll + Microi.MCP.dll + Microi.WorkFlow.dll + Microi.Vision.dll）..."
    run_release_command node Microi.Server/tools/release-encryption.mjs plain "$PUBLISH_DIR" "$MICROI_ENCRYPTION_RECEIPT" || print_fail "缺少五个实际 DLL 的加密前证据；禁止发布。"
    if ! run_release_command bash "$ENCRYPT_SCRIPT" "$PUBLISH_DIR"; then
        print_fail "DLL 加密失败！请查看上方 Obfuscar 具体错误（工具缺失或依赖解析失败）"
    fi
    run_release_command node Microi.Server/tools/release-encryption.mjs encrypted "$PUBLISH_DIR" "$MICROI_ENCRYPTION_RECEIPT" || print_fail "实际 DLL 未全部改变或加密指纹不匹配；禁止发布。"
    DLL_ENCRYPTED=true
    print_success "DLL 加密完成"
fi

# --- 冒烟测试前：注入当前环境的 appsettings ---
# Microi.net.Api.csproj 默认 <Content Update="appsettings.*.json" CopyToPublishDirectory="Never" />
# 阻止了 appsettings.{OsClient}.json 被复制到发布目录。但 Microi 启动靠 .microi-local 切换
# 环境名，并依赖 ASP.NET Core 加载 appsettings.{Environment}.json 覆盖 appsettings.json 里的
# 数据库/Redis/Mongo 连接串。如果发布目录里只有空的 appsettings.json，启动会卡在初始化直到超时。
# 这里临时把当前环境的 appsettings.{OsClient}.json 拷贝到发布目录，冒烟测试结束后还原。
SMOKE_BACKUP="$PUBLISH_DIR/appsettings.json.smoke.bak"
SMOKE_INJECTED=false
if [ -n "${MICROI_RELEASE_SMOKE_CONFIG:-}" ]; then
    _local_appsettings="$MICROI_RELEASE_SMOKE_CONFIG"
    [ -f "$_local_appsettings" ] || print_fail "指定的冒烟配置不存在。"
    _local_env=$(json_value "OsClient" "$_local_appsettings")
    [ -n "$_local_env" ] || print_fail "指定的冒烟配置缺少 OsClient。"
    cp "$PUBLISH_DIR/appsettings.json" "$SMOKE_BACKUP"
    cp "$_local_appsettings" "$PUBLISH_DIR/appsettings.json"
    SMOKE_INJECTED=true
    print_info "冒烟测试已注入显式隔离环境配置: $_local_env"
elif [ -f "Microi.Server/Microi.net.Api/.microi-local" ]; then
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
    _appsettings_path="$_local_appsettings"
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
            if run_with_timeout 3 bash -c "</dev/tcp/${host}/${port}" 2>/dev/null; then
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
# 启动成功必须以真实 liveness HTTP 200 为准，不能依赖 Program.cs 的中文提示文案；
# 文案可能随版本调整，即使 Kestrel 已监听也会造成假超时。90s 用于容纳数据库/Redis
# 较慢时的初始化，冒烟结束时对本次启动的进程执行有界关闭。
SMOKE_TIMEOUT=${SMOKE_TIMEOUT:-90}
SMOKE_PORT=${SMOKE_PORT:-18080}
SMOKE_URL="http://127.0.0.1:${SMOKE_PORT}/api/Diagnostics/liveness"
print_divider
print_step "冒烟测试: 验证程序能否正常启动（超时 ${SMOKE_TIMEOUT}s）..."
SMOKE_LOG="$(mktemp "$MICROI_RELEASE_SCRATCH/smoke.XXXXXX.log")"
if ! (
    cd "$PUBLISH_DIR"

    if ! command -v curl >/dev/null 2>&1; then
        echo "  ❌ 冒烟测试失败: 未找到 curl，无法验证 liveness HTTP 状态！"
        exit 1
    fi
    if run_with_timeout 1 bash -c "</dev/tcp/127.0.0.1/${SMOKE_PORT}" 2>/dev/null; then
        echo "  ❌ 冒烟测试失败: 本机端口 ${SMOKE_PORT} 已被占用；可通过 SMOKE_PORT 指定其它空闲端口。"
        exit 1
    fi

    # 固定宿主环境，禁止 .microi-local / appsettings.{Environment}.json
    # 覆盖刚注入的冒烟配置，误连开发或正式数据库。
    ASPNETCORE_ENVIRONMENT=Production DOTNET_ENVIRONMENT=Production \
        dotnet Microi.net.Api.dll --urls="http://127.0.0.1:${SMOKE_PORT}" > "$SMOKE_LOG" 2>&1 &
    SMOKE_PID=$!

    stop_smoke_process() {
        if ! kill -0 "$SMOKE_PID" 2>/dev/null; then
            wait "$SMOKE_PID" 2>/dev/null || true
            return 0
        fi
        kill -TERM "$SMOKE_PID" 2>/dev/null || true
        local _shutdown_wait=0
        while kill -0 "$SMOKE_PID" 2>/dev/null && [ "$_shutdown_wait" -lt 50 ]; do
            sleep 0.1
            ((_shutdown_wait++)) || true
        done
        if kill -0 "$SMOKE_PID" 2>/dev/null; then
            echo "  ⚠️  冒烟进程 5 秒内未退出，正在强制结束本次临时进程。"
            kill -KILL "$SMOKE_PID" 2>/dev/null || true
        fi
        wait "$SMOKE_PID" 2>/dev/null || true
    }
    trap stop_smoke_process EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM HUP

    for i in $(seq 1 "$SMOKE_TIMEOUT"); do
        check_release_budget
        if ! kill -0 "$SMOKE_PID" 2>/dev/null; then
            echo "  ❌ 冒烟测试失败: 程序异常退出！"
            echo "--- 启动日志（前 80 行 + 后 120 行）---"
            sed -n '1,80p' "$SMOKE_LOG"
            tail -n 120 "$SMOKE_LOG"
            echo "----------------"
            exit 1
        fi
        _smoke_http_status=$(curl --silent --show-error --max-time 2 \
            --output /dev/null --write-out '%{http_code}' "$SMOKE_URL" 2>/dev/null || true)
        if [ "$_smoke_http_status" = "200" ]; then
            if run_release_command node "$MICROI_RELEASE_WORKSPACE/Microi.Server/tools/release-smoke.mjs" \
                "http://127.0.0.1:${SMOKE_PORT}" "$_local_env" \
                "$MICROI_RELEASE_GATE_DIR/api-smoke.json" "$PWD"; then
                echo "  ✅ 冒烟测试通过: 混淆后宿主和真实系统配置接口均返回成功（${i}s）！"
                exit 0
            fi
            echo "  ❌ 配置接口冒烟失败，已停止发布。"
            exit 1
        fi
        sleep 1
    done
    echo "  ❌ 冒烟测试失败: 启动超时（${SMOKE_TIMEOUT}秒）！"
    echo "--- 启动日志（前 80 行 + 后 120 行）---"
    sed -n '1,80p' "$SMOKE_LOG"
    tail -n 120 "$SMOKE_LOG"
    echo "----------------"
    exit 1
); then
    # 先还原 appsettings，再让脚本整体中止，避免把临时配置留给发布产物
    if [ "$SMOKE_INJECTED" = true ] && [ -f "$SMOKE_BACKUP" ]; then
        mv "$SMOKE_BACKUP" "$PUBLISH_DIR/appsettings.json"
    fi
    # 失败路径同样清理本次冒烟生成的临时 logs/PDB，避免反复失败后 publish 膨胀。
    cleanup_publish_artifacts "$PUBLISH_DIR"
    print_fail "冒烟测试失败，请检查编译产物"
fi

# --- 还原冒烟测试临时注入的 appsettings ---
# 还原发布目录原始的 appsettings.json，避免发布产物带真实数据库/Redis/Mongo 连接串。
if [ "$SMOKE_INJECTED" = true ] && [ -f "$SMOKE_BACKUP" ]; then
    mv "$SMOKE_BACKUP" "$PUBLISH_DIR/appsettings.json"
    print_info "已还原发布目录的 appsettings.json"
fi

# 冒烟启动会按运行时约定重新创建 logs/syslog-spool；验证结束后必须再次清理，
# 保证待推送镜像只包含可部署程序文件。
cleanup_publish_artifacts "$PUBLISH_DIR"

validate_publish_artifacts "$PUBLISH_DIR"

fi  # END: if PUBLISH_BACKEND

# ─── 阶段（条件）: NuGet 包 DLL 替换（加密版本）──────────
# 只有本次推送 NuGet，或模式 1 明确要求本地包替换，才修改 nupkg。
NUPKG_REPLACED=false
if [ "$DLL_ENCRYPTED" = true ] && { [ "$PUSH_NUGET" = true ] || [ "$DEPLOY_MODE" = "1" ]; }; then
    print_phase "替换 NuGet 包中的 DLL 为加密版本"

    replace_dll_in_nupkg() {
        local project_name=$1
        local package_dir="Microi.Server/${project_name}/bin/Release"
        local encrypted_dll="$PUBLISH_DIR/${project_name}.dll"

        if [ ! -d "$package_dir" ]; then print_warning "目录不存在: $package_dir"; return 1; fi
        # 只允许修改本次版本的确定包；不得用“目录中最新包”回退，否则打包失败时
        # 会意外改写上一个已发布版本。
        local latest_package="$package_dir/${project_name}.${VERSION}.nupkg"
        if [ ! -f "$latest_package" ]; then print_warning "未找到本次版本包: $latest_package"; return 1; fi
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
            _tmp_dir=$(mktemp -d "$MICROI_RELEASE_SCRATCH/nuget.XXXXXX")
            mkdir -p "$_tmp_dir/$(dirname "$dll_entry")"
            cp "$encrypted_dll" "$_tmp_dir/$dll_entry"
            if (cd "$_tmp_dir" && zip -u "$abs_pkg" "$dll_entry" > /dev/null 2>&1); then
                _update_ok=true
            fi
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

    # 验证与上传共用原 find 的完整 NUL 清单，包含嵌套项目和不同 PackageId。
    # 不能另行枚举一级同名包，路径空格也不能按空白拆分。
    _nupkg_list_file="$MICROI_RELEASE_GATE_DIR/nuget-upload-${VERSION}.nul"
    _nupkg_check_file="$MICROI_RELEASE_GATE_DIR/nuget-upload-${VERSION}.check.nul"
    mkdir -p "$(dirname "$_nupkg_list_file")"
    if ! find Microi.Server -path "*/bin/Release/*.$VERSION.nupkg" -not -name "*.symbols.nupkg" -print0 > "$_nupkg_list_file"; then
        print_fail "无法读取本次完整 NuGet 待上传清单；禁止上传。"
    fi

    # 安全检查：有加密源码但未加密时禁止推送
    if [ "$HAS_ENCRYPT" = true ] && [ "$DLL_ENCRYPTED" != true ]; then
        print_fail "检测到 Microi.net/Microi.AI/Microi.MCP/Microi.WorkFlow/Microi.Vision 源码但 DLL 未加密，禁止推送未加密的 NuGet 包！"
    fi
    if [ "$HAS_ENCRYPT" = true ] && [ "$NUPKG_REPLACED" != true ]; then
        print_fail "NuGet 包中的 DLL 未被替换为加密版本，禁止推送！"
    fi
    run_release_command node Microi.Server/tools/release-nuget-closure.mjs Microi.Server "$VERSION" "$_nupkg_list_file" || print_fail "本次 NuGet 包正文的版本或平台依赖闭包不完整；禁止上传。"
    if [ "$HAS_ENCRYPT" = true ]; then
        run_release_command node Microi.Server/tools/release-encryption.mjs packages "$PUBLISH_DIR" "$MICROI_ENCRYPTION_RECEIPT" "$VERSION" "$_nupkg_list_file" || print_fail "完整待上传清单的实际 NuGet ZIP 中存在未加密/旧 DLL、遗漏包或缺少闭源 DLL；禁止上传。"
    fi

    # 推送 NuGet 包
    print_phase "推送 NuGet 包"

    if [ ! -s "$_nupkg_list_file" ]; then
        print_warning "未找到版本 $VERSION 的 .nupkg 文件"
    else
        _push_count=0
        # 测试后的构建/打包仍需绑定同一候选；首包和每包上传前都必须确认源码
        # 仍是通过所选范围验收的候选，避免共享工作区漂移后先发布 NuGet。
        run_release_command node Microi.Server/tools/release-candidate.mjs verify "$MICROI_RELEASE_CANDIDATE" || print_fail "首个 NuGet 上传前候选源码发生变化；禁止上传。"
        # 首个 push 前再次读取完整实际集合并校验所有包哈希；随后每包再 CAS。
        if [ "$HAS_ENCRYPT" = true ]; then
            if ! find Microi.Server -path "*/bin/Release/*.$VERSION.nupkg" -not -name "*.symbols.nupkg" -print0 > "$_nupkg_check_file"; then
                print_fail "首个上传前无法复核完整 NuGet 清单；禁止上传。"
            fi
            run_release_command node Microi.Server/tools/release-encryption.mjs packages-cas "$PUBLISH_DIR" "$MICROI_ENCRYPTION_RECEIPT" "$VERSION" "$_nupkg_check_file" || print_fail "首个上传前 NuGet 清单或包字节发生变化；禁止全部上传。"
        fi
        # 先查完整远端集合，避免推到一半才发现另一个候选已占用同版；未知读取也停止。
        _nuget_remote_receipt="$MICROI_RELEASE_GATE_DIR/nuget-remote-${VERSION}-${RANDOM}-${RANDOM}.json"
        run_release_command node Microi.Server/tools/release-remote-collision.mjs nuget-preflight Microi.Server "$VERSION" "$_nupkg_list_file" "$CONFIG_FILE" "$_nuget_remote_receipt" || print_fail "远端 NuGet 同版本包不同或无法确认；禁止上传本轮包。"
        while IFS= read -r -d '' _nupkg; do
            run_release_command node Microi.Server/tools/release-candidate.mjs verify "$MICROI_RELEASE_CANDIDATE" || print_fail "当前 NuGet 上传前候选源码发生变化；禁止上传。"
            if [ "$HAS_ENCRYPT" = true ]; then
                run_release_command node Microi.Server/tools/release-encryption.mjs package-cas "$PUBLISH_DIR" "$MICROI_ENCRYPTION_RECEIPT" "$VERSION" "$_nupkg" || print_fail "当前 NuGet 包未经核验或字节发生变化；禁止上传。"
            fi
            print_step "推送: $(basename "$_nupkg")"
            # Package CAS 仍在每包上传前执行；此进程直接按 V3 服务索引上传，密钥不进 argv。
            if ! run_release_command node Microi.Server/tools/secure-nuget-push.mjs push "$_nupkg" "$CONFIG_FILE"; then
                print_fail "NuGet 推送失败: $(basename "$_nupkg")"
            fi
            print_success "$(basename "$_nupkg")"
            ((_push_count++)) || true
        done < "$_nupkg_list_file"
        echo ""
        print_success "共推送 $_push_count 个 NuGet 包"
    fi
fi

# ─── 阶段（条件）: 推送 Docker 镜像 ──────────────────────

# 确保 Docker 已启动（Windows 启动 Docker Desktop，macOS 启动 Docker.app）
ensure_docker_running() {
    # docker.exe can itself hang while Docker Desktop/WSL is half-started. The
    # outer 60-second loop is not a real bound unless every probe is bounded.
    _docker_daemon_ready() {
        run_with_timeout 5 docker info </dev/null > /dev/null 2>&1
    }

    if _docker_daemon_ready; then
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
            # 发布脚本常通过 tee 记录日志；Docker Desktop 若继承标准输出会让脚本成功后仍无法收到 EOF。
            # 使用独立标准流并从当前 Bash 作业表分离，Docker 后台生命周期不再阻塞发布退出标记。
            nohup "$_docker_desktop" </dev/null >/dev/null 2>&1 &
            disown "$!" 2>/dev/null || true
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
    while ! _docker_daemon_ready; do
        check_release_budget
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

# 为现有 Dockerfile 生成最小上下文白名单。Docker 构建目录仍保持兼容，
# 但后端只能读取 publish，前端只能读取 dist/default.conf，net10.0 永不发送。
prepare_docker_context() {
    local plan_type="$1"
    local build_dir=""
    if [ "$plan_type" = "api" ]; then
        build_dir="Microi.Server/Microi.net.Api/bin/Release"
        cleanup_publish_artifacts "$PUBLISH_DIR"
        validate_publish_artifacts "$PUBLISH_DIR"
        if [ ! -f "$PUBLISH_DIR/ai-mcp/dist/index.js" ]; then
            print_fail "后端产物缺少在线 AI MCP 运行包。"
        fi
        cp Microi.Server/Microi.net.Api/Dockerfile.runtime "$build_dir/Dockerfile"
        cat > "$build_dir/.dockerignore" <<'EOF'
*
!Dockerfile
!publish/
!publish/**
publish/logs/
publish/**/*.pdb
EOF
        print_info "后端 Docker 上下文已限制为 publish/（net10.0 已排除）"
    elif [ "$plan_type" = "client" ]; then
        build_dir="Microi.Client/bin/Release"
        if [ ! -f "$build_dir/dist/index.html" ]; then
            print_fail "前端发布产物缺少 dist/index.html"
        fi
        cat > "$build_dir/.dockerignore" <<'EOF'
*
!Dockerfile
!default.conf
!dist/
!dist/**
EOF
        print_info "前端 Docker 上下文已限制为 dist/ 和 default.conf"
    else
        print_fail "未知 Docker 方案类型: $plan_type"
    fi
}

docker_registry_login() {
    print_step "登录 ${DOCKER_REGISTRY}..."
    if ! printf '%s' "$DOCKER_PASSWORD" | run_release_command docker login \
        --username "$DOCKER_USERNAME" --password-stdin "$DOCKER_REGISTRY"; then
        print_fail "Docker 镜像仓库登录失败"
    fi
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

    local receipt="$MICROI_RELEASE_GATE_DIR/${plan_type}-artifact.json"
    local receipt_mode=verify
    if { [ "$plan_type" = api ] && [ "$PUBLISH_BACKEND" = true ]; } || { [ "$plan_type" = client ] && [ "$BUILD_CLIENT" = true ]; }; then
        receipt_mode=capture
    fi
    if ! run_release_command node Microi.Server/tools/release-artifact.mjs "$receipt_mode" "$plan_type" "$MICROI_RELEASE_CANDIDATE" "$receipt"; then
        print_fail "构建产物没有与 ${MICROI_RELEASE_TEST_POLICY} 测试通过的源码绑定；禁止发布旧产物。"
    fi

    # 使用 Docker 内容摘要缓存；publish/dist 内容变化会自动使 COPY 层失效。
    # 当前镜像仓库不接受 Buildx 默认证明清单的 OCI empty manifest，构建时关闭证明附件。
    # 优先检查基础镜像更新；远端 Registry 短暂不可达时重试，最终只允许回退到
    # Docker 已缓存且能被本地解析的基础镜像，避免一次 TLS 超时中断整轮发布。
    print_step "构建镜像: $local_image"
    local _docker_build_ok=false
    local _docker_build_attempt=1
    while [ "$_docker_build_attempt" -le 2 ]; do
        if (cd "$build_dir" && run_release_command docker build --provenance=false --sbom=false --pull --build-arg "MICROI_ASPNET_IMAGE=${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/dotnet-aspnet:10.0.13" --build-arg "MICROI_NODE_IMAGE=docker.io/library/node:22-bookworm-slim@sha256:48e4b67d85f87bd551df43704e24d252f56cc5f8e9718841aace50f19948f0f9" --build-arg "MICROI_NGINX_IMAGE=${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/nginx:acs-sample-20260909" -t "$local_image" .); then
            _docker_build_ok=true
            break
        fi
        if [ "$_docker_build_attempt" -lt 2 ]; then
            print_warning "基础镜像更新检查失败，5 秒后执行唯一一次重试（${_docker_build_attempt}/2）..."
            sleep 5
        fi
        _docker_build_attempt=$((_docker_build_attempt + 1))
    done
    if [ "$_docker_build_ok" != true ]; then
        print_warning "远端基础镜像连续拉取失败，尝试使用 Docker 本地缓存完成本次构建..."
        if (cd "$build_dir" && run_release_command docker build --provenance=false --sbom=false --pull=false --build-arg "MICROI_ASPNET_IMAGE=${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/dotnet-aspnet:10.0.13" --build-arg "MICROI_NODE_IMAGE=docker.io/library/node:22-bookworm-slim@sha256:48e4b67d85f87bd551df43704e24d252f56cc5f8e9718841aace50f19948f0f9" --build-arg "MICROI_NGINX_IMAGE=${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/nginx:acs-sample-20260909" -t "$local_image" .); then
            print_warning "已使用本地缓存的基础镜像完成构建；发布后请关注远端 Registry 连通性。"
        else
            print_fail "Docker 镜像构建失败，远端拉取和本地缓存均不可用: $local_image"
        fi
    fi

    # 固定版本标签在任何 latest 推送之前先全量核对；不能覆盖另一候选。
    local collision_receipt="$MICROI_RELEASE_GATE_DIR/${plan_type}-remote-${version}-${RANDOM}-${RANDOM}.json"
    run_release_command node Microi.Server/tools/release-remote-collision.mjs docker-baseline "$local_image" "${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}" "$remote_images" "$version" "$collision_receipt" || print_fail "Docker 固定版本标签已被不同候选占用或远端状态未知；禁止推送。"

    # 推送每个远程镜像
    IFS=',' read -ra _images <<< "$remote_images"
    local _published_index=0 _published_receipt
    for _img_tag in "${_images[@]}"; do
        if ! run_release_command node Microi.Server/tools/release-artifact.mjs verify "$plan_type" "$MICROI_RELEASE_CANDIDATE" "$receipt"; then
            print_fail "镜像推送前源码或产物发生漂移；已停止推送。"
        fi
        if [ "$plan_type" = "api" ] && [ "$HAS_ENCRYPT" = true ]; then
            run_release_command node Microi.Server/tools/release-encryption.mjs image "$PUBLISH_DIR" "$MICROI_ENCRYPTION_RECEIPT" "$local_image" || print_fail "实际 Docker 镜像中的闭源 DLL 与本次加密证据不符；禁止上传。"
        fi
        # 替换占位符
        _img_tag=$(echo "$_img_tag" | sed "s/{latest}/latest/g" | sed "s/{version}/v${version}/g")
        local full_tag="${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/${_img_tag}"
        _published_index=$((_published_index + 1))
        _published_receipt="${collision_receipt%.json}-published-${_published_index}.json"
        # 镜像名可能和本地镜像名不同，需要 tag
        local _remote_name=$(echo "$_img_tag" | cut -d':' -f1)
        local _remote_tag=$(echo "$_img_tag" | cut -d':' -f2)
        run_release_command docker tag "$local_image" "$full_tag"
        # 断点续发时仅复用已由当前本地镜像取得的同内容仓库摘要。
        # 本地 RepoDigests 与远端指定标签均一致才跳过；下方最后复核拒绝状态漂移。
        local _published_repo="${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/${_remote_name}"
        local _local_published_digest
        _local_published_digest=$(run_release_command docker image inspect "$local_image" --format '{{range .RepoDigests}}{{println .}}{{end}}' 2>/dev/null \
            | awk -v prefix="${_published_repo}@" 'index($0,prefix)==1 {print substr($0,length(prefix)+1); exit}')
        local _remote_digest=""
        if [[ "$_local_published_digest" =~ ^sha256:[a-f0-9]{64}$ ]]; then
            _remote_digest=$(run_release_command docker buildx imagetools inspect "$full_tag" --format '{{.Manifest.Digest}}' 2>/dev/null | tr -d '\r' || true)
        fi
        if [ "$_remote_digest" = "$_local_published_digest" ] && [ -n "$_remote_digest" ]; then
            run_release_command node Microi.Server/tools/release-remote-collision.mjs docker-recheck "$collision_receipt" "$full_tag" || print_fail "远端 Docker 标签在验收后变化，已停止发布。"
            run_release_command node Microi.Server/tools/release-remote-collision.mjs docker-confirm "$collision_receipt" "$full_tag" "$_published_receipt" || print_fail "复用镜像的远端摘要未能确认，不能报告发布完成。"
            print_info "已回读相同 digest，复用远端标签: $full_tag ($_remote_digest)"
            continue
        fi
        print_step "推送: $full_tag"
        # Registry 没有跨仓库 CAS；每次 push 前缩短检查窗口，但不宣称原子发布。
        run_release_command node Microi.Server/tools/release-remote-collision.mjs docker-recheck "$collision_receipt" "$full_tag" || print_fail "远端 Docker 标签在验收后变化，已停止发布。"
        run_release_command docker push "$full_tag"
        # 新推送与断点复用都须读回实际标签；本地 RepoDigest 与远端相同才落成功回执。
        # 发布后校验计入同一耗时目标；超过 30 分钟仍执行校验，真实失败不能报告成功。
        run_release_command node Microi.Server/tools/release-remote-collision.mjs docker-confirm "$collision_receipt" "$full_tag" "$_published_receipt" || print_fail "Docker 已推送，但远端摘要尚未确认；本标签不能报告发布完成，请查看回执后再重试。"
    done

    print_success "$plan_name 推送及远端摘要回读完成"
}

if [ ${#SELECTED_API_PLANS[@]} -gt 0 ] || [ ${#SELECTED_CLIENT_PLANS[@]} -gt 0 ]; then
    print_phase "推送 Docker 镜像"

    # 确保 Docker 已启动
    ensure_docker_running

    # 在登录和构建前验证并收紧上下文；同一轮发布只登录一次，不破坏刚生成的缓存层。
    if [ ${#SELECTED_API_PLANS[@]} -gt 0 ]; then
        prepare_docker_context "api"
    fi
    if [ ${#SELECTED_CLIENT_PLANS[@]} -gt 0 ]; then
        prepare_docker_context "client"
    fi
    docker_registry_login
    print_info "Docker 磁盘使用: $(docker system df --format '{{.Type}}={{.Size}}（可回收 {{.Reclaimable}}）' 2>/dev/null | tr '\n' ';' || echo '(无法获取)')"

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
        print_fail "检测到 Microi.net/Microi.AI/Microi.MCP/Microi.WorkFlow/Microi.Vision 源码但 DLL 未加密，禁止推送未加密的 Docker 镜像！"
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
        docker_push_plan "$_plan" "$CLIENT_VERSION"
    done
fi

# ─── 阶段（条件）: 发布官方网站文档 ──────────────────────
if [ "$PUBLISH_DOC" = true ]; then
    print_phase "发布官方网站文档"

    # 官网必须属于已提交的完整本地候选；Git 远端故障不阻断合格的官网 Docker。
    if [ -n "${MICROI_RELEASE_CANDIDATE:-}" ]; then
        run_release_command node Microi.Server/tools/release-candidate.mjs verify "$MICROI_RELEASE_CANDIDATE" || print_fail "官网发布前候选已变化，不能上传不同轮源码。"
    fi
    run_release_command node microi.doc/scripts/check-account-portal.mjs --require-committed

    # 依赖版本以官网声明/既有锁为准；禁止全局 pnpm 升级时重写发布锁文件。
    DOC_PNPM_VERSION="$(node --input-type=module -e '
      import fs from "node:fs";
      const pkg = JSON.parse(fs.readFileSync("microi.doc/package.json", "utf8"));
      const declared = /^pnpm@(\d+\.\d+\.\d+)(?:\+.*)?$/.exec(pkg.packageManager || "");
      if (pkg.packageManager && !declared) throw new Error("官网 packageManager 必须固定 pnpm 精确版本");
      const lock = fs.readFileSync("microi.doc/pnpm-lock.yaml", "utf8");
      const version = declared?.[1] || (/^lockfileVersion:\s*[\x27\x22]?6\.0[\x27\x22]?\s*$/m.test(lock) ? "8.15.9" : "");
      if (!version) throw new Error("官网锁文件没有可验证的 pnpm 版本，请先维护 packageManager");
      process.stdout.write(version);
    ')"
    if command -v pnpm &>/dev/null && [ "$(pnpm --version)" = "$DOC_PNPM_VERSION" ]; then
        DOC_PKG_CMD=(pnpm)
    elif command -v npx &>/dev/null; then
        DOC_PKG_CMD=(npx --yes "pnpm@$DOC_PNPM_VERSION")
    else
        print_fail "官网发布需要 pnpm@$DOC_PNPM_VERSION 或 npx，请先安装 Node.js: https://nodejs.org"
    fi
    print_info "使用包管理器: pnpm@$DOC_PNPM_VERSION"

    print_step "按锁文件安装依赖..."
    (cd microi.doc && run_release_command "${DOC_PKG_CMD[@]}" install --frozen-lockfile)

    print_step "构建 VitePress 文档..."
    (cd microi.doc && run_release_command "${DOC_PKG_CMD[@]}" run docs:build)
    run_release_command node microi.doc/scripts/check-account-portal.mjs --dist --require-committed
    print_success "VitePress 构建完成"

    # 确保 Docker 已启动
    ensure_docker_running

    print_step "构建 Docker 镜像: microi.doc"
    # 当前阿里云镜像仓库不接受 BuildKit 附带的 OCI attestation manifest。
    # 本次独立标签避免并行文档构建覆盖共享 latest；后续晋级始终使用该标签。
    DOC_IMAGE_TAG="microi.doc:docs-$(git rev-parse --short=12 HEAD)-$(date +%s)-$$"
    (cd microi.doc/docs/.vitepress && run_release_command docker build --provenance=false --sbom=false -t "$DOC_IMAGE_TAG" .)
    print_success "Docker 镜像构建完成"

    # 官方网站文档镜像仓库登录：仅更新配置所属地域，另一仓库沿用其受保护的 Docker 凭据。
    case "${DOCKER_USERNAME:-}" in
        ""|your-username|YOUR_USERNAME|placeholder|PLACEHOLDER)
            print_fail "官方网站文档发布缺少有效 Docker Username，请填写受保护发布配置" ;;
    esac
    case "${DOCKER_PASSWORD:-}" in
        ""|your-password|YOUR_PASSWORD|placeholder|PLACEHOLDER)
            print_fail "官方网站文档发布缺少有效 Docker Password，请填写受保护发布配置" ;;
    esac
    case "${DOCKER_REGION:-}" in
        beijing|hangzhou) _doc_login_registry="registry.cn-${DOCKER_REGION}.aliyuncs.com" ;;
        *) print_fail "官方网站文档发布配置的 Docker Region 必须对应北京或杭州原有仓库" ;;
    esac
    print_step "登录 ${_doc_login_registry}（受保护配置）..."
    if ! printf '%s' "$DOCKER_PASSWORD" | run_release_command docker login --username "$DOCKER_USERNAME" --password-stdin "$_doc_login_registry"; then
        print_fail "官方网站文档配置所属 Docker 镜像仓库登录失败"
    fi
    # 两个地域可属于不同账号。禁止用一个地域的凭据覆盖另一个地域的有效登录。
    _doc_targets=(registry.cn-beijing.aliyuncs.com/itdos/microi.doc:latest registry.cn-hangzhou.aliyuncs.com/microios/microi-doc:latest)
    _doc_remote_plans=()
    for _doc_target in "${_doc_targets[@]}"; do
        if ! run_release_command docker manifest inspect "$_doc_target" >/dev/null; then
            print_fail "官方网站文档仓库读取失败：$_doc_target，请检查该地域已有 Docker 凭据和权限"
        fi
        _doc_receipt="$MICROI_RELEASE_GATE_DIR/doc-remote-${START_TIME}-$$-${#_doc_remote_plans[@]}-${RANDOM}.json"
        _doc_template="${_doc_target##*/}"
        _doc_template="${_doc_template%:latest}:{latest}"
        run_release_command node Microi.Server/tools/release-remote-collision.mjs docker-baseline "$DOC_IMAGE_TAG" "${_doc_target%/*}" "$_doc_template" "$VERSION" "$_doc_receipt" || print_fail "官网镜像远端基线无法确认，禁止上传。"
        _doc_remote_plans+=("$_doc_receipt")
    done

    # 官网复用相同候选、软耗时目标和摘要门禁；独立双仓库仍逐个确认，不宣称原子发布。
    for _doc_index in "${!_doc_targets[@]}"; do
        _doc_target="${_doc_targets[$_doc_index]}"
        _doc_receipt="${_doc_remote_plans[$_doc_index]}"
        if [ -n "${MICROI_RELEASE_CANDIDATE:-}" ]; then
            run_release_command node Microi.Server/tools/release-candidate.mjs verify "$MICROI_RELEASE_CANDIDATE" || print_fail "官网推送前候选已变化，禁止继续。"
        fi
        print_step "推送官方网站镜像: $_doc_target"
        run_release_command docker tag "$DOC_IMAGE_TAG" "$_doc_target"
        run_release_command node Microi.Server/tools/release-remote-collision.mjs docker-recheck "$_doc_receipt" "$_doc_target" || print_fail "官网远端标签在验收后变化，禁止继续。"
        run_release_command docker push "$_doc_target"
        run_release_command node Microi.Server/tools/release-remote-collision.mjs docker-confirm "$_doc_receipt" "$_doc_target" "${_doc_receipt%.json}-published.json" || print_fail "官网镜像已推送，但摘要回读未通过，不能报告官网发布完成。"
        print_success "$_doc_target（远端摘要已确认）"
    done

    print_success "官方网站文档发布成功"
fi

# ─── 本地产物路径提示 ─────────────────────────────────────
if [ "$PUBLISH_BACKEND" != true ] && [ "$BUILD_BACKEND" = true ]; then
    echo ""
    print_info "后端仅编译（未执行 dotnet publish），如需产物请选择发布模式"
fi
if [ "$BUILD_CLIENT" = true ] && [ ${#SELECTED_CLIENT_PLANS[@]} -eq 0 ]; then
    echo ""
    echo -e "  ${BOLD}📁 前端产物:${NC} Microi.Client/bin/Release/dist/（${CLIENT_BUILD_OUTPUT_LABEL}）"
fi
if [ "$PUBLISH_BACKEND" = true ] && [ ${#SELECTED_API_PLANS[@]} -eq 0 ]; then
    echo ""
    echo -e "  ${BOLD}📁 后端产物:${NC} Microi.Server/Microi.net.Api/bin/Release/publish/"
    echo -e "  ${BOLD}💡 启动方式:${NC} cd Microi.Server/Microi.net.Api/bin/Release/publish && dotnet Microi.net.Api.dll"
fi

# ══════════════════════════════════════════════════════════════
# 完成
# ══════════════════════════════════════════════════════════════
check_release_budget
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
    if [ "$CURRENT_VERSION" = "$VERSION" ]; then
        echo -e "  版本号:   ${BOLD}${GREEN}${VERSION}${NC}（继续当前未提交版本）"
    else
        echo -e "  版本号:   ${BOLD}${CURRENT_VERSION} → ${GREEN}${VERSION}${NC}"
    fi
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
    echo -e "  前端编译: ${GREEN}✅${NC}（${CLIENT_BUILD_OUTPUT_LABEL}）"
fi
for _p in "${SELECTED_CLIENT_PLANS[@]}"; do
    echo -e "  前端Docker: ${GREEN}✅${NC} $(echo "$_p" | cut -d'|' -f1)"
done
if [ "$PUBLISH_DOC" = true ]; then
    echo -e "  文档发布: ${GREEN}✅${NC}"
fi
echo -e "  耗时:     ${BOLD}${MINUTES}分${SECONDS_REMAIN}秒${NC}"
echo ""
