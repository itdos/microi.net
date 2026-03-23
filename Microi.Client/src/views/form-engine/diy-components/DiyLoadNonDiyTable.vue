<template>
    <div class="diy-load-nondiy-table">
        <el-alert 
            class="marginBottom15" 
            :title="'选择现有的非DIY数据库表，将其加载到表单引擎中进行管理'" 
            type="info" 
            :closable="false" 
            show-icon
        />
        
        <el-form :model="formModel" label-width="120px">
            <el-form-item :label="'选择非DIY表'">
                <el-select 
                    v-model="formModel.DbRealTableName" 
                    filterable 
                    :placeholder="'请选择非DIY表'"
                    style="width: 100%"
                    :disabled="btnLoading"
                >
                    <el-option 
                        v-for="item in NotDiyTableList" 
                        :key="item" 
                        :label="item" 
                        :value="item"
                    />
                </el-select>
            </el-form-item>
            
            <el-form-item v-if="!DiyCommon.IsNull(formModel.DbRealTableName)">
                <el-button 
                    type="primary" 
                    :icon="Plus" 
                    :loading="btnLoading" 
                    @click="LoadNotDiyTable()"
                >
                    {{ $t("Msg.Load") }}
                </el-button>
                <el-button 
                    :icon="RefreshLeft" 
                    @click="GetNotDiyTable()"
                    :disabled="btnLoading"
                >
                    {{ $t("Msg.Refresh") }}
                </el-button>
            </el-form-item>
        </el-form>
        
        <!-- 已加载的表列表（可选） -->
        <template v-if="showLoadedTables && LoadedTableList.length > 0">
            <el-divider />
            <div class="loaded-tables-section">
                <h4>{{ '最近加载的表' }}</h4>
                <el-tag 
                    v-for="(table, index) in LoadedTableList" 
                    :key="index"
                    class="marginRight10 marginBottom10"
                    type="success"
                >
                    {{ table }}
                </el-tag>
            </div>
        </template>
    </div>
</template>

<script>
import { DiyApi } from "@/utils/microi.net.import";

export default {
    name: "DiyLoadNonDiyTable",
    components: {},
    props: {
        // 是否显示已加载的表列表
        showLoadedTables: {
            type: Boolean,
            default: false
        },
        // 传入的附加数据
        DataAppend: {
            type: Object,
            default: () => ({})
        }
    },
    emits: ['success', 'error', 'close'],
    data() {
        return {
            btnLoading: false,
            formModel: {
                DbRealTableName: ""
            },
            NotDiyTableList: [],
            LoadedTableList: []
        };
    },
    computed: {},
    mounted() {
        this.GetNotDiyTable();
    },
    methods: {
        /**
         * 获取非DIY表列表
         */
        GetNotDiyTable() {
            var self = this;
            self.DiyCommon.Post(DiyApi.GetNotDiyTable, {}, function (result) {
                if (result.Code == 1) {
                    self.NotDiyTableList = result.Data || [];
                }
            });
        },
        
        /**
         * 加载选中的非DIY表
         */
        LoadNotDiyTable() {
            var self = this;
            
            if (self.DiyCommon.IsNull(self.formModel.DbRealTableName)) {
                self.DiyCommon.Tips("请选择非DIY表", "warning");
                return;
            }
            
            self.btnLoading = true;
            self.DiyCommon.Post(
                DiyApi.LoadNotDiyTable,
                {
                    Name: self.formModel.DbRealTableName
                },
                function (result) {
                    if (self.DiyCommon.Result(result)) {
                        // 记录已加载的表
                        if (!self.LoadedTableList.includes(self.formModel.DbRealTableName)) {
                            self.LoadedTableList.unshift(self.formModel.DbRealTableName);
                            // 只保留最近5个
                            if (self.LoadedTableList.length > 5) {
                                self.LoadedTableList = self.LoadedTableList.slice(0, 5);
                            }
                        }
                        
                        // 触发成功事件
                        self.$emit('success', {
                            tableName: self.formModel.DbRealTableName,
                            data: result.Data
                        });
                        
                        // 清空选择
                        self.formModel.DbRealTableName = "";
                        
                        // 刷新非DIY表列表
                        self.GetNotDiyTable();
                        
                        self.DiyCommon.Tips("加载成功");
                    } else {
                        self.$emit('error', result);
                    }
                    self.btnLoading = false;
                },
                function (error) {
                    self.$emit('error', error);
                    self.btnLoading = false;
                }
            );
        },
        
        /**
         * 关闭组件
         */
        close() {
            this.$emit('close');
        }
    }
};
</script>

<style lang="scss" scoped>
.diy-load-nondiy-table {
    padding: 20px;
    
    .loaded-tables-section {
        h4 {
            margin-bottom: 10px;
            color: #606266;
            font-size: 14px;
            font-weight: 500;
        }
    }
    
    :deep(.el-form-item) {
        margin-bottom: 20px;
    }
}
</style>
