<template>
    <div v-if="aiAssistantEnabled" class="desktop-ai-assistant">
        <button
            type="button"
            class="desktop-ai-entry"
            data-testid="desktop-ai-entry"
            aria-label="打开AI助手"
            title="AI助手"
            @click="openAssistant"
        >
            <span class="desktop-ai-entry__ring" aria-hidden="true"></span>
            <img
                class="desktop-ai-entry__robot"
                src="/static/mci/ai/assistant-robot.png"
                alt=""
                aria-hidden="true"
            />
        </button>

        <el-dialog
            v-model="dialogVisible"
            class="desktop-ai-dialog"
            width="min(960px, calc(100vw - 48px))"
            draggable
            align-center
            append-to-body
            destroy-on-close
            :close-on-click-modal="false"
            :lock-scroll="true"
            data-testid="desktop-ai-dialog"
        >
            <template #header>
                <div class="desktop-ai-dialog__title" data-testid="desktop-ai-dialog-drag-handle">
                    <img src="/static/mci/ai/assistant-robot.png" alt="" aria-hidden="true" />
                    <span>
                        <strong>AI助手</strong>
                        <small>拖动标题栏可移动窗口</small>
                    </span>
                </div>
            </template>

            <MobileAiAssistant embedded @close="closeAssistant" />
        </el-dialog>
    </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useDiyStore } from "@/pinia";
import MobileAiAssistant from "@/views/mobile/ai-assistant.vue";
import { isMobileAiAssistantEnabled } from "@/components/MobileTabBar/mobile-ai-entry.js";

defineOptions({ name: "DesktopAiAssistant" });

const diyStore = useDiyStore();
const dialogVisible = ref(false);
const aiAssistantEnabled = computed(() => isMobileAiAssistantEnabled(diyStore.SysConfig));

function openAssistant() {
    dialogVisible.value = true;
}

function closeAssistant() {
    dialogVisible.value = false;
}

watch(aiAssistantEnabled, (enabled) => {
    if (!enabled) closeAssistant();
});
</script>

<style lang="scss" scoped>
.desktop-ai-assistant {
    height: 100%;
    display: flex;
    align-items: center;
}

.desktop-ai-entry {
    position: relative;
    width: 42px;
    height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    appearance: none;
    padding: 0;
    border: 0;
    border-radius: var(--mci-radius-sm, 6px);
    color: var(--mci-color-primary, #409eff);
    background: transparent;
    cursor: pointer;
    transition: background-color 0.18s ease, transform 0.18s ease;
}

.desktop-ai-entry:hover { background: var(--el-fill-color-light, rgba(0, 0, 0, 0.025)); }
.desktop-ai-entry:active { transform: scale(0.94); }
.desktop-ai-entry:focus-visible {
    outline: 2px solid var(--mci-color-primary, #409eff);
    outline-offset: -2px;
}

.desktop-ai-entry__ring {
    position: absolute;
    inset: 4px;
    border: 1px solid rgba(24, 166, 184, 0.24);
    border-radius: 50%;
    pointer-events: none;
    animation: desktopAiSlotPulse 2.8s ease-in-out infinite;
}

.desktop-ai-entry__robot {
    position: relative;
    z-index: 1;
    width: 32px;
    height: 32px;
    object-fit: contain;
    pointer-events: none;
}

@keyframes desktopAiSlotPulse {
    0%, 100% { transform: scale(0.96); opacity: 0.45; }
    50% { transform: scale(1); opacity: 0.9; }
}

@media (prefers-reduced-motion: reduce) {
    .desktop-ai-entry { transition: none; }
    .desktop-ai-entry__ring { animation: none; }
}
</style>

<style lang="scss">
.desktop-ai-dialog {
    overflow: hidden;
    border-radius: var(--mci-shape-dialog, var(--mci-radius-lg, 12px));
    background: var(--mci-bg-elevated, #fff);
    box-shadow: var(--mci-shadow-dialog, 0 18px 48px rgba(15, 23, 42, 0.22));
}

.desktop-ai-dialog .el-dialog__header {
    margin-right: 0;
    padding: 10px 52px 10px 16px;
    border-bottom: 1px solid var(--mci-border-color, var(--el-border-color-lighter, #e4e7ed));
    cursor: move;
    user-select: none;
}

.desktop-ai-dialog .el-dialog__headerbtn {
    top: 8px;
    right: 10px;
    width: 40px;
    height: 40px;
}

.desktop-ai-dialog .el-dialog__body {
    height: min(720px, calc(100vh - 140px));
    min-height: 480px;
    padding: 0;
    overflow: hidden;
}

.desktop-ai-dialog__title {
    display: flex;
    align-items: center;
    gap: 10px;
}

.desktop-ai-dialog__title > img {
    width: 34px;
    height: 34px;
    object-fit: contain;
}

.desktop-ai-dialog__title > span {
    min-width: 0;
    display: flex;
    flex-direction: column;
}

.desktop-ai-dialog__title strong {
    color: var(--mci-text-primary, var(--el-text-color-primary, #303133));
    font-size: 15px;
    line-height: 20px;
}

.desktop-ai-dialog__title small {
    color: var(--mci-text-tertiary, var(--el-text-color-secondary, #909399));
    font-size: 11px;
    line-height: 16px;
}

@media (max-height: 680px) {
    .desktop-ai-dialog .el-dialog__body {
        height: calc(100vh - 112px);
        min-height: 0;
    }
}
</style>
