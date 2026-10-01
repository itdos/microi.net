<template>
    <nav class="mci-top-navigation" aria-label="顶部导航">
        <router-link class="mci-top-brand" to="/" :title="brandTitle">
            <img v-if="logo && !logoFailed" :src="logo" alt="" @error="logoFailed = true" />
            <span v-else class="mci-top-brand-fallback">{{ brandTitle.slice(0, 1) }}</span>
            <strong>{{ brandTitle }}</strong>
        </router-link>
        <el-menu class="mci-top-menu" mode="horizontal" :default-active="activeMenu" :ellipsis="true" :ellipsis-icon="MoreFilled" :close-on-click-outside="true">
            <top-navigation-item v-for="route in routes" :key="route.path || route.meta?.Id" :route="route" />
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
const diyStore = useDiyStore();
const permissions = usePermissionStore();
const route = useRoute();
const routes = computed(() => permissions.routes.filter(route => route.Display !== 0 && route.Display !== '0' && !route.hidden && route.meta));
const activeMenu = computed(() => route.meta?.activeMenu || route.path);
const brandTitle = computed(() => diyStore.SysConfig?.SysShortTitle || diyStore.ShortTitle || diyStore.WebTitle || '工作台');
const logoFailed = ref(false);
const logo = computed(() => resolveSidebarSystemLogoUrl(diyStore.SysConfig?.SysLogo, diyStore.OsClient, value => DiyCommon.GetServerPath(value), '/static/img/logo/itdos.svg'));
watch(logo, () => { logoFailed.value = false; });
</script>

<style lang="scss">
.mci-top-navigation { display:flex;align-items:center;flex:1;min-width:0;height:50px;gap:12px;padding-left:14px; }
.mci-top-brand { display:flex;align-items:center;gap:8px;flex:0 0 auto;color:var(--mci-text-primary);max-width:200px; }
.mci-top-brand img,.mci-top-brand-fallback { width:28px;height:28px;object-fit:contain;border-radius:var(--mci-radius-sm,6px); }
.mci-top-brand-fallback { display:grid;place-items:center;background:var(--mci-color-primary);color:var(--mci-text-on-primary); }
.mci-top-brand strong { font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.mci-top-menu.el-menu--horizontal { flex:1;min-width:0;height:50px;--el-menu-horizontal-height:50px;border-bottom:0;background:transparent; }
.mci-top-menu > a { flex:0 0 auto; }
.mci-top-menu .el-menu-item,.mci-top-menu .el-sub-menu__title { padding:0 14px !important;gap:6px; }
.mci-top-menu .menu-item-wrapper,.mci-top-navigation-popup .menu-item-wrapper { display:flex;align-items:center;gap:7px;width:100%;min-width:0; }
.mci-top-menu .mci-menu-parent-icon-shell,.mci-top-navigation-popup .mci-menu-parent-icon-shell { background:transparent !important;border:0 !important;box-shadow:none !important;width:18px;height:18px; }
.mci-top-menu .menu-item-icon,.mci-top-navigation-popup .menu-item-icon { width:18px;height:18px;font-size:16px; }
.mci-top-navigation-popup { --el-menu-bg-color:var(--mci-bg-elevated);--el-menu-text-color:var(--mci-text-primary);--el-menu-hover-bg-color:var(--mci-bg-hover); }
.mci-top-navigation-popup .el-menu { min-width:190px; }
@media(max-width:1100px) { .mci-top-brand strong { display:none; } .mci-top-navigation { gap:8px;padding-left:8px; } }
</style>
