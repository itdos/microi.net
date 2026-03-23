<template>
    <el-dialog
        draggable
        width="768px"
        :modal-append-to-body="true"
        v-model="visible"
        :close-on-click-modal="true"
        :modal="false"
        append-to-body
        :destroy-on-close="true"
    >
        <template #header>
            <fa-icon icon="fas fa-plus" />
            {{ $t("Msg.Import") }}
        </template>

        <el-upload
            class="upload-drag-style"
            :action="importApi"
            :data="uploadData"
            :headers="{ authorization: authHeader }"
            :show-file-list="false"
            :on-success="handleUploadSuccess"
            :before-upload="handleBeforeUpload"
            drag
        >
            <el-icon><Upload /></el-icon>
            <div class="el-upload__text">{{ $t("Msg.UploadDesc") }}</div>
            <template #tip>
                <div class="el-upload__tip">{{ $t('Msg.OnlyXlsFile') }}</div>
            </template>
        </el-upload>

        <div class="marginTop10 marginBottom10">
            <el-button :icon="RefreshRight" @click="getImportProgress">{{ $t('Msg.ViewProgress') }}</el-button>
            <el-tooltip v-if="isAdmin" class="item" effect="dark" :content="$t('Msg.Tips')" placement="top">
                <el-button :icon="Warning" @click="delImportProgress">{{ $t('Msg.ClearImportCache') }}</el-button>
            </el-tooltip>
        </div>
        <div class="">
            <div v-for="(m, index) in importStepList" :key="'importStep_' + index" style="color: red">
                {{ m }}
            </div>
            <div v-if="importStepList.length == 0" style="color: red">{{ $t('Msg.NoProgress') }}</div>
        </div>

        <template #footer>
            <el-button :icon="Close" @click="visible = false">{{ $t("Msg.Close") }}</el-button>
        </template>
    </el-dialog>
</template>

<script>
import { Upload } from "@element-plus/icons-vue";
import { RefreshRight } from "@element-plus/icons-vue";
import { DiyCommon } from "@/utils/diy.common";
import { DiyApi } from "@/utils/api.itdos";

export default {
    name: "DiyImportDialog",
    components: {
        Upload
    },
    props: {
        // 表ID
        tableId: {
            type: String,
            required: true
        },
        // 模块配置
        sysMenuModel: {
            type: Object,
            default: () => ({})
        },
        // 是否管理员
        isAdmin: {
            type: Boolean,
            default: false
        },
        // 子表外键字段名
        tableChildFkFieldName: {
            type: String,
            default: ""
        },
        // 父表数据
        fatherFormModelData: {
            type: Object,
            default: null
        },
        // 主表字段名
        primaryTableFieldName: {
            type: String,
            default: ""
        },
        // 子表行ID
        tableChildTableRowId: {
            type: String,
            default: ""
        }
    },
    emits: ["import-success"],
    data() {
        return {
            DiyCommon,
            DiyApi,
            visible: false,
            importStepList: [],
            _importStepTimer: null,
            RefreshRight,
        };
    },
    computed: {
        importApi() {
            if (this.sysMenuModel && 
                (this.sysMenuModel.ImportApi || (this.sysMenuModel.DiyConfig && this.sysMenuModel.DiyConfig.ImportApi))
            ) {
                return this.DiyCommon.RepalceUrlKey(this.sysMenuModel.ImportApi || this.sysMenuModel.DiyConfig.ImportApi);
            }
            return this.DiyCommon.GetApiBase() + "/api/DiyTable/ImportDiyTableRow";
        },
        importProgressApi() {
            if (this.sysMenuModel && this.sysMenuModel.DiyConfig && this.sysMenuModel.DiyConfig.ImportProgressApi) {
                return this.DiyCommon.RepalceUrlKey(this.sysMenuModel.DiyConfig.ImportProgressApi);
            }
            return this.DiyApi.GetImportDiyTableRowStep;
        },
        authHeader() {
            return "Bearer " + this.DiyCommon.Authorization();
        },
        uploadData() {
            var result = {
                Limit: true,
                TableId: this.tableId,
                UserId: this.$store?.getters?.GetCurrentUser?.Id || ""
            };
            if (this.tableChildFkFieldName) {
                result["_FormData"] = {};
                if (this.fatherFormModelData) {
                    if (this.primaryTableFieldName) {
                        result["_FormData"][this.tableChildFkFieldName] = this.fatherFormModelData[this.primaryTableFieldName];
                    } else {
                        result["_FormData"][this.tableChildFkFieldName] = this.fatherFormModelData.Id;
                    }
                } else {
                    result["_FormData"][this.tableChildFkFieldName] = this.tableChildTableRowId;
                }
                result["_FieldId"] = JSON.stringify(result["_FormData"]);
                delete result["_FormData"];
            }
            return result;
        }
    },
    methods: {
        show() {
            this.visible = true;
        },
        hide() {
            this.visible = false;
        },
        getImportProgress() {
            var self = this;
            self.DiyCommon.Post(
                self.importProgressApi,
                { TableId: self.tableId },
                function(result) {
                    if (self.DiyCommon.Result(result)) {
                        if (!self.DiyCommon.IsNull(result.Data) && Array.isArray(result.Data)) {
                            self.importStepList = result.Data;
                        }
                    }
                }
            );
        },
        delImportProgress() {
            var self = this;
            self.DiyCommon.Post(
                "/api/DiyTable/DelImportDiyTableRowStep",
                { TableId: self.tableId },
                function(result) {
                    if (self.DiyCommon.Result(result)) {
                        self.DiyCommon.Tips("操作成功！");
                        self.getImportProgress();
                    }
                }
            );
        },
        handleUploadSuccess(result) {
            var self = this;
            if (self.DiyCommon.Result(result)) {
                self.getImportProgress();
                self.$emit("import-success");
            }
        },
        handleBeforeUpload() {
            var self = this;
            self.DiyCommon.Tips("正在导入！请点击查看进度按钮！");
            if (self._importStepTimer) {
                clearTimeout(self._importStepTimer);
            }
            self._importStepTimer = setTimeout(function() {
                if (self && self.getImportProgress) {
                    self.getImportProgress();
                }
            }, 1000);
        }
    },
    beforeUnmount() {
        if (this._importStepTimer) {
            clearTimeout(this._importStepTimer);
            this._importStepTimer = null;
        }
    }
};
</script>
