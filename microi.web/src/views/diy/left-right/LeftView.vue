<template>
    <div>
        <!-- 头部区域 -->
        <!-- 表单对话框组件 -->
        <DiyFormDialog ref="refDiyTable_DiyFormDialog" @CallbackGetDiyTableRow="handleFormClosed"></DiyFormDialog>

        <!-- 弹出表格对话框 -->
        <el-dialog
            v-if="ShowAnyTable"
            draggable
            :modal="true"
            :width="'80%'"
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
        <span style="font-size:"><el-icon class="mr-2"><Operation /></el-icon>{{ LeftTreeData.ShubiaoT || "分类" }}</span>
        <div style="float: right">
            <el-button type="primary" @click="OpenPageConfig()" v-if="GetCurrentUser.Level === 999">页面配置 </el-button>
            <el-button type="primary" @click="OpenAnyForm({}, '')" v-if="LeftTreeData.ShudingJXZ === 1">添加分类 </el-button>
            <el-button style="margin-left: 5px" @click="refreshTree" v-if="LeftTreeData.ShushuaX === 1">刷新 </el-button>
        </div>

        <!-- 树形控件容器 -->
        <div class="tree-container" style="margin-top: 10px">
            <!-- 搜索区域 -->
            <div style="margin-top: 15px">
                <el-input placeholder="请输入内容" v-model="TreeData.SearchFormData.inputText" class="input-with-select" v-if="LeftTreeData.ShumoHSS === 1" @change="TreeSearch('inputText')">
                    <template #prepend>
                        <el-select v-model="TreeData.SearchFormData.selectText" placeholder="请选择" v-if="LeftTreeData.ShuxiaLSS === 1" style="width: 110px" @change="TreeSearch('selectText')">
                            <el-option v-for="item in options" :key="item.value" :label="item.label" :value="item.value"> </el-option>
                        </el-select>
                    </template>
                    <template #append><el-button :icon="Search" v-if="LeftTreeData.ShusouSAN === 1" @click="TreeSearch('button')"></el-button></template>
                </el-input>
            </div>

            <!-- 树形控件 -->
            <div class="custom-tree-wrapper">
                <div class="custom-tree-scroll">
                    <el-tree
                        :data="TreeData.categories"
                        :props="TreeData.defaultProps"
                        node-key="Id"
                        :highlight-current="true"
                        :filter-node-method="filterNode"
                        :default-expanded-keys="TreeData.ExpandedKeys"
                        :default-checked-keys="TreeData.CheckedKeys"
                        :expand-on-click-node="true"
                        :load="lazy ? loadNode : null"
                        @node-click="handleCategoryClick"
                        :lazy="lazy"
                        :key="'tree-' + lazy"
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
                                        v-if="(data._Child ? data._Child.length === 0 : data._HasChild) && LeftTreeData.ShushanC === 1 && ShowButton(data, 'Delete')"
                                        title="删除分类"
                                    ></el-button>
                                </span>
                            </span>
                        </template>
                    </el-tree>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { computed } from "vue";
import { useDiyStore } from "@/stores";
import DiyFormDialog from "@/views/diy/diy-form-dialog.vue";
// 移除错误的 fullcalendar internal 导入
// import { aW } from "@fullcalendar/core/internal-common";

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
    computed: {},
    data() {
        return {
            lazy: true,
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
                CheckedKeys: []
            },
            OpenAnyTableParam: {},
            ShowAnyTable: false,
            BtnLoading: false,
            options: []
        };
    },
    async created() {
        await this.getOption();
        await this.treeData();
    },
    methods: {
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
            return data[this.TreeData.defaultProps.label].indexOf(value) !== -1;
        },

        // 获取树形数据
        async treeData() {
            var self = this;
            if (self.LeftTreeData.ChushiHDM) {
                var V8 = {
                    Form: this.TreeData.SearchFormData
                };
                self.SetV8DefaultValue(V8);
                await self.DiyCommon.InitV8Code(V8, self.$router);
                try {
                    await eval("(async () => {\n " + self.LeftTreeData.ChushiHDM + " \n})()");
                    var result = V8.Result;
                    self.TreeData.categories = result.Data;
                } catch (error) {
                    self.DiyCommon.Tips("执行初始化V8引擎代码出现错误：" + error.message, false);
                } finally {
                    
                    
                }
            } else {
                var ShuxingGLCD = JSON.parse(self.LeftTreeData.ShuxingGLCD);
                const res = await new Promise((resolve, reject) => {
                    self.DiyCommon.Post(
                        self.DiyCommon.GetApiBase() + "/api/diytable/getDiyTableRowTree",
                        {
                            ModuleEngineKey: ShuxingGLCD[ShuxingGLCD.length - 1]
                        },
                        function (res) {
                            for (var item of res.Data) {
                                item._HasChild = item._HasChild !== 1;
                            }
                            resolve(res);
                        }
                    );
                });
                self.TreeData.categories = res.Data;
            }
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
            if (self.LeftTreeData.ChufaSJ) {
                var V8 = {
                    Origin: origin,
                    Form: this.TreeData.SearchFormData
                };
                self.SetV8DefaultValue(V8);
                await self.DiyCommon.InitV8Code(V8, self.$router);
                try {
                    await eval("(async () => {\n " + self.LeftTreeData.ChufaSJ + " \n})()");
                    var result = await V8.Result;
                } catch (error) {
                    self.DiyCommon.Tips("执行搜索触发V8引擎代码出现错误：" + error.message, false);
                } finally {
                    
                    
                }
            }
        },

        // 设置V8默认值
        SetV8DefaultValue(V8, field) {
            var self = this;
            V8.ClientType = "PC";
            V8.CurrentUser = self.GetCurrentUser;
            V8.OpenAnyTable = this.OpenAnyTable;
            return V8;
        },
        // 处理分类节点点击事件
        handleCategoryClick(data) {
            this.$emit("LeftViewClick", data);
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
            var selectData = self.$refs["refOpenAnyTable_" + (self.OpenAnyTableParam.SysMenuId || self.OpenAnyTableParam.ModuleEngineKey)].TableMultipleSelection;
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

        // 打开表单
        OpenAnyForm(ParentData, FormMode, origin) {
            var self = this;
            var param = {
                TableName: this.LeftTreeData.GuanlianBD,
                FormMode: FormMode,
                Id: ParentData.Id,
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

/* 树形容器样式 - 添加滚动条 */
.tree-container {
    height: calc(100vh - 150px);
    display: flex;
    flex-direction: column;
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
    margin-bottom: 30px;
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
    font-size: 14px;
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
    font-size: 14px;
    padding-right: 8px;
    min-width: max-content; /* 防止内容换行 */
}

.tree-actions {
    display: inline-block;
}

.tree-actions .el-button {
    padding: 0 2px;
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
