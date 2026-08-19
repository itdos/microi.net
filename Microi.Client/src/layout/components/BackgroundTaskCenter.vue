<template>
    <div class="right-menu-item hover-effect task-entry" :title="$t('Msg.NotificationCenter')" @click="openCenter">
        <el-badge :value="badgeCount" :max="99" :hidden="badgeCount === 0" :class="{ 'task-badge-flash': badgeCount > 0 }">
            <el-icon class="task-icon"><Bell /></el-icon>
        </el-badge>
    </div>

    <el-dialog
        v-model="visible"
        class="microi-notification-dialog mci-unified-dialog"
        :title="$t('Msg.NotificationCenter')"
        width="80%"
        :modal-class="GetUnifiedOverlayClass()"
        align-center
        draggable
        destroy-on-close
        @opened="handleCenterOpened"
    >
        <div class="notification-shell">
            <div class="notification-summary">
                <div class="summary-card">
                    <el-icon><Bell /></el-icon>
                    <span>{{ $t("Msg.BackgroundTasks") }}</span>
                    <strong>{{ tasks.length }}</strong>
                </div>
                <div class="summary-card primary">
                    <el-icon><Bell /></el-icon>
                    <span>{{ $t("Msg.PlatformMessages") }}</span>
                    <strong>{{ notificationUnreadCount }}</strong>
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
                <el-button size="small" :icon="Refresh" :loading="loading || notificationLoading || storeLoading || terminalLoading" @click="refreshAll">
                    {{ $t("Msg.Refresh") }}
                </el-button>
            </div>

            <el-tabs v-model="activeTab" class="notification-tabs mci-tabs mci-tabs--module">
                <el-tab-pane name="platformMessages">
                    <template #label>
                        <span>{{ $t("Msg.PlatformMessages") }}</span>
                        <span v-if="notificationUnreadCount > 0" class="tab-count warning">{{ notificationUnreadCount }}</span>
                    </template>

                    <div class="task-sub-actions">
                        <el-button
                            link
                            size="small"
                            :disabled="notificationUnreadCount === 0"
                            @click="markAllNotificationsRead"
                        >{{ $t("Msg.MarkAllRead") }}</el-button>
                    </div>
                    <el-empty
                        v-if="!notificationLoading && platformNotifications.length === 0"
                        :description="$t('Msg.NoPlatformMessages')"
                    />
                    <el-table
                        v-else
                        v-mci-loading:table="notificationLoading"
                        :data="platformNotifications"
                        size="small"
                        row-key="Id"
                        class="online-table notification-compact-table platform-message-table"
                        max-height="420"
                        @row-click="openNotificationDetail"
                    >
                        <el-table-column :label="$t('Msg.Name')" min-width="180" show-overflow-tooltip>
                            <template #default="{ row }">
                                <span :class="{ 'platform-message-title--unread': Number(row.IsRead || 0) !== 1 }">
                                    {{ row.Title || $t("Msg.PlatformMessages") }}
                                </span>
                            </template>
                        </el-table-column>
                        <el-table-column prop="MsgContent" :label="$t('Msg.MessageContent')" min-width="320" show-overflow-tooltip>
                            <template #default="{ row }">{{ row.MsgContent || row.Content || "-" }}</template>
                        </el-table-column>
                        <el-table-column :label="$t('Msg.CreateTime')" width="168">
                            <template #default="{ row }">{{ formatDateTime(row.CreateTime) }}</template>
                        </el-table-column>
                        <el-table-column :label="$t('Msg.Status')" width="88">
                            <template #default="{ row }">
                                <el-tag size="small" :type="Number(row.IsRead || 0) === 1 ? 'info' : 'warning'">
                                    {{ Number(row.IsRead || 0) === 1 ? $t("Msg.Read") : $t("Msg.Unread") }}
                                </el-tag>
                            </template>
                        </el-table-column>
                        <el-table-column :label="$t('Msg.Operation')" width="90" fixed="right">
                            <template #default="{ row }">
                                <el-button
                                    link
                                    type="primary"
                                    size="small"
                                    @click.stop="openNotificationDetail(row)"
                                >{{ $t("Msg.View") }}</el-button>
                            </template>
                        </el-table-column>
                    </el-table>
                </el-tab-pane>

                <el-tab-pane name="tasks" lazy>
                    <template #label>
                        <span>{{ $t("Msg.BackgroundTasks") }}</span>
                        <span v-if="tasks.length > 0" class="tab-count">{{ tasks.length }}</span>
                    </template>

                    <div class="task-sub-actions">
                        <el-button link size="small" :icon="Delete" @click="clearCompleted">{{ $t("Msg.ClearCompleted") }}</el-button>
                    </div>
                    <el-empty v-if="!loading && tasks.length === 0" :description="$t('Msg.NoBackgroundTasks')" />
                    <el-table
                        v-else
                        v-mci-loading:table="loading"
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
                                    <div class="task-detail__row">
                                        <span class="task-detail__label">{{ $t("Msg.BackgroundTaskEta") }}</span>
                                        <span class="task-detail__message">{{ getTaskEta(row) }}</span>
                                    </div>
                                    <div v-if="row.BusinessTable || row.BusinessId" class="task-detail__row">
                                        <span class="task-detail__label">{{ $t("Msg.BackgroundTaskBusiness") }}</span>
                                        <span class="task-detail__message">{{ [row.BusinessTable, row.BusinessId].filter(Boolean).join(" / ") }}</span>
                                    </div>
                                    <div class="task-detail__row task-detail__row--result">
                                        <span class="task-detail__label">{{ $t("Msg.BackgroundTaskLog") }}</span>
                                        <pre>{{ row.Log || "-" }}</pre>
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
                                    <el-progress
                                        :percentage="getTaskProgress(row).indeterminate ? 100 : getTaskProgress(row).percentage"
                                        :indeterminate="getTaskProgress(row).indeterminate"
                                        :duration="2"
                                        :stroke-width="5"
                                        :show-text="false"
                                    />
                                    <span>{{ getTaskProgress(row).text }}</span>
                                </div>
                            </template>
                        </el-table-column>
                        <el-table-column :label="$t('Msg.BackgroundTaskEta')" min-width="190" show-overflow-tooltip>
                            <template #default="{ row }">{{ getTaskEta(row) }}</template>
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
                        <el-table-column :label="$t('Msg.Operation')" width="178" fixed="right">
                            <template #default="{ row }">
                                <el-button v-if="getTaskDownloadUrl(row)" link size="small" type="primary" :icon="Download" @click.stop="downloadTaskResult(row)">
                                    {{ $t("Msg.DownloadArtifact") }}
                                </el-button>
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

                <el-tab-pane v-if="isAdmin" name="apps" lazy>
                    <template #label>
                        <span>{{ $t("Msg.OfficialApps") }}</span>
                        <span v-if="appNoticeCount > 0" class="tab-count warning">{{ appNoticeCount }}</span>
                    </template>

                    <div class="app-panel-toolbar">
                        <span class="app-panel-tip">{{ $t("Msg.OfficialAppUpdateTip") }}</span>
                        <div class="app-panel-actions">
                            <el-button
                                v-if="canBulkMaintainPlatformApps"
                                type="primary"
                                size="small"
                                :loading="bulkPlatformAppsLoading"
                                @click="installOrUpdateAllPlatformApps"
                            >
                                {{ $t("Msg.InstallUpdateAllPlatformApps") }}
                            </el-button>
                            <el-button type="primary" link size="small" @click="goAppStore">{{ $t("Msg.GoAppStore") }}</el-button>
                        </div>
                    </div>
                    <el-empty v-if="!storeLoading && storeNotices.length === 0" :description="$t('Msg.NoOfficialAppUpdates')" />
                    <el-table v-else v-mci-loading:table="storeLoading" :data="storeNotices" size="small" class="online-table notification-compact-table app-notice-table" max-height="420">
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

                <el-tab-pane name="myTerminals" lazy>
                    <template #label>
                        <span>{{ $t("Msg.MyOnlineTerminals") }}</span>
                        <span v-if="myTerminals.length > 0" class="tab-count success">{{ myTerminals.length }}</span>
                    </template>
                    <el-empty v-if="!terminalLoading && myTerminals.length === 0" :description="$t('Msg.NoOnlineTerminals')" />
                    <el-table v-else v-mci-loading:table="terminalLoading" :data="myTerminals" size="small" class="online-table notification-compact-table" max-height="420">
                        <el-table-column prop="ClientType" :label="$t('Msg.TerminalType')" min-width="110" />
                        <el-table-column prop="Ip" :label="$t('Msg.LoginIp')" min-width="130" />
                        <el-table-column prop="Did" :label="$t('Msg.TerminalDid')" min-width="180" show-overflow-tooltip />
                        <el-table-column prop="UserAgent" :label="$t('Msg.TerminalInfo')" min-width="260" show-overflow-tooltip />
                        <el-table-column :label="$t('Msg.LastActiveTime')" min-width="150">
                            <template #default="{ row }">{{ formatDateTime(row.LastActiveTime || row.ConnectedTime) }}</template>
                        </el-table-column>
                        <el-table-column v-if="!isAccessKeySession" :label="$t('Msg.Operation')" width="120" fixed="right">
                            <template #default="{ row }">
                                <el-button link type="danger" size="small" :icon="SwitchButton" @click="kickTerminal(row, currentUser.Id)">
                                    {{ $t("Msg.KickOffline") }}
                                </el-button>
                            </template>
                        </el-table-column>
                    </el-table>
                </el-tab-pane>

                <el-tab-pane v-if="isSuperAdmin" name="onlineUsers" lazy>
                    <template #label>
                        <span>{{ $t("Msg.CurrentOnlineUsers") }}</span>
                        <span v-if="onlineUsers.length > 0" class="tab-count admin">{{ onlineUsers.length }}</span>
                    </template>
                    <el-empty v-if="!terminalLoading && onlineUsers.length === 0" :description="$t('Msg.NoOnlineUsers')" />
                    <el-table v-else v-mci-loading:table="terminalLoading" :data="onlineUsers" size="small" class="online-table notification-compact-table online-users-table" row-key="UserId" max-height="420">
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

    <el-dialog
        v-model="messageDetailVisible"
        class="microi-message-detail-dialog mci-unified-dialog"
        :title="activeMessage.Title || $t('Msg.PlatformMessages')"
        width="60%"
        :modal-class="GetUnifiedOverlayClass()"
        align-center
        draggable
        append-to-body
        destroy-on-close
    >
        <article class="message-detail">
            <header class="message-detail__meta">
                <el-tag size="small" type="info">{{ formatDateTime(activeMessage.CreateTime) }}</el-tag>
                <span v-if="activeMessage.SenderName || activeMessage.CreateUserName">
                    {{ activeMessage.SenderName || activeMessage.CreateUserName }}
                </span>
            </header>
            <div class="message-detail__content">{{ activeMessage.MsgContent || activeMessage.Content || '-' }}</div>
            <pre v-if="notificationDetailPayload" class="message-detail__payload">{{ notificationDetailPayload }}</pre>
        </article>
        <template #footer>
            <el-button v-if="activeMessage.LinkUrl" @click="openNotificationLink(activeMessage)">{{ $t("Msg.Open") }}</el-button>
            <el-button type="primary" @click="messageDetailVisible = false">{{ $t("Msg.Close") }}</el-button>
        </template>
    </el-dialog>
</template>

<script>
import { DiyCommon } from "@/utils/diy.common";
import { Bell, CircleClose, Delete, Download, Monitor, Refresh, SwitchButton, UserFilled } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox, ElNotification } from "element-plus";
import { useDiyStore } from "@/pinia";
import { useUserStore } from "@/pinia/modules/user";
import {
    getBackgroundTaskEta,
    getBackgroundTaskProgress,
    isActiveBackgroundTask,
    isTerminalBackgroundTask,
    shouldPollBackgroundTasks
} from "@/utils/background-task-display";
import {
    mergePlatformNotification,
    normalizeNotificationLink,
    normalizePlatformNotificationResult
} from "@/utils/platform-notification";

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
            activeTab: "platformMessages",
            messageDetailVisible: false,
            activeMessage: {},
            tasks: [],
            platformNotifications: [],
            notificationUnreadCount: 0,
            storeNotices: [],
            myTerminals: [],
            onlineUsers: [],
            loading: false,
            notificationLoading: false,
            storeLoading: false,
            bulkPlatformAppsLoading: false,
            terminalLoading: false,
            taskPollTimer: null,
            lastStoreCheckTime: 0,
            storeCheckTimer: null,
            Delete,
            Download,
            Refresh,
            CircleClose,
            SwitchButton
        };
    },
    computed: {
        currentUser() {
            return this.diyStore?.GetCurrentUser || {};
        },
        isAccessKeySession() {
            const value = this.currentUser?._AccessKeySession;
            return value === true || value === 1 || value === "1" || value === "true";
        },
        isAdmin() {
            if (this.isAccessKeySession) return false;
            const user = this.currentUser;
            return Number(user?.Level || 0) >= 9999
                || user._IsAdmin === true
                || user._IsAdmin === 1
                || user._IsAdmin === "1"
                || user._IsAdmin === "true";
        },
        isSuperAdmin() {
            return !this.isAccessKeySession
                && Number(this.currentUser?.Level || 0) >= 9999;
        },
        isOfficialPlatform() {
            const value = this.diyStore?.SysConfig?.IsOfficialPlatform;
            return value === true
                || value === 1
                || String(value ?? "").trim().toLowerCase() === "true"
                || String(value ?? "").trim() === "1";
        },
        canBulkMaintainPlatformApps() {
            return this.isSuperAdmin && !this.isOfficialPlatform;
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
            // 顶部通知角标只代表需要用户处理的消息：未读系统消息 + 待安装/更新平台应用。
            return this.notificationUnreadCount + this.appNoticeCount;
        },
        notificationDetailPayload() {
            const payload = this.activeMessage?.Payload || this.activeMessage?.DataAppend;
            if (!payload) return "";
            try {
                const value = typeof payload === "string" ? JSON.parse(payload) : payload;
                return JSON.stringify(value, null, 2);
            } catch (_) {
                return String(payload);
            }
        }
    },
    mounted() {
        this.bindWebsocket();
        this.refreshTasks();
        this.loadPlatformNotifications();
        this.startOfficialAppChecker();
        window.addEventListener("microi-websocket-connected", this.handleWebSocketConnected);
        window.addEventListener("microi-background-task-started", this.handleBackgroundTaskStarted);
        document.addEventListener("visibilitychange", this.handleTaskVisibilityChange);
    },
    beforeUnmount() {
        window.removeEventListener("microi-websocket-connected", this.handleWebSocketConnected);
        window.removeEventListener("microi-background-task-started", this.handleBackgroundTaskStarted);
        document.removeEventListener("visibilitychange", this.handleTaskVisibilityChange);
        this.stopTaskPolling();
        this.stopOfficialAppChecker();
        const ws = this.getWebsocket();
        if (ws && typeof ws.off === "function") {
            ws.off("ReceiveBackgroundTaskList", this.handleTaskList);
            ws.off("ReceivePlatformNotification", this.handlePlatformNotification);
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
        },
        tasks() {
            this.scheduleTaskPolling();
        },
        activeTab(value) {
            if (!this.visible) return;
            this.loadActiveTab(value);
        }
    },
    methods: {
        openCenter() {
            this.visible = true;
        },
        handleCenterOpened() {
            // 先展示弹层，再并行刷新摘要；终端等重请求只在对应 Tab 打开时执行。
            window.requestAnimationFrame(() => this.refreshAll());
        },
        GetUnifiedOverlayClass() {
            const value = this.diyStore?.SysConfig?.DisableFormMaskBlur;
            const blurDisabled = value === 1
                || value === "1"
                || value === true
                || String(value || "").trim().toLowerCase() === "true";
            return [
                "diy-form-modern-overlay",
                "mci-unified-overlay",
                blurDisabled ? "diy-form-modern-overlay--plain mci-unified-overlay--plain" : ""
            ].filter(Boolean).join(" ");
        },
        getWebsocket() {
            return this.$websocket || window?.app?.config?.globalProperties?.$websocket;
        },
        bindWebsocket() {
            const ws = this.getWebsocket();
            if (!ws || typeof ws.on !== "function") return;
            if (typeof ws.off === "function") {
                ws.off("ReceiveBackgroundTaskList", this.handleTaskList);
                ws.off("ReceivePlatformNotification", this.handlePlatformNotification);
                ws.off("ReceiveOnlineTerminalChanged", this.handleOnlineTerminalChanged);
                ws.off("ReceiveForceLogout", this.handleForceLogout);
            }
            ws.on("ReceiveBackgroundTaskList", this.handleTaskList);
            ws.on("ReceivePlatformNotification", this.handlePlatformNotification);
            ws.on("ReceiveOnlineTerminalChanged", this.handleOnlineTerminalChanged);
            ws.on("ReceiveForceLogout", this.handleForceLogout);
        },
        handleWebSocketConnected() {
            this.bindWebsocket();
            this.loadTasks();
            this.loadPlatformNotifications();
            if (this.visible && (this.activeTab === "myTerminals" || this.activeTab === "onlineUsers")) {
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
        handlePlatformNotification(data) {
            const existed = this.platformNotifications.some((item) =>
                String(item?.Id || item?.EventId || "") === String(data?.Id || data?.EventId || "")
            );
            this.platformNotifications = mergePlatformNotification(this.platformNotifications, data, 100);
            if (!existed && Number(data?.IsRead || 0) !== 1) {
                this.notificationUnreadCount++;
                ElNotification({
                    title: data?.Title || this.$t("Msg.PlatformMessages"),
                    message: data?.Content || data?.MsgContent || "",
                    type: "info",
                    duration: 6000,
                    onClick: () => {
                        this.visible = true;
                        this.activeTab = "platformMessages";
                        this.$nextTick(() => this.openNotificationDetail(data));
                    }
                });
            }
        },
        handleTaskVisibilityChange() {
            if (!document.hidden && shouldPollBackgroundTasks(this.tasks)) {
                this.loadTasks();
            }
            this.scheduleTaskPolling();
        },
        handleOnlineTerminalChanged() {
            if (this.visible && (this.activeTab === "myTerminals" || this.activeTab === "onlineUsers")) {
                this.loadTerminals();
            }
        },
        async handleForceLogout(data) {
            ElMessage.warning(data?.Reason || this.$t("Msg.TerminalKickedOffline"));
            await this.userStore.logout();
            this.$router.push(`/login?redirect=${this.$route.fullPath}`);
        },
        async refreshAll() {
            const jobs = [this.loadPlatformNotifications()];
            if (this.isAdmin) jobs.push(this.checkOfficialApps(true));
            if (this.activeTab === "tasks") jobs.push(this.refreshTasks());
            if (this.activeTab === "myTerminals" || this.activeTab === "onlineUsers") jobs.push(this.loadTerminals());
            await Promise.allSettled(jobs);
        },
        loadActiveTab(tabName) {
            if (tabName === "tasks") return this.refreshTasks();
            if (tabName === "apps" && this.isAdmin) return this.checkOfficialApps(true);
            if (tabName === "myTerminals" || tabName === "onlineUsers") return this.loadTerminals();
            return this.loadPlatformNotifications();
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
                this.scheduleTaskPolling();
            }
        },
        async loadPlatformNotifications() {
            if (this.notificationLoading || !DiyCommon.Notification) return;
            this.notificationLoading = true;
            try {
                const result = await DiyCommon.Notification.List({ _PageIndex: 1, _PageSize: 100 });
                if (result && result.Code === 1) {
                    const normalized = normalizePlatformNotificationResult(result);
                    this.platformNotifications = normalized.rows;
                    this.notificationUnreadCount = normalized.unreadCount;
                }
            } catch (error) {
                console.warn("[PlatformNotification] load failed", error);
            } finally {
                this.notificationLoading = false;
            }
        },
        async markNotificationRead(row) {
            if (!row?.Id || Number(row.IsRead || 0) === 1) return;
            const result = await DiyCommon.Notification.MarkRead(row.Id);
            if (result && result.Code === 1) {
                row.IsRead = 1;
                row.ReadTime = result.Data?.ReadTime || row.ReadTime;
                this.notificationUnreadCount = Math.max(0, this.notificationUnreadCount - 1);
            }
        },
        async markAllNotificationsRead() {
            const result = await DiyCommon.Notification.MarkRead({ All: true });
            if (result && result.Code === 1) {
                this.platformNotifications.forEach((item) => {
                    item.IsRead = 1;
                    item.ReadTime = result.Data?.ReadTime || item.ReadTime;
                });
                this.notificationUnreadCount = 0;
            }
        },
        async openNotificationDetail(row) {
            if (!row) return;
            this.activeMessage = row;
            this.messageDetailVisible = true;
            await this.markNotificationRead(row);
        },
        async openNotificationLink(row) {
            await this.markNotificationRead(row);
            const link = normalizeNotificationLink(row?.LinkUrl, window.location.origin);
            if (!link) return;
            if (link.startsWith("#")) {
                window.location.hash = link.replace(/^#/, "");
                return;
            }
            if (link.startsWith("/") && !link.startsWith("//")) {
                await this.$router.push(link);
                return;
            }
            window.open(link, "_blank", "noopener,noreferrer");
        },
        scheduleTaskPolling() {
            this.stopTaskPolling();
            if (!shouldPollBackgroundTasks(this.tasks)) return;
            const delay = document.hidden ? 10000 : this.visible ? 3000 : 5000;
            this.taskPollTimer = window.setTimeout(async () => {
                this.taskPollTimer = null;
                await this.loadTasks();
            }, delay);
        },
        stopTaskPolling() {
            if (this.taskPollTimer) {
                window.clearTimeout(this.taskPollTimer);
                this.taskPollTimer = null;
            }
        },
        async loadTerminals() {
            if (this.terminalLoading) return;
            this.terminalLoading = true;
            try {
                const mineTask = DiyCommon.PostAsync("/api/OnlineTerminal/Mine", {}, null, null, "json");
                const listTask = this.isSuperAdmin
                    ? DiyCommon.PostAsync("/api/OnlineTerminal/List", {}, null, null, "json")
                    : Promise.resolve(null);
                const [mine, list] = await Promise.all([mineTask, listTask]);
                if (mine && mine.Code === 1) {
                    this.myTerminals = Array.isArray(mine.Data?.Terminals) ? mine.Data.Terminals : [];
                }
                if (this.isSuperAdmin) {
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
                const result = await DiyCommon.PostAsync({
                    url: MASTER_STORE_LIST_URL,
                    data: {
                        _PageIndex: 1,
                        _PageSize: 5000,
                        ApplicationTypes: ["Platform"]
                    },
                    dataType: "json",
                    // 官网应用列表是匿名跨域资源，不能携带当前客户租户的登录 Token。
                    skipAuthorization: true,
                    // 官网不可用只影响应用商城提醒，不能弹全局错误或改动客户租户登录态。
                    suppressAuthFailure: true,
                    suppressErrorNotification: true
                });
                if (result && result.Code === 1) {
                    const rows = Array.isArray(result.Data) ? result.Data : [];
                    this.storeNotices = rows
                        .map(this.normalizeOfficialAppNotice)
                        .filter((item) => item.ApplicationType === "Platform"
                            && (item.Status === "Uninstalled" || item.Status === "Outdated"));
                    this.lastStoreCheckTime = now;
                }
            } catch (error) {
                console.warn("[BackgroundTask] platform app check failed", error);
            } finally {
                this.storeLoading = false;
            }
        },
        async installOrUpdateAllPlatformApps() {
            if (!this.canBulkMaintainPlatformApps || this.bulkPlatformAppsLoading) return;
            try {
                await ElMessageBox.confirm(
                    this.$t("Msg.ConfirmInstallUpdateAllPlatformApps"),
                    this.$t("Msg.InstallUpdateAllPlatformApps"),
                    {
                        type: "warning",
                        confirmButtonText: this.$t("Msg.Ok"),
                        cancelButtonText: this.$t("Msg.Cancel")
                    }
                );
            } catch (_) {
                return;
            }

            this.bulkPlatformAppsLoading = true;
            try {
                let workerStatus = null;
                try {
                    workerStatus = await DiyCommon.PostAsync({
                        url: "/api/BackgroundTask/WorkerStatus",
                        data: {},
                        dataType: "json",
                        suppressErrorNotification: true
                    });
                } catch (_) {
                    // 兼容尚未提供就绪探针的旧 API 节点，最终仍由任务提交接口做权威校验。
                }
                const worker = workerStatus?.Code === 1 ? workerStatus.Data : null;
                const readiness = worker?.Readiness;
                if (worker && (worker.LoopHealthy !== true || readiness?.SchemaReady === false)) {
                    const reason = readiness?.Reason || worker.LastError || this.$t("Msg.BackgroundTaskWorkerUnavailable");
                    ElMessage.error(this.$t("Msg.PlatformAppsWorkerNotReady", { reason }));
                    return;
                }

                const operationId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                const result = await DiyCommon.ApiEngine.RunBackground(
                    "bulk-import-microi-store-packages",
                    {
                        StoreApiBase: "https://api.itdos.com",
                        StoreOsClient: "iTdos",
                        ApplicationType: "Platform"
                    },
                    this.$t("Msg.PlatformAppsBulkTaskTitle"),
                    {
                        IdempotencyKey: `microi-store-bulk:${operationId}`,
                        ConcurrencyKey: "bulk-import-microi-store-packages",
                        MaxAttempts: 3,
                        RetryOnFailure: true
                    }
                );
                if (!result || result.Code !== 1) {
                    const message = result?.Msg || result?.Message || this.$t("Msg.UnknownError");
                    ElMessage.error(this.$t("Msg.PlatformAppsBulkTaskFailed", { message }));
                    return;
                }

                const task = result.Data || {};
                const taskId = task.Id || task.TaskId || task.BackgroundTaskId || "";
                ElMessage.success(taskId
                    ? this.$t("Msg.PlatformAppsBulkTaskQueuedWithId", { taskId })
                    : this.$t("Msg.PlatformAppsBulkTaskQueued"));
                this.activeTab = "tasks";
                await this.refreshTasks();
            } catch (error) {
                ElMessage.error(this.$t("Msg.PlatformAppsBulkTaskFailed", {
                    message: error?.message || String(error || this.$t("Msg.UnknownError"))
                }));
            } finally {
                this.bulkPlatformAppsLoading = false;
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
            return isTerminalBackgroundTask(item);
        },
        canCancel(item) {
            return isActiveBackgroundTask(item);
        },
        getTaskProgress(item) {
            return getBackgroundTaskProgress(item, {
                calculating: this.$t("Msg.BackgroundTaskCalculating"),
                waiting: this.$t("Msg.BackgroundTaskWaiting")
            });
        },
        getTaskEta(item) {
            return getBackgroundTaskEta(item, {
                calculating: this.$t("Msg.BackgroundTaskEtaCalculating"),
                confidenceLow: this.$t("Msg.BackgroundTaskConfidenceLow"),
                confidenceMedium: this.$t("Msg.BackgroundTaskConfidenceMedium"),
                confidenceHigh: this.$t("Msg.BackgroundTaskConfidenceHigh")
            });
        },
        getTaskDownloadUrl(item) {
            if (!item || item.Status !== "Succeeded") return "";
            const result = item.Result || {};
            const data = result.Data || result.data || {};
            return data.DownloadUrl || data.downloadUrl || result.DownloadUrl || result.downloadUrl || "";
        },
        downloadTaskResult(item) {
            const url = this.getTaskDownloadUrl(item);
            if (!url) return;
            const link = document.createElement("a");
            link.href = url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        },
        getTaskStatusType(status) {
            if (status === "Succeeded") return "success";
            if (status === "Failed" || status === "Canceled") return "danger";
            if (status === "Running" || status === "Pending" || status === "Retrying") return "warning";
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

.platform-message-title--unread {
    color: var(--mci-color-primary, #409eff);
    font-weight: 700;
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
    background: linear-gradient(
        135deg,
        rgba(var(--mci-primary-rgb, 255, 90, 40), 0.09),
        rgba(var(--mci-surface-rgb, 255, 255, 255), 0.96)
    );
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

.app-panel-actions {
    display: flex;
    align-items: center;
    flex: none;
    gap: 8px;
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
    grid-template-columns: minmax(72px, 1fr) auto;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--mci-text-color-secondary, #909399);

    span {
        white-space: nowrap;
    }
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

.platform-message-table :deep(.el-table__row) {
    cursor: pointer;
}

.message-detail {
    display: grid;
    gap: 16px;
    min-height: 220px;
    padding: 8px;
}

.message-detail__meta {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--el-text-color-secondary);
    font-size: 13px;
}

.message-detail__content {
    padding: 18px 20px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;
    background: var(--el-bg-color);
    color: var(--el-text-color-primary);
    font-size: 14px;
    line-height: 1.8;
    white-space: pre-wrap;
    word-break: break-word;
}

.message-detail__payload {
    max-height: 260px;
    margin: 0;
    padding: 14px 16px;
    overflow: auto;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;
    background: var(--el-fill-color-light);
    color: var(--el-text-color-regular);
    font: 12px/1.6 Consolas, Monaco, monospace;
    white-space: pre-wrap;
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
