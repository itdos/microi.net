<template>
    <div class="sys-log-page pluginPage">
        <el-tabs v-model="activeTab" type="border-card" class="main-tabs" @tab-change="OnTabChange">
            <!-- ==================== 系统日志 Tab ==================== -->
            <el-tab-pane name="syslog" label="系统日志">
                <!-- 筛选区域 -->
                <el-card class="filter-card" shadow="never">
                    <el-form :model="SearchModel" inline @submit.prevent class="filter-form">
                        <el-form-item>
                            <el-button-group style="margin-right: 12px">
                                <el-button :type="SearchModel.Type === '' ? 'primary' : 'default'" size="small" @click="QuickFilter('')">全部</el-button>
                                <el-button :type="SearchModel.Type === '数据库慢SQL' ? 'warning' : 'default'" size="small" @click="QuickFilter('数据库慢SQL')">慢SQL</el-button>
                                <el-button :type="SearchModel.Type === '表单V8慢日志' ? 'warning' : 'default'" size="small" @click="QuickFilter('表单V8慢日志')">慢执行</el-button>
                                <el-button :type="SearchModel.Type === 'Exception' ? 'danger' : 'default'" size="small" @click="QuickFilter('Exception')">异常</el-button>
                            </el-button-group>
                            <el-tooltip content="自动刷新" placement="top">
                                <el-switch v-model="AutoRefresh" @change="ToggleAutoRefresh" style="margin-right: 8px" />
                            </el-tooltip>
                            <el-button :icon="Refresh" circle @click="GetSysLog(false)" :loading="tableLoading" />
                        </el-form-item>
                        <el-form-item>
                            <el-input v-model="SearchModel.Keyword" placeholder="搜索标题、内容、用户、IP..." clearable @keyup.enter="GetSysLog(true)" style="width: 240px" class="input-left-borderbg">
                                <template #prefix><el-icon><Search /></el-icon></template>
                            </el-input>
                        </el-form-item>
                        <el-form-item>
                            <el-select v-model="SearchModel.Type" placeholder="日志类型" clearable filterable style="width: 160px" @change="GetSysLog(true)">
                                <el-option v-for="item in LogTypeList" :key="item" :label="item" :value="item" />
                            </el-select>
                        </el-form-item>
                        <el-form-item>
                            <el-select v-model="SearchModel.Level" placeholder="日志级别" clearable style="width: 120px" @change="GetSysLog(true)">
                                <el-option label="调试" :value="0" />
                                <el-option label="信息" :value="1" />
                                <el-option label="警告" :value="2" />
                                <el-option label="错误" :value="3" />
                                <el-option label="严重" :value="4" />
                            </el-select>
                        </el-form-item>
                        <el-form-item>
                            <el-date-picker v-model="SearchModel.Month" type="month" format="YYYY年MM月" value-format="YYYYMM" placeholder="选择月份" style="width: 150px" @change="OnMonthChange" />
                        </el-form-item>
                        <el-form-item>
                            <el-button type="primary" :icon="Search" @click="GetSysLog(true)">查询</el-button>
                            <el-button :icon="Refresh" @click="ResetSearch">重置</el-button>
                        </el-form-item>
                        
                    </el-form>
                </el-card>

                <!-- 统计卡片 -->
                <div class="stats-flex-row">
                    <div class="stats-card stats-card--total" @click="QuickFilter('')">
                        <div class="stats-card__inner">
                            <el-icon class="stats-card__icon"><Notebook /></el-icon>
                            <div class="stats-card__info">
                                <div class="stats-card__value">{{ SysLogCount }}</div>
                                <div class="stats-card__label">日志总数</div>
                            </div>
                        </div>
                    </div>
                    <div class="stats-card stats-card--error" @click="QuickFilter('Exception')">
                        <div class="stats-card__inner">
                            <el-icon class="stats-card__icon"><CircleCloseFilled /></el-icon>
                            <div class="stats-card__info">
                                <div class="stats-card__value">{{ StatsError }}</div>
                                <div class="stats-card__label">错误日志</div>
                            </div>
                        </div>
                    </div>
                    <div class="stats-card stats-card--warn" @click="QuickFilter('')">
                        <div class="stats-card__inner">
                            <el-icon class="stats-card__icon"><WarningFilled /></el-icon>
                            <div class="stats-card__info">
                                <div class="stats-card__value">{{ StatsWarn }}</div>
                                <div class="stats-card__label">警告日志</div>
                            </div>
                        </div>
                    </div>
                    <div class="stats-card stats-card--slowsql" @click="QuickFilter('数据库慢SQL')">
                        <div class="stats-card__inner">
                            <el-icon class="stats-card__icon"><Timer /></el-icon>
                            <div class="stats-card__info">
                                <div class="stats-card__value">{{ StatsSlowSQL }}</div>
                                <div class="stats-card__label">慢SQL</div>
                            </div>
                        </div>
                    </div>
                    <div class="stats-card stats-card--slowexec" @click="QuickFilter('表单V8慢日志')">
                        <div class="stats-card__inner">
                            <el-icon class="stats-card__icon"><Stopwatch /></el-icon>
                            <div class="stats-card__info">
                                <div class="stats-card__value">{{ StatsSlowExec }}</div>
                                <div class="stats-card__label">慢执行</div>
                            </div>
                        </div>
                    </div>
                    <div class="stats-card stats-card--exception" @click="QuickFilter('Exception')">
                        <div class="stats-card__inner">
                            <el-icon class="stats-card__icon"><WarnTriangleFilled /></el-icon>
                            <div class="stats-card__info">
                                <div class="stats-card__value">{{ StatsException }}</div>
                                <div class="stats-card__label">异常</div>
                            </div>
                        </div>
                    </div>
                    <div class="stats-card stats-card--info">
                        <div class="stats-card__inner">
                            <el-icon class="stats-card__icon"><Collection /></el-icon>
                            <div class="stats-card__info">
                                <div class="stats-card__value">{{ LogTypeList.length }}</div>
                                <div class="stats-card__label">日志类型</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 表格区域 -->
                <el-card shadow="never" class="table-card">
                    <el-table v-loading="tableLoading" :data="SysLogList" style="width: 100%" class="diy-table no-border-outside" stripe border @row-click="OpenDetail" highlight-current-row>
                        <el-table-column type="index" width="50" align="center" fixed="left" />
                        <el-table-column label="级别" width="80" align="center" fixed="left">
                            <template #default="scope">
                                <el-tag :type="GetLevelTag(scope.row.Level).type" size="small" effect="dark" round>
                                    {{ GetLevelTag(scope.row.Level).text }}
                                </el-tag>
                            </template>
                        </el-table-column>
                        <el-table-column label="类型" width="140">
                            <template #default="scope">
                                <el-tag v-if="scope.row.Type" size="small" effect="plain" :type="scope.row.Type === '数据库慢SQL' || scope.row.Type === '表单V8慢日志' ? 'warning' : scope.row.Type === 'Exception' ? 'danger' : 'info'">{{ scope.row.Type }}</el-tag>
                                <span v-else class="text-muted">-</span>
                            </template>
                        </el-table-column>
                        <el-table-column label="标题" min-width="280" show-overflow-tooltip>
                            <template #default="scope">
                                <span class="log-title">{{ scope.row.Title || '-' }}</span>
                            </template>
                        </el-table-column>
                        <el-table-column label="内容" min-width="300" show-overflow-tooltip>
                            <template #default="scope">
                                <span class="log-content">{{ scope.row.Content || '-' }}</span>
                            </template>
                        </el-table-column>
                        <el-table-column prop="UserName" label="用户" width="100" show-overflow-tooltip />
                        <el-table-column label="耗时" width="100" align="center" sortable :sort-method="(a, b) => (a.Timer || 0) - (b.Timer || 0)">
                            <template #default="scope">
                                <template v-if="scope.row.Timer != null">
                                    <el-tag :type="scope.row.Timer > 5000 ? 'danger' : scope.row.Timer > 1000 ? 'warning' : 'success'" size="small" effect="plain">
                                        {{ FormatTimer(scope.row.Timer) }}
                                    </el-tag>
                                </template>
                                <span v-else class="text-muted">-</span>
                            </template>
                        </el-table-column>
                        <el-table-column prop="IP" label="IP" width="130" show-overflow-tooltip />
                        <el-table-column label="时间" width="170" align="center">
                            <template #default="scope">
                                <span class="log-time">{{ scope.row.CreateTime }}</span>
                            </template>
                        </el-table-column>
                    </el-table>

                    <div class="pagination-wrap">
                        <el-pagination
                            background
                            layout="total, sizes, prev, pager, next, jumper"
                            :total="SysLogCount"
                            :page-size="SysLogPageSize"
                            :page-sizes="[15, 20, 50, 100, 200]"
                            :current-page="SysLogPageIndex"
                            @size-change="SysLogSizeChange"
                            @current-change="SysLogCurrentChange"
                        />
                    </div>
                </el-card>
            </el-tab-pane>

            <!-- ==================== 应用日志 Tab ==================== -->
            <el-tab-pane name="docker" label="应用日志">
                <el-card class="filter-card" shadow="never">
                    <el-form inline @submit.prevent class="filter-form">
                        <el-form-item label="显示行数">
                            <el-select v-model="DockerModel.Lines" style="width: 120px">
                                <el-option :value="50" label="50行" />
                                <el-option :value="100" label="100行" />
                                <el-option :value="200" label="200行" />
                                <el-option :value="500" label="500行" />
                                <el-option :value="1000" label="1000行" />
                            </el-select>
                        </el-form-item>
                        <el-form-item label="关键词">
                            <el-input v-model="DockerModel.Keyword" placeholder="过滤关键词..." clearable style="width: 200px" @keyup.enter="GetDockerLogs" />
                        </el-form-item>
                        <el-form-item label="级别过滤">
                            <el-select v-model="DockerModel.LevelFilter" placeholder="全部" clearable style="width: 120px">
                                <el-option label="错误" value="error" />
                                <el-option label="警告" value="warn" />
                                <el-option label="信息" value="info" />
                            </el-select>
                        </el-form-item>
                        <el-form-item>
                            <el-button type="primary" :icon="Search" :loading="dockerLoading" @click="GetDockerLogs">查询</el-button>
                        </el-form-item>
                        <el-form-item style="float: right">
                            <el-tooltip content="自动刷新" placement="top">
                                <el-switch v-model="DockerModel.AutoRefresh" @change="ToggleDockerAutoRefresh" style="margin-right: 8px" />
                            </el-tooltip>
                            <el-button :icon="Refresh" circle @click="GetDockerLogs" :loading="dockerLoading" />
                        </el-form-item>
                    </el-form>
                </el-card>
                <el-card shadow="never" class="docker-card">
                    <div class="docker-terminal" ref="dockerTerminal">
                        <div v-if="dockerLoading && DockerLogs.length === 0" class="docker-loading">
                            <el-icon class="is-loading"><Loading /></el-icon> 正在获取日志...
                        </div>
                        <div v-else-if="DockerLogs.length === 0" class="docker-empty">
                            暂无日志数据，请点击查询
                        </div>
                        <div v-else class="docker-lines">
                            <div v-for="(line, idx) in filteredDockerLogs" :key="idx" class="docker-line" :class="getDockerLineClass(line)">
                                <span class="docker-line-no">{{ idx + 1 }}</span>
                                <span class="docker-line-text" v-safe-html="highlightKeyword(line)"></span>
                            </div>
                        </div>
                    </div>
                    <div class="docker-footer">
                        <span class="docker-info">共 {{ filteredDockerLogs.length }} 行 <template v-if="DockerModel.Keyword || DockerModel.LevelFilter">（已过滤，原始 {{ DockerLogs.length }} 行）</template></span>
                        <div class="docker-page-btns">
                            <el-button size="small" :disabled="dockerPage <= 1" @click="dockerPage--">上一页</el-button>
                            <span class="docker-page-info">{{ dockerPage }} / {{ dockerTotalPages }}</span>
                            <el-button size="small" :disabled="dockerPage >= dockerTotalPages" @click="dockerPage++">下一页</el-button>
                        </div>
                    </div>
                </el-card>
            </el-tab-pane>
        </el-tabs>

        <!-- 详情弹窗 -->
        <el-dialog v-model="ShowDetail" title="日志详情" width="860px" draggable :close-on-click-modal="true" :destroy-on-close="true">
            <template v-if="DetailModel">
                <el-descriptions :column="3" border size="small" class="detail-desc">
                    <el-descriptions-item label="日志级别" :span="1">
                        <el-tag :type="GetLevelTag(DetailModel.Level).type" size="small" effect="dark" round>
                            {{ GetLevelTag(DetailModel.Level).text }}
                        </el-tag>
                    </el-descriptions-item>
                    <el-descriptions-item label="日志类型" :span="1">
                        <el-tag v-if="DetailModel.Type" size="small" effect="plain" :type="DetailModel.Type === '数据库慢SQL' || DetailModel.Type === '表单V8慢日志' ? 'warning' : DetailModel.Type === 'Exception' ? 'danger' : 'info'">{{ DetailModel.Type }}</el-tag>
                        <span v-else>-</span>
                    </el-descriptions-item>
                    <el-descriptions-item label="耗时" :span="1">
                        <template v-if="DetailModel.Timer != null">
                            <el-tag :type="DetailModel.Timer > 5000 ? 'danger' : DetailModel.Timer > 1000 ? 'warning' : 'success'" size="small" effect="plain">
                                {{ FormatTimer(DetailModel.Timer) }}
                            </el-tag>
                        </template>
                        <span v-else>-</span>
                    </el-descriptions-item>
                    <el-descriptions-item label="标题" :span="3">{{ DetailModel.Title || '-' }}</el-descriptions-item>
                    <el-descriptions-item label="用户" :span="1">{{ DetailModel.UserName || '-' }}</el-descriptions-item>
                    <el-descriptions-item label="IP" :span="1">{{ DetailModel.IP || '-' }}</el-descriptions-item>
                    <el-descriptions-item label="创建时间" :span="1">{{ DetailModel.CreateTime }}</el-descriptions-item>
                    <el-descriptions-item label="Api" :span="2">
                        <el-text v-if="DetailModel.Api" class="detail-code-text" truncated>{{ DetailModel.Api }}</el-text>
                        <span v-else>-</span>
                    </el-descriptions-item>
                    <el-descriptions-item label="AppId" :span="1">{{ DetailModel.AppId || '-' }}</el-descriptions-item>
                    <el-descriptions-item v-if="DetailModel.Browser" label="浏览器" :span="1">{{ DetailModel.Browser }}</el-descriptions-item>
                    <el-descriptions-item v-if="DetailModel.OS" label="操作系统" :span="1">{{ DetailModel.OS }}</el-descriptions-item>
                    <el-descriptions-item v-if="DetailModel.RequestMethod" label="请求方式" :span="1">{{ DetailModel.RequestMethod }}</el-descriptions-item>
                    <el-descriptions-item label="内容" :span="3">
                        <div class="detail-content-block">
                            <template v-if="HasPerfSteps(DetailModel.Content)">
                                <div class="detail-summary">{{ GetContentSummary(DetailModel.Content) }}</div>
                                <div class="detail-perf-steps">
                                    <div class="perf-steps-header">分步耗时</div>
                                    <div v-for="(step, idx) in ParsePerfSteps(DetailModel.Content)" :key="idx" class="perf-step-row">
                                        <span class="perf-step-name">{{ step.name }}</span>
                                        <span class="perf-step-bar-wrap">
                                            <span class="perf-step-bar" :class="step.level" :style="{ width: step.percent + '%' }"></span>
                                        </span>
                                        <span class="perf-step-ms" :class="step.level">{{ step.ms }}ms</span>
                                    </div>
                                </div>
                            </template>
                            <template v-else>
                                {{ DetailModel.Content || '-' }}
                            </template>
                            <el-button v-if="DetailModel.Content" size="small" type="primary" link style="float:right;margin-top:4px" @click="CopyText(DetailModel.Content)">复制</el-button>
                        </div>
                    </el-descriptions-item>
                    <el-descriptions-item v-if="DetailModel.Param" label="参数值" :span="3">
                        <div class="detail-content-block detail-code-block">
                            {{ FormatParams(DetailModel.Param) }}
                            <el-button size="small" type="primary" link style="float:right;margin-top:4px" @click="CopyText(DetailModel.Param)">复制</el-button>
                        </div>
                    </el-descriptions-item>
                    <el-descriptions-item v-if="DetailModel.OtherInfo" label="可执行SQL" :span="3">
                        <div class="detail-content-block detail-sql-block">
                            {{ DetailModel.OtherInfo }}
                            <el-button size="small" type="primary" link style="float:right;margin-top:4px" @click="CopyText(DetailModel.OtherInfo)">复制</el-button>
                        </div>
                    </el-descriptions-item>
                    <el-descriptions-item v-if="DetailModel.Remark" label="备注" :span="3">{{ DetailModel.Remark }}</el-descriptions-item>
                </el-descriptions>
            </template>
        </el-dialog>
    </div>
</template>

<script>
import { Search, Refresh, Notebook, CircleCloseFilled, WarningFilled, Collection, Loading, Timer, Stopwatch, WarnTriangleFilled } from "@element-plus/icons-vue";

export default {
    name: "sys_log",
    components: {
        Search, Notebook, CircleCloseFilled, WarningFilled, Collection, Loading, Timer, Stopwatch, WarnTriangleFilled
    },
    data() {
        return {
            activeTab: "syslog",
            // ---- 系统日志 ----
            tableLoading: true,
            AutoRefresh: false,
            autoRefreshTimer: null,
            ShowDetail: false,
            DetailModel: null,
            SearchModel: {
                Keyword: "",
                Type: "",
                Level: undefined,
                Month: new Date().Format("yyyyMM")
            },
            LogTypeList: [],
            SysLogList: [],
            SysLogCount: 0,
            SysLogPageSize: 15,
            SysLogPageIndex: 1,
            StatsError: 0,
            StatsWarn: 0,
            StatsSlowSQL: 0,
            StatsSlowExec: 0,
            StatsException: 0,
            // ---- 应用日志 ----
            dockerLoading: false,
            DockerModel: {
                Lines: 200,
                Keyword: "",
                LevelFilter: "",
                AutoRefresh: false
            },
            dockerAutoRefreshTimer: null,
            DockerLogs: [],
            dockerPage: 1,
            dockerPageSize: 100
        };
    },
    computed: {
        filteredDockerLogs() {
            var logs = this.DockerLogs;
            if (this.DockerModel.Keyword) {
                var kw = this.DockerModel.Keyword.toLowerCase();
                logs = logs.filter(function(line) { return line.toLowerCase().includes(kw); });
            }
            if (this.DockerModel.LevelFilter) {
                var f = this.DockerModel.LevelFilter;
                logs = logs.filter(function(line) {
                    var lower = line.toLowerCase();
                    if (f === 'error') return lower.includes('error') || lower.includes('exception') || lower.includes('❌') || lower.includes('fail');
                    if (f === 'warn') return lower.includes('warn') || lower.includes('⚠️') || lower.includes('警告');
                    if (f === 'info') return lower.includes('info') || lower.includes('microi');
                    return true;
                });
            }
            return logs;
        },
        pagedDockerLogs() {
            var start = (this.dockerPage - 1) * this.dockerPageSize;
            return this.filteredDockerLogs.slice(start, start + this.dockerPageSize);
        },
        dockerTotalPages() {
            return Math.max(1, Math.ceil(this.filteredDockerLogs.length / this.dockerPageSize));
        }
    },
    watch: {
        'DockerModel.Keyword'() { this.dockerPage = 1; },
        'DockerModel.LevelFilter'() { this.dockerPage = 1; }
    },
    mounted() {
        this.GetSysLog(true);
        this.GetLogTypes();
    },
    beforeUnmount() {
        if (this.autoRefreshTimer) clearInterval(this.autoRefreshTimer);
        if (this.dockerAutoRefreshTimer) clearInterval(this.dockerAutoRefreshTimer);
    },
    methods: {
        // ========== 分步耗时解析 ==========
        HasPerfSteps(content) {
            return content && content.includes('── 分步耗时 ──');
        },
        GetContentSummary(content) {
            if (!content) return '-';
            var idx = content.indexOf('\n── 分步耗时 ──');
            if (idx === -1) idx = content.indexOf('── 分步耗时 ──');
            return idx > 0 ? content.substring(0, idx).trim() : content.split('\n')[0];
        },
        ParsePerfSteps(content) {
            if (!content) return [];
            var lines = content.split('\n');
            var steps = [];
            var inSteps = false;
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (line === '── 分步耗时 ──') { inSteps = true; continue; }
                if (!inSteps) continue;
                var match = line.match(/^(.+?):\s*(\d+)ms/);
                if (match) {
                    steps.push({ name: match[1].trim(), ms: parseInt(match[2]) });
                }
            }
            // 计算百分比和级别
            var maxMs = 1;
            for (var j = 0; j < steps.length; j++) {
                if (steps[j].ms > maxMs) maxMs = steps[j].ms;
            }
            for (var k = 0; k < steps.length; k++) {
                steps[k].percent = Math.max(2, Math.round(steps[k].ms / maxMs * 100));
                steps[k].level = steps[k].ms >= 3000 ? 'perf-danger' : steps[k].ms >= 1000 ? 'perf-warn' : 'perf-ok';
            }
            return steps;
        },

        // ========== 通用 ==========
        GetLevelTag(level) {
            var map = {
                0: { text: '调试', type: 'info' },
                1: { text: '信息', type: '' },
                2: { text: '警告', type: 'warning' },
                3: { text: '错误', type: 'danger' },
                4: { text: '严重', type: 'danger' }
            };
            return map[level] || { text: level != null ? 'L' + level : '-', type: 'info' };
        },
        FormatTimer(ms) {
            if (ms == null) return "-";
            if (ms >= 1000) return (ms / 1000).toFixed(2) + "s";
            return ms + "ms";
        },
        FormatParams(paramStr) {
            if (!paramStr) return '-';
            try {
                var obj = JSON.parse(paramStr);
                if (typeof obj === 'object' && obj !== null) {
                    return Object.entries(obj).map(function(entry) { return entry[0] + ' = ' + entry[1]; }).join('\n');
                }
                return JSON.stringify(obj, null, 2);
            } catch (e) {
                return paramStr;
            }
        },
        FormatJson(str) {
            if (!str) return str;
            try {
                return JSON.stringify(JSON.parse(str), null, 2);
            } catch (e) {
                return str;
            }
        },
        CopyText(text) {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text).then(() => {
                    this.$message.success('已复制到剪贴板');
                });
            } else {
                var textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                this.$message.success('已复制到剪贴板');
            }
        },
        OnTabChange(tab) {
            if (tab === 'docker' && this.DockerLogs.length === 0) {
                this.GetDockerLogs();
            }
        },

        // ========== 系统日志 ==========
        QuickFilter(type) {
            this.SearchModel.Type = type;
            this.GetSysLog(true);
        },
        OpenDetail(row) {
            this.DetailModel = row;
            this.ShowDetail = true;
        },
        ResetSearch() {
            this.SearchModel = {
                Keyword: "",
                Type: "",
                Level: undefined,
                Month: new Date().Format("yyyyMM")
            };
            this.GetSysLog(true);
            this.GetLogTypes();
        },
        OnMonthChange() {
            this.GetSysLog(true);
            this.GetLogTypes();
        },
        ToggleAutoRefresh(val) {
            if (val) {
                this.autoRefreshTimer = setInterval(() => {
                    this.GetSysLog(false);
                }, 5000);
            } else {
                if (this.autoRefreshTimer) {
                    clearInterval(this.autoRefreshTimer);
                    this.autoRefreshTimer = null;
                }
            }
        },
        SysLogCurrentChange(val) {
            this.SysLogPageIndex = val;
            this.GetSysLog();
        },
        SysLogSizeChange(val) {
            this.SysLogPageSize = val;
            this.SysLogPageIndex = 1;
            this.GetSysLog(true);
        },
        GetLogTypes() {
            var self = this;
            self.DiyCommon.Post(
                "/api/syslog/GetLogTypes",
                { _SearchMonth: self.SearchModel.Month },
                function (result) {
                    if (result && result.Code === 1 && result.Data) {
                        self.LogTypeList = result.Data;
                    }
                }
            );
        },
        GetSysLog(initPageIndex) {
            var self = this;
            if (initPageIndex === true) {
                self.SysLogPageIndex = 1;
            }
            self.tableLoading = true;
            self.DiyCommon.Post(
                "/api/syslog/GetSysLog",
                {
                    _PageSize: self.SysLogPageSize,
                    _PageIndex: self.SysLogPageIndex,
                    _Keyword: self.SearchModel.Keyword,
                    _SearchMonth: self.SearchModel.Month,
                    Level: self.SearchModel.Level,
                    Type: self.SearchModel.Type
                },
                function (result) {
                    self.tableLoading = false;
                    if (self.DiyCommon.Result(result)) {
                        result.Data.forEach(function (item) {
                            item.CreateTime = new Date(item.CreateTime).AddTime("H", 8).Format("yyyy-MM-dd HH:mm:ss");
                        });
                        self.SysLogList = result.Data;
                        self.SysLogCount = result.DataCount;
                    }
                }
            );
            // 统计卡片：搜索条件变化时（含自动刷新）更新，分页翻页不触发
            if (initPageIndex !== undefined) {
                self.GetSysLogStats();
            }
        },
        // 获取5类统计（1次请求代替原来5次），支持关键词过滤
        GetSysLogStats() {
            var self = this;
            self.DiyCommon.Post(
                "/api/syslog/GetSysLogStats",
                {
                    _SearchMonth: self.SearchModel.Month,
                    _Keyword: self.SearchModel.Keyword
                },
                function (result) {
                    if (result && result.Code === 1 && result.Data) {
                        self.StatsError = result.Data.Error || 0;
                        self.StatsWarn = result.Data.Warn || 0;
                        self.StatsSlowSQL = result.Data.SlowSQL || 0;
                        self.StatsSlowExec = result.Data.SlowExec || 0;
                        self.StatsException = result.Data.Exception || 0;
                    }
                }
            );
        },

        // ========== Docker日志 ==========
        ToggleDockerAutoRefresh(val) {
            if (val) {
                this.dockerAutoRefreshTimer = setInterval(() => {
                    this.GetDockerLogs();
                }, 5000);
            } else {
                if (this.dockerAutoRefreshTimer) {
                    clearInterval(this.dockerAutoRefreshTimer);
                    this.dockerAutoRefreshTimer = null;
                }
            }
        },
        GetDockerLogs() {
            var self = this;
            self.dockerLoading = true;
            self.DiyCommon.Post(
                "/api/systemmonitor/GetAppLogs",
                {
                    Lines: self.DockerModel.Lines
                },
                function (result) {
                    self.dockerLoading = false;
                    if (result && result.Code === 1 && result.Data) {
                        self.DockerLogs = result.Data;
                        // 自动滚动到底部
                        self.$nextTick(function() {
                            var el = self.$refs.dockerTerminal;
                            if (el) el.scrollTop = el.scrollHeight;
                        });
                    } else {
                        self.DockerLogs = [];
                        if (result && result.Msg) {
                            self.$message.warning(result.Msg);
                        }
                    }
                }
            );
        },
        getDockerLineClass(line) {
            if (!line) return '';
            var lower = line.toLowerCase();
            if (lower.includes('error') || lower.includes('exception') || lower.includes('❌') || lower.includes('fail')) return 'docker-line--error';
            if (lower.includes('warn') || lower.includes('⚠️') || lower.includes('警告')) return 'docker-line--warn';
            if (lower.includes('microi')) return 'docker-line--info';
            return '';
        },
        highlightKeyword(line) {
            if (!line || !this.DockerModel.Keyword) return this.escapeHtml(line);
            var escaped = this.escapeHtml(line);
            var kw = this.escapeHtml(this.DockerModel.Keyword);
            var regex = new RegExp('(' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
            return escaped.replace(regex, '<mark class="docker-highlight">$1</mark>');
        },
        escapeHtml(text) {
            if (!text) return '';
            var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };
            return text.replace(/[&<>"']/g, function(ch) { return map[ch]; });
        }
    }
};
</script>

<style scoped>
.sys-log-page {
    padding: 0px;
    background-color: var(--el-bg-color-page, #f5f7fa);
    min-height: calc(100vh - 100px);
}
.main-tabs {
    border-radius: 8px;
    overflow: hidden;
}
.main-tabs :deep(.el-tabs__content) {
    padding: 12px;
}
.filter-card {
    margin-bottom: 12px;
    border-radius: 8px;
}
.filter-card :deep(.el-card__body) {
    padding: 5px 0px;
}
.filter-form{
    display: flex;
}
.filter-form .el-form-item {
    margin-bottom: 8px;
}
.stats-flex-row {
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
    flex-wrap: wrap;
}
.stats-card {
    flex: 1;
    min-width: 100px;
    border-radius: 8px;
    cursor: pointer;
    transition: box-shadow 0.2s, transform 0.15s;
    background: var(--el-bg-color, #fff);
    border: 1px solid var(--el-border-color-lighter, #e4e7ed);
    padding: 12px 14px;
}
.stats-card:hover {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(-1px);
}
.stats-card__inner {
    display: flex;
    align-items: center;
    gap: 10px;
}
.stats-card__label {
    font-size: 11px;
    color: #909399;
}
.stats-card__value {
    font-size: 20px;
    font-weight: 600;
    line-height: 1.2;
}
.stats-card__icon {
    font-size: 26px;
    opacity: 0.35;
    flex-shrink: 0;
}
.stats-card--total .stats-card__value { color: #409eff; }
.stats-card--total .stats-card__icon { color: #409eff; }
.stats-card--error .stats-card__value { color: #f56c6c; }
.stats-card--error .stats-card__icon { color: #f56c6c; }
.stats-card--warn .stats-card__value { color: #e6a23c; }
.stats-card--warn .stats-card__icon { color: #e6a23c; }
.stats-card--slowsql .stats-card__value { color: #e6a23c; }
.stats-card--slowsql .stats-card__icon { color: #e6a23c; }
.stats-card--slowexec .stats-card__value { color: #f89898; }
.stats-card--slowexec .stats-card__icon { color: #f89898; }
.stats-card--exception .stats-card__value { color: #f56c6c; }
.stats-card--exception .stats-card__icon { color: #f56c6c; }
.stats-card--info .stats-card__value { color: #67c23a; }
.stats-card--info .stats-card__icon { color: #67c23a; }

.table-card {
    border-radius: 8px;
}
.table-card :deep(.el-card__body) {
    padding: 0;
}
.table-card :deep(.el-table) {
    border-radius: 8px 8px 0 0;
}
.table-card :deep(.el-table .el-table__row) {
    cursor: pointer;
}
.log-title {
    font-weight: 500;
    color: #303133;
}
.log-content {
    color: #606266;
}
.log-time {
    font-size: 12px;
    color: #909399;
    font-family: "SF Mono", "Monaco", "Menlo", "Consolas", monospace;
}
.text-muted {
    color: #c0c4cc;
}
.pagination-wrap {
    padding: 12px 16px;
    display: flex;
    justify-content: flex-start;
}
.detail-content-block {
    max-height: 300px;
    overflow-y: auto;
    word-break: break-all;
    white-space: pre-wrap;
    line-height: 1.6;
    font-size: 13px;
    color: #606266;
}
.detail-code-block {
    background: #f5f7fa;
    border-radius: 4px;
    padding: 8px 12px;
    font-family: "SF Mono", "Monaco", "Menlo", "Consolas", monospace;
    font-size: 12px;
}
.detail-sql-block {
    background: #1e1e1e;
    color: #d4d4d4;
    border-radius: 6px;
    padding: 12px 14px;
    font-family: "SF Mono", "Monaco", "Menlo", "Consolas", monospace;
    font-size: 12px;
}
.detail-sql-block .el-button { color: #67c23a !important; }
.detail-code-text {
    font-family: "SF Mono", "Monaco", "Menlo", "Consolas", monospace;
    font-size: 13px;
}

/* 分步耗时样式 */
.detail-summary {
    margin-bottom: 12px;
    font-weight: 500;
    color: #303133;
}
.detail-perf-steps {
    background: #f5f7fa;
    border-radius: 6px;
    padding: 10px 14px;
}
.perf-steps-header {
    font-size: 12px;
    color: #909399;
    margin-bottom: 8px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
}
.perf-step-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
    font-size: 13px;
    font-family: "SF Mono", "Monaco", "Menlo", "Consolas", monospace;
}
.perf-step-name {
    min-width: 130px;
    max-width: 180px;
    color: #606266;
    text-align: right;
    flex-shrink: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.perf-step-bar-wrap {
    flex: 1;
    height: 16px;
    background: #e4e7ed;
    border-radius: 3px;
    overflow: hidden;
}
.perf-step-bar {
    display: block;
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s;
    min-width: 2px;
}
.perf-step-bar.perf-ok { background: #67c23a; }
.perf-step-bar.perf-warn { background: #e6a23c; }
.perf-step-bar.perf-danger { background: #f56c6c; }
.perf-step-ms {
    min-width: 70px;
    text-align: right;
    flex-shrink: 0;
    font-weight: 600;
}
.perf-step-ms.perf-ok { color: #67c23a; }
.perf-step-ms.perf-warn { color: #e6a23c; }
.perf-step-ms.perf-danger { color: #f56c6c; }

/* Docker终端样式 */
.docker-card {
    border-radius: 8px;
    overflow: hidden;
}
.docker-card :deep(.el-card__body) {
    padding: 0;
}
.docker-terminal {
    background: #1a1b26;
    color: #a9b1d6;
    font-family: "SF Mono", "Monaco", "Menlo", "Consolas", "Liberation Mono", monospace;
    font-size: 12px;
    line-height: 1.7;
    min-height: 400px;
    max-height: calc(100vh - 360px);
    overflow-y: auto;
    padding: 12px 0;
}
.docker-terminal::-webkit-scrollbar {
    width: 8px;
}
.docker-terminal::-webkit-scrollbar-track {
    background: #1a1b26;
}
.docker-terminal::-webkit-scrollbar-thumb {
    background: #414868;
    border-radius: 4px;
}
.docker-loading, .docker-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: #565f89;
    font-size: 13px;
    gap: 8px;
}
.docker-lines {
    padding: 0;
}
.docker-line {
    display: flex;
    padding: 0 16px 0 0;
    transition: background 0.15s;
}
.docker-line:hover {
    background: #24283b;
}
.docker-line-no {
    display: inline-block;
    width: 50px;
    min-width: 50px;
    text-align: right;
    padding-right: 12px;
    color: #3b4261;
    user-select: none;
    border-right: 1px solid #24283b;
    margin-right: 12px;
}
.docker-line-text {
    flex: 1;
    white-space: pre-wrap;
    word-break: break-all;
}
.docker-line--error { color: #f7768e; }
.docker-line--error .docker-line-no { color: #f7768e; }
.docker-line--warn { color: #e0af68; }
.docker-line--warn .docker-line-no { color: #e0af68; }
.docker-line--info { color: #7aa2f7; }
.docker-line--info .docker-line-no { color: #7aa2f7; }
:deep(.docker-highlight) {
    background: #e0af68;
    color: #1a1b26;
    padding: 1px 2px;
    border-radius: 2px;
}
.docker-footer {
    background: #24283b;
    color: #565f89;
    padding: 8px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    border-top: 1px solid #1a1b26;
}
.docker-page-btns {
    display: flex;
    align-items: center;
    gap: 8px;
}
.docker-page-info {
    color: #a9b1d6;
}
</style>
