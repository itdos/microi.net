/**
 * 数据源配置 Mixin
 * 用于 diy-select、diy-radio、diy-checkbox、diy-autocomplete 等需要数据源配置的组件
 */
import { Delete, Plus } from "@element-plus/icons-vue";

export default {
    components: {
        Delete,
        Plus
    },
    data() {
        return {
            // 配置弹窗相关
            configDialogVisible: false,
            // 基础配置表单（子组件可以扩展）
            configForm: {
                SelectLabel: '',
                SelectSaveFormat: 'Text',
                SelectSaveField: '',
                EnableSearch: false,
                DataSource: 'Data',
                Sql: '',
                DataSourceId: '',
                DataSourceApiEngineKey: '',
                DataSourceSqlRemote: false
            },
            // 普通数据列表
            configDataList: [],
            // KeyValue数据列表
            configKeyValueList: [],
            // 新增数据项
            newDataItem: '',
            newKeyValueItem: { key: '', value: '' },
            // 数据源列表
            SysDataSourceList: [],
            ApiEngineList: [],
            // Icons
            Delete,
            Plus
        };
    },
    methods: {
        /**
         * 初始化配置表单 - 通用部分
         */
        initDataSourceConfig() {
            var self = this;
            if (!self.field.Config) {
                self.field.Config = {};
            }
            self.configForm = {
                ...self.configForm,
                SelectLabel: self.field.Config.SelectLabel || '',
                SelectSaveFormat: self.field.Config.SelectSaveFormat || 'Text',
                SelectSaveField: self.field.Config.SelectSaveField || '',
                EnableSearch: self.field.Config.EnableSearch || false,
                DataSource: self.field.Config.DataSource || 'Data',
                Sql: self.field.Config.Sql || '',
                DataSourceId: self.field.Config.DataSourceId || '',
                DataSourceApiEngineKey: self.field.Config.DataSourceApiEngineKey || '',
                DataSourceSqlRemote: self.field.Config.DataSourceSqlRemote || false
            };
            
            // 初始化数据列表
            self.initDataLists();
            
            // 加载数据源列表和接口引擎列表
            self.loadSysDataSourceList();
            self.loadApiEngineList();
        },
        
        /**
         * 初始化数据列表
         */
        initDataLists() {
            var self = this;
            if (self.field.Data && Array.isArray(self.field.Data)) {
                if (self.configForm.DataSource === 'KeyValue') {
                    self.configKeyValueList = self.field.Data.map(item => {
                        if (typeof item === 'object' && item !== null) {
                            return { key: item.key || '', value: item.value || '' };
                        }
                        return { key: String(item), value: String(item) };
                    });
                    self.configDataList = [];
                } else if (self.configForm.DataSource === 'Data') {
                    self.configDataList = [...self.field.Data];
                    self.configKeyValueList = [];
                } else {
                    self.configDataList = [];
                    self.configKeyValueList = [];
                }
            } else {
                self.configDataList = [];
                self.configKeyValueList = [];
            }
            self.newDataItem = '';
            self.newKeyValueItem = { key: '', value: '' };
        },
        
        /**
         * 添加普通数据项
         */
        addDataItem() {
            var self = this;
            if (self.newDataItem.trim()) {
                self.configDataList.push(self.newDataItem.trim());
                self.newDataItem = '';
            }
        },
        
        /**
         * 添加KeyValue数据项
         */
        addKeyValueItem() {
            var self = this;
            if (self.newKeyValueItem.key.trim() || self.newKeyValueItem.value.trim()) {
                self.configKeyValueList.push({
                    key: self.newKeyValueItem.key.trim(),
                    value: self.newKeyValueItem.value.trim()
                });
                self.newKeyValueItem = { key: '', value: '' };
            }
        },
        
        /**
         * 保存数据源配置 - 通用部分
         */
        saveDataSourceConfig() {
            var self = this;
            // 保存配置到 field.Config
            self.field.Config.SelectLabel = self.configForm.SelectLabel;
            self.field.Config.SelectSaveFormat = self.configForm.SelectSaveFormat;
            self.field.Config.SelectSaveField = self.configForm.SelectSaveField;
            self.field.Config.EnableSearch = self.configForm.EnableSearch;
            self.field.Config.DataSource = self.configForm.DataSource;
            self.field.Config.Sql = self.configForm.Sql;
            self.field.Config.DataSourceId = self.configForm.DataSourceId;
            self.field.Config.DataSourceApiEngineKey = self.configForm.DataSourceApiEngineKey;
            self.field.Config.DataSourceSqlRemote = self.configForm.DataSourceSqlRemote;
            
            // 保存数据列表
            if (self.configForm.DataSource === 'Data') {
                self.field.Data = [...self.configDataList];
            } else if (self.configForm.DataSource === 'KeyValue') {
                // KeyValue 格式：设置显示字段为 value，存储字段为 key
                self.field.Config.SelectLabel = 'value';
                self.field.Config.SelectSaveField = 'key';
                self.field.Data = self.configKeyValueList.map(item => ({
                    key: item.key,
                    value: item.value
                }));
            }
        },
        
        /**
         * 加载数据源列表
         */
        loadSysDataSourceList() {
            var self = this;
            if (self.SysDataSourceList.length > 0) return;
            self.DiyCommon.GetDiyTableRow(
                { TableName: "Sys_DataSource" },
                function (data) {
                    if (data && data.Data) {
                        self.SysDataSourceList = data.Data;
                    }
                }
            );
        },
        
        /**
         * 加载接口引擎列表
         */
        loadApiEngineList() {
            var self = this;
            if (self.ApiEngineList.length > 0) return;
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
