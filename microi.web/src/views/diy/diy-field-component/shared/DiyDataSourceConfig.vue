<template>
    <div class="diy-datasource-config">
        <el-divider content-position="left">显示与存储</el-divider>
        
        <el-form-item label="显示对应字段">
            <el-input :model-value="config.SelectLabel" @update:model-value="updateConfig('SelectLabel', $event)" placeholder="如：Name、label" />
            <div class="form-item-tip">数据源中用于显示的字段名</div>
        </el-form-item>
        
        <el-form-item v-if="showSaveFormat" label="存储形式">
            <el-radio-group :model-value="config.SelectSaveFormat" @update:model-value="updateConfig('SelectSaveFormat', $event)">
                <el-radio value="Text">字段</el-radio>
                <el-radio value="Json">Json</el-radio>
            </el-radio-group>
            <div class="form-item-tip">
                <div>字段：只会将【存储对应字段】的值存入数据库</div>
                <div>Json：会将每个选项的所有字段值存入数据库，且【存储对应字段】设置无效</div>
            </div>
        </el-form-item>
        
        <el-form-item label="存储对应字段">
            <el-input :model-value="config.SelectSaveField" @update:model-value="updateConfig('SelectSaveField', $event)" placeholder="如：Id、value" />
            <div class="form-item-tip">数据源中用于存储到数据库的字段名</div>
        </el-form-item>
        
        <el-form-item v-if="showEnableSearch" label="开启搜索">
            <el-switch :model-value="config.EnableSearch" @update:model-value="updateConfig('EnableSearch', $event)" active-color="#ff6c04" inactive-color="#ccc" />
        </el-form-item>

        <el-divider content-position="left">数据源</el-divider>
        
        <el-form-item label="数据源类型">
            <el-radio-group :model-value="config.DataSource" @update:model-value="updateConfig('DataSource', $event)">
                <el-radio value="Data">普通数据</el-radio>
                <el-radio v-if="showKeyValue" value="KeyValue">Key-Value</el-radio>
                <el-radio value="Sql">Sql数据源</el-radio>
                <el-radio value="DataSource">数据源引擎</el-radio>
                <el-radio value="ApiEngine">接口引擎</el-radio>
            </el-radio-group>
        </el-form-item>

        <!-- 普通数据 -->
        <el-form-item v-if="config.DataSource == 'Data'" label="普通数据">
            <div class="data-list">
                <el-input
                    v-for="(item, i) in dataList"
                    :key="'data_' + i"
                    :model-value="dataList[i]"
                    @update:model-value="updateDataListItem(i, $event)"
                    style="margin-bottom: 5px"
                >
                    <template #append>
                        <el-button @click="removeDataListItem(i)" :icon="Delete" />
                    </template>
                </el-input>
                <!-- <el-input v-model="newDataItem" placeholder="输入新选项" @keyup.enter="addDataItem">
                    <template #append>
                        <el-button @click="addDataItem" :icon="Plus" />
                    </template>
                </el-input> -->
                <el-button @click="addDataItem" :icon="Plus">
                    添加数据
                </el-button>
                <el-button v-if="dataList.length > 0" type="danger" @click="clearDataList">
                    清空全部
                </el-button>
            </div>
        </el-form-item>

        <!-- Key-Value 数据 -->
        <el-form-item v-if="config.DataSource == 'KeyValue'" label="Key-Value数据">
            <div class="form-item-tip" style="margin-bottom: 10px">显示Value，存储Key</div>
            <div class="keyvalue-list">
                <div v-for="(item, i) in keyValueList" :key="'kv_' + i" class="keyvalue-item">
                    <el-input :model-value="item.Key" @update:model-value="updateKeyValueItem(i, 'Key', $event)" placeholder="Key(存储值)" style="width: 45%" />
                    <span style="margin: 0 5px">:</span>
                    <el-input :model-value="item.Value" @update:model-value="updateKeyValueItem(i, 'Value', $event)" placeholder="Value(显示值)" style="width: 45%" />
                    <el-button @click="removeKeyValueItem(i)" :icon="Delete" link type="danger" style="margin-left: 5px" />
                </div>
                <!-- <div class="keyvalue-item">
                    <el-input v-model="newKeyValueItem.Key" placeholder="Key(存储值)" style="width: 45%" @keyup.enter="addKeyValueItem" />
                    <span style="margin: 0 5px">:</span>
                    <el-input v-model="newKeyValueItem.Value" placeholder="Value(显示值)" style="width: 45%" @keyup.enter="addKeyValueItem" />
                </div> -->
                <el-button @click="addKeyValueItem" :icon="Plus" type="primary">
                    添加数据
                </el-button>
                <el-button v-if="keyValueList.length > 0" type="danger" @click="clearKeyValueList">
                    清空全部
                </el-button>
            </div>
        </el-form-item>

        <!-- SQL数据源 -->
        <el-form-item v-if="config.DataSource == 'Sql'" label="SQL数据源">
            <el-input type="textarea" :rows="4" :model-value="config.Sql" @update:model-value="updateConfig('Sql', $event)" placeholder="select Id,Name from TableName where Name like '%$Keyword$%' limit 0,20" />
            <div class="form-item-tip">支持$Keyword$参数用于远程搜索，支持$CurrentUser.Id$等系统参数</div>
        </el-form-item>

        <!-- 数据源引擎 -->
        <el-form-item v-if="config.DataSource == 'DataSource'" label="请选择数据源">
            <el-select :model-value="config.DataSourceId" @update:model-value="updateConfig('DataSourceId', $event)" clearable filterable value-key="Id" placeholder="搜索数据源" style="width: 100%">
                <el-option v-for="item in SysDataSourceList" :key="item.Id" :label="item.DataSourceName" :value="item.Id">
                    <span style="float: left">{{ item.DataSourceName }}</span>
                    <span style="float: right; color: #8492a6; font-size: 13px">{{ item.DataSourceKey }}</span>
                </el-option>
            </el-select>
        </el-form-item>

        <!-- 接口引擎 -->
        <el-form-item v-if="config.DataSource == 'ApiEngine'" label="请选择接口引擎">
            <el-select :model-value="config.DataSourceApiEngineKey" @update:model-value="updateConfig('DataSourceApiEngineKey', $event)" clearable filterable value-key="ApiEngineKey" placeholder="搜索接口引擎" style="width: 100%">
                <el-option v-for="item in ApiEngineList" :key="item.ApiEngineKey" :label="item.ApiName" :value="item.ApiEngineKey">
                    <span style="float: left">{{ item.ApiName }}</span>
                    <span style="float: right; color: #8492a6; font-size: 13px">{{ item.ApiEngineKey }}</span>
                </el-option>
            </el-select>
        </el-form-item>

        <!-- 远程搜索 -->
        <el-form-item v-if="config.DataSource == 'Sql' || config.DataSource == 'DataSource' || config.DataSource == 'ApiEngine'" label="远程搜索">
            <el-switch :model-value="config.DataSourceSqlRemote" @update:model-value="updateConfig('DataSourceSqlRemote', $event)" active-color="#ff6c04" inactive-color="#ccc" />
            <div class="form-item-tip">当数据量较大时开启，需在SQL中配置$Keyword$参数和limit</div>
        </el-form-item>
    </div>
</template>

<script>
import { Delete, Plus } from "@element-plus/icons-vue";

export default {
    name: 'DiyDataSourceConfig',
    components: {
        Delete,
        Plus
    },
    props: {
        // 配置对象
        config: {
            type: Object,
            default: () => ({
                SelectLabel: '',
                SelectSaveField: '',
                SelectSaveFormat: 'Text',
                EnableSearch: false,
                DataSource: 'Data',
                Sql: '',
                DataSourceId: '',
                DataSourceApiEngineKey: '',
                DataSourceSqlRemote: false
            })
        },
        // 普通数据列表
        dataList: {
            type: Array,
            default: () => []
        },
        // KeyValue数据列表
        keyValueList: {
            type: Array,
            default: () => []
        },
        // 是否显示存储形式选项（Select/Radio 显示，Checkbox 不显示）
        showSaveFormat: {
            type: Boolean,
            default: false
        },
        // 是否显示开启搜索选项（Select 显示）
        showEnableSearch: {
            type: Boolean,
            default: false
        },
        // 是否显示 KeyValue 选项（Autocomplete 不需要）
        showKeyValue: {
            type: Boolean,
            default: true
        }
    },
    emits: ['update:config', 'update:dataList', 'update:keyValueList'],
    data() {
        return {
            SysDataSourceList: [],
            ApiEngineList: [],
            newDataItem: '',
            newKeyValueItem: { Key: '', Value: '' },
            Delete,
            Plus
        };
    },
    mounted() {
        this.loadSysDataSourceList();
        this.loadApiEngineList();
    },
    methods: {
        updateConfig(key, value) {
            this.$emit('update:config', { ...this.config, [key]: value });
        },
        
        // 普通数据列表操作
        updateDataListItem(index, value) {
            const list = [...this.dataList];
            list[index] = value;
            this.$emit('update:dataList', list);
        },
        removeDataListItem(index) {
            const list = [...this.dataList];
            list.splice(index, 1);
            this.$emit('update:dataList', list);
        },
        addDataItem() {
            this.$emit('update:dataList', [...this.dataList, '']);
            // if (this.newDataItem.trim()) {
            //     this.$emit('update:dataList', [...this.dataList, this.newDataItem.trim()]);
            //     this.newDataItem = '';
            // }
        },
        clearDataList() {
            this.$emit('update:dataList', []);
        },
        
        // KeyValue列表操作
        updateKeyValueItem(index, key, value) {
            const list = [...this.keyValueList];
            list[index] = { ...list[index], [key]: value };
            this.$emit('update:keyValueList', list);
        },
        removeKeyValueItem(index) {
            const list = [...this.keyValueList];
            list.splice(index, 1);
            this.$emit('update:keyValueList', list);
        },
        addKeyValueItem() {
            this.$emit('update:keyValueList', [...this.keyValueList, { Key: '', Value: '' }]);
            // if (this.newKeyValueItem.Key.trim() || this.newKeyValueItem.Value.trim()) {
            //     this.$emit('update:keyValueList', [...this.keyValueList, { ...this.newKeyValueItem }]);
            //     this.newKeyValueItem = { Key: '', Value: '' };
            // }
        },
        clearKeyValueList() {
            this.$emit('update:keyValueList', []);
        },
        
        loadSysDataSourceList() {
            var self = this;
            self.DiyCommon.GetDiyTableRow(
                { TableName: "Sys_DataSource" },
                function (data) {
                    if (data && data.Data) {
                        self.SysDataSourceList = data.Data;
                    }
                }
            );
        },
        loadApiEngineList() {
            var self = this;
            self.DiyCommon.GetDiyTableRow(
                {
                    TableName: "sys_apiengine",
                    _SelectFields: ["Id", "ApiName", "ApiEngineKey", "ApiAddress", "IsEnable"]
                },
                function (data) {
                    if (data && data.Data) {
                        self.ApiEngineList = data.Data;
                    }
                }
            );
        }
    }
};
</script>

<style lang="scss" scoped>
.diy-datasource-config {
    .form-item-tip {
        font-size: 12px;
        color: #909399;
        line-height: 1.5;
        margin-top: 4px;
    }
    .data-list {
        width: 100%;
    }
    .keyvalue-list {
        width: 100%;
    }
    .keyvalue-item {
        display: flex;
        align-items: center;
        margin-bottom: 5px;
    }
}
</style>
