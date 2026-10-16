<template>
    <el-popover v-model="ShowThemes" placement="bottom" width="340" trigger="click" popper-class="mci-theme-popover">
        <div class="mci-theme-panel">
            <div class="mci-theme-panel-head">
                <div class="mci-theme-heading">
                    <span class="mci-theme-heading-icon"><el-icon><Setting /></el-icon></span>
                    <strong>{{ $t('Msg.Mobile.profile.themeSettings') }}</strong>
                </div>
                <button type="button" class="mci-theme-reset" data-testid="theme-reset" @click="resetVisualPreferences">{{ $t('Msg.FrameworkAppearance.reset') }}</button>
            </div>
            <div class="mci-theme-status-row">
                <button
                    v-if="canSyncThemePreferences"
                    type="button"
                    class="mci-theme-save-status"
                    :class="'is-' + preferenceSaveState"
                    :title="preferenceSaveError"
                    :aria-label="preferenceSaveStatusText"
                    aria-live="polite"
                    @click="preferenceSaveState === 'error' ? retryVisualPreferences() : undefined"
                >
                    <i></i>{{ preferenceSaveStatusText }}
                </button>
                <span v-else class="mci-theme-save-status is-local">
                    <i></i>{{ $t('Msg.Mobile.profile.themeLocalOnly') }}
                </span>
            </div>

            <div class="mci-theme-panel-body">
                <!-- 显示模式 -->
                <div v-if="showMode" class="mci-theme-section">
                    <div class="mci-theme-title">
                        <el-icon><Sunny v-if="themeMode === 'light'" /><Moon v-else /></el-icon>
                        <span>{{ $t('Msg.Mobile.profile.displayMode') }}</span>
                    </div>
                    <div class="mci-mode-row" role="group" :aria-label="$t('Msg.Mobile.profile.displayMode')">
                        <button type="button" class="mci-mode-btn" :class="{ active: themeMode === 'light' }" @click="changeMode('light')">
                            <el-icon><Sunny /></el-icon>
                            <span>{{ $t('Msg.Mobile.profile.light') }}</span>
                        </button>
                        <button type="button" class="mci-mode-btn" :class="{ active: themeMode === 'dark' }" @click="changeMode('dark')">
                            <el-icon><Moon /></el-icon>
                            <span>{{ $t('Msg.Mobile.profile.dark') }}</span>
                        </button>
                    </div>
                </div>

                <!-- 当前账号可覆盖租户的界面默认值 -->
                <div class="mci-theme-section">
                    <div class="mci-theme-title">
                        <el-icon><Grid /></el-icon>
                        <span>{{ $t('Msg.FrameworkAppearance.corner') }}</span>
                    </div>
                    <div class="mci-mode-row" role="group" :aria-label="$t('Msg.FrameworkAppearance.corner')">
                        <button v-for="option in cornerOptions" :key="option.value" type="button" class="mci-mode-btn" :aria-pressed="cornerPreference === option.value" :class="{ active: cornerPreference === option.value }" @click="changeCornerStyle(option.value)">{{ $t('Msg.FrameworkAppearance.' + option.labelKey) }}</button>
                    </div>
                </div>

                <div class="mci-theme-section">
                    <div class="mci-theme-title"><el-icon><Menu /></el-icon><span>{{ $t('Msg.FrameworkAppearance.navigation') }}</span></div>
                    <div class="mci-mode-row mci-navigation-mode-row" role="group" :aria-label="$t('Msg.FrameworkAppearance.navigation')">
                        <button v-for="option in navigationOptions" :key="option.value" type="button" class="mci-mode-btn" :aria-pressed="navigationPreference === option.value" :class="{ active: navigationPreference === option.value }" @click="changeNavigationLayout(option.value)">{{ $t('Msg.FrameworkAppearance.' + option.labelKey) }}</button>
                    </div>
                </div>

                <div class="mci-theme-section">
                    <div class="mci-theme-title"><el-icon><Expand /></el-icon><span>{{ $t('Msg.FrameworkAppearance.menuExpand') }}</span></div>
                    <div class="mci-mode-row" role="group" :aria-label="$t('Msg.FrameworkAppearance.menuExpand')">
                        <button v-for="option in menuExpandOptions" :key="option.value" type="button" class="mci-mode-btn" :aria-pressed="menuExpandPreference === option.value" :class="{ active: menuExpandPreference === option.value }" @click="changeMenuChildExpandMode(option.value)">{{ $t('Msg.FrameworkAppearance.' + option.labelKey) }}</button>
                    </div>
                </div>

                <div class="mci-theme-section"><UiDensitySelect @change="changeDensity" /></div>

                <div class="mci-theme-section">
                    <div class="mci-theme-title"><el-icon><Grid /></el-icon><span>{{ $t('Msg.FrameworkAppearance.loginStyle') }}</span></div>
                    <div class="mci-mode-row mci-navigation-mode-row" role="group" :aria-label="$t('Msg.FrameworkAppearance.loginStyle')">
                        <button v-for="option in loginOptions" :key="option.value" type="button" class="mci-mode-btn" :aria-pressed="loginPreference === option.value" :class="{ active: loginPreference === option.value }" @click="changeLoginStyle(option.value)">{{ $t('Msg.FrameworkAppearance.' + option.labelKey) }}</button>
                    </div>
                </div>

                <div class="mci-theme-section mci-appearance-switches">
                    <label v-for="option in appearanceSwitches" :key="option.field" class="mci-appearance-switch">
                        <span>{{ $t('Msg.FrameworkAppearance.' + option.labelKey) }}</span>
                        <el-switch :model-value="appearanceValue(option.field)" :aria-label="$t('Msg.FrameworkAppearance.' + option.labelKey)" @change="changeAppearanceSwitch(option.field, $event)" />
                    </label>
                    <p>{{ $t('Msg.FrameworkAppearance.inheritHint') }}</p>
                </div>

                <!-- 主题色（MCI 设计系统统一调色板） -->
                <div class="mci-theme-section">
                    <div class="mci-theme-title">
                        <el-icon><Brush /></el-icon>
                        <span>{{ $t('Msg.Mobile.profile.themeColor') }}</span>
                    </div>
                    <div class="mci-color-grid" role="group" :aria-label="$t('Msg.Mobile.profile.themeColor')">
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
                        <span>{{ $t('Msg.Mobile.profile.customColor') }}</span>
                    </div>
                    <div class="mci-custom-row">
                        <el-color-picker size="default" v-model="themeColor" @change="changeTheme" />
                        <span class="mci-custom-hint">{{ themeColor || $t('Msg.Mobile.profile.pickColor') }}</span>
                    </div>
                </div>
            </div>

            <div class="mci-theme-panel-foot" :class="{ 'is-local': !canSyncThemePreferences }">
                <el-icon><InfoFilled /></el-icon>
                <span>{{ canSyncThemePreferences ? $t('Msg.Mobile.profile.themeSaveHint') : $t('Msg.Mobile.profile.themeLocalHint') }}</span>
            </div>
        </div>

        <template #reference>
            <slot name="trigger">
                <button type="button" class="theme-select-trigger" :aria-label="$t('Msg.Mobile.profile.themeSettings')" :title="$t('Msg.Mobile.profile.themeSettings')">
                    <el-icon class="theme-icon"><Setting /></el-icon>
                </button>
            </slot>
        </template>
    </el-popover>
</template>

<script>
import { Brush, Sunny, Moon, Check, MagicStick, InfoFilled, Grid, Menu, Expand, Setting } from "@element-plus/icons-vue";
import UiDensitySelect from './UiDensitySelect.vue';
import { computed, reactive, watch } from "vue";
import { getUserVisualPreferenceSaveSession } from "@/utils/user-visual-preference-save-session.js";
import { useDiyStore, useAppStore, useSettingsStore } from "@/pinia";
import { DiyCommon } from "@/utils/diy.common.js";
import { getCornerStyle, setCornerStyle } from "@/utils/theme-shape.js";
import { APPEARANCE_RESET, applyFrameworkAppearance, clearLocalAppearance, readLocalAppearance, saveLocalAppearance, resolveAppearanceSwitch } from '@/utils/framework-appearance.js';
import {
    getThemePalettes,
    setThemeColor as applyThemeColor,
    setThemeMode,
    getThemeMode
} from "@/utils/theme-color.js";
import {
    hasInstalledUserPreference,
    resolveUserThemeColor,
    resolveUserThemeMode,
    resolveUserCornerStyle,
    normalizeUserCornerStyle,
    normalizeUserNavigationLayout,
    normalizeUserMenuChildExpandMode
} from "@/utils/user-visual-preferences.js";

const DEFAULT_THEME_COLOR = "#409eff";

function getActivePreferenceSaveSession(diyStore, userId) {
    const token = DiyCommon.getToken(), osClient = DiyCommon.GetOsClient();
    const claims = DiyCommon.DecodeJwtPayload(token);
    // 标准续签保留 MicroiSessionId，新登录重新生成；解码仅用于队列归属，
    // 接口的真实授权仍由服务端 DiyToken 验证，不以本地声明授予权限。
    const sameActor = String(claims?.UserId || "") === String(userId || "")
        && String(claims?.OsClient || "").toLowerCase() === String(osClient || "").toLowerCase();
    const loginSession = sameActor && claims?.MicroiSessionId ? `session:${claims.MicroiSessionId}` : token;
    return getUserVisualPreferenceSaveSession(diyStore, osClient, userId, reactive, loginSession, DiyCommon.GetApiBase());
}

export default {
    name: "ThemeSelect",
    components: { Brush, Sunny, Moon, Check, MagicStick, InfoFilled, Grid, Menu, Expand, Setting, UiDensitySelect },
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
        const CurrentUser = computed(() => diyStore.GetCurrentUser || {});
        const preferenceSaveSession = computed(() => {
            // 标准 SDK 登录或续签时同步 Pinia.Token；最新凭据读取来自非响应式
            // localStorage，因此显式依赖 Pinia，确保计算属性随会话变化重算。
            void diyStore.Token;
            return getActivePreferenceSaveSession(diyStore, CurrentUser.value?.Id);
        });
        const themeColor = computed({
            get: () => resolveUserThemeColor(
                CurrentUser.value,
                localThemeColor.value,
                SysConfig.value.ThemeColor,
                DEFAULT_THEME_COLOR
            ),
            set: (v) => diyStore.setThemeColor(v)
        });
        watch(
            () => [CurrentUser.value.ThemeColor, SysConfig.value.ThemeColor, localThemeColor.value],
            () => {
                applyFrameworkAppearance(diyStore);
            }
        );
        return { diyStore, appStore, settingsStore, themeColor, localThemeColor, SysConfig, CurrentUser, preferenceSaveSession };
    },
    data() {
        return {
            ShowThemes: false,
            themeMode: 'light',
            cornerStyle: getCornerStyle(),
            cornerOptions: [{value:'System',labelKey:'followSystem'},{value:'round',labelKey:'round'},{value:'square',labelKey:'square'}],
            navigationOptions: [{value:'System',labelKey:'followSystem'},{value:'Side',labelKey:'side'},{value:'Top',labelKey:'top'},{value:'TopSide',labelKey:'topSide'}],
            menuExpandOptions: [{value:'System',labelKey:'followSystem'},{value:'Down',labelKey:'down'},{value:'Right',labelKey:'right'}],
            loginOptions: [{value:'System',labelKey:'followSystem'},{value:'Original',labelKey:'original'},{value:'Minimal',labelKey:'minimal'},{value:'Split',labelKey:'split'},{value:'Console',labelKey:'console'}],
            appearanceSwitches: [{field:'DisableGradient',labelKey:'disableGradient'},{field:'DisableShadow',labelKey:'disableShadow'},{field:'DisableButtonIcon',labelKey:'disableButtonIcon'}],
            // 新旧顶栏共用当前账号的保存状态。
        };
    },
    computed: {
        pendingPreferencePatch: { get() { return this.preferenceSaveSession.pendingPreferencePatch; }, set(value) { this.preferenceSaveSession.pendingPreferencePatch = value; } },
        preferenceSaveTimer: { get() { return this.preferenceSaveSession.preferenceSaveTimer; }, set(value) { this.preferenceSaveSession.preferenceSaveTimer = value; } },
        preferenceSaveInFlight: { get() { return this.preferenceSaveSession.preferenceSaveInFlight; }, set(value) { this.preferenceSaveSession.preferenceSaveInFlight = value; } },
        preferenceSaveState: { get() { return this.preferenceSaveSession.preferenceSaveState; }, set(value) { this.preferenceSaveSession.preferenceSaveState = value; } },
        preferenceSaveError: { get() { return this.preferenceSaveSession.preferenceSaveError; }, set(value) { this.preferenceSaveSession.preferenceSaveError = value; } },
        cornerPreference() { return normalizeUserCornerStyle(this.CurrentUser?.CornerStyle); },
        navigationPreference() { return normalizeUserNavigationLayout(this.CurrentUser?.NavigationLayout); },
        menuExpandPreference() { return normalizeUserMenuChildExpandMode(this.CurrentUser?.MenuChildExpandMode); },
        loginPreference() { return this.CurrentUser?.LoginStyle || 'System'; },
        // 每种显示模式固定 12 色（6 × 2）；暗色模式不出现白色主色。
        mciPresets() {
            return getThemePalettes(this.themeMode);
        },
        canSyncThemePreferences() {
            return hasInstalledUserPreference(this.CurrentUser, "ThemeMode")
                || hasInstalledUserPreference(this.CurrentUser, "ThemeColor")
                || hasInstalledUserPreference(this.CurrentUser, "CornerStyle")
                || hasInstalledUserPreference(this.CurrentUser, "NavigationLayout")
                || hasInstalledUserPreference(this.CurrentUser, "MenuChildExpandMode")
                || hasInstalledUserPreference(this.CurrentUser, "UiDensityScale")
                || hasInstalledUserPreference(this.CurrentUser, "DisableGradient");
        },
        preferenceSaveStatusText() {
            const keys = {
                pending: "themeWaitingSave",
                saving: "themeSaving",
                saved: "themeAutoSaved",
                error: "themeSaveFailed"
            };
            return this.$t(`Msg.Mobile.profile.${keys[this.preferenceSaveState] || keys.saved}`);
        }
    },
    mounted() {
        // 已安装个人偏好字段时以服务端用户值为准；旧租户继续保留本机兼容值。
        this.themeMode = resolveUserThemeMode(
            this.CurrentUser,
            readLocalAppearance(this.diyStore).ThemeMode || '',
            this.SysConfig?.ThemeMode,
            "light"
        );
        setThemeMode(this.themeMode, { persist: false });
        this.applyResolvedCornerStyle();
        const appliedColor = applyThemeColor(this.themeColor || DEFAULT_THEME_COLOR, { mode: this.themeMode });
        if (appliedColor && !this.isActive(appliedColor)) this.diyStore.setThemeColor(appliedColor);
    },
    beforeUnmount() {
        if (this.preferenceSaveTimer) clearTimeout(this.preferenceSaveTimer);
        this.preferenceSaveTimer = null;
        // TopSide 切换顶栏挂载位置；卸载前发送最终待保存选择，后续在途请求
        // 仍使用同一会话队列，避免重建组件清掉尚未发出的防抖保存。
        void this.flushVisualPreferences();
    },
    watch: {
        "CurrentUser.ThemeMode"() {
            this.applyResolvedThemeMode();
        },
        "SysConfig.ThemeMode"() {
            this.applyResolvedThemeMode();
        },
        "CurrentUser.CornerStyle"() {
            this.applyResolvedCornerStyle();
        },
        "CurrentUser.Id"() {
            this.applyResolvedCornerStyle();
        },
        "SysConfig.CornerStyle"() {
            this.applyResolvedCornerStyle();
        }
    },
    methods: {
        appearanceValue(field) {
            return resolveAppearanceSwitch(this.CurrentUser, this.SysConfig, field, readLocalAppearance(this.diyStore));
        },
        changeAppearanceSwitch(field, value) {
            this.saveInstalledVisualPreferences({ [field]: value ? 1 : 0 });
        },
        changeDensity(value) {
            this.saveInstalledVisualPreferences({ UiDensityScale: value });
        },
        changeLoginStyle(value) {
            this.saveInstalledVisualPreferences({ LoginStyle: value });
        },
        resetVisualPreferences() {
            clearLocalAppearance(this.diyStore);
            this.saveInstalledVisualPreferences({ ...APPEARANCE_RESET });
            applyFrameworkAppearance(this.diyStore, {});
            this.applyResolvedThemeMode();
            this.applyResolvedCornerStyle();
        },
        applyResolvedCornerStyle() {
            this.cornerStyle = setCornerStyle(resolveUserCornerStyle(this.CurrentUser, readLocalAppearance(this.diyStore).CornerStyle || '', this.SysConfig?.CornerStyle), { persist: false });
        },
        changeCornerStyle(style) {
            if (!hasInstalledUserPreference(this.CurrentUser, 'CornerStyle')) {
                saveLocalAppearance(this.diyStore, { CornerStyle: style });
                this.cornerStyle = setCornerStyle(style === 'System' ? this.SysConfig?.CornerStyle : style, { persist: false });
                return;
            }
            this.saveInstalledVisualPreferences({ CornerStyle: normalizeUserCornerStyle(style) });
            this.applyResolvedCornerStyle();
        },
        changeNavigationLayout(value) {
            this.saveInstalledVisualPreferences({ NavigationLayout: normalizeUserNavigationLayout(value) });
        },
        changeMenuChildExpandMode(value) {
            this.saveInstalledVisualPreferences({ MenuChildExpandMode: normalizeUserMenuChildExpandMode(value) });
        },
        applyResolvedThemeMode() {
            const mode = resolveUserThemeMode(
                this.CurrentUser,
                readLocalAppearance(this.diyStore).ThemeMode || '',
                this.SysConfig?.ThemeMode,
                "light"
            );
            if (mode !== this.themeMode) {
                this.themeMode = mode;
                setThemeMode(mode, { persist: false });
            }
        },
        isActive(color) {
            return (this.themeColor || '').toLowerCase() === (color || '').toLowerCase();
        },
        changeTheme(color) {
            if (!color) color = (this.SysConfig && this.SysConfig.ThemeColor) || DEFAULT_THEME_COLOR;
            const appliedColor = applyThemeColor(color, { mode: this.themeMode });
            const nextColor = appliedColor || color;
            this.diyStore.setThemeColor(nextColor);
            this.saveInstalledVisualPreferences({ ThemeColor: nextColor });
        },
        changeMode(mode) {
            this.themeMode = mode;
            const appliedColor = setThemeMode(mode);
            // 从浅色白色切到暗色时自动回落为蓝色，并同步持久化状态。
            const patch = { ThemeMode: mode };
            if (appliedColor && !this.isActive(appliedColor)) {
                this.diyStore.setThemeColor(appliedColor);
                patch.ThemeColor = appliedColor;
            }
            this.saveInstalledVisualPreferences(patch);
        },
        saveInstalledVisualPreferences(patch) {
            const local = saveLocalAppearance(this.diyStore, patch);
            const userId = String(this.CurrentUser?.Id || "");
            if (!userId) { applyFrameworkAppearance(this.diyStore, local); return; }
            const installedPatch = Object.fromEntries(
                Object.entries(patch || {}).filter(([key]) => hasInstalledUserPreference(this.CurrentUser, key))
            );
            if (!Object.keys(installedPatch).length) { applyFrameworkAppearance(this.diyStore, local); return; }

            this.diyStore.setCurrentUser({ ...this.CurrentUser, ...installedPatch });
            applyFrameworkAppearance(this.diyStore, local);
            Object.assign(this.pendingPreferencePatch, installedPatch);
            this.preferenceSaveState = "pending";
            this.preferenceSaveError = "";
            this.scheduleVisualPreferenceFlush();
        },
        scheduleVisualPreferenceFlush(delay = 250, session = this.preferenceSaveSession) {
            if (session.preferenceSaveTimer) clearTimeout(session.preferenceSaveTimer);
            session.preferenceSaveTimer = setTimeout(() => {
                session.preferenceSaveTimer = null;
                void this.flushVisualPreferences(session);
            }, delay);
        },
        retryVisualPreferences() {
            if (this.preferenceSaveState !== "error" || !Object.keys(this.pendingPreferencePatch).length) return;
            this.preferenceSaveError = "";
            if (this.preferenceSaveTimer) clearTimeout(this.preferenceSaveTimer);
            this.preferenceSaveTimer = null;
            void this.flushVisualPreferences();
        },
        async flushVisualPreferences(session = this.preferenceSaveSession) {
            if (session.preferenceSaveInFlight || !Object.keys(session.pendingPreferencePatch).length) return;
            const ownsCurrentActor = () => session === getActivePreferenceSaveSession(this.diyStore, this.CurrentUser?.Id);
            if (!ownsCurrentActor()) {
                session.pendingPreferencePatch = {};
                return;
            }
            const patch = { ...session.pendingPreferencePatch };
            session.pendingPreferencePatch = {};
            session.preferenceSaveInFlight = true;
            session.preferenceSaveState = "saving";
            let succeeded = false;
            try {
                const result = await DiyCommon.ApiEngine.Run(
                    "platform-user-update-preferences",
                    patch
                );
                if (!result || result.Code !== 1) {
                    throw new Error(result?.Msg || this.$t('Msg.FrameworkAppearance.saveFailed'));
                }
                // RefreshLoginUser may return a scheduled refresh receipt rather
                // than the login-user projection. Keep the authenticated user
                // snapshot unless the response identifies this same user.
                if (ownsCurrentActor() && result.Data?.Id && String(result.Data.Id) === session.userId) {
                    this.diyStore.setCurrentUser({ ...this.CurrentUser, ...result.Data, ...session.pendingPreferencePatch });
                }
                succeeded = true;
                session.preferenceSaveState = Object.keys(session.pendingPreferencePatch).length ? "pending" : "saved";
                session.preferenceSaveError = "";
            } catch (error) {
                session.pendingPreferencePatch = { ...patch, ...session.pendingPreferencePatch };
                session.preferenceSaveState = "error";
                session.preferenceSaveError = error?.message || String(error);
                if (ownsCurrentActor()) DiyCommon.Tips(this.$t('Msg.FrameworkAppearance.deviceSaveFailed', { message: error?.message || error }), false);
            } finally {
                session.preferenceSaveInFlight = false;
                if (succeeded && Object.keys(session.pendingPreferencePatch).length) this.scheduleVisualPreferenceFlush(250, session);
            }
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
    padding: 0;
}
.mci-theme-reset {
    flex: none; border: 1px solid var(--mci-border-color); border-radius: 6px;
    background: var(--mci-bg-elevated); color: var(--mci-text-primary);
    padding: 5px 8px; font: inherit; font-size: 12px; cursor: pointer;
    &:hover { border-color: var(--el-color-primary); color: var(--el-color-primary); }
    &:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 2px; }
}
.mci-theme-status-row { display: flex; justify-content: flex-end; padding: 6px 16px 0; }
.mci-appearance-switch { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 34px; color: var(--mci-text-primary); font-size: 13px; }
.mci-appearance-switches p { margin: 4px 0 0; font-size: 11px; color: var(--mci-text-secondary); }

.mci-theme-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px 12px;
    border-bottom: 1px solid var(--mci-border-color, rgba(0, 0, 0, 0.06));
    background: linear-gradient(135deg, var(--mci-color-primary-glow, rgba(108, 43, 217, 0.12)), transparent 72%);
}

.mci-theme-heading {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--mci-text-primary, #1a1a2e);
    font-size: 14px;

    strong { line-height: 20px; }
}

.mci-theme-heading-icon {
    flex: 0 0 34px;
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: var(--mci-gradient-primary, linear-gradient(135deg, #6c2bd9, #2196f3));
    box-shadow: var(--mci-shadow-button, 0 4px 14px rgba(108, 43, 217, 0.2));
    color: var(--mci-text-on-primary, #fff);
}

.mci-theme-save-status {
    flex: 0 0 auto;
    min-height: 26px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 9px;
    border: 0;
    border-radius: 999px;
    background: var(--mci-bg-surface, #f0f0f8);
    color: var(--mci-text-secondary, #64648c);
    cursor: default;
    font: inherit;
    font-size: 11px;

    i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    &.is-pending, &.is-saving { color: var(--mci-color-warning, #d97706); }
    &.is-saved {
        color: color-mix(
            in srgb,
            var(--mci-color-success, #059669) 60%,
            var(--mci-text-primary, #1a1a2e)
        );
    }
    &.is-error { color: var(--mci-color-danger, #dc2626); cursor: pointer; }
    &.is-local { color: var(--mci-text-tertiary, #9898b0); }
}

.mci-theme-panel-body {
    padding: 14px 16px 16px;
    max-height: min(640px, calc(100vh - 180px));
    overflow-y: auto;
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
.mci-navigation-mode-row { display:grid;grid-template-columns:repeat(2,minmax(0,1fr)); }
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

.mci-theme-panel-foot {
    display: flex;
    align-items: flex-start;
    gap: 7px;
    padding: 10px 14px 11px;
    border-top: 1px solid var(--mci-border-color, rgba(0, 0, 0, 0.06));
    background: var(--mci-bg-surface, #f0f0f8);
    color: var(--mci-text-secondary, #64648c);
    font-size: 11px;
    line-height: 17px;

    .el-icon { flex: 0 0 auto; margin-top: 1px; }
    &.is-local { color: var(--mci-text-tertiary, #9898b0); }
}
</style>

<style lang="scss">
/* 全局：让 popover 也使用 MCI 卡片风格 */
.mci-theme-popover.el-popover {
    background: var(--mci-bg-elevated, #fff);
    border: 1px solid var(--mci-border-color, rgba(0, 0, 0, 0.08));
    border-radius: 12px;
    box-shadow: var(--mci-shadow-dropdown, 0 12px 36px rgba(15, 18, 30, 0.12));
    padding: 0;
    overflow: hidden;
}
</style>
