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
        width="min(1080px, calc(100vw - 24px))"
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
                    <strong>{{ tasks.length }}</strong>
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
                        <span v-if="tasks.length > 0" class="tab-count">{{ tasks.length }}</span>
                    </template>

                    <div class="task-sub-actions">
                        <el-button link size="small" :icon="Delete" @click="clearCompleted">{{ $t("Msg.ClearCompleted") }}</el-button>
                    </div>
                    <el-empty v-if="tasks.length === 0" :description="$t('Msg.NoBackgroundTasks')" />
                    <el-table
                        v-else
                        :data="tasks"
                        size="small"
                        row-key="Id"
                        class="online-table notification-compact-table task-table"
                        max-height="420"
                    >
                        <el-table-column type="expand" width="36">
                            <template #default="{ row }">
                                <div class="task-detail">
                                    <div class="task-detail__row">
                                        <span class="task-detail__label">{{ $t("Msg.BackgroundTaskMessage") }}</span>
                                        <span class="task-detail__message">{{ row.Msg || "-" }}</span>
                                    </div>
                                    <div class="task-detail__row task-detail__row--result">
                                        <span class="task-detail__label">{{ $t("Msg.BackgroundTaskResult") }}</span>
                                        <pre>{{ formatTaskResult(row) }}</pre>
                                    </div>
                                </div>
                            </template>
                        </el-table-column>
                        <el-table-column :label="$t('Msg.Name')" min-width="220" show-overflow-tooltip>
                            <template #default="{ row }">{{ row.Title || row.Type || $t("Msg.BackgroundTasks") }}</template>
                        </el-table-column>
                        <el-table-column :label="$t('Msg.BackgroundTaskStatus')" width="90">
                            <template #default="{ row }">
                                <el-tag size="small" :type="getTaskStatusType(row.Status)">{{ row.StatusText || row.Status }}</el-tag>
                            </template>
                        </el-table-column>
                        <el-table-column :label="$t('Msg.BackgroundTaskProgress')" min-width="150">
                            <template #default="{ row }">
                                <div class="task-progress-cell">
                                    <el-progress :percentage="Number(row.Progress || 0)" :stroke-width="5" :show-text="false" />
                                    <span>{{ Number(row.Progress || 0) }}%</span>
                                </div>
                            </template>
                        </el-table-column>
                        <el-table-column prop="Msg" :label="$t('Msg.BackgroundTaskMessage')" min-width="220" show-overflow-tooltip>
                            <template #default="{ row }">{{ row.Msg || "-" }}</template>
                        </el-table-column>
                        <el-table-column :label="$t('Msg.CreateTime')" width="92">
                            <template #default="{ row }">{{ formatTime(row.CreateTime) }}</template>
                        </el-table-column>
                        <el-table-column :label="$t('Msg.Elapsed')" width="78">
                            <template #default="{ row }">{{ row.ElapsedText || "-" }}</template>
                        </el-table-column>
                        <el-table-column :label="$t('Msg.Operation')" width="112" fixed="right">
                            <template #default="{ row }">
                                <el-button v-if="canCancel(row)" link size="small" type="danger" :icon="CircleClose" @click.stop="cancelTask(row)">
                                    {{ $t("Msg.Stop") }}
                                </el-button>
                                <el-button v-else link size="small" type="danger" :icon="Delete" @click.stop="removeTask(row)">
                                    {{ $t("Msg.Delete") }}
                                </el-button>
                            </template>
                        </el-table-column>
                    </el-table>
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
                    <el-table v-else :data="storeNotices" size="small" class="online-table notification-compact-table app-notice-table" max-height="420">
                        <el-table-column :label="$t('Msg.Name')" min-width="220" show-overflow-tooltip>
                            <template #default="{ row }">{{ row.AppName || row.AppId || $t("Msg.Unnamed") }}</template>
                        </el-table-column>
                        <el-table-column :label="$t('Msg.OfficialAppStatus')" width="110">
                            <template #default="{ row }">
                                <el-tag size="small" :type="getOfficialAppStatusType(row.Status)">
                                    {{ getOfficialAppStatusText(row.Status) }}
                                </el-tag>
                            </template>
                        </el-table-column>
                        <el-table-column :label="$t('Msg.OfficialAppInstalledVersion')" min-width="130" show-overflow-tooltip>
                            <template #default="{ row }">{{ row.AppVersionInstall || row.InstalledVersion || "-" }}</template>
                        </el-table-column>
                        <el-table-column :label="$t('Msg.OfficialAppLatestVersion')" min-width="120" show-overflow-tooltip>
                            <template #default="{ row }">{{ row.AppVersion || "-" }}</template>
                        </el-table-column>
                        <el-table-column :label="$t('Msg.Operation')" width="100" fixed="right">
                            <template #default>
                                <el-button link type="primary" size="small" @click="goAppStore">{{ $t("Msg.GoAppStore") }}</el-button>
                            </template>
                        </el-table-column>
                    </el-table>
                </el-tab-pane>

                <el-tab-pane name="myTerminals">
                    <template #label>
                        <span>{{ $t("Msg.MyOnlineTerminals") }}</span>
                        <span v-if="myTerminals.length > 0" class="tab-count success">{{ myTerminals.length }}</span>
                    </template>
                    <el-empty v-if="!terminalLoading && myTerminals.length === 0" :description="$t('Msg.NoOnlineTerminals')" />
                    <el-table v-else :data="myTerminals" size="small" class="online-table notification-compact-table" max-height="420">
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
                    <el-table v-else :data="onlineUsers" size="small" class="online-table notification-compact-table online-users-table" row-key="UserId" max-height="420">
                        <el-table-column type="expand">
                            <template #default="{ row }">
                                <div class="terminal-list">
                                    <el-table :data="row.Terminals || []" size="small" class="online-table notification-compact-table terminal-nested-table" max-height="240">
                                        <el-table-column prop="ClientType" :label="$t('Msg.TerminalType')" min-width="90" />
                                        <el-table-column prop="Ip" :label="$t('Msg.LoginIp')" min-width="120" />
                                        <el-table-column :label="$t('Msg.TerminalDid')" min-width="180" show-overflow-tooltip>
                                            <template #default="{ row: terminal }">{{ terminal.Did || terminal.DeviceClientId || "-" }}</template>
                                        </el-table-column>
                                        <el-table-column prop="UserAgent" :label="$t('Msg.TerminalInfo')" min-width="240" show-overflow-tooltip />
                                        <el-table-column :label="$t('Msg.LastActiveTime')" min-width="145">
                                            <template #default="{ row: terminal }">{{ formatDateTime(terminal.LastActiveTime || terminal.ConnectedTime) }}</template>
                                        </el-table-column>
                                        <el-table-column :label="$t('Msg.Operation')" width="110" fixed="right">
                                            <template #default="{ row: terminal }">
                                                <el-button link type="danger" size="small" :icon="SwitchButton" @click="kickTerminal(terminal, row.UserId)">
                                                    {{ $t("Msg.KickOffline") }}
                                                </el-button>
                                            </template>
                                        </el-table-column>
                                    </el-table>
                                </div>
                            </template>
                        </el-table-column>
                        <el-table-column prop="UserName" :label="$t('Msg.Name')" min-width="120" show-overflow-tooltip />
                        <el-table-column prop="Account" :label="$t('Msg.Account')" min-width="130" show-overflow-tooltip />
                        <el-table-column prop="Ip" :label="$t('Msg.LoginIp')" min-width="120" show-overflow-tooltip />
                        <el-table-column prop="OnlineCount" :label="$t('Msg.TerminalCount')" width="88" />
                        <el-table-column :label="$t('Msg.LastActiveTime')" min-width="145">
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
        failedCount() {
            return this.tasks.filter((item) => item.Status === "Failed").length;
        },
        appNoticeCount() {
            return this.isAdmin ? this.storeNotices.length : 0;
        },
        badgeCount() {
            return this.runningCount + this.failedCount + this.appNoticeCount;
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
            this.loadTasks();
            if (this.visible) {
                this.loadTerminals();
            }
        },
        handleBackgroundTaskStarted() {
            this.refreshTasks();
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
        async refreshTasks() {
            this.bindWebsocket();
            await this.loadTasks();
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
        getOfficialAppStatusType(status) {
            return status === "Outdated" ? "warning" : "danger";
        },
        getOfficialAppStatusText(status) {
            if (status === "Uninstalled") {
                return this.$t("Msg.OfficialAppUninstalled");
            }
            if (status === "Abnormal") {
                return this.$t("Msg.OfficialAppAbnormal");
            }
            return this.$t("Msg.OfficialAppOutdated");
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
        async removeTask(item) {
            if (!item || !item.Id || !this.isTerminalTask(item)) return;
            try {
                await ElMessageBox.confirm(this.$t("Msg.ConfirmDel"), this.$t("Msg.Tips"), {
                    type: "warning",
                    confirmButtonText: this.$t("Msg.Ok"),
                    cancelButtonText: this.$t("Msg.Cancel")
                });
            } catch (_) {
                return;
            }
            const result = await DiyCommon.PostAsync("/api/BackgroundTask/Remove", { Id: item.Id }, null, null, "json");
            if (result && result.Code === 1) {
                this.refreshTasks();
            }
        },
        isTerminalTask(item) {
            return item && ["Succeeded", "Failed", "Canceled"].includes(item.Status);
        },
        canCancel(item) {
            return item && (item.Status === "Pending" || item.Status === "Running");
        },
        getTaskStatusType(status) {
            if (status === "Succeeded") return "success";
            if (status === "Failed" || status === "Canceled") return "danger";
            if (status === "Running" || status === "Pending") return "warning";
            return "info";
        },
        formatTaskResult(item) {
            if (!item?.Result) return item?.Msg || "-";
            try {
                const text = JSON.stringify(item.Result, null, 2);
                return text.length > 8000 ? `${text.slice(0, 8000)}\n...` : text;
            } catch (_) {
                return String(item.Result);
            }
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

.task-progress-cell {
    display: grid;
    grid-template-columns: minmax(72px, 1fr) 34px;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--mci-text-color-secondary, #909399);
}

.task-detail {
    display: grid;
    gap: 6px;
    padding: 2px 8px 4px;
    font-size: 12px;
}

.task-detail__row {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 8px;
    align-items: start;
}

.task-detail__label {
    color: var(--mci-text-color-secondary, #909399);
}

.task-detail__message {
    color: var(--mci-text-color, #303133);
    overflow-wrap: anywhere;
}

.task-detail pre {
    max-height: 180px;
    margin: 0;
    padding: 6px 8px;
    overflow: auto;
    border: 1px solid var(--mci-border-color, #ebeef5);
    border-radius: 4px;
    background: var(--mci-bg-color-page, #f6f7fb);
    color: var(--mci-text-color, #303133);
    font: 11px/1.5 Consolas, Monaco, monospace;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

.online-table {
    width: 100%;
    border-radius: 4px;
    overflow: hidden;
}

.notification-compact-table :deep(.el-table__cell) {
    padding: 4px 0;
}

.notification-compact-table :deep(.cell) {
    line-height: 18px;
}

.notification-compact-table :deep(.el-button--small) {
    height: 22px;
    padding: 0 4px;
}

.task-table :deep(.el-table__expanded-cell) {
    padding: 5px 8px 7px 36px;
    background: var(--mci-bg-color-page, #f6f7fb);
}

.task-table :deep(.el-tag) {
    height: 21px;
    line-height: 19px;
}

.online-users-table :deep(.el-table__expanded-cell) {
    padding: 6px 8px 8px 42px;
    background: var(--mci-bg-color-page, #f6f7fb);
}

.terminal-list {
    padding: 0;
}

.terminal-nested-table {
    border: 1px solid var(--mci-border-color, #ebeef5);
}

.app-notice-table :deep(.el-tag) {
    height: 21px;
    line-height: 19px;
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
