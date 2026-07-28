<template>
    <div
        v-if="diyStore.IsPhoneView && !hideTabBar"
        class="mobile-tabbar-shell"
        :class="{ 'mobile-tabbar-shell--with-ai': aiAssistantEnabled }"
    >
        <nav class="mobile-tabbar" aria-label="移动端主导航">
            <button
                v-for="item in tabbarItems"
                :key="item.name"
                type="button"
                class="tabbar-item"
                :class="{ active: activeTab === item.name }"
                :aria-current="activeTab === item.name ? 'page' : undefined"
                @click="handleTabClick(item)"
            >
                <el-icon class="tabbar-icon" :size="23">
                    <component :is="item.icon" />
                </el-icon>
                <span class="tabbar-label">{{ item.label }}</span>
            </button>
        </nav>

        <button
            v-if="aiAssistantEnabled"
            type="button"
            class="mobile-ai-entry"
            data-testid="mobile-ai-entry"
            aria-label="打开AI助手"
            title="AI助手"
            @click="openAiAssistant"
        >
            <span class="mobile-ai-entry__ring" aria-hidden="true"></span>
            <img
                class="mobile-ai-entry__robot"
                src="/static/mci/ai/assistant-robot.png"
                alt=""
                aria-hidden="true"
            />
            <span class="mobile-ai-entry__label">AI</span>
        </button>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useDiyStore } from '@/pinia';
import { HomeFilled, Grid, ChatDotRound, User } from '@element-plus/icons-vue';
import { createMobileAiAssistantRoute, isMobileAiAssistantEnabled } from './mobile-ai-entry.js';

const router = useRouter();
const route = useRoute();
const diyStore = useDiyStore();

// 与小程序保持同一开关：只有当前租户明确开启 IsShowAiAssistant 时才展示。
const aiAssistantEnabled = computed(() => isMobileAiAssistantEnabled(diyStore.SysConfig));

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

const openAiAssistant = () => {
    router.push(createMobileAiAssistantRoute());
};
</script>

<style lang="scss" scoped>
.mobile-tabbar-shell {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: flex-end;
    gap: 9px;
    box-sizing: border-box;
    padding: 4px max(10px, var(--mci-safe-right, env(safe-area-inset-right, 0px)))
        calc(4px + var(--mci-safe-bottom, env(safe-area-inset-bottom, 0px)))
        max(10px, var(--mci-safe-left, env(safe-area-inset-left, 0px)));
    z-index: 999;
    pointer-events: none;
}

.mobile-tabbar {
    min-width: 0;
    height: 52px;
    flex: 1;
    display: flex;
    justify-content: space-around;
    align-items: center;
    overflow: hidden;
    border: 1px solid var(--mci-border-color, var(--el-border-color-lighter, #e4e7ed));
    border-radius: 28px;
    background: var(--mci-bg-elevated, var(--el-bg-color, #fff));
    box-shadow: 0 -2px 10px rgba(15, 23, 42, 0.06), 0 5px 18px rgba(15, 23, 42, 0.08);
    pointer-events: auto;

    .tabbar-item {
        flex: 1;
        align-self: stretch;
        min-width: 44px;
        min-height: 44px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        appearance: none;
        border: 0;
        background: transparent;
        cursor: pointer;
        transition: color 0.2s ease, transform 0.2s ease, background-color 0.2s ease;
        padding: 3px 0;
        
        .tabbar-icon {
            color: var(--mci-text-tertiary, var(--el-text-color-secondary, #909399));
            margin-bottom: 2px;
            transition: color 0.2s ease, transform 0.2s ease;
        }

        .tabbar-label {
            font-size: 11px;
            line-height: 1;
            color: var(--mci-text-tertiary, var(--el-text-color-secondary, #909399));
            transition: color 0.2s ease;
        }

        &.active {
            .tabbar-icon,
            .tabbar-label {
                color: var(--mci-color-primary, var(--color-primary, #409eff));
            }

            .tabbar-icon { transform: translateY(-1px) scale(1.06); }
        }

        &:active {
            transform: scale(0.95);
            background: var(--mci-bg-card-hover, rgba(64, 158, 255, 0.08));
        }
    }
}

.mobile-ai-entry {
    position: relative;
    flex: 0 0 54px;
    width: 54px;
    height: 54px;
    min-width: 54px;
    min-height: 54px;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    box-sizing: border-box;
    appearance: none;
    padding: 0;
    border: 1px solid var(--mci-border-color, var(--el-border-color-lighter, #e4e7ed));
    border-radius: 50%;
    background: var(--mci-bg-elevated, var(--el-bg-color, #fff));
    color: var(--mci-color-primary, var(--color-primary, #409eff));
    box-shadow: 0 -2px 10px rgba(15, 23, 42, 0.06), 0 5px 18px rgba(15, 23, 42, 0.12);
    cursor: pointer;
    pointer-events: auto;
    transition: transform 0.18s ease, border-color 0.18s ease;
}

.mobile-ai-entry__ring {
    position: absolute;
    inset: 3px;
    border: 1px solid rgba(24, 166, 184, 0.22);
    border-radius: 50%;
    pointer-events: none;
    animation: mobileAiSlotPulse 2.8s ease-in-out infinite;
}

.mobile-ai-entry__robot {
    position: relative;
    z-index: 1;
    width: 37px;
    height: 37px;
    margin-top: -4px;
    object-fit: contain;
    pointer-events: none;
}

.mobile-ai-entry__label {
    position: absolute;
    z-index: 2;
    right: 0;
    bottom: 2px;
    left: 0;
    color: var(--mci-color-primary, var(--color-primary, #409eff));
    font-size: 9px;
    line-height: 11px;
    font-weight: 800;
    text-align: center;
    pointer-events: none;
}

.mobile-ai-entry:active { transform: scale(0.94); }
.mobile-ai-entry:focus-visible,
.tabbar-item:focus-visible {
    outline: 2px solid var(--mci-color-primary, var(--color-primary, #409eff));
    outline-offset: 2px;
}

@keyframes mobileAiSlotPulse {
    0%, 100% { transform: scale(0.96); opacity: 0.45; }
    50% { transform: scale(1); opacity: 0.9; }
}

@media (prefers-reduced-motion: reduce) {
    .mobile-ai-entry,
    .mobile-tabbar .tabbar-item,
    .mobile-tabbar .tabbar-icon { transition: none; }
    .mobile-ai-entry__ring { animation: none; }
}
</style>
