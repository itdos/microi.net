<template>
    <el-dropdown trigger="click" class="international" @command="handleSetLanguage">
        <div>
            <fa-icon :class="'fas fa-globe'" />
            <!-- <span style="font-size: 12px; margin-left: 6px">{{ currentLang }}</span> -->
        </div>
        <template #dropdown>
            <el-dropdown-menu style="max-height: 500px; overflow: auto">
                <el-dropdown-item :disabled="language === 'zh-CN'" command="zh-CN"> 中文 </el-dropdown-item>
                 <el-dropdown-item :disabled="language === 'en'" command="en"> English </el-dropdown-item>
                <!-- <el-dropdown-item :disabled="language==='es'" command="es">
                    Español
                </el-dropdown-item>
                <el-dropdown-item :disabled="language==='ja'" command="ja">
                    日本語
                </el-dropdown-item> -->

                <!-- <el-dropdown-item v-for="item in langOptions" :key="item.value" class="ignore" command="chinese_simplified">{{ item.label }}</el-dropdown-item> -->
            </el-dropdown-menu>
        </template>
    </el-dropdown>
</template>

<script>
import { getLangs } from "@/utils/langs";
import { computed } from "vue";
import { useAppStore } from "@/pinia";

export default {
    setup() {
        const appStore = useAppStore();
        const language = computed(() => appStore.language);
        return { language };
    },
    computed: {},
    data() {
        return {
            currentLang: "",
            langOptions: []
        };
    },
    mounted() {
        let self = this;
        if (typeof window.translate !== "undefined") {
            self.langOptions = getLangs();
            setTimeout(function () {
                let lang = translate.language.getCurrent();
                self.currentLang = self.langOptions.find((item) => item.value === lang).label;
            }, 3000);
        }
        this.updateCurrentLang();
    },
    methods: {
        handleSetLanguage(lang) {
            this.$i18n.locale = lang;
            this.updateCurrentLang();
            // 存储语言偏好
            localStorage.setItem('language', lang);
            this.DiyCommon?.ChangeLang?.(lang);
        },
        updateCurrentLang() {
            const currentLang = this.$i18n.locale || 'zh-CN';
            const langMap = {
                'zh-CN': '中文',
                'en': 'English'
            };
            this.currentLang = langMap[currentLang] || '中文';
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
