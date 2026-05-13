<template>
    <div class="state-machine-list">
        <div class="header">
            <el-input v-model="keyword" placeholder="搜索状态机名称/编码" style="width: 300px;" clearable
                @keyup.enter="loadList" />
            <el-button type="primary" @click="loadList" style="margin-left: 8px;">
                <el-icon><Search /></el-icon> 搜索
            </el-button>
            <el-button type="success" @click="openDesigner('')" style="margin-left: 8px;">
                <el-icon><Plus /></el-icon> 新建状态机
            </el-button>
            <el-button @click="loadList" style="margin-left: 8px;">
                <el-icon><Refresh /></el-icon> 刷新
            </el-button>
        </div>

        <el-table :data="list" v-loading="loading" border style="margin-top: 12px;">
            <el-table-column prop="Name" label="名称" min-width="180" />
            <el-table-column prop="Code" label="编码" width="160" />
            <el-table-column prop="TableName" label="绑定表" width="160" />
            <el-table-column prop="StatusField" label="状态字段" width="120" />
            <el-table-column prop="InitialState" label="初始状态" width="120" />
            <el-table-column prop="Description" label="说明" min-width="180" show-overflow-tooltip />
            <el-table-column label="状态" width="80">
                <template #default="{ row }">
                    <el-tag :type="row.Status === 1 ? 'success' : 'info'">
                        {{ row.Status === 1 ? '启用' : '禁用' }}
                    </el-tag>
                </template>
            </el-table-column>
            <el-table-column prop="UpdateTime" label="更新时间" width="160" />
            <el-table-column label="操作" width="240" fixed="right">
                <template #default="{ row }">
                    <el-button size="small" type="primary" link @click="openDesigner(row.Id)">设计</el-button>
                    <el-button size="small" type="info" link @click="showHistory(row)">历史</el-button>
                    <el-popconfirm title="确认删除？" @confirm="onDelete(row)">
                        <template #reference>
                            <el-button size="small" type="danger" link>删除</el-button>
                        </template>
                    </el-popconfirm>
                </template>
            </el-table-column>
        </el-table>

        <el-dialog v-model="historyVisible" title="状态流转历史" width="900px">
            <el-table :data="historyList" border>
                <el-table-column prop="RowId" label="业务记录ID" width="220" />
                <el-table-column prop="FromState" label="原状态" width="120" />
                <el-table-column prop="ToState" label="新状态" width="120" />
                <el-table-column prop="OperatorName" label="操作人" width="120" />
                <el-table-column prop="Comment" label="备注" min-width="160" show-overflow-tooltip />
                <el-table-column prop="CreateTime" label="时间" width="160" />
            </el-table>
        </el-dialog>
    </div>
</template>

<script>
import { Search, Plus, Refresh } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { StateMachineApi } from "./api.js";

export default {
    name: "StateMachineList",
    components: { Search, Plus, Refresh },
    data() {
        return { keyword: "", list: [], loading: false, historyVisible: false, historyList: [] };
    },
    mounted() { this.loadList(); },
    methods: {
        async loadList() {
            this.loading = true;
            try {
                const res = await StateMachineApi.list(this.keyword);
                if (res.Code === 1) this.list = Array.isArray(res.Data) ? res.Data : [];
                else ElMessage.error(res.Msg || "加载失败");
            } catch (e) { ElMessage.error("加载异常: " + (e?.message || e)); }
            finally { this.loading = false; }
        },
        openDesigner(id) { this.$router.push("/state-machine/designer/" + (id || "new")); },
        async onDelete(row) {
            const res = await StateMachineApi.delete(row.Id);
            if (res.Code === 1) { ElMessage.success("已删除"); this.loadList(); }
            else ElMessage.error(res.Msg || "删除失败");
        },
        async showHistory(row) {
            const res = await StateMachineApi.history({ StateMachineId: row.Id, PageSize: 100 });
            if (res.Code === 1) { this.historyList = Array.isArray(res.Data) ? res.Data : []; this.historyVisible = true; }
            else ElMessage.error(res.Msg || "加载失败");
        }
    }
};
</script>

<style scoped>
.state-machine-list { padding: 16px; }
.header { display: flex; align-items: center; }
</style>
