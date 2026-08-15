<template>
    <div class="left-tree-view">
        <!-- 头部区域 -->
        <!-- 表单对话框组件 -->
        <DiyFormDialog ref="refDiyTable_DiyFormDialog" @CallbackGetDiyTableRow="handleFormClosed"></DiyFormDialog>

        <!-- 弹出表格对话框 -->
        <el-dialog
            v-if="ShowAnyTable && !IsOpenAnyTableDrawer()"
            draggable
            align-center
            :modal="true"
            :width="GetOpenAnyTableWidth()"
            :modal-append-to-body="true"
            :append-to-body="true"
            v-model="ShowAnyTable"
            :close-on-click-modal="false"
            :close-on-press-escape="false"
            :destroy-on-close="true"
            :show-close="false"
            class="dialog-opentable"
        >
            <!-- 对话框标题区域 -->
            <template #header
                ><div>
                    <div class="pull-left" style="color: rgb(0, 0, 0); font-size: 15px">
                        <fa-icon :icon="'fas fa-table'" />
                        弹出表格
                    </div>
                    <div class="pull-right">
                        <el-button :loading="BtnLoading" type="primary" :icon="CircleCheck" @click="RunOpenAnyTableSubmitEvent()">
                            {{ $t("Msg.Submit") }}
                        </el-button>
                        <el-button :icon="Close" @click="ShowAnyTable = false">
                            {{ $t("Msg.Close") }}
                        </el-button>
                    </div>
                    <div class="clear"></div></div
            ></template>

            <!-- 表格内容区域 -->
            <div class="clear">
                <DiyTable
                    :TypeFieldName="OpenAnyTableParam.SysMenuId || OpenAnyTableParam.ModuleEngineKey"
                    :ref="'refOpenAnyTable_' + (OpenAnyTableParam.SysMenuId || OpenAnyTableParam.ModuleEngineKey)"
                    :key="'refOpenAnyTable_' + (OpenAnyTableParam.SysMenuId || OpenAnyTableParam.ModuleEngineKey)"
                    :PropsTableType="'OpenTable'"
                    :PropsSysMenuId="OpenAnyTableParam.SysMenuId"
                    :PropsModuleEngineKey="OpenAnyTableParam.ModuleEngineKey"
                    :EnableMultipleSelect="OpenAnyTableParam.MultipleSelect"
                    :PropsWhere="OpenAnyTableParam.PropsWhere"
                />
            </div>
        </el-dialog>

        <!-- 分类标题和操作按钮 -->
        <el-drawer
            v-if="ShowAnyTable && IsOpenAnyTableDrawer()"
            v-model="ShowAnyTable"
            :modal="true"
            :size="GetOpenAnyTableWidth()"
            :direction="GetOpenAnyTableDrawerDirection()"
            :append-to-body="true"
            :close-on-click-modal="false"
            :close-on-press-escape="false"
            :destroy-on-close="true"
            :show-close="false"
            class="drawer-opentable"
        >
            <template #header
                ><div>
                    <div class="pull-left" style="color: rgb(0, 0, 0); font-size: 15px">
                        <fa-icon :icon="'fas fa-table'" />
                        弹出表格
                    </div>
                    <div class="pull-right">
                        <el-button :loading="BtnLoading" type="primary" :icon="CircleCheck" @click="RunOpenAnyTableSubmitEvent()">
                            {{ $t("Msg.Submit") }}
                        </el-button>
                        <el-button :icon="Close" @click="ShowAnyTable = false">
                            {{ $t("Msg.Close") }}
                        </el-button>
                    </div>
                    <div class="clear"></div></div
            ></template>

            <div class="clear">
                <DiyTable
                    :TypeFieldName="OpenAnyTableParam.SysMenuId || OpenAnyTableParam.ModuleEngineKey"
                    :ref="'refOpenAnyTable_' + (OpenAnyTableParam.SysMenuId || OpenAnyTableParam.ModuleEngineKey)"
                    :key="'refOpenAnyTable_' + (OpenAnyTableParam.SysMenuId || OpenAnyTableParam.ModuleEngineKey)"
                    :PropsTableType="'OpenTable'"
                    :PropsSysMenuId="OpenAnyTableParam.SysMenuId"
                    :PropsModuleEngineKey="OpenAnyTableParam.ModuleEngineKey"
                    :EnableMultipleSelect="OpenAnyTableParam.MultipleSelect"
                    :PropsWhere="OpenAnyTableParam.PropsWhere"
                />
            </div>
        </el-drawer>

        <div class="left-tree-toolbar">
            <div class="left-tree-title">
                <el-icon class="mr-2"><Operation /></el-icon>
                {{ LeftTreeData.ShubiaoT || "分类" }}
            </div>
            <div class="left-tree-actions">
            <el-button type="primary" @click="OpenPageConfig()" v-if="GetCurrentUser.Level >= 9999">页面配置 </el-button>
            <el-button type="primary" @click="OpenAnyForm({}, '')" v-if="LeftTreeData.ShudingJXZ === 1">添加分类 </el-button>
            <el-button style="margin-left: 5px" @click="refreshTree" v-if="LeftTreeData.ShushuaX === 1">刷新 </el-button>
            </div>
        </div>

        <!-- 树形控件容器 -->
        <div class="tree-container">
            <!-- 搜索区域 -->
            <div style="margin-top: 15px">
                <el-input
                    placeholder="请输入内容"
                    v-model="TreeData.SearchFormData.inputText"
                    class="input-with-select"
                    v-if="LeftTreeData.ShumoHSS === 1"
                    clearable
                    @change="TreeSearch('inputText')"
                    @clear="ClearTreeSearch"
                    @keyup.enter="TreeSearch('enter')"
                >
                    <template #prepend>
                        <el-select v-model="TreeData.SearchFormData.selectText" placeholder="请选择" v-if="LeftTreeData.ShuxiaLSS === 1" style="width: 110px" @change="TreeSearch('selectText')">
                            <el-option v-for="item in options" :key="item.value" :label="item.label" :value="item.value"> </el-option>
                        </el-select>
                    </template>
                    <template #append>
                        <div class="tree-search-buttons">
                            <el-button :icon="Search" v-if="LeftTreeData.ShusouSAN === 1" @click="TreeSearch('button')"></el-button>
                            <el-button :icon="Close" v-if="HasTreeSearchValue" @click="ClearTreeSearch"></el-button>
                        </div>
                    </template>
                </el-input>
            </div>

            <!-- 树形控件 -->
            <div
                class="custom-tree-wrapper"
                v-mci-loading:tree="TreeLoading"
            >
                <div class="custom-tree-scroll">
                    <div
                        class="tree-all-node"
                        :class="{ 'is-active': CurrentCategoryId === '__all' }"
                        @click="handleAllCategoryClick"
                    >
                        <span>全部</span>
                    </div>
                    <el-tree
                        :data="TreeData.categories"
                        :props="TreeData.defaultProps"
                        node-key="Id"
                        :highlight-current="true"
                        :filter-node-method="filterNode"
                        :default-expanded-keys="TreeData.ExpandedKeys"
                        :default-checked-keys="TreeData.CheckedKeys"
                        :expand-on-click-node="false"
                        :load="lazy ? loadNode : null"
                        @node-click="handleCategoryClick"
                        :lazy="lazy"
                        :empty-text="TreeLoading ? '' : '暂无数据'"
                        :key="'tree-' + lazy + '-' + TreeData.treeRenderKey"
                        ref="categoryTree"
                    >
                        <!-- 自定义树节点 -->
                        <template #default="{ node, data }">
                            <span class="custom-tree-node">
                                <span>{{ node.label }}</span>
                                <span class="tree-actions">
                                    <el-button
                                        type="text"
                                        :icon="Plus"
                                        @click.stop="OpenAnyForm(data, 'Add', 'Child')"
                                        title="添加子分类"
                                        v-if="LeftTreeData.ShuxinZ === 1 && ShowButton(data, 'Insert') && canShowAddChildButton(node)"
                                    ></el-button>
                                    <el-button
                                        type="text"
                                        :icon="Edit"
                                        @click.stop="OpenAnyForm(data, 'Edit', 'Child')"
                                        title="编辑分类"
                                        v-if="LeftTreeData.ShubianJ === 1 && ShowButton(data, 'Update')"
                                    ></el-button>
                                    <el-button
                                        type="text"
                                        :icon="Delete"
                                        v-if="!data._HasChild && LeftTreeData.ShushanC && ShowButton(data, 'Delete')"
                                        title="删除分类"
                                        @click.stop="DeleteNode(data)"
                                    ></el-button>
                                </span>
                            </span>
                        </template>
                    </el-tree>
                </div>
            </div>
            <div class="tree-pagination" v-if="TreePage.DataCount > 0">
                <el-pagination
                    background
                    small
                    layout="total, sizes, prev, pager, next"
                    :current-page="TreePage.PageIndex"
                    :page-size="TreePage.PageSize"
                    :page-sizes="TreePage.PageSizes"
                    :pager-count="5"
                    :total="TreePage.DataCount"
                    @size-change="handleTreePageSizeChange"
                    @current-change="handleTreePageChange"
                />
            </div>
        </div>
    </div>
</template>

<script>
import { computed, defineAsyncComponent } from "vue";
import { useDiyStore } from "@/pinia";

// 🔥 改为异步导入，避免循环依赖和初始化顺序问题
const DiyFormDialog = defineAsyncComponent(() => import("@/views/form-engine/diy-form-full.vue"));

export default {
    components: {
        DiyFormDialog
    },
    setup() {
        const diyStore = useDiyStore();
        const GetCurrentUser = computed(() => diyStore.GetCurrentUser);
        return { diyStore, GetCurrentUser };
    },
    props: {
        LeftTreeData: {
            type: Object,
            default() {
                return {};
            }
        }
    },
    computed: {
        HasTreeSearchValue() {
            return !this.DiyCommon.IsNull(this.TreeData.SearchFormData.inputText) || !this.DiyCommon.IsNull(this.TreeData.SearchFormData.selectText);
        }
    },
    data() {
        return {
            lazy: false,
            TreeLoading: false,
            TreeRequestId: 0,
            TreePage: {
                PageIndex: 1,
                PageSize: 20,
                PageSizes: [15, 20, 30, 50, 100],
                DataCount: 0
            },
            TreeData: {
                SearchFormData: {
                    inputText: "",
                    selectText: ""
                },
                categories: [],
                defaultProps: {
                    children: "_Child",
                    label: this.LeftTreeData.ShuxianSZDM,
                    isLeaf: "_HasChild"
                },
                ExpandedKeys: [],
                CheckedKeys: [],
                treeRenderKey: 0
            },
            OpenAnyTableParam: {},
            ShowAnyTable: false,
            BtnLoading: false,
            options: [],
            CurrentCategoryId: "__all"
        };
    },
    async created() {
        await this.getOption();
        await this.treeData();
    },
    methods: {
        IsOpenAnyTableDrawer() {
            var param = this.OpenAnyTableParam || {};
            var dialogType = param.DialogType || param.OpenType || param.Type || "";
            return String(dialogType).toLowerCase() === "drawer";
        },
        GetOpenAnyTableWidth() {
            var param = this.OpenAnyTableParam || {};
            var width = param.Width || param.DialogWidth || param.DrawerWidth || param.Size;
            return this.NormalizeOpenAnyTableSize(width, "80%");
        },
        GetOpenAnyTableDrawerDirection() {
            var param = this.OpenAnyTableParam || {};
            var direction = String(param.Direction || param.DrawerDirection || "rtl").toLowerCase();
            return ["rtl", "ltr", "ttb", "btt"].includes(direction) ? direction : "rtl";
        },
        NormalizeOpenAnyTableSize(value, fallback) {
            if (typeof value === "number" && value > 0) {
                return value + "px";
            }
            if (typeof value !== "string") {
                return fallback;
            }
            var size = value.trim();
            if (!size) {
                return fallback;
            }
            if (/^\d+(\.\d+)?$/.test(size)) {
                return size + "px";
            }
            if (/^\d+(\.\d+)?(px|%|vw)$/i.test(size)) {
                return size;
            }
            return fallback;
        },
        // 打开页面配置表单
        OpenPageConfig() {
            var param = {
                TableName: "diy_LeftJoinRightView",
                FormMode: "Edit",
                Id: this.LeftTreeData.Id,
                DialogType: "Drawer",
                Width: "765px"
            };
            this.handleFormOpen(param);
        },

        // 节点过滤方法
        filterNode(value, data) {
            if (!value) return true;
            var label = data[this.TreeData.defaultProps.label] || data.Name || "";
            return String(label).indexOf(value) !== -1;
        },
        ApplyTreeData(data) {
            this.TreeData.categories = this.NormalizeTreeData(Array.isArray(data) ? data : []);
            this.TreeData.treeRenderKey++;
        },
        NormalizeTreeData(data) {
            var self = this;
            if (!Array.isArray(data)) return [];
            data.forEach(function (item) {
                if (!item) return;
                item._HasChild = item._HasChild ? true : false;
                if (Array.isArray(item._Child) && item._Child.length > 0) {
                    self.NormalizeTreeData(item._Child);
                }
            });
            return data;
        },

        // 获取树形数据
        async treeData() {
            var self = this;
            var requestId = ++self.TreeRequestId;
            self.TreeLoading = true;
            try {
                if (self.LeftTreeData.ChushiHDM) {
                    var V8 = {
                        Form: {
                            ...this.TreeData.SearchFormData,
                            _PageIndex: self.TreePage.PageIndex,
                            _PageSize: self.TreePage.PageSize
                        }
                    };
                    self.SetV8DefaultValue(V8);
                    await self.DiyCommon.InitV8Code(V8, self.$router);
                    await eval("(async () => {\n " + self.LeftTreeData.ChushiHDM + " \n})()");
                    var result = V8.Result;
                    if (requestId !== self.TreeRequestId) return;
                    self.ApplyPagedTreeResult(result);
                } else {
                    var ShuxingGLCD = JSON.parse(self.LeftTreeData.ShuxingGLCD);
                    const res = await new Promise((resolve) => {
                        self.DiyCommon.Post(
                            self.DiyCommon.GetApiBase() + "/api/FormEngine/GetDiyTableRowTree",
                            {
                                ModuleEngineKey: ShuxingGLCD[ShuxingGLCD.length - 1],
                                _PageIndex: self.TreePage.PageIndex,
                                _PageSize: self.TreePage.PageSize,
                                Keyword: self.TreeData.SearchFormData.inputText || ""
                            },
                            function (response) {
                                resolve(response);
                            }
                        );
                    });
                    if (requestId !== self.TreeRequestId) return;
                    self.ApplyPagedTreeResult(res);
                }
            } catch (error) {
                if (requestId === self.TreeRequestId) {
                    self.DiyCommon.Tips("执行初始化V8引擎代码出现错误：" + error.message, false);
                }
            } finally {
                if (requestId === self.TreeRequestId) {
                    self.TreeLoading = false;
                }
            }
        },
        ApplyPagedTreeResult(result) {
            var data = result && Array.isArray(result.Data) ? result.Data : [];
            var total = Number(result && result.DataCount);
            this.TreePage.DataCount = Number.isFinite(total) && total >= 0 ? total : data.length;
            this.ApplyTreeData(data);
        },

        // 获取下拉选项
        async getOption() {
            var self = this;
            if (self.LeftTreeData.ShuXiaLSJHQ) {
                var V8 = {
                    Form: this.TreeData.SearchFormData
                };
                self.SetV8DefaultValue(V8);
                await self.DiyCommon.InitV8Code(V8, self.$router);
                try {
                    await eval("(async () => {\n " + self.LeftTreeData.ShuXiaLSJHQ + " \n})()");
                    var result = V8.Result;
                    self.options = result.Data;
                    this.TreeData.SearchFormData.selectText = result.Value;
                } catch (error) {
                    self.DiyCommon.Tips("执行树下拉数据获取V8引擎代码出现错误：" + error.message, false);
                } finally {
                    
                    
                }
            }
        },

        // 树搜索方法
        async TreeSearch(origin) {
            var self = this;
            if (!self.HasTreeSearchValue) {
                await self.ClearTreeSearch();
                return;
            }
            self.TreePage.PageIndex = 1;
            if (self.LeftTreeData.ChufaSJ) {
                var V8 = {
                    Origin: origin,
                    Form: {
                        ...this.TreeData.SearchFormData,
                        _PageIndex: self.TreePage.PageIndex,
                        _PageSize: self.TreePage.PageSize
                    }
                };
                self.SetV8DefaultValue(V8);
                await self.DiyCommon.InitV8Code(V8, self.$router);
                try {
                    await eval("(async () => {\n " + self.LeftTreeData.ChufaSJ + " \n})()");
                    var result = await V8.Result;
                    if (result && Array.isArray(result.Data)) {
                        self.ApplyPagedTreeResult(result);
                    }
                } catch (error) {
                    self.DiyCommon.Tips("执行搜索触发V8引擎代码出现错误：" + error.message, false);
                } finally {
                    
                    
                }
            } else if (self.LeftTreeData.ChushiHDM) {
                await self.treeData();
            } else if (self.$refs.categoryTree && self.$refs.categoryTree.filter) {
                self.$refs.categoryTree.filter(self.TreeData.SearchFormData.inputText || "");
            }
        },
        async ClearTreeSearch() {
            var self = this;
            self.TreeData.SearchFormData.inputText = "";
            self.TreeData.SearchFormData.selectText = "";
            self.TreePage.PageIndex = 1;
            await self.treeData();
            self.$nextTick(function () {
                if (self.$refs.categoryTree) {
                    if (self.$refs.categoryTree.filter) {
                        self.$refs.categoryTree.filter("");
                    }
                    if (self.CurrentCategoryId === "__all" && self.$refs.categoryTree.setCurrentKey) {
                        self.$refs.categoryTree.setCurrentKey(null);
                    }
                }
            });
        },

        // 设置V8默认值
        SetV8DefaultValue(V8, field) {
            var self = this;
            V8.ClientType = self.DiyCommon ? self.DiyCommon.GetClientType() : "PC";
            V8.CurrentUser = self.GetCurrentUser;
            V8.OpenAnyTable = this.OpenAnyTable;
            return V8;
        },
        // 处理分类节点点击事件
        handleCategoryClick(data) {
            this.CurrentCategoryId = data && data.Id ? data.Id : "";
            this.$emit("LeftViewClick", data);
        },
        handleAllCategoryClick() {
            this.CurrentCategoryId = "__all";
            if (this.$refs.categoryTree && this.$refs.categoryTree.setCurrentKey) {
                this.$refs.categoryTree.setCurrentKey(null);
            }
            this.$emit("LeftViewClick", { _IsAllCategory: true, Id: "", Name: "全部" });
        },
        ShowRightClick(item) {
            this.$emit("ShowRightClick", item);
        },
        // 懒加载方法
        async loadNode(node, resolve) {
            var self = this;
            if (node.level === 0) {
                return resolve([{ name: "region" }]);
            }
            if (self.LeftTreeData.LanjiaZDM) {
                var V8 = {
                    Form: {
                        ...node.data,
                        ...this.TreeData.SearchFormData
                    }
                };
                self.SetV8DefaultValue(V8);
                await self.DiyCommon.InitV8Code(V8, self.$router);
                try {
                    await eval("(async () => {\n " + self.LeftTreeData.LanjiaZDM + " \n})()");
                    var result = await V8.Result;
                    resolve(result.Data);
                } catch (error) {
                    self.DiyCommon.Tips("执行懒加载V8引擎代码出现错误：" + error.message, false);
                } finally {
                    
                    
                }
            } else {
                return resolve([]);
            }
        },

        // 打开表格方法
        OpenAnyTable(param) {
            var self = this;
            param = param || {};
            if (!param.SysMenuId && !param.ModuleEngineKey) {
                self.DiyCommon.Tips("SysMenuId或ModuleEngineKey必传！", false);
                return;
            }
            self.OpenAnyTableParam = param;
            self.ShowAnyTable = true;
        },

        // 执行表格提交事件
        RunOpenAnyTableSubmitEvent() {
            var self = this;
            var tableRef = self.$refs["refOpenAnyTable_" + (self.OpenAnyTableParam.SysMenuId || self.OpenAnyTableParam.ModuleEngineKey)];
            var selectData = self.OpenAnyTableParam.MultipleSelect === false ? tableRef.TableSelectedRow : tableRef.TableMultipleSelection;
            self.OpenAnyTableParam.SubmitEvent(selectData, function () {
                self.ShowAnyTable = false;
            });
        },

        // 打开表单方法
        handleFormOpen(param) {
            this.$refs.refDiyTable_DiyFormDialog.Init(param);
        },

        // 表单关闭回调
        async handleFormClosed() {
            this.refreshTree();
            // 表单关闭后的处理逻辑
        },

        // 刷新树
        refreshTree() {
            this.treeData();
        },
        async handleTreePageChange(pageIndex) {
            this.TreePage.PageIndex = pageIndex;
            await this.treeData();
        },
        async handleTreePageSizeChange(pageSize) {
            this.TreePage.PageSize = pageSize;
            this.TreePage.PageIndex = 1;
            await this.treeData();
        },

        // 删除节点
        DeleteNode(data) {
            var self = this;
            var labelField = self.TreeData.defaultProps.label || 'Name';
            var title = data[labelField] || data.Name || '';
            self.DiyCommon.OsConfirm(self.$t("Msg.ConfirmDelTo") + "【" + title + "】？", function () {
                self.DiyCommon.Post(
                    self.DiyApi.DelDiyTableRow,
                    {
                        FormEngineKey: self.LeftTreeData.GuanlianBD,
                        Id: data.Id
                    },
                    function (result) {
                        if (self.DiyCommon.Result(result)) {
                            self.DiyCommon.Tips(self.$t("Msg.Success"));
                            self.refreshTree();
                        }
                    }
                );
            });
        },
        // 打开表单
        OpenAnyForm(ParentData, FormMode, origin) {
            var self = this;
            var param = {
                TableName: this.LeftTreeData.GuanlianBD,
                FormMode: FormMode,
                Id: FormMode === "Add" ? "" : ParentData.Id,
                DialogType: this.LeftTreeData.TanchuangLX || "Dialog",
                Width: this.LeftTreeData.TanchuangDX || "765px"
            };
            if (origin === "Child" && FormMode === "Add") {
                Object.assign(
                    param,
                    {
                        DataAppend: {
                            ParentField: this.LeftTreeData.FubiaoGLZD,
                            ParentData: ParentData
                        }
                    },
                    {
                        EventReplace: {
                            Submit: async function (v8, data, callback) {
                                var result = await v8.FormEngine.AddFormData(data.FormEngineKey, {
                                    ...data._FormData
                                });
                                callback(result);
                            }
                        }
                    }
                );
            }
            this.handleFormOpen(param);
        },
        ShowButton(data, type) {
            var self = this;
            if (self.LeftTreeData.JiedianANXSSJ) {
                var V8 = {
                    FormSubmitAction: type,
                    Form: data
                };
                self.SetV8DefaultValue(V8);
                self.DiyCommon.InitV8Code(V8, self.$router);
                var result = true;
                try {
                    eval("(async () => {\n " + self.LeftTreeData.JiedianANXSSJ + " \n})()");
                    result = V8.Result;
                } catch (error) {
                    self.DiyCommon.Tips("执行节点按钮显示V8事件引擎代码出现错误：" + error.message, false);
                    result = false;
                } finally {
                    
                }
                return result;
            } else {
                return true;
            }
        },
        // 判断是否可以显示添加子分类按钮（根据层级限制）
        canShowAddChildButton(node) {
            var self = this;
            // 获取层级限制值，默认为0（无限制）
            var tianjiaCJ = self.LeftTreeData.TianjiaCJ || 0;

            // 0代表无限制，所有节点都显示
            if (tianjiaCJ === 0) {
                return true;
            }

            // 获取节点层级（Element UI的tree组件中，node.level表示层级，从1开始）
            var nodeLevel = node.level || 1;

            // 1代表只有第一级节点显示（level === 1）
            if (tianjiaCJ === 1) {
                return nodeLevel === 1;
            }

            // 2代表只有第一级和第二级节点显示（level === 1 或 level === 2）
            if (tianjiaCJ === 2) {
                return nodeLevel === 1 || nodeLevel === 2;
            }

            // 其他值按无限制处理
            return true;
        }
    }
};
</script>

<style scoped>
/* 主容器样式 */

.main-container {
    height: calc(100vh - 40px);
}

.left-tree-view {
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.left-tree-toolbar {
    flex: 0 0 auto;
    min-height: 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.left-tree-title {
    min-width: 0;
    display: flex;
    align-items: center;
    font-size: 14px;
    line-height: 32px;
    color: var(--el-text-color-primary);
    white-space: nowrap;
}

.left-tree-actions {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 6px;
}

.left-tree-actions .el-button + .el-button {
    margin-left: 0;
}

/* 树形容器样式 - 添加滚动条 */
.tree-container {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    width: 100%;
    margin-top: 10px;
}

/* 自定义树形控件包装器 */
.custom-tree-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid #ebeef5;
    border-radius: 4px;
    margin-top: 10px;
    margin-bottom: 0;
}

.tree-pagination {
    flex: 0 0 auto;
    display: flex;
    justify-content: center;
    padding: 8px 0 0;
    overflow: visible;
}

.tree-pagination :deep(.el-pagination) {
    width: 100%;
    flex-wrap: wrap;
    justify-content: center;
    row-gap: 6px;
    white-space: normal;
}

/* 树形控件滚动区域 */
.custom-tree-scroll {
    flex: 1;
    overflow: auto;
    padding: 5px;
    width: 100%;
    min-width: 0; /* 修复flex容器中的最小宽度问题 */
    /* 新增修复代码 */
    position: relative;
}
.tree-all-node {
    display: flex;
    align-items: center;
    height: 30px;
    padding: 0 8px 0 24px;
    font-size: 13px;
    color: var(--el-text-color-primary);
    cursor: pointer;
    border-radius: 4px;
    white-space: nowrap;
}
.tree-all-node:hover,
.tree-all-node.is-active {
    background: var(--el-fill-color-light);
    color: var(--el-color-primary);
}
.tree-search-buttons {
    display: inline-flex;
    align-items: center;
}
.tree-search-buttons .el-button + .el-button {
    margin-left: 0;
}
/* 树节点容器 - 关键修改 */
.el-tree {
    min-width: 100%; /* 确保树宽度足够 */
    width: max-content; /* 根据内容自动扩展宽度 */
    display: inline-block; /* 使宽度能够超出父容器 */
    /* 新增修复代码 */
    padding-bottom: 12px; /* 为滚动条预留空间 */
}
/* 自定义树节点 - 关键修改 */
.custom-tree-node {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    padding-right: 8px;
    width: 100%;
    min-width: max-content; /* 防止内容换行 */
}
/* 自定义滚动条样式 */
.custom-tree-scroll::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}
.custom-tree-scroll::-webkit-scrollbar-track {
    background: #f5f5f5;
    border-radius: 4px;
}
.custom-tree-scroll::-webkit-scrollbar-thumb {
    background: #c0c4cc;
    border-radius: 4px; /* 增大圆角 */
    min-height: 20px; /* 设置最小高度 */
    min-width: 20px; /* 设置最小宽度 */
}
.custom-tree-scroll::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
}

/* 树节点样式 */
.custom-tree-node {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    padding-right: 8px;
    min-width: max-content; /* 防止内容换行 */
}

.tree-actions {
    display: inline-block;
}

.tree-actions .el-button {
    padding: 0 2px;
    border:none;
}

/* 输入框样式 */
.el-select .el-input {
    width: 130px;
}
.input-with-select .el-input-group__prepend {
    background-color: #fff;
}

/* 清除浮动 */
.clear {
    clear: both;
}
</style>
