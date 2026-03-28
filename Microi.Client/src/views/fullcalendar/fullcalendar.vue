<template>
    <div class="microi-calendar" ref="calendarRoot">
        <!-- 日历统计卡片 -->
        <div class="cal-stats">
            <div class="cal-stat-card today-card">
                <div class="cal-stat-icon"><fa-icon :icon="'fas fa-sun'" /></div>
                <div class="cal-stat-body">
                    <div class="cal-stat-value">{{ calStats.Today }}</div>
                    <div class="cal-stat-label">今日日程</div>
                </div>
            </div>
            <div class="cal-stat-card week-card">
                <div class="cal-stat-icon"><fa-icon :icon="'fas fa-calendar-week'" /></div>
                <div class="cal-stat-body">
                    <div class="cal-stat-value">{{ calStats.Week }}</div>
                    <div class="cal-stat-label">本周日程</div>
                </div>
            </div>
            <div class="cal-stat-card month-card">
                <div class="cal-stat-icon"><fa-icon :icon="'fas fa-calendar-alt'" /></div>
                <div class="cal-stat-body">
                    <div class="cal-stat-value">{{ calStats.Month }}</div>
                    <div class="cal-stat-label">本月日程</div>
                </div>
            </div>
            <div class="cal-stat-card pending-card">
                <div class="cal-stat-icon"><fa-icon :icon="'fas fa-hourglass-half'" /></div>
                <div class="cal-stat-body">
                    <div class="cal-stat-value">{{ calStats.Pending }}</div>
                    <div class="cal-stat-label">待完成</div>
                </div>
            </div>
        </div>

        <FullCalendar ref="calendarRef" :options="calendarOptions">
            <template v-slot:eventContent="arg">
                <div class="fc-custom-event" :class="{ 'is-completed': isCompleted(arg.event) }">
                    <span class="event-dot" :class="isCompleted(arg.event) ? 'dot-done' : 'dot-pending'"></span>
                    <span class="event-time" v-if="arg.timeText">{{ arg.timeText }}</span>
                    <span class="event-title">{{ arg.event.title }}</span>
                </div>
            </template>
        </FullCalendar>

        <!-- 新建/编辑日程弹窗 -->
        <el-dialog
            v-model="dialogVisible"
            :title="editingEventId ? '编辑日程' : '新建日程'"
            width="500px"
            :close-on-click-modal="false"
            destroy-on-close
            append-to-body
            class="calendar-event-dialog"
        >
            <el-form ref="formRef" :model="form" :rules="formRules" label-width="80px">
                <el-form-item label="标题" prop="Title">
                    <el-input v-model="form.Title" placeholder="请输入日程标题" maxlength="50" show-word-limit clearable />
                </el-form-item>
                <el-row :gutter="16">
                    <el-col :xs="24" :sm="12">
                        <el-form-item label="开始时间" prop="StartTime">
                            <el-date-picker
                                v-model="form.StartTime"
                                type="datetime"
                                placeholder="选择开始时间"
                                style="width: 100%"
                                value-format="YYYY-MM-DD HH:mm:ss"
                            />
                        </el-form-item>
                    </el-col>
                    <el-col :xs="24" :sm="12">
                        <el-form-item label="结束时间">
                            <el-date-picker
                                v-model="form.EndTime"
                                type="datetime"
                                placeholder="选择结束时间"
                                style="width: 100%"
                                value-format="YYYY-MM-DD HH:mm:ss"
                            />
                        </el-form-item>
                    </el-col>
                </el-row>
                <el-form-item label="状态">
                    <el-radio-group v-model="form.State">
                        <el-radio label="未完成" />
                        <el-radio label="已完成" />
                    </el-radio-group>
                </el-form-item>
                <el-form-item label="备注">
                    <el-input v-model="form.Beizhu" type="textarea" :rows="3" placeholder="请输入备注信息" maxlength="2000" />
                </el-form-item>
            </el-form>
            <template #footer>
                <div class="dialog-footer">
                    <el-button v-if="editingEventId" type="danger" plain @click="handleDelete" :loading="submitting">删除</el-button>
                    <div style="flex: 1"></div>
                    <el-button @click="dialogVisible = false">取消</el-button>
                    <el-button type="primary" @click="handleSubmit" :loading="submitting">{{ editingEventId ? "保存" : "创建" }}</el-button>
                </div>
            </template>
        </el-dialog>
    </div>
</template>

<script>
import FullCalendar from "@fullcalendar/vue3";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import zhLocale from "@fullcalendar/core/locales/zh-cn";

const TABLE_KEY = "microi_calendar";
const COLOR_PENDING = "#409eff";
const COLOR_DONE = "#67c23a";

export default {
    name: "MicroiCalendar",
    components: { FullCalendar },
    data() {
        return {
            dialogVisible: false,
            editingEventId: null,
            submitting: false,
            form: { Title: "", StartTime: "", EndTime: "", State: "未完成", Beizhu: "" },
            formRules: {
                Title: [{ required: true, message: "请输入日程标题", trigger: "blur" }],
                StartTime: [{ required: true, message: "请选择开始时间", trigger: "change" }]
            },
            calStats: { Today: 0, Week: 0, Month: 0, Pending: 0 },
            calendarOptions: {
                plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
                headerToolbar: {
                    left: "prev,next today",
                    center: "title",
                    right: "dayGridMonth,timeGridWeek,timeGridDay"
                },
                locales: [zhLocale],
                locale: "zh-cn",
                initialView: "dayGridMonth",
                editable: true,
                selectable: true,
                selectMirror: true,
                dayMaxEvents: true,
                weekends: true,
                height: "auto",
                contentHeight: "auto",
                events: this.fetchEvents,
                select: this.handleDateSelect,
                eventClick: this.handleEventClick,
                eventDrop: this.handleEventDrop,
                eventResize: this.handleEventResize
            }
        };
    },
    mounted() {
        this.loadCalendarStats();
        this.updateCalendarHeight();
        window.addEventListener("resize", this.updateCalendarHeight);
    },
    beforeUnmount() {
        window.removeEventListener("resize", this.updateCalendarHeight);
    },
    methods: {
        async loadCalendarStats() {
            var self = this;
            try {
                var result = await self.DiyCommon.ApiEngine.Run("calendar-stats", {});
                if (result && result.Code === 1 && result.Data) {
                    self.calStats = result.Data;
                }
            } catch (e) {
                console.error("加载日历统计失败:", e);
            }
        },
        updateCalendarHeight() {
            var self = this;
            self.$nextTick(function () {
                var calApi = self.$refs.calendarRef && self.$refs.calendarRef.getApi();
                if (calApi) {
                    var calEl = self.$refs.calendarRoot && self.$refs.calendarRoot.querySelector(".fc");
                    if (calEl) {
                        var rect = calEl.getBoundingClientRect();
                        var newHeight = Math.max(400, window.innerHeight - rect.top - 24);
                        calApi.setOption("height", newHeight);
                    }
                }
            });
        },
        isCompleted(event) {
            var state = event.extendedProps && event.extendedProps.State;
            return state === "已完成" || state === "1";
        },
        formatDate(date) {
            if (!date) return "";
            var d = new Date(date);
            if (isNaN(d.getTime())) return "";
            var pad = function (n) {
                return String(n).padStart(2, "0");
            };
            return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
        },

        // 从后端加载日历事件（FullCalendar events回调）
        async fetchEvents(fetchInfo, successCallback) {
            var self = this;
            try {
                var startStr = self.formatDate(fetchInfo.start);
                var endStr = self.formatDate(fetchInfo.end);
                var result = await self.DiyCommon.FormEngine.GetTableData({
                    FormEngineKey: TABLE_KEY,
                    _PageSize: 500,
                    _Where: [
                        { Name: "StartTime", Value: endStr, Type: "<=" },
                        { Name: "EndTime", Value: startStr, Type: ">=" }
                    ]
                });
                if (result && result.Code === 1 && result.Data) {
                    successCallback(
                        result.Data.map(function (item) {
                            var done = item.State === "已完成" || item.State === "1";
                            return {
                                id: item.Id,
                                title: item.Title || "无标题",
                                start: item.StartTime,
                                end: item.EndTime,
                                backgroundColor: done ? COLOR_DONE : COLOR_PENDING,
                                borderColor: done ? COLOR_DONE : COLOR_PENDING,
                                extendedProps: { State: item.State, Beizhu: item.Beizhu }
                            };
                        })
                    );
                } else {
                    successCallback([]);
                }
            } catch (e) {
                console.error("加载日历事件失败:", e);
                successCallback([]);
            }
        },

        // 选择日期区间 → 打开新建弹窗
        handleDateSelect(selectInfo) {
            var self = this;
            selectInfo.view.calendar.unselect();
            self.editingEventId = null;
            self.form = {
                Title: "",
                StartTime: self.formatDate(selectInfo.start),
                EndTime: self.formatDate(selectInfo.end),
                State: "未完成",
                Beizhu: ""
            };
            self.dialogVisible = true;
        },

        // 点击事件 → 打开编辑弹窗
        handleEventClick(clickInfo) {
            var self = this;
            var event = clickInfo.event;
            self.editingEventId = event.id;
            self.form = {
                Title: event.title,
                StartTime: self.formatDate(event.start),
                EndTime: event.end ? self.formatDate(event.end) : self.formatDate(event.start),
                State: (event.extendedProps && event.extendedProps.State) || "未完成",
                Beizhu: (event.extendedProps && event.extendedProps.Beizhu) || ""
            };
            self.dialogVisible = true;
        },

        // 拖拽日程 → 更新时间
        async handleEventDrop(info) {
            var self = this;
            try {
                var result = await self.DiyCommon.FormEngine.UptFormData({
                    FormEngineKey: TABLE_KEY,
                    Id: info.event.id,
                    StartTime: self.formatDate(info.event.start),
                    EndTime: info.event.end ? self.formatDate(info.event.end) : self.formatDate(info.event.start)
                });
                if (!result || result.Code !== 1) {
                    info.revert();
                    self.DiyCommon.Tips("更新日程失败", false);
                }
            } catch (e) {
                info.revert();
            }
        },

        // 调整日程时长 → 更新结束时间
        async handleEventResize(info) {
            var self = this;
            try {
                var result = await self.DiyCommon.FormEngine.UptFormData({
                    FormEngineKey: TABLE_KEY,
                    Id: info.event.id,
                    StartTime: self.formatDate(info.event.start),
                    EndTime: info.event.end ? self.formatDate(info.event.end) : self.formatDate(info.event.start)
                });
                if (!result || result.Code !== 1) {
                    info.revert();
                    self.DiyCommon.Tips("更新日程失败", false);
                }
            } catch (e) {
                info.revert();
            }
        },

        // 提交新建/编辑
        async handleSubmit() {
            var self = this;
            try {
                await self.$refs.formRef.validate();
            } catch (e) {
                return;
            }
            self.submitting = true;
            try {
                var params = {
                    FormEngineKey: TABLE_KEY,
                    Title: self.form.Title,
                    StartTime: self.form.StartTime,
                    EndTime: self.form.EndTime || self.form.StartTime,
                    State: self.form.State,
                    Beizhu: self.form.Beizhu
                };
                var result;
                if (self.editingEventId) {
                    params.Id = self.editingEventId;
                    result = await self.DiyCommon.FormEngine.UptFormData(params);
                } else {
                    result = await self.DiyCommon.FormEngine.AddFormData(params);
                }
                if (result && result.Code === 1) {
                    self.DiyCommon.Tips(self.editingEventId ? "更新成功" : "创建成功", true);
                    self.dialogVisible = false;
                    self.refreshCalendar();
                    self.loadCalendarStats();
                } else {
                    self.DiyCommon.Tips((result && result.Msg) || "操作失败", false);
                }
            } finally {
                self.submitting = false;
            }
        },

        // 删除日程
        handleDelete() {
            var self = this;
            self.DiyCommon.OsConfirm("确定要删除该日程吗？", async function () {
                self.submitting = true;
                try {
                    var result = await self.DiyCommon.FormEngine.DelFormData({
                        FormEngineKey: TABLE_KEY,
                        Id: self.editingEventId
                    });
                    if (result && result.Code === 1) {
                        self.DiyCommon.Tips("删除成功", true);
                        self.dialogVisible = false;
                        self.refreshCalendar();
                        self.loadCalendarStats();
                    } else {
                        self.DiyCommon.Tips((result && result.Msg) || "删除失败", false);
                    }
                } finally {
                    self.submitting = false;
                }
            });
        },

        // 刷新日历数据
        refreshCalendar() {
            var calendarApi = this.$refs.calendarRef && this.$refs.calendarRef.getApi();
            if (calendarApi) {
                calendarApi.refetchEvents();
            }
        }
    }
};
</script>

<style lang="scss" scoped>
.microi-calendar {
    padding: 16px;
    background: #fff;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    height: 100%;

    :deep(.fc) {
        flex: 1;
        .fc-toolbar {
            flex-wrap: wrap;
            gap: 8px;
        }
        .fc-toolbar-title {
            font-size: 1.2em;
            font-weight: 600;
            color: #303133;
        }
        .fc-button {
            border-radius: 6px !important;
            font-size: 13px;
            padding: 5px 14px;
            transition: all 0.2s;
        }
        .fc-button-primary {
            background-color: var(--el-color-primary, #409eff);
            border-color: var(--el-color-primary, #409eff);
        }
        .fc-button-primary:not(:disabled).fc-button-active,
        .fc-button-primary:not(:disabled):hover {
            background-color: var(--el-color-primary, #409eff);
            border-color: var(--el-color-primary, #409eff);
            filter: brightness(0.9);
        }
        .fc-daygrid-event {
            border-radius: 4px;
            padding: 1px 4px;
        }
        .fc-event {
            cursor: pointer;
            transition: opacity 0.2s;
            &:hover {
                opacity: 0.85;
            }
        }
        .fc-day-today {
            background: rgba(64, 158, 255, 0.04) !important;
        }
        .fc-col-header-cell {
            padding: 8px 0;
            font-weight: 500;
            color: #606266;
        }
    }
}

// ====== 日历统计卡片 ======
.cal-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    margin-bottom: 16px;
    flex-shrink: 0;
}

.cal-stat-card {
    border-radius: 14px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    color: #fff;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);

    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
    }
}

.today-card { background: linear-gradient(135deg, #409eff 0%, #53a8ff 50%, #66b1ff 100%); }
.week-card { background: linear-gradient(135deg, #67c23a 0%, #85ce61 50%, #95d475 100%); }
.month-card { background: linear-gradient(135deg, #e6a23c 0%, #ebb563 50%, #f0c78a 100%); }
.pending-card { background: linear-gradient(135deg, #f56c6c 0%, #f78989 50%, #fab6b6 100%); }

.cal-stat-icon {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
}

.cal-stat-body {
    min-width: 0;
}

.cal-stat-value {
    font-size: 26px;
    font-weight: 700;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
}

.cal-stat-label {
    font-size: 12px;
    opacity: 0.85;
    margin-top: 2px;
    white-space: nowrap;
}

.fc-custom-event {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    overflow: hidden;
    color: #fff;

    .event-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex-shrink: 0;
    }
    .dot-pending {
        background-color: rgba(255, 255, 255, 0.8);
    }
    .dot-done {
        background-color: rgba(255, 255, 255, 0.8);
    }
    &.is-completed .event-title {
        text-decoration: line-through;
        opacity: 0.75;
    }
    .event-time {
        font-size: 11px;
        opacity: 0.9;
        flex-shrink: 0;
    }
    .event-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
}

.dialog-footer {
    display: flex;
    align-items: center;
    gap: 8px;
}

@media (max-width: 768px) {
    .microi-calendar {
        padding: 8px;
    }
    .cal-stats {
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        margin-bottom: 12px;
    }
    .cal-stat-card {
        padding: 12px;
        gap: 10px;
        border-radius: 10px;
    }
    .cal-stat-icon {
        width: 34px;
        height: 34px;
        font-size: 14px;
        border-radius: 8px;
    }
    .cal-stat-value {
        font-size: 20px;
    }
    :deep(.fc) {
        .fc-toolbar {
            font-size: 12px;
        }
        .fc-toolbar-title {
            font-size: 1em;
        }
        .fc-button {
            padding: 3px 8px;
            font-size: 12px;
        }
    }
}
</style>
