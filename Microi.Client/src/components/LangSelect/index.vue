<template>
    <el-dropdown trigger="hover" class="international" @command="handleSetLanguage">
        <div>
            <span style="font-size: 13px;">{{ currentLabel }}</span>
        </div>
        <template #dropdown>
            <el-dropdown-menu style="max-height: 500px; overflow: auto">
                <el-dropdown-item
                    v-for="item in supportedLocales"
                    :key="item.value"
                    :disabled="currentLocale === item.value"
                    :command="item.value"
                >
                    {{ item.label }}
                </el-dropdown-item>
            </el-dropdown-menu>
        </template>
    </el-dropdown>
</template>

<script>
import { computed } from "vue";
import { useAppStore, useDiyStore, usePermissionStore } from "@/pinia";
import { SUPPORTED_LOCALES, setI18nLocale, normalizeLocale, getLanguage } from "@/lang";

export default {
    name: "LangSelect",
    setup() {
        const appStore = useAppStore();
        const diyStore = useDiyStore();
        const permissionStore = usePermissionStore();
        const persistedLocale = normalizeLocale(getLanguage()) || "zh-CN";
        if (normalizeLocale(diyStore.Lang) !== persistedLocale) {
            diyStore.setLang(persistedLocale);
        }
        if (normalizeLocale(appStore.language) !== persistedLocale) {
            appStore.setLanguage(persistedLocale);
        }
        setI18nLocale(persistedLocale);
        const currentLocale = computed(() => {
            const storeLocale = normalizeLocale(diyStore.Lang || appStore.language);
            const persistedLocale = normalizeLocale(getLanguage());
            return persistedLocale || storeLocale || "zh-CN";
        });
        const currentLabel = computed(() => {
            const found = SUPPORTED_LOCALES.find((l) => l.value === currentLocale.value);
            return found ? found.label : "简体中文";
        });
        return {
            appStore,
            diyStore,
            permissionStore,
            supportedLocales: SUPPORTED_LOCALES,
            currentLocale,
            currentLabel
        };
    },
    methods: {
        async handleSetLanguage(lang) {
            const n = setI18nLocale(lang); // 切換 i18n、寫入 localStorage、廣播事件
            this.appStore.setLanguage(n); // 同步 Pinia，使下拉禁用態實時更新
            // 兼容舊代碼：若 DiyCommon.ChangeLang 存在則調用（用於可能殘留的全局副作用）
            this.diyStore.setLang(n);
            try {
                if (this.DiyCommon && typeof this.DiyCommon.ChangeLang === "function") {
                    this.DiyCommon.ChangeLang(n, true);
                }
            } catch {}
            await this.reloadMenuRoutesForLang(n);
        },
        async reloadMenuRoutesForLang(locale) {
            try {
                const routes = await this.permissionStore.generateRoutes(["admin"]);
                const router = this.$router;
                if (!router || !Array.isArray(routes)) {
                    return;
                }
                const isGenerated = (route) => {
                    const name = String(route && route.name || "");
                    return name.startsWith("parent_menu_") || name.startsWith("menu_") || name.startsWith("menu_grid_");
                };
                router.getRoutes().forEach((route) => {
                    if (route && route.name && isGenerated(route) && router.hasRoute(route.name)) {
                        try { router.removeRoute(route.name); } catch {}
                    }
                });
                routes.forEach((route) => {
                    if (!route || !route.name || !isGenerated(route)) {
                        return;
                    }
                    try {
                        router.addRoute(route);
                    } catch (routeError) {
                        console.warn("[LangSelect] reload route failed:", route && route.path, routeError);
                    }
                });
                const current = router.currentRoute && router.currentRoute.value;
                if (current && current.fullPath) {
                    await router.replace(current.fullPath).catch(() => {});
                }
                try {
                    window.dispatchEvent(new CustomEvent("microi:lang-routes-reloaded", { detail: { locale } }));
                } catch {}
            } catch (error) {
                console.warn("[LangSelect] reload menu routes failed:", error);
            }
        }
    }
};
</script>

<style lang="scss" scoped>
.international {
    display: flex;
    align-items: center;
    cursor: pointer;

    .language-icon {
        font-size: 20px;
    }
}
</style>
