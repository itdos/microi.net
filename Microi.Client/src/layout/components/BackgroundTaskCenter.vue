<template>
    <div class="right-menu-item hover-effect task-entry" :title="$t('Msg.NotificationCenter')" @click="openCenter">
        <el-badge :value="badgeCount" :max="99" :hidden="badgeCount === 0" :class="{ 'task-badge-flash': badgeCount > 0 }">
            <el-icon class="task-icon"><Bell /></el-icon>
        </el-badge>
    </div>

    <el-dialog
        v-model="visible"
        class="microi-notification-dialog"
        :title="$t('Msg.NotificationCenter')"
        width="min(920px, calc(100vw - 24px))"
        align-center
        draggable
        destroy-on-close
        @open="refreshAll"
    >
        <div class="notification-shell">
            <div class="notification-summary">
                <div class="summary-card">
                    <el-icon><Bell /></el-icon>
                    <span>{{ $t("Msg.BackgroundTasks") }}</span>
                    <strong>{{ runningCount }}</strong>
                </div>
                <div v-if="isAdmin" class="summary-card warning">
                    <el-icon><Monitor /></el-icon>
                    <span>{{ $t("Msg.OfficialApps") }}</span>
                    <strong>{{ appNoticeCount }}</strong>
                </div>
                <div class="summary-card success">
                    <el-icon><Monitor /></el-icon>
                    <span>{{ $t("Msg.MyOnlineTerminals") }}</span>
                    <strong>{{ myTerminals.length }}</strong>
                </div>
                <div v-if="isSuperAdmin" class="summary-card admin">
                    <el-icon><UserFilled /></el-icon>
                    <span>{{ $t("Msg.CurrentOnlineUsers") }}</span>
                    <strong>{{ onlineUsers.length }}</strong>
                </div>
            </div>

            <div class="notification-toolbar">
                <span class="notification-tip">{{ $t("Msg.NotificationCenterTip") }}</span>
                <el-button size="small" :icon="Refresh" :loading="loading || storeLoading || terminalLoading" @click="refreshAll">
                    {{ $t("Msg.Refresh") }}
                </el-button>
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
                    <el-empty v-if="tasks.length === 0" :description="$t('Msg.NoBackgroundTasks')" />
                    <div v-else class="task-list">
                        <div v-for="item in tasks" :key="item.Id" class="task-item">
                            <div class="task-main">
                                <span class="task-title">{{ item.Title || item.Type || $t("Msg.BackgroundTasks") }}</span>
                                <span class="task-status" :class="'status-' + item.Status">{{ item.StatusText || item.Status }}</span>
                            </div>
                            <el-progress class="task-progress" :percentage="Number(item.Progress || 0)" :stroke-width="5" :show-text="true" />
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
                    <el-empty v-if="!storeLoading && storeNotices.length === 0" :description="$t('Msg.NoOfficialAppUpdates')" />
                    <div v-else-if="storeLoading" class="task-empty">{{ $t("Msg.Loading") }}</div>
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

                <el-tab-pane name="myTerminals">
                    <template #label>
                        <span>{{ $t("Msg.MyOnlineTerminals") }}</span>
                        <span v-if="myTerminals.length > 0" class="tab-count success">{{ myTerminals.length }}</span>
                    </template>
                    <el-empty v-if="!terminalLoading && myTerminals.length === 0" :description="$t('Msg.NoOnlineTerminals')" />
                    <el-table v-else :data="myTerminals" size="small" class="online-table" max-height="420">
                        <el-table-column prop="ClientType" :label="$t('Msg.TerminalType')" min-width="110" />
                        <el-table-column prop="Ip" :label="$t('Msg.LoginIp')" min-width="130" />
                        <el-table-column prop="Did" :label="$t('Msg.TerminalDid')" min-width="180" show-overflow-tooltip />
                        <el-table-column prop="UserAgent" :label="$t('Msg.TerminalInfo')" min-width="260" show-overflow-tooltip />
                        <el-table-column :label="$t('Msg.LastActiveTime')" min-width="150">
                            <template #default="{ row }">{{ formatDateTime(row.LastActiveTime || row.ConnectedTime) }}</template>
                        </el-table-column>
                        <el-table-column :label="$t('Msg.Operation')" width="120" fixed="right">
                            <template #default="{ row }">
                                <el-button link type="danger" size="small" :icon="SwitchButton" @click="kickTerminal(row, currentUser.Id)">
                                    {{ $t("Msg.KickOffline") }}
                                </el-button>
                            </template>
                        </el-table-column>
                    </el-table>
                </el-tab-pane>

                <el-tab-pane v-if="isSuperAdmin" name="onlineUsers">
                    <template #label>
                        <span>{{ $t("Msg.CurrentOnlineUsers") }}</span>
                        <span v-if="onlineUsers.length > 0" class="tab-count admin">{{ onlineUsers.length }}</span>
                    </template>
                    <el-empty v-if="!terminalLoading && onlineUsers.length === 0" :description="$t('Msg.NoOnlineUsers')" />
                    <el-table v-else :data="onlineUsers" size="small" class="online-table" row-key="UserId" max-height="420">
                        <el-table-column type="expand">
                            <template #default="{ row }">
                                <div class="terminal-list">
                                    <div v-for="terminal in row.Terminals" :key="terminal.ConnectionId" class="terminal-card">
                                        <div>
                                            <strong>{{ terminal.ClientType || "PC" }}</strong>
                                            <span>{{ terminal.Ip || "-" }}</span>
                                            <p class="terminal-did">DID: {{ terminal.Did || terminal.DeviceClientId || "-" }}</p>
                                            <p>{{ terminal.UserAgent || terminal.DeviceClientId || "-" }}</p>
                                        </div>
                                        <el-button link type="danger" size="small" :icon="SwitchButton" @click="kickTerminal(terminal, row.UserId)">
                                            {{ $t("Msg.KickOffline") }}
                                        </el-button>
                                    </div>
                                </div>
                            </template>
                        </el-table-column>
                        <el-table-column prop="UserName" :label="$t('Msg.Name')" min-width="140" />
                        <el-table-column prop="Account" :label="$t('Msg.Account')" min-width="140" />
                        <el-table-column prop="Ip" :label="$t('Msg.LoginIp')" min-width="130" />
                        <el-table-column prop="OnlineCount" :label="$t('Msg.TerminalCount')" width="100" />
                        <el-table-column :label="$t('Msg.LastActiveTime')" min-width="150">
                            <template #default="{ row }">{{ formatDateTime(row.LastActiveTime) }}</template>
                        </el-table-column>
                    </el-table>
                </el-tab-pane>
            </el-tabs>
        </div>
    </el-dialog>
</template>

<script>
import { DiyCommon } from "@/utils/diy.common";
import { Bell, CircleClose, Delete, Monitor, Refresh, SwitchButton, UserFilled } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useDiyStore } from "@/pinia";
import { useUserStore } from "@/pinia/modules/user";

const STORE_CHECK_INTERVAL = 10 * 60 * 1000;
const MASTER_STORE_LIST_URL = "https://api.itdos.com/apiengine/get-microi-store-list?OsClient=iTdos";

export default {
    name: "BackgroundTaskCenter",
    components: {
        Bell,
        Monitor,
        UserFilled
    },
    setup() {
        const diyStore = useDiyStore();
        const userStore = useUserStore();
        return { diyStore, userStore };
    },
    data() {
        return {
            visible: false,
            activeTab: "tasks",
            tasks: [],
            storeNotices: [],
            myTerminals: [],
            onlineUsers: [],
            loading: false,
            storeLoading: false,
            terminalLoading: false,
            lastStoreCheckTime: 0,
            storeCheckTimer: null,
            Delete,
            Refresh,
            CircleClose,
            SwitchButton
        };
    },
    computed: {
        currentUser() {
            return this.diyStore?.GetCurrentUser || {};
        },
        isAdmin() {
            const user = this.currentUser;
            return user._IsAdmin === true
                || user._IsAdmin === 1
                || user._IsAdmin === "1"
                || user._IsAdmin === "true";
        },
        isSuperAdmin() {
            return Number(this.currentUser?.Level || 0) >= 9999;
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
        window.addEventListener("microi-background-task-started", this.handleBackgroundTaskStarted);
    },
    beforeUnmount() {
        window.removeEventListener("microi-websocket-connected", this.handleWebSocketConnected);
        window.removeEventListener("microi-background-task-started", this.handleBackgroundTaskStarted);
        this.stopOfficialAppChecker();
        const ws = this.getWebsocket();
        if (ws && typeof ws.off === "function") {
            ws.off("ReceiveBackgroundTaskList", this.handleTaskList);
            ws.off("ReceiveOnlineTerminalChanged", this.handleOnlineTerminalChanged);
            ws.off("ReceiveForceLogout", this.handleForceLogout);
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
        },
        isSuperAdmin(value) {
            if (!value && this.activeTab === "onlineUsers") {
                this.activeTab = "tasks";
            }
        }
    },
    methods: {
        openCenter() {
            this.visible = true;
            this.refreshAll();
        },
        getWebsocket() {
            return this.$websocket || window?.app?.config?.globalProperties?.$websocket;
        },
        bindWebsocket() {
            const ws = this.getWebsocket();
            if (!ws || typeof ws.on !== "function") return;
            if (typeof ws.off === "function") {
                ws.off("ReceiveBackgroundTaskList", this.handleTaskList);
                ws.off("ReceiveOnlineTerminalChanged", this.handleOnlineTerminalChanged);
                ws.off("ReceiveForceLogout", this.handleForceLogout);
            }
            ws.on("ReceiveBackgroundTaskList", this.handleTaskList);
            ws.on("ReceiveOnlineTerminalChanged", this.handleOnlineTerminalChanged);
            ws.on("ReceiveForceLogout", this.handleForceLogout);
        },
        handleWebSocketConnected() {
            this.bindWebsocket();
            this.requestTaskListByWebsocket();
            if (this.visible) {
                this.loadTerminals();
            }
        },
        handleBackgroundTaskStarted() {
            this.refreshTasks(true);
            if (this.isAdmin) {
                this.checkOfficialApps(true);
            }
        },
        handleTaskList(data) {
            this.tasks = Array.isArray(data) ? data : [];
        },
        handleOnlineTerminalChanged() {
            if (this.visible) {
                this.loadTerminals();
            }
        },
        async handleForceLogout(data) {
            ElMessage.warning(data?.Reason || this.$t("Msg.TerminalKickedOffline"));
            await this.userStore.logout();
            this.$router.push(`/login?redirect=${this.$route.fullPath}`);
        },
        refreshAll() {
            this.refreshTasks();
            this.loadTerminals();
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
        async refreshTasks(forceHttp = false) {
            this.bindWebsocket();
            const requested = forceHttp ? false : await this.requestTaskListByWebsocket();
            if (!requested || forceHttp) {
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
        async loadTerminals() {
            if (this.terminalLoading) return;
            this.terminalLoading = true;
            try {
                const mine = await DiyCommon.PostAsync("/api/OnlineTerminal/Mine", {}, null, null, "json");
                if (mine && mine.Code === 1) {
                    this.myTerminals = Array.isArray(mine.Data?.Terminals) ? mine.Data.Terminals : [];
                }
                if (this.isSuperAdmin) {
                    const list = await DiyCommon.PostAsync("/api/OnlineTerminal/List", {}, null, null, "json");
                    if (list && list.Code === 1) {
                        this.onlineUsers = Array.isArray(list.Data) ? list.Data : [];
                    }
                } else {
                    this.onlineUsers = [];
                }
            } catch (error) {
                console.warn("Load online terminals failed", error);
            } finally {
                this.terminalLoading = false;
            }
        },
        async kickTerminal(row, userId) {
            if (!row?.ConnectionId) return;
            try {
                await ElMessageBox.confirm(this.$t("Msg.ConfirmKickOffline"), this.$t("Msg.Tips"), {
                    type: "warning",
                    confirmButtonText: this.$t("Msg.Ok"),
                    cancelButtonText: this.$t("Msg.Cancel")
                });
            } catch (_) {
                return;
            }
            const result = await DiyCommon.PostAsync("/api/OnlineTerminal/Kick", {
                UserId: userId,
                ConnectionId: row.ConnectionId
            }, null, null, "json");
            if (result && result.Code === 1) {
                ElMessage.success(result.Msg || this.$t("Msg.Success"));
                this.loadTerminals();
            }
        },
        async loadInstalledVersions(force = false) {
            if (!this.isAdmin) return [];
            try {
                return await DiyCommon.EnsureAppStores({ force });
            } catch (error) {
                console.warn("[BackgroundTask] load installed app versions failed", error);
            }
            return [];
        },
        normalizeOfficialAppNotice(row) {
            const item = DiyCommon.ApplyAppStoreInstallState({ ...(row || {}) });
            item.Status = item.StoreInstallStatus || item.AppInstallStatus || DiyCommon.GetAppStoreInstallStatus(item);
            if (!item.AppVersionInstall && item._LocalAppVersionInstall) {
                item.AppVersionInstall = item._LocalAppVersionInstall;
            }
            if (!item.InstalledVersion && item.AppVersionInstall) {
                item.InstalledVersion = item.AppVersionInstall;
            }
            return item;
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
                await this.loadInstalledVersions(force);
                const result = await DiyCommon.PostAsync(MASTER_STORE_LIST_URL, {
                    _PageIndex: 1,
                    _PageSize: 5000
                }, null, null, "json");
                if (result && result.Code === 1) {
                    const rows = Array.isArray(result.Data) ? result.Data : [];
                    this.storeNotices = rows
                        .map(this.normalizeOfficialAppNotice)
                        .filter((item) => ["Uninstalled", "Outdated", "Abnormal"].includes(item.Status));
                    this.lastStoreCheckTime = now;
                }
            } catch (error) {
                console.warn("[BackgroundTask] official app check failed", error);
            } finally {
                this.storeLoading = false;
            }
        },
        goAppStore() {
            this.visible = false;
            this.$router.push({ path: "/microi-store" });
        },
        async clearCompleted() {
            const result = await DiyCommon.PostAsync("/api/BackgroundTask/ClearCompleted", {}, null, null, "json");
            if (result && result.Code === 1) {
                this.refreshTasks(true);
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
        },
        formatDateTime(value) {
            if (!value) return "-";
            try {
                const date = new Date(value);
                const pad = (n) => String(n).padStart(2, "0");
                return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
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
    cursor: pointer;
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

.notification-shell {
    min-height: 460px;
}

.notification-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 8px;
}

.summary-card {
    display: grid;
    grid-template-columns: 30px 1fr auto;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border: 1px solid var(--mci-border-color, #ebeef5);
    border-radius: 6px;
    background: linear-gradient(135deg, rgba(var(--mci-primary-rgb, 255, 90, 40), 0.09), rgba(255, 255, 255, 0.88));
    color: var(--mci-text-color, #303133);

    .el-icon {
        width: 30px;
        height: 30px;
        border-radius: 6px;
        background: rgba(var(--mci-primary-rgb, 255, 90, 40), 0.12);
        color: var(--mci-primary-color, #ff5a28);
    }

    span {
        min-width: 0;
        font-size: 12px;
        color: var(--mci-text-color-secondary, #606266);
    }

    strong {
        font-size: 18px;
        color: var(--mci-text-color, #303133);
    }

    &.warning .el-icon {
        background: rgba(230, 162, 60, 0.14);
        color: #e6a23c;
    }

    &.success .el-icon {
        background: rgba(103, 194, 58, 0.14);
        color: #67c23a;
    }

    &.admin .el-icon {
        background: rgba(64, 158, 255, 0.14);
        color: #409eff;
    }
}

.notification-toolbar,
.task-sub-actions,
.app-panel-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.notification-toolbar {
    margin-bottom: 8px;
}

.notification-tip,
.app-panel-tip {
    min-width: 0;
    color: var(--mci-text-color-secondary, #909399);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.notification-tabs :deep(.el-tabs__header) {
    margin-bottom: 6px;
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

    &.success {
        background: #67c23a;
    }

    &.admin {
        background: #409eff;
    }
}

.task-sub-actions {
    justify-content: flex-end;
    min-height: 22px;
}

.task-empty {
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--mci-text-color-secondary, #909399);
    font-size: 13px;
}

.task-list,
.app-notice-list {
    max-height: 460px;
    overflow: auto;
}

.task-item,
.app-notice-item {
    padding: 8px 10px;
    margin-bottom: 6px;
    border: 1px solid var(--mci-border-color, #ebeef5);
    border-radius: 6px;
    background: var(--mci-bg-color-overlay, #fff);
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
    font-size: 12px;
    color: var(--mci-text-color, #303133);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.task-status {
    flex-shrink: 0;
    font-size: 11px;
    color: var(--mci-text-color-secondary, #909399);

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
    margin-top: 5px;
    font-size: 11px;
    color: var(--mci-text-color-secondary, #909399);
}

.task-msg {
    margin-top: 4px;
    font-size: 11px;
    color: var(--mci-text-color-secondary, #909399);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.task-progress {
    margin-top: 5px;
}

.task-progress :deep(.el-progress__text) {
    min-width: 34px;
    font-size: 11px !important;
    color: var(--mci-text-color-secondary, #909399);
}

.online-table {
    width: 100%;
    border-radius: 8px;
    overflow: hidden;
}

.terminal-list {
    display: grid;
    gap: 8px;
    padding: 8px 18px 8px 52px;
}

.terminal-card {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 8px;
    background: var(--mci-bg-color-page, #f6f7fb);

    span {
        margin-left: 10px;
        color: var(--mci-text-color-secondary, #909399);
    }

    p {
        margin: 4px 0 0;
        color: var(--mci-text-color-secondary, #909399);
        font-size: 12px;
    }

    .terminal-did {
        color: var(--mci-text-color, #303133);
        word-break: break-all;
    }
}

@media (max-width: 768px) {
    .notification-summary {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .summary-card {
        grid-template-columns: 30px 1fr;

        strong {
            grid-column: 2;
            font-size: 20px;
        }
    }
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
