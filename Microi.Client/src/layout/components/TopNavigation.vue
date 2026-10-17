<template>
    <nav class="mci-top-navigation" aria-label="顶部导航">
        <router-link class="mci-top-brand" to="/" :aria-label="brandTitle">
            <img v-if="logo && !logoFailed" :src="logo" alt="" @error="logoFailed = true" />
            <span v-else class="mci-top-brand-fallback">{{ brandTitle.slice(0, 1) }}</span>
            <strong>{{ brandTitle }}</strong>
        </router-link>
        <el-menu class="mci-top-menu" mode="horizontal" :popper-offset="0" popper-class="mci-top-navigation-popup" :default-active="activeMenu" :ellipsis="true" :ellipsis-icon="MoreFilled" :close-on-click-outside="true">
            <top-navigation-item v-for="route in routes" :key="route.path || route.meta?.Id" :route="route" :first-level-only="hybrid" @select-root="$emit('select-root', $event)" />
        </el-menu>
    </nav>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { MoreFilled } from '@element-plus/icons-vue';
import { useDiyStore, usePermissionStore } from '@/pinia';
import { resolveSidebarSystemLogoUrl } from '@/utils/login-branding';
import { DiyCommon } from '@/utils/microi.net.import';
import TopNavigationItem from './TopNavigationItem.vue';
const props = defineProps({ hybrid: Boolean, activeRoot: { type: String, default: '' } });
defineEmits(['select-root']);
const diyStore = useDiyStore();
const permissions = usePermissionStore();
const route = useRoute();
const routes = computed(() => permissions.routes.filter(route => route.Display !== 0 && route.Display !== '0' && !route.hidden && route.meta));
const activeMenu = computed(() => props.hybrid ? props.activeRoot : route.meta?.activeMenu || route.path);
const brandTitle = computed(() => diyStore.SysConfig?.SysShortTitle || diyStore.ShortTitle || diyStore.WebTitle || '工作台');
const logoFailed = ref(false);
const logo = computed(() => resolveSidebarSystemLogoUrl(diyStore.SysConfig?.SysLogo, diyStore.OsClient, value => DiyCommon.GetServerPath(value), '/static/img/logo/itdos.svg'));
watch(logo, () => { logoFailed.value = false; });
</script>

<style lang="scss">
.mci-top-navigation { display:flex;align-items:center;flex:1;min-width:0;height:50px;gap:12px;padding-inline:16px;box-sizing:border-box; }
.mci-top-brand { display:flex;align-items:center;gap:8px;flex:0 0 auto;color:var(--sidebar-text-color);max-width:200px; }
.mci-top-brand img,.mci-top-brand-fallback { width:28px;height:28px;object-fit:contain;border-radius:var(--mci-radius-sm,6px); }
.mci-top-brand-fallback { display:grid;place-items:center;background:var(--mci-color-primary);color:var(--mci-text-on-primary); }
.mci-top-brand strong { font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.mci-top-menu.el-menu--horizontal { flex:1;min-width:0;height:50px;--el-menu-horizontal-height:50px;--el-menu-text-color:var(--sidebar-text-color);--el-menu-active-color:var(--sidebar-active-text-color);--el-menu-hover-bg-color:var(--sidebar-hover-bg);border-bottom:0;background:transparent; }
.mci-top-menu > a { flex:0 0 auto; }
// 主题背景即时变化时，菜单前景也即时切换，避免颜色过渡产生短暂低对比文字。
.mci-top-menu .el-menu-item,.mci-top-menu .el-sub-menu__title { padding:0 14px !important;gap:6px;transition-property:background-color,border-color !important; }
.mci-top-menu .el-menu-item,.mci-top-menu .el-sub-menu__title { position:relative; }
.mci-top-menu .el-menu-item.is-active,.mci-top-menu .el-sub-menu.is-active > .el-sub-menu__title { border-bottom:0 !important;background:var(--sidebar-bg-color) !important;color:var(--sidebar-active-text-color) !important; }
// 交互状态使用已配对的主题实色与前景，避免叠白背景把白字对比度降到阈值以下。
// 顶部一级导航用独立短底线标识当前位置，不改变菜单几何或侧栏的短竖标。
.mci-top-menu > .el-menu-item.is-active::after,.mci-top-menu > a > .el-menu-item.is-active::after,.mci-top-menu > .el-sub-menu.is-active > .el-sub-menu__title::after { content:'';position:absolute;inset-inline:14px;bottom:3px;height:3px;background:currentColor;border-radius:2px; }
.mci-top-menu .el-menu-item:not(.is-disabled):hover,.mci-top-menu .el-menu-item:not(.is-disabled):focus-visible,.mci-top-menu .el-sub-menu:hover > .el-sub-menu__title { background:var(--sidebar-bg-color) !important;color:var(--sidebar-text-color) !important;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--sidebar-text-color) 35%,transparent); }
.mci-top-menu .menu-item-wrapper,.mci-top-navigation-popup .menu-item-wrapper { display:flex;align-items:center;gap:7px;width:100%;min-width:0; }
.mci-top-menu .mci-menu-parent-icon-shell,.mci-top-navigation-popup .mci-menu-parent-icon-shell { background:transparent !important;border:0 !important;box-shadow:none !important;width:18px;height:18px; }
.mci-top-menu .menu-item-icon,.mci-top-navigation-popup .menu-item-icon { width:18px;height:18px;font-size:16px; }
.mci-top-navigation-popup { --el-menu-bg-color:var(--sidebar-bg-color);--el-menu-text-color:var(--sidebar-text-color);--el-menu-active-color:var(--sidebar-active-text-color);--el-menu-hover-text-color:var(--sidebar-text-color);--el-menu-hover-bg-color:var(--sidebar-hover-bg); }
.el-popper.mci-top-navigation-popup,.mci-top-navigation-popup.el-menu--popup-container { padding:0 !important;border:0 !important;background:var(--sidebar-bg-color) !important;color:var(--sidebar-text-color) !important; }
.mci-top-navigation-popup .el-menu { min-width:190px;max-width:min(360px,calc(100vw - 24px));margin:0;border:0 !important;background:var(--sidebar-bg-color) !important; }
.mci-top-navigation-popup > .el-menu--popup { max-height:calc(100dvh - 72px);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain; }
.mci-top-navigation-popup .el-menu-item,.mci-top-navigation-popup .el-sub-menu__title { color:var(--sidebar-text-color) !important;background:transparent; }
.mci-top-navigation-popup .el-menu-item:hover,.mci-top-navigation-popup .el-menu-item:focus-visible,.mci-top-navigation-popup .el-sub-menu:hover > .el-sub-menu__title { background:var(--sidebar-bg-color) !important;color:var(--sidebar-text-color) !important;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--sidebar-text-color) 35%,transparent); }
.mci-top-navigation-popup .el-menu-item.is-active { background:var(--sidebar-bg-color) !important;color:var(--sidebar-active-text-color) !important;box-shadow:inset 3px 0 0 currentColor; }
@media(max-width:1100px) { .mci-top-brand strong { display:none; } .mci-top-navigation { gap:8px;padding-left:8px; } }
</style>
