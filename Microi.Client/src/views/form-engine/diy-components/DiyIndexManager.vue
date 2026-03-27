<template>
    <el-dialog :model-value="visible" title="索引管理" width="900px" draggable @close="$emit('close')" :destroy-on-close="true">
        <div class="index-manager">
            <!-- 索引创建建议 -->
            <el-alert
                type="info"
                :closable="false"
                show-icon
                style="margin-bottom: 12px;"
            >
                <template #title>
                    <span style="font-weight: 600">索引创建建议</span>
                </template>
                <div style="line-height: 1.8; font-size: 12px;">
                    <div>• 为常用于 <b>搜索条件（WHERE）</b>、<b>排序（ORDER BY）</b>、<b>关联查询（JOIN）</b> 的字段创建索引</div>
                    <div>• 可通过"自动添加索引"功能，自动为搜索字段和外键字段创建索引</div>
                    <div>• 联合索引遵循<b>最左前缀原则</b>，将区分度高的字段放在前面</div>
                    <div>• 避免对频繁更新的字段、低区分度字段（如状态、性别）单独建索引</div>
                    <div>• 单表索引数量建议不超过 <b>5~6 个</b>，过多索引会影响写入性能</div>
                </div>
            </el-alert>

            <!-- 当前索引列表 -->
            <el-card shadow="never" class="index-card">
                <template #header>
                    <div class="card-header">
                        <span>当前索引</span>
                        <div>
                            <el-button type="success" size="small" :loading="autoLoading" @click="AutoGenerateIndexes" :disabled="!sysMenuId">自动添加索引</el-button>
                            <el-button type="primary" size="small" :icon="Plus" @click="showAddForm = true">新建索引</el-button>
                        </div>
                    </div>
                </template>
                <el-table v-loading="loading" :data="indexList" style="width: 100%" stripe border size="small" class="diy-table">
                    <el-table-column prop="Key_name" label="索引名称" min-width="180" show-overflow-tooltip />
                    <el-table-column prop="Column_name" label="字段" min-width="140" show-overflow-tooltip />
                    <el-table-column label="唯一" width="80" align="center">
                        <template #default="scope">
                            <el-tag v-if="scope.row.Non_unique == 0 || scope.row.Non_unique === '0'" size="small" type="success" effect="plain">是</el-tag>
                            <el-tag v-else size="small" type="info" effect="plain">否</el-tag>
                        </template>
                    </el-table-column>
                    <el-table-column prop="Index_type" label="索引类型" width="120" align="center" />
                    <el-table-column label="操作" width="100" align="center" fixed="right">
                        <template #default="scope">
                            <el-popconfirm
                                v-if="scope.row.Key_name !== 'PRIMARY'"
                                :title="`确认删除索引 ${scope.row.Key_name}？`"
                                confirm-button-text="删除"
                                cancel-button-text="取消"
                                @confirm="DropIndex(scope.row)"
                            >
                                <template #reference>
                                    <el-button link type="danger" size="small">删除</el-button>
                                </template>
                            </el-popconfirm>
                            <el-tag v-else size="small" type="info" effect="plain">主键</el-tag>
                        </template>
                    </el-table-column>
                </el-table>
            </el-card>

            <!-- 新建索引表单 -->
            <el-card v-if="showAddForm" shadow="never" class="index-card" style="margin-top: 12px;">
                <template #header>
                    <div class="card-header">
                        <span>新建索引</span>
                        <el-button size="small" @click="showAddForm = false">取消</el-button>
                    </div>
                </template>
                <el-form :model="addForm" label-width="100px" @submit.prevent>
                    <el-form-item label="选择字段">
                        <el-select v-model="addForm.Columns" multiple filterable placeholder="请先选择要添加索引的字段" style="width: 100%">
                            <el-option v-for="field in fieldOptions" :key="field.Name" :label="`${field.Name} (${field.Label || field.Name})`" :value="field.Name" />
                        </el-select>
                    </el-form-item>
                    <el-form-item label="索引名称">
                        <el-input v-model="addForm.IndexName" placeholder="选择字段后自动生成，也可手动修改" style="width: 100%" />
                    </el-form-item>
                    <el-form-item label="唯一索引">
                        <el-switch v-model="addForm.IndexUnique" />
                    </el-form-item>
                    <el-form-item>
                        <el-button type="primary" :loading="addLoading" @click="AddIndex">创建索引</el-button>
                    </el-form-item>
                </el-form>
            </el-card>
        </div>
    </el-dialog>
</template>

<script>
import { Plus } from "@element-plus/icons-vue";

export default {
    name: "DiyIndexManager",
    components: { Plus },
    props: {
        visible: { type: Boolean, default: false },
        tableName: { type: String, default: "" },
        diyFieldList: { type: Array, default: () => [] },
        sysMenuId: { type: String, default: "" }
    },
    emits: ["close"],
    data() {
        return {
            loading: false,
            addLoading: false,
            autoLoading: false,
            showAddForm: false,
            indexList: [],
            addForm: {
                IndexName: "",
                Columns: [],
                IndexUnique: false
            }
        };
    },
    computed: {
        fieldOptions() {
            if (!this.diyFieldList || this.diyFieldList.length === 0) return [];
            return this.diyFieldList.filter(f => f.Name && f.Name !== "Id");
        }
    },
    mounted() {
        this.GetIndexes();
    },
    watch: {
        "addForm.Columns"(val) {
            if (val && val.length > 0) {
                this.addForm.IndexName = "idx_" + this.tableName.toLowerCase() + "_" + val.join("_").toLowerCase();
            } else {
                this.addForm.IndexName = "";
            }
        }
    },
    methods: {
        GetIndexes() {
            var self = this;
            if (!self.tableName) return;
            self.loading = true;
            self.DiyCommon.Post(
                "/api/FormEngine/GetTableIndexes",
                { TableName: self.tableName },
                function (result) {
                    self.loading = false;
                    if (self.DiyCommon.Result(result)) {
                        self.indexList = result.Data || [];
                    }
                }
            );
        },
        AddIndex() {
            var self = this;
            if (!self.addForm.IndexName) {
                self.DiyCommon.Tips("请输入索引名称", false);
                return;
            }
            if (!self.addForm.Columns || self.addForm.Columns.length === 0) {
                self.DiyCommon.Tips("请选择至少一个字段", false);
                return;
            }
            self.addLoading = true;
            self.DiyCommon.Post(
                "/api/FormEngine/AddTableIndex",
                {
                    TableName: self.tableName,
                    IndexName: self.addForm.IndexName,
                    IndexColumns: self.addForm.Columns.join(","),
                    IndexUnique: self.addForm.IndexUnique
                },
                function (result) {
                    self.addLoading = false;
                    if (result && result.Code === 1) {
                        self.DiyCommon.Tips("索引创建成功", true);
                        self.showAddForm = false;
                        self.addForm = { IndexName: "", Columns: [], IndexUnique: false };
                        self.GetIndexes();
                    } else {
                        self.DiyCommon.Tips(result.Msg || "创建失败", false);
                    }
                }
            );
        },
        DropIndex(row) {
            var self = this;
            self.loading = true;
            self.DiyCommon.Post(
                "/api/FormEngine/DropTableIndex",
                { TableName: self.tableName, IndexName: row.Key_name },
                function (result) {
                    self.loading = false;
                    if (result && result.Code === 1) {
                        self.DiyCommon.Tips("索引删除成功", true);
                        self.GetIndexes();
                    } else {
                        self.DiyCommon.Tips(result.Msg || "删除失败", false);
                    }
                }
            );
        },
        AutoGenerateIndexes() {
            var self = this;
            if (!self.sysMenuId) {
                self.DiyCommon.Tips("未找到模块信息", false);
                return;
            }
            self.autoLoading = true;
            self.DiyCommon.Post(
                "/api/FormEngine/AutoGenerateIndexes",
                { _SysMenuId: self.sysMenuId },
                function (result) {
                    self.autoLoading = false;
                    if (result && result.Code === 1) {
                        var msg = result.Msg || "完成";
                        if (result.Data) {
                            var details = [];
                            if (result.Data.Created && result.Data.Created.length > 0) details.push("新建: " + result.Data.Created.join(", "));
                            if (result.Data.Skipped && result.Data.Skipped.length > 0) details.push("跳过: " + result.Data.Skipped.join(", "));
                            if (result.Data.Failed && result.Data.Failed.length > 0) details.push("失败: " + result.Data.Failed.join(", "));
                            if (details.length > 0) msg += "\n" + details.join("\n");
                        }
                        self.DiyCommon.Tips(msg, true);
                        self.GetIndexes();
                    } else {
                        self.DiyCommon.Tips(result.Msg || "自动生成索引失败", false);
                    }
                }
            );
        }
    }
};
</script>

<style scoped>
.index-manager {
    max-height: 65vh;
    overflow-y: auto;
}
.index-card :deep(.el-card__header) {
    padding: 12px 16px;
    background: #fafafa;
}
.card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 500;
}
</style>
