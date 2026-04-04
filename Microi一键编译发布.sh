#!/bin/bash
# ════════════════════════════════════════════════════════════════
#  Microi 一键编译发布助手
#  适用于 Microi 低代码平台的后端 (.NET) 和前端 (Vue3) 一键编译发布
#  初次使用：chmod +x Microi一键编译发布.sh
#  开源地址: https://gitee.com/ITdos/microi.net
# ════════════════════════════════════════════════════════════════
set -e
set -o pipefail

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
echo -e "  下个版本: ${BOLD}${GREEN}${NEXT_VERSION}${NC}"

# ══════════════════════════════════════════════════════════════
# 前置交互：所有需要人工选择的内容集中在此
# ══════════════════════════════════════════════════════════════
echo ""
echo -e "  ${BOLD}────────────────────────────────────────────────────────${NC}"
echo -e "  ${BOLD}📋 请先完成以下选择，之后将全自动执行${NC}"
echo -e "  ${BOLD}────────────────────────────────────────────────────────${NC}"
echo ""

# --- 发布模式（4选1）---
echo -e "  ${BOLD}【发布模式】${NC}"
echo "    1) 只编译前端和后端（不推送Docker、不推送NuGet、版本号不变）"
echo "    2) 只发布后端（推送Docker、推送NuGet、版本号+1）"
if [ "$HAS_CLIENT" = true ]; then
    echo "    3) 只发布前端（推送Docker、不推送NuGet、版本号不变）"
    echo "    4) 发布前端和后端（推送Docker、推送NuGet、版本号+1）"
else
    echo -e "    ${DIM}3) 只发布前端（未检测到前端源码，不可用）${NC}"
    echo "    4) 只发布后端（推送Docker、推送NuGet、版本号+1）"
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
BUMP_VERSION=false      # 是否递增版本号
BUILD_BACKEND=false     # 是否编译后端（dotnet build）
BUILD_CLIENT=false      # 是否编译前端（npm run build）
PUBLISH_BACKEND=false   # 是否发布后端（dotnet publish + 冒烟 + 加密）
PUSH_NUGET=false        # 是否推送 NuGet
PUSH_DOCKER=false       # 是否推送 Docker

case "$DEPLOY_MODE" in
    1)  # 只编译前端和后端
        BUILD_BACKEND=true
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

# NuGet 可用性
if [ "$PUSH_NUGET" = true ] && [ "$HAS_NUGET" != true ]; then
    PUSH_NUGET=false
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

# ─── 阶段（条件）: 编译后端解决方案 ──────────────────────
if [ "$BUILD_BACKEND" = true ]; then
    print_phase "编译后端解决方案"

    print_step "dotnet build $(basename "$SLN_FILE") -c Release --no-incremental"
    echo ""
    if ! dotnet build "$SLN_FILE" -c Release --no-incremental; then
        print_fail "后端编译失败，请检查编译错误"
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
dotnet clean -c Release > /dev/null 2>&1 || true
rm -rf ./bin/Release/publish

print_step "dotnet publish -c Release..."
echo ""
if ! dotnet publish -c Release -o ./bin/Release/publish; then
    cd ../..
    print_fail "Microi.net.Api 发布失败"
fi
cd ../..
echo ""
print_success "Microi.net.Api 发布成功"

# --- 冒烟测试 ---
print_divider
print_step "冒烟测试: 验证程序能否正常启动..."
SMOKE_LOG="$(mktemp /tmp/microi-smoke-test.XXXXXX.log)"
if ! (
    cd "$PUBLISH_DIR"
    dotnet Microi.net.Api.dll --urls=http://0.0.0.0:8080 > "$SMOKE_LOG" 2>&1 &
    SMOKE_PID=$!
    for i in $(seq 1 30); do
        if grep -q "Microi所有初始化成功" "$SMOKE_LOG" 2>/dev/null; then
            echo "  ✅ 冒烟测试通过: Microi所有初始化成功！"
            kill $SMOKE_PID 2>/dev/null; wait $SMOKE_PID 2>/dev/null || true
            rm -f "$SMOKE_LOG"; exit 0
        fi
        if ! kill -0 $SMOKE_PID 2>/dev/null; then
            if grep -q "Microi所有初始化成功" "$SMOKE_LOG" 2>/dev/null; then
                echo "  ✅ 冒烟测试通过: Microi所有初始化成功！（进程已正常退出）"
                rm -f "$SMOKE_LOG"; exit 0
            else
                echo "  ❌ 冒烟测试失败: 程序异常退出！"
                echo "--- 启动日志 ---"; cat "$SMOKE_LOG"; echo "----------------"
                rm -f "$SMOKE_LOG"; exit 1
            fi
        fi
        sleep 1
    done
    echo "  ❌ 冒烟测试失败: 启动超时（30秒）！"
    echo "--- 启动日志 ---"; cat "$SMOKE_LOG"; echo "----------------"
    kill $SMOKE_PID 2>/dev/null; wait $SMOKE_PID 2>/dev/null || true
    rm -f "$SMOKE_LOG"; exit 1
); then
    rm -f "$SMOKE_LOG" 2>/dev/null
    print_fail "冒烟测试失败，请检查编译产物"
fi

# --- DLL 加密（仅源码作者环境） ---
if [ "$HAS_ENCRYPT" = true ]; then
    print_divider
    print_step "加密 DLL（Microi.net.dll + Microi.AI.dll）..."
    if ! bash "$ENCRYPT_SCRIPT" "$PUBLISH_DIR"; then
        print_fail "DLL 加密失败！请确认已安装 Obfuscar: dotnet tool install --global Obfuscar.GlobalTool"
    fi
    DLL_ENCRYPTED=true
    print_success "DLL 加密完成"
fi

fi  # END: if PUBLISH_BACKEND

# ─── 阶段（条件）: NuGet 推送 ─────────────────────────────
NUPKG_REPLACED=false
if [ "$PUSH_NUGET" = true ]; then

    # 加密DLL替换nupkg（仅在加密可用时）
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

            print_step "替换 $(basename "$latest_package") 中的 ${project_name}.dll（加密DLL: $((enc_bytes/1024))KB，nupkg替换前: $((nupkg_before_bytes/1024))KB）"

            local temp_dir=$(mktemp -d)
            local dll_path="lib/netstandard2.1/${project_name}.dll"
            mkdir -p "$temp_dir/lib/netstandard2.1"
            cp "$encrypted_dll" "$temp_dir/$dll_path"
            local abs_pkg="$(cd "$(dirname "$latest_package")" && pwd)/$(basename "$latest_package")"
            if ! (cd "$temp_dir" && zip -u "$abs_pkg" "$dll_path" > /dev/null 2>&1); then
                rm -rf "$temp_dir"
                print_warning "替换失败: $project_name"
                return 1
            fi
            rm -rf "$temp_dir"

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

    print_step "npm run build..."
    echo ""
    cd Microi.Client
    if ! npm run build; then
        cd ..
        print_fail "前端编译失败"
    fi
    cd ..
    echo ""
    print_success "前端编译成功"
fi

# ─── 阶段（条件）: 推送 Docker 镜像 ──────────────────────
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

    # 构建镜像
    print_step "构建镜像: $local_image"
    (cd "$build_dir" && docker build -t "$local_image" .)

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

    print_step "构建 VitePress 文档..."
    (cd microi.doc && pnpm docs:build)
    print_success "VitePress 构建完成"

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
