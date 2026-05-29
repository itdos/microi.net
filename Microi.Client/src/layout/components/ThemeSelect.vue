<template>
    <el-popover v-model="ShowThemes" placement="bottom" width="320" trigger="hover" popper-class="mci-theme-popover">
        <div class="mci-theme-panel">
            <!-- 显示模式 -->
            <div class="mci-theme-section">
                <div class="mci-theme-title">
                    <el-icon><Sunny v-if="themeMode === 'light'" /><Moon v-else /></el-icon>
                    <span>显示模式</span>
                </div>
                <div class="mci-mode-row">
                    <a class="mci-mode-btn" :class="{ active: themeMode === 'light' }" @click="changeMode('light')">
                        <el-icon><Sunny /></el-icon>
                        <span>亮色</span>
                    </a>
                    <a class="mci-mode-btn" :class="{ active: themeMode === 'dark' }" @click="changeMode('dark')">
                        <el-icon><Moon /></el-icon>
                        <span>深色</span>
                    </a>
                </div>
            </div>

            <!-- 主题色（MCI 设计系统统一调色板） -->
            <div class="mci-theme-section">
                <div class="mci-theme-title">
                    <el-icon><Brush /></el-icon>
                    <span>主题色</span>
                </div>
                <div class="mci-color-grid">
                    <a
                        v-for="item in mciPresets"
                        :key="item.value"
                        class="mci-color-dot"
                        :class="{ active: isActive(item.value) }"
                        :style="{ background: item.value, color: item.value }"
                        :title="item.name"
                        @click="changeTheme(item.value)"
                    >
                        <el-icon v-if="isActive(item.value)" class="check"><Check /></el-icon>
                    </a>
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
            <div class="theme-select-trigger">
                <!-- <el-icon class="theme-icon"><Brush /></el-icon> -->
                <font-awesome-icon icon="fa-solid fa-shirt" style="font-size: 16px;" />
            </div>
        </template>
    </el-popover>
</template>

<script>
import { Brush, Sunny, Moon, Check, MagicStick } from "@element-plus/icons-vue";
import { computed, watch } from "vue";
import { useDiyStore, useAppStore, useSettingsStore } from "@/pinia";
import { setThemeColor as applyThemeColor, setThemeMode, getThemeMode } from "@/utils/theme-color.js";

const DEFAULT_THEME_COLOR = "#409eff";

export default {
    name: "ThemeSelect",
    components: { Brush, Sunny, Moon, Check, MagicStick },
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
            themeMode: 'light',
            // MCI 设计系统统一调色板（与 microi.app / microi.uniapp 一致）
            mciPresets: [
                { name: '紫色 (默认)', value: '#6C2BD9' },
                { name: '蓝色',       value: '#2196F3' },
                { name: '青色',       value: '#06B6D4' },
                { name: '粉色',       value: '#EC4899' },
                { name: '橙色',       value: '#F59E0B' },
                { name: '红色',       value: '#E8294A' },
                { name: '绿色',       value: '#27AE60' },
                { name: '靛蓝',       value: '#3F51B5' },
                { name: '深橙',       value: '#FF5722' },
                { name: '灰蓝',       value: '#607D8B' },
                { name: '天蓝',       value: '#409EFF' },
                { name: '深紫',       value: '#673AB7' }
            ]
        };
    },
    mounted() {
        // 初始化模式
        this.themeMode = getThemeMode();
        // 初始化主题色：本地手动选择 > SysConfig.ThemeColor > 默认色
        applyThemeColor(this.themeColor || DEFAULT_THEME_COLOR);
    },
    methods: {
        isActive(color) {
            return (this.themeColor || '').toLowerCase() === (color || '').toLowerCase();
        },
        changeTheme(color) {
            if (!color) color = (this.SysConfig && this.SysConfig.ThemeColor) || DEFAULT_THEME_COLOR;
            applyThemeColor(color);
            this.diyStore.setThemeColor(color);
        },
        changeMode(mode) {
            this.themeMode = mode;
            setThemeMode(mode);
            // 切换模式后重新写入主题色，使 MCI 渐变 / 阴影按当前模式重算
            if (this.themeColor) applyThemeColor(this.themeColor);
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
    height: 36px;
    border-radius: 8px;
    background: var(--mci-bg-surface, #f0f0f8);
    color: var(--mci-text-secondary, #64648c);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;

    .el-icon { font-size: 15px; }

    &:hover {
        background: var(--mci-bg-card-hover, #fff);
        color: var(--mci-color-primary, #6C2BD9);
    }
    &.active {
        background: var(--mci-gradient-primary, linear-gradient(135deg, #6C2BD9 0%, #2196F3 100%));
        color: #fff;
        box-shadow: var(--mci-shadow-button, 0 4px 14px rgba(108, 43, 217, 0.2));
    }
}

/* 主题色网格 */
.mci-color-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 10px;
}
.mci-color-dot {
    position: relative;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    border: 2px solid transparent;
    display: flex;
    align-items: center;
    justify-content: center;

    .check {
        color: #fff !important;
        font-size: 16px;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
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
