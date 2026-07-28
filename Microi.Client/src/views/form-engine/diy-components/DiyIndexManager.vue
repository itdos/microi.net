<template>
    <el-dialog
        :model-value="visible"
        :title="$t('Msg.IndexManager')"
        width="min(960px, 94vw)"
        draggable
        align-center
        append-to-body
        @close="$emit('close')"
        :destroy-on-close="true"
    >
        <div class="index-manager">
            <!-- 索引创建建议 -->
            <el-alert
                type="info"
                :closable="false"
                show-icon
                style="margin-bottom: 12px;"
            >
                <template #title>
                    <span style="font-weight: 600">{{ $t('Msg.IndexCreateAdvice') }}</span>
                </template>
                <div style="line-height: 1.8; font-size: 12px;">
                    <div>• {{ $t('Msg.IndexAdviceSearchSortJoin') }}</div>
                    <div>• {{ $t('Msg.IndexAdviceAuto') }}</div>
                    <div>• {{ $t('Msg.IndexAdviceLeftPrefix') }}</div>
                    <div>• {{ $t('Msg.IndexAdviceLowSelectivity') }}</div>
                    <div>• {{ $t('Msg.IndexAdviceCountLimit') }}</div>
                </div>
            </el-alert>

            <!-- 当前索引列表 -->
            <el-card shadow="never" class="index-card">
                <template #header>
                    <div class="card-header">
                        <span>{{ $t('Msg.CurrentIndexes') }}</span>
                        <div>
                            <el-button type="success" size="small" :loading="autoLoading" @click="AutoGenerateIndexes" :disabled="!sysMenuId">{{ $t('Msg.AutoAddIndex') }}</el-button>
                            <el-button type="primary" size="small" :icon="Plus" @click="showAddForm = true">{{ $t('Msg.CreateIndex') }}</el-button>
                        </div>
                    </div>
                </template>
                <el-table v-loading="loading" :data="indexList" style="width: 100%" stripe border size="small" class="diy-table">
                    <el-table-column prop="Key_name" :label="$t('Msg.IndexName')" min-width="180" show-overflow-tooltip />
                    <el-table-column prop="Column_name" :label="$t('Msg.Field')" min-width="140" show-overflow-tooltip />
                    <el-table-column :label="$t('Msg.Unique')" width="80" align="center">
                        <template #default="scope">
                            <el-tag v-if="scope.row.IsUnique === true || scope.row.Non_unique == 0 || scope.row.Non_unique === '0'" size="small" type="success" effect="plain">{{ $t('Msg.Yes') }}</el-tag>
                            <el-tag v-else size="small" type="info" effect="plain">{{ $t('Msg.No') }}</el-tag>
                        </template>
                    </el-table-column>
                    <el-table-column prop="Index_type" :label="$t('Msg.IndexType')" width="120" align="center" />
                    <el-table-column :label="$t('Msg.Action')" width="100" align="center" fixed="right">
                        <template #default="scope">
                            <el-popconfirm
                                v-if="!IsPrimaryIndex(scope.row)"
                                :title="$t('Msg.ConfirmDeleteIndex') + ' ' + scope.row.Key_name + '?'"
                                :confirm-button-text="$t('Msg.Delete')"
                                :cancel-button-text="$t('Msg.Cancel')"
                                @confirm="DropIndex(scope.row)"
                            >
                                <template #reference>
                                    <el-button link type="danger" size="small">{{ $t('Msg.Delete') }}</el-button>
                                </template>
                            </el-popconfirm>
                            <el-tag v-else size="small" type="info" effect="plain">{{ $t('Msg.PrimaryKey') }}</el-tag>
                        </template>
                    </el-table-column>
                </el-table>
            </el-card>

            <!-- 新建索引表单 -->
            <el-card v-if="showAddForm" shadow="never" class="index-card" style="margin-top: 12px;">
                <template #header>
                    <div class="card-header">
                        <span>{{ $t('Msg.CreateIndex') }}</span>
                        <el-button size="small" @click="showAddForm = false">{{ $t('Msg.Cancel') }}</el-button>
                    </div>
                </template>
                <el-form :model="addForm" label-width="100px" @submit.prevent>
                    <el-form-item :label="$t('Msg.SelectField')">
                        <el-select v-model="addForm.Columns" multiple filterable :placeholder="$t('Msg.SelectIndexFields')" style="width: 100%">
                            <el-option v-for="field in fieldOptions" :key="field.Name" :label="`${field.Name} (${field.Label || field.Name})`" :value="field.Name" />
                        </el-select>
                    </el-form-item>
                    <el-form-item :label="$t('Msg.IndexName')">
                        <el-input v-model="addForm.IndexName" maxlength="64" show-word-limit :placeholder="$t('Msg.IndexNamePlaceholder')" style="width: 100%" />
                    </el-form-item>
                    <el-form-item :label="$t('Msg.UniqueIndex')">
                        <el-switch v-model="addForm.IndexUnique" />
                    </el-form-item>
                    <el-form-item>
                        <el-button type="primary" :loading="addLoading" @click="AddIndex">{{ $t('Msg.CreateIndex') }}</el-button>
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
            var result = (this.diyFieldList || []).filter(f => f.Name && f.Name !== "Id").map(f => ({ ...f }));
            ["OsClient", "CreateTime", "UpdateTime", "CreateUser"].forEach(name => {
                if (!result.some(field => String(field.Name).toLowerCase() === name.toLowerCase())) {
                    result.push({ Name: name, Label: name });
                }
            });
            return result;
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
        IsPrimaryIndex(row) {
            return row && (
                row.IsPrimary === true
                || row.Is_primary === 1
                || row.Is_primary === "1"
                || String(row.Key_name || "").toUpperCase() === "PRIMARY"
            );
        },
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
                self.DiyCommon.Tips(self.$t("Msg.EnterIndexName"), false);
                return;
            }
            if (!self.addForm.Columns || self.addForm.Columns.length === 0) {
                self.DiyCommon.Tips(self.$t("Msg.SelectAtLeastOneField"), false);
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
                        self.DiyCommon.Tips(self.$t("Msg.IndexCreateSuccess"), true);
                        self.showAddForm = false;
                        self.addForm = { IndexName: "", Columns: [], IndexUnique: false };
                        self.GetIndexes();
                    } else {
                        self.DiyCommon.Tips(result.Msg || self.$t("Msg.CreateFailed"), false);
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
                        self.DiyCommon.Tips(self.$t("Msg.IndexDeleteSuccess"), true);
                        self.GetIndexes();
                    } else {
                        self.DiyCommon.Tips(result.Msg || self.$t("Msg.DeleteFailed"), false);
                    }
                }
            );
        },
        AutoGenerateIndexes() {
            var self = this;
            if (!self.sysMenuId) {
                self.DiyCommon.Tips(self.$t("Msg.ModuleInfoNotFound"), false);
                return;
            }
            self.autoLoading = true;
            self.DiyCommon.Post(
                "/api/FormEngine/AutoGenerateIndexes",
                { _SysMenuId: self.sysMenuId },
                function (result) {
                    self.autoLoading = false;
                    if (result && result.Code === 1) {
                        var msg = result.Msg || self.$t("Msg.IndexDone");
                        if (result.Data) {
                            var details = [];
                            if (result.Data.Created && result.Data.Created.length > 0) details.push(self.$t("Msg.IndexCreated") + ": " + result.Data.Created.join(", "));
                            if (result.Data.Skipped && result.Data.Skipped.length > 0) details.push(self.$t("Msg.IndexSkipped") + ": " + result.Data.Skipped.join(", "));
                            if (result.Data.Failed && result.Data.Failed.length > 0) details.push(self.$t("Msg.IndexFailed") + ": " + result.Data.Failed.join(", "));
                            if (details.length > 0) msg += "\n" + details.join("\n");
                        }
                        self.DiyCommon.Tips(msg, true);
                        self.GetIndexes();
                    } else {
                        self.DiyCommon.Tips(result.Msg || self.$t("Msg.AutoAddIndexFailed"), false);
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
