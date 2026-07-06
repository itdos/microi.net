<template>
    <el-popover placement="bottom-end" trigger="click" width="520" popper-class="microi-task-popover" @show="refreshAll">
        <template #reference>
            <div class="right-menu-item hover-effect task-entry" :title="$t('Msg.NotificationCenter')">
                <el-badge :value="badgeCount" :max="99" :hidden="badgeCount === 0" :class="{ 'task-badge-flash': badgeCount > 0 }">
                    <el-icon class="task-icon"><Bell /></el-icon>
                </el-badge>
            </div>
        </template>

        <div class="task-panel">
            <div class="task-panel-header">
                <span>{{ $t("Msg.NotificationCenter") }}</span>
                <div class="task-panel-actions">
                    <el-button link size="small" :icon="Refresh" :loading="loading || storeLoading" @click="refreshAll">{{ $t("Msg.Refresh") }}</el-button>
                </div>
            </div>

            <el-tabs v-model="activeTab" class="notification-tabs">
                <el-tab-pane name="tasks">
                    <template #label>
                        <span>{{ $t("Msg.BackgroundTasks") }}</span>
                        <span v-if="runningCount > 0" class="tab-count">{{ runningCount }}</span>
                    </template>

                    <div class="task-sub-actions">
                        <el-button link size="small" :icon="Delete" @click="clearCompleted">{{ $t("Msg.ClearCompleted") }}</el-button>
                    </div>
                    <div v-if="tasks.length === 0" class="task-empty">{{ $t("Msg.NoBackgroundTasks") }}</div>
                    <div v-else class="task-list">
                        <div v-for="item in tasks" :key="item.Id" class="task-item">
                            <div class="task-main">
                                <span class="task-title">{{ item.Title || item.Type || $t("Msg.BackgroundTasks") }}</span>
                                <span class="task-status" :class="'status-' + item.Status">{{ item.StatusText || item.Status }}</span>
                            </div>
                            <el-progress :percentage="Number(item.Progress || 0)" :stroke-width="6" :show-text="false" />
                            <div class="task-meta">
                                <span>{{ formatTime(item.CreateTime) }}</span>
                                <span v-if="item.ElapsedText">{{ $t("Msg.Elapsed") }} {{ item.ElapsedText }}</span>
                                <el-button v-if="canCancel(item)" link size="small" type="danger" :icon="CircleClose" @click.stop="cancelTask(item)">
                                    {{ $t("Msg.Stop") }}
                                </el-button>
                            </div>
                            <div v-if="item.Msg" class="task-msg" :title="item.Msg">{{ item.Msg }}</div>
                        </div>
                    </div>
                </el-tab-pane>

                <el-tab-pane v-if="isAdmin" name="apps">
                    <template #label>
                        <span>{{ $t("Msg.OfficialApps") }}</span>
                        <span v-if="appNoticeCount > 0" class="tab-count warning">{{ appNoticeCount }}</span>
                    </template>

                    <div class="app-panel-toolbar">
                        <span class="app-panel-tip">{{ $t("Msg.OfficialAppUpdateTip") }}</span>
                        <el-button type="primary" link size="small" @click="goAppStore">{{ $t("Msg.GoAppStore") }}</el-button>
                    </div>
                    <div v-if="storeLoading" class="task-empty">{{ $t("Msg.Loading") }}</div>
                    <div v-else-if="storeNotices.length === 0" class="task-empty">{{ $t("Msg.NoOfficialAppUpdates") }}</div>
                    <div v-else class="app-notice-list">
                        <div v-for="item in storeNotices" :key="(item.AppId || item.StoreId || item.AppName) + item.Status" class="app-notice-item">
                            <div class="app-notice-main">
                                <span class="app-name">{{ item.AppName || item.AppId || $t("Msg.Unnamed") }}</span>
                                <el-tag v-if="item.Status === 'Uninstalled'" size="small" type="danger">{{ $t("Msg.OfficialAppUninstalled") }}</el-tag>
                                <el-tag v-else-if="item.Status === 'Abnormal'" size="small" type="danger">{{ $t("Msg.OfficialAppAbnormal") }}</el-tag>
                                <el-tag v-else size="small" type="warning">{{ $t("Msg.OfficialAppOutdated") }}</el-tag>
                            </div>
                            <div class="app-notice-meta">
                                <span v-if="item.AppVersionInstall || item.InstalledVersion">
                                    {{ $t("Msg.OfficialAppInstalledVersion") }} {{ item.AppVersionInstall || item.InstalledVersion }}
                                </span>
                                <span>{{ $t("Msg.OfficialAppLatestVersion") }} {{ item.AppVersion || "-" }}</span>
                            </div>
                        </div>
                    </div>
                </el-tab-pane>
            </el-tabs>
        </div>
    </el-popover>
</template>

<script>
import { DiyCommon } from "@/utils/diy.common";
import { Bell, CircleClose, Delete, Refresh } from "@element-plus/icons-vue";
import { useDiyStore } from "@/pinia";

const STORE_CHECK_INTERVAL = 10 * 60 * 1000;
const MASTER_STORE_ENGINE_URL = "https://api.itdos.com/api/ApiEngine/Run";

export default {
    name: "BackgroundTaskCenter",
    components: {
        Bell
    },
    setup() {
        const diyStore = useDiyStore();
        return { diyStore };
    },
    data() {
        return {
            activeTab: "tasks",
            tasks: [],
            storeNotices: [],
            loading: false,
            storeLoading: false,
            lastStoreCheckTime: 0,
            storeCheckTimer: null,
            Delete,
            Refresh,
            CircleClose
        };
    },
    computed: {
        isAdmin() {
            const user = this.diyStore?.GetCurrentUser || {};
            return user._IsAdmin === true
                || user._IsAdmin === 1
                || user._IsAdmin === "1"
                || user._IsAdmin === "true";
        },
        runningCount() {
            return this.tasks.filter((item) => item.Status === "Pending" || item.Status === "Running").length;
        },
        appNoticeCount() {
            return this.isAdmin ? this.storeNotices.length : 0;
        },
        badgeCount() {
            return this.runningCount + this.appNoticeCount;
        }
    },
    mounted() {
        this.bindWebsocket();
        this.refreshTasks();
        this.startOfficialAppChecker();
        window.addEventListener("microi-websocket-connected", this.handleWebSocketConnected);
    },
    beforeUnmount() {
        window.removeEventListener("microi-websocket-connected", this.handleWebSocketConnected);
        this.stopOfficialAppChecker();
        const ws = this.getWebsocket();
        if (ws && typeof ws.off === "function") {
            ws.off("ReceiveBackgroundTaskList", this.handleTaskList);
        }
    },
    watch: {
        isAdmin(value) {
            if (value) {
                this.startOfficialAppChecker(true);
            } else {
                this.stopOfficialAppChecker();
                this.storeNotices = [];
                if (this.activeTab === "apps") {
                    this.activeTab = "tasks";
                }
            }
        }
    },
    methods: {
        getWebsocket() {
            return this.$websocket || window?.app?.config?.globalProperties?.$websocket;
        },
        bindWebsocket() {
            const ws = this.getWebsocket();
            if (!ws || typeof ws.on !== "function") return;
            if (typeof ws.off === "function") {
                ws.off("ReceiveBackgroundTaskList", this.handleTaskList);
            }
            ws.on("ReceiveBackgroundTaskList", this.handleTaskList);
        },
        handleWebSocketConnected() {
            this.bindWebsocket();
            this.requestTaskListByWebsocket();
        },
        handleTaskList(data) {
            this.tasks = Array.isArray(data) ? data : [];
        },
        refreshAll() {
            this.refreshTasks();
            if (this.isAdmin) {
                this.checkOfficialApps(true);
            }
        },
        startOfficialAppChecker(force = false) {
            if (!this.isAdmin) return;
            this.checkOfficialApps(force);
            if (!this.storeCheckTimer) {
                this.storeCheckTimer = window.setInterval(() => {
                    this.checkOfficialApps(false);
                }, STORE_CHECK_INTERVAL);
            }
        },
        stopOfficialAppChecker() {
            if (this.storeCheckTimer) {
                window.clearInterval(this.storeCheckTimer);
                this.storeCheckTimer = null;
            }
        },
        async refreshTasks() {
            this.bindWebsocket();
            const requested = await this.requestTaskListByWebsocket();
            if (!requested) {
                await this.loadTasks();
            }
        },
        async requestTaskListByWebsocket() {
            const ws = this.getWebsocket();
            if (!ws || ws.state !== "Connected" || typeof ws.invoke !== "function") {
                return false;
            }
            try {
                await ws.invoke("SendBackgroundTaskList");
                return true;
            } catch (error) {
                console.warn("[BackgroundTask] WebSocket request failed", error);
                return false;
            }
        },
        async loadTasks() {
            if (this.loading) return;
            this.loading = true;
            try {
                const result = await DiyCommon.PostAsync("/api/BackgroundTask/List", {}, null, null, "json");
                if (result && result.Code === 1) {
                    this.tasks = Array.isArray(result.Data) ? result.Data : [];
                }
            } finally {
                this.loading = false;
            }
        },
        async loadInstalledVersions() {
            if (!this.isAdmin) return [];
            try {
                const result = await DiyCommon.FormEngine.GetTableData("sys_microistoreversion", {
                    _PageIndex: 1,
                    _PageSize: 5000,
                    _SelectFields: [
                        "Id",
                        "StoreId",
                        "AppId",
                        "AppName",
                        "AppVersion",
                        "AppVersionInstall",
                        "InstallStatus",
                        "InstallTime",
                        "UpdateTime"
                    ]
                });
                if (result && result.Code === 1 && Array.isArray(result.Data)) {
                    return result.Data;
                }
            } catch (error) {
                console.warn("[BackgroundTask] load installed app versions failed", error);
            }
            return [];
        },
        async checkOfficialApps(force) {
            if (!this.isAdmin) return;
            const now = Date.now();
            if (!force && this.lastStoreCheckTime && now - this.lastStoreCheckTime < STORE_CHECK_INTERVAL) {
                return;
            }
            if (this.storeLoading) return;
            this.storeLoading = true;
            try {
                const installedVersions = await this.loadInstalledVersions();
                const result = await DiyCommon.PostAsync(MASTER_STORE_ENGINE_URL, {
                    ApiEngineKey: "get-microi-store",
                    OsClient: "iTdos",
                    Action: "CheckOfficialUpdates",
                    TargetOsClient: DiyCommon.GetOsClient(),
                    InstalledVersions: installedVersions
                }, null, null, "json");
                if (result && result.Code === 1) {
                    const data = result.Data || {};
                    this.storeNotices = Array.isArray(data.Notices) ? data.Notices : [];
                    this.lastStoreCheckTime = now;
                }
            } catch (error) {
                console.warn("[BackgroundTask] official app check failed", error);
            } finally {
                this.storeLoading = false;
            }
        },
        goAppStore() {
            this.$router.push({ path: "/microi-store" });
        },
        async clearCompleted() {
            const result = await DiyCommon.PostAsync("/api/BackgroundTask/ClearCompleted", {}, null, null, "json");
            if (result && result.Code === 1) {
                this.refreshTasks();
            }
        },
        async cancelTask(item) {
            if (!item || !item.Id) return;
            const result = await DiyCommon.PostAsync("/api/BackgroundTask/Cancel", { Id: item.Id }, null, null, "json");
            if (result && result.Code === 1) {
                this.refreshTasks();
            }
        },
        canCancel(item) {
            return item && (item.Status === "Pending" || item.Status === "Running");
        },
        formatTime(value) {
            if (!value) return "";
            try {
                const date = new Date(value);
                const pad = (n) => String(n).padStart(2, "0");
                return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
            } catch (_) {
                return value;
            }
        }
    }
};
</script>

<style lang="scss" scoped>
.task-entry {
    width: 36px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
}

.task-entry :deep(.el-badge) {
    display: flex;
    align-items: center;
    justify-content: center;
}

.task-entry :deep(.el-badge__content) {
    top: 7px;
    right: 4px;
    min-width: 16px;
    height: 16px;
    line-height: 16px;
    border: 1px solid #fff;
    padding: 0 4px;
    box-shadow: 0 2px 8px rgba(255, 74, 35, 0.28);
}

.task-icon {
    font-size: 21px;
    line-height: 1;
}

.task-badge-flash :deep(.el-badge__content) {
    animation: microi-task-badge-pulse 1s ease-in-out infinite;
}

.task-panel {
    width: 100%;
}

.task-panel-header,
.task-sub-actions,
.app-panel-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.task-panel-header {
    font-weight: 600;
    color: #303133;
    margin-bottom: 8px;
}

.task-panel-actions {
    display: flex;
    align-items: center;
    gap: 6px;
}

.notification-tabs :deep(.el-tabs__header) {
    margin-bottom: 8px;
}

.tab-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 16px;
    margin-left: 5px;
    padding: 0 5px;
    border-radius: 9px;
    background: #ff4d2e;
    color: #fff;
    font-size: 11px;
    line-height: 16px;

    &.warning {
        background: #e6a23c;
    }
}

.task-sub-actions {
    justify-content: flex-end;
    min-height: 24px;
}

.task-empty {
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #909399;
    font-size: 13px;
}

.task-list,
.app-notice-list {
    max-height: 380px;
    overflow: auto;
}

.task-item,
.app-notice-item {
    padding: 10px 0;
    border-bottom: 1px solid #ebeef5;

    &:last-child {
        border-bottom: 0;
    }
}

.task-main,
.task-meta,
.app-notice-main,
.app-notice-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.task-title,
.app-name {
    min-width: 0;
    font-size: 13px;
    color: #303133;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.task-status {
    flex-shrink: 0;
    font-size: 12px;
    color: #909399;

    &.status-Succeeded {
        color: #67c23a;
    }

    &.status-Failed,
    &.status-Canceled {
        color: #f56c6c;
    }

    &.status-Running,
    &.status-Pending {
        color: #e6a23c;
    }
}

.task-meta,
.app-notice-meta {
    margin-top: 6px;
    font-size: 12px;
    color: #909399;
}

.task-msg {
    margin-top: 4px;
    font-size: 12px;
    color: #909399;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.app-panel-tip {
    min-width: 0;
    color: #909399;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

@keyframes microi-task-badge-pulse {
    0%,
    100% {
        transform: scale(1);
        opacity: 1;
    }
    50% {
        transform: scale(1.12);
        opacity: 0.75;
    }
}
</style>
