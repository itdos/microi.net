<template>
    <div
        v-if="watermark.enabled"
        class="mci-framework-watermark"
        data-mci-framework-watermark="true"
        aria-hidden="true"
    >
        <el-watermark
            class="mci-framework-watermark__canvas"
            :content="watermark.content"
            :font="watermarkFont"
            :gap="watermark.gap"
            :rotate="watermark.rotate"
            :z-index="1"
        >
            <div class="mci-framework-watermark__viewport"></div>
        </el-watermark>
    </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useDiyStore } from "@/pinia";
import { resolveFrameworkWatermarkSettings } from "@/utils/framework-presentation.js";

const diyStore = useDiyStore();
const darkMode = ref(false);
const currentTime = ref(new Date());
let themeObserver = null;
let clockTimer = null;

const watermark = computed(() => {
    const user = diyStore.GetCurrentUser || {};
    return resolveFrameworkWatermarkSettings(diyStore.SysConfig, {
        SysTitle: diyStore.SysConfig?.SysTitle,
        SysShortTitle: diyStore.SysConfig?.SysShortTitle,
        UserName: user.Name,
        Account: user.Account
    }, currentTime.value);
});

const watermarkFont = computed(() => {
    const alpha = watermark.value.opacity;
    return {
        color: darkMode.value
            ? `rgba(235, 240, 248, ${alpha})`
            : `rgba(72, 86, 111, ${alpha})`,
        fontSize: watermark.value.fontSize,
        fontWeight: 500,
        fontFamily: "Inter, PingFang SC, Microsoft YaHei, sans-serif"
    };
});

function syncThemeMode() {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    darkMode.value = root.classList.contains("dark") || root.getAttribute("data-theme") === "dark";
}

onMounted(() => {
    syncThemeMode();
    clockTimer = window.setInterval(() => {
        currentTime.value = new Date();
    }, 60000);
    if (typeof MutationObserver === "undefined" || typeof document === "undefined") return;
    themeObserver = new MutationObserver(syncThemeMode);
    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme"]
    });
});

onBeforeUnmount(() => {
    if (themeObserver) themeObserver.disconnect();
    themeObserver = null;
    if (clockTimer) window.clearInterval(clockTimer);
    clockTimer = null;
});
</script>

<style lang="scss" scoped>
.mci-framework-watermark {
    position: fixed;
    inset: 0;
    z-index: 2147483000;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    pointer-events: none;
    user-select: none;
}

.mci-framework-watermark__canvas,
.mci-framework-watermark__viewport {
    width: 100%;
    height: 100%;
    min-height: 100vh;
    pointer-events: none;
}

:deep(.el-watermark) {
    width: 100%;
    height: 100%;
    pointer-events: none !important;
}
</style>
