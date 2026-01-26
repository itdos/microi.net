// Pinia Store - Settings
import { defineStore } from "pinia";
import variables from "@/styles/element-variables.js";
import defaultSettings from "@/settings";

const { showSettings, tagsView, fixedHeader, sidebarLogo, supportPinyinSearch } = defaultSettings;

export const useSettingsStore = defineStore("settings", {
    state: () => ({
        theme: variables.theme,
        showSettings,
        tagsView,
        fixedHeader,
        sidebarLogo,
        supportPinyinSearch
    }),

    actions: {
        changeSetting({ key, value }) {
            if (Object.prototype.hasOwnProperty.call(this.$state, key)) {
                this[key] = value;
            }
        }
    },

    persist: {
        key: "microi-settings",
        storage: localStorage,
        paths: ["theme", "tagsView", "fixedHeader", "sidebarLogo"]
    }
});
