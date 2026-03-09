<template>
    <div class="mobile-workspace">
        <!-- 顶部区域（渐变背景 + 装饰圆） -->
        <div class="ws-header">
            <div class="header-bg">
                <div class="bg-circle c1"></div>
                <div class="bg-circle c2"></div>
            </div>
            <div class="header-content">
                <div class="header-top">
                    <div class="header-left">
                        <img class="ws-logo" :src="logoUrl" alt="logo" />
                        <div class="header-text">
                            <span class="ws-title">工作台</span>
                            <span class="ws-subtitle">{{ appName }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 骨架屏 -->
        <div v-if="loading" class="menu-card-list">
            <div v-for="n in 3" :key="'skeleton-' + n" class="menu-card">
                <div class="card-header skeleton-card-header">
                    <div class="sk-icon-circle"></div>
                    <div class="sk-text-line" style="width: 80px;"></div>
                </div>
                <div class="card-content">
                    <div v-for="m in 4" :key="'skeleton-item-' + m" class="menu-item skeleton-item">
                        <div class="sk-icon-circle small"></div>
                        <div class="sk-text-line" style="width: 60%;"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 菜单卡片列表 -->
        <div v-else class="menu-card-list">
            <!-- 空状态 -->
            <div class="empty-ws" v-if="menuList.length === 0 && !loading">
                <span class="empty-icon">📋</span>
                <span class="empty-text">暂无菜单</span>
                <span class="empty-sub">请联系管理员配置菜单</span>
            </div>

            <div 
                v-for="menu in menuList" 
                :key="menu.Id" 
                class="menu-card"
            >
                <div class="card-header">
                    <div class="card-header-icon">
                        <fa-icon v-if="menu.meta?.icon" :icon="menu.meta.icon" />
                        <el-icon v-else><Folder /></el-icon>
                    </div>
                    <span class="card-title">{{ menu.meta?.title || menu.name }}</span>
                </div>
                <div class="card-content">
                    <div 
                        v-for="child in getVisibleChildren(menu.children)" 
                        :key="child.Id"
                        class="menu-item"
                        @click="handleMenuClick(child)"
                    >
                        <div class="item-icon-wrapper">
                            <fa-icon v-if="child.meta?.icon" :icon="child.meta.icon" class="item-icon" />
                            <el-icon v-else class="item-icon"><Document /></el-icon>
                        </div>
                        <span class="item-name">{{ child.meta?.title || child.name }}</span>
                        <el-icon v-if="child.children && child.children.length > 0" class="item-arrow"><ArrowRight /></el-icon>
                    </div>
                </div>
            </div>

            <!-- 底部 powered by -->
            <div class="ws-footer">
                <span>Powered by {{ companyName || 'Microi.net' }}</span>
            </div>
        </div>

        <!-- 子菜单弹窗 -->
        <el-dialog
            v-model="showSubMenu"
            :title="currentSubMenu?.meta?.title || '子菜单'"
            width="90%"
            class="submenu-dialog"
            :close-on-click-modal="true"
            draggable
            align-center
        >
            <div class="submenu-list">
                <div 
                    v-for="item in getVisibleChildren(currentSubMenuItems)" 
                    :key="item.Id"
                    class="submenu-item"
                    @click="handleSubMenuClick(item)"
                >
                    <div class="submenu-icon-wrapper">
                        <fa-icon v-if="item.meta?.icon" :icon="item.meta.icon" class="submenu-icon" />
                        <el-icon v-else class="submenu-icon"><Document /></el-icon>
                    </div>
                    <span class="submenu-name">{{ item.meta?.title || item.name }}</span>
                    <el-icon v-if="item.children && item.children.length > 0" class="submenu-arrow"><ArrowRight /></el-icon>
                </div>
            </div>
        </el-dialog>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter } from 'vue-router';
import { usePermissionStore, useDiyStore } from '@/pinia';
import { Folder, Document, ArrowRight } from '@element-plus/icons-vue';
import { DiyCommon } from '@/utils/diy.common';

// 定义组件名称，用于 keep-alive 缓存
defineOptions({
    name: 'mobile_workspace'
});

const router = useRouter();
const permissionStore = usePermissionStore();
const diyStore = useDiyStore();

// 加载状态
const loading = ref(true);

// 系统配置信息
const appName = computed(() => diyStore.SysConfig?.SysTitle || diyStore.WebTitle || 'Microi 吾码');
const companyName = computed(() => diyStore.SysConfig?.CompanyName || '');
const logoUrl = computed(() => {
    const logo = diyStore.SysConfig?.SysLogo;
    if (logo && DiyCommon) return DiyCommon.GetServerPath(logo);
    return './static/img/logo/microi-logo.svg';
});

// 过滤出有效的菜单（排除系统路由）
const menuList = computed(() => {
    const routes = permissionStore.routes || [];
    return routes.filter(route => {
        // 排除隐藏菜单和系统路由
        if (route.hidden) return false;
        if (!route.meta?.title) return false;
        // 排除一些系统路由
        const excludePaths = ['/redirect', '/login', '/404', '/401', '/:pathMatch'];
        if (excludePaths.some(p => route.path?.includes(p))) return false;
        // 判断AppDisplay，如果存在且为0表示不在移动端显示
        if (!route.AppDisplay) return false;
        return true;
    });
});

// 订阅清理函数
let _permissionUnsubscribe = null;

// 初始化时检查加载状态
onMounted(() => {
    // 模拟数据加载完成，如果路由已存在则直接显示
    if (permissionStore.routes && permissionStore.routes.length > 0) {
        setTimeout(() => {
            loading.value = false;
        }, 300);
    } else {
        // 监听路由变化，保存取消订阅函数
        _permissionUnsubscribe = permissionStore.$subscribe(() => {
            if (permissionStore.routes && permissionStore.routes.length > 0) {
                loading.value = false;
            }
        });
    }
});

// 组件卸载时清理订阅
onBeforeUnmount(() => {
    if (_permissionUnsubscribe) {
        _permissionUnsubscribe();
        _permissionUnsubscribe = null;
    }
    // 强制恢复 body 滚动（防止 el-dialog 未清理 overflow:hidden）
    _restoreBodyScroll();
});

// 子菜单相关
const showSubMenu = ref(false);
const currentSubMenu = ref(null);
const currentSubMenuItems = ref([]);
const subMenuStack = ref([]); // 用于支持多级菜单返回

/**
 * 强制恢复 body 滚动状态
 * 修复 el-dialog 在移动端 WebView 关闭后残留 overflow:hidden 导致页面无法滚动/点击的 bug
 */
function _restoreBodyScroll() {
    try {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        document.body.classList.remove('el-popup-parent--hidden');
        document.documentElement.classList.remove('el-popup-parent--hidden');
    } catch (e) {}
}

// 监听 dialog 关闭，强制恢复 body 滚动
watch(showSubMenu, (val) => {
    if (!val) {
        // 延迟一帧，等 Element Plus 自己的关闭动画执行完再兜底检查
        setTimeout(_restoreBodyScroll, 300);
    }
});

// 处理菜单点击
const handleMenuClick = (menu) => {
    if (menu.children && menu.children.length > 0) {
        // 有子菜单，打开弹窗
        currentSubMenu.value = menu;
        currentSubMenuItems.value = menu.children;
        subMenuStack.value = [menu];
        showSubMenu.value = true;
    } else {
        // 没有子菜单，直接跳转
        navigateToMenu(menu);
    }
};

// 处理子菜单点击
const handleSubMenuClick = (item) => {
    if (item.children && item.children.length > 0) {
        // 还有下级菜单，继续显示
        subMenuStack.value.push(item);
        currentSubMenu.value = item;
        currentSubMenuItems.value = item.children;
    } else {
        // 最终菜单，跳转
        showSubMenu.value = false;
        navigateToMenu(item);
    }
};

// 导航到菜单
const navigateToMenu = (menu) => {
    if (menu.path) {
        // 处理外部链接
        if (menu.Link && (menu.Link.startsWith('http://') || menu.Link.startsWith('https://'))) {
            window.open(menu.Link, '_blank');
            return;
        }
        router.push(menu.path);
    }
};

// 获取可见的子菜单（根据AppDisplay判断）
const getVisibleChildren = (children) => {
    if (!children || !Array.isArray(children)) return [];
    return children.filter(child => {
        // 如果AppDisplay === 0 表示不在移动端显示
        return child.AppDisplay ? true : false;
    });
};
</script>

<style lang="scss" scoped>
.mobile-workspace {
    min-height: 100vh;
    background: #f5f7fa;
    padding-bottom: 56px;
}

/* 顶部区域 */
.ws-header {
    position: relative;
    background: linear-gradient(135deg, var(--color-primary, #409eff), var(--color-primary-light, #6ba3ff));
    padding: 14px 16px 18px;
    padding-top: calc(14px + var(--status-bar-height, 0px));
    flex-shrink: 0;
    z-index: 10;
}

.header-bg {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    overflow: hidden;
    pointer-events: none;
}

.bg-circle {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);

    &.c1 {
        width: 200px;
        height: 200px;
        top: -50px;
        right: -40px;
    }
    &.c2 {
        width: 125px;
        height: 125px;
        bottom: -30px;
        left: -30px;
    }
}

.header-content {
    position: relative;
    z-index: 1;
}

.header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.header-left {
    display: flex;
    align-items: center;
}

.ws-logo {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.2);
    margin-right: 10px;
    object-fit: cover;
}

.header-text {
    display: flex;
    flex-direction: column;
}

.ws-title {
    font-size: 17px;
    font-weight: 700;
    color: #fff;
}

.ws-subtitle {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
    margin-top: 1px;
}

.menu-card-list {
    padding: 12px;
}

/* 骨架屏 */
.skeleton-card-header {
    display: flex;
    align-items: center;
    gap: 10px;
}

.sk-icon-circle {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: linear-gradient(90deg, rgba(255,255,255,0.3) 25%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.3) 75%);
    background-size: 400% 100%;
    animation: shimmer 1.5s infinite;
    flex-shrink: 0;

    &.small {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
        background-size: 400% 100%;
    }
}

.sk-text-line {
    height: 14px;
    border-radius: 7px;
    background: linear-gradient(90deg, rgba(255,255,255,0.3) 25%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.3) 75%);
    background-size: 400% 100%;
    animation: shimmer 1.5s infinite;
}

.skeleton-item {
    padding: 10px 0;

    .sk-text-line {
        background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
        background-size: 400% 100%;
        height: 12px;
    }
}

.menu-card {
    background: #fff;
    border-radius: 12px;
    margin-bottom: 12px;
    overflow: hidden;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
    transition: transform 0.2s ease;

    &:active {
        transform: scale(0.98);
    }
    
    .card-header {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        background: linear-gradient(135deg, var(--color-primary, #409eff), var(--color-primary-light, #6ba3ff));

        .card-header-icon {
            width: 24px;
            height: 24px;
            background: rgba(255, 255, 255, 0.25);
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 10px;
            flex-shrink: 0;
            font-size: 14px;
            color: #fff !important;

            :deep(.el-icon),
            :deep(svg) {
                color: #fff !important;
                font-size: 14px;
            }
        }
        
        .card-title {
            font-size: 15px;
            font-weight: 600;
            color: #fff !important;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
        }
    }
    
    .card-content {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 4px;
        padding: 14px 10px;
    }
    
    .menu-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 8px 4px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        
        &:active {
            background: #f5f7fa;
            transform: scale(0.95);
        }
        
        .item-icon-wrapper {
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, rgba(var(--color-primary-rgb, 64,158,255), 0.08), rgba(var(--color-primary-rgb, 64,158,255), 0.15));
            border-radius: 10px;
            margin-bottom: 6px;
        }
        
        .item-icon {
            font-size: 20px;
            color: var(--color-primary, #409eff);
        }
        
        .item-name {
            font-size: 12px;
            color: #606266;
            text-align: center;
            line-height: 1.3;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            line-clamp: 2;
            -webkit-box-orient: vertical;
        }
        
        .item-arrow {
            position: absolute;
            top: 6px;
            right: 2px;
            font-size: 10px;
            color: #c0c4cc;
        }
    }
}

/* 空状态 */
.empty-ws {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 80px 0;

    .empty-icon {
        font-size: 48px;
        margin-bottom: 12px;
    }

    .empty-text {
        font-size: 15px;
        color: #666;
        font-weight: 500;
    }

    .empty-sub {
        font-size: 12px;
        color: #999;
        margin-top: 4px;
    }
}

/* Footer */
.ws-footer {
    text-align: center;
    padding: 24px 0 40px;

    span {
        font-size: 11px;
        color: #ccc;
    }
}

// 子菜单弹窗样式
:deep(.submenu-dialog) {
    .el-dialog__header {
        padding: 16px;
        border-bottom: 1px solid #ebeef5;
        margin-right: 0;
        
        .el-dialog__title {
            font-size: 16px;
            font-weight: 600;
        }
    }
    
    .el-dialog__body {
        padding: 0;
        max-height: 60vh;
        overflow-y: auto;
    }
}

.submenu-list {
    .submenu-item {
        display: flex;
        align-items: center;
        padding: 14px 16px;
        border-bottom: 1px solid #f5f7fa;
        cursor: pointer;
        transition: background 0.2s;
        
        &:active {
            background: #f5f7fa;
        }
        
        &:last-child {
            border-bottom: none;
        }
        
        .submenu-icon-wrapper {
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, rgba(var(--color-primary-rgb, 64,158,255), 0.08), rgba(var(--color-primary-rgb, 64,158,255), 0.15));
            border-radius: 8px;
            margin-right: 12px;
        }
        
        .submenu-icon {
            font-size: 18px;
            color: var(--color-primary, #409eff);
        }
        
        .submenu-name {
            flex: 1;
            font-size: 15px;
            color: #303133;
        }
        
        .submenu-arrow {
            font-size: 14px;
            color: #c0c4cc;
        }
    }
}

@keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
</style>
