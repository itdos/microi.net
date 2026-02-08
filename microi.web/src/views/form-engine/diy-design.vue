<template>
    <div class="diy-design-container">
        <div style="display: flex; align-items: center; gap: 10px; justify-content: flex-start; padding:10px;border-bottom: solid 1px #ccc;">
            <el-button :loading="SaveAllDiyFieldLoding" type="primary" :icon="UploadFilled" @click="SaveAllDiyField">{{ $t("Msg.Save") }}</el-button>
            <el-select v-if="DiyFieldList && DiyFieldList.length > 0"
                v-model="CurrentDiyFieldModel"
                @change="SelectFieldChange"
                :filter-method="SelectFieldFilterMethod"
                clearable
                filterable
                value-key="Id"
                style="width: 250px"
                placeholder="搜索字段"
            >
                <el-option v-for="item in DiyFieldListClone" :key="'CurrentDiyFieldModel_' + item.Id" :label="item.Label" :value="item">
                    <span style="float: left">{{ item.Label }}</span>
                    <span style="float: right; color: #8492a6; font-size: 14px">{{ item.Name }}</span>
                </el-option>
            </el-select>
            <el-button v-if="CurrentDiyFieldModel && !DiyCommon.IsNull(CurrentDiyFieldModel.Id)" :loading="SaveAllDiyFieldLoding" type="danger" :icon="Delete" @click="CallbackDeleteField(CurrentDiyFieldModel)">
                {{ $t("Msg.Del") }}{{ $t("Msg.Field") }}
            </el-button>
            <el-select v-if="PageType != 'Report'" v-model="CurrentErrorFieldModel" @change="SelectErrorFieldChange" clearable filterable value-key="Name" style="width: 250px" placeholder="异常字段修复">
                <el-option v-for="(item, index) in ExceptionFieldList" :key="'ExceptionFieldList_' + index" :label="item.Name" :value="item">
                    <span style="float: left">{{ (item.Label || item.Name) + `(${item.Name})` }}</span>
                    <span style="float: right; color: #8492a6; font-size: 14px">{{ item.ErrorType == "DbField" ? "Diy缺少" : "数据库缺少" }}</span>
                </el-option>
            </el-select>
            <el-button v-if="CurrentErrorFieldModel && !DiyCommon.IsNull(CurrentErrorFieldModel.Name)" :loading="SaveAllDiyFieldLoding" :icon="Check" type="primary" @click="RepairField">
                {{ "修复" }}
            </el-button>
            <el-select v-if="PageType != 'Report'" v-model="CurrentDeletedFieldModel" clearable filterable value-key="Name" style="width: 250px" placeholder="字段回收站恢复">
                <el-option v-for="(item, index) in DeletedDiyField" :key="'DeletedDiyField_' + index" :label="item.Name" :value="item">
                    <span style="float: left">{{ item.Label + `(${item.Name})` }}</span>
                    <span style="float: right; color: #8492a6; font-size: 14px">{{ "已删除" }}</span>
                </el-option>
            </el-select>
            <el-button v-if="CurrentDeletedFieldModel && !DiyCommon.IsNull(CurrentDeletedFieldModel.Name)" :loading="SaveAllDiyFieldLoding" :icon="Check" type="primary" @click="RecoverDiyField">
                {{ "恢复" }}
            </el-button>
        </div>
        <el-container class="field-container">
            <el-aside class="aside aside-left" width="250px">
                <el-row id="row-field" :gutter="10" class="row-field">
                    <el-col :span="24">
                        <el-divider content-position="center">基础控件</el-divider>
                    </el-col>
                    <draggable
                        class="draggable-components-wrapper"
                        :list="DiyComponentListBaseListen"
                        :group="{ name: 'field-components', pull: 'clone', put: false }"
                        :clone="cloneComponent"
                        :sort="false"
                        :move="onComponentMove"
                        item-key="Control"
                    >
                        <template #item="{ element }">
                            <el-col :key="element.Control" :data-field="element.Control" class="field-drag" :span="12">
                                <el-tag type="info"><fa-icon :class="element.Icon" />{{ element.Name }}</el-tag>
                            </el-col>
                        </template>
                    </draggable>

                    <el-col :span="24">
                        <el-divider content-position="center">高级控件</el-divider>
                    </el-col>

                    <draggable
                        class="draggable-components-wrapper"
                        :list="DiyComponentListAdvancedListen"
                        :group="{ name: 'field-components', pull: 'clone', put: false }"
                        :clone="cloneComponent"
                        :sort="false"
                        :move="onComponentMove"
                        item-key="Control"
                    >
                        <template #item="{ element }">
                            <el-col :key="element.Control" :data-field="element.Control" class="field-drag" :span="12">
                                <el-tag type="info"><fa-icon :class="element.Icon" />{{ element.Name }}</el-tag>
                            </el-col>
                        </template>
                    </draggable>
                </el-row>
            </el-aside>
            <el-main class="center-main" :style="{ width: FormClient == 'Mobile' ? '375px' : 'auto'}">
                <!-- <el-tabs v-model="FormClient" @tab-click="SwitchFormClient">
                    <el-tab-pane label="PC" name="PC">
                        <template #label
                            ><span
                                ><el-icon><Monitor /></el-icon> PC端预览</span
                            ></template
                        >
                    </el-tab-pane>
                    <el-tab-pane label="Mobile" name="Mobile">
                        <template #label
                            ><span
                                ><el-icon><MobilePhone /></el-icon> 移动端预览</span
                            ></template
                        >
                    </el-tab-pane>
                </el-tabs> -->
                <DiyForm
                    v-if="TableId"
                    ref="fieldForm"
                    :LoadMode="'Design'"
                    :TableId="TableId"
                    :TableRowId="TableRowId"
                    :ColSpan="FormClient == 'Mobile' ? 24 : 0"
                    @CallbackSelectField="CallbackSelectField"
                    @CallbackSetDiyTableModel="CallbackSetDiyTableModel"
                    @CallbackGetDiyField="CallbackGetDiyField"
                    @CallbackFieldAdd="onComponentAdd"
                    @CallbackFieldOrderChanged="onFieldOrderChanged"
                    @CallbackDuplicateField="CallbackDuplicateField"
                    @CallbackDeleteField="CallbackDeleteField"
                    @CallbackFieldWidthChanged="CallbackFieldWidthChanged"
                />
                <el-dialog draggable width="550px" :modal-append-to-body="false" v-model="ShowDiyTableEditor" append-to-body destroy-on-close :title="''">
                    <template #footer>
                        <el-button type="primary" :icon="Close">{{ $t("Msg.Close") }}({{ $t("Msg.AutoSave") }})</el-button>
                    </template>
                </el-dialog>
            </el-main>
            <el-aside width="320px" class="aside aside-right">
                <el-container>
                    <el-main class="right-main">
                        <el-tabs v-model="AsideRightActiveTab" :stretch="true" @tab-click="tabCLickAsideRight">
                            <el-tab-pane name="Field"  v-if="CurrentDiyFieldModel && CurrentDiyFieldModel.Id">
                                <template #label
                                    ><span><fa-icon class="fas fa-columns marginRight5" />字段属性</span></template
                                >
                                <div
                                    style="
                                        padding-left: 5px;
                                        padding-right: 5px;
                                        padding-bottom: 20px;
                                        width: 100%;
                                        height: 100%;
                                    "
                                >
                                    <DiyForm
                                        ref="diyform_diy_field"
                                        :LoadMode="''"
                                        :FormMode="'Edit'"
                                        :TableName="'diy_field'"
                                        :TableRowId="CurrentDiyFieldModel.Id"
                                        :ColSpan="24"
                                        :LabelWidth="'100px'"
                                        :LabelPosition="'top'"

                                        :FormData="CurrentDiyFieldModel"
                                        @CallbackForm="CallbackForm_Field"
                                        @CallbackFormValueChange="CallbackFormValueChange_DiyField"
                                    ></DiyForm>
                                </div>
                            </el-tab-pane>

                            <el-tab-pane name="Form">
                                <template #label
                                    ><span><fa-icon :class="'fa-wpforms'" />表单属性</span></template
                                >

                                <div v-if="CurrentDiyTableModel && CurrentDiyTableModel.Id"
                                    style="
                                        padding-left: 5px;
                                        padding-right: 5px;
                                        padding-bottom: 20px;
                                        width: 100%;
                                        height: 100%;
                                    "
                                >
                                    <DiyForm
                                        ref="diyform_diy_table"
                                        :LoadMode="''"
                                        :FormMode="'Edit'"
                                        :TableName="'diy_table'"
                                        :TableRowId="TableId"
                                        :ColSpan="24"
                                        :LabelWidth="'100px'"
                                        :LabelPosition="'top'"

                                        :FormData="CurrentDiyTableModel"
                                        @CallbackForm="CallbackForm_Table"
                                        @CallbackFormValueChange="CallbackFormValueChange_DiyTable"
                                    ></DiyForm>
                                </div>
                            </el-tab-pane>
                        </el-tabs>
                    </el-main>
                </el-container>
            </el-aside>
        </el-container>
        
        <!-- 共享的V8设计器，替代多个实例 -->
        <DiyV8Design
            v-show="false"
            ref="sharedV8Designer"
            v-if="DiyFieldList && DiyFieldList.length > 0"
            :fields="DiyFieldList"
            v-model:model="currentV8Model"
        ></DiyV8Design>
    </div>
</template>

<script>
import { computed } from "vue";
import _ from "underscore";
import draggable from "vuedraggable";
import { useDiyStore } from "@/pinia";
import DiyChildTableCallback from "./diy-components/diy-writebackChild.vue";
import DiyV8Design from "./diy-components/diy-v8design";
import lodash, { set } from "lodash";

export default {
    name: "DiyDesign",
    directives: {},
    components: {
        draggable,
        DiyV8Design,
        DiyChildTableCallback
    },
    setup() {
        const diyStore = useDiyStore();
        const SysConfig = computed(() => diyStore.SysConfig);
        return { diyStore, SysConfig };
    },
    computed: {
        DiyComponentListBaseListen: {
            get() {
                // 返回副本避免拖拽时修改原数组
                return _.where(this.DiyComponentList, {
                    Type: "Base"
                }).slice();
            }
        },
        DiyComponentListAdvancedListen: {
            get() {
                // 返回副本避免拖拽时修改原数组
                return _.where(this.DiyComponentList, {
                    Type: "Advanced"
                }).slice();
            }
        }
        // TabListListen : {
        //     get(){
        //         var self = this;
        //         var fieldList = self.$refs.fieldForm.DiyFieldList;
        //         var tabList = [];
        //         fieldList.forEach(element => {
        //             if (!self.DiyCommon.IsNull(element.Tab) && _.where(tabList, {value : element.Tab}).length == 0) {
        //                 tabList.push({value : element.Tab});
        //             }
        //         });
        //         return tabList;
        //     }
        // }
    },
    watch: {
        // 监听共享V8设计器的currentV8Model变化，同步回原始对象
        currentV8Model(newValue) {
            if (this.currentV8ModelPath) {
                try {
                    eval("this." + this.currentV8ModelPath + " = newValue");
                } catch (e) {
                    console.error('Failed to sync V8 model:', e);
                }
            }
        }
    },
    data() {
        return {
            // 共享V8设计器的当前编辑对象
            currentV8Model: '',
            currentV8ModelPath: '',
            PageType: "", //可以是Report
            DiyFieldListClone: [],
            DiyFieldList: [],
            CurrentErrorFieldModel: null,
            CurrentDeletedFieldModel: null,
            FormClient: "PC",
            sysMenuTreeProps: {
                children: "_Child",
                label: "Name", // this.Lang == 'cn' ? 'Name' : 'EnName'
                Enlabel: "EnName"
            },
            SysMenuList: [],
            CurrentV8Sign: "",
            CurrentV8Code: "",
            SaveAllDiyFieldLoding: false,
            DialogV8Code: "Code", // Explain
            cmOptions: {
                // 所有参数配置见：https://codemirror.net/doc/manual.html#config
                tabSize: 4,
                styleActiveLine: true,
                lineNumbers: true,
                line: true,
                foldGutter: true,
                styleSelectedText: true,
                mode: "text/javascript",
                // keyMap: "sublime",
                matchBrackets: true,
                showCursorWhenSelecting: true,
                // theme: 'base16-dark',
                extraKeys: {
                    Ctrl: "autocomplete"
                },
                hintOptions: {
                    completeSingle: false
                },
                lineWrapping: true // 自动换行
            },
            // ShowV8CodeEditor: false,
            ShowDiyTableEditor: false,
            CurrentDiyTableTabModel: {},
            CurrentDiyFieldModel: null,
            CurrentDiyTableModel: {},
            FormDiyTableModel: {},
            AsideRightActiveTab: "Form",
            FieldActiveTab: "none",
            DiyComponentList: [],
            TableId: "",
            TableRowId: "",
            SysRoleList: [],
            // SysMenuNeedConvertField: ['TableDiyFieldIds', 'SearchFieldIds', 'SortFieldIds', 'DiyConfig', 'StatisticsFields'],
            //'ImgUpload', 'FileUpload','Map',
            CantUptComponentList: [], //'DevComponent', 'TableChild', 'Divider'
            SysDataSourceList: [],
            ApiEngineList: [],
            ExceptionFieldList: [],
            DeletedDiyField: [],

            FieldTypeList: [
                {
                    value: "varchar(25)",
                    Description: "字符串，常用于存储短文字"
                },
                {
                    value: "varchar(50)",
                    Description: "字符串，常用于存储短文字"
                },
                {
                    value: "varchar(255)",
                    Description: "字符串，常用于存储几百字以内文字"
                },
                {
                    value: "varchar(36)",
                    Description: "GUID/UUID"
                },
                {
                    value: "mediumtext",
                    Description: "文本，用于存储几千、上万、无限文字"
                },
                {
                    value: "bit",
                    Description: "布尔类型，是或否"
                },
                {
                    value: "int",
                    Description: "数字，不含小数"
                },
                {
                    value: "decimal(18, 2)",
                    Description: "数字，2位小数点"
                }
            ],

            FieldTypeListOracle: [
                {
                    value: "NVARCHAR2(25)",
                    Description: "字符串，常用于存储短文字"
                },
                {
                    value: "NVARCHAR2(50)",
                    Description: "字符串，常用于存储短文字"
                },
                {
                    value: "NVARCHAR2(255)",
                    Description: "字符串，常用于存储几百字以内文字"
                },
                {
                    value: "NVARCHAR2(36)",
                    Description: "GUID/UUID"
                },
                {
                    value: "NCLOB",
                    Description: "文本，用于存储几千、上万、无限文字"
                },
                {
                    value: "NUMBER(1)",
                    Description: "布尔类型，是或否"
                },
                {
                    value: "NUMBER(11)",
                    Description: "数字，不含小数"
                },
                {
                    value: "NUMBER(18, 2)",
                    Description: "数字，2位小数点"
                }
            ]
        };
    },
    mounted() {
        var self = this;
        self.PageType = self.$route.query.PageType;
        self.TableId = self.$route.params.Id;
        // self.GetDiyTableModel();
        // self.GetDiyField();
        
        // Vue 3 修复：使用轮询等待 ref 就绪，确保 Init 必定执行
        // const initFieldForm = () => {
        //     if (self.$refs.fieldForm && typeof self.$refs.fieldForm.Init === 'function') {
        //         self.$refs.fieldForm.Init(false);
        //     } else {
        //         // 如果 ref 还没准备好，等待 50ms 后重试，最多重试 20 次（1秒）
        //         let retryCount = 0;
        //         const checkInterval = setInterval(() => {
        //             retryCount++;
        //             if (self.$refs.fieldForm && typeof self.$refs.fieldForm.Init === 'function') {
        //                 clearInterval(checkInterval);
        //                 self.$refs.fieldForm.Init(false);
        //             } else if (retryCount >= 20) {
        //                 clearInterval(checkInterval);
        //                 console.error('[diy-design] fieldForm ref 未能在 1 秒内就绪');
        //             }
        //         }, 50);
        //     }
        // };
        
        // self.$nextTick(initFieldForm);

        self.GetDiyComponent();
        self.GetSysRole();
        self.GetSysMenu();
        self.GetSysDataSourceList();
        self.GetApiEngineList();
        self.GetExceptionFieldList();
        self.GetDeletedDiyField();
        // self.$nextTick(function () {
        //     // self.LoadDragula();
        //     // setTimeout(() => {
        //     //     // self.$refs.diyform_diy_table.Init(false);
        //     // }, 500);
        // });
    },
    methods: {
        CallbackForm_Field(){
            var self = this;
            console.log("CallbackForm_Field");
        },
        CallbackFormValueChange_DiyField(field, value) {
            var self = this;
            console.log("CallbackFormValueChange_DiyField", field, value);

            // var diyFieldModel = self.DiyFieldList.find(item => item.Id === field.Id);
            // if (diyFieldModel) {
            //     diyFieldModel[field.Name] = value;
            //     self.$refs.fieldForm.UptDiyFieldArr(diyFieldModel);
            // }

            //下拉框的值，有可能是只存储字段，所以需要ForRowModelHandler来处理下。
            var _rowModel = {};
            _rowModel[field.Name] = value;
            self.DiyCommon.ForRowModelHandler(_rowModel, [field]);

            // self.FlowDesignModel[field.Name] = _rowModel[field.Name];
            self.CurrentDiyFieldModel[field.Name] = _rowModel[field.Name];
            self.$refs.fieldForm.UptDiyFieldArr(self.CurrentDiyFieldModel);
            
            // self.CurrentDiyFieldModel[field.Name] = value;
        },
        CallbackForm_Table(){
            var self = this;
            console.log("CallbackForm_Table");
        },
        CallbackFormValueChange_DiyTable(field, value) {
            var self = this;
            console.log("CallbackFormValueChange_DiyTable", field, value);
            self.CurrentDiyTableModel[field.Name] = value;
        },
        RecoverDiyField() {
            var self = this;
            self.DiyCommon.Post(
                "/api/DiyField/RecoverDiyField",
                {
                    Id: self.CurrentDeletedFieldModel.Id,
                    TableId: self.CurrentDeletedFieldModel.TableId
                },
                function (result) {
                    if (self.DiyCommon.Result(result)) {
                        self.DiyCommon.Tips("恢复成功！");
                        self.GetExceptionFieldList();
                        self.GetDeletedDiyField();
                    }
                }
            );
        },
        RepairField() {
            var self = this;
            //数据库中有的字段，但DiyField中没有
            if (self.CurrentErrorFieldModel && self.CurrentErrorFieldModel.ErrorType == "DbField") {
                self.DiyCommon.Post(
                    "/api/DiyField/AddDiyField",
                    {
                        TableId: self.TableId,
                        _NotAddDbField: true,
                        Name: self.CurrentErrorFieldModel.Name,
                        Type: self.CurrentErrorFieldModel.Type
                    },
                    function (result) {
                        if (self.DiyCommon.Result(result)) {
                            self.DiyCommon.Tips("修复成功！");
                            self.GetExceptionFieldList();
                        }
                    }
                );
            }
            //数据库中没有的字段，但DiyField中有
            else if (self.CurrentErrorFieldModel && self.CurrentErrorFieldModel.ErrorType == "DiyField") {
                self.DiyCommon.Post(
                    "/api/DiyField/AddDbField",
                    {
                        TableId: self.TableId,
                        Name: self.CurrentErrorFieldModel.Name,
                        Type: self.CurrentErrorFieldModel.Type
                    },
                    function (result) {
                        if (self.DiyCommon.Result(result)) {
                            self.DiyCommon.Tips("修复成功！");
                            self.GetExceptionFieldList();
                        }
                    }
                );
            } else {
                self.DiyCommon.Tips("未知错误！", false);
            }
        },
        GetDeletedDiyField() {
            var self = this;
            self.DiyCommon.Post(
                "/api/DiyField/GetDeletedDiyField",
                {
                    TableId: self.TableId
                },
                function (result) {
                    if (self.DiyCommon.Result(result)) {
                        self.DeletedDiyField = result.Data;
                    }
                }
            );
        },
        GetExceptionFieldList() {
            var self = this;
            self.DiyCommon.Post(
                "/api/DiyField/GetExceptionFieldList",
                {
                    TableId: self.TableId
                },
                function (result) {
                    if (result.Code == 1) {
                        // self.CurrentErrorFieldModel = {};
                        self.ExceptionFieldList = result.Data;
                    }
                }
            );
        },
        GetSysDataSourceList() {
            var self = this;
            self.DiyCommon.GetDiyTableRow(
                {
                    TableName: "Sys_DataSource"
                },
                function (data) {
                    if (data && data.Data) {
                        self.SysDataSourceList = data.Data;
                    }
                }
            );
        },
        GetApiEngineList() {
            var self = this;
            // console.log("获取ApiEngineList-1");
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
        },
        GetDiyComponent() {
            var self = this;
            self.DiyCommon.GetDiyTableRow(
                {
                    TableName: "Diy_Component",
                    _OrderBy: "Sort",
                    _OrderByType: "Asc"
                },
                function (data) {
                    if (!self.DiyCommon.IsNull(data)) {
                        self.DiyComponentList = data.Data;
                    }
                }
            );
        },
        SwitchFormClient(tab) {
            var self = this;
            self.FormClient = tab.name;
        },
        ClearCurrentDiyFieldModelData() {
            var self = this;
            self.DiyCommon.OsConfirm(self.$t("Msg.ConfirmDelTo") + "【" + self.CurrentDiyFieldModel.Label + "】清空所有字典数据？", function () {
                self.CurrentDiyFieldModel.Data = [];
            });
        },
        SelectFieldChange(val) {
            var self = this;
            if (self.DiyCommon.IsNull(val)) {
                self.CurrentDiyFieldModel = null;
                // self.DiyFieldList = self.$refs.fieldForm.DiyFieldList;
            } else {
                self.$refs.fieldForm.SelectField(val);
            }
        },
        SelectFieldFilterMethod(value) {
            var self = this;
            self.DiyFieldListClone = self.DiyFieldList.filter(
                (item) => (item.Label && item.Label.toLowerCase().indexOf(value.toLowerCase()) > -1) || (item.Name && item.Name.toLowerCase().indexOf(value.toLowerCase()) > -1)
            );
        },
        SelectErrorFieldChange(val) {
            var self = this;
        },
        CanUptComponent() {
            var self = this;
            var result = true;
            self.CantUptComponentList.forEach((componentName) => {
                if (componentName == self.CurrentDiyFieldModel.Component) {
                    result = false;
                }
            });
            return result;
        },
        sysMenuTreeClick(data) {
            var self = this;
            if (data.OpenType == "Diy" && !self.DiyCommon.IsNull(data.DiyTableId)) {
                self.CurrentDiyFieldModel.Config["TableChildTableId"] = data.DiyTableId;
                self.CurrentDiyFieldModel.Config["TableChildSysMenuId"] = data.Id;
                self.CurrentDiyFieldModel.Config["TableChildSysMenuName"] = data.Name;
            }
        },

        JoinTableSelectModule(data) {
            var self = this;
            if (data.OpenType == "Diy" && !self.DiyCommon.IsNull(data.DiyTableId)) {
                self.CurrentDiyFieldModel.Config.JoinTable["TableId"] = data.DiyTableId;
                self.CurrentDiyFieldModel.Config.JoinTable["ModuleId"] = data.Id;
                self.CurrentDiyFieldModel.Config.JoinTable["ModuleName"] = data.Name;
            }
        },

        OpenTableSysMenuClick(data) {
            var self = this;
            if (data.OpenType == "Diy" && !self.DiyCommon.IsNull(data.DiyTableId)) {
                self.CurrentDiyFieldModel.Config.OpenTable["TableId"] = data.DiyTableId;
                self.CurrentDiyFieldModel.Config.OpenTable["SysMenuId"] = data.Id;
                self.CurrentDiyFieldModel.Config.OpenTable["SysMenuName"] = data.Name;
            }
        },
        // ==================== JSON表格配置相关方法 ====================
        // 获取JSON表格列配置
        GetJsonTableColumns() {
            var self = this;
            if (!self.CurrentDiyFieldModel) return [];
            if (!self.CurrentDiyFieldModel.Config) {
                self.CurrentDiyFieldModel.Config = {};
            }
            return {};
        },
        // ==================== TreeCheckbox配置相关方法 ====================
        // 获取TreeCheckbox配置
        GetTreeCheckboxConfig() {
            var self = this;
            if (!self.CurrentDiyFieldModel) return {};
            if (!self.CurrentDiyFieldModel.Config) {
                self.CurrentDiyFieldModel.Config = {};
            }
            if (!self.CurrentDiyFieldModel.Config.TreeCheckbox) {
                self.CurrentDiyFieldModel.Config.TreeCheckbox = {
                    DataSourceType: 'SysMenu',
                    DataSourceApi: '',
                    DataSourceStatic: [],
                    ShowSearch: true,
                    ShowIcon: true,
                    DefaultExpandAll: true,
                    NameColumnLabel: '名称',
                    NameColumnWidth: 250,
                    PermissionColumnLabel: '权限',
                    TableClass: 'diy-table table-sysmenu table-sysmenu-roles cell-br',
                    IdField: 'Id',
                    NameField: 'Name',
                    EnNameField: 'EnName',
                    IconField: 'IconClass',
                    ParentIdField: 'ParentId',
                    ChildrenField: '_Child',
                    DefaultPermissions: [],
                    CustomBtnGroups: []
                };
            }
            return self.CurrentDiyFieldModel.Config.TreeCheckbox;
        },
        sysMenuTreeClickLast(data) {
            var self = this;
            if (data.OpenType == "Diy" && !self.DiyCommon.IsNull(data.DiyTableId)) {
                self.CurrentDiyFieldModel.Config.TableChild["LastTableId"] = data.DiyTableId;
                self.CurrentDiyFieldModel.Config.TableChild["LastSysMenuId"] = data.Id;
                self.CurrentDiyFieldModel.Config.TableChild["LastSysMenuName"] = data.Name;
            }
        },
        GetSysMenu() {
            var self = this;
            self.DiyCommon.Post(
                self.DiyApi.GetSysMenuStep(),
                {
                    // self.DiyCommon.Post(self.DiyApi.GetDiyTableRowTree, {
                    TableName: "Sys_Menu",
                    _OrderBy: "Sort",
                    _OrderByType: "ASC"
                    // OsClient: self.OsClient
                },
                function (result) {
                    if (self.DiyCommon.Result(result)) {
                        // result.Data.forEach(data => {
                        //     self.SysMenuNeedConvertField.forEach(convertField => {
                        //         if (self.DiyCommon.IsNull(data[convertField])) {
                        //             data[convertField] = []
                        //         } else {
                        //             if (convertField == 'StatisticsFields') {
                        //                 var tempResult = []
                        //                 var tempArr = JSON.parse(data[convertField])
                        //                 tempArr.forEach(calcIdType => {
                        //                     tempResult.push(calcIdType.Id)
                        //                 })
                        //                 data[convertField] = tempResult
                        //             } else {
                        //                 data[convertField] = JSON.parse(data[convertField])
                        //             }
                        //         }
                        //     })
                        //     var dataChildList = data._Child
                        //     if (!self.DiyCommon.IsNull(dataChildList) && dataChildList.length > 0) {
                        //         dataChildList.forEach(childData => {
                        //             self.SysMenuNeedConvertField.forEach(convertField2 => {
                        //                 if (self.DiyCommon.IsNull(childData[convertField2])) {
                        //                     childData[convertField2] = []
                        //                 } else {
                        //                     if (convertField2 == 'StatisticsFields') {
                        //                         var tempResult = []
                        //                         var tempArr = JSON.parse(childData[convertField2])
                        //                         tempArr.forEach(calcIdType => {
                        //                             tempResult.push(calcIdType.Id)
                        //                         })
                        //                         childData[convertField2] = tempResult
                        //                     } else {
                        //                         childData[convertField2] = JSON.parse(childData[convertField2])
                        //                     }
                        //                 }
                        //             })
                        //         })
                        //     }
                        // })
                        // self.DiyCommon.ForConvertSysMenu(result.Data);
                        self.SysMenuList = result.Data;
                    }
                }
            );
        },
        GetSysRole() {
            var self = this;
            self.DiyCommon.Post(self.DiyApi.GetSysRole(), {}, function (result) {
                if (self.DiyCommon.Result(result)) {
                    self.SysRoleList = result.Data;
                }
            });
        },
        OpenV8CodeEditor(modelPath) {
            var self = this;
            // 保存当前编辑的model路径
            self.currentV8ModelPath = modelPath;
            
            // 通过eval获取当前值并赋给currentV8Model
            try {
                eval("self.currentV8Model = self." + modelPath);
            } catch (e) {
                self.currentV8Model = '';
            }
            
            // 打开共享的V8设计器
            self.$nextTick(() => {
                if (self.$refs.sharedV8Designer) {
                    self.$refs.sharedV8Designer.show();
                }
            });
            return;
            // if (self.CurrentV8Type == 'Field') {
            //     if(!self.DiyCommon.IsNull(nextName2))
            //     {
            //         self.CurrentV8Code = self.DiyCommon.IsNull(self.CurrentDiyFieldModel[nextName][nextName2][type])
            //                                 ? '' : self.CurrentDiyFieldModel[nextName][nextName2][type];
            //     }
            //     else if(!self.DiyCommon.IsNull(nextName))
            //     {
            //         self.CurrentV8Code = self.DiyCommon.IsNull(self.CurrentDiyFieldModel[nextName][type])
            //                                 ? '' : self.CurrentDiyFieldModel[nextName][type];
            //     }else{
            //         self.CurrentV8Code = self.DiyCommon.IsNull(self.CurrentDiyFieldModel[type])
            //                                 ? '' : self.CurrentDiyFieldModel[type];
            //     }

            // }else{
            //     self.CurrentV8Code = self.DiyCommon.IsNull(self.CurrentDiyTableModel[type]) ? '' : self.CurrentDiyTableModel[type]
            // }
            // self.ShowV8CodeEditor = true
        },
        CloseV8CodeEditor() {
            var self = this;
            // if (self.CurrentV8Sign == 'Field') {
            //     self.CurrentDiyFieldModel.Config.V8Code = self.CurrentV8Code
            // } else if (self.CurrentV8Sign == 'FieldForm') {
            //     self.CurrentDiyFieldModel.V8TmpEngineForm = self.CurrentV8Code
            // } else if (self.CurrentV8Sign == 'FieldTable') {
            //     self.CurrentDiyFieldModel.V8TmpEngineTable = self.CurrentV8Code
            // } else if (self.CurrentV8Sign == 'InFormV8') {
            //     self.CurrentDiyTableModel.InFormV8 = self.CurrentV8Code
            // }else if (self.CurrentV8Sign == 'SubmitFormV8') {
            //     self.CurrentDiyTableModel.SubmitFormV8 = self.CurrentV8Code
            // } else {
            //     self.CurrentDiyTableModel.OutFormV8 = self.CurrentV8Code
            // }
            eval("self." + self.CurrentV8Sign + " = self.CurrentV8Code");
            self.ShowV8CodeEditor = false;
            return;
            // if(self.CurrentV8Type == 'Field'){
            //     if(self.CurrentV8Sign == 'V8Code' || self.CurrentV8Sign == 'V8CodeBlur'){
            //         self.CurrentDiyFieldModel.Config[self.CurrentV8Sign] = self.CurrentV8Code;
            //     }else{
            //         self.CurrentDiyFieldModel[self.CurrentV8Sign] = self.CurrentV8Code
            //     }
            // }else{
            //     self.CurrentDiyTableModel[self.CurrentV8Sign] = self.CurrentV8Code
            // }
            // self.ShowV8CodeEditor = false
        },

        // 中文转拼音
        DiyFieldLabelChange(label) {
            var self = this;
            if (!self.CurrentDiyFieldModel.NameConfirm) {
                if (!self.DiyCommon.IsNull(label)) {
                    try {
                        self.CurrentDiyFieldModel.Name = self.DiyCommon.ChineseToPinyin(label);
                    } catch (error) {
                        self.CurrentDiyFieldModel.Name = "";
                        console.log(error);
                    }
                } else {
                    self.CurrentDiyFieldModel.Name = "";
                }
            }
        },
        SearchCDFMType(queryString, cb) {
            var self = this;
            var restaurants = [];
            if (self.SysConfig.DatabaseType == "Oracle") {
                restaurants = this.FieldTypeListOracle;
            } else {
                restaurants = this.FieldTypeList;
            }
            var results = queryString ? restaurants.filter(this.createFilter(queryString)) : restaurants;
            // 调用 callback 返回建议列表的数据
            cb(results);
        },
        createFilter(queryString) {
            return (restaurant) => {
                return restaurant.value.toLowerCase().indexOf(queryString.toLowerCase()) === 0;
            };
        },
        CallbackGetDiyField(diyFieldList) {
            var self = this;
            self.DiyFieldList = diyFieldList;
            self.DiyFieldListClone = lodash.cloneDeep(self.DiyFieldList);
        },
        /**
         * vuedraggable clone 回调：从左侧拖拽控件时克隆一个新字段
         * @param {Object} component - 组件模板对象
         * @returns {Object} - 克隆的组件对象（用于显示，但不会真正添加）
         */
        cloneComponent(component) {
            console.log('[diy-design] cloneComponent 被调用:', component);
            // 返回克隆对象用于拖拽显示，实际添加在 onAdd 中处理
            // 将组件信息存储到克隆对象中，方便onAdd时获取
            const cloned = { 
                ...component, 
                _originalComponent: component,
                _cloneTimestamp: Date.now()
            };
            console.log('[diy-design] 克隆后的对象:', cloned);
            return cloned;
        },
        /**
         * vuedraggable move 回调：控制拖拽移动行为
         * @param {Object} evt - 移动事件对象
         * @returns {Boolean} - 是否允许移动
         */
        onComponentMove(evt) {
            // 从左侧拖到中间：允许（clone模式）
            // 左侧内部排序：禁止（sort=false）
            return evt.to !== evt.from;
        },
        /**
         * vuedraggable onAdd 回调：当组件被拖入表单区域时触发
         * @param {Object} evt - 拖拽事件对象
         */
        onComponentAdd(evt) {
            var self = this;
            console.log('========== [diy-design] onComponentAdd 开始 ==========');
            console.log('[diy-design] evt 对象:', evt);
            console.log('[diy-design] evt.item:', evt.item);
            console.log('[diy-design] evt.clone:', evt.clone);
            console.log('[diy-design] evt.to:', evt.to);
            console.log('[diy-design] evt.from:', evt.from);
            console.log('[diy-design] evt.newIndex:', evt.newIndex);
            console.log('[diy-design] evt.oldIndex:', evt.oldIndex);
            
            // 获取当前活动的 tab
            var tab = self.$refs.fieldForm.FieldActiveTab;
            console.log('[diy-design] 当前tab:', tab);
            if (tab == "none" || tab == "info" || !tab) {
                tab = "";
            }
            console.log('[diy-design] 最终tab:', tab);
            
            // 从多个可能的位置获取组件信息
            var component = null;
            
            // 方法1: 从 clone 的 _originalComponent 获取
            if (evt.clone && evt.clone._originalComponent) {
                component = evt.clone._originalComponent;
                console.log('[diy-design] 方法1: 从 clone._originalComponent 获取:', component);
            }
            
            // 方法2: 从 item 的 data-field 属性获取
            if (!component && evt.item.dataset && evt.item.dataset.field) {
                const controlName = evt.item.dataset.field;
                console.log('[diy-design] 方法2: 从 dataset.field 获取 controlName:', controlName);
                component = _.findWhere(self.DiyComponentList, { Control: controlName });
                console.log('[diy-design] 方法2: 查找到的component:', component);
            }
            
            // 方法3: 从 draggable context 获取
            if (!component && evt.item.__draggable_context?.element) {
                component = evt.item.__draggable_context.element;
                console.log('[diy-design] 方法3: 从 __draggable_context 获取:', component);
            }
            
            // 方法4: 尝试从 clone 本身获取
            if (!component && evt.clone && evt.clone.Control) {
                component = evt.clone;
                console.log('[diy-design] 方法4: 从 clone 本身获取:', component);
            }
            
            if (!component) {
                console.error('[diy-design] ❗无法获取组件信息！');
                console.error('[diy-design] evt详情:', {
                    item: evt.item,
                    clone: evt.clone,
                    to: evt.to,
                    from: evt.from,
                    itemHTML: evt.item.outerHTML,
                    itemDataset: evt.item.dataset
                });
                // 移除拖拽添加的临时元素
                if (evt.item && evt.item.parentNode) {
                    evt.item.parentNode.removeChild(evt.item);
                }
                console.log('========== [diy-design] onComponentAdd 结束(失败) ==========');
                return;
            }
            
            console.log('[diy-design] 最终获取到的component:', component);
            
            // 查找完整的组件模型
            var componentModel = _.findWhere(self.DiyComponentList, {
                Control: component.Control || component
            });
            
            console.log('[diy-design] DiyComponentList长度:', self.DiyComponentList.length);
            console.log('[diy-design] 查找的Control:', component.Control || component);
            console.log('[diy-design] 查找到的componentModel:', componentModel);
            
            if (componentModel) {
                const fieldData = {
                    Name: "",
                    Label: componentModel.Name,
                    Type: componentModel.FieldType,
                    Component: componentModel.Control,
                    Visible: 1,
                    AppVisible: 1,
                    Tab: tab,
                    TableWidth: 120,
                    NameConfirm: 0,
                    Readonly: componentModel.Readonly ? 1 : 0,
                    _insertIndex: evt.newIndex
                };
                console.log('[diy-design] 即将添加的字段数据:', fieldData);
                
                // 添加新字段（带插入位置）
                self.AddDiyField(fieldData);
                console.log('[diy-design] AddDiyField 调用完成');
            } else {
                console.error('[diy-design] ❗找不到对应的组件模型！');
            }
            
            // 🔥 关键修复：不移除evt.item！
            // evt.item 是从左侧draggable来的元素，移除它会导致左侧字段消失
            // vuedraggable在clone模式下会自动处理DOM，我们只需要处理数据
            // if (evt.item && evt.item.parentNode) {
            //     console.log('[diy-design] 移除临时DOM元素');
            //     evt.item.parentNode.removeChild(evt.item);
            // }
            console.log('========== [diy-design] onComponentAdd 结束(成功) ==========');
        },
        /**
         * vuedraggable 字段排序变化回调：当字段在表单中拖拽排序时触发
         * @param {Object} data - 包含 oldIndex 和 newIndex 的对象
         */
        onFieldOrderChanged(data) {
            var self = this;
            // 字段顺序已经在 DiyFieldListGrouped 中自动更新（因为绑定了 :list）
            // 这里可以添加保存逻辑或其他需要的处理
            console.log('字段顺序已改变:', data);
            // 可选：自动保存字段顺序
            // self.SaveAllDiyField();
        },
        /**
         * 复制字段
         */
        CallbackDuplicateField(field) {
            var self = this;
            // 找到当前字段的位置
            var fieldIndex = self.DiyFieldList.findIndex(f => f.Id === field.Id);
            
            // 获取字段的组件类型
            var componentModel = _.where(self.DiyComponentList, {
                Control: field.Component
            })[0];
            
            if (componentModel) {
                // 使用 AddDiyField 创建新字段（和拖入字段相同的方式）
                self.AddDiyField({
                    Name: field.Name + '_Copy',  // 名称添加 _Copy
                    Label: field.Label + '(副本)',
                    Type: field.Type || componentModel.FieldType,
                    Component: field.Component,
                    Visible: 1,
                    AppVisible: 1,
                    Tab: field.Tab || self.$refs.fieldForm.FieldActiveTab,
                    TableWidth: field.TableWidth || 120,
                    FormWidth: field.FormWidth,  // 保留宽度
                    NameConfirm: 0,
                    Readonly: field.Readonly || (componentModel.Readonly ? 1 : 0),
                    Config: field.Config ? JSON.parse(JSON.stringify(field.Config)) : {},  // 复制配置
                    _insertIndex: fieldIndex + 1  // 插入到当前字段后面
                });
            }
        },
        /**
         * 删除字段
         */
        CallbackDeleteField(field) {
            var self = this;
            self.DiyCommon.OsConfirm('确定删除字段【' + field.Label + '】？', function() {
                self.DiyCommon.Post(self.DiyApi.DelDiyField,{
                    Id: field.Id
                },
                function (result) {
                    if (self.DiyCommon.Result(result)) {
                        self.DiyCommon.Tips(self.$t("Msg.Success"));
                        var fieldIndex = self.DiyFieldList.findIndex(f => f.Id === field.Id);
                        if (fieldIndex > -1) {
                            self.DiyFieldList.splice(fieldIndex, 1);
                            // 清空选中
                            self.CurrentDiyFieldModel = {};
                        }
                    }
                });
            });
        },
        /**
         * 字段宽度改变
         */
        CallbackFieldWidthChanged(data) {
            var self = this;
            // 字段宽度已在 diy-form 中更新，这里可以添加其他处理
            console.log('字段宽度已改变:', data.field.Name, data.width);
        },
        tabClickField() {},
        tabCLickAsideRight() {},
        AddDiyTableTab() {
            var self = this;
            self.CurrentDiyTableTabModel.Id = self.DiyCommon.NewGuid();
            self.CurrentDiyTableModel.Tabs.push(self.CurrentDiyTableTabModel);
            self.CurrentDiyTableTabModel = {};
        },
        DelDiyTableTab(tabModel) {
            var self = this;
            self.DiyCommon.OsConfirm(self.$t("Msg.ConfirmDelTo") + "【" + tabModel.Name + "】？", function () {
                var index = 0;
                for (let index = 0; index < self.CurrentDiyTableModel.Tabs.length; index++) {
                    if (self.CurrentDiyTableModel.Tabs[index].Name == tabModel.Name) {
                        self.CurrentDiyTableModel.Tabs.splice(index, 1);
                        break;
                    }
                }
            });
        },
        CallbackSelectField(field) {
            var self = this;
            //console.log('CallbackSelectField:', field);
            //2024-10-31:无意义的代码，注释。 --by anderson
            // if (!self.DiyCommon.IsNull(field.Config) && self.DiyCommon.IsNull(field.Config)) {
            //     field.Config = ''
            // }

            // 值变更V8事件代码迁移
            if(field.Config && field.Config.V8Code && !field.V8Code){
                field.V8Code = field.Config.V8Code;
            }

            //是否需要解密？？
            self.CurrentDiyFieldModel = field;

            if (field.Component == "Checkbox" || field.Component == "MultipleSelect") {
                self.FormDiyTableModel[self.CurrentDiyFieldModel.Name] = []; // self.CurrentDiyFieldModel.Data
            } else {
                self.FormDiyTableModel[self.CurrentDiyFieldModel.Name] = "";
            }
            self.AsideRightActiveTab = "Field";
            self.$nextTick(function () {
                // if (!self.DiyCommon.IsNull(self.$refs.cmObj)) {
                //     self.$refs.cmObj.refresh()
                // }
                // setTimeout(() => {
                    // 2026-02-05 Anderson：已实现diy-form.vue组件的自动初始化，
                    // 因此这里没必要调用.Init()初始化，直接改变FormData值即可
                    // self.$refs.diyform_diy_field.Init(false);
                    self.$refs.diyform_diy_field.SetFormData(self.CurrentDiyFieldModel);
                    // 还得让 表单进入V8事件 触发1次？

                    // 2026-02-06 Anderson：字段的表单分组数据源，正确做法是通过diy_field表的表单进入事件来实现，这里先硬编码实现了
                    if(self.CurrentDiyTableModel.Tabs){
                        var tabData = [];
                        if(typeof self.CurrentDiyTableModel.Tabs == 'string'){
                            tabData = JSON.parse(self.CurrentDiyTableModel.Tabs);
                        }else{
                            tabData = self.CurrentDiyTableModel.Tabs;
                        }
                        self.$refs.diyform_diy_field.UptDiyFieldDataSource("Tab", tabData);
                    }
                // }, 300);
            });
        },
        AddKeys() {
            var self = this;
            if (!self.DiyCommon.IsNull(self.CurrentDiyFieldModel.Config.KeysAddVModel)) {
                self.CurrentDiyFieldModel.Data.push(self.CurrentDiyFieldModel.Config.KeysAddVModel);
                self.CurrentDiyFieldModel.Config.KeysAddVModel = "";
                self.CurrentDiyFieldModel.Config.KeysAddVisible = false;
                // 注意：这里也需要给FormDiyTableModel对应的属性设置array类型，否则会报错
                self.FormDiyTableModel[self.CurrentDiyFieldModel.Name] = []; // self.CurrentDiyFieldModel.Data
            }
        },
        GetDiyTableColumnSpan(field) {
            var self = this;
            if (!self.DiyCommon.IsNull(field.FormWidth) && field.FormWidth != 0) {
                return field.FormWidth;
            } else if (self.CurrentDiyTableModel.Column == 1) {
                return 24;
            } else if (self.CurrentDiyTableModel.Column == 2) {
                return 12;
            } else if (self.CurrentDiyTableModel.Column == 3) {
                return 8;
            } else if (self.CurrentDiyTableModel.Column == 4) {
                return 6;
            } else if (self.CurrentDiyTableModel.Column == 6) {
                return 4;
            } else {
                return 24;
            }
        },
        UptDiyTable() {
            var self = this;
            // var param = {
            //     ...self.CurrentDiyTableModel
            // }
            var param = lodash.cloneDeep(self.CurrentDiyTableModel);
            //Sql、V8代码全部转为Base64
            self.DiyCommon.Base64EncodeDiyTable(param);
            // param.OsClient = self.OsClient
            self.DiyTableJsonToStr(param);
            param.FormEngineKey = "Diy_Table";
            // self.DiyCommon.Post(DiyApi.UptDiyTable, param, function (result) {
            self.DiyCommon.Post(self.DiyApi.FormEngine.UptFormData, param, function (result) {
                if (self.DiyCommon.Result(result)) {
                    self.DiyCommon.Tips(self.$t("Msg.Success"));
                    // self.$refs.fieldForm.SetDiyTableModel(result.Data)
                }
            });
        },
        SaveAllDiyField() {
            var self = this;
            self.SaveAllDiyFieldLoding = true;
            try {
                // 先保存DiyTable
                // var param = {
                //     ...self.CurrentDiyTableModel
                // }
                var param = lodash.cloneDeep(self.CurrentDiyTableModel);
                //Sql、V8代码全部转为Base64
                self.DiyCommon.Base64EncodeDiyTable(param);

                // param.OsClient = self.OsClient
                self.DiyTableJsonToStr(param);
                param.FormEngineKey = "Diy_Table";
                // self.DiyCommon.Post(DiyApi.UptDiyTable, param, function (result) {
                self.DiyCommon.Post(self.DiyApi.FormEngine.UptFormData, param, function (result) {
                    if (self.DiyCommon.Result(result)) {
                        // self.$refs.fieldForm.SetDiyTableModel(result.Data)
                    }
                });
                // 这里copy过来被引用了
                // var fieldList = [...self.$refs.fieldForm.DiyFieldList];
                // 这种方式就不会出问题
                // var fieldList = [];//JSON.parse(JSON.stringify(self.$refs.fieldForm.DiyFieldList))
                // self.$refs.fieldForm.DiyFieldList.forEach(field => {
                //     var copyField = {...field};
                //     copyField.BaiduMapConfig = {};
                //     fieldList.push(copyField);
                // });
                //2022-07-13这种方式copy，不会引用
                var fieldList = lodash.cloneDeep(self.DiyFieldList);

                // 这里copy过来被引用了
                // var fieldList = Array.from(self.$refs.fieldForm.DiyFieldList);

                // 再保存DiyField
                // if (self.DiyFieldList.length > 0) {
                if (fieldList.length > 0) {
                    // var fieldList = [...self.DiyFieldList];
                    fieldList.forEach((element) => {
                        self.DiyCommon.Base64EncodeDiyField(element);
                        self.DiyFieldJsonToStr(element);
                        element.OsClient = "";
                    });
                    self.DiyCommon.Post(
                        self.DiyApi.UptDiyFieldList,
                        {
                            FieldList: fieldList,
                            TableId: self.$route.params.Id
                        },
                        function (result) {
                            self.SaveAllDiyFieldLoding = false;
                            if (self.DiyCommon.Result(result)) {
                                self.DiyCommon.Tips(self.$t("Msg.Success"));

                                // 全部保存是可以重新查询的
                                // self.GetDiyField()
                                self.FieldForm_GetAllData();

                                if (self.CurrentDiyFieldModel && !self.DiyCommon.IsNull(self.CurrentDiyFieldModel.Id)) {
                                    self.GetDiyFieldModel(self.CurrentDiyFieldModel.Id);
                                }
                            }
                        },
                        function () {
                            self.SaveAllDiyFieldLoding = false;
                        }
                    );
                } else {
                    self.SaveAllDiyFieldLoding = false;
                }
            } catch (error) {
                self.SaveAllDiyFieldLoding = false;
                console.log(error);
            }
        },
        UptDiyField() {
            var self = this;
            self.SaveAllDiyFieldLoding = true;
            try {
                // var param = {
                //     ...self.CurrentDiyFieldModel
                // }
                var param = lodash.cloneDeep(self.CurrentDiyFieldModel);
                // param.OsClient = self.OsClient
                // param.BaiduMapConfig = {};  放到DiyFieldJsonToStr里面
                self.DiyCommon.Base64EncodeDiyField(param);
                self.DiyFieldJsonToStr(param);
                //2024-04-24：如果是报表引擎
                var uptApiUrl = self.DiyApi.UptDiyField;
                if (self.PageType == "Report") {
                    uptApiUrl = self.DiyApi.FormEngine.UptFormData;
                    param.BaiduMapConfig = JSON.stringify(param.BaiduMapConfig);
                    param = {
                        FormEngineKey: "diy_field",
                        Id: param.Id,
                        _RowModel: {
                            ...param
                        }
                    };
                }
                param.OsClient = "";
                if (!param.Name) {
                    self.DiyCommon.Tips("字段名不能为空！", false);
                    return;
                }
                self.DiyCommon.Post(
                    uptApiUrl,
                    param,
                    function (result) {
                        self.SaveAllDiyFieldLoding = false;
                        if (self.DiyCommon.Result(result)) {
                            self.DiyCommon.Tips(self.$t("Msg.Success"));
                            self.DiyCommon.DiyFieldConfigStrToJson(result.Data);
                            self.$refs.fieldForm.DiyFieldStrToJson(result.Data);
                            self.DiyCommon.Base64DecodeDiyField(result.Data);
                            //这里Current是修改成功了，但是DiyForm内部的数组并未修改成功
                            // self.CurrentDiyFieldModel = result.Data
                            self.FormDiyTableModel[self.CurrentDiyFieldModel.Name] = self.CurrentDiyFieldModel.Data;

                            // self.GetDiyField();
                            self.$refs.fieldForm.UptDiyFieldArr(result.Data);
                        }
                    },
                    function () {
                        self.SaveAllDiyFieldLoding = false;
                    }
                );
            } catch (error) {
                self.SaveAllDiyFieldLoding = false;
            }
        },
        AddDiyField(param) {
            var self = this;
            console.log('[diy-design] ========== AddDiyField 开始 ==========');
            console.log('[diy-design] 传入参数:', param);
            
            // 保存插入位置（如果有）
            var insertIndex = param._insertIndex;
            console.log('[diy-design] insertIndex:', insertIndex);
            delete param._insertIndex;  // 删除临时参数，不传给后端
            
            param.TableId = self.$route.params.Id;
            console.log('[diy-design] TableId:', param.TableId);
            
            // 🔥 关键修复：根据insertIndex计算Sort值
            // 获取当前tab的所有字段（使用DiyFieldListGrouped获取已渲染的字段）
            if (typeof insertIndex === 'number' && insertIndex >= 0) {
                var currentTab = param.Tab || '';
                console.log('[diy-design] 当前tab:', currentTab);
                
                // 从 fieldForm 的 DiyFieldListGrouped 获取当前tab的字段（已按Sort排序）
                var tabFields = [];
                if (self.$refs.fieldForm && self.$refs.fieldForm.DiyFieldListGrouped) {
                    tabFields = self.$refs.fieldForm.DiyFieldListGrouped[currentTab] || [];
                    console.log('[diy-design] 从 DiyFieldListGrouped 获取的字段数:', tabFields.length);
                } else {
                    // 备用方案：手动过滤和排序
                    var allFields = self.$refs.fieldForm ? self.$refs.fieldForm.DiyFieldList : [];
                    tabFields = allFields.filter(f => f.Tab === currentTab);
                    tabFields.sort((a, b) => (a.Sort || 0) - (b.Sort || 0));
                    console.log('[diy-design] 从 DiyFieldList 过滤的字段数:', tabFields.length);
                }
                
                console.log('[diy-design] 当前tab的字段数:', tabFields.length);
                console.log('[diy-design] insertIndex:', insertIndex);
                
                if (tabFields.length === 0) {
                    // 第一个字段，使用默认Sort
                    param.Sort = 100;
                    console.log('[diy-design] 第一个字段，Sort设为:', param.Sort);
                } else if (insertIndex === 0) {
                    // 插入到最前面，使用最小Sort - 100
                    param.Sort = (tabFields[0].Sort || 100) - 100;
                    console.log('[diy-design] 插入到最前面，Sort设为:', param.Sort, '(第一个字段Sort:', tabFields[0].Sort, ')');
                } else if (insertIndex >= tabFields.length) {
                    // 插入到最后面，使用最大Sort + 100
                    var lastField = tabFields[tabFields.length - 1];
                    param.Sort = (lastField?.Sort || 0) + 100;
                    console.log('[diy-design] 插入到最后面，Sort设为:', param.Sort, '(最后一个字段Sort:', lastField?.Sort, ')');
                } else {
                    // 插入到中间，使用前后字段Sort的中间值
                    var prevField = tabFields[insertIndex - 1];
                    var nextField = tabFields[insertIndex];
                    var prevSort = prevField?.Sort || 0;
                    var nextSort = nextField?.Sort || (prevSort + 200);
                    
                    console.log('[diy-design] 准备插入到中间位置', insertIndex);
                    console.log('[diy-design] 前一个字段:', prevField?.Label, '(index:', insertIndex - 1, ') Sort:', prevSort);
                    console.log('[diy-design] 后一个字段:', nextField?.Label, '(index:', insertIndex, ') Sort:', nextSort);
                    
                    // 🔥 关键：确保Sort是整数，如果前后Sort相同或相邻，使用前一个+1
                    if (nextSort <= prevSort) {
                        // 顺序错误，使用前一个+100
                        param.Sort = prevSort + 100;
                        console.log('[diy-design] ⚠️ 检测到Sort顺序异常，使用 prevSort+100:', param.Sort);
                    } else if (nextSort - prevSort <= 1) {
                        // 间隙太小，使用前一个+1
                        param.Sort = prevSort + 1;
                        console.log('[diy-design] 间隙太小，使用 prevSort+1:', param.Sort);
                    } else {
                        // 使用中间值（向下取整确保整数）
                        param.Sort = Math.floor((prevSort + nextSort) / 2);
                        console.log('[diy-design] 使用中间值:', param.Sort, '=', 'Math.floor((' + prevSort, '+', nextSort + ') / 2)');
                    }
                }
            }
            
            // param.OsClient = self.OsClient
            var width100 = ["Textarea", "RichText", "ImgUpload", "FileUpload", "Divider", "Map", "MapArea", "DataTable", "TableChild", "Address", "DevComponent"];
            if (width100.indexOf(param.Component) > -1) {
                param.FormWidth = 24;
            }
            // param.Sort = 100;
            //2024-04-29:如果是报表设计，直接走formengine，不创建物理字段
            var apiUrl = self.DiyApi.AddDiyField;
            if (self.PageType == "Report") {
                apiUrl = self.DiyApi.FormEngine.AddFormData;
                param = {
                    FormEngineKey: "diy_field",
                    _RowModel: { ...param }
                };
            }
            console.log('[diy-design] API URL:', apiUrl);
            console.log('[diy-design] 发送到后端的参数:', param);
            
            self.DiyCommon.Post(apiUrl, param, function (result) {
                console.log('[diy-design] API响应结果:', result);
                if (self.DiyCommon.Result(result)) {
                    console.log('[diy-design] ✅ API调用成功');
                    self.DiyCommon.Tips(self.$t("Msg.Success"));
                    // self.DiyFieldList.push(result.Data);
                    console.log('[diy-design] 返回的字段数据:', result.Data);
                    
                    self.DiyCommon.DiyFieldConfigStrToJson(result.Data);
                    self.$refs.fieldForm.DiyFieldStrToJson(result.Data);
                    self.DiyCommon.Base64DecodeDiyField(result.Data);

                    var needBool2Int = ["NameConfirm", "NotEmpty", "Visible", "AppVisible", "Readonly", "Unique", "InTableEdit", "IsLockField", "Encrypt"];
                    needBool2Int.forEach((item) => {
                        result.Data[item] = result.Data[item] ? 1 : 0;
                    });

                    self.CurrentDiyFieldModel = result.Data;
                    self.FormDiyTableModel[self.CurrentDiyFieldModel.Name] = self.CurrentDiyFieldModel.Data;
                    self.AsideRightActiveTab = "Field";

                    console.log('[diy-design] 准备调用AddDiyFieldArr, insertIndex:', insertIndex);
                    // self.GetDiyField();
                    self.$refs.fieldForm.AddDiyFieldArr(result.Data, insertIndex);  // 传入插入位置
                    console.log('[diy-design] ========== AddDiyField 结束 ==========');
                } else {
                    console.error('[diy-design] ❌ API调用失败:', result);
                    // 🔥 关键：API失败时显示错误信息，不添加字段
                    self.DiyCommon.Tips(result.Msg || '添加字段失败', 'error');
                }
            });
        },
        // GetDiyField() {
        //     var self = this
        //     self.$refs.fieldForm.GetDiyField(null, false)
        // },
        FieldForm_GetAllData() {
            var self = this;
            self.$refs.fieldForm.GetAllData();
        },
        CallbackSetDiyTableModel(model) {
            var self = this;

            model.DataEncryptSave = model.DataEncryptSave ? 1 : 0;
            model.DataEncryptTransfer = model.DataEncryptTransfer ? 1 : 0;
            model.EnableCache = model.EnableCache ? 1 : 0;
            model.IsAnonymousAdd = model.IsAnonymousAdd ? 1 : 0;
            model.IsAnonymousRead = model.IsAnonymousRead ? 1 : 0;
            model.IsTree = model.IsTree ? 1 : 0;
            model.TableInEdit = model.TableInEdit ? 1 : 0;
            model.TreeLazy = model.TreeLazy ? 1 : 0;
            console.log('传入前的表数据 - CallbackSetDiyTableModel:', model );
            self.CurrentDiyTableModel = model;
            console.log('传入的表数据 - CallbackSetDiyTableModel:', self.CurrentDiyTableModel );
            self.$emit("CallbackSetDiyTableModel", model);
            // self.DiyCommon.ChangePageTabName('diy_field', self.$t('Msg.Design') + ' ' + model.Name.replace('Diy_', ''))
        },
        DiyTableJsonToStr(data) {
            var self = this;
            if (self.DiyCommon.IsNull(data.RowAction)) {
                data.RowAction = "[]";
            } else if(typeof data.RowAction === "object") {
                data.RowAction = JSON.stringify(data.RowAction);
            }

            if (self.DiyCommon.IsNull(data.Tabs)) {
                data.Tabs = "[]";
            } else if(typeof data.Tabs === "object") {
                data.Tabs = JSON.stringify(data.Tabs);
            }

            if (self.DiyCommon.IsNull(data.BindRole)) {
                data.BindRole = "[]";
            } else if(typeof data.BindRole === "object") {
                data.BindRole = JSON.stringify(data.BindRole);
            }

            //刘诚2025-03-18增（修改日志分角色访问）
            if (self.DiyCommon.IsNull(data.DataLogRole)) {
                data.DataLogRole = "[]";
            } else if(typeof data.DataLogRole === "object") {
                data.DataLogRole = JSON.stringify(data.DataLogRole);
            }

            if (self.DiyCommon.IsNull(data.TableTabs)) {
                data.TableTabs = "[]";
            } else if(typeof data.TableTabs === "object") {
                data.TableTabs = JSON.stringify(data.TableTabs);
            }

            if (!self.DiyCommon.IsNull(data.ApiReplace) && typeof data.ApiReplace === "object") {
                data.ApiReplace = JSON.stringify(data.ApiReplace);
            }
        },
        DiyFieldJsonToStr(data) {
            var self = this;
            var needBool2Int = ["NameConfirm", "NotEmpty", "Visible", "AppVisible", "Readonly", "Unique", "InTableEdit", "IsLockField", "Encrypt"];
            needBool2Int.forEach((item) => {
                data[item] = data[item] ? 1 : 0;
            });

            //2023-08-11注释 oracle可能是使用NUMBER(11)，所以不需要这个判断
            // if (
            //     !self.DiyCommon.IsNull(data.Config) &&
            //     data.Component == 'NumberText' &&
            //     !self.DiyCommon.IsNull(data.Config.NumberTextPrecision)
            // ) {
            //     if (data.Config.NumberTextPrecision != 0) {
            //         data.Type = 'decimal(18, ' + data.Config.NumberTextPrecision + ')'
            //     } else {
            //         data.Type = 'int'
            //     }
            // }

            // 如果Data数据项不为空
            if (!self.DiyCommon.IsNull(data.Data)) {
                // 如果是object（数组、对象）
                if (typeof data.Data === "object") {
                    data.Data = JSON.stringify(data.Data);
                }
            }

            //2022-07-15新增：BaiduMapConfig属性中由于加载了地图，会多一些不需要存储的数据
            data.BaiduMapConfig = {};

            // 如果Config不为空
            if (!self.DiyCommon.IsNull(data.Config)) {
                // 如果是object（数组、对象）
                if (typeof data.Config === "object") {
                    // 仅移除非当前组件的配置块，保留未知/自定义键
                    data.Config = self.TrimForeignComponentConfig(data);

                    //是否需要判断数据源为Sql时，清空data.Data？
                    // 🔥 修复：仅在下拉类组件时才处理 DataSource
                    var selectComponents = ["Checkbox", "MultipleSelect", "Select", "Radio", "Autocomplete", "Cascader", "SelectTree"];
                    if (selectComponents.indexOf(data.Component) > -1) {
                        if (data.Config.DataSource !== "Data" && data.Config.DataSource !== "KeyValue") {
                            data.Data = "[]";
                        }
                    }
                    //2022-07-14新增：清空JoinForm的运行时值
                    //2026-02-06改进：区分设计时配置和运行时动态赋值
                    if (data.Config.JoinForm) {
                        if (data.Config.JoinForm.JoinFieldName) {
                            // 场景1：字段关联模式（设计时配置）
                            // 保留：TableId, JoinFieldName, FormMode
                            const savedTableId = data.Config.JoinForm.TableId;
                            const savedJoinFieldName = data.Config.JoinForm.JoinFieldName;
                            const savedFormMode = data.Config.JoinForm.FormMode;
                            
                            data.Config.JoinForm.TableId = savedTableId;
                            data.Config.JoinForm.JoinFieldName = savedJoinFieldName;
                            data.Config.JoinForm.FormMode = savedFormMode;
                            data.Config.JoinForm.TableName = "";
                            data.Config.JoinForm.Id = "";
                            data.Config.JoinForm._SearchEqual = {};
                        } else {
                            // 场景2：运行时动态调用（通过代码临时赋值）
                            // 清空所有值，不保存任何运行时状态
                            data.Config.JoinForm.TableId = "";
                            data.Config.JoinForm.TableName = "";
                            data.Config.JoinForm.Id = "";
                            data.Config.JoinForm.FormMode = "";
                            data.Config.JoinForm._SearchEqual = {};
                        }
                    }
                    //2024-12-16：处理将脏数据保存到了Config中
                    if (data.Config.OpenTable) {
                        data.Config.OpenTable.SearchAppend = {};
                        data.Config.OpenTable.PropsWhere = [];
                    }

                    //这里会存入带Enter的↵符号，导致后面JSON.parse报错
                    data.Config = JSON.stringify(data.Config);
                }
            }
            // 如果BindRole不为空
            if (!self.DiyCommon.IsNull(data.BindRole)) {
                // 如果是object（数组、对象）
                if (typeof data.BindRole === "object") {
                    data.BindRole = JSON.stringify(data.BindRole);
                }
            }
            // 如果dataappend不为空
            if (!self.DiyCommon.IsNull(data.DataAppend)) {
                // 如果是object（数组、对象）
                if (typeof data.DataAppend === "object") {
                    data.DataAppend = JSON.stringify(data.DataAppend);
                }
            }
        },
        TrimForeignComponentConfig(field) {
            var self = this;
            if (!field || !field.Config || typeof field.Config !== "object") {
                return field ? field.Config : {};
            }
            var component = field.Component || "";
            var cfg = lodash.cloneDeep(field.Config);
            var componentBlocks = {
                Textarea: ["Textarea"],
                ImgUpload: ["ImgUpload", "Upload"],
                FileUpload: ["FileUpload", "Upload"],
                Button: ["Button"],
                Autocomplete: ["Autocomplete"],
                Unique: ["Unique"],
                OpenTable: ["OpenTable"],
                Department: ["Department"],
                Cascader: ["Cascader"],
                SelectTree: ["SelectTree"],
                CodeEditor: ["CodeEditor"],
                RichText: ["RichText"],
                Divider: ["Divider"],
                JoinTable: ["JoinTable"],
                JoinForm: ["JoinForm"],
                TableChild: ["TableChild"],
                AutoNumber: ["AutoNumber"],
                JsonTable: ["JsonTable"],
                TreeCheckbox: ["TreeCheckbox"]
            };

            var keepBlocks = new Set(componentBlocks[component] || []);

            Object.keys(componentBlocks).forEach((comp) => {
                if (comp === component) return;
                componentBlocks[comp].forEach((key) => {
                    if (cfg && cfg.hasOwnProperty(key)) {
                        delete cfg[key];
                    }
                });
            });

            return cfg;
        },
        GetDiyFieldModel(fieldId) {
            var self = this;
            self.DiyCommon.Post(
                self.DiyApi.GetDiyFieldModel,
                {
                    Id: fieldId
                    // OsClient: self.OsClient
                },
                function (result) {
                    if (self.DiyCommon.Result(result)) {
                        self.DiyCommon.DiyFieldConfigStrToJson(result.Data);
                        self.$refs.fieldForm.DiyFieldStrToJson(result.Data);
                        self.DiyCommon.Base64DecodeDiyField(result.Data);
                        self.CurrentDiyFieldModel = result.Data;
                        self.FormDiyTableModel[self.CurrentDiyFieldModel.Name] = self.CurrentDiyFieldModel.Data;
                    }
                }
            );
        }
    }
};
</script>

<style lang="scss" scoped>
:deep(.el-tabs__item){
    span{
        display: flex;
        align-items: center;
        justify-content: center;
    }
}
.diy-design-container {
    margin-top: 10px;
    border-radius: 4px;
    height: calc(100vh - 80px);
    background-color: #fff;
    :deep(.keyword-search) {
        // border-bottom: solid 1px #ccc;
        padding-left: 20px;
        .el-form-item--mini.el-form-item {
            margin-bottom: 10px;
            margin-top: 10px;
        }
    }
}

:deep(.field-container) {
    .el-tabs__content{
        overflow: visible;//这里如果不设置，会导致设计表单时，第一行字段右上角的复制字段、删除字段等功能图标显示不全
    }
    height: calc(100vh - 135px);
    .aside {
        background: transparent;
        padding-left: 10px;
        padding-right: 10px;
        padding-top: 0;
        // height: calc(100vh - 84px);
        margin-bottom: 20px;
    }

    .aside-left {
        border-right: 1px solid #e6ebf5 !important;
        padding-bottom: 0;
        
        // vuedraggable 组件包装器样式
        .draggable-components-wrapper {
            display: contents; // 使用 display: contents 让 draggable 不影响布局
        }
    }

    .aside-right {
        border-left: 1px solid #e6ebf5 !important;
        padding-left: 0;
        padding-right: 0;
        padding-bottom: 0;
    }

    .center-main {
        // border: '1px dashed #ff6c04' 
        background-color: transparent;
        padding: 10px;
        // height: calc(100vh - 84px);
        // margin: 10px;

        .field-form {
            // height: calc(100vh - 158px);
            // border: 1px dashed #ff6c04;
            position: relative;
            padding: 15px;
            min-height: 300px; // 确保有足够的拖放区域

            // vuedraggable 拖拽时的占位符样式
            .sortable-ghost {
                opacity: 0.4;
                background: #f0f0f0;
                border: 2px dashed #ff6c04;
            }

            // vuedraggable 拖拽中的元素样式
            .sortable-drag {
                opacity: 0.8;
                border: 2px solid #ff6c04;
            }

            // 兼容旧的 dragula 样式
            .gu-transit.field-drag {
                width: 100%;
                height: 30px;
                border: 1px dashed #ff6c04;

                // background-color: #ff6c04;
                .el-tag {
                    display: none;
                }
            }

            .container-form-item {
                border: 1px solid transparent;
                width: 100%;
                // height: 33px;
                // margin-bottom: 18px;
            }

            .container-form-item:hover {
                // border: 1px dashed #ff6c04;
                cursor: pointer;
            }
            
            // 设计模式下的字段拖拽手柄
            .field-drag-handle {
                cursor: move;
            }
        }
    }

    .right-main {
        background-color: transparent;
        padding: 0;
        // height: calc(100vh - 120px); // - 50px
        margin-bottom: 0px;
        position: relative;
        overflow: hidden;

        .el-radio {
            margin-bottom: 10px;
            margin-top: 10px;
        }

        .form-setting {
            padding-left: 20px;
            padding-right: 20px;
            // padding-bottom: 85px;
            .form-item-top {
                .el-form-item__content {
                    margin-left: 0px !important;
                }
                .el-form-item__label {
                    width: 100% !important;
                    float: none;
                }
            }
            .el-form-item--mini.el-form-item {
                margin-bottom: 10px;
            }
        }

        .bottom-btns {
            .el-button + .el-button {
                margin-left: 5px;
            }
        }

        .el-divider__text {
            font-weight: bold;
        }

        .el-select.el-select--mini,
        .el-date-editor,
        .el-autocomplete {
            width: 100%;
        }
        .form-item-label-slot {
            float: none;
            margin-bottom: 5px;
            font-weight: 700;
        }
    }

    .right-footer {
        border-top: 1px solid #e6ebf5 !important;
    }

    .row-field {
        .icon {
            width: 20px;
            margin-right: 0px;
            font-size: 14px;
            // color: #ff6c04;
            // color: #171717;
        }

        .el-tag {
            width: 100%;
            height: 28px;
            text-align: left;
            line-height: 28px;
            // border-radius: 0;
            color: #171717;
            padding-left: 7px;
            // border: solid 1px rgba(255, 106, 0, 0.1);
            // background-color: rgba(255, 106, 0, 0.1);
            margin-bottom: 5px;
            // border-left: solid 2px #242B49;
            border-radius: 4px;
        }

        .el-tag:hover {
            background-color: rgba(255, 106, 0, 0.2);
            border: 1px dashed #ff6c04;
            // border-left: solid 2px #242B49;
            color: #171717;
            cursor: move;
        }
    }
}
</style>
