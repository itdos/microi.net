<template>
    <div
        :class="rootClasses"
        role="button"
        tabindex="0"
        :data-testid="variant === 'profile' ? 'bluetooth-profile-entry' : 'bluetooth-navbar-entry'"
        :title="titleText"
        :aria-label="titleText"
        @click="openBluetoothPage"
        @keydown.enter.prevent="openBluetoothPage"
        @keydown.space.prevent="openBluetoothPage"
    >
        <template v-if="variant === 'navbar'">
            <span class="bluetooth-navbar-icon" :class="statusClass">
                <font-awesome-icon icon="fa-brands fa-bluetooth-b" />
                <span class="bluetooth-status-dot" aria-hidden="true"></span>
            </span>
        </template>
        <template v-else>
            <div class="mci-cell__icon bluetooth-profile-icon" :class="statusClass">
                <font-awesome-icon icon="fa-brands fa-bluetooth-b" />
            </div>
            <div class="mci-cell__main bluetooth-profile-main">
                <div class="bluetooth-profile-title-row">
                    <span class="mci-cell__title">{{ t("Msg.BluetoothConnection") }}</span>
                    <span class="bluetooth-state-label" :class="statusClass">{{ statusLabel }}</span>
                </div>
                <span class="mci-cell__desc">{{ descriptionText }}</span>
            </div>
            <el-icon class="mci-cell__arrow"><ArrowRight /></el-icon>
        </template>
    </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ArrowRight } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { getV8Print } from "@/utils/v8-print.js";

const props = defineProps({
    variant: {
        type: String,
        default: "navbar",
        validator: (value) => ["navbar", "profile"].includes(value)
    }
});

const { t } = useI18n();
const printer = getV8Print();
const connection = ref(printer.getConnectionState());
let unsubscribeConnection = null;

const variant = computed(() => props.variant);
const rootClasses = computed(() => props.variant === "profile"
    ? ["mci-cell", "bluetooth-profile-entry"]
    : ["right-menu-item", "hover-effect", "bluetooth-navbar-entry"]);
const statusClass = computed(() => ({
    "is-connected": connection.value.connected,
    "is-busy": ["connecting", "reconnecting"].includes(connection.value.status),
    "is-unsupported": !connection.value.supported,
    "is-disconnected": !connection.value.connected && connection.value.supported
}));

const statusLabel = computed(() => {
    if (connection.value.connected) return t("Msg.BluetoothConnected");
    if (["connecting", "reconnecting"].includes(connection.value.status)) return t("Msg.BluetoothConnecting");
    if (!connection.value.supported) return t("Msg.BluetoothUnavailable");
    return t("Msg.BluetoothDisconnected");
});

const descriptionText = computed(() => {
    const name = connection.value.deviceName || t("Msg.BluetoothPrinter");
    if (connection.value.connected) return t("Msg.BluetoothCurrentDevice", { name });
    if (["connecting", "reconnecting"].includes(connection.value.status)) return t("Msg.BluetoothConnectingDevice", { name });
    if (!connection.value.supported) return t("Msg.BluetoothNotSupported");
    if (connection.value.remembered) return t("Msg.BluetoothRememberedDevice", { name });
    return t("Msg.BluetoothNotConnectedHint");
});

const titleText = computed(() => {
    const name = connection.value.deviceName || t("Msg.BluetoothPrinter");
    if (connection.value.connected) return t("Msg.BluetoothTitleConnected", { name });
    if (["connecting", "reconnecting"].includes(connection.value.status)) return t("Msg.BluetoothTitleConnecting");
    if (!connection.value.supported) return t("Msg.BluetoothTitleUnsupported");
    if (connection.value.remembered) return t("Msg.BluetoothTitleDisconnected", { name });
    return t("Msg.BluetoothTitleNotConnected");
});

async function openBluetoothPage() {
    try {
        await printer.OpenBluetoothPage();
        connection.value = printer.getConnectionState();
    } catch (error) {
        ElMessage.error(t("Msg.BluetoothOpenFailed", { message: error?.message || error }));
    }
}

onMounted(() => {
    unsubscribeConnection = printer.subscribeConnection((state) => {
        connection.value = state;
    });
    void printer.initializeConnection();
});

onBeforeUnmount(() => {
    if (unsubscribeConnection) unsubscribeConnection();
});
</script>

<style lang="scss" scoped>
.bluetooth-navbar-entry {
    position: relative;
    min-width: 40px;
    box-sizing: border-box;
    outline: none;

    &:focus-visible {
        box-shadow: inset 0 0 0 2px var(--el-color-primary, #409eff);
    }
}

.bluetooth-navbar-icon {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    color: var(--el-text-color-regular, #5a5e66);
    font-size: 19px;
    transition: color 0.2s ease, transform 0.2s ease;

    &.is-connected { color: var(--el-color-success, #67c23a); }
    &.is-busy { color: var(--el-color-warning, #e6a23c); }
    &.is-unsupported { color: var(--el-text-color-placeholder, #a8abb2); }
}

.bluetooth-status-dot {
    position: absolute;
    right: -3px;
    bottom: 0;
    width: 7px;
    height: 7px;
    border: 2px solid var(--el-bg-color, #fff);
    border-radius: 50%;
    background: var(--el-text-color-placeholder, #a8abb2);
    box-sizing: content-box;
}

.is-connected .bluetooth-status-dot { background: var(--el-color-success, #67c23a); }
.is-busy .bluetooth-status-dot {
    background: var(--el-color-warning, #e6a23c);
    animation: bluetooth-pulse 1.2s ease-in-out infinite;
}

.bluetooth-profile-entry {
    display: flex;
    align-items: center;
    min-height: 64px;
    padding: 12px 14px;
    gap: 12px;
    cursor: pointer;
    outline: none;
    -webkit-tap-highlight-color: transparent;

    &:active { background: var(--el-fill-color-light, #f5f7fa); }
    &:focus-visible { box-shadow: inset 0 0 0 2px var(--el-color-primary, #409eff); }
}

.bluetooth-profile-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    flex: 0 0 40px;
    border-radius: 12px;
    color: #fff;
    font-size: 20px;
    background: linear-gradient(135deg, #64748b, #94a3b8);

    &.is-connected { background: linear-gradient(135deg, #16a34a, #4ade80); }
    &.is-busy { background: linear-gradient(135deg, #d97706, #fbbf24); }
    &.is-unsupported { background: linear-gradient(135deg, #9ca3af, #d1d5db); }
}

.bluetooth-profile-main {
    min-width: 0;
    flex: 1;
}

.bluetooth-profile-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

.bluetooth-state-label {
    flex-shrink: 0;
    padding: 2px 7px;
    border-radius: 999px;
    background: var(--el-fill-color, #f0f2f5);
    color: var(--el-text-color-secondary, #909399);
    font-size: 10px;
    line-height: 1.4;

    &.is-connected { background: var(--el-color-success-light-9, #f0f9eb); color: var(--el-color-success, #67c23a); }
    &.is-busy { background: var(--el-color-warning-light-9, #fdf6ec); color: var(--el-color-warning, #e6a23c); }
}

.bluetooth-profile-entry .mci-cell__desc {
    display: block;
    margin-top: 4px;
    overflow: hidden;
    color: var(--mci-text-tertiary, var(--el-text-color-secondary, #909399));
    font-size: 12px;
    line-height: 1.4;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.bluetooth-profile-entry .mci-cell__arrow {
    flex: 0 0 auto;
    color: var(--el-text-color-placeholder, #a8abb2);
}

@keyframes bluetooth-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.45; transform: scale(0.78); }
}

@media (prefers-reduced-motion: reduce) {
    .is-busy .bluetooth-status-dot { animation: none; }
}
</style>
