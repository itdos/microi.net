<template>
    <el-popover placement="bottom-end" trigger="click" width="440" popper-class="microi-task-popover" @show="refreshTasks">
        <template #reference>
            <div class="right-menu-item hover-effect task-entry" :title="$t('Msg.BackgroundTasks')">
                <el-badge :value="runningCount" :max="99" :hidden="runningCount === 0" :class="{ 'task-badge-flash': runningCount > 0 }">
                    <el-icon class="task-icon"><Bell /></el-icon>
                </el-badge>
            </div>
        </template>

        <div class="task-panel">
            <div class="task-panel-header">
                <span>{{ $t("Msg.BackgroundTasks") }}</span>
                <div class="task-panel-actions">
                    <el-button link size="small" :icon="Refresh" :loading="loading" @click="refreshTasks">{{ $t("Msg.Refresh") }}</el-button>
                    <el-button link size="small" :icon="Delete" @click="clearCompleted">{{ $t("Msg.ClearCompleted") }}</el-button>
                </div>
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
        </div>
    </el-popover>
</template>

<script>
import { DiyCommon } from "@/utils/diy.common";
import { Bell, CircleClose, Delete, Refresh } from "@element-plus/icons-vue";

export default {
    name: "BackgroundTaskCenter",
    components: {
        Bell
    },
    data() {
        return {
            tasks: [],
            loading: false,
            Delete,
            Refresh,
            CircleClose
        };
    },
    computed: {
        runningCount() {
            return this.tasks.filter((item) => item.Status === "Pending" || item.Status === "Running").length;
        }
    },
    mounted() {
        this.bindWebsocket();
        this.refreshTasks();
        window.addEventListener("microi-websocket-connected", this.handleWebSocketConnected);
    },
    beforeUnmount() {
        window.removeEventListener("microi-websocket-connected", this.handleWebSocketConnected);
        const ws = this.getWebsocket();
        if (ws && typeof ws.off === "function") {
            ws.off("ReceiveBackgroundTaskList", this.handleTaskList);
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

.task-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 600;
    color: #303133;
    margin-bottom: 8px;
}

.task-panel-actions {
    display: flex;
    align-items: center;
    gap: 6px;
}

.task-empty {
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #909399;
    font-size: 13px;
}

.task-list {
    max-height: 380px;
    overflow: auto;
}

.task-item {
    padding: 10px 0;
    border-bottom: 1px solid #ebeef5;

    &:last-child {
        border-bottom: 0;
    }
}

.task-main,
.task-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.task-title {
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

.task-meta {
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
