<template>
    <div class="pluginPage" :class="{ 'mobile-form-page': diyStore.IsPhoneView }" style="margin-top: 10px;">
        <!-- 移动端顶部导航 -->
        <div v-if="diyStore.IsPhoneView" class="mobile-form-header-bar">
            <div class="mobile-header-left">
                <el-icon class="back-icon" @click="Go_1()">
                    <ArrowLeft />
                </el-icon>
            </div>
            <div class="mobile-header-center">
                <span class="mobile-title">{{ GetOpenTitle() }}</span>
            </div>
            <div class="mobile-header-right">
                <el-dropdown trigger="click" v-if="HasMobileActions">
                    <el-icon class="more-icon">
                        <MoreFilled />
                    </el-icon>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item v-if="FormMode != 'View'" @click="SaveDiyTableCommon(true)">
                                <el-icon><SuccessFilled /></el-icon>保存
                            </el-dropdown-item>
                            <el-dropdown-item v-if="FormMode == 'View' && ShowUpdateBtn" @click="GotoEdit()">
                                <el-icon><Edit /></el-icon>编辑
                            </el-dropdown-item>
                            <template v-if="!DiyCommon.IsNull(SysMenuModel.DiyConfig) && !DiyCommon.IsNull(SysMenuModel.FormBtns) && SysMenuModel.FormBtns.length > 0">
                                <template v-for="(btn, btnIndex) in SysMenuModel.FormBtns">
                                    <el-dropdown-item
                                        :key="'mobile_btn_' + btnIndex"
                                        v-if="btn.IsVisible"
                                        @click="RunMoreBtn(btn, CurrentRowModel, CurrentRowModel._V8)"
                                    >
                                        <fa-icon :icon="'more-btn mr-1 ' + (DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon)" />
                                        {{ btn.Name }}
                                    </el-dropdown-item>
                                </template>
                            </template>
                        </el-dropdown-menu>
                    </template>
                </el-dropdown>
            </div>
        </div>
        
        <el-row>
            <el-col :span="24">
                <el-card class="box-card" :class="{ 'mobile-card': diyStore.IsPhoneView }" style="margin-bottom: 20px">
                    <!-- PC端头部 -->
                    <div class="form-header" :class="{ 'mobile-form-header': diyStore.IsPhoneView }" 
                        v-if="!diyStore.IsPhoneView"
                        style="margin-bottom: 10px;">
                        <div class="pull-left" style="font-size: 15px; font-weight: bold" v-if="!diyStore.IsPhoneView">
                            <i :class="GetOpenTitleIcon()" />
                            {{ GetOpenTitle() }}
                        </div>
                        <div class="form-actions" :class="{ 'mobile-form-actions': diyStore.IsPhoneView }">
                            <el-button v-if="FormMode != 'View'" :loading="SaveDiyTableCommonLoding" type="danger" :icon="SuccessFilled" @click="SaveDiyTableCommon(true)">
                                {{ $t("Msg.SaveBack") }}
                            </el-button>
                            <!-- $t('Msg.Add') -->
                            <el-button v-if="FormMode == 'View' && ShowUpdateBtn" :loading="SaveDiyTableCommonLoding" type="primary" :icon="Edit" @click="GotoEdit()">
                                {{ $t("Msg.Edit") }}
                            </el-button>
                            <template v-if="!DiyCommon.IsNull(SysMenuModel.DiyConfig) && !DiyCommon.IsNull(SysMenuModel.FormBtns) && SysMenuModel.FormBtns.length > 0">
                                <template v-for="(btn, btnIndex) in SysMenuModel.FormBtns">
                                    <!-- v-if="LimitMoreBtn(btn)" -->
                                    <el-button
                                        :key="'more_btn_formbtns_' + btnIndex"
                                        v-if="btn.IsVisible"
                                        type="primary"
                                        :loading="BtnLoading"
                                        @click="RunMoreBtn(btn, CurrentRowModel, CurrentRowModel._V8)"
                                    >
                                        <fa-icon :icon="'more-btn mr-1 ' + (DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon)" />
                                        {{ btn.Name }}
                                    </el-button>
                                </template>
                            </template>
                            <!-- <el-button
                            v-if="LimitDel() && FormMode != 'Add'"
                            :loading="BtnLoading"
                            type="danger"
                           
                            :icon="Delete"
                            @click="DelDiyTableRow(CurrentRowModel, 'ShowFieldForm')">{{ $t('Msg.Delete') }}</el-button> -->
                            <el-button type="default" :icon="Back" @click="Go_1()">
                                {{ $t("Msg.Back") }}
                            </el-button>
                        </div>
                    </div>
                    <DiyForm
                        ref="fieldForm"
                        :FormMode="FormMode"
                        :LoadMode="'Page'"
                        :TableId="TableId"
                        :TableRowId="TableRowId"
                        @CallbackFormSubmit="CallbackFormSubmit"
                        @CallbackSetFormData="CallbackSetFormData"
                        @CallbackSetDiyTableModel="CallbackSetDiyTableModel"
                        @CallbackGetDiyField="CallbackGetDiyField"
                        @CallbackReloadForm="CallbackReloadForm"
                        @CallbackHideFormBtn="CallbackHideFormBtn"
                        @CallbackFormValueChange="CallbackFormValueChange"
                    />
                </el-card>
            </el-col>
        </el-row>
    </div>
</template>

<script>
import { computed } from "vue";
import _ from "underscore";
import { useDiyStore, useTagsViewStore } from "@/pinia";
import merge from "deepmerge";
export default {
    name: "diy_form_page",
    components: {},
    setup() {
        const diyStore = useDiyStore();
        const tagsViewStore = useTagsViewStore();
        const GetCurrentUser = computed(() => diyStore.GetCurrentUser);
        return { diyStore, tagsViewStore, GetCurrentUser };
    },
    computed: {
        // 判断移动端是否有可用操作
        HasMobileActions() {
            var self = this;
            if (self.FormMode != 'View') return true; // 有保存按钮
            if (self.FormMode == 'View' && self.ShowUpdateBtn) return true; // 有编辑按钮
            if (!self.DiyCommon.IsNull(self.SysMenuModel.DiyConfig) && !self.DiyCommon.IsNull(self.SysMenuModel.FormBtns) && self.SysMenuModel.FormBtns.length > 0) {
                return self.SysMenuModel.FormBtns.some(btn => btn.IsVisible);
            }
            return false;
        }
    },
    data() {
        return {
            BtnLoading: false,
            BtnV8Loading: false,
            FormMode: "",
            SaveDiyTableCommonLoding: false,
            DiyFieldList: [],
            TableRowId: "",
            TableId: "",
            SysMenuId: "",
            SysMenuModel: {},
            CurrentDiyTableModel: {},
            CurrentRowModel: {},
            CallbackSetFormDataFinish: false,
            CallbackSetDiyTableModelFinish: false,
            ShowUpdateBtn: true,
            ShowDeleteBtn: true,
            ShowSaveBtn: true,
            CloseFormNeedConfirm: false
        };
    },
    async mounted() {
        var self = this;
        self.TableId = self.$route.params.TableId;
        self.TableRowId = self.$route.params.TableRowId;
        if (!self.TableRowId) {
            var guidResult = await self.DiyCommon.PostAsync("/api/DiyTable/NewGuid");
            if (guidResult.Code == 1) {
                self.TableRowId = guidResult.Data;
            }
        }
        self.FormMode = self.$route.query.FormMode;
        self.SysMenuId = self.$route.query.SysMenuId;
        if (!self.TableId || !self.FormMode) {
            self.DiyCommon.Tips("缺少参数！格式：/FormMode/TableId/TableRowId", false);
            return;
        }
        self.$nextTick(function () {
            if (self.$refs.fieldForm && typeof self.$refs.fieldForm.Init === 'function') {
                self.$refs.fieldForm.Init();
            } else {
                // 如果组件还未渲染完成，再等一帧
                setTimeout(() => {
                    if (self.$refs.fieldForm && typeof self.$refs.fieldForm.Init === 'function') {
                        self.$refs.fieldForm.Init();
                    }
                }, 300);
            }
        });
        console.log("--DiyFormPage FormBtns Test0：--", "mounted.");
    },
    methods: {
        async HandlerBtns(btns, row, v8) {
            var self = this;
            if (btns) {
                if (self.DiyCommon.IsNull(row)) {
                    row = {};
                }
                // btns.forEach(async (btn) => {
                //     var isVisible = await self.LimitMoreBtn(btn, row, v8);
                //     btn.IsVisible = isVisible;
                // });
                for (let index = 0; index < btns.length; index++) {
                    var btn = btns[index];
                    var isVisible = await self.LimitMoreBtn(btn, row, v8);
                    btn.IsVisible = isVisible;
                }
            }
            console.log("--DiyFormPage FormBtns Test2：--", btns);
        },
        async LimitMoreBtn(btn, row, v8) {
            var self = this;
            //如果V8配置了不显示
            var V8 = v8 || {};
            V8.Result = null;
            if (row && v8) {
                row._V8 = v8;
            }
            try {
                if (!self.DiyCommon.IsNull(btn.V8CodeShow)) {
                    V8.Form = row; // 当前Form表单所有字段值
                    V8.FormSet = (fieldName, value) => {
                        return self.FormSet(fieldName, value, row);
                    }; // 给Form表单其它字段赋值
                    V8.OpenForm = (row, type) => {
                        return self.OpenDetail(row, type, true);
                    };
                    V8.EventName = "​V8BtnLimit";
                    self.SetV8DefaultValue(V8);
                    await self.DiyCommon.InitV8Code(V8, self.$router);
                    // eval(btn.V8CodeShow)
                    await eval("(async () => {\n " + btn.V8CodeShow + " \n})()");
                } else {
                    //self.DiyCommon.Tips('请配置按钮V8引擎代码！', false);
                }
            } catch (error) {
                self.DiyCommon.Tips("执行前端V8引擎代码出现错误：" + error.message, false);
            }
            var result = false;
            if (V8.Result === false) {
                
                
                return false;
            }
            //------------------------------------------------------

            if (self.GetCurrentUser._IsAdmin === true) {
                
                
                return true;
            }
            var roleLimitModel = _.where(self.GetCurrentUser._RoleLimits, {
                FkId: self.SysMenuId
            });
            if (self.TableChildFormMode != "View" && roleLimitModel.length > 0) {
                roleLimitModel.forEach((element) => {
                    if (element.Permission.indexOf(btn.Id) > -1) {
                        result = true;
                    }
                });
                
                
                return result;
            }
            
            
            
            return false;
        },
        SetV8DefaultValue(V8, field) {
            var self = this;
            V8.ClientType = "PC"; //PC、IOS、Android、H5、WeChat
            V8.FormMode = self.FormMode;
            V8.DataAppend = self.DataAppend;
            V8.TableId = self.TableId;
            V8.CurrentUser = self.GetCurrentUser;
            V8.TableRowSelected = self.TableMultipleSelection;
            V8.ParentForm = self.FatherFormModel;
            if (self.ParentV8_Data) {
                V8.ParentV8 = self.ParentV8_Data;
            } else {
                V8.ParentV8 = self.ParentV8;
            }
            V8.TableRowId = self.TableRowId;
            V8.RefreshTable = self.GetDiyTableRow;
            V8.ParentFormSet = self.ParentFormSet;
            V8.ReloadForm = self.CallbackReloadForm; //(row, type) => { return self.$emit('CallbackReloadForm', row, type)},
            V8.SearchAppend = self.SearchAppendFunc;
            V8.SearchSet = self.SetV8SearchModel;
            V8.SetV8SearchModel = self.SetV8SearchModel;
            //2011-11-22注释
            // V8.Field = self.PropsParentFieldList;
            var diyFieldList = {};
            self.DiyFieldList.forEach((element) => {
                diyFieldList[element.Name] = element;
            });
            V8.Field = diyFieldList;
            V8.ShowTableChildHideField = self.ShowTableChildHideField;

            V8.FieldSet = self.FieldSet;
            V8.CurrentTableData = self.DiyTableRowList;
            // V8.GetChildTableData = '';
            V8.FormClose = self.FormClose;
        },
        FormClose() {
            var self = this;
        },
        async RunMoreBtn(btn, row, v8) {
            var self = this;
            self.BtnV8Loading = true;
            var V8 = v8 ? v8 : {};
            try {
                if (!self.DiyCommon.IsNull(btn.V8Code)) {
                    V8.Form = self.DeleteFormProperty(row); // 当前Form表单所有字段值
                    V8.FormSet = (fieldName, value) => {
                        return self.FormSet(fieldName, value, row);
                    }; // 给Form表单其它字段赋值
                    V8.OpenForm = (row, type) => {
                        return self.OpenDetail(row, type, true);
                    };
                    V8.OpenFormWF = (row, type, wfParam) => {
                        return self.OpenDetail(row, type, true, true, wfParam);
                    };
                    // V8.BtnV8Loading = self.BtnV8Loading;
                    V8.V8Callback = () => {
                        self.BtnV8Loading = false;
                    };
                    V8.EventName = "​V8BtnRun";
                    self.SetV8DefaultValue(V8);
                    await self.DiyCommon.InitV8Code(V8, self.$router);
                    // eval(btn.V8Code)
                    await eval("(async () => {\n " + btn.V8Code + " \n})()");
                    // if(!(btn.V8Code.indexOf('V8.BtnV8Loading') > -1)){
                    if (!(btn.V8Code.indexOf("V8.V8Callback") > -1)) {
                        self.BtnV8Loading = false;
                    }
                } else {
                    //self.DiyCommon.Tips('请配置按钮V8引擎代码！', false);
                    self.BtnV8Loading = false;
                }
            } catch (error) {
                self.DiyCommon.Tips("执行前端V8引擎代码出现错误：" + error.message, false);
                self.BtnV8Loading = false;
            } finally {
                
                
            }
        },
        DeleteFormProperty(form) {
            Reflect.deleteProperty(form, "_RowMoreBtnsOut");
            Reflect.deleteProperty(form, "_RowMoreBtnsIn");
            return form;
        },
        GotoEdit() {
            var self = this;
            // self.$router.replace({
            //     query: merge(self.$route.query, { FormMode: "Edit" })
            // });
            // self.FormMode = self.$route.query.FormMode;
            self.FormMode = 'Edit';
            self.$nextTick(function () {
                // self.$refs.fieldForm.Init();
            });
        },
        LimitDel() {
            var self = this;
            //超级管理员有所有权限
            if (self.GetCurrentUser._IsAdmin) {
                return true;
            }
            //这里还需要SysMenuId参数才能判断权限
            if (self.SysMenuId) {
                var roleLimitModel = _.find(self.GetCurrentUser._RoleLimits, function (item) {
                    return item.FkId == self.SysMenuId;
                });
                if (roleLimitModel) {
                    return true;
                }
            }
            return false;
        },
        tabClickField() {},

        SaveDiyTableCommon(isBack) {
            var self = this;
            try {
                self.SaveDiyTableCommonLoding = true;

                var param = {};
                var url = self.DiyApi.AddDiyTableRow;
                if (!self.DiyCommon.IsNull(self.TableRowId)) {
                    url = self.DiyApi.UptDiyTableRow;
                    param._TableRowId = self.TableRowId;
                }
                param.FormMode = self.FormMode;
                param.SavedType = "Edit";
                self.$refs.fieldForm.FormSubmit(param, async function (success, formData, outFormV8Result) {
                    if (success == true) {
                        if (isBack === true && outFormV8Result.Result !== false) {
                            self.Go_1();
                        } else {
                            self.FormMode = "Edit";
                        }
                    }
                    self.SaveDiyTableCommonLoding = false;
                });
            } catch (error) {
                self.SaveDiyTableCommonLoding = false;
                throw error;
            }
        },
        Go_1() {
            var self = this;
            // 🔥 移动端不删除视图缓存，避免影响列表页的 keep-alive 状态
            // PC端需要删除，因为有 TagsView 标签页管理
            if (!self.diyStore.IsPhoneView) {
                self.tagsViewStore.delView(self.$route);
            }
            self.$router.go(-1);
        },
        GetOpenTitleIcon() {
            var self = this;
            return self.DiyCommon.IsNull(self.CurrentRowModel) || self.DiyCommon.IsNull(self.CurrentRowModel.Id) ? "fas fa-plus" : "far fa-edit";
        },
        GetOpenTitle() {
            var self = this;
            var result = "";
            if (self.FormMode) {
                var formMode = self.$t("Msg." + self.FormMode);
                var firstValue = "";
                if (self.FormMode == "Edit" || self.FormMode == "View") {
                    var fieldModel = self.DiyFieldList[0];
                    if (fieldModel && self.CurrentRowModel[fieldModel.Name]) {
                        firstValue = "[" + self.CurrentRowModel[fieldModel.Name] + "]";
                    }
                }
                var tableName = self.DiyCommon.IsNull(self.CurrentDiyTableModel) || self.DiyCommon.IsNull(self.CurrentDiyTableModel.Description) ? "" : " - " + self.CurrentDiyTableModel.Description;

                result = formMode + firstValue + tableName;
                if ((self.CallbackSetFormDataFinish && self.CallbackSetDiyTableModelFinish) || (self.FormMode == "Add" && self.CallbackSetDiyTableModelFinish)) {
                    // var item = this.tagsViewStore.visitedViews.filter(item => item.name == 'diy_form_page_' + (self.FormMode == 'Add' ? 'add' : 'edit'))
                    var item = self.tagsViewStore.visitedViews.filter((item) => item.fullPath == self.$route.fullPath);
                    if (item.length > 0) {
                        item[0].title = result;
                    }
                }
            }
            return result;
        },
        CallbackGetDiyField(diyFieldList) {
            var self = this;
            self.DiyFieldList = diyFieldList;
        },
        CallbackSetFormData(formData) {
            var self = this;
            self.CurrentRowModel = formData;
            self.CallbackSetFormDataFinish = true;

            if (self.SysMenuId) {
                self.DiyCommon.Post(
                    "/api/FormEngine/GetFormData-sysmenu",
                    {
                        FormEngineKey: "Sys_Menu",
                        Id: self.SysMenuId
                    },
                    async function (result) {
                        if (self.DiyCommon.Result(result)) {
                            self.DiyCommon.ForConvertSysMenu(result.Data);
                            self.SysMenuModel = result.Data;
                            console.log("--DiyFormPage FormBtns Test1：--", self.SysMenuModel.FormBtns);
                            await self.HandlerBtns(self.SysMenuModel.FormBtns, self.CurrentRowModel, {}); //V8
                            console.log("--DiyFormPage FormBtns Test3：--", self.SysMenuModel.FormBtns);
                        }
                    }
                );
            }
        },
        CallbackSetDiyTableModel(model) {
            var self = this;
            self.CurrentDiyTableModel = model;
            self.CallbackSetDiyTableModelFinish = true;
        },
        CallbackFormSubmit(param) {
            var self = this;
            self.SaveDiyTableCommon(param);
        },
        CallbackReloadForm(row, type) {
            var self = this;
            //tableRowModel, formMode, isDefaultOpen
            // self.OpenDetail(row, type);
            self.$refs.fieldForm.Init();
        },
        CallbackHideFormBtn(btn) {
            var self = this;
            self["Show" + btn + "Btn"] = false;
        },
        // 表单值变化回调
        CallbackFormValueChange(field, value) {
            var self = this;
            if (self.FormMode !== "View") {
                self.CloseFormNeedConfirm = true;
            }
        },
        // 给表单字段赋值
        FormSet(fieldName, value, row) {
            var self = this;
            if (row) {
                row[fieldName] = value;
            } else if (self.CurrentRowModel) {
                self.CurrentRowModel[fieldName] = value;
            }
        },
        // 设置字段属性
        FieldSet(fieldName, attrName, value) {
            var self = this;
            self.DiyFieldList.forEach((element) => {
                if (element.Name === fieldName) {
                    element[attrName] = value;
                }
            });
        },
        // 打开表单详情
        OpenDetail(row, type, isDefaultOpen) {
            var self = this;
            if (row && row.Id) {
                var url = `/diy/form-page/${self.TableId}/${row.Id}?FormMode=${type}&SysMenuId=${self.SysMenuId}`;
                self.$router.push(url);
            }
        },
        // 显示/隐藏子表字段
        ShowTableChildHideField(fieldName, fields) {
            var self = this;
            // 暂不支持在form-page中操作子表
        },
        // 父表字段赋值
        ParentFormSet(fieldName, value) {
            var self = this;
            // form-page 模式下没有父表
        },
        // 搜索追加
        SearchAppendFunc(val) {
            var self = this;
            // form-page 模式下不支持搜索
        },
        // 设置搜索模型
        SetV8SearchModel(val) {
            var self = this;
            // form-page 模式下不支持搜索
        },
        // 刷新表格（占位方法）
        GetDiyTableRow() {
            var self = this;
            // form-page 模式下无表格，返回后由列表页自动刷新
        }
    }
};
</script>

<style lang="scss" scoped>
.panel-group {
    margin-bottom: 0px;
}

.field-form {
    min-height: 100px;
}

.panel-group .card-panel-col {
    margin-bottom: 10px !important;
}

.dashboard-editor-container {
    padding: 20px;
    background-color: rgb(240, 242, 245);
    position: relative;
    height: calc(100vh - 84px);
    background-color: transparent;
    padding-top: 0px;

    .github-corner {
        position: absolute;
        top: 0px;
        border: 0;
        right: 0;
    }

    .chart-wrapper {
        background: #fff;
        padding: 16px 16px 0;
        margin-bottom: 32px;
    }
}

@media (max-width: 1024px) {
    .chart-wrapper {
        padding: 8px;
    }
}

// 移动端表单页面样式
.mobile-form-page {
    padding: 0 !important;
    background: #f5f7fa;
    min-height: 100vh;
    padding-top: 56px !important; // 为固定头部留出空间
    
    .el-row {
        margin: 0 !important;
    }
    
    .el-col {
        padding: 0 !important;
    }
    
    .mobile-card {
        margin: 0 !important;
        border-radius: 0;
        border: none;
        box-shadow: none;
        
        :deep(.el-card__body) {
            padding: 10px;
            .field-form{
                padding: 0;
            }
        }
    }
    
    .mobile-form-header {
        display: none; // 隐藏PC端头部
    }
    
    .mobile-form-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
        
        .el-button {
            margin: 0 !important;
            padding: 8px 16px;
            font-size: 14px;
        }
    }
    
    .mobile-form-title {
        padding: 16px;
        font-size: 16px;
        font-weight: 600;
        color: #303133;
        background: #fff;
        border-bottom: 1px solid #f0f0f0;
        
        i {
            margin-right: 8px;
            color: var(--color-primary, #409eff);
        }
    }
    
    // 表单内容区域
    :deep(.el-form) {
        padding: 10px;
        
        .el-form-item {
            margin-bottom: 16px;
        }
        
        .el-form-item__label {
            font-size: 14px;
            color: #606266;
        }
        
        .el-input,
        .el-select,
        .el-textarea {
            width: 100%;
        }
    }
}

// 表单头部默认样式
.form-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
}

.form-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

// 移动端顶部导航栏样式
.mobile-form-header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: #fff;
    border-bottom: 1px solid #f0f0f0;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    
    .mobile-header-left,
    .mobile-header-right {
        flex: 0 0 40px;
        display: flex;
        align-items: center;
        
        .back-icon,
        .more-icon {
            font-size: 20px;
            cursor: pointer;
            color: #333;
            
            &:active {
                opacity: 0.6;
            }
        }
    }
    
    .mobile-header-center {
        flex: 1;
        text-align: center;
        overflow: hidden;
        
        .mobile-title {
            font-size: 16px;
            font-weight: 600;
            color: #333;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            display: block;
        }
    }
    
    .mobile-header-right {
        justify-content: flex-end;
    }
}
</style>
