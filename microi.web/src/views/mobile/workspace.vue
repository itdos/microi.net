<template>
    <div class="mobile-workspace">
        <!-- 顶部标题栏 -->
        <div class="workspace-header">
            <span class="header-title">工作台</span>
        </div>

        <!-- 骨架屏 -->
        <div v-if="loading" class="menu-card-list">
            <div v-for="n in 3" :key="'skeleton-' + n" class="menu-card">
                <div class="card-header">
                    <el-skeleton animated>
                        <template #template>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <el-skeleton-item variant="circle" style="width: 24px; height: 24px;" />
                                <el-skeleton-item variant="text" style="width: 80px; height: 20px;" />
                            </div>
                        </template>
                    </el-skeleton>
                </div>
                <div class="card-content">
                    <div v-for="m in 4" :key="'skeleton-item-' + m" class="menu-item skeleton-item">
                        <el-skeleton animated>
                            <template #template>
                                <div style="display: flex; align-items: center; gap: 10px; width: 100%;">
                                    <el-skeleton-item variant="circle" style="width: 36px; height: 36px;" />
                                    <el-skeleton-item variant="text" style="width: 60%; height: 16px;" />
                                </div>
                            </template>
                        </el-skeleton>
                    </div>
                </div>
            </div>
        </div>

        <!-- 菜单卡片列表 -->
        <div v-else class="menu-card-list">
            <div 
                v-for="menu in menuList" 
                :key="menu.Id" 
                class="menu-card"
            >
                <div class="card-header">
                    <fa-icon v-if="menu.meta?.icon" :icon="menu.meta.icon" class="card-icon" />
                    <el-icon v-else class="card-icon"><Folder /></el-icon>
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
        </div>

        <!-- 子菜单弹窗 -->
        <el-dialog
            v-model="showSubMenu"
            :title="currentSubMenu?.meta?.title || '子菜单'"
            width="90%"
            class="submenu-dialog"
            :close-on-click-modal="true"
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
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { usePermissionStore, useDiyStore } from '@/pinia';
import { Folder, Document, ArrowRight } from '@element-plus/icons-vue';

// 定义组件名称，用于 keep-alive 缓存
defineOptions({
    name: 'mobile_workspace'
});

const router = useRouter();
const permissionStore = usePermissionStore();
const diyStore = useDiyStore();

// 加载状态
const loading = ref(true);

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
        if (!route.Display) return false;
        return true;
    });
});

// 初始化时检查加载状态
onMounted(() => {
    // 模拟数据加载完成，如果路由已存在则直接显示
    if (permissionStore.routes && permissionStore.routes.length > 0) {
        setTimeout(() => {
            loading.value = false;
        }, 300);
    } else {
        // 监听路由变化
        const unwatch = permissionStore.$subscribe(() => {
            if (permissionStore.routes && permissionStore.routes.length > 0) {
                loading.value = false;
            }
        });
    }
});

// 子菜单相关
const showSubMenu = ref(false);
const currentSubMenu = ref(null);
const currentSubMenuItems = ref([]);
const subMenuStack = ref([]); // 用于支持多级菜单返回

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
        return child.Display ? true : false;
    });
};
</script>

<style lang="scss" scoped>
.mobile-workspace {
    min-height: 100vh;
    background: #f5f7fa;
    padding-bottom: 70px;
}

.workspace-header {
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 50px;
    background: #fff;
    border-bottom: 1px solid #ebeef5;
    
    .header-title {
        font-size: 17px;
        font-weight: 600;
        color: #303133;
    }
}

.menu-card-list {
    padding: 12px;
}

// 骨架屏样式
.skeleton-item {
    padding: 10px 12px;
}

.menu-card {
    background: #fff;
    border-radius: 12px;
    margin-bottom: 12px;
    overflow: hidden;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
    
    .card-header {
        display: flex;
        align-items: center;
        padding: 14px 16px;
        background: var(--color-primary, #409eff);
        
        .card-icon {
            font-size: 20px;
            color: #fff !important;
            margin-right: 10px;
        }
        
        .card-title {
            font-size: 16px;
            font-weight: 600;
            color: #fff !important;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }
    }
    
    .card-content {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
        padding: 16px 12px;
    }
    
    .menu-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 0px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        
        &:active {
            background: #f5f7fa;
            transform: scale(0.95);
        }
        
        .item-icon-wrapper {
            width: 44px;
            height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #f0f5ff 0%, #e6f0ff 100%);
            border-radius: 12px;
            margin-bottom: 8px;
        }
        
        .item-icon {
            font-size: 22px;
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
            top: 8px;
            right: 4px;
            font-size: 12px;
            color: #c0c4cc;
        }
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
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #f0f5ff 0%, #e6f0ff 100%);
            border-radius: 10px;
            margin-right: 12px;
        }
        
        .submenu-icon {
            font-size: 20px;
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
</style>
