<template>
    <div class="flow-list">
        <div class="header">
            <el-input v-model="keyword" placeholder="搜索流程名称/编码" style="width: 300px;" clearable
                @keyup.enter="loadList" />
            <el-button type="primary" @click="loadList" style="margin-left: 8px;">
                <el-icon><Search /></el-icon> 搜索
            </el-button>
            <el-button type="success" @click="openDesigner('')" style="margin-left: 8px;">
                <el-icon><Plus /></el-icon> 新建流程
            </el-button>
            <el-button @click="loadList" style="margin-left: 8px;">
                <el-icon><Refresh /></el-icon> 刷新
            </el-button>
        </div>

        <el-table :data="list" v-loading="loading" border style="margin-top: 12px;">
            <el-table-column prop="Name" label="名称" min-width="180" />
            <el-table-column prop="Code" label="编码" width="160" />
            <el-table-column prop="TriggerType" label="触发类型" width="120" />
            <el-table-column prop="Description" label="说明" min-width="180" show-overflow-tooltip />
            <el-table-column label="状态" width="80">
                <template #default="{ row }">
                    <el-tag :type="row.Status === 1 ? 'success' : 'info'">
                        {{ row.Status === 1 ? '启用' : '禁用' }}
                    </el-tag>
                </template>
            </el-table-column>
            <el-table-column prop="UpdateTime" label="更新时间" width="160" />
            <el-table-column label="操作" width="320" fixed="right">
                <template #default="{ row }">
                    <el-button size="small" type="primary" link @click="openDesigner(row.Id)">设计</el-button>
                    <el-button size="small" type="success" link @click="runFlow(row)">执行</el-button>
                    <el-button size="small" type="info" link @click="showRuns(row)">运行记录</el-button>
                    <el-popconfirm title="确认删除？" @confirm="onDelete(row)">
                        <template #reference>
                            <el-button size="small" type="danger" link>删除</el-button>
                        </template>
                    </el-popconfirm>
                </template>
            </el-table-column>
        </el-table>

        <el-dialog v-model="runsVisible" title="运行记录" width="1000px">
            <el-table :data="runs" border>
                <el-table-column prop="Id" label="ID" width="220" show-overflow-tooltip />
                <el-table-column prop="TriggerSource" label="触发源" width="120" />
                <el-table-column label="状态" width="100">
                    <template #default="{ row }">
                        <el-tag :type="statusType(row.Status)">{{ row.Status }}</el-tag>
                    </template>
                </el-table-column>
                <el-table-column prop="DurationMs" label="耗时(ms)" width="100" />
                <el-table-column prop="StartTime" label="开始时间" width="160" />
                <el-table-column prop="ErrorMsg" label="错误" min-width="200" show-overflow-tooltip />
                <el-table-column label="操作" width="100">
                    <template #default="{ row }">
                        <el-button size="small" link @click="viewRun(row.Id)">详情</el-button>
                    </template>
                </el-table-column>
            </el-table>
        </el-dialog>

        <el-dialog v-model="runDetailVisible" title="执行详情" width="900px">
            <el-descriptions v-if="runDetail" :column="2" border>
                <el-descriptions-item label="ID">{{ runDetail.Id }}</el-descriptions-item>
                <el-descriptions-item label="状态">{{ runDetail.Status }}</el-descriptions-item>
                <el-descriptions-item label="开始">{{ runDetail.StartTime }}</el-descriptions-item>
                <el-descriptions-item label="结束">{{ runDetail.EndTime }}</el-descriptions-item>
                <el-descriptions-item label="耗时(ms)">{{ runDetail.DurationMs }}</el-descriptions-item>
                <el-descriptions-item label="触发源">{{ runDetail.TriggerSource }}</el-descriptions-item>
            </el-descriptions>
            <h4 style="margin-top:12px;">输入</h4>
            <pre class="json-box">{{ runDetail?.InputData }}</pre>
            <h4>输出</h4>
            <pre class="json-box">{{ runDetail?.OutputData }}</pre>
            <h4>步骤日志</h4>
            <pre class="json-box">{{ runDetail?.StepLog }}</pre>
        </el-dialog>
    </div>
</template>

<script>
import { Search, Plus, Refresh } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { FlowApi } from "./api.js";

export default {
    name: "FlowList",
    components: { Search, Plus, Refresh },
    data() {
        return { keyword: "", list: [], loading: false, runsVisible: false, runs: [], runDetailVisible: false, runDetail: null };
    },
    mounted() { this.loadList(); },
    methods: {
        async loadList() {
            this.loading = true;
            try {
                const res = await FlowApi.list(this.keyword);
                if (res.Code === 1) this.list = Array.isArray(res.Data) ? res.Data : [];
                else ElMessage.error(res.Msg || "加载失败");
            } catch (e) { ElMessage.error("加载异常: " + (e?.message || e)); }
            finally { this.loading = false; }
        },
        openDesigner(id) { this.$router.push("/flow-engine/designer/" + (id || "new")); },
        async onDelete(row) {
            const res = await FlowApi.delete(row.Id);
            if (res.Code === 1) { ElMessage.success("已删除"); this.loadList(); }
            else ElMessage.error(res.Msg || "删除失败");
        },
        async runFlow(row) {
            const res = await FlowApi.run(row.Id);
            if (res.Code === 1) ElMessage.success("已执行：" + (res.Data?.Status || "成功"));
            else ElMessage.error(res.Msg || "执行失败");
        },
        async showRuns(row) {
            const res = await FlowApi.runs({ FlowId: row.Id, PageSize: 50 });
            if (res.Code === 1) { this.runs = Array.isArray(res.Data) ? res.Data : []; this.runsVisible = true; }
            else ElMessage.error(res.Msg || "加载失败");
        },
        async viewRun(id) {
            const res = await FlowApi.runDetail(id);
            if (res.Code === 1) { this.runDetail = res.Data; this.runDetailVisible = true; }
            else ElMessage.error(res.Msg || "加载失败");
        },
        statusType(s) { return s === "success" ? "success" : s === "failed" ? "danger" : s === "running" ? "warning" : "info"; }
    }
};
</script>

<style scoped>
.flow-list { padding: 16px; }
.header { display: flex; align-items: center; }
.json-box { background: #f5f7fa; padding: 8px; border-radius: 4px; max-height: 200px; overflow: auto; font-size: 12px; }
</style>
