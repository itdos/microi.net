<template>
    <div class="blueprint-list">
        <div class="header">
            <el-input v-model="keyword" placeholder="搜索蓝图名称/编码/描述" style="width: 300px;" clearable
                @keyup.enter="loadList" />
            <el-button type="primary" @click="loadList" style="margin-left: 8px;">
                <el-icon><Search /></el-icon> 搜索
            </el-button>
            <el-button type="success" @click="openDesigner('')" style="margin-left: 8px;">
                <el-icon><Plus /></el-icon> 新建蓝图
            </el-button>
            <el-button @click="loadList" style="margin-left: 8px;">
                <el-icon><Refresh /></el-icon> 刷新
            </el-button>
        </div>

        <el-table :data="list" v-loading="loading" border style="margin-top: 12px;">
            <el-table-column prop="Name" label="名称" min-width="180" />
            <el-table-column prop="Code" label="编码" width="160" />
            <el-table-column prop="Description" label="描述" min-width="200" show-overflow-tooltip />
            <el-table-column prop="Version" label="版本" width="80" />
            <el-table-column label="状态" width="80">
                <template #default="{ row }">
                    <el-tag :type="row.Status === 1 ? 'success' : 'info'">
                        {{ row.Status === 1 ? '启用' : '禁用' }}
                    </el-tag>
                </template>
            </el-table-column>
            <el-table-column prop="UpdateUserName" label="更新人" width="120" />
            <el-table-column prop="UpdateTime" label="更新时间" width="160" />
            <el-table-column label="操作" width="280" fixed="right">
                <template #default="{ row }">
                    <el-button size="small" type="primary" link @click="openDesigner(row.Id)">设计</el-button>
                    <el-button size="small" type="warning" link @click="onValidate(row)">验证</el-button>
                    <el-button size="small" type="info" link @click="onCopyId(row)">复制ID</el-button>
                    <el-popconfirm title="确认删除该蓝图？" @confirm="onDelete(row)">
                        <template #reference>
                            <el-button size="small" type="danger" link>删除</el-button>
                        </template>
                    </el-popconfirm>
                </template>
            </el-table-column>
        </el-table>

        <el-dialog v-model="validateVisible" title="蓝图验证结果" width="640px">
            <div v-if="validateResult">
                <el-alert v-if="validateResult.Passed" type="success"
                    :title="`✓ 验证通过（共检查 ${validateResult.CheckedRefs} 个引用）`" :closable="false" show-icon />
                <el-alert v-else type="error"
                    :title="`✗ 发现 ${validateResult.errors?.length || 0} 个错误，${validateResult.warnings?.length || 0} 个警告`"
                    :closable="false" show-icon />

                <h4 v-if="validateResult.errors?.length" style="margin-top: 16px; color: #f56c6c;">错误：</h4>
                <ul v-if="validateResult.errors?.length">
                    <li v-for="(e, i) in validateResult.errors" :key="i" style="color: #f56c6c;">{{ e }}</li>
                </ul>
                <h4 v-if="validateResult.warnings?.length" style="margin-top: 16px; color: #e6a23c;">警告：</h4>
                <ul v-if="validateResult.warnings?.length">
                    <li v-for="(w, i) in validateResult.warnings" :key="i" style="color: #e6a23c;">{{ w }}</li>
                </ul>
            </div>
        </el-dialog>
    </div>
</template>

<script>
import { Search, Plus, Refresh } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { BlueprintApi } from "./api.js";

export default {
    name: "BlueprintList",
    components: { Search, Plus, Refresh },
    data() {
        return {
            keyword: "",
            list: [],
            loading: false,
            validateVisible: false,
            validateResult: null
        };
    },
    mounted() {
        this.loadList();
    },
    methods: {
        async loadList() {
            this.loading = true;
            try {
                const res = await BlueprintApi.list(this.keyword);
                if (res.Code === 1) {
                    this.list = Array.isArray(res.Data) ? res.Data : [];
                } else {
                    ElMessage.error(res.Msg || "加载失败");
                }
            } catch (e) {
                ElMessage.error("加载异常: " + (e?.message || e));
            } finally {
                this.loading = false;
            }
        },
        openDesigner(id) {
            this.$router.push({ path: `/blueprint/designer/${id || 'new'}` });
        },
        async onDelete(row) {
            const res = await BlueprintApi.delete(row.Id);
            if (res.Code === 1) {
                ElMessage.success("删除成功");
                this.loadList();
            } else {
                ElMessage.error(res.Msg || "删除失败");
            }
        },
        async onValidate(row) {
            const res = await BlueprintApi.validate(row.Id);
            if (res.Code === 1) {
                this.validateResult = res.Data;
                this.validateVisible = true;
            } else {
                ElMessage.error(res.Msg || "验证失败");
            }
        },
        onCopyId(row) {
            navigator.clipboard?.writeText(row.Id);
            ElMessage.success("已复制 ID: " + row.Id);
        }
    }
};
</script>

<style scoped>
.blueprint-list {
    padding: 16px;
}

.header {
    display: flex;
    align-items: center;
}
</style>
