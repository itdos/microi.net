import { reactive } from 'vue';
import { DiyCommon } from './microi.net.import';
import { createPanelPreferenceClient, normalizePanelWidth, resolvePanelCollapsed } from './panel-layout-preferences.js';

export default {
    data() { return { localPanelLayout: {}, panelPreferenceClient: null }; },
    computed: {
        panelLayoutIdentity() { return JSON.stringify([DiyCommon.GetApiBase(), this.diyStore.OsClient, this.diyStore.GetCurrentUser?.Id || 'anonymous']); },
        sidebarWidthPreference() { return normalizePanelWidth(this.panelPreference('SidebarWidth'), normalizePanelWidth(this.diyStore.SysConfig?.MenuWidth)); },
        roleTreeWidthPreference() { return normalizePanelWidth(this.panelPreference('RoleTreeWidth'), 240); },
        sidebarCollapsedPreference() { return resolvePanelCollapsed(this.panelPreference('SidebarCollapsed')); },
        roleTreeCollapsedPreference() { return resolvePanelCollapsed(this.panelPreference('RoleTreeCollapsed')); }
    },
    watch: {
        panelLayoutIdentity: { immediate: true, handler() {
            try { this.localPanelLayout = JSON.parse(localStorage.getItem('microi.panel-layout:' + this.panelLayoutIdentity) || '{}'); }
            catch { this.localPanelLayout = {}; }
        } }
    },
    created() {
        this.panelPreferenceClient = createPanelPreferenceClient({
            store: this.diyStore, reactive,
            getToken: () => DiyCommon.getToken(), decodeToken: token => DiyCommon.DecodeJwtPayload(token),
            getApiBase: () => DiyCommon.GetApiBase(), getOsClient: () => DiyCommon.GetOsClient(),
            run: (key, patch) => DiyCommon.ApiEngine.Run(key, patch), saveFailedMessage: this.$t('Msg.FrameworkAppearance.saveFailed'),
            notify: message => DiyCommon.Tips(this.$t('Msg.FrameworkAppearance.deviceSaveFailed', { message }), false)
        });
    },
    beforeUnmount() {
        const session = this.panelPreferenceClient?.activeSession();
        if (session?.preferenceSaveTimer) { clearTimeout(session.preferenceSaveTimer); session.preferenceSaveTimer = null; }
        void this.panelPreferenceClient?.flush(session);
    },
    methods: {
        panelPreference(field) {
            const user = this.diyStore.GetCurrentUser || {};
            return Object.hasOwn(user, field) ? user[field] : this.localPanelLayout[field];
        },
        savePanelLayout(patch) {
            if (this.panelPreferenceClient.save(patch)) return;
            // 未安装字段的旧租户仅使用按服务器、租户和账号隔离的兼容回退。
            this.localPanelLayout = { ...this.localPanelLayout, ...patch };
            try { localStorage.setItem('microi.panel-layout:' + this.panelLayoutIdentity, JSON.stringify(this.localPanelLayout)); } catch { /* 私密模式仍保留当前实例效果。 */ }
        }
    }
};
