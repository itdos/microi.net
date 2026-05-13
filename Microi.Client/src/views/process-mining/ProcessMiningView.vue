<template>
    <div class="pm-view">
        <el-card>
            <template #header>过程挖掘 / 流程分析</template>
            <el-form :inline="true">
                <el-form-item label="工作流设计ID">
                    <el-input v-model="flowDesignId" placeholder="WF_Design.Id（必填）" style="width: 320px;" />
                </el-form-item>
                <el-form-item label="开始时间">
                    <el-date-picker v-model="startTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" />
                </el-form-item>
                <el-form-item label="结束时间">
                    <el-date-picker v-model="endTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" />
                </el-form-item>
                <el-form-item label="SLA(分钟)">
                    <el-input-number v-model="slaMinutes" :min="1" :max="100000" />
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="analyze" :loading="loading">分析</el-button>
                </el-form-item>
            </el-form>
        </el-card>

        <el-row :gutter="12" style="margin-top: 12px;" v-if="overview">
            <el-col :span="6"><el-statistic title="工作流实例数" :value="overview.TotalInstances || 0" /></el-col>
            <el-col :span="6"><el-statistic title="活动记录数" :value="overview.TotalActivities || 0" /></el-col>
            <el-col :span="6"><el-statistic title="驳回次数" :value="overview.RejectCount || 0" /></el-col>
            <el-col :span="6"><el-statistic title="完成数" :value="overview.CompletedCount || 0" /></el-col>
        </el-row>

        <el-row :gutter="12" style="margin-top: 12px;">
            <el-col :span="12">
                <el-card>
                    <template #header>节点活动统计 (Activity Map)</template>
                    <el-table :data="analysis" border max-height="400">
                        <el-table-column prop="NodeName" label="节点" min-width="140" />
                        <el-table-column prop="ActivityCount" label="活动次数" width="100" />
                        <el-table-column prop="AvgDurationMinutes" label="平均耗时(分钟)" width="140">
                            <template #default="{ row }">{{ formatNum(row.AvgDurationMinutes) }}</template>
                        </el-table-column>
                        <el-table-column prop="MaxDurationMinutes" label="最长(分钟)" width="120">
                            <template #default="{ row }">{{ formatNum(row.MaxDurationMinutes) }}</template>
                        </el-table-column>
                        <el-table-column prop="RejectCount" label="驳回数" width="80" />
                    </el-table>
                </el-card>
            </el-col>
            <el-col :span="12">
                <el-card>
                    <template #header>热点路径 (Hot Paths)</template>
                    <el-table :data="hotPaths" border max-height="400">
                        <el-table-column prop="FromNode" label="起点" min-width="120" />
                        <el-table-column prop="ToNode" label="终点" min-width="120" />
                        <el-table-column prop="TransitionCount" label="次数" width="80" />
                    </el-table>
                </el-card>
            </el-col>
        </el-row>

        <el-row :gutter="12" style="margin-top: 12px;">
            <el-col :span="12">
                <el-card>
                    <template #header>瓶颈节点 (Bottlenecks)</template>
                    <el-table :data="bottlenecks" border max-height="400">
                        <el-table-column prop="NodeName" label="节点" min-width="140" />
                        <el-table-column prop="AvgDurationMinutes" label="平均(分钟)" width="120">
                            <template #default="{ row }">{{ formatNum(row.AvgDurationMinutes) }}</template>
                        </el-table-column>
                        <el-table-column prop="ActivityCount" label="次数" width="80" />
                    </el-table>
                </el-card>
            </el-col>
            <el-col :span="12">
                <el-card>
                    <template #header>SLA 违规 (> {{ slaMinutes }} 分钟)</template>
                    <el-table :data="slaViolations" border max-height="400">
                        <el-table-column prop="NodeName" label="节点" min-width="140" />
                        <el-table-column prop="DurationMinutes" label="耗时(分钟)" width="120">
                            <template #default="{ row }">{{ formatNum(row.DurationMinutes) }}</template>
                        </el-table-column>
                        <el-table-column prop="DoUserName" label="处理人" width="120" />
                        <el-table-column prop="CreateTime" label="时间" width="160" />
                    </el-table>
                </el-card>
            </el-col>
        </el-row>
    </div>
</template>

<script>
import { ElMessage } from "element-plus";
import { PmApi } from "./api.js";

export default {
    name: "ProcessMiningView",
    data() {
        return {
            loading: false,
            flowDesignId: "",
            startTime: "",
            endTime: "",
            slaMinutes: 60,
            overview: null,
            analysis: [],
            hotPaths: [],
            bottlenecks: [],
            slaViolations: []
        };
    },
    methods: {
        formatNum(v) { if (v == null) return "-"; return Number(v).toFixed(2); },
        async analyze() {
            if (!this.flowDesignId) { ElMessage.warning("请输入工作流设计ID"); return; }
            this.loading = true;
            const p = { FlowDesignId: this.flowDesignId, StartTime: this.startTime, EndTime: this.endTime };
            try {
                const [ov, an, hp, bn, sv] = await Promise.all([
                    PmApi.overview(p),
                    PmApi.analyze(p),
                    PmApi.hotPaths(p),
                    PmApi.bottlenecks({ ...p, TopN: 10 }),
                    PmApi.slaViolations({ ...p, SlaMinutes: this.slaMinutes, PageSize: 100 })
                ]);
                this.overview = ov.Code === 1 ? ov.Data : null;
                this.analysis = an.Code === 1 && Array.isArray(an.Data) ? an.Data : [];
                this.hotPaths = hp.Code === 1 && Array.isArray(hp.Data) ? hp.Data : [];
                this.bottlenecks = bn.Code === 1 && Array.isArray(bn.Data) ? bn.Data : [];
                this.slaViolations = sv.Code === 1 && Array.isArray(sv.Data) ? sv.Data : [];
            } catch (e) { ElMessage.error("分析失败: " + (e?.message || e)); }
            finally { this.loading = false; }
        }
    }
};
</script>

<style scoped>
.pm-view { padding: 16px; }
</style>
