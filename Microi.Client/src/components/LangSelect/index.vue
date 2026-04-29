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
import { useAppStore } from "@/pinia";
import { SUPPORTED_LOCALES, setI18nLocale, normalizeLocale } from "@/lang";

export default {
    name: "LangSelect",
    setup() {
        const appStore = useAppStore();
        const currentLocale = computed(
            () => normalizeLocale(appStore.language) || "zh-CN"
        );
        const currentLabel = computed(() => {
            const found = SUPPORTED_LOCALES.find((l) => l.value === currentLocale.value);
            return found ? found.label : "简体中文";
        });
        return {
            appStore,
            supportedLocales: SUPPORTED_LOCALES,
            currentLocale,
            currentLabel
        };
    },
    methods: {
        handleSetLanguage(lang) {
            const n = setI18nLocale(lang); // 切換 i18n、寫入 localStorage、廣播事件
            this.appStore.setLanguage(n); // 同步 Pinia，使下拉禁用態實時更新
            // 兼容舊代碼：若 DiyCommon.ChangeLang 存在則調用（用於可能殘留的全局副作用）
            try {
                if (this.DiyCommon && typeof this.DiyCommon.ChangeLang === "function") {
                    this.DiyCommon.ChangeLang(n, true);
                }
            } catch {}
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
