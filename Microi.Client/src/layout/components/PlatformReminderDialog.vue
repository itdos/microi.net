<template>
    <el-dialog :model-value="!!current" class="mci-platform-reminder mci-unified-dialog" :title="current?.Title || '系统提醒'"
        width="min(560px, calc(100vw - 24px))" align-center draggable append-to-body destroy-on-close
        :close-on-click-modal="false" :before-close="closeCurrent" :modal-class="overlayClass">
        <template v-if="current">
            <div class="mci-platform-reminder__label"><el-icon :class="`is-${current.Severity}`"><component :is="reminderIcon" /></el-icon><span>{{ sourceLabel }}</span></div>
            <div class="mci-platform-reminder__content">{{ current.Content }}</div>
        </template>
        <template #footer>
            <span v-if="queue.length > 1" class="mci-platform-reminder__remaining">还有 {{ queue.length - 1 }} 条提醒</span>
            <el-button v-if="link" tag="a" :href="link" target="_blank" rel="noopener noreferrer">{{ current.LinkText || '查看详情' }}</el-button>
            <el-button type="primary" @click="closeCurrent">我知道了</el-button>
        </template>
    </el-dialog>
</template>

<script setup>
import { computed, ref, watch, onBeforeUnmount, getCurrentInstance } from 'vue';
import { Bell, Clock, Warning, Tools, InfoFilled, Present } from '@element-plus/icons-vue';
import { useDiyStore } from '@/pinia';
import { DiyCommon } from '@/utils/microi.net.import';
import { isFormMaskBlurDisabled } from '@/utils/form-mask-blur';
import { REALTIME_CONNECTED_EVENT, REALTIME_STATE_EVENT } from '@/utils/realtime-connection';
import { createReminderInbox, safeReminderLink } from '@/utils/platform-reminder-inbox';

const store = useDiyStore(), instance = getCurrentInstance(), queue = ref([]);
// 一个浏览器文档只分配一次身份；切换路由和实时重连不会重复触发“每次进入”。
const entryId = window.__MICROI_REMINDER_ENTRY_ID__ ||= (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
let controller, socket;
const current = computed(() => queue.value[0]);
const reminderIcon = computed(() => ({ bell: Bell, clock: Clock, warning: Warning, maintenance: Tools, info: InfoFilled, gift: Present }[current.value?.Icon] || Bell));
const sourceLabel = computed(() => ({ Local: '系统提醒', Parent: '平台提醒', Official: '吾码官方提醒' }[current.value?.Source] || '系统提醒'));
const link = computed(() => safeReminderLink(current.value?.LinkUrl, window.location.origin));
const overlayClass = computed(() => ['diy-form-modern-overlay', 'mci-unified-overlay', isFormMaskBlurDisabled(store.SysConfig) ? 'diy-form-modern-overlay--plain mci-unified-overlay--plain' : ''].join(' '));
function connected() { return (socket?.state || window.__MICROI_REALTIME_STATE__?.state) === 'Connected'; }
function refresh() { controller?.refresh(); }
function bindSocket() {
    const next = instance?.proxy?.$websocket || window.__VUE_APP__?.config?.globalProperties?.$websocket;
    if (socket !== next) { socket?.off?.('ReceivePlatformReminder', refresh); socket = next; socket?.on?.('ReceivePlatformReminder', refresh); }
    refresh();
}
function closeCurrent() { if (current.value) void controller?.close(current.value.Id); }
function onVisible() { if (document.visibilityState === 'visible') bindSocket(); }
watch(() => `${store.GetCurrentUser?.Id || ''}|${DiyCommon.GetOsClient?.() || ''}|${store.SysConfig?.ApiBase || ''}`, () => {
    controller?.dispose(); queue.value = [];
    if (!store.GetCurrentUser?.Id || !DiyCommon.getToken()) return;
    controller = createReminderInbox({ entryId, connected, onChange: rows => { queue.value = rows; },
        request: params => DiyCommon.Http.Post({ Url: '/apiengine/platform-reminder-runtime', PostParam: params, Timeout: 12 }) });
    bindSocket();
}, { immediate: true });
window.addEventListener(REALTIME_CONNECTED_EVENT, bindSocket);
window.addEventListener(REALTIME_STATE_EVENT, bindSocket);
window.addEventListener('online', bindSocket);
document.addEventListener('visibilitychange', onVisible);
onBeforeUnmount(() => {
    controller?.dispose(); socket?.off?.('ReceivePlatformReminder', refresh);
    window.removeEventListener(REALTIME_CONNECTED_EVENT, bindSocket); window.removeEventListener(REALTIME_STATE_EVENT, bindSocket);
    window.removeEventListener('online', bindSocket); document.removeEventListener('visibilitychange', onVisible);
});
</script>

<style scoped>
.mci-platform-reminder__label{display:flex;gap:10px;align-items:center;margin:0 0 16px;color:var(--el-text-color-secondary);font-size:13px}
.mci-platform-reminder__label .el-icon{font-size:25px;color:var(--el-color-primary)}
.mci-platform-reminder__label .is-warning{color:var(--el-color-warning)}.mci-platform-reminder__label .is-error{color:var(--el-color-danger)}.mci-platform-reminder__label .is-success{color:var(--el-color-success)}
.mci-platform-reminder__content{max-height:55vh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:15px;line-height:1.85;color:var(--el-text-color-primary)}
.mci-platform-reminder__remaining{margin-right:12px;color:var(--el-text-color-secondary);font-size:12px}
</style>
