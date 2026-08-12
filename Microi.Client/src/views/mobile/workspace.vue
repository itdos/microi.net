<template>
    <div class="mci-mobile-page page-workspace">
        <!-- 顶部 Hero 区域：渐变背景 + 装饰光斑 -->
        <header class="ws-hero">
            <div class="ws-hero__decor">
                <span class="decor-orb decor-orb--1"></span>
                <span class="decor-orb decor-orb--2"></span>
            </div>
            <div class="ws-hero__safe-top"></div>
            <div class="ws-hero__row">
                <div class="ws-hero__brand">
                    <img v-if="logoUrl" class="ws-hero__logo" :src="logoUrl" alt="logo" />
                    <div class="ws-hero__text">
                        <span class="ws-hero__title">{{ appName }}</span>
                        <span class="ws-hero__subtitle">{{ appName }}</span>
                    </div>
                </div>
                <!-- <span class="mci-navbar__action ws-hero__theme"></span> -->
            </div>
            <div class="ws-search">
                <el-input
                    v-model="searchKeyword"
                    class="ws-search__input"
                    :placeholder="$t('Msg.Mobile.workspace.searchPlaceholder')"
                    clearable
                >
                    <template #prefix>
                        <el-icon><Search /></el-icon>
                    </template>
                </el-input>
            </div>
        </header>

        <!-- 骨架屏 -->
        <div v-if="loading" class="menu-list">
            <div v-for="n in 3" :key="'sk-' + n" class="menu-card mci-card">
                <div class="menu-card__head">
                    <div class="sk-circle"></div>
                    <div class="sk-line" style="width: 80px;"></div>
                </div>
                <div class="menu-card__grid">
                    <div v-for="m in 4" :key="'sk-i-' + m" class="menu-item">
                        <div class="sk-circle sk-circle--lg"></div>
                        <div class="sk-line" style="width: 60%;"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 菜单列表 -->
        <div v-else class="menu-list">
            <section v-if="hasSearchKeyword" class="search-panel mci-card">
                <header class="search-panel__head">
                    <div>
                        <span class="search-panel__eyebrow">{{ $t("Msg.Mobile.workspace.quickLocate") }}</span>
                        <h2 class="search-panel__title">{{ $t("Msg.Mobile.workspace.searchResults") }}</h2>
                    </div>
                    <span class="search-panel__count">{{ $t("Msg.Mobile.workspace.resultCount", { count: searchResults.length }) }}</span>
                </header>

                <div v-if="searchResults.length > 0" class="search-results">
                    <button
                        v-for="item in searchResults"
                        :key="item.key"
                        type="button"
                        class="search-result-item"
                        @click="handleMenuClick(item.menu)"
                    >
                        <span class="search-result-item__icon">
                            <fa-icon v-if="item.menu.meta?.icon" :icon="item.menu.meta.icon" />
                            <el-icon v-else-if="hasVisibleChildMenus(item.menu)"><Folder /></el-icon>
                            <el-icon v-else><Document /></el-icon>
                        </span>
                        <span class="search-result-item__body">
                            <span class="search-result-item__title">{{ item.title }}</span>
                            <span class="search-result-item__sub">{{ item.subtitle || item.path }}</span>
                        </span>
                        <el-icon class="search-result-item__arrow"><ArrowRight /></el-icon>
                    </button>
                </div>

                <div v-else class="empty-state empty-state--search">
                    <el-icon class="empty-state__search-icon"><Search /></el-icon>
                    <span class="empty-state__title">{{ $t("Msg.Mobile.workspace.noMatch") }}</span>
                    <span class="empty-state__sub">{{ $t("Msg.Mobile.workspace.tryAnother") }}</span>
                </div>
            </section>

            <template v-else>
                <!-- 空状态 -->
                <div v-if="menuList.length === 0" class="empty-state mci-card">
                    <span class="empty-state__icon">📁</span>
                    <span class="empty-state__title">{{ $t("Msg.Mobile.workspace.noMenu") }}</span>
                    <span class="empty-state__sub">{{ $t("Msg.Mobile.workspace.contactAdmin") }}</span>
                </div>

                <article
                    v-for="(menu, idx) in menuList"
                    :key="menu.Id"
                    class="menu-card mci-card mci-stagger-item"
                    :style="{ '--mci-index': idx }"
                >
                    <header class="menu-card__head">
                        <div class="menu-card__head-icon">
                            <fa-icon v-if="menu.meta?.icon" :icon="menu.meta.icon" />
                            <el-icon v-else><Folder /></el-icon>
                        </div>
                        <span class="menu-card__title">{{ menu.meta?.title || menu.name }}</span>
                    </header>
                    <div class="menu-card__grid">
                        <div
                            v-for="child in getVisibleChildren(menu.children)"
                            :key="child.Id"
                            class="menu-item"
                            @click="handleMenuClick(child)"
                        >
                            <div class="menu-item__icon">
                                <fa-icon v-if="child.meta?.icon" :icon="child.meta.icon" />
                                <el-icon v-else><Document /></el-icon>
                            </div>
                            <span class="menu-item__name">{{ child.meta?.title || child.name }}</span>
                            <el-icon
                                v-if="hasVisibleChildMenus(child) && !isPhoneView"
                                class="menu-item__arrow"
                            ><ArrowRight /></el-icon>
                        </div>
                    </div>
                </article>
            </template>

            <!-- Footer -->
            <footer class="ws-footer">
                <span>Powered by {{ companyName || 'Microi.net' }}</span>
            </footer>
        </div>

        <!-- 子菜单弹窗 -->
        <el-dialog
            v-model="showSubMenu"
            :title="currentSubMenu?.meta?.title || $t('Msg.Mobile.workspace.submenu')"
            width="92%"
            class="mci-submenu-dialog"
            :close-on-click-modal="true"
            draggable
            align-center
        >
            <div class="submenu-list">
                <div
                    v-for="item in getVisibleChildren(currentSubMenuItems)"
                    :key="item.Id"
                    class="mci-cell"
                    @click="handleSubMenuClick(item)"
                >
                    <div class="mci-cell__icon">
                        <fa-icon v-if="item.meta?.icon" :icon="item.meta.icon" />
                        <el-icon v-else><Document /></el-icon>
                    </div>
                    <span class="mci-cell__title">{{ item.meta?.title || item.name }}</span>
                    <el-icon
                        v-if="hasVisibleChildMenus(item)"
                        class="mci-cell__arrow"
                    ><ArrowRight /></el-icon>
                </div>
            </div>
        </el-dialog>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { usePermissionStore, useDiyStore } from '@/pinia';
import { Folder, Document, ArrowRight, Search } from '@element-plus/icons-vue';
import { DiyCommon } from '@/utils/diy.common';
import { isExplicitlyHiddenOnMobile } from './mobile-menu-visibility';

defineOptions({
    name: 'mobile_workspace'
});

const router = useRouter();
const permissionStore = usePermissionStore();
const diyStore = useDiyStore();
const { t } = useI18n();

const loading = ref(true);
const searchKeyword = ref('');

const isPhoneView = computed(() => diyStore.IsPhoneView);
const appName = computed(() => diyStore.SysConfig?.SysTitle || diyStore.WebTitle || t('Msg.Mobile.workspace.appName'));
const companyName = computed(() => diyStore.SysConfig?.CompanyName || '');
const logoUrl = computed(() => {
    const logo = diyStore.SysConfig?.SysLogo;
    if (logo && DiyCommon) return DiyCommon.GetServerPath(logo);
    return './static/img/logo/microi-logo.svg';
});

const menuList = computed(() => {
    const routes = permissionStore.routes || [];
    return routes.filter(route => {
        if (route.hidden) return false;
        if (!route.meta?.title) return false;
        const excludePaths = ['/redirect', '/login', '/404', '/401', '/:pathMatch'];
        if (excludePaths.some(p => route.path?.includes(p))) return false;
        const appDisplay = route.AppDisplay ?? route.meta?.AppDisplay;
        if (isExplicitlyHiddenOnMobile(appDisplay)) return false;
        return true;
    });
});

let _permissionUnsubscribe = null;

onMounted(() => {
    if (permissionStore.routes && permissionStore.routes.length > 0) {
        setTimeout(() => { loading.value = false; }, 300);
    } else {
        _permissionUnsubscribe = permissionStore.$subscribe(() => {
            if (permissionStore.routes && permissionStore.routes.length > 0) {
                loading.value = false;
            }
        });
    }
});

onBeforeUnmount(() => {
    if (_permissionUnsubscribe) {
        _permissionUnsubscribe();
        _permissionUnsubscribe = null;
    }
    _restoreBodyScroll();
});

const showSubMenu = ref(false);
const currentSubMenu = ref(null);
const currentSubMenuItems = ref([]);
const subMenuStack = ref([]);

/**
 * 强制恢复 body 滚动状态
 * 修复 el-dialog 在移动端 WebView 环境下overflow:hidden 可能残留导致页面不能滚动的问题
 */
function _restoreBodyScroll() {
    try {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        document.body.classList.remove('el-popup-parent--hidden');
        document.documentElement.classList.remove('el-popup-parent--hidden');
    } catch (e) { /* ignore */ }
}

watch(showSubMenu, (val) => {
    if (!val) {
        setTimeout(_restoreBodyScroll, 300);
    }
});

const handleMenuClick = (menu) => {
    if (hasVisibleChildMenus(menu)) {
        currentSubMenu.value = menu;
        currentSubMenuItems.value = getVisibleChildren(menu.children);
        subMenuStack.value = [menu];
        showSubMenu.value = true;
    } else {
        navigateToMenu(menu);
    }
};

const handleSubMenuClick = (item) => {
    if (hasVisibleChildMenus(item)) {
        subMenuStack.value.push(item);
        currentSubMenu.value = item;
        currentSubMenuItems.value = getVisibleChildren(item.children);
    } else {
        showSubMenu.value = false;
        navigateToMenu(item);
    }
};

const navigateToMenu = (menu) => {
    if (menu.path) {
        if (menu.Link && (menu.Link.startsWith('http://') || menu.Link.startsWith('https://'))) {
            window.open(menu.Link, '_blank', 'noopener,noreferrer');
            return;
        }
        router.push(menu.path);
    }
};

const getVisibleChildren = (children) => {
    if (!children || !Array.isArray(children)) return [];
    return children.filter(child => {
        const appDisplay = child.AppDisplay ?? child.meta?.AppDisplay;
        return !isExplicitlyHiddenOnMobile(appDisplay)
            && child.Display !== 0
            && child.Display !== "0"
            && !child.hidden;
    });
};

const hasVisibleChildMenus = (menu) => {
    return getVisibleChildren(menu?.children).length > 0;
};

const getMenuTitle = (menu) => {
    return menu?.meta?.title || menu?.title || menu?.name || menu?.path || '';
};

const getMenuKey = (menu, fallback) => {
    return menu?.Id || menu?.id || menu?.name || menu?.path || fallback;
};

const flattenVisibleMenus = (menus, ancestors = []) => {
    if (!Array.isArray(menus)) return [];
    const result = [];

    menus.forEach((menu, index) => {
        const title = getMenuTitle(menu);
        const children = getVisibleChildren(menu.children);
        const subtitle = ancestors.filter(Boolean).join(' / ');
        const pathText = menu.path || menu.fullPath || '';
        const searchText = [
            title,
            subtitle,
            pathText,
            menu.name,
            menu.Link
        ].filter(Boolean).join(' ').toLocaleLowerCase();

        result.push({
            key: `${getMenuKey(menu, index)}-${index}-${ancestors.length}`,
            menu,
            title,
            subtitle: subtitle || (children.length ? t('Msg.Mobile.workspace.directoryMenu') : pathText),
            path: pathText,
            searchText
        });

        if (children.length > 0) {
            result.push(...flattenVisibleMenus(children, [...ancestors, title]));
        }
    });

    return result;
};

const normalizedSearchKeyword = computed(() => searchKeyword.value.trim().toLocaleLowerCase());
const hasSearchKeyword = computed(() => normalizedSearchKeyword.value.length > 0);
const searchableMenus = computed(() => flattenVisibleMenus(menuList.value));
const searchResults = computed(() => {
    const keywords = normalizedSearchKeyword.value.split(/\s+/).filter(Boolean);
    if (keywords.length === 0) return [];
    return searchableMenus.value
        .filter(item => keywords.every(keyword => item.searchText.includes(keyword)))
        .slice(0, 80);
});

</script>

<style lang="scss" scoped>
.page-workspace {
    padding-bottom: calc(var(--mci-tabbar-height) + var(--mci-safe-bottom) + var(--mci-space-6));
}

/* === Hero 区域 === */
.ws-hero {
    position: relative;
    overflow: hidden;
    background: var(--mci-gradient-primary);
    padding: var(--mci-space-4);
    // padding-bottom: var(--mci-space-6);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25),
                0 0 40px var(--mci-color-primary-glow);

    &__safe-top { height: var(--mci-safe-top); }

    &__decor {
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
    }

    &__row {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    &__brand {
        display: flex;
        align-items: center;
        gap: var(--mci-space-3);
    }

    &__logo {
        width: 40px;
        height: 40px;
        border-radius: var(--mci-radius-md);
        background: rgba(255, 255, 255, 0.2);
        object-fit: cover;
        backdrop-filter: blur(4px);
    }

    &__text {
        display: flex;
        flex-direction: column;
    }

    &__title {
        font-size: var(--mci-text-lg);
        font-weight: var(--mci-font-bold);
        color: #fff;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    &__subtitle {
        font-size: var(--mci-text-xs);
        color: rgba(255, 255, 255, 0.8);
        margin-top: 2px;
    }

    &__theme {
        color: #fff;
        background: rgba(255, 255, 255, 0.15);
        border-radius: var(--mci-radius-full);
    }
}

.ws-search {
    position: relative;
    z-index: 1;
    margin-top: var(--mci-space-4);

    &__input {
        :deep(.el-input__wrapper) {
            min-height: 44px;
            border-radius: var(--mci-radius-full);
            background: rgba(255, 255, 255, 0.92);
            border: 1px solid rgba(255, 255, 255, 0.42);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
            padding: 0 var(--mci-space-4);
        }

        :deep(.el-input__inner) {
            color: #1f2937;
            font-size: var(--mci-text-sm);
        }

        :deep(.el-input__prefix) {
            color: var(--mci-color-primary);
        }

        :deep(.el-input__clear) {
            color: #64748b;
        }
    }
}

.decor-orb {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    animation: orbDrift 8s ease-in-out infinite alternate;

    &--1 {
        width: 200px;
        height: 200px;
        top: -60px;
        right: -50px;
    }
    &--2 {
        width: 130px;
        height: 130px;
        bottom: -40px;
        left: -30px;
        animation-delay: -4s;
    }
}

@keyframes orbDrift {
    from { transform: translate(0, 0) scale(1); }
    to { transform: translate(15px, -10px) scale(1.06); }
}

/* === 菜单列表 === */
.menu-list {
    padding: var(--mci-space-3);
    display: flex;
    flex-direction: column;
    gap: var(--mci-space-2);
}

.menu-card {
    padding: 0;
    overflow: hidden;

    &__head {
        display: flex;
        align-items: center;
        gap: var(--mci-space-3);
        padding: var(--mci-space-2) var(--mci-space-4);
        background: linear-gradient(135deg,
            rgba(114, 43, 255, 0.18),
            rgba(41, 184, 255, 0.12));
        border-bottom: 1px solid var(--mci-border-color);
    }

    &__head-icon {
        width: 28px;
        height: 28px;
        border-radius: var(--mci-radius-sm);
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--mci-gradient-primary);
        color: var(--mci-text-on-primary);
        font-size: 13px;
        box-shadow: 0 2px 8px var(--mci-color-primary-glow);
        flex-shrink: 0;

        :deep(svg),
        :deep(.el-icon) { color: #fff; font-size: 13px; }
    }

    &__title {
        font-size: var(--mci-text-base);
        font-weight: var(--mci-font-semibold);
        color: var(--mci-text-primary);
    }

    &__grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: var(--mci-space-1);
        padding: var(--mci-space-1);
    }
}

.menu-item {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--mci-space-2);
    padding: var(--mci-space-2) var(--mci-space-1);
    border-radius: var(--mci-radius-md);
    cursor: pointer;
    transition: transform var(--mci-duration-fast) var(--mci-ease-out),
                background var(--mci-duration-fast) var(--mci-ease-out);

    &:active {
        transform: scale(0.94);
        background: var(--mci-bg-card-hover);
    }

    &__icon {
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg,
            rgba(114, 43, 255, 0.12),
            rgba(41, 184, 255, 0.12));
        border: 1px solid var(--mci-border-color);
        border-radius: var(--mci-radius-md);
        font-size: 20px;
        color: var(--mci-color-primary-light);
        transition: box-shadow var(--mci-duration-base) var(--mci-ease-out);
    }

    &:active &__icon {
        box-shadow: 0 0 12px var(--mci-color-primary-glow);
    }

    &__name {
        font-size: var(--mci-text-xs);
        color: var(--mci-text-secondary);
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

    &__arrow {
        position: absolute;
        top: 4px;
        right: 2px;
        font-size: 10px;
        color: var(--mci-text-tertiary);
    }
}

/* === 搜索结果 === */
.search-panel {
    padding: var(--mci-space-4);
    overflow: hidden;

    &__head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--mci-space-3);
        margin-bottom: var(--mci-space-3);
    }

    &__eyebrow {
        display: block;
        font-size: var(--mci-text-xs);
        color: var(--mci-color-primary-light);
        font-weight: var(--mci-font-medium);
        margin-bottom: 2px;
    }

    &__title {
        margin: 0;
        font-size: var(--mci-text-lg);
        line-height: 1.35;
        color: var(--mci-text-primary);
        font-weight: var(--mci-font-bold);
    }

    &__count {
        flex-shrink: 0;
        min-width: 48px;
        border-radius: var(--mci-radius-full);
        background: rgba(114, 43, 255, 0.12);
        color: var(--mci-color-primary-light);
        font-size: var(--mci-text-xs);
        font-weight: var(--mci-font-medium);
        text-align: center;
        padding: 4px var(--mci-space-2);
    }
}

.search-results {
    display: flex;
    flex-direction: column;
    gap: var(--mci-space-2);
}

.search-result-item {
    width: 100%;
    min-height: 58px;
    display: flex;
    align-items: center;
    gap: var(--mci-space-3);
    border: 1px solid var(--mci-border-color);
    border-radius: var(--mci-radius-lg);
    background: linear-gradient(135deg,
        rgba(255, 255, 255, 0.06),
        rgba(114, 43, 255, 0.06));
    color: inherit;
    text-align: left;
    padding: var(--mci-space-3);
    cursor: pointer;
    transition: transform var(--mci-duration-fast) var(--mci-ease-out),
                background var(--mci-duration-fast) var(--mci-ease-out);

    &:active {
        transform: scale(0.98);
        background: var(--mci-bg-card-hover);
    }

    &__icon {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        border-radius: var(--mci-radius-md);
        background: var(--mci-gradient-primary);
        color: var(--mci-text-on-primary);
        box-shadow: 0 4px 14px var(--mci-color-primary-glow);

        :deep(svg),
        :deep(.el-icon) {
            color: #fff;
            font-size: 16px;
        }
    }

    &__body {
        min-width: 0;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    &__title {
        color: var(--mci-text-primary);
        font-size: var(--mci-text-sm);
        font-weight: var(--mci-font-semibold);
        line-height: 1.35;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    &__sub {
        color: var(--mci-text-tertiary);
        font-size: var(--mci-text-xs);
        line-height: 1.4;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    &__arrow {
        flex-shrink: 0;
        color: var(--mci-text-tertiary);
    }
}

/* === 空状态 === */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--mci-space-12) var(--mci-space-6);

    &__icon {
        font-size: 48px;
        margin-bottom: var(--mci-space-3);
        filter: drop-shadow(0 4px 12px var(--mci-color-primary-glow));
    }

    &__title {
        font-size: var(--mci-text-base);
        color: var(--mci-text-primary);
        font-weight: var(--mci-font-medium);
        margin-bottom: var(--mci-space-1);
    }

    &__sub {
        font-size: var(--mci-text-xs);
        color: var(--mci-text-tertiary);
    }

    &__search-icon {
        font-size: 38px;
        color: var(--mci-color-primary-light);
        margin-bottom: var(--mci-space-3);
    }

    &--search {
        border: 1px dashed var(--mci-border-color);
        background: rgba(255, 255, 255, 0.04);
        box-shadow: none;
    }
}

/* === Footer === */
.ws-footer {
    text-align: center;
    padding: var(--mci-space-6) 0 var(--mci-space-4);

    span {
        font-size: var(--mci-text-xs);
        color: var(--mci-text-tertiary);
    }
}

/* === 骨架屏 === */
.sk-circle {
    width: 24px;
    height: 24px;
    border-radius: var(--mci-radius-sm);
    background: linear-gradient(90deg,
        var(--mci-bg-card) 25%,
        var(--mci-bg-card-hover) 50%,
        var(--mci-bg-card) 75%);
    background-size: 400% 100%;
    animation: mciShimmer 1.5s infinite;
    flex-shrink: 0;

    &--lg {
        width: 44px;
        height: 44px;
        border-radius: var(--mci-radius-md);
    }
}

.sk-line {
    height: 12px;
    border-radius: var(--mci-radius-full);
    background: linear-gradient(90deg,
        var(--mci-bg-card) 25%,
        var(--mci-bg-card-hover) 50%,
        var(--mci-bg-card) 75%);
    background-size: 400% 100%;
    animation: mciShimmer 1.5s infinite;
}

@keyframes mciShimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

/* === 子菜单弹窗 === */
:deep(.mci-submenu-dialog) {
    background: var(--mci-bg-elevated);
    border-radius: var(--mci-radius-2xl);
    border: 1px solid var(--mci-border-color);
    box-shadow: var(--mci-shadow-dialog);
    overflow: hidden;

    .el-dialog__header {
        padding: var(--mci-space-4);
        border-bottom: 1px solid var(--mci-border-color);
        margin-right: 0;
    }
    .el-dialog__title {
        font-size: var(--mci-text-base);
        font-weight: var(--mci-font-semibold);
        color: var(--mci-text-primary);
    }
    .el-dialog__body {
        padding: 0;
        max-height: 60vh;
        overflow-y: auto;
    }
}

.submenu-list {
    .mci-cell:last-child { border-bottom: none; }
}
</style>
