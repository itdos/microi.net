<template>
    <el-popover v-model="ShowThemes" placement="bottom" width="320" trigger="click" popper-class="mci-theme-popover">
        <div class="mci-theme-panel">
            <!-- 显示模式 -->
            <div v-if="showMode" class="mci-theme-section">
                <div class="mci-theme-title">
                    <el-icon><Sunny v-if="themeMode === 'light'" /><Moon v-else /></el-icon>
                    <span>显示模式</span>
                </div>
                <div class="mci-mode-row" role="group" aria-label="显示模式">
                    <button type="button" class="mci-mode-btn" :class="{ active: themeMode === 'light' }" @click="changeMode('light')">
                        <el-icon><Sunny /></el-icon>
                        <span>浅色</span>
                    </button>
                    <button type="button" class="mci-mode-btn" :class="{ active: themeMode === 'dark' }" @click="changeMode('dark')">
                        <el-icon><Moon /></el-icon>
                        <span>暗色</span>
                    </button>
                </div>
            </div>

            <!-- 主题色（MCI 设计系统统一调色板） -->
            <div class="mci-theme-section">
                <div class="mci-theme-title">
                    <el-icon><Brush /></el-icon>
                    <span>主题色</span>
                </div>
                <div class="mci-color-grid" role="group" aria-label="主题色">
                    <button
                        v-for="item in mciPresets"
                        :key="item.key"
                        type="button"
                        class="mci-color-dot"
                        :class="{
                            active: isActive(item.value),
                            'is-white': item.key === 'white',
                            'is-black': item.key === 'black'
                        }"
                        :style="{ background: item.swatch, color: item.value }"
                        :aria-label="`切换为${item.name}主题`"
                        :title="item.name"
                        @click="changeTheme(item.value)"
                    >
                        <el-icon v-if="isActive(item.value)" class="check"><Check /></el-icon>
                    </button>
                </div>
            </div>

            <!-- 自定义主题色 -->
            <div class="mci-theme-section">
                <div class="mci-theme-title">
                    <el-icon><MagicStick /></el-icon>
                    <span>自定义颜色</span>
                </div>
                <div class="mci-custom-row">
                    <el-color-picker size="default" v-model="themeColor" @change="changeTheme" />
                    <span class="mci-custom-hint">{{ themeColor || '点击左侧选择' }}</span>
                </div>
            </div>
        </div>

        <template #reference>
            <slot name="trigger">
                <button type="button" class="theme-select-trigger" aria-label="主题设置" title="主题设置">
                    <!-- <el-icon class="theme-icon"><Brush /></el-icon> -->
                    <font-awesome-icon icon="fa-solid fa-shirt" style="font-size: 16px;" />
                </button>
            </slot>
        </template>
    </el-popover>
</template>

<script>
import { Brush, Sunny, Moon, Check, MagicStick } from "@element-plus/icons-vue";
import { computed, watch } from "vue";
import { useDiyStore, useAppStore, useSettingsStore } from "@/pinia";
import {
    getThemePalettes,
    setThemeColor as applyThemeColor,
    setThemeMode,
    getThemeMode
} from "@/utils/theme-color.js";

const DEFAULT_THEME_COLOR = "#409eff";

export default {
    name: "ThemeSelect",
    components: { Brush, Sunny, Moon, Check, MagicStick },
    props: {
        showMode: {
            type: Boolean,
            default: true
        }
    },
    setup() {
        const diyStore = useDiyStore();
        const appStore = useAppStore();
        const settingsStore = useSettingsStore();
        const localThemeColor = computed({
            get: () => diyStore.themeColor,
            set: (v) => diyStore.setThemeColor(v)
        });
        const SysConfig = computed(() => diyStore.SysConfig || {});
        const themeColor = computed({
            get: () => localThemeColor.value || SysConfig.value.ThemeColor || DEFAULT_THEME_COLOR,
            set: (v) => diyStore.setThemeColor(v)
        });
        watch(
            () => SysConfig.value.ThemeColor,
            (color) => {
                if (!localThemeColor.value) applyThemeColor(color || DEFAULT_THEME_COLOR);
            }
        );
        return { diyStore, appStore, settingsStore, themeColor, localThemeColor, SysConfig };
    },
    data() {
        return {
            ShowThemes: false,
            themeMode: 'light'
        };
    },
    computed: {
        // 每种显示模式固定 12 色（6 × 2）；暗色模式不出现白色主色。
        mciPresets() {
            return getThemePalettes(this.themeMode);
        }
    },
    mounted() {
        // 初始化模式
        this.themeMode = getThemeMode();
        // 初始化主题色：本地手动选择 > SysConfig.ThemeColor > 默认色
        const appliedColor = applyThemeColor(this.themeColor || DEFAULT_THEME_COLOR);
        if (appliedColor && !this.isActive(appliedColor)) this.diyStore.setThemeColor(appliedColor);
    },
    methods: {
        isActive(color) {
            return (this.themeColor || '').toLowerCase() === (color || '').toLowerCase();
        },
        changeTheme(color) {
            if (!color) color = (this.SysConfig && this.SysConfig.ThemeColor) || DEFAULT_THEME_COLOR;
            const appliedColor = applyThemeColor(color);
            this.diyStore.setThemeColor(appliedColor || color);
        },
        changeMode(mode) {
            this.themeMode = mode;
            const appliedColor = setThemeMode(mode);
            // 从浅色白色切到暗色时自动回落为蓝色，并同步持久化状态。
            if (appliedColor && !this.isActive(appliedColor)) this.diyStore.setThemeColor(appliedColor);
        }
    }
};
</script>

<style lang="scss" scoped>
.theme-select-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    width: 40px;
    height: 40px;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    transition: transform 0.2s ease;

    .theme-icon { font-size: 20px; }
    &:hover { transform: rotate(15deg) scale(1.1); }
}

.mci-theme-panel {
    padding: 4px 2px 2px;
}

.mci-theme-section {
    & + .mci-theme-section {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--mci-border-color, rgba(0, 0, 0, 0.06));
    }
}

.mci-theme-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--mci-text-secondary, #64648c);
    margin-bottom: 5px;

    .el-icon { font-size: 13px; color: var(--mci-color-primary, #6C2BD9); }
}

/* 模式切换 */
.mci-mode-row {
    display: flex;
    gap: 8px;
}
.mci-mode-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 40px;
    border: 1px solid var(--mci-border-color, rgba(0, 0, 0, 0.08));
    border-radius: 8px;
    background: var(--mci-bg-surface, #f0f0f8);
    color: var(--mci-text-secondary, #64648c);
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.2s ease;

    .el-icon { font-size: 15px; }

    &:hover {
        background: var(--mci-bg-card-hover, #fff);
        color: var(--mci-color-primary, #6C2BD9);
    }
    &.active {
        background: var(--mci-gradient-primary, linear-gradient(135deg, #6C2BD9 0%, #2196F3 100%));
        color: var(--mci-text-on-primary, #fff);
        border-color: var(--mci-border-glow, transparent);
        box-shadow: var(--mci-shadow-button, 0 4px 14px rgba(108, 43, 217, 0.2));
    }
}

/* 主题色网格 */
.mci-color-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 10px;
    justify-items: center;
}
.mci-color-dot {
    position: relative;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    border: 2px solid transparent;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;

    .check {
        color: #fff !important;
        font-size: 16px;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
    }

    &.is-white {
        border-color: var(--mci-border-strong, #cbd5e1);

        .check {
            color: #111827 !important;
            filter: none;
        }
    }

    &:hover {
        transform: translateY(-2px) scale(1.08);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
    }
    &.active {
        border-color: var(--mci-bg-elevated, #fff);
        box-shadow: 0 0 0 2px currentColor, 0 6px 16px rgba(0, 0, 0, 0.15);
        transform: scale(1.05);
    }

    &.active.is-white {
        border-color: #fff;
        box-shadow: 0 0 0 2px var(--mci-text-primary, #111827), 0 6px 16px rgba(15, 23, 42, 0.14);
    }
}

/* 自定义颜色 */
.mci-custom-row {
    display: flex;
    align-items: center;
    gap: 12px;
}
.mci-custom-hint {
    font-size: 12px;
    color: var(--mci-text-tertiary, #9898b0);
    font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
}
</style>

<style lang="scss">
/* 全局：让 popover 也使用 MCI 卡片风格 */
.mci-theme-popover.el-popover {
    background: var(--mci-bg-elevated, #fff);
    border: 1px solid var(--mci-border-color, rgba(0, 0, 0, 0.08));
    border-radius: 12px;
    box-shadow: var(--mci-shadow-dropdown, 0 12px 36px rgba(15, 18, 30, 0.12));
    padding: 16px;
}
</style>
