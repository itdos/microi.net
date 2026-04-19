<template>
    <div v-if="diyStore.IsPhoneView && !hideTabBar" class="mobile-tabbar">
        <div 
            v-for="item in tabbarItems" 
            :key="item.name"
            class="tabbar-item"
            :class="{ active: activeTab === item.name }"
            @click="handleTabClick(item)"
        >
            <el-icon class="tabbar-icon" :size="24">
                <component :is="item.icon" />
            </el-icon>
            <span class="tabbar-label">{{ item.label }}</span>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useDiyStore } from '@/pinia';
import { HomeFilled, Grid, ChatDotRound, User } from '@element-plus/icons-vue';

const router = useRouter();
const route = useRoute();
const diyStore = useDiyStore();

// 支持 URL 参数 hideTabBar=1 隐藏底部菜单（小程序 webview 跳转场景）
// 同时支持 diyStore.IsMiniProgram 全局标识（避免路由跳转后 URL 参数丢失）
const hideTabBar = computed(() => {
    // 1. 全局小程序标识（由 App.vue 初始化时检测，路由变化不丢失）
    if (diyStore.IsMiniProgram) return true;
    // 2. 检查 vue-router query 参数
    if (route.query.hideTabBar === '1' || route.query.hideTabBar === 'true') return true;
    // 3. 检查 URL hash 中的参数（hash 路由模式下参数可能在 hash 里）
    try {
        const hash = window.location.hash;
        if (hash && hash.includes('hideTabBar=1')) return true;
        const search = window.location.search;
        if (search && search.includes('hideTabBar=1')) return true;
    } catch (e) {}
    return false;
});

const tabbarItems = [
    {
        name: 'home',
        label: '首页',
        icon: HomeFilled,
        path: '/'
    },
    {
        name: 'workspace',
        label: '工作台',
        icon: Grid,
        path: '/mobile/workspace'
    },
    {
        name: 'message',
        label: '消息',
        icon: ChatDotRound,
        path: '/mobile/message'
    },
    {
        name: 'mine',
        label: '我的',
        icon: User,
        path: '/mobile/profile'
    }
];

// 记录最后一次主动点击的 tab，用于从工作台跳转到子页面时保持高亮
// 根据初始路由推断默认值：大多数数据列表页从工作台进入
const getInitialTab = () => {
    const path = route.path;
    if (path.includes('/mobile/workspace')) return 'workspace';
    if (path.includes('/mobile/message') || path.includes('/mobile/chat')) return 'message';
    if (path.includes('/mobile/profile')) return 'mine';
    if (path.includes('/mobile/home') || path === '/') return 'home';
    // 不属于任何 tab 直属页面（如数据列表页），默认为工作台
    return 'workspace';
};
const lastClickedTab = ref(getInitialTab());

const activeTab = computed(() => {
    const currentPath = route.path;
    if (currentPath.includes('/mobile/workspace')) return 'workspace';
    if (currentPath.includes('/mobile/message') || currentPath.includes('/mobile/chat')) return 'message';
    if (currentPath.includes('/mobile/profile')) return 'mine';
    if (currentPath.includes('/mobile/home') || currentPath === '/') return 'home';
    // 当前路径不属于任何 tab 页（例如从工作台进入的数据列表），保持最后一次点击的 tab 高亮
    return lastClickedTab.value;
});

const handleTabClick = (item) => {
    lastClickedTab.value = item.name;
    if (route.path !== item.path) {
        router.push(item.path);
    }
};
</script>

<style lang="scss" scoped>
.mobile-tabbar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 50px;
    background-color: var(--el-bg-color, #fff);
    display: flex;
    justify-content: space-around;
    align-items: center;
    border-top: 1px solid var(--el-border-color-lighter, #e4e7ed);
    z-index: 999;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.06);
    padding-bottom: env(safe-area-inset-bottom);

    .tabbar-item {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        padding: 4px 0;
        
        .tabbar-icon {
            color: var(--el-text-color-secondary, #909399);
            margin-bottom: 2px;
            transition: all 0.2s ease;
        }

        .tabbar-label {
            font-size: 11px;
            color: var(--el-text-color-secondary, #909399);
            transition: all 0.2s ease;
        }

        &.active {
            .tabbar-icon,
            .tabbar-label {
                color: var(--color-primary, #409eff);
            }
        }

        &:active {
            transform: scale(0.95);
        }
    }
}
</style>
