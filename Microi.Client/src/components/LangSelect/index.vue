<template>
    <el-dropdown trigger="hover" class="international" @command="handleSetLanguage">
        <div class="international-trigger" :class="{ compact }">
            <font-awesome-icon v-if="compact" icon="fa-solid fa-language" aria-hidden="true" />
            <span v-else style="font-size: 13px;">{{ currentLabel }}</span>
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
import { computed, watch } from "vue";
import { useAppStore, useDiyStore, usePermissionStore } from "@/pinia";
import {
    setI18nLocale,
    normalizeLocale,
    getStoredLanguage,
    getSupportedLocalesBySysLangs,
    resolveSysLocale
} from "@/lang";

export default {
    name: "LangSelect",
    props: {
        compact: {
            type: Boolean,
            default: false
        }
    },
    setup() {
        const appStore = useAppStore();
        const diyStore = useDiyStore();
        const permissionStore = usePermissionStore();
        const supportedLocales = computed(() => getSupportedLocalesBySysLangs(diyStore.SysConfig && diyStore.SysConfig.SysLangs));
        const applyLocale = (locale) => {
            const nextLocale = resolveSysLocale(diyStore.SysConfig, locale);
            if (normalizeLocale(diyStore.Lang) !== nextLocale) {
                diyStore.setLang(nextLocale);
            }
            if (normalizeLocale(appStore.language) !== nextLocale) {
                appStore.setLanguage(nextLocale);
            }
            setI18nLocale(nextLocale);
            return nextLocale;
        };
        watch(
            () => [diyStore.SysConfig && diyStore.SysConfig.SysLangs, diyStore.SysConfig && diyStore.SysConfig.SysLang],
            () => {
                applyLocale(getStoredLanguage() || diyStore.Lang || appStore.language);
            },
            { immediate: true }
        );
        const currentLocale = computed(() => {
            return resolveSysLocale(diyStore.SysConfig, diyStore.Lang || appStore.language || getStoredLanguage());
        });
        const currentLabel = computed(() => {
            const found = supportedLocales.value.find((l) => l.value === currentLocale.value);
            return found ? found.label : (supportedLocales.value[0] && supportedLocales.value[0].label) || "English";
        });
        return {
            appStore,
            diyStore,
            permissionStore,
            supportedLocales,
            currentLocale,
            currentLabel
        };
    },
    methods: {
        async handleSetLanguage(lang) {
            const n = resolveSysLocale(this.diyStore.SysConfig, lang);
            try {
                if (this.DiyCommon && typeof this.DiyCommon.ChangeLang === "function") {
                    await this.DiyCommon.ChangeLang(n, true);
                } else {
                    setI18nLocale(n);
                    this.appStore.setLanguage(n);
                    this.diyStore.setLang(n);
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
.international-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 30px;
    white-space: nowrap;

    &.compact {
        width: 30px;
        height: 30px;
        font-size: 17px;
    }
}
</style>
