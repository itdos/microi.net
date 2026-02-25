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
const hideTabBar = computed(() => {
    // 1. 检查 vue-router query 参数
    if (route.query.hideTabBar === '1' || route.query.hideTabBar === 'true') return true;
    // 2. 检查 URL hash 中的参数（hash 路由模式下参数可能在 hash 里）
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

const activeTab = computed(() => {
    const currentPath = route.path;
    if (currentPath.includes('/mobile/workspace')) return 'workspace';
    if (currentPath.includes('/mobile/message') || currentPath.includes('/mobile/chat')) return 'message';
    if (currentPath.includes('/mobile/profile')) return 'mine';
    if (currentPath.includes('/mobile/home') || currentPath === '/') return 'home';
    return 'home';
});

const handleTabClick = (item) => {
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
    background-color: #fff;
    display: flex;
    justify-content: space-around;
    align-items: center;
    border-top: 1px solid #e4e7ed;
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
            color: #909399;
            margin-bottom: 2px;
            transition: all 0.2s ease;
        }

        .tabbar-label {
            font-size: 11px;
            color: #909399;
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
