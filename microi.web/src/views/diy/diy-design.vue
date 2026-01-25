<template>
    <div class="diy-design-container">
        <div style="display: flex; align-items: center; gap: 10px; justify-content: flex-start; padding:20px;border-bottom: solid 1px #ccc;">
            <el-button :loading="SaveAllDiyFieldLoding" type="primary" :icon="UploadFilled" @click="SaveAllDiyField">{{ $t("Msg.Save") }}</el-button>
            <el-select v-if="!DiyCommon.IsNull($refs.fieldForm) && !DiyCommon.IsNull($refs.fieldForm.DiyFieldList)"
                v-model="CurrentDiyFieldModel"
                @change="SelectFieldChange"
                :filter-method="SelectFieldFilterMethod"
                clearable
                filterable
                value-key="Id"
                style="width: 250px"
                :placeholder="'搜索字段'"
            >
                <el-option v-for="item in DiyFieldListClone" :key="'CurrentDiyFieldModel_' + item.Id" :label="item.Label" :value="item">
                    <span style="float: left">{{ item.Label }}</span>
                    <span style="float: right; color: #8492a6; font-size: 14px">{{ item.Name }}</span>
                </el-option>
            </el-select>
            <el-button v-if="!DiyCommon.IsNull(CurrentDiyFieldModel.Id)" :loading="SaveAllDiyFieldLoding" type="danger" :icon="Delete" @click="DelDiyField">
                {{ $t("Msg.Del") }}{{ $t("Msg.Field") }}
            </el-button>
            <el-select v-if="PageType != 'Report'" v-model="CurrentErrorFieldModel" @change="SelectErrorFieldChange" clearable filterable value-key="Name" style="width: 250px" placeholder="异常字段">
                <el-option v-for="(item, index) in ExceptionFieldList" :key="'ExceptionFieldList_' + index" :label="item.Name" :value="item">
                    <span style="float: left">{{ (item.Label || item.Name) + `(${item.Name})` }}</span>
                    <span style="float: right; color: #8492a6; font-size: 14px">{{ item.ErrorType == "DbField" ? "Diy缺少" : "数据库缺少" }}</span>
                </el-option>
            </el-select>
            <el-button v-if="!DiyCommon.IsNull(CurrentErrorFieldModel.Name)" :loading="SaveAllDiyFieldLoding" :icon="Check" type="primary" @click="RepairField">
                {{ "修复" }}
            </el-button>
            <el-select v-if="PageType != 'Report'" v-model="CurrentDeletedFieldModel" clearable filterable value-key="Name" style="width: 250px" placeholder="字段回收站">
                <el-option v-for="(item, index) in DeletedDiyField" :key="'DeletedDiyField_' + index" :label="item.Name" :value="item">
                    <span style="float: left">{{ item.Label + `(${item.Name})` }}</span>
                    <span style="float: right; color: #8492a6; font-size: 14px">{{ "已删除" }}</span>
                </el-option>
            </el-select>
            <el-button v-if="!DiyCommon.IsNull(CurrentDeletedFieldModel.Name)" :loading="SaveAllDiyFieldLoding" :icon="Check" type="primary" @click="RecoverDiyField">
                {{ "恢复" }}
            </el-button>
        </div>
        <el-container class="field-container">
            <el-aside class="aside aside-left" width="250px">
                <el-row id="row-field" :gutter="10" class="row-field">
                    <el-col :span="24">
                        <el-divider content-position="center">基础控件</el-divider>
                    </el-col>
                    <el-col v-for="component in DiyComponentListBaseListen" :key="component.Control" :data-field="component.Control" class="field-drag" :span="12">
                        <el-tag type="info"><fa-icon :class="component.Icon" />{{ component.Name }}</el-tag>
                    </el-col>

                    <el-col :span="24">
                        <el-divider content-position="center">高级控件</el-divider>
                    </el-col>

                    <el-col v-for="component in DiyComponentListAdvancedListen" :key="component.Control" :data-field="component.Control" class="field-drag" :span="12">
                        <el-tag type="info"><fa-icon :class="component.Icon" />{{ component.Name }}</el-tag>
                    </el-col>
                </el-row>
            </el-aside>
            <el-main class="center-main">
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
                <div :style="{ width: FormClient == 'Mobile' ? '375px' : 'auto', border: '1px dashed #ff6c04' }">
                    <DiyForm
                        ref="fieldForm"
                        :LoadMode="'Design'"
                        :TableId="TableId"
                        :TableRowId="TableRowId"
                        :ColSpan="FormClient == 'Mobile' ? 24 : 0"
                        @CallbackSelectField="CallbackSelectField"
                        @CallbackSetDiyTableModel="CallbackSetDiyTableModel"
                        @CallbackLoadDragula="CallbackLoadDragula"
                        @CallbackGetDiyField="CallbackGetDiyField"
                    />
                </div>
                <el-dialog draggable width="550px" :modal-append-to-body="false" v-model="ShowDiyTableEditor" append-to-body :title="''">
                    <template #footer>
                        <el-button type="primary" :icon="Close">{{ $t("Msg.Close") }}({{ $t("Msg.AutoSave") }})</el-button>
                    </template>
                </el-dialog>
            </el-main>
            <el-aside width="320px" class="aside aside-right">
                <el-container>
                    <el-main class="right-main">
                        <el-tabs v-model="AsideRightActiveTab" :stretch="true" @tab-click="tabCLickAsideRight">
                            <el-tab-pane name="Field">
                                <template #label
                                    ><span><fa-icon class="fas fa-columns marginRight5" />字段属性</span></template
                                >
                                <div class="div-scroll" style="height: calc(100vh - 245px)">
                                    <!-- label-width="80px" -->
                                    <el-divider content-position="left"
                                        ><el-icon><Tools /></el-icon> 基本设置</el-divider
                                    >
                                    <el-form class="form-setting" :model="CurrentDiyFieldModel" label-width="85px" label-position="top">
                                        <el-form-item label="显示名称">
                                            <el-input v-model="CurrentDiyFieldModel.Label" @input="DiyFieldLabelChange" />
                                        </el-form-item>
                                        <el-form-item label="说明">
                                            <el-input type="textarea" :rows="2" v-model="CurrentDiyFieldModel.Description" />
                                        </el-form-item>
                                        <el-form-item label="字段名">
                                            <el-input
                                                v-model="CurrentDiyFieldModel.Name"
                                                :disabled="CurrentDiyFieldModel.IsLockField ? true : false"
                                                :readonly="CurrentDiyFieldModel.IsLockField ? true : false"
                                            />
                                        </el-form-item>
                                        <el-form-item label="字段类型">
                                            <!-- <el-input v-model="CurrentDiyFieldModel.Type"></el-input> -->
                                            <el-autocomplete
                                                :disabled="CurrentDiyFieldModel.IsLockField ? true : false"
                                                :readonly="CurrentDiyFieldModel.IsLockField ? true : false"
                                                v-model="CurrentDiyFieldModel.Type"
                                                :fetch-suggestions="SearchCDFMType"
                                                placeholder=""
                                            />
                                        </el-form-item>
                                        <el-form-item label="控件类型" v-if="CanUptComponent()" key="design-102">
                                            <!-- <el-input v-model="CurrentDiyFieldModel.Type"></el-input> -->
                                            <el-select v-model="CurrentDiyFieldModel.Component" clearable filterable placeholder="">
                                                <el-option v-for="item in DiyComponentList" :key="item.Control" :label="item.Name" :value="item.Control" />
                                            </el-select>
                                        </el-form-item>

                                        <el-form-item :label="$t('Msg.Sort')">
                                            <el-input v-model="CurrentDiyFieldModel.Sort" type="number" />
                                        </el-form-item>

                                        <el-form-item :label="'占位文字'">
                                            <el-input v-model="CurrentDiyFieldModel.Placeholder" type="text" />
                                        </el-form-item>

                                        <el-form-item label="分组">
                                            <el-select v-model="CurrentDiyFieldModel.Tab" clearable placeholder="">
                                                <el-option v-for="item in CurrentDiyTableModel.Tabs" :key="item.Id || item.Name" :label="item.Name" :value="item.Id || item.Name" />
                                            </el-select>
                                        </el-form-item>
                                        <el-form-item :label="'字段Id'">
                                            <el-input v-model="CurrentDiyFieldModel.Id" disabled readonly type="text" />
                                        </el-form-item>
                                        <el-form-item v-if="!DiyCommon.IsNull(CurrentDiyFieldModel.Config)" 
                                            class="form-item-top" key="design-27"
                                            label="值变更V8事件"
                                            @click="OpenV8CodeEditor('CurrentDiyFieldModel.Config.V8Code')">
                                            <el-button type="primary" size="small" @click.stop="OpenV8CodeEditor('CurrentDiyFieldModel.Config.V8Code')">
                                                编辑代码
                                            </el-button>
                                        </el-form-item>
                                    </el-form>
                                    <el-divider content-position="left"
                                        ><el-icon><Tools /></el-icon> 组件设置</el-divider
                                    >
                                    <el-form class="form-setting" :model="CurrentDiyFieldModel" label-width="85px" label-position="top">
                                        <!--级联选择器-->
                                        <!-- <el-form-item
                                        v-if="CurrentDiyFieldModel.Component == 'Cascader'"
                                        class="form-item-top"
                                       >
                                        <div class="form-item-label-slot">
                                            存储字段（必填）
                                        </div>
                                        <el-input
                                            v-model="CurrentDiyFieldModel.Config.Cascader.Value"
                                            type="text" />
                                    </el-form-item>
                                    <el-form-item
                                        v-if="CurrentDiyFieldModel.Component == 'Cascader'"
                                        class="form-item-top"
                                       >
                                        <div class="form-item-label-slot">
                                            显示字段（可选）
                                        </div>
                                        <el-input
                                            v-model="CurrentDiyFieldModel.Config.Cascader.Label"
                                            type="text" />
                                    </el-form-item> -->
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Cascader'" class="form-item-top" key="design-101">
                                            <div class="form-item-label-slot">存储字段（必填）</div>
                                            <el-input v-model="CurrentDiyFieldModel.Config.SelectSaveField" />
                                        </el-form-item>

                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'RichText'" label="编辑器" key="design-100">
                                            <el-radio-group v-model="CurrentDiyFieldModel.Config.RichText.EditorProduct">
                                                <el-radio :value="'UEditor'">UEditor</el-radio>
                                                <el-radio :value="'WangEditor'">WangEditor</el-radio>
                                            </el-radio-group>
                                        </el-form-item>

                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Cascader'" class="form-item-top" key="design-99">
                                            <div class="form-item-label-slot">显示字段（可选）</div>
                                            <el-input v-model="CurrentDiyFieldModel.Config.SelectLabel" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Cascader'" class="form-item-top" key="design-98">
                                            <div class="form-item-label-slot">子级字段（可选，默认_Child）</div>
                                            <el-input v-model="CurrentDiyFieldModel.Config.Cascader.Children" type="text" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Cascader'" class="form-item-top" key="design-97">
                                            <div class="form-item-label-slot">父级字段（一般指ParentId，必填）</div>
                                            <el-input v-model="CurrentDiyFieldModel.Config.Cascader.ParentField" placeholder="" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Cascader'" class="form-item-top" key="design-96">
                                            <div class="form-item-label-slot">完整父级字段（一般指FullPath/ParentIds，如：parentid1,parentid2,parentid3,【以英文逗号结尾】，必填）</div>
                                            <el-input v-model="CurrentDiyFieldModel.Config.Cascader.ParentFields" placeholder="" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Cascader'" label="动态加载" key="design-95">
                                            <el-switch v-model="CurrentDiyFieldModel.Config.Cascader.Lazy" active-color="#ff6c04" inactive-color="#ccc" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Cascader'" label="可搜索" key="design-94">
                                            <el-switch v-model="CurrentDiyFieldModel.Config.Cascader.Filterable" active-color="#ff6c04" inactive-color="#ccc" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Cascader'" label="是否多选" key="design-93">
                                            <el-switch v-model="CurrentDiyFieldModel.Config.Cascader.Multiple" active-color="#ff6c04" inactive-color="#ccc" />
                                        </el-form-item>

                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Cascader'" class="form-item-top" key="design-92">
                                            <div class="form-item-label-slot">判断是否禁用的字段（可选）</div>
                                            <el-input v-model="CurrentDiyFieldModel.Config.Cascader.Disabled" type="text" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Cascader'" class="form-item-top" key="design-91">
                                            <div class="form-item-label-slot">判断是否有子级的字段（可选）</div>
                                            <el-input v-model="CurrentDiyFieldModel.Config.Cascader.Leaf" type="text" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Cascader'" class="form-item-top" label="保存所有级数组" key="design-90">
                                            <el-switch v-model="CurrentDiyFieldModel.Config.Cascader.EmitPath" active-color="#ff6c04" inactive-color="#ccc" />
                                        </el-form-item>
                                        <!-- 级联 END -->

                                        <!-- 下拉树 START -->
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'SelectTree'" class="form-item-top" key="design-89">
                                            <div class="form-item-label-slot">存储字段（必填）</div>
                                            <el-input v-model="CurrentDiyFieldModel.Config.SelectSaveField" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'SelectTree'" class="form-item-top" key="design-88">
                                            <div class="form-item-label-slot">显示字段（可选）</div>
                                            <el-input v-model="CurrentDiyFieldModel.Config.SelectLabel" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'SelectTree'" class="form-item-top" key="design-87">
                                            <div class="form-item-label-slot">子级字段（可选，默认_Child）</div>
                                            <el-input v-model="CurrentDiyFieldModel.Config.SelectTree.Children" type="text" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'SelectTree'" class="form-item-top" key="design-86">
                                            <div class="form-item-label-slot">父级字段（一般指ParentId，必填）</div>
                                            <el-input v-model="CurrentDiyFieldModel.Config.SelectTree.ParentField" placeholder="" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'SelectTree'" class="form-item-top" key="design-85">
                                            <div class="form-item-label-slot">完整父级字段（一般指FullPath/ParentIds，如：parentid1,parentid2,parentid3,【以英文逗号结尾】，必填）</div>
                                            <el-input v-model="CurrentDiyFieldModel.Config.SelectTree.ParentFields" placeholder="" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'SelectTree'" label="动态加载" key="design-84">
                                            <el-switch v-model="CurrentDiyFieldModel.Config.SelectTree.Lazy" active-color="#ff6c04" inactive-color="#ccc" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'SelectTree'" label="可搜索" key="design-83">
                                            <el-switch v-model="CurrentDiyFieldModel.Config.SelectTree.Filterable" active-color="#ff6c04" inactive-color="#ccc" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'SelectTree'" label="是否多选" key="design-82">
                                            <el-switch v-model="CurrentDiyFieldModel.Config.SelectTree.Multiple" active-color="#ff6c04" inactive-color="#ccc" />
                                        </el-form-item>

                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'SelectTree'" class="form-item-top" key="design-81">
                                            <div class="form-item-label-slot">判断是否禁用的字段（可选）</div>
                                            <el-input v-model="CurrentDiyFieldModel.Config.SelectTree.Disabled" type="text" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'SelectTree'" class="form-item-top" key="design-80">
                                            <div class="form-item-label-slot">判断是否有子级的字段（可选）</div>
                                            <el-input v-model="CurrentDiyFieldModel.Config.SelectTree.Leaf" type="text" />
                                        </el-form-item>

                                        <!-- 组织机构 START-->
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Department'" label="是否多选" key="design-79">
                                            <el-switch v-model="CurrentDiyFieldModel.Config.Department.Multiple" active-color="#ff6c04" inactive-color="#ccc" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Department'" label="可搜索" key="design-78">
                                            <el-switch v-model="CurrentDiyFieldModel.Config.Department.Filterable" active-color="#ff6c04" inactive-color="#ccc" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Department'" class="form-item-top" label="保存所有级数组" key="design-77">
                                            <el-switch v-model="CurrentDiyFieldModel.Config.Department.EmitPath" active-color="#ff6c04" inactive-color="#ccc" />
                                        </el-form-item>

                                        <!-- 组织机构 END -->
                                        <!--按钮-->
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Button'" label="按钮样式" key="design-76">
                                            <el-radio-group v-model="CurrentDiyFieldModel.Config.Button.Type">
                                                <el-radio :value="''">默认按钮</el-radio>
                                                <el-radio :value="'primary'">主要按钮</el-radio>
                                                <el-radio :value="'success'">成功按钮</el-radio>
                                                <el-radio :value="'info'">信息按钮</el-radio>
                                                <el-radio :value="'warning'">警告按钮</el-radio>
                                                <el-radio :value="'danger'">危险按钮</el-radio>
                                            </el-radio-group>
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Button'" label="预览可点击" key="design-75">
                                            <el-radio-group v-model="CurrentDiyFieldModel.Config.Button.PreviewCanClick">
                                                <el-radio :value="true">是</el-radio>
                                                <el-radio :value="false">否</el-radio>
                                            </el-radio-group>
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Button'" label="图标" key="design-74">
                                            <span class="hand" style="display: inline-block; padding: 5px; cursor: pointer" @click="$refs.refButtonIcon.show()">
                                                <fa-icon :icon="DiyCommon.IsNull(CurrentDiyFieldModel.Config.Button.Icon) ? 'far fa-smile-wink' : CurrentDiyFieldModel.Config.Button.Icon" />
                                            </span>
                                            <Fontawesome ref="refButtonIcon" v-model:model="CurrentDiyFieldModel.Config.Button.Icon" />
                                        </el-form-item>

                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Map' || CurrentDiyFieldModel.Component == 'MapArea'" label="地图公司" key="design-73">
                                            <el-radio-group v-model="CurrentDiyFieldModel.Config.MapCompany">
                                                <el-radio :value="'Baidu'">百度</el-radio>
                                                <el-radio :value="'AMap'">高德</el-radio>
                                            </el-radio-group>
                                        </el-form-item>
                                        <!--子表         START-->
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'TableChild'" label="关联模块" key="design-70">
                                            <el-popover placement="bottom" trigger="click" style="width: 100%">
                                                <el-tree :data="SysMenuList" node-key="Id" :props="sysMenuTreeProps" @node-click="sysMenuTreeClick" />
                                                <template #reference
                                                    ><el-button style="width: 100%; padding: 10px 20px">
                                                        <!-- {{DiyCommon.IsNull(CurrentSysMenuModel.ParentName) ? '顶级' : CurrentSysMenuModel.ParentName}} -->
                                                        {{ DiyCommon.IsNull(CurrentDiyFieldModel.Config.TableChildSysMenuName) ? "请选择" : CurrentDiyFieldModel.Config.TableChildSysMenuName }}
                                                    </el-button></template
                                                >
                                            </el-popover>
                                        </el-form-item>
                                        <el-form-item class="form-item-top" v-if="CurrentDiyFieldModel.Component == 'TableChild'" label="关联主表列名（默认Id）" key="design-69">
                                            <el-input v-model="CurrentDiyFieldModel.Config.TableChild.PrimaryTableFieldName" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'TableChild'" class="form-item-top" label="关联子表列名" key="design-68">
                                            <el-input v-model="CurrentDiyFieldModel.Config.TableChildFkFieldName" />
                                        </el-form-item>

                                        <!--
                                        TableChildCallbackField格式：
                                        [{Father:'AAAA', Child:'BBBB'}, {Father:'CCCCC', Child:'DDDDD'}]
                                    -->
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'TableChild'" label="回写子表列" key="design-67">
                                            <!-- <el-input type="textarea" rows="5"
                                            placeholder='[{ "Father" : "FielName1", "Child" : "FielName2" }, { "Father" : "FielName3", "Child" : "FielName4" }]'
                                            v-model="CurrentDiyFieldModel.Config.TableChildCallbackField" /> -->
                                            <DiyChildTableCallback
                                                ref="diyWritebackChild"
                                                v-if="!DiyCommon.IsNull($refs.fieldForm) && !DiyCommon.IsNull($refs.fieldForm.DiyFieldList)"
                                                :fields="$refs.fieldForm.DiyFieldList"
                                                :childTableId="CurrentDiyFieldModel.Config.TableChildTableId"
                                                v-model:model="CurrentDiyFieldModel.Config.TableChildCallbackField"
                                            >
                                            </DiyChildTableCallback>
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'TableChild'" label="上级模块（选填，用于嵌套子表显示在表单外部）" class="form-item-top" key="design-66">
                                            <el-popover placement="bottom" trigger="click" style="width: 100%">
                                                <el-tree :data="SysMenuList" node-key="Id" :props="sysMenuTreeProps" @node-click="sysMenuTreeClickLast" />
                                                <template #reference
                                                    ><el-button style="width: 100%; padding: 10px 20px">
                                                        <!-- {{DiyCommon.IsNull(CurrentSysMenuModel.ParentName) ? '顶级' : CurrentSysMenuModel.ParentName}} -->
                                                        {{
                                                            DiyCommon.IsNull(CurrentDiyFieldModel.Config.TableChild.LastSysMenuName) ? "请选择" : CurrentDiyFieldModel.Config.TableChild.LastSysMenuName
                                                        }}
                                                    </el-button></template
                                                >
                                            </el-popover>
                                        </el-form-item>

                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'TableChild'" 
                                            class="form-item-top" key="design-65"
                                            label="行点击V8事件"
                                            @click="OpenV8CodeEditor('CurrentDiyFieldModel.Config.TableChildRowClickV8')">
                                            <el-button type="primary" size="small" @click.stop="OpenV8CodeEditor('CurrentDiyFieldModel.Config.TableChildRowClickV8')">
                                                编辑代码
                                            </el-button>
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'TableChild'" label="关闭分页" key="design-64">
                                            <el-switch v-model="CurrentDiyFieldModel.Config.TableChild.DisablePagination" active-color="#ff6c04" inactive-color="#ccc" />
                                        </el-form-item>
                                        <!-- 关联表格 START -->
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'JoinTable'" label="关联模块" key="design-63">
                                            <el-popover placement="bottom" trigger="click" style="width: 100%">
                                                <el-tree :data="SysMenuList" node-key="Id" :props="sysMenuTreeProps" @node-click="JoinTableSelectModule" />
                                                <template #reference
                                                    ><el-button style="width: 100%; padding: 10px 20px">
                                                        {{ CurrentDiyFieldModel.Config.JoinTable.ModuleName ? CurrentDiyFieldModel.Config.JoinTable.ModuleName : "请选择" }}
                                                    </el-button></template
                                                >
                                            </el-popover>
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'JoinTable'" label="搜索条件" class="form-item-top" key="design-62">
                                            <el-input v-model="CurrentDiyFieldModel.Config.JoinTable.Where" type="textarea" :rows="5" />
                                        </el-form-item>
                                        <!-- 关联表格 END -->

                                        <!--弹出表格配置    START-->
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'OpenTable'" label="关联模块" key="design-61">
                                            <el-popover placement="bottom" trigger="click" style="width: 100%">
                                                <el-tree :data="SysMenuList" node-key="Id" :props="sysMenuTreeProps" @node-click="OpenTableSysMenuClick" />
                                                <template #reference
                                                    ><el-button style="width: 100%; padding: 10px 20px">
                                                        <!-- {{DiyCommon.IsNull(CurrentSysMenuModel.ParentName) ? '顶级' : CurrentSysMenuModel.ParentName}} -->
                                                        {{ DiyCommon.IsNull(CurrentDiyFieldModel.Config.OpenTable.SysMenuName) ? "请选择" : CurrentDiyFieldModel.Config.OpenTable.SysMenuName }}
                                                    </el-button></template
                                                >
                                            </el-popover>
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'OpenTable'" label="按钮名称" key="design-60">
                                            <el-input v-model="CurrentDiyFieldModel.Config.OpenTable.BtnName" placeholder="弹出表格" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'OpenTable'" label="是否多选" key="design-59">
                                            <el-switch v-model="CurrentDiyFieldModel.Config.OpenTable.MultipleSelect" active-color="#ff6c04" inactive-color="#ccc" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'OpenTable'" 
                                            class="form-item-top" key="design-58"
                                            label="打开前V8事件"
                                            @click="OpenV8CodeEditor('CurrentDiyFieldModel.Config.OpenTable.BeforeOpenV8')">
                                            <el-button type="primary" size="small" @click.stop="OpenV8CodeEditor('CurrentDiyFieldModel.Config.OpenTable.BeforeOpenV8')">
                                                编辑代码
                                            </el-button>
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'OpenTable'" 
                                            class="form-item-top" key="design-57"
                                            label="提交V8事件"
                                            @click="OpenV8CodeEditor('CurrentDiyFieldModel.Config.OpenTable.SubmitV8')">
                                            <el-button type="primary" size="small" @click.stop="OpenV8CodeEditor('CurrentDiyFieldModel.Config.OpenTable.SubmitV8')">
                                                编辑代码
                                            </el-button>
                                        </el-form-item>
                                        <!--弹出表格配置   END-->

                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'DevComponent'" label="组件名称" key="design-56">
                                            <el-input v-model="CurrentDiyFieldModel.Config.DevComponentName" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'DevComponent'" class="form-item-top" key="design-55">
                                            <div class="form-item-label-slot">组件路径</div>
                                            <el-input
                                                type="textarea"
                                                :rows="3"
                                                v-model="CurrentDiyFieldModel.Config.DevComponentPath"
                                                placeholder="以'/views'开头， 也可以不以'/views'开头，但定制组件必需放到/views/下任意地方"
                                            />
                                        </el-form-item>

                                        <el-form-item
                                            v-if="CurrentDiyFieldModel.Component == 'FileUpload' || CurrentDiyFieldModel.Component == 'ImgUpload'"
                                            class="form-item-top"
                                            label="上传前V8事件"
                                            key="design-54"
                                        >
                                            <el-button type="primary" size="small" @click.stop="OpenV8CodeEditor('CurrentDiyFieldModel.Config.Upload.BeforeUploadV8')">
                                                编辑代码
                                            </el-button>
                                        </el-form-item>

                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'FileUpload'" class="form-item-top" label="禁止匿名访问" key="design-53">
                                            <el-switch v-model="CurrentDiyFieldModel.Config.FileUpload.Limit" active-color="#ff6c04" inactive-color="#ccc" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'FileUpload'" label="多文件上传" key="design-52">
                                            <el-switch v-model="CurrentDiyFieldModel.Config.FileUpload.Multiple" active-color="#ff6c04" inactive-color="#ccc" />
                                        </el-form-item>

                                        <el-form-item
                                            v-if="CurrentDiyFieldModel.Component == 'FileUpload' && CurrentDiyFieldModel.Config.FileUpload.Multiple == true"
                                            label="最大允许上传个数"
                                            key="design-51"
                                        >
                                            <el-input-number v-model="CurrentDiyFieldModel.Config.FileUpload.MaxCount" :min="1" label="" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'FileUpload'" label="上传说明" key="design-50">
                                            <el-input v-model="CurrentDiyFieldModel.Config.FileUpload.Tips" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'FileUpload'" label="最大体积" key="design-49">
                                            <el-input v-model="CurrentDiyFieldModel.Config.FileUpload.MaxSize" placeholder="支持小数点">
                                                <template #append>M</template>
                                            </el-input>
                                        </el-form-item>

                                        <el-form-item class="form-item-top" v-if="CurrentDiyFieldModel.Component == 'ImgUpload'" label="禁止匿名访问" key="design-48">
                                            <el-switch v-model="CurrentDiyFieldModel.Config.ImgUpload.Limit" active-color="#ff6c04" inactive-color="#ccc" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'ImgUpload'" label="多图片上传" key="design-47">
                                            <el-switch v-model="CurrentDiyFieldModel.Config.ImgUpload.Multiple" active-color="#ff6c04" inactive-color="#ccc" />
                                        </el-form-item>
                                        <el-form-item
                                            v-if="CurrentDiyFieldModel.Component == 'ImgUpload' && CurrentDiyFieldModel.Config.ImgUpload.Multiple == true"
                                            label="最大允许上传个数"
                                            key="design-46"
                                        >
                                            <el-input-number v-model="CurrentDiyFieldModel.Config.ImgUpload.MaxCount" :min="1" label="" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'ImgUpload'" label="上传说明" key="design-45">
                                            <el-input v-model="CurrentDiyFieldModel.Config.ImgUpload.Tips" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'ImgUpload'" label="是否压缩" key="design-44">
                                            <el-switch v-model="CurrentDiyFieldModel.Config.ImgUpload.Preview" active-color="#ff6c04" inactive-color="#ccc" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'ImgUpload'" label="最大体积" key="design-43">
                                            <el-input v-model="CurrentDiyFieldModel.Config.ImgUpload.MaxSize" placeholder="支持小数点">
                                                <template #append>M</template>
                                            </el-input>
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'AutoNumber'" label="固定前缀" key="design-42">
                                            <el-input v-model="CurrentDiyFieldModel.Config.AutoNumberFixed" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'AutoNumber'" label="默认位数" key="design-41">
                                            <el-input-number v-model="CurrentDiyFieldModel.Config.AutoNumberLength" :min="1" label="" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'AutoNumber'" label="关联列" key="design-40">
                                            <!-- <el-input v-model="CurrentDiyFieldModel.Config.AutoNumberFields" /> -->
                                            <el-select v-model="CurrentDiyFieldModel.Config.AutoNumberFields" filterable multiple clearable placeholder="">
                                                <el-option v-for="item in $refs.fieldForm.DiyFieldList" :key="item.Id" :label="item.Label + ' - ' + item.Name" :value="item.Id" />
                                            </el-select>
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'AutoNumber'" label="数据规则" key="design-39">
                                            <el-radio-group v-model="CurrentDiyFieldModel.Config.AutoNumber.DataRule">
                                                <el-radio :value="''">含已删除</el-radio>
                                                <el-radio :value="'NoDeleted'">不含已删除</el-radio>
                                            </el-radio-group>
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'AutoNumber'" label="生成规则" key="design-38">
                                            <el-radio-group v-model="CurrentDiyFieldModel.Config.AutoNumber.CreateRule">
                                                <el-radio :value="''">数据总数+1</el-radio>
                                                <el-radio :value="'MaxValueAdd1'">最大值+1</el-radio>
                                            </el-radio-group>
                                        </el-form-item>

                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'DateTime'" label="显示格式" key="design-37">
                                            <el-radio-group v-model="CurrentDiyFieldModel.Config.DateTimeType">
                                                <el-radio :value="'date'">年月日</el-radio>
                                                <el-radio :value="'datetime'">年月日 时分秒</el-radio>
                                                <el-radio :value="'datetime_HHmm'">年月日 时分</el-radio>
                                                <el-radio :value="'HH:mm'">时分</el-radio>
                                                <el-radio :value="'HH:mm:ss'">时分秒</el-radio>
                                                <!-- <el-radio :value="'datetime_HH'">年月日 时</el-radio> -->
                                                <el-radio :value="'month'">年月</el-radio>
                                                <el-radio :value="'week'">年周</el-radio>
                                                <el-radio :value="'year'">年</el-radio>
                                                <el-radio :value="'dates'">多选天</el-radio>
                                                <el-radio :value="'months'">多选月</el-radio>
                                                <el-radio :value="'years'">多选年</el-radio>
                                            </el-radio-group>
                                        </el-form-item>

                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Text'" label="密码输入" key="design-36">
                                            <el-switch v-model="CurrentDiyFieldModel.Config.TextShowPassword" active-color="#ff6c04" inactive-color="#ccc" />
                                        </el-form-item>

                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Text' || CurrentDiyFieldModel.Component == 'AutoNumber'" label="Icon图标" key="design-35">
                                            <!-- <el-input v-model="CurrentDiyFieldModel.Config.TextIcon"></el-input> -->
                                            <span class="hand" style="display: inline-block; padding: 5px; cursor: pointer" @click="$refs.fasTextIcon.show()">
                                                <fa-icon :icon="DiyCommon.IsNull(CurrentDiyFieldModel.Config.TextIcon) ? 'far fa-smile-wink' : CurrentDiyFieldModel.Config.TextIcon" />
                                            </span>
                                            <Fontawesome ref="fasTextIcon" v-model:model="CurrentDiyFieldModel.Config.TextIcon" />
                                        </el-form-item>

                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Text'" label="显示图标" key="design-200">
                                            <el-switch v-model="CurrentDiyFieldModel.Config.ShowIcon" active-color="#ff6c04" inactive-color="#ccc" />
                                        </el-form-item>

                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Text'" label="图标位置" key="design-34">
                                            <el-radio-group v-model="CurrentDiyFieldModel.Config.TextIconPosition">
                                                <el-radio :value="'left'">左边</el-radio>
                                                <el-radio :value="'right'">右边</el-radio>
                                            </el-radio-group>
                                        </el-form-item>

                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Text'" label="复合文字" key="design-33">
                                            <el-input v-model="CurrentDiyFieldModel.Config.TextApend" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Text'" label="文字位置" key="design-32">
                                            <el-radio-group v-model="CurrentDiyFieldModel.Config.TextApendPosition">
                                                <el-radio :value="'left'">左边</el-radio>
                                                <el-radio :value="'right'">右边</el-radio>
                                            </el-radio-group>
                                        </el-form-item>

                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Text'" label="插槽按钮" key="design-201">
                                            <el-switch v-model="CurrentDiyFieldModel.Config.ShowButton" active-color="#ff6c04" inactive-color="#ccc" />
                                        </el-form-item>

                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Text'" label="插槽只读" key="design-202">
                                            <el-switch v-model="CurrentDiyFieldModel.Config.ReadOnlyButton" active-color="#ff6c04" inactive-color="#ccc" />
                                        </el-form-item>

                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Text'" label="弹出表格Id" key="design-203">
                                            <el-input v-model="CurrentDiyFieldModel.Config.OpenTableId" />
                                        </el-form-item>

                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Divider'" class="form-item-top" label="文字位置" key="design-31">
                                            <el-radio-group v-model="CurrentDiyFieldModel.Config.DividerPosition">
                                                <el-radio :value="'left'">左边</el-radio>
                                                <el-radio :value="'center'">中间</el-radio>
                                                <el-radio :value="'right'">右边</el-radio>
                                            </el-radio-group>
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Divider'" label="图标" key="design-30">
                                            <span class="hand" style="display: inline-block; padding: 5px; cursor: pointer" @click="$refs.refDividerIcon.show()">
                                                <fa-icon :icon="DiyCommon.IsNull(CurrentDiyFieldModel.Config.Divider.Icon) ? 'far fa-smile-wink' : CurrentDiyFieldModel.Config.Divider.Icon" />
                                            </span>
                                            <Fontawesome ref="refDividerIcon" v-model:model="CurrentDiyFieldModel.Config.Divider.Icon" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Divider'" class="form-item-top" label="标签样式" key="design-29">
                                            <el-radio-group v-model="CurrentDiyFieldModel.Config.Divider.Tag">
                                                <el-radio :value="''">无</el-radio>
                                                <el-radio :value="'primary'">默认样式</el-radio>
                                                <el-radio :value="'success'">成功样式</el-radio>
                                                <el-radio :value="'info'">信息样式</el-radio>
                                                <el-radio :value="'warning'">警告样式</el-radio>
                                                <el-radio :value="'danger'">危险样式</el-radio>
                                            </el-radio-group>
                                        </el-form-item>

                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'CodeEditor'" label="默认高度" key="design-28">
                                            <el-input v-model="CurrentDiyFieldModel.Config.CodeEditor.Height">
                                                <template #append>px</template>
                                            </el-input>
                                        </el-form-item>
                                       
                                        <!--多行文本、单行文本-->
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Textarea' || CurrentDiyFieldModel.Component == 'Text'" 
                                            class="form-item-top" key="design-26"
                                            label="失去焦点V8事件"
                                            @click="OpenV8CodeEditor('CurrentDiyFieldModel.Config.V8CodeBlur')">
                                            <el-button type="primary" size="small" @click.stop="OpenV8CodeEditor('CurrentDiyFieldModel.Config.V8CodeBlur')">
                                                编辑代码
                                            </el-button>
                                        </el-form-item>
                                        <el-form-item
                                            v-if="CurrentDiyFieldModel.Component == 'NumberText' || CurrentDiyFieldModel.Component == 'Textarea' || CurrentDiyFieldModel.Component == 'Text'"
                                            class="form-item-top"
                                            key="design-25"
                                            label="键盘V8事件"
                                            @click="OpenV8CodeEditor('CurrentDiyFieldModel.KeyupV8Code')"
                                        >
                                            <el-button type="primary" size="small" @click.stop="OpenV8CodeEditor('CurrentDiyFieldModel.KeyupV8Code')">
                                                编辑代码
                                            </el-button>
                                        </el-form-item>

                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Textarea'" label="默认行数" key="design-24">
                                            <el-input-number v-model="CurrentDiyFieldModel.Config.Textarea.DefaultRows" :min="1" label="" />
                                        </el-form-item>

                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'NumberText'" label="显示按钮" key="design-23">
                                            <el-switch v-model="CurrentDiyFieldModel.Config.NumberTextBtn" active-color="#ff6c04" inactive-color="#ccc" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'NumberText' && CurrentDiyFieldModel.Config.NumberTextBtn == true" key="design-22" label="按钮位置">
                                            <el-radio-group v-model="CurrentDiyFieldModel.Config.NumberTextBtnPosition">
                                                <el-radio :value="''">左右两边</el-radio>
                                                <el-radio :value="'right'">右边</el-radio>
                                            </el-radio-group>
                                        </el-form-item>

                                        <!-- && CurrentDiyFieldModel.Config.NumberTextBtn ==  true -->
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'NumberText'" label="步数" key="design-21">
                                            <el-input-number v-model="CurrentDiyFieldModel.Config.NumberTextStep" :min="0" label="" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'NumberText'" label="小数点" key="design-20">
                                            <el-input-number v-model="CurrentDiyFieldModel.Config.NumberTextPrecision" :min="0" :max="6" label="" />
                                        </el-form-item>

                                        <el-form-item
                                            v-if="
                                                CurrentDiyFieldModel.Component == 'Select' ||
                                                CurrentDiyFieldModel.Component == 'MultipleSelect' ||
                                                CurrentDiyFieldModel.Component == 'Radio' ||
                                                CurrentDiyFieldModel.Component == 'Checkbox' ||
                                                CurrentDiyFieldModel.Component == 'Autocomplete'
                                            "
                                            key="design-17"
                                            class="form-item-top"
                                        >
                                            <div class="form-item-label-slot">显示对应字段</div>
                                            <el-input v-model="CurrentDiyFieldModel.Config.SelectLabel" />
                                        </el-form-item>

                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Select' || CurrentDiyFieldModel.Component == 'Radio'" key="design-18" class="form-item-top">
                                            <div class="form-item-label-slot">
                                                <el-popover placement="left" width="400" trigger="hover">
                                                    <div>
                                                        说明：
                                                        <br />
                                                        Json：会将每个选项的所有字段值存入数据库，且[存储对应字段]设置无效。
                                                        <br />
                                                        字段：只会将[存储对应字段]的值存入数据库。
                                                    </div>
                                                    <template #reference
                                                        ><el-button type="text" style="padding: 0; margin-right: 5px">
                                                            <i class="fas fa-info-circle" /> </el-button
                                                    ></template>
                                                </el-popover>

                                                存储形式
                                            </div>
                                            <el-radio-group v-model="CurrentDiyFieldModel.Config.SelectSaveFormat">
                                                <el-radio :value="'Text'">字段</el-radio>
                                                <el-radio :value="'Json'">Json</el-radio>
                                            </el-radio-group>
                                        </el-form-item>
                                        <el-form-item
                                            v-if="
                                                CurrentDiyFieldModel.Component == 'Select' ||
                                                CurrentDiyFieldModel.Component == 'MultipleSelect' ||
                                                CurrentDiyFieldModel.Component == 'Radio' ||
                                                CurrentDiyFieldModel.Component == 'Checkbox'
                                            "
                                            key="design-19"
                                            class="form-item-top"
                                        >
                                            <div class="form-item-label-slot">存储对应字段</div>
                                            <el-input v-model="CurrentDiyFieldModel.Config.SelectSaveField" />
                                        </el-form-item>

                                        <el-form-item v-if="CurrentDiyFieldModel.Component == 'Select' || CurrentDiyFieldModel.Component == 'MultipleSelect'" label="开启搜索">
                                            <el-switch v-model="CurrentDiyFieldModel.Config.EnableSearch" active-color="#ff6c04" inactive-color="#ccc" />
                                        </el-form-item>

                                        <el-form-item
                                            v-if="
                                                CurrentDiyFieldModel.Component == 'Select' ||
                                                CurrentDiyFieldModel.Component == 'MultipleSelect' ||
                                                CurrentDiyFieldModel.Component == 'Radio' ||
                                                CurrentDiyFieldModel.Component == 'Checkbox' ||
                                                (CurrentDiyFieldModel.Component == 'Text' && CurrentDiyFieldModel.Config.TextAutocomplete) ||
                                                CurrentDiyFieldModel.Component == 'Autocomplete' ||
                                                CurrentDiyFieldModel.Component == 'Cascader' ||
                                                CurrentDiyFieldModel.Component == 'SelectTree'
                                            "
                                            key="design-7"
                                            class="form-item-top"
                                        >
                                            <div class="form-item-label-slot">数据源</div>
                                            <el-radio-group v-model="CurrentDiyFieldModel.Config.DataSource">
                                                <el-radio :value="'Data'">普通数据</el-radio>
                                                <el-radio :value="'Sql'">Sql数据源</el-radio>
                                                <!-- <el-radio :value="'Api'">Api数据源</el-radio> -->
                                                <el-radio :value="'DataSource'">数据源引擎</el-radio>
                                                <el-radio :value="'ApiEngine'">接口引擎</el-radio>
                                            </el-radio-group>
                                        </el-form-item>
                                        <el-form-item
                                            v-if="!DiyCommon.IsNull(CurrentDiyFieldModel.Config) && CurrentDiyFieldModel.Config.DataSource == 'DataSource'"
                                            key="design-6"
                                            class="form-item-top"
                                        >
                                            <template #label><div class="form-item-label-slot">请选择数据源</div></template>
                                            <el-select v-model="CurrentDiyFieldModel.Config.DataSourceId" clearable filterable value-key="Id" placeholder="搜索字段">
                                                <el-option v-for="item in SysDataSourceList" :key="item.Id" :label="item.DataSourceName" :value="item.Id">
                                                    <span style="float: left">{{ item.DataSourceName }}</span>
                                                    <span style="float: right; color: #8492a6; font-size: 14px">{{ item.DataSourceKey }}</span>
                                                </el-option>
                                            </el-select>
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Config && CurrentDiyFieldModel.Config.DataSource == 'ApiEngine'" key="design-6" class="form-item-top">
                                            <template #label><div class="form-item-label-slot">请选择接口引擎</div></template>
                                            <el-select v-model="CurrentDiyFieldModel.Config.DataSourceApiEngineKey" clearable filterable value-key="Id" placeholder="搜索字段">
                                                <el-option v-for="item in ApiEngineList" :key="item.ApiEngineKey" :label="item.ApiName" :value="item.ApiEngineKey">
                                                    <span style="float: left">{{ item.ApiName }}</span>
                                                    <span style="float: right; color: #8492a6; font-size: 14px">{{ item.ApiEngineKey }}</span>
                                                </el-option>
                                            </el-select>
                                        </el-form-item>
                                        <el-form-item
                                            v-if="
                                                !DiyCommon.IsNull(CurrentDiyFieldModel.Config) &&
                                                (CurrentDiyFieldModel.Config.DataSource == 'Sql' ||
                                                    CurrentDiyFieldModel.Config.DataSource == 'DataSource' ||
                                                    CurrentDiyFieldModel.Config.DataSource == 'ApiEngine')
                                            "
                                            key="design-8"
                                            class="form-item-top"
                                        >
                                            <template #label
                                                ><div class="form-item-label-slot">
                                                    <el-popover placement="left" width="400" trigger="hover">
                                                        <div>
                                                            注意：
                                                            <br />
                                                            当Sql数据源数据量较大时、或是持续增长的数据，需要开启远程搜索，以提高加载速度，并且需要在sql数据源中配置Keyword参数、limit前多少条。如：select
                                                            Id,Name from Table where Name like '%$Keyword$%' limit 0,10
                                                        </div>
                                                        <template #reference
                                                            ><el-button link style="padding: 0; margin-right: 5px">
                                                                <i class="fas fa-info-circle" /> </el-button
                                                        ></template>
                                                    </el-popover>
                                                    远程搜索
                                                </div></template
                                            >
                                            <el-switch v-model="CurrentDiyFieldModel.Config.DataSourceSqlRemote" active-color="#ff6c04" inactive-color="#ccc" />
                                        </el-form-item>
                                        <el-form-item v-if="!DiyCommon.IsNull(CurrentDiyFieldModel.Config) && CurrentDiyFieldModel.Config.DataSource == 'Data'" key="design-1" class="form-item-top">
                                            <div class="form-item-label-slot">普通数据</div>
                                            <el-input
                                                v-for="(item, i) in CurrentDiyFieldModel.Data"
                                                :key="CurrentDiyFieldModel.Name + 'dic' + i"
                                                v-model="CurrentDiyFieldModel.Data[i]"
                                                style="margin-bottom: 2px"
                                            >
                                                <template #prepend><el-button :icon="Rank"></el-button></template>
                                                <template #append><el-button @click="CurrentDiyFieldModel.Data.splice(i, 1)" :icon="Delete"></el-button></template>
                                            </el-input>
                                            <el-input v-model="CurrentDiyFieldModel.Config.KeysAddVModel">
                                                <template #prepend><el-button disabled style="color: #ccc" :icon="Rank"></el-button></template>
                                                <template #append><el-button @click="AddKeys" :icon="Plus"></el-button></template>
                                            </el-input>
                                            <el-button
                                                v-if="!DiyCommon.IsNull(CurrentDiyFieldModel.Data) && CurrentDiyFieldModel.Data.length > 0"
                                                key="design-2"
                                                class="button-new-tag"
                                                :icon="Delete"
                                                @click="ClearCurrentDiyFieldModelData"
                                                >清空</el-button
                                            >
                                        </el-form-item>

                                        <el-form-item v-if="!DiyCommon.IsNull(CurrentDiyFieldModel.Config) && CurrentDiyFieldModel.Config.DataSource == 'Sql'" key="design-3" class="form-item-top">
                                            <div class="form-item-label-slot">
                                                <el-popover placement="left" width="400" trigger="hover">
                                                    <div>
                                                        注意：
                                                        <br />
                                                        当Sql数据源数据量较大时、或是持续增长的数据，需要开启远程搜索，以提高加载速度，并且需要在sql数据源中配置Keyword参数、limit前多少条。如：select
                                                        Id,Name from Table where Name like '%$Keyword$%' limit 0,10
                                                    </div>
                                                    <template #reference
                                                        ><el-button link style="padding: 0; margin-right: 5px">
                                                            <i class="fas fa-info-circle" /> </el-button
                                                    ></template>
                                                </el-popover>
                                                Sql数据源
                                            </div>
                                            <el-input type="textarea" :rows="5" v-model="CurrentDiyFieldModel.Config.Sql" />
                                        </el-form-item>

                                        <el-form-item v-if="!DiyCommon.IsNull(CurrentDiyFieldModel.Config) && CurrentDiyFieldModel.Config.DataSource == 'Api'" key="design-4" class="form-item-top">
                                            <div class="form-item-label-slot">
                                                <el-popover placement="left" width="400" trigger="hover">
                                                    <div>
                                                        注意：
                                                        <br />
                                                        支持$CurrentUser.Id$等参数
                                                    </div>
                                                    <template #reference
                                                        ><el-button type="text" style="padding: 0; margin-right: 5px">
                                                            <i class="fas fa-info-circle" /> </el-button
                                                    ></template>
                                                </el-popover>
                                                Api数据源
                                            </div>
                                            <el-input type="textarea" :rows="5" placeholder="https://" v-model="CurrentDiyFieldModel.Config.Api" />
                                        </el-form-item>
                                    </el-form>
                                    <el-divider content-position="left"
                                        ><el-icon><Tools /></el-icon> 其它设置</el-divider
                                    >
                                    <el-form class="form-setting" :model="CurrentDiyFieldModel" label-width="85px" label-position="top">
                                        <el-form-item label="代码标记">
                                            <el-input v-model="CurrentDiyFieldModel.Code" />
                                        </el-form-item>
                                        <el-form-item label="必填">
                                            <el-switch v-model="CurrentDiyFieldModel.NotEmpty" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                                        </el-form-item>
                                        <el-form-item label="默认值">
                                            <el-input v-model="CurrentDiyFieldModel.DefaultValue" placeholder="特殊组件默认值也可填写json字符串" />
                                        </el-form-item>
                                        <el-form-item label="可见">
                                            <el-switch v-model="CurrentDiyFieldModel.Visible" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                                        </el-form-item>
                                        <el-form-item label="移动端可见">
                                            <el-switch v-model="CurrentDiyFieldModel.AppVisible" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                                        </el-form-item>
                                        <el-form-item label="只读">
                                            <el-switch v-model="CurrentDiyFieldModel.Readonly" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                                        </el-form-item>
                                        <el-form-item label="唯一">
                                            <el-switch v-model="CurrentDiyFieldModel.Unique" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyFieldModel.Unique && CurrentDiyFieldModel.Config && CurrentDiyFieldModel.Config.Unique" key="design-5" label="唯一方式">
                                            <el-radio-group v-model="CurrentDiyFieldModel.Config.Unique.Type">
                                                <el-radio :value="'Alone'">单独唯一(允许空值重复)</el-radio>
                                                <el-radio :value="'All'">同时唯一</el-radio>
                                            </el-radio-group>
                                        </el-form-item>

                                        <el-form-item class="form-item-top">
                                            <div class="form-item-label-slot">绑定角色</div>
                                            <el-select v-model="CurrentDiyFieldModel.BindRole" clearable multiple placeholder="">
                                                <el-option v-for="item in SysRoleList" :key="item.Id" :label="item.Name" :value="item.Id" />
                                            </el-select>
                                        </el-form-item>

                                        <el-form-item class="form-item-top">
                                            <div class="form-item-label-slot">表单占宽</div>
                                            <div class="clear">
                                                <el-radio-group v-model="CurrentDiyFieldModel.FormWidth">
                                                    <el-radio :value="24">100%</el-radio>
                                                    <el-radio :value="12">50%</el-radio>
                                                    <el-radio :value="8">33%</el-radio>
                                                    <el-radio :value="''">跟随表单设置</el-radio>
                                                </el-radio-group>
                                            </div>
                                        </el-form-item>
                                        <el-form-item class="form-item-top" label="表单V8模板引擎"
                                            @click="OpenV8CodeEditor('CurrentDiyFieldModel.V8TmpEngineForm')">
                                            <el-button type="primary" size="small" @click.stop="OpenV8CodeEditor('CurrentDiyFieldModel.V8TmpEngineForm')">
                                                编辑代码
                                            </el-button>
                                        </el-form-item>

                                        <el-form-item label="表格占宽">
                                            <el-input-number v-model="CurrentDiyFieldModel.TableWidth" :min="50" :max="500" label="单位px" />
                                        </el-form-item>
                                        <el-form-item class="form-item-top" label="表格V8模板引擎"
                                            @click="OpenV8CodeEditor('CurrentDiyFieldModel.V8TmpEngineTable')">
                                            <el-button type="primary" size="small" @click.stop="OpenV8CodeEditor('CurrentDiyFieldModel.V8TmpEngineTable')">
                                                编辑代码
                                            </el-button>
                                        </el-form-item>
                                    </el-form>
                                </div>
                            </el-tab-pane>

                            <el-tab-pane name="Form">
                                <template #label
                                    ><span><fa-icon :class="'fa-wpforms'" />表单属性</span></template
                                >

                                <div class="div-scroll diy-design-right-form" style="height: calc(100vh - 120px)">
                                    <!-- label-width="80px" -->
                                    <el-form class="form-setting" :model="CurrentDiyTableModel" label-position="top">
                                        <el-form-item label="表名、说明">
                                            <el-input
                                                :value="CurrentDiyTableModel.Name + ' (' + CurrentDiyTableModel.Description + ')' + ' (' + CurrentDiyTableModel.Id + ')'"
                                                disabled
                                                type="textarea"
                                                :rows="3"
                                                placeholder=""
                                            />
                                        </el-form-item>
                                        <el-form-item label="访问权限（前端）">
                                            <el-select v-model="CurrentDiyTableModel.BindRole" clearable multiple placeholder="请选择">
                                                <el-option v-for="item in SysRoleList" :key="item.Id" :label="item.Name" :value="item.Id" />
                                            </el-select>
                                        </el-form-item>
                                        <el-form-item label="电脑端布局">
                                            <el-radio-group v-model="CurrentDiyTableModel.Column">
                                                <el-radio :value="1">单列</el-radio>
                                                <el-radio :value="2">双列</el-radio>
                                                <el-radio :value="3">三列</el-radio>
                                                <el-radio :value="4">四列</el-radio>
                                                <el-radio :value="6">六列</el-radio>
                                            </el-radio-group>
                                        </el-form-item>

                                        <el-form-item label="表单分组">
                                            <div class="clear">
                                                <el-table :data="CurrentDiyTableModel.Tabs" style="width: 100%">
                                                    <el-table-column :label="$t('Msg.Sort')" width="85">
                                                        <template #reference="scope">
                                                            <el-input-number v-model="scope.row.Sort" :width="62" controls-position="right" style="width: 62px" placeholder="" />
                                                        </template>
                                                    </el-table-column>

                                                    <el-table-column :label="$t('Msg.Name')">
                                                        <template #reference="scope">
                                                            <el-input v-model="scope.row.Name" placeholder="" />
                                                        </template>
                                                    </el-table-column>

                                                    <el-table-column width="80" :label="$t('Msg.Action')">
                                                        <template #reference="scope">
                                                            <span class="hand" style="display: inline-block; padding: 5px; cursor: pointer" @click="$refs['fasTabsIcon_' + scope.$index].show()">
                                                                <fa-icon :icon="DiyCommon.IsNull(scope.row.Icon) ? 'far fa-smile-wink' : scope.row.Icon" />
                                                            </span>
                                                            <Fontawesome :ref="'fasTabsIcon_' + scope.$index" v-model:model="scope.row.Icon" />
                                                            <el-button link :icon="Delete" @click="DelDiyTableTab(scope.row)" style="margin-left: 5px">
                                                                <!-- {{ $t('Msg.Delete') }} -->
                                                            </el-button>
                                                        </template>
                                                    </el-table-column>
                                                </el-table>
                                            </div>
                                            <div class="clear marginTop10">
                                                <el-form :inline="true" :model="CurrentDiyTableTabModel" class="demo-form-inline">
                                                    <el-form-item label="">
                                                        <el-input-number
                                                            v-model="CurrentDiyTableTabModel.Sort"
                                                            :width="62"
                                                            style="width: 62px"
                                                            controls-position="right"
                                                            :placeholder="$t('Msg.Sort')"
                                                        />
                                                    </el-form-item>
                                                    <el-form-item label="">
                                                        <el-input v-model="CurrentDiyTableTabModel.Name" style="width: 100px" :placeholder="$t('Msg.Name')" />
                                                    </el-form-item>
                                                    <el-form-item label="">
                                                        <span class="hand" style="display: inline-block; padding: 5px; cursor: pointer" @click="$refs.fasCDTTMIcon.show()">
                                                            <fa-icon :icon="DiyCommon.IsNull(CurrentDiyTableTabModel.Icon) ? 'far fa-smile-wink' : CurrentDiyTableTabModel.Icon" />
                                                        </span>
                                                        <Fontawesome ref="fasCDTTMIcon" v-model:model="CurrentDiyTableTabModel.Icon" />
                                                    </el-form-item>
                                                    <el-form-item>
                                                        <el-button style="width: 45px" :icon="Plus" link @click="AddDiyTableTab">{{ $t("Msg.Add") }}</el-button>
                                                    </el-form-item>
                                                </el-form>
                                            </div>
                                        </el-form-item>

                                        <el-form-item label="分组标签位置">
                                            <el-radio-group v-model="CurrentDiyTableModel.TabsPosition">
                                                <el-radio :value="'left'">左则</el-radio>
                                                <el-radio :value="'top'">上边</el-radio>
                                                <el-radio :value="'bottom'">下边</el-radio>
                                                <el-radio :value="'right'">右侧</el-radio>
                                            </el-radio-group>
                                        </el-form-item>
                                        <el-form-item label="Tab分栏">
                                            <el-switch v-model="CurrentDiyTableModel.TabsTop" :active-value="1" :inactive-value="0" active-color="#ff6c04" inactive-color="#ccc" />
                                        </el-form-item>
                                        <el-form-item label="显示默认字段">
                                            <el-switch v-model="CurrentDiyTableModel.DisplayDefaultField" :active-value="1" :inactive-value="0" active-color="#ff6c04" inactive-color="#ccc" />
                                        </el-form-item>
                                        <el-form-item label="表单打开方式">
                                            <div class="clear">
                                                <el-radio-group v-model="CurrentDiyTableModel.FormOpenType">
                                                    <el-radio :value="'Dialog'">弹窗</el-radio>
                                                    <el-radio :value="'Drawer'">抽屉</el-radio>
                                                    <el-radio :value="'Page'">新页面</el-radio>
                                                </el-radio-group>
                                            </div>
                                        </el-form-item>
                                        <el-form-item label="弹窗/抽屉宽度">
                                            <div class="clear">
                                                <el-input v-model="CurrentDiyTableModel.FormOpenWidth" type="text" placeholder="768px/70%" />
                                            </div>
                                        </el-form-item>

                                        <el-form-item label="标签对齐方式">
                                            <div class="clear">
                                                <el-radio-group v-model="CurrentDiyTableModel.FormLabelPosition">
                                                    <el-radio :value="'left'">左对齐</el-radio>
                                                    <el-radio :value="'right'">右对齐</el-radio>
                                                    <el-radio :value="'top'">顶部对齐</el-radio>
                                                </el-radio-group>
                                            </div>
                                        </el-form-item>

                                        <el-form-item label="输入框样式">
                                            <div class="clear">
                                                <el-radio-group v-model="CurrentDiyTableModel.InputBorderStyle">
                                                    <el-radio :value="'Line'">线条</el-radio>
                                                    <el-radio :value="'Border'">边框</el-radio>
                                                </el-radio-group>
                                            </div>
                                        </el-form-item>

                                        <el-form-item
                                            label="字段边框样式"
                                        >
                                            <div class="clear">
                                                <el-radio-group v-model="CurrentDiyTableModel.FieldBorder">
                                                    <el-radio :value="'Line'">线</el-radio>
                                                    <el-radio :value="'Border'">边框</el-radio>
                                                </el-radio-group>
                                            </div>
                                        </el-form-item>

                                        <el-form-item label="表内编辑">
                                            <el-switch v-model="CurrentDiyTableModel.TableInEdit" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                                        </el-form-item>

                                        <el-form-item v-if="DiyCommon.IsArray(CurrentDiyTableModel.RowAction)" label="行操作" key="design-9">
                                            <div style="clear: both">
                                                <el-checkbox-group v-model="CurrentDiyTableModel.RowAction">
                                                    <!-- true-label="Detail" -->
                                                    <el-checkbox :value="$t('Msg.Detail')" />
                                                    <el-checkbox :value="$t('Msg.Edit')" />
                                                    <el-checkbox :value="$t('Msg.Del')" />
                                                </el-checkbox-group>
                                            </div>
                                        </el-form-item>
                                        <!--树形结构-->
                                        <el-form-item label="树形结构">
                                            <!-- :disabled="true" -->
                                            <el-switch v-model="CurrentDiyTableModel.IsTree" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyTableModel.IsTree" label="树形结构父级字段（一般指ParentId，必填）" key="design-10">
                                            <el-input v-model="CurrentDiyTableModel.TreeParentField" placeholder="" />
                                        </el-form-item>
                                        <el-form-item
                                            v-if="CurrentDiyTableModel.IsTree"
                                            key="design-11"
                                            label="树形结构完整父级字段（一般指FullPath/ParentIds，如：parentid1,parentid2,parentid3,【以英文逗号结尾】，必填）"
                                        >
                                            <el-input v-model="CurrentDiyTableModel.TreeParentFields" placeholder="" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyTableModel.IsTree" key="design-12" label="懒加载">
                                            <el-switch v-model="CurrentDiyTableModel.TreeLazy" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                                        </el-form-item>
                                        <el-form-item v-if="CurrentDiyTableModel.IsTree" label="判断是否有子级的字段（可选，懒加载用到）" key="design-13">
                                            <el-input v-model="CurrentDiyTableModel.TreeHasChildren" placeholder="" />
                                        </el-form-item>
                                        <!--树形结构   END-->

                                        <el-form-item label="启用缓存(建议数据量较少的表开启缓存)">
                                            <el-switch v-model="CurrentDiyTableModel.EnableCache" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                                        </el-form-item>
                                        <el-form-item v-if="!DiyCommon.IsNull($refs.fieldForm) && CurrentDiyTableModel.EnableCache" label="分级缓存（以某字段值做为缓存key）" key="design-14">
                                            <el-select v-model="CurrentDiyTableModel.CacheParentKey" filterable clearable placeholder="">
                                                <el-option
                                                    v-for="(item, index) in $refs.fieldForm.DiyFieldList"
                                                    :key="'fjhc_' + item.Id + index"
                                                    :label="item.Label + ' - ' + item.Name"
                                                    :value="item.Name"
                                                />
                                            </el-select>
                                        </el-form-item>

                                        <el-form-item label="数据加密传输">
                                            <el-switch
                                                v-model="CurrentDiyTableModel.DataEncryptTransfer"
                                                :disabled="true"
                                                :active-value="1"
                                                :inactive-value="0"
                                                active-color="#ff6c04"
                                                inactive-color="#ccc"
                                            />
                                        </el-form-item>

                                        <el-form-item label="数据加密存储">
                                            <el-switch
                                                v-model="CurrentDiyTableModel.DataEncryptSave"
                                                :disabled="true"
                                                :active-value="1"
                                                :inactive-value="0"
                                                active-color="#ff6c04"
                                                inactive-color="#ccc"
                                            />
                                        </el-form-item>

                                        <el-form-item class="form-item-top" label="前端进入表单V8事件"
                                            @click="OpenV8CodeEditor('CurrentDiyTableModel.InFormV8')">
                                            <el-button type="primary" size="small" @click.stop="OpenV8CodeEditor('CurrentDiyTableModel.InFormV8')">
                                                编辑代码
                                            </el-button>
                                        </el-form-item>

                                        <el-form-item class="form-item-top" label="前端提交表单前V8事件"
                                            @click="OpenV8CodeEditor('CurrentDiyTableModel.SubmitFormV8')">
                                            <el-button type="primary" size="small" @click.stop="OpenV8CodeEditor('CurrentDiyTableModel.SubmitFormV8')">
                                                编辑代码
                                            </el-button>
                                        </el-form-item>

                                        <el-form-item class="form-item-top" label="前端离开表单后V8事件"
                                            @click="OpenV8CodeEditor('CurrentDiyTableModel.OutFormV8')">
                                            <el-button type="primary" size="small" @click.stop="OpenV8CodeEditor('CurrentDiyTableModel.OutFormV8')">
                                                编辑代码
                                            </el-button>
                                        </el-form-item>
                                        <el-form-item label="服务器端数据处理V8事件"
                                             @click="OpenV8CodeEditor('CurrentDiyTableModel.ServerDataV8')">
                                            <el-button type="primary" size="small" @click.stop="OpenV8CodeEditor('CurrentDiyTableModel.ServerDataV8')">
                                                编辑代码
                                            </el-button>
                                        </el-form-item>

                                        <el-form-item class="form-item-top" label="服务器端表单提交前V8事件">
                                            <el-button type="primary" size="small" @click.stop="OpenV8CodeEditor('CurrentDiyTableModel.SubmitBeforeServerV8')">
                                                编辑代码
                                            </el-button>
                                        </el-form-item>
                                        <el-form-item class="form-item-top" label="服务器端表单提交后V8事件">
                                            <el-button type="primary" size="small" @click.stop="OpenV8CodeEditor('CurrentDiyTableModel.SubmitAfterServerV8')">
                                                编辑代码
                                            </el-button>
                                        </el-form-item>

                                        <div v-if="!DiyCommon.IsNull(CurrentDiyTableModel.ApiReplace)" key="design-16">
                                            <el-form-item>
                                                <el-tooltip class="item" effect="dark" placement="right">
                                                    <template #content
                                                        ><div>
                                                            <p>支持$ApiBase$、$OsClient$变量</p>
                                                        </div></template
                                                    >
                                                    <span style="float: none; margin-bottom: 10px; cursor: pointer">
                                                        <el-icon style="margin-right: 3px"><InfoFilled /></el-icon>
                                                        查询接口替换
                                                    </span>
                                                </el-tooltip>
                                                <div class="clear">
                                                    <el-input v-model="CurrentDiyTableModel.ApiReplace.Select" type="textarea" placeholder="" :rows="2" />
                                                </div>
                                            </el-form-item>
                                            <el-form-item>
                                                <el-tooltip class="item" effect="dark" placement="right">
                                                    <template #content
                                                        ><div>
                                                            <p>支持$ApiBase$、$OsClient$变量</p>
                                                        </div></template
                                                    >
                                                    <span style="float: none; margin-bottom: 10px; cursor: pointer">
                                                        <el-icon style="margin-right: 3px"><InfoFilled /></el-icon>
                                                        新增接口替换
                                                    </span>
                                                </el-tooltip>
                                                <div class="clear">
                                                    <el-input v-model="CurrentDiyTableModel.ApiReplace.Insert" type="textarea" placeholder="" :rows="2" />
                                                </div>
                                            </el-form-item>
                                            <el-form-item>
                                                <el-tooltip class="item" effect="dark" placement="right">
                                                    <template #content
                                                        ><div>
                                                            <p>支持$ApiBase$、$OsClient$变量</p>
                                                        </div></template
                                                    >
                                                    <span style="float: none; margin-bottom: 10px; cursor: pointer">
                                                        <el-icon style="margin-right: 3px"><InfoFilled /></el-icon>
                                                        修改接口替换
                                                    </span>
                                                </el-tooltip>
                                                <div class="clear">
                                                    <el-input v-model="CurrentDiyTableModel.ApiReplace.Update" type="textarea" placeholder="" :rows="2" />
                                                </div>
                                            </el-form-item>
                                            <el-form-item>
                                                <el-tooltip class="item" effect="dark" placement="right">
                                                    <template #content
                                                        ><div>
                                                            <p>支持$ApiBase$、$OsClient$变量</p>
                                                        </div></template
                                                    >
                                                    <span style="float: none; margin-bottom: 10px; cursor: pointer">
                                                        <el-icon style="margin-right: 3px"><InfoFilled /></el-icon>
                                                        删除接口替换
                                                    </span>
                                                </el-tooltip>
                                                <div class="clear">
                                                    <el-input v-model="CurrentDiyTableModel.ApiReplace.Delete" type="textarea" placeholder="" :rows="2" />
                                                </div>
                                            </el-form-item>
                                        </div>
                                        <el-form-item label="允许匿名读取">
                                            <el-switch v-model="CurrentDiyTableModel.IsAnonymousRead" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                                        </el-form-item>
                                        <el-form-item label="允许匿名新增">
                                            <el-switch v-model="CurrentDiyTableModel.IsAnonymousAdd" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                                        </el-form-item>
                                        <!-- 刘诚新增,2024-11-12 -->
                                        <el-form-item label="启用数据日志">
                                            <el-switch v-model="CurrentDiyTableModel.EnableDataLog" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                                        </el-form-item>
                                        <el-form-item label="日志访问权限(已选中可访问)">
                                            <el-select v-model="CurrentDiyTableModel.DataLogRole" clearable multiple placeholder="请选择">
                                                <el-option v-for="item in SysRoleList" :key="item.Id" :label="item.Name" :value="item.Id" />
                                            </el-select>
                                        </el-form-item>
                                    </el-form>
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
            v-if="!DiyCommon.IsNull($refs.fieldForm) && !DiyCommon.IsNull($refs.fieldForm.DiyFieldList)"
            :fields="$refs.fieldForm.DiyFieldList"
            v-model:model="currentV8Model"
        ></DiyV8Design>
    </div>
</template>

<script>
import { computed } from "vue";
import _ from "underscore";
import "dragula/dist/dragula.css";
import dragula from "dragula/dragula";
import { useDiyStore } from "@/stores";
import DiyChildTableCallback from "./diy-components/diy-writebackChild.vue";
import DiyV8Design from "./diy-components/diy-v8design";
import lodash from "lodash";

export default {
    name: "DiyDesign",
    directives: {},
    components: {
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
                return _.where(this.DiyComponentList, {
                    Type: "Base"
                });
            }
        },
        DiyComponentListAdvancedListen: {
            get() {
                return _.where(this.DiyComponentList, {
                    Type: "Advanced"
                });
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
            CurrentErrorFieldModel: {},
            CurrentDeletedFieldModel: {},
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
            CurrentDiyFieldModel: {},
            CurrentDiyTableModel: {},
            FormDiyTableModel: {},
            AsideRightActiveTab: "Form",
            FieldActiveTab: "none",
            DiyComponentList: [],
            TableId: "",
            TableRowId: "",
            DragulaObj: null,

            LastLoadDragulaIndex: -1,
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
        self.$nextTick(function () {
            self.$refs.fieldForm.Init(false);
        });

        self.GetDiyComponent();
        self.GetSysRole();
        self.GetSysMenu();
        self.GetSysDataSourceList();
        self.GetApiEngineList();
        self.GetExceptionFieldList();
        self.GetDeletedDiyField();
        self.$nextTick(function () {
            // self.LoadDragula();
        });
    },
    methods: {
        RecoverDiyField() {
            var self = this;
            self.DiyCommon.Post(
                "/api/diyfield/RecoverDiyField",
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
            if (self.CurrentErrorFieldModel.ErrorType == "DbField") {
                self.DiyCommon.Post(
                    "/api/diyfield/addDiyField",
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
            else if (self.CurrentErrorFieldModel.ErrorType == "DiyField") {
                self.DiyCommon.Post(
                    "/api/diyfield/addDbField",
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
                "/api/diyfield/getDeletedDiyField",
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
                "/api/diyfield/getExceptionFieldList",
                {
                    TableId: self.TableId
                },
                function (result) {
                    if (result.Code == 1) {
                        self.CurrentErrorFieldModel = {};
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
                self.CurrentDiyFieldModel = {};
                // self.DiyFieldList = self.$refs.fieldForm.DiyFieldList;
            } else {
                self.$refs.fieldForm.SelectField(val);
            }
        },
        SelectFieldFilterMethod(value) {
            var self = this;
            self.DiyFieldListClone = self.$refs.fieldForm.DiyFieldList.filter(
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
        CallbackLoadDragula(idIndex) {
            var self = this;
            self.LoadDragula(idIndex);
        },
        CallbackGetDiyField(diyFieldList) {
            var self = this;
            self.DiyFieldList = diyFieldList;
            self.DiyFieldListClone = lodash.cloneDeep(self.DiyFieldList);
        },
        LoadDragula(idIndex) {
            var self = this;
            if (document.getElementById("field-form-" + idIndex) != null) {
                if (self.LastLoadDragulaIndex == idIndex) {
                    return;
                }
                self.LastLoadDragulaIndex = idIndex;
                if (self.DragulaObj != null) {
                    try {
                        self.DragulaObj.destroy();
                    } catch (error) {}
                }
                // console.log('idIndex:' + idIndex)
                self.DragulaObj = dragula([document.getElementById("row-field"), document.getElementById("field-form-" + idIndex)], {
                    // copy:true,
                    copy: function (el, source) {
                        // 只有左侧控件才能复制
                        return source === document.getElementById("row-field");
                    },
                    accepts: function (el, target, source, sibling) {
                        // 只有中间区域才能接受
                        return target === document.getElementById("field-form-" + idIndex);
                    },
                    moves: function (el, container, handle) {
                        return (
                            // 只有左侧控件才能拖，[基础控件][高级控件]文字禁止拖动
                            handle.className.indexOf("el-tag") > -1 || handle.className.indexOf("icon") > -1
                        );
                    }
                }).on("dragend", (el) => {
                    // var obj = $(el).context.parentElement
                    //升级jquery3.5.1后
                    var obj = el.parentElement;

                    if (!self.DiyCommon.IsNull(obj) && obj.id == "field-form-" + idIndex) {
                        // 添加字段
                        // var fieldControl = $(el).context.attributes['data-field'].value
                        //升级jquery3.5.1后
                        var fieldControl = el.getAttribute("data-field");
                        var componentModel = _.where(self.DiyComponentList, {
                            Control: fieldControl
                        })[0];
                        // var tab = $(obj).attr('data-tab')
                        //升级jquery3.5.1后
                        var tab = obj.getAttribute("data-tab");
                        if (tab == "none" || tab == "info" || !tab) {
                            tab = "";
                        }
                        self.AddDiyField({
                            Name: "", // componentModel.Control + '_' + new Date().Format('yyyyMMddHHmmss'),
                            Label: componentModel.Name,
                            Type: componentModel.FieldType,
                            Component: componentModel.Control,
                            Visible: 1,
                            AppVisible: 1,
                            Tab: tab,
                            TableWidth: 120,
                            NameConfirm: 0,
                            // Readonly : self.DiyCommon.IsNull(componentModel.Readonly) ? false : componentModel.Readonly
                            Readonly: componentModel.Readonly ? 1 : 0
                        });
                        // $(el).remove()
                        //升级jquery3.5.1后
                        el.remove();
                    }
                });
                // .on("cloned", (clone, original, type) => {

                // })
            }
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
                var fieldList = lodash.cloneDeep(self.$refs.fieldForm.DiyFieldList);

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
                            // OsClient: self.OsClient,
                            _FieldList: JSON.stringify(fieldList),
                            // _FieldList: fieldList,
                            TableId: self.$route.params.Id
                        },
                        function (result) {
                            self.SaveAllDiyFieldLoding = false;
                            if (self.DiyCommon.Result(result)) {
                                self.DiyCommon.Tips(self.$t("Msg.Success"));

                                // 全部保存是可以重新查询的
                                // self.GetDiyField()
                                self.FieldForm_GetAllData();

                                if (!self.DiyCommon.IsNull(self.CurrentDiyFieldModel.Id)) {
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
        DelDiyField() {
            var self = this;
            try {
                self.DiyCommon.OsConfirm(
                    self.$t("Msg.ConfirmDelTo") + "【" + self.CurrentDiyFieldModel.Name + "】？",
                    function () {
                        self.SaveAllDiyFieldLoding = true;
                        self.DiyCommon.Post(
                            self.DiyApi.DelDiyField,
                            {
                                Id: self.CurrentDiyFieldModel.Id
                                // OsClient: self.OsClient
                            },
                            function (result) {
                                self.SaveAllDiyFieldLoding = false;
                                if (self.DiyCommon.Result(result)) {
                                    self.DiyCommon.Tips(self.$t("Msg.Success"));
                                    // self.DiyFieldList.push(result.Data);
                                    // self.GetDiyField();
                                    self.$refs.fieldForm.DelDiyFieldArr(result.Data);
                                    self.CurrentDiyFieldModel = {};
                                }
                            },
                            function () {
                                self.SaveAllDiyFieldLoding = false;
                            }
                        );
                    },
                    function () {}
                );
            } catch (error) {
                self.SaveAllDiyFieldLoding = false;
                console.log(error);
            }
        },
        AddDiyField(param) {
            var self = this;
            param.TableId = self.$route.params.Id;
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
            self.DiyCommon.Post(apiUrl, param, function (result) {
                if (self.DiyCommon.Result(result)) {
                    self.DiyCommon.Tips(self.$t("Msg.Success"));
                    // self.DiyFieldList.push(result.Data);
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

                    // self.GetDiyField();
                    self.$refs.fieldForm.AddDiyFieldArr(result.Data);
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

            self.CurrentDiyTableModel = model;
            self.$emit("CallbackSetDiyTableModel", model);
            // self.DiyCommon.ChangePageTabName('diy_field', self.$t('Msg.Design') + ' ' + model.Name.replace('Diy_', ''))
        },
        DiyTableJsonToStr(data) {
            var self = this;
            if (self.DiyCommon.IsNull(data.RowAction)) {
                data.RowAction = "[]";
            } else {
                data.RowAction = JSON.stringify(data.RowAction);
            }

            if (self.DiyCommon.IsNull(data.Tabs)) {
                data.Tabs = "[]";
            } else {
                data.Tabs = JSON.stringify(data.Tabs);
            }

            if (self.DiyCommon.IsNull(data.BindRole)) {
                data.BindRole = "[]";
            } else {
                data.BindRole = JSON.stringify(data.BindRole);
            }

            //刘诚2025-03-18增（修改日志分角色访问）
            if (self.DiyCommon.IsNull(data.DataLogRole)) {
                data.DataLogRole = "[]";
            } else {
                data.DataLogRole = JSON.stringify(data.DataLogRole);
            }

            if (self.DiyCommon.IsNull(data.TableTabs)) {
                data.TableTabs = "[]";
            } else {
                data.TableTabs = JSON.stringify(data.TableTabs);
            }

            if (!self.DiyCommon.IsNull(data.ApiReplace)) {
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
                    //是否需要判断数据源为Sql时，清空data.Data？
                    if (data.Config.DataSource !== "Data") {
                        data.Data = "[]";
                    }
                    //2022-07-14新增：像field.Config.JoinForm.TableId/Id这类值，要清空掉
                    if (data.Config.JoinForm) {
                        data.Config.JoinForm.TableId = "";
                        data.Config.JoinForm.TableName = "";
                        data.Config.JoinForm.Id = "";
                        data.Config.JoinForm.FormMode = "";
                        data.Config.JoinForm._SearchEqual = {};
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

<style lang="scss">
.diy-design-container {
    border-radius: 4px;
    height: calc(100vh - 80px);
    background-color: #fff;
    .keyword-search {
        // border-bottom: solid 1px #ccc;
        padding-left: 20px;
        .el-form-item--mini.el-form-item {
            margin-bottom: 10px;
            margin-top: 10px;
        }
    }
}

.field-container {
    height: calc(100vh - 135px);
    .aside {
        background: transparent;
        padding-left: 20px;
        padding-right: 20px;
        padding-top: 0;
        // height: calc(100vh - 84px);
        margin-bottom: 20px;
    }

    .aside-left {
        border-right: 1px solid #e6ebf5 !important;
        padding-bottom: 0;
    }

    .aside-right {
        border-left: 1px solid #e6ebf5 !important;
        padding-left: 0;
        padding-right: 0;
        padding-bottom: 0;
    }

    .center-main {
        background-color: transparent;
        padding-top: 10px;
        // height: calc(100vh - 84px);
        margin-bottom: 20px;

        .field-form {
            // height: calc(100vh - 158px);
            // border: 1px dashed #ff6c04;
            position: relative;
            padding: 15px;

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
