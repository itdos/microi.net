<template>
    <el-dropdown trigger="click" class="international" @command="handleSetLanguage">
        <div>
            <svg-icon class-name="international-icon" icon-class="language" />
            <span style="font-size: 12px; margin-left: 6px">{{ currentLangLabel }}</span>
        </div>
        <el-dropdown-menu style="max-height: 500px; overflow: auto" slot="dropdown">
            <el-dropdown-item v-for="item in langOptions" :key="item.value" class="ignore" :command="item.value">{{ item.label }}</el-dropdown-item>
        </el-dropdown-menu>
    </el-dropdown>
</template>

<script>
import { getLangs } from "@/utils/langs";
export default {
    computed: {
        language() {
            return this.$store.getters.language;
        },
        currentLangLabel() {
            let foundLang = this.langOptions.find((item) => item.value === this.currentLang);
            return foundLang ? foundLang.label : "";
        }
    },
    data() {
        return {
            currentLang: "",
            langOptions: []
        };
    },
    mounted() {
        let self = this;
        try {
            self.langOptions = getLangs();
            // 优先从本地缓存读取语言设置
            var savedLang = localStorage.getItem("Microi.TranslateLang");
            var lang = null;

            if (savedLang) {
                // 如果本地缓存有值，使用缓存的语言
                lang = savedLang;
            } else if (typeof window.translate !== "undefined") {
                // 如果没有缓存，从 translate 获取当前语言
                lang = translate.language.getCurrent();
            }

            if (lang) {
                let foundLang = self.langOptions.find((item) => item.value === lang);
                if (foundLang) {
                    self.currentLang = foundLang.value;
                    // 如果 translate 存在且当前语言与缓存不一致，同步到 translate
                    if (typeof window.translate !== "undefined" && translate.language.getCurrent() !== lang) {
                        translate.changeLanguage(lang);
                    }
                } else if (self.langOptions.length > 0) {
                    // 如果找不到匹配的语言，使用第一个选项
                    self.currentLang = self.langOptions[0].value;
                    localStorage.setItem("Microi.TranslateLang", self.currentLang);
                }
            } else if (self.langOptions.length > 0) {
                // 如果都没有，使用第一个选项
                self.currentLang = self.langOptions[0].value;
                localStorage.setItem("Microi.TranslateLang", self.currentLang);
            }
        } catch (error) {
            console.error("初始化语言选项失败:", error);
            // 如果出错，至少设置一个默认值
            if (self.langOptions.length > 0) {
                self.currentLang = self.langOptions[0].value;
                try {
                    localStorage.setItem("Microi.TranslateLang", self.currentLang);
                } catch (e) {}
            }
        }
    },
    methods: {
        handleSetLanguage(lang) {
            try {
                // 保存到本地缓存
                localStorage.setItem("Microi.TranslateLang", lang);

                // 切换 translate 语言
                if (typeof window.translate !== "undefined") {
                    translate.changeLanguage(lang);
                    console.log("切换语言为：", lang);
                }

                // 更新当前语言显示
                this.currentLang = lang;
            } catch (error) {
                console.error("切换语言失败:", error);
            }
        }
    }
};
</script>
