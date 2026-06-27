<template>
    <router-view v-if="!isLanding" />
    <div v-else class="menu-grid-page">
        <header class="menu-grid-page__header">
            <div>
                <p class="menu-grid-page__breadcrumb">{{ breadcrumbText }}</p>
                <h2>{{ currentTitle }}</h2>
            </div>
        </header>

        <div v-if="visibleChildren.length > 0" class="menu-grid-page__grid">
            <button
                v-for="child in visibleChildren"
                :key="child.Id || child.path"
                type="button"
                class="menu-grid-card"
                :title="child.meta?.title || child.name"
                @click="goMenu(child)"
            >
                <span class="menu-grid-card__icon">
                    <fa-icon v-if="child.meta?.icon" :icon="child.meta.icon" />
                    <el-icon v-else-if="hasVisibleChildren(child)"><Folder /></el-icon>
                    <el-icon v-else><Document /></el-icon>
                </span>
                <span class="menu-grid-card__body">
                    <span class="menu-grid-card__title">{{ child.meta?.title || child.name }}</span>
                    <span v-if="hasVisibleChildren(child)" class="menu-grid-card__count">{{ $t("Msg.SubMenuCount", { count: getVisibleChildren(child).length }) }}</span>
                </span>
                <span class="menu-grid-card__arrow">
                    <el-icon><ArrowRight /></el-icon>
                </span>
            </button>
        </div>

        <el-empty v-else :description="$t('Msg.NoVisibleMenu')" />
    </div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowRight, Document, Folder } from "@element-plus/icons-vue";
import { usePermissionStore } from "@/pinia";
import { isExternal } from "@/utils/validate";

defineOptions({
    name: "MenuChildrenGrid"
});

const route = useRoute();
const router = useRouter();
const permissionStore = usePermissionStore();

function getVisibleChildren(menu) {
    const children = Array.isArray(menu?.children) ? menu.children : [];
    return children.filter((child) => child.Display !== 0 && child.Display !== "0" && !child.hidden);
}

function hasVisibleChildren(menu) {
    return getVisibleChildren(menu).length > 0;
}

function findRouteById(list, id) {
    if (!id || !Array.isArray(list)) return null;
    for (const item of list) {
        if (item.Id === id || item.meta?.Id === id) return item;
        const child = findRouteById(item.children, id);
        if (child) return child;
    }
    return null;
}

function findRouteByPath(list, targetPath) {
    if (!targetPath || !Array.isArray(list)) return null;
    for (const item of list) {
        if (item.path === targetPath) return item;
        const child = findRouteByPath(item.children, targetPath);
        if (child) return child;
    }
    return null;
}

const sourceMenuId = computed(() => {
    const matched = route.matched || [];
    for (let index = matched.length - 1; index >= 0; index--) {
        if (matched[index]?.meta?.SourceMenuId) return matched[index].meta.SourceMenuId;
    }
    return route.meta?.SourceMenuId || route.meta?.Id || "";
});

const currentMenu = computed(() => {
    return findRouteById(permissionStore.addRoutes, sourceMenuId.value)
        || findRouteByPath(permissionStore.addRoutes, route.path)
        || {};
});

const visibleChildren = computed(() => getVisibleChildren(currentMenu.value));
const currentTitle = computed(() => currentMenu.value?.meta?.title || route.meta?.title || "");
const breadcrumbText = computed(() => route.matched.map(item => item.meta?.title).filter(Boolean).join(" / "));
const isLanding = computed(() => {
    const menuPath = currentMenu.value?.path || route.path;
    return route.path === menuPath;
});

function goMenu(menu) {
    const link = menu.Link || menu.path || "";
    if (!link) return;
    if (isExternal(link)) {
        window.open(link, "_blank", "noopener,noreferrer");
        return;
    }
    router.push(link).catch(() => {});
}
</script>

<style lang="scss" scoped>
.menu-grid-page {
    min-height: calc(100vh - 110px);
    padding: 24px 28px 32px;
    background: var(--el-fill-color-extra-light);
}

.menu-grid-page__header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;

    h2 {
        margin: 4px 0 0;
        color: var(--el-text-color-primary);
        font-size: 22px;
        font-weight: 700;
        line-height: 1.3;
    }
}

.menu-grid-page__breadcrumb {
    margin: 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
}

.menu-grid-page__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, 168px);
    gap: 18px;
    max-width: 1488px;
    align-items: start;
    justify-content: start;
}

.menu-grid-card {
    position: relative;
    display: grid;
    grid-template-rows: 54px 66px;
    row-gap: 10px;
    align-content: center;
    justify-items: center;
    width: 168px;
    height: 168px;
    padding: 18px 14px 14px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    background: var(--el-bg-color);
    box-shadow: 0 6px 18px rgba(31, 45, 61, 0.05);
    color: var(--el-text-color-primary);
    cursor: pointer;
    text-align: center;
    transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;

    &:hover {
        border-color: var(--el-color-primary-light-5);
        box-shadow: 0 12px 28px rgba(31, 45, 61, 0.1);
        transform: translateY(-1px);
    }
}

.menu-grid-card__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 54px;
    height: 54px;
    border-radius: 8px;
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
    font-size: 23px;
}

.menu-grid-card__body {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
    width: 100%;
    height: 66px;
}

.menu-grid-card__title {
    display: -webkit-box;
    overflow: hidden;
    color: var(--el-text-color-primary);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.35;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    max-height: 38px;
    overflow-wrap: anywhere;
}

.menu-grid-card__count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 20px;
    max-width: 100%;
    padding: 0 9px;
    border-radius: 999px;
    background: var(--el-fill-color-light);
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 20px;
    white-space: nowrap;
}

.menu-grid-card__arrow {
    position: absolute;
    top: 10px;
    right: 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--el-fill-color-lighter);
    color: var(--el-text-color-placeholder);
    font-size: 13px;
    opacity: 0.62;
    transition: opacity 0.16s ease, color 0.16s ease, background-color 0.16s ease;
}

.menu-grid-card:hover .menu-grid-card__arrow {
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
    opacity: 1;
}

@media (max-width: 640px) {
    .menu-grid-page {
        padding: 16px;
    }

    .menu-grid-page__grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
        max-width: none;
    }

    .menu-grid-card {
        width: 100%;
        height: auto;
        min-height: 150px;
        aspect-ratio: 1 / 1;
    }
}

@media (max-width: 360px) {
    .menu-grid-page__grid {
        grid-template-columns: 1fr;
    }
}
</style>
