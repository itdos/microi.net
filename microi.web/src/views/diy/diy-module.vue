<template>
    <div>
        <el-dialog
            draggable
            :width="'75%'"
            ref="refDiyModuleDialog"
            :modal-append-to-body="false"
            v-model="ShowMenuForm"
            :close-on-click-modal="false"
            :close-on-press-escape="false"
            :destroy-on-close="false"
            :append-to-body="true"
            @open="onDialogOpen('refDiyModuleDialog')"
            @close="onDialogClose('refDiyModuleDialog')"
        >
            <template #header>
                <i class="fas fa-bars" />
                {{ DiyCommon.IsNull(CurrentSysMenuModel.Name) ? "菜单" : CurrentSysMenuModel.Name }}
            </template>
            <div class="list-group microi-desktop-tab-content openDiv" style="padding-top: 0px">
                <!-- v-show="ActiveLeftMenu.Id == 'basedata'" -->
                <div class="microi-desktop-tab-item">
                    <el-tabs v-model="CurrentSysMenuModelTab" id="field-form-tabs" class="field-form-tabs">
                        <el-tab-pane label="基础信息" name="Info">
                            <div :class="'field-form field-border'">
                                <el-form status-icon :model="CurrentSysMenuModel" label-width="150px">
                                    <el-row :gutter="20">
                                        <!--开始循环组件-->
                                        <el-col :span="24" :xs="24">
                                            <div class="container-form-item">
                                                <el-form-item class="form-item" :label="$t('Msg.Parent')">
                                                    <el-popover placement="bottom" trigger="click" style="width: 200px; z-index: 4000">
                                                        <el-tree :data="SysMenuList" node-key="Id" :props="SysMenuTreeProps" @node-click="sysMenuTreeClick" />
                                                        <template #reference
                                                            ><el-button style="width: 200px; padding: 10px 20px; margin-right: 15px">
                                                                {{ ParentName }}
                                                            </el-button></template
                                                        >
                                                    </el-popover>
                                                    <el-button type="primary" :icon="RefreshLeft" plain @click="DefaultParent">重置</el-button>
                                                </el-form-item>
                                            </div>
                                        </el-col>
                                        <el-col :span="12" :xs="24">
                                            <div class="container-form-item">
                                                <el-form-item class="form-item" :label="'*' + $t('Msg.Name')">
                                                    <el-input v-model="CurrentSysMenuModel.Name" @blur="MenuNameBlur()" clearable></el-input>
                                                </el-form-item>
                                            </div>
                                        </el-col>
                                        <el-col :span="12" :xs="24">
                                            <div class="container-form-item">
                                                <el-form-item class="form-item" :label="$t('Msg.Description')">
                                                    <el-input v-model="CurrentSysMenuModel.Description" clearable></el-input>
                                                </el-form-item>
                                            </div>
                                        </el-col>

                                        <!-- <template v-if="EnableEnEdit === true">
                                        <el-col
                                            :span="12"
                                            :xs="24"
                                            >
                                            <div class="container-form-item">
                                                <el-form-item
                                                    class="form-item"
                                                    :label="$t('Msg.EnName')"
                                                   >
                                                    <el-input v-model="CurrentSysMenuModel.EnName" clearable></el-input>
                                                </el-form-item>
                                            </div>
                                        </el-col>
                                        <el-col
                                            :span="12"
                                            :xs="24"
                                            >
                                            <div class="container-form-item">
                                                <el-form-item
                                                    class="form-item"
                                                    :label="$t('Msg.EnDescription')"
                                                   >
                                                    <el-input v-model="CurrentSysMenuModel.EnDescription" clearable></el-input>
                                                </el-form-item>
                                            </div>
                                        </el-col>
                                    </template> -->
                                        <el-col :span="12" :xs="24">
                                            <div class="container-form-item">
                                                <el-form-item class="form-item" :label="$t('Msg.IconClass')">
                                                    <div
                                                        @click="$refs.fasCSMMIcon.show()"
                                                        style="height: 25px; width: 25px; background: #f5f5f5; cursor: pointer; text-align: center; border-radius: 5px"
                                                    >
                                                        <fa-icon :icon="DiyCommon.IsNull(CurrentSysMenuModel.IconClass) ? 'far fa-smile-wink hand' : 'hand ' + CurrentSysMenuModel.IconClass" />
                                                    </div>
                                                </el-form-item>
                                            </div>
                                        </el-col>
                                        <el-col :span="12" :xs="24">
                                            <div class="container-form-item">
                                                <el-form-item class="form-item" :label="'模块引擎Key'">
                                                    <el-input v-model="CurrentSysMenuModel.ModuleEngineKey" clearable></el-input>
                                                </el-form-item>
                                            </div>
                                        </el-col>
                                        <el-col :span="12" :xs="24">
                                            <div class="container-form-item">
                                                <el-form-item class="form-item" :label="$t('Msg.Sort')">
                                                    <el-input v-model="CurrentSysMenuModel.Sort" type="number" clearable></el-input>
                                                </el-form-item>
                                            </div>
                                        </el-col>
                                        <el-col :span="12" :xs="24">
                                            <div class="container-form-item">
                                                <el-form-item class="form-item" :label="$t('Msg.OpenType')">
                                                    <el-select v-model="CurrentSysMenuModel.OpenType" style="width: 100%" placeholder="请选择">
                                                        <el-option v-for="item in ['Diy', 'Component', 'Iframe', 'SecondMenu', 'Report']" :key="item" :label="item" :value="item" />
                                                    </el-select>
                                                </el-form-item>
                                            </div>
                                        </el-col>
                                        <el-col :span="12" :xs="24">
                                            <div class="container-form-item">
                                                <el-form-item class="form-item" :label="$t('Msg.Icon')">
                                                    <el-upload
                                                        class="avatar-uploader"
                                                        :action="DiyApi.Upload()"
                                                        :show-file-list="false"
                                                        :on-success="handleAvatarSuccess"
                                                        :before-upload="DiyCommon.UploadImgBefore"
                                                        :data="{
                                                            Path: 'sysmenu',
                                                            CompressMaxWidth: DiyCommon.CompressMaxWidth,
                                                            CompressMaxSize: DiyCommon.CompressMaxSize
                                                        }"
                                                        :headers="{
                                                            authorization: 'Bearer ' + DiyCommon.Authorization()
                                                        }"
                                                    >
                                                        <img
                                                            v-if="!DiyCommon.IsNull(CurrentSysMenuModel.Icon)"
                                                            :src="DiyCommon.GetServerPath(CurrentSysMenuModel.Icon)"
                                                            class="avatar"
                                                            style="width: 50px; height: 50px"
                                                        />
                                                        <el-icon v-else class="avatar-uploader-icon"><Plus /></el-icon>
                                                    </el-upload>
                                                </el-form-item>
                                            </div>
                                        </el-col>
                                        <el-col :span="12" :xs="24">
                                            <div class="container-form-item">
                                                <el-form-item class="form-item" :label="(CurrentSysMenuModel.OpenType == 'Diy' ? '*' : '') + $t('Msg.Url')">
                                                    <el-input v-model="CurrentSysMenuModel.Url" clearable></el-input>
                                                </el-form-item>
                                            </div>
                                        </el-col>
                                        <el-col :span="12" :xs="24" v-if="CurrentSysMenuModel.OpenType == 'Iframe'">
                                            <div class="container-form-item">
                                                <el-form-item class="form-item" :label="'地址接口引擎'">
                                                    <el-select
                                                        v-model="CurrentSysMenuModel.UrlApiEngineId"
                                                        clearable
                                                        filterable
                                                        value-key="Id"
                                                        placeholder="地址接口引擎"
                                                        @change="UrlApiEngineIdChange"
                                                    >
                                                        <el-option v-for="item in ApiEngineList" :key="item.ApiEngineKey" :label="item.ApiName" :value="item.Id">
                                                            <span style="float: left">{{ item.ApiName }}</span>
                                                            <span style="float: right; color: #8492a6; font-size: 14px">{{ item.ApiEngineKey }}</span>
                                                        </el-option>
                                                    </el-select>
                                                </el-form-item>
                                            </div>
                                        </el-col>
                                        <!-- <el-col
                                        :span="12"
                                        :xs="24"
                                        >
                                        <div class="container-form-item">
                                            <el-form-item
                                                class="form-item"
                                                :label="(CurrentSysMenuModel.OpenType == 'Diy' ? '*' : '') + $t('Msg.Link')"
                                               >
                                                <el-input v-model="CurrentSysMenuModel.Link" clearable></el-input>
                                            </el-form-item>
                                        </div>
                                    </el-col> -->

                                        <template v-if="CurrentSysMenuModel.OpenType == 'Component'">
                                            <!-- <el-col
                                            :span="12"
                                            :xs="24"
                                            >
                                            <div class="container-form-item">
                                                <el-form-item
                                                    class="form-item"
                                                    :label="$t('Msg.ComponentName')"
                                                   >
                                                    <el-input v-model="CurrentSysMenuModel.ComponentName" clearable></el-input>
                                                </el-form-item>
                                            </div>
                                        </el-col> -->
                                            <el-col :span="12" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="$t('Msg.ComponentPath')">
                                                        <el-input v-model="CurrentSysMenuModel.ComponentPath" clearable></el-input>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <!-- <el-col
                                            :span="12"
                                            :xs="24"
                                            >
                                            <div class="container-form-item">
                                                <el-form-item
                                                    class="form-item"
                                                    :label="$t('Msg.JquerySelector')"
                                                   >
                                                    <el-input v-model="CurrentSysMenuModel.JquerySelector" clearable></el-input>
                                                </el-form-item>
                                            </div>
                                        </el-col> -->
                                        </template>
                                        <el-col :span="12" :xs="24">
                                            <div class="container-form-item">
                                                <el-form-item class="form-item" :label="'PC' + $t('Msg.Display')">
                                                    <!-- <el-checkbox v-model="CurrentSysMenuModel.Display" /> -->
                                                    <el-switch v-model="CurrentSysMenuModel.Display" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                                                </el-form-item>
                                            </div>
                                        </el-col>
                                        <el-col :span="12" :xs="24">
                                            <div class="container-form-item">
                                                <el-form-item class="form-item" :label="'移动端' + $t('Msg.Display')">
                                                    <!-- <el-checkbox v-model="CurrentSysMenuModel.Display" /> -->
                                                    <el-switch v-model="CurrentSysMenuModel.AppDisplay" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                                                </el-form-item>
                                            </div>
                                        </el-col>
                                        <template v-if="CurrentSysMenuModel.OpenType == 'Diy'">
                                            <el-col :span="12" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="(CurrentSysMenuModel.OpenType == 'Diy' ? '*' : '') + '自定义表'">
                                                        <el-select v-model="CurrentSysMenuModel.DiyTableId" filterable clearable placeholder @change="DiyTableIdChange">
                                                            <!-- .replace('Diy_', '') -->
                                                            <el-option
                                                                v-for="item in DiyTableList"
                                                                :key="'tableid_' + item.Id"
                                                                :label="item.Description ? item.Name + ' - ' + item.Description : item.Name"
                                                                :value="item.Id"
                                                            />
                                                        </el-select>
                                                        <el-button class="quick-create" @click="OpenQuickCreateTable">快速建表</el-button>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="12" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="(CurrentSysMenuModel.OpenType == 'Diy' ? '*' : '') + '界面模板'">
                                                        <el-select v-model="CurrentSysMenuModel.ComponentPath" clearable placeholder>
                                                            <el-option :label="'搜索+表格'" :value="'/diy/diy-table-rowlist'" />
                                                            <el-option :label="'搜索+卡片'" :value="'/diy/diy-table-rowlist'" />
                                                            <el-option :label="'树形+表格'" :value="'/diy/left-right/LeftTreeJoinRightForm'" />
                                                            <el-option :label="'定制'" :value="''" />
                                                        </el-select>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="$t('Msg.ComponentPath')">
                                                        <input
                                                            v-model="CurrentSysMenuModel.ComponentPath"
                                                            placeholder="无需以'/views'开头，因为SysMenu的界面模板[ComponentPath]一定是在'/viws'里面"
                                                            class="form-control"
                                                            type="text"
                                                        />
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                        </template>
                                        <el-col :span="24" :xs="24">
                                            <div class="container-form-item">
                                                <el-form-item class="form-item" :label="'是否微服务'">
                                                    <!-- <el-checkbox v-model="CurrentSysMenuModel.IsMicroiService" /> -->
                                                    <el-switch v-model="CurrentSysMenuModel.IsMicroiService" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                                                </el-form-item>
                                            </div>
                                        </el-col>
                                        <el-col :span="24" :xs="24">
                                            <div class="container-form-item">
                                                <el-form-item class="form-item" :label="'是否子系统'">
                                                    <!-- <el-checkbox v-model="CurrentSysMenuModel.IsMicroiService" /> -->
                                                    <el-switch v-model="CurrentSysMenuModel.IsChildSystem" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                                                </el-form-item>
                                            </div>
                                        </el-col>
                                        <el-col :span="24" :xs="24">
                                            <div class="container-form-item">
                                                <el-form-item class="form-item" :label="'主键Id'">
                                                    {{ CurrentSysMenuModel.Id }}
                                                </el-form-item>
                                            </div>
                                        </el-col>
                                    </el-row>
                                </el-form>
                            </div>
                        </el-tab-pane>

                        <el-tab-pane v-if="CurrentSysMenuModel.OpenType == 'Diy'" label="数据源" name="DiyData">
                            <div :class="'field-form field-border'">
                                <el-form status-icon :model="CurrentSysMenuModel" :LabelPosition="'top'" label-width="150px">
                                    <el-row :gutter="20">
                                        <template v-if="!DiyCommon.IsNull(CurrentSysMenuModel.DiyTableId)">
                                            <el-col :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'关联表'">
                                                        <div>
                                                            <el-select
                                                                v-model="TempJoinTables"
                                                                :value-key="'Id'"
                                                                style="width: 100%"
                                                                filterable
                                                                clearable
                                                                placeholder
                                                                multiple
                                                                @change="JoinDiyTableChange"
                                                            >
                                                                <el-option
                                                                    v-for="item in DiyTableList"
                                                                    :key="'tempjointables_' + item.Id"
                                                                    :label="item.Description ? item.Name + ' - ' + item.Description : item.Name"
                                                                    :value="item.Id"
                                                                />
                                                            </el-select>
                                                        </div>
                                                        <div style="margin-top: 5px; margin-bottom: 5px">
                                                            <el-button type="primary" @click="AddJoinTable">添加</el-button>
                                                        </div>
                                                        <div v-for="(item, i) in CurrentSysMenuModel.JoinTables" :key="'c_jointables_' + item.Name">
                                                            <el-input placeholder="请输入关联别名，例如：B、C，必须与下方配置的关联Sql对应" v-model="item.AsName">
                                                                <template #prepend>{{ item.Description ? item.Name + " - " + item.Description : item.Name }}</template>
                                                                <template #append><el-button @click="DelJoinTable(i)" :icon="Delete"></el-button></template>
                                                            </el-input>
                                                        </div>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <!--TableDiyFieldIds已被 SelectFields 代替-->
                                                    <el-form-item class="form-item" :label="'查询列'">
                                                        <div>
                                                            <el-select
                                                                style="width: 100%"
                                                                ref="sltTableDiyFieldIds"
                                                                v-model="CurrentSysMenuModel.TableDiyFieldIds"
                                                                filterable
                                                                multiple
                                                                clearable
                                                                placeholder
                                                                v-bind="$attrs"
                                                                class="drag-select"
                                                                @change="ChangeTableDiyFieldIds"
                                                                @remove-tag="RemoveTagTableDiyFieldIds"
                                                            >
                                                                <el-option
                                                                    v-for="item in DiyFieldList"
                                                                    :key="'table_diy_fields_' + item.Id"
                                                                    :label="item.Label + ' - ' + item.Name + ' - (' + item.TableDescription + ' - ' + item.TableName + ')'"
                                                                    :value="item.Id"
                                                                >
                                                                    <span>
                                                                        {{ item.Label + " - " + item.Name + " - " }}
                                                                        <span style="color: #999">{{ "(" + item.TableDescription + " - " + item.TableName + ")" }}</span>
                                                                    </span>
                                                                </el-option>
                                                            </el-select>
                                                        </div>
                                                        <!-- <div v-for="(item, i) in CurrentSysMenuModel.SelectFields" :key="'selectfields_' + item.Id">
                              <el-input placeholder="请输入字段别名，例如：UserName" v-model="item.AsName">
                                <template #prepend>
                                  {{ item.Label + " - " + item.Name + " - (" + item.TableDescription + " - " + item.TableName + ")" }}
                                </template>
                              </el-input>
                            </div> -->
                                                        <el-table :data="CurrentSysMenuModel.SelectFields" border stripe style="width: 100%">
                                                            <el-table-column type="index" label="序号" width="50"> </el-table-column>
                                                            <el-table-column prop="Label" label="显示名称"> </el-table-column>
                                                            <el-table-column prop="Name" label="字段名"> </el-table-column>
                                                            <el-table-column label="别名">
                                                                <template #default="scope">
                                                                    <el-input placeholder="可选输入字段别名，例如：UserName" v-model="scope.row.AsName"></el-input>
                                                                </template>
                                                            </el-table-column>
                                                            <el-table-column label="表名">
                                                                <template #default="scope">
                                                                    {{ scope.row.TableDescription + " - " + scope.row.TableName }}
                                                                </template>
                                                            </el-table-column>
                                                            <el-table-column label="操作" width="50">
                                                                <template #default="scope">
                                                                    <el-button @click="RemoveTagTableDiyFieldIds(scope.row.Id)" :icon="Delete"></el-button>
                                                                </template>
                                                            </el-table-column>
                                                        </el-table>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col v-if="false" :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'列配置'">
                                                        <el-tag v-for="field in CurrentSysMenuModel.SelectFields" :key="'crrent_menu_fields_' + field.Name" :type="field.IsShow ? '' : 'info'">
                                                            {{ tag.Label }}
                                                            <fa-icon :icon="field.IsShow ? 'fas fa-eye hand' : 'far fa-eye-slash hand'" />
                                                        </el-tag>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'不显示列'">
                                                        <el-select style="width: 100%" v-model="CurrentSysMenuModel.NotShowFields" filterable multiple clearable placeholder>
                                                            <!-- GetTableDiyFieldList() -->
                                                            <el-option
                                                                v-for="item in DiyFieldList"
                                                                :key="'notshowfields_' + item.Id"
                                                                :label="item.Label + ' - ' + item.Name + ' - (' + item.TableDescription + ' - ' + item.TableName + ')'"
                                                                :value="item.Id"
                                                            >
                                                                <span
                                                                    >{{ item.Label + " - " + item.Name + " - " }}
                                                                    <span style="color: #999">{{ "(" + item.TableDescription + " - " + item.TableName + ")" }}</span>
                                                                </span>
                                                            </el-option>
                                                        </el-select>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'移动端列表显示列'">
                                                        <el-select style="width: 100%" v-model="CurrentSysMenuModel.MoileListFields" filterable multiple clearable placeholder>
                                                            <!-- GetTableDiyFieldList() -->
                                                            <el-option
                                                                v-for="item in DiyFieldList"
                                                                :key="'MoileListFields_' + item.Id"
                                                                :label="item.Label + ' - ' + item.Name + ' - (' + item.TableDescription + ' - ' + item.TableName + ')'"
                                                                :value="item.Id"
                                                            >
                                                                <span
                                                                    >{{ item.Label + " - " + item.Name + " - " }}
                                                                    <span style="color: #999">{{ "(" + item.TableDescription + " - " + item.TableName + ")" }}</span>
                                                                </span>
                                                            </el-option>
                                                        </el-select>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'固定列'">
                                                        <el-select style="width: 100%" v-model="CurrentSysMenuModel.FixedFields" filterable multiple clearable placeholder>
                                                            <!-- GetTableDiyFieldList() -->
                                                            <el-option
                                                                v-for="item in DiyFieldList"
                                                                :key="'FixedFields_' + item.Id"
                                                                :label="item.Label + ' - ' + item.Name + ' - (' + item.TableDescription + ' - ' + item.TableName + ')'"
                                                                :value="item.Id"
                                                            >
                                                                <span
                                                                    >{{ item.Label + " - " + item.Name + " - " }}
                                                                    <span style="color: #999">{{ "(" + item.TableDescription + " - " + item.TableName + ")" }}</span>
                                                                </span>
                                                            </el-option>
                                                        </el-select>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'可排序列'">
                                                        <el-select style="width: 100%" v-model="CurrentSysMenuModel.SortFieldIds" filterable multiple clearable placeholder>
                                                            <el-option
                                                                v-for="item in DiyFieldList"
                                                                :key="'sortfields_' + item.Id"
                                                                :label="item.Label + ' - ' + item.Name + ' - (' + item.TableDescription + ' - ' + item.TableName + ')'"
                                                                :value="item.Id"
                                                            >
                                                                <span
                                                                    >{{ item.Label + " - " + item.Name + " - " }}
                                                                    <span style="color: #999">{{ "(" + item.TableDescription + " - " + item.TableName + ")" }}</span>
                                                                </span>
                                                            </el-option>
                                                        </el-select>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'默认排序列'">
                                                        <el-table class="diy-table" :data="DefaultOrderByArray" style="width: 100%">
                                                            <el-table-column :label="$t('Msg.Sort')" width="100">
                                                                <template #default="scope">
                                                                    <el-input v-model="scope.row.Sort" type="number" placeholder="" />
                                                                </template>
                                                            </el-table-column>
                                                            <el-table-column :label="'字段名'" width="200">
                                                                <template #default="scope">
                                                                    <el-select v-model="scope.row.Id" filterable clearable placeholder @change="ChangeDefaultSort">
                                                                        <el-option
                                                                            v-for="item in DiyFieldList"
                                                                            :key="'default_orderby_' + item.Id"
                                                                            :label="item.Label + ' - ' + item.Name + ' - (' + item.TableDescription + ' - ' + item.TableName + ')'"
                                                                            :value="item.Id"
                                                                        >
                                                                            <span
                                                                                >{{ item.Label + " - " + item.Name + " - " }}
                                                                                <span style="color: #999">{{ "(" + item.TableDescription + " - " + item.TableName + ")" }}</span>
                                                                            </span>
                                                                        </el-option>
                                                                    </el-select>
                                                                </template>
                                                            </el-table-column>
                                                            <el-table-column :label="'排序方式'" width="200">
                                                                <template #default="scope">
                                                                    <el-radio v-model="scope.row.Type" :value="'ASC'">ASC</el-radio>
                                                                    <el-radio v-model="scope.row.Type" :value="'DESC'">DESC</el-radio>
                                                                </template>
                                                            </el-table-column>
                                                            <el-table-column :label="'操作'" width="200">
                                                                <template #default="scope">
                                                                    <el-button style="width: 45px" :icon="Delete" type="text" @click="DelDefaultSort(scope.row)"></el-button>
                                                                </template>
                                                            </el-table-column>
                                                        </el-table>
                                                    </el-form-item>
                                                    <div>
                                                        <el-button style="width: 45px" :icon="Plus" type="text" @click="AddDefaultSort()">{{ $t("Msg.Add") }}</el-button>
                                                    </div>
                                                </div>
                                            </el-col>
                                            <el-col :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'可搜索列'">
                                                        <div>
                                                            <el-select style="width: 100%" v-model="TempSearchFieldIds" filterable multiple clearable placeholder>
                                                                <el-option
                                                                    v-for="item in DiyFieldList"
                                                                    :key="'tempsearchfields_' + item.Id"
                                                                    :label="item.Label + ' - ' + item.Name + ' - (' + item.TableDescription + ' - ' + item.TableName + ')'"
                                                                    :value="item.Id"
                                                                >
                                                                    <span
                                                                        >{{ item.Label + " - " + item.Name + " - " }}
                                                                        <span style="color: #999">{{ "(" + item.TableDescription + " - " + item.TableName + ")" }}</span>
                                                                    </span>
                                                                </el-option>
                                                            </el-select>
                                                        </div>
                                                        <div style="margin-top: 5px; margin-bottom: 5px">
                                                            <el-button type="primary" @click="AddSearchFieldId">添加</el-button>
                                                        </div>
                                                        <el-table :data="CurrentSysMenuModel.SearchFieldIds" border stripe style="width: 100%">
                                                            <el-table-column type="index" label="序号" width="50"> </el-table-column>
                                                            <el-table-column prop="Label" label="显示名称"> </el-table-column>
                                                            <el-table-column prop="Name" label="字段名"> </el-table-column>
                                                            <el-table-column label="别名">
                                                                <template #default="scope">
                                                                    <el-input placeholder="可选输入字段别名，例如：UserName" v-model="scope.row.AsName"></el-input>
                                                                </template>
                                                            </el-table-column>
                                                            <el-table-column label="显示区域" width="220">
                                                                <template #default="scope">
                                                                    <el-radio-group v-model="scope.row.DisplayType">
                                                                        <el-radio :value="'Line'" style="width: 36px">默认</el-radio>
                                                                        <el-radio :value="'In'" style="width: 36px">内部</el-radio>
                                                                        <el-radio :value="'Out'" style="width: 60px">外部</el-radio>
                                                                    </el-radio-group>
                                                                </template>
                                                            </el-table-column>
                                                            <el-table-column label="下拉" width="50">
                                                                <template #default="scope">
                                                                    <el-checkbox v-model="scope.row.DisplaySelect"></el-checkbox>
                                                                </template>
                                                            </el-table-column>
                                                            <el-table-column label="等值" width="50">
                                                                <template #default="scope">
                                                                    <el-checkbox v-model="scope.row.Equal"></el-checkbox>
                                                                </template>
                                                            </el-table-column>
                                                            <el-table-column label="整行" width="50">
                                                                <template #default="scope">
                                                                    <el-checkbox v-model="scope.row.DisplayLine"></el-checkbox>
                                                                </template>
                                                            </el-table-column>
                                                            <el-table-column label="文本" width="50">
                                                                <template #default="scope">
                                                                    <el-checkbox v-model="scope.row.TextBox"></el-checkbox>
                                                                </template>
                                                            </el-table-column>
                                                            <el-table-column label="隐藏" width="50">
                                                                <template #default="scope">
                                                                    <el-checkbox v-model="scope.row.Hide"></el-checkbox>
                                                                </template>
                                                            </el-table-column>
                                                            <el-table-column label="表名">
                                                                <template #default="scope">
                                                                    {{ scope.row.TableDescription + " - " + scope.row.TableName }}
                                                                </template>
                                                            </el-table-column>
                                                            <el-table-column label="操作" width="50">
                                                                <template #default="scope">
                                                                    <el-button @click="DelSearchFieldId(scope.$index)" :icon="Delete"></el-button>
                                                                </template>
                                                            </el-table-column>
                                                        </el-table>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'统计列'">
                                                        <el-select style="width: 100%" v-model="CurrentSysMenuModel.StatisticsFields" filterable multiple clearable placeholder>
                                                            <el-option
                                                                v-for="item in DiyFieldList"
                                                                :key="'stticfields_' + item.Id"
                                                                :label="item.Label + ' - ' + item.Name + ' - (' + item.TableDescription + ' - ' + item.TableName + ')'"
                                                                :value="item.Id"
                                                            >
                                                                <span
                                                                    >{{ item.Label + " - " + item.Name + " - " }}
                                                                    <span style="color: #999">{{ "(" + item.TableDescription + " - " + item.TableName + ")" }}</span>
                                                                </span>
                                                            </el-option>
                                                        </el-select>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'开启表内编辑'">
                                                        <el-switch v-model="CurrentSysMenuModel.InTableEdit" :active-value="1" :inactive-value="0"> </el-switch>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col v-if="CurrentSysMenuModel.InTableEdit" :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'表内可编辑列'">
                                                        <el-select style="width: 100%" v-model="CurrentSysMenuModel.InTableEditFields" filterable multiple clearable placeholder>
                                                            <el-option
                                                                v-for="item in GetAllCanEditFieldList()"
                                                                :key="'caneditfields_' + item.Id"
                                                                :label="item.Label + ' - ' + item.Name"
                                                                :value="item.Id"
                                                            />
                                                        </el-select>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'Join关联'">
                                                        <template #label
                                                            ><span>
                                                                <el-tooltip class="item" effect="dark" placement="right">
                                                                    <template #content
                                                                        ><div>
                                                                            <p>示例：INNER JOIN Sys_User B ON A.UserId = B.Id</p>
                                                                            <p>示例：INNER JOIN Diy_Customer B ON A.KehuXXID = B.Id AND B.GuanlianZH like '%$CurrentUser.Id$%'</p>
                                                                            <p>注意：默认选择的DIY表已经占用了表别名A。</p>
                                                                            <p>可使用的变量名：$CurrentUser.Id$、$CurrentUser.Level$、$CurrentUser.DeptId$、$CurrentUser.DeptCode$</p>
                                                                        </div></template
                                                                    >
                                                                    <template #default
                                                                        ><el-icon><InfoFilled /></el-icon
                                                                    ></template>
                                                                </el-tooltip>
                                                                {{ "Join关联" }}
                                                            </span></template
                                                        >
                                                        <!-- <el-input v-model="CurrentSysMenuModel.SqlJoin" type="textarea" rows="4" placeholder="" /> -->
                                                        <DiyCodeEditor ref="diyCodeEditorJoin" :key="'diyCodeEditorJoin'" v-model="CurrentSysMenuModel.SqlJoin" :height="'100px'"> </DiyCodeEditor>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'Where条件'">
                                                        <template #label
                                                            ><span>
                                                                <el-tooltip class="item" effect="dark" placement="right">
                                                                    <template #content
                                                                        ><div>
                                                                            <p>示例[每个人只能查看自己的数据，或者上级可以查看同部门下级的数据]：</p>
                                                                            <p>(A.UserId = '$CurrentUser.Id$' OR (B.Level &gt; $CurrentUser.Level$ AND B.DeptCode LIKE '$CurrentUser.DeptCode$%'))</p>
                                                                            <p>注意：默认选择的DIY表已经占用了表别名A。</p>
                                                                            <p>可使用的变量名：$CurrentUser.Id$、$CurrentUser.Level$、$CurrentUser.DeptId$、$CurrentUser.DeptCode$</p>
                                                                        </div></template
                                                                    >
                                                                    <template #default
                                                                        ><el-icon><InfoFilled /></el-icon
                                                                    ></template>
                                                                </el-tooltip>
                                                                {{ "Where条件" }}
                                                            </span></template
                                                        >
                                                        <!-- <el-input v-model="CurrentSysMenuModel.SqlWhere" type="textarea" rows="2" placeholder="" /> -->
                                                        <DiyCodeEditor ref="diyCodeEditorSqlWhere" :key="'diyCodeEditorSqlWhere'" v-model="CurrentSysMenuModel.SqlWhere" :height="'300px'">
                                                        </DiyCodeEditor>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'导入模板'">
                                                        <!-- :href="DiyCommon.GetServerPath(CurrentSysMenuModel.ImportTemplate)" -->
                                                        <a v-if="!DiyCommon.IsNull(CurrentSysMenuModel.ImportTemplate)" target="_blank" :href="CurrentSysMenuModel._ImportTemplateUrl">
                                                            {{ CurrentSysMenuModel.ImportTemplate }}
                                                        </a>
                                                        <el-upload
                                                            :action="DiyApi.Upload()"
                                                            :show-file-list="false"
                                                            :on-success="handleImportTplSuccess"
                                                            :data="{ Path: '/import-tpl', Limit: true }"
                                                            :headers="{
                                                                authorization: 'Bearer ' + DiyCommon.Authorization()
                                                            }"
                                                        >
                                                            <el-icon class="ml-2"><Plus /></el-icon>
                                                        </el-upload>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'表格分页序号递增'">
                                                        <el-switch v-model="CurrentSysMenuModel.TableIndexAdditive" :active-value="1" :inactive-value="0"> </el-switch>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                        </template>
                                    </el-row>
                                </el-form>
                            </div>
                        </el-tab-pane>
                        <el-tab-pane v-if="CurrentSysMenuModel.OpenType == 'Diy'" label="替换" name="DiyApiReplace">
                            <div :class="'field-form field-border'">
                                <el-form status-icon :model="CurrentSysMenuModel" :LabelPosition="'top'" label-width="150px">
                                    <el-row :gutter="20">
                                        <template v-if="!DiyCommon.IsNull(CurrentSysMenuModel.DiyTableId)">
                                            <el-col :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'查询接口替换'">
                                                        <template #label
                                                            ><span>
                                                                <el-tooltip class="item" effect="dark" placement="right">
                                                                    <template #content
                                                                        ><div>
                                                                            <p>支持$ApiBase$、$OsClient$变量</p>
                                                                        </div></template
                                                                    >
                                                                    <template #default
                                                                        ><el-icon><InfoFilled /></el-icon
                                                                    ></template>
                                                                </el-tooltip>
                                                                {{ "查询接口替换" }}
                                                            </span></template
                                                        >
                                                        <el-input v-model="CurrentSysMenuModel.DiyConfig.SelectApi" placeholder="" type="text" />
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="3" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'[新增]文字替换'">
                                                        <el-input v-model="CurrentSysMenuModel.DiyConfig.AddBtnText" placeholder="新增" type="text" />
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="3" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'[保存]文字替换'">
                                                        <el-input v-model="CurrentSysMenuModel.DiyConfig.SaveBtnText" placeholder="保存" type="text" />
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="4" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'[新增]模式'">
                                                        <el-radio-group v-model="CurrentSysMenuModel.DiyConfig.AddBtnType">
                                                            <el-radio :value="'Dialog'">弹窗</el-radio>
                                                            <el-radio :value="'InTable'">表内</el-radio>
                                                        </el-radio-group>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="6" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'[表内编辑]存储方式'">
                                                        <el-radio-group v-model="CurrentSysMenuModel.DiyConfig.SaveType">
                                                            <el-radio :value="'值变更实时存'">值变更实时存</el-radio>
                                                            <el-radio :value="'提交一起保存'">提交一起保存</el-radio>
                                                        </el-radio-group>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="3" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'隐藏列表序号'">
                                                        <el-switch
                                                            v-model="CurrentSysMenuModel.DiyConfig.HiddenIndex"
                                                            active-color="#ff6c04"
                                                            :active-value="1"
                                                            :inactive-value="0"
                                                            inactive-color="#ccc"
                                                        />
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="3" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'隐藏通用搜索'">
                                                        <el-switch
                                                            v-model="CurrentSysMenuModel.DiyConfig.GeneralSeaarch"
                                                            active-color="#ff6c04"
                                                            :active-value="1"
                                                            :inactive-value="0"
                                                            inactive-color="#ccc"
                                                        />
                                                    </el-form-item>
                                                </div>
                                            </el-col>

                                            <el-col :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'导入接口替换'">
                                                        <template #label
                                                            ><span>
                                                                <el-tooltip class="item" effect="dark" placement="right">
                                                                    <template #content
                                                                        ><div>
                                                                            <p>支持$ApiBase$、$OsClient$变量</p>
                                                                        </div></template
                                                                    >
                                                                    <template #default
                                                                        ><el-icon><InfoFilled /></el-icon
                                                                    ></template>
                                                                </el-tooltip>
                                                                {{ "导入接口替换" }}
                                                            </span></template
                                                        >
                                                        <el-input v-model="CurrentSysMenuModel.DiyConfig.ImportApi" placeholder="" type="text" />
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'导入进度接口替换'">
                                                        <template #label
                                                            ><span>
                                                                <el-tooltip class="item" effect="dark" placement="right">
                                                                    <template #content
                                                                        ><div>
                                                                            <p>支持$ApiBase$、$OsClient$变量</p>
                                                                        </div></template
                                                                    >
                                                                    <template #default
                                                                        ><el-icon><InfoFilled /></el-icon
                                                                    ></template>
                                                                </el-tooltip>
                                                                {{ "导入进度接口替换" }}
                                                            </span></template
                                                        >
                                                        <el-input v-model="CurrentSysMenuModel.DiyConfig.ImportProgressApi" placeholder="返回DosResult(1, List<string>)" type="text" />
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'导出接口替换'">
                                                        <template #label
                                                            ><span>
                                                                <el-tooltip class="item" effect="dark" placement="right">
                                                                    <template #content
                                                                        ><div>
                                                                            <p>支持$ApiBase$、$OsClient$变量</p>
                                                                        </div></template
                                                                    >
                                                                    <template #default
                                                                        ><el-icon><InfoFilled /></el-icon
                                                                    ></template>
                                                                </el-tooltip>
                                                                {{ "导出接口替换" }}
                                                            </span></template
                                                        >
                                                        <el-input v-model="CurrentSysMenuModel.DiyConfig.ExportApi" placeholder="" type="text" />
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                        </template>
                                    </el-row>
                                </el-form>
                            </div>
                        </el-tab-pane>
                        <el-tab-pane v-if="CurrentSysMenuModel.OpenType == 'Diy'" label="按钮" name="DiyBtns">
                            <div :class="'field-form field-border'">
                                <el-form status-icon :model="CurrentSysMenuModel" :LabelPosition="'top'" label-width="150px">
                                    <el-row :gutter="20">
                                        <template v-if="!DiyCommon.IsNull(CurrentSysMenuModel.DiyTableId)">
                                            <el-col :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'表单更多按钮'">
                                                        <div class="clear">
                                                            <el-table class="diy-table" :data="CurrentSysMenuModel.FormBtns" style="width: 100%">
                                                                <el-table-column :label="$t('Msg.Sort')" width="100">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.Sort" type="number" placeholder="" />
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="'Id'" width="100">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.Id" placeholder="" />
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="$t('Msg.Name')" width="200">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.Name" placeholder="" />
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="$t('Msg.Icon')" width="55">
                                                                    <template #default="scope">
                                                                        <span @click="$refs['fasFormBtnsIcon_' + scope.$index].show()">
                                                                            <i
                                                                                style="padding-top: 5px; width: 25px; height: 25px"
                                                                                :class="DiyCommon.IsNull(scope.row.Icon) ? 'far fa-smile-wink hand' : 'hand ' + scope.row.Icon"
                                                                            />
                                                                        </span>
                                                                        <Fontawesome :ref="'fasFormBtnsIcon_' + scope.$index" v-model:model="scope.row.Icon" />
                                                                    </template>
                                                                </el-table-column>
                                                                <el-table-column :label="'按钮样式'" width="150">
                                                                    <template #default="scope">
                                                                        <el-select v-model="scope.row.BtnStyle">
                                                                            <el-option :label="'默认按钮'" :value="''"></el-option>
                                                                            <el-option :label="'主要按钮'" :value="'primary'"></el-option>
                                                                            <el-option :label="'成功按钮'" :value="'success'"></el-option>
                                                                            <el-option :label="'信息按钮'" :value="'info'"></el-option>
                                                                            <el-option :label="'警告按钮'" :value="'warning'"></el-option>
                                                                            <el-option :label="'危险按钮'" :value="'danger'"></el-option>
                                                                        </el-select>
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="'V8引擎'">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.V8Code" placeholder="V8Code" style="width: 100px" />
                                                                        <el-button @click="OpenV8CodeEditor(scope.row.Name, 'V8Code', 'FormBtns')" type="primary" :icon="Tools"></el-button>
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="'按钮显示条件V8'">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.V8CodeShow" placeholder="V8CodeShow" style="width: 100px" />
                                                                        <el-button @click="OpenV8CodeEditor(scope.row.Name, 'V8CodeShow', 'FormBtns')" type="primary" :icon="Tools"></el-button>
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column width="65" :label="$t('Msg.Action')">
                                                                    <template #default="scope">
                                                                        <!-- <el-button
                                                                            @click="AddDiyTableTab(scope.row)"
                                                                            type="primary"
                                                                           >保存</el-button> -->
                                                                        <el-button type="text" :icon="Delete" @click="DelMoreBtn(scope.row, 'FormBtns')">{{ $t("Msg.Delete") }}</el-button>
                                                                    </template>
                                                                </el-table-column>
                                                            </el-table>
                                                        </div>
                                                        <div class="clear">
                                                            <el-form :inline="true" :model="CurrentSysMenuFormBtnsModel" class="demo-form-inline">
                                                                <el-form-item label="">
                                                                    <el-input v-model="CurrentSysMenuFormBtnsModel.Sort" style="width: 100px" type="number" :placeholder="$t('Msg.Sort')" />
                                                                </el-form-item>
                                                                <el-form-item label="">
                                                                    <el-input v-model="CurrentSysMenuFormBtnsModel.Name" style="width: 200px" :placeholder="$t('Msg.Name')" />
                                                                </el-form-item>
                                                                <el-form-item label="">
                                                                    <!-- <el-input
                                                                    style="width:60px;"
                                                                    v-model="CurrentDiyTableTabModel.Icon"
                                                                    :placeholder="$t('Msg.Icon')">
                                                                </el-input> -->
                                                                    <i
                                                                        :class="
                                                                            DiyCommon.IsNull(CurrentSysMenuFormBtnsModel.Icon) ? 'far fa-smile-wink hand' : 'hand ' + CurrentSysMenuFormBtnsModel.Icon
                                                                        "
                                                                        @click="$refs.fasCDTTMIcon.show()"
                                                                    />
                                                                    <Fontawesome ref="fasCDTTMIcon" v-model:model="CurrentSysMenuFormBtnsModel.Icon" />
                                                                </el-form-item>
                                                                <el-form-item label="" v-show="false">
                                                                    <el-input value="" v-model="CurrentSysMenuFormBtnsModel.V8Code" style="width: 60px" />
                                                                </el-form-item>
                                                                <el-form-item label="" v-show="false">
                                                                    <el-input value="" v-model="CurrentSysMenuFormBtnsModel.V8CodeShow" style="width: 60px" />
                                                                </el-form-item>
                                                                <el-form-item>
                                                                    <el-button style="width: 45px" :icon="Plus" type="text" @click="AddMoreBtn('FormBtns')">{{ $t("Msg.Add") }}</el-button>
                                                                </el-form-item>
                                                            </el-form>
                                                        </div>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'行更多按钮'">
                                                        <div class="clear">
                                                            <el-table class="diy-table" :data="CurrentSysMenuModel.MoreBtns" style="width: 100%">
                                                                <el-table-column :label="$t('Msg.Sort')" width="100">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.Sort" type="number" placeholder="" />
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="'Id'" width="100">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.Id" placeholder="" />
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="$t('Msg.Name')" width="200">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.Name" placeholder="" />
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="$t('Msg.Icon')" width="55">
                                                                    <template #default="scope">
                                                                        <i
                                                                            style="padding-top: 5px"
                                                                            :class="DiyCommon.IsNull(scope.row.Icon) ? 'far fa-smile-wink hand' : 'hand ' + scope.row.Icon"
                                                                            @click="$refs['fasTabsIcon_' + scope.$index].show()"
                                                                        />
                                                                        <Fontawesome :ref="'fasTabsIcon_' + scope.$index" v-model:model="scope.row.Icon" />
                                                                    </template>
                                                                </el-table-column>
                                                                <el-table-column :label="'按钮样式'" width="150">
                                                                    <template #default="scope">
                                                                        <el-select v-model="scope.row.BtnStyle">
                                                                            <el-option :label="'默认按钮'" :value="''"></el-option>
                                                                            <el-option :label="'主要按钮'" :value="'primary'"></el-option>
                                                                            <el-option :label="'成功按钮'" :value="'success'"></el-option>
                                                                            <el-option :label="'信息按钮'" :value="'info'"></el-option>
                                                                            <el-option :label="'警告按钮'" :value="'warning'"></el-option>
                                                                            <el-option :label="'危险按钮'" :value="'danger'"></el-option>
                                                                        </el-select>
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="'V8引擎'">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.V8Code" placeholder="V8Code" style="width: 100px" />
                                                                        <el-button @click="OpenV8CodeEditor(scope.row.Name, 'V8Code', 'MoreBtns')" type="primary" :icon="Tools"></el-button>
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="'按钮显示条件V8'">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.V8CodeShow" placeholder="V8CodeShow" style="width: 100px" />
                                                                        <el-button @click="OpenV8CodeEditor(scope.row.Name, 'V8CodeShow', 'MoreBtns')" type="primary" :icon="Tools"></el-button>
                                                                    </template>
                                                                </el-table-column>
                                                                <el-table-column :label="'行外部显示'" width="120">
                                                                    <template #default="scope">
                                                                        <el-checkbox v-model="scope.row.ShowRow"> </el-checkbox>
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column width="65" :label="$t('Msg.Action')">
                                                                    <template #default="scope">
                                                                        <!-- <el-button
                                                                            @click="AddDiyTableTab(scope.row)"
                                                                            type="primary"
                                                                           >保存</el-button> -->
                                                                        <el-button type="text" :icon="Delete" @click="DelMoreBtn(scope.row, 'MoreBtns')">{{ $t("Msg.Delete") }}</el-button>
                                                                    </template>
                                                                </el-table-column>
                                                            </el-table>
                                                        </div>
                                                        <div class="clear">
                                                            <el-form :inline="true" :model="CurrentSysMenuMoreBtnsModel" class="demo-form-inline">
                                                                <el-form-item label="">
                                                                    <el-input v-model="CurrentSysMenuMoreBtnsModel.Sort" style="width: 100px" type="number" :placeholder="$t('Msg.Sort')" />
                                                                </el-form-item>
                                                                <el-form-item label="">
                                                                    <el-input v-model="CurrentSysMenuMoreBtnsModel.Name" style="width: 200px" :placeholder="$t('Msg.Name')" />
                                                                </el-form-item>
                                                                <el-form-item label="">
                                                                    <!-- <el-input
                                                                    style="width:60px;"
                                                                    v-model="CurrentDiyTableTabModel.Icon"
                                                                    :placeholder="$t('Msg.Icon')">
                                                                </el-input> -->
                                                                    <i
                                                                        :class="
                                                                            DiyCommon.IsNull(CurrentSysMenuMoreBtnsModel.Icon) ? 'far fa-smile-wink hand' : 'hand ' + CurrentSysMenuMoreBtnsModel.Icon
                                                                        "
                                                                        @click="$refs.fasCDTTMIcon.show()"
                                                                    />
                                                                    <Fontawesome ref="fasCDTTMIcon" v-model:model="CurrentSysMenuMoreBtnsModel.Icon" />
                                                                </el-form-item>
                                                                <el-form-item label="" v-show="false">
                                                                    <el-input value="" v-model="CurrentSysMenuMoreBtnsModel.V8Code" style="width: 60px" />
                                                                </el-form-item>
                                                                <el-form-item label="" v-show="false">
                                                                    <el-input value="" v-model="CurrentSysMenuMoreBtnsModel.V8CodeShow" style="width: 60px" />
                                                                </el-form-item>
                                                                <el-form-item>
                                                                    <el-button style="width: 45px" :icon="Plus" type="text" @click="AddMoreBtn('MoreBtns')">{{ $t("Msg.Add") }}</el-button>
                                                                </el-form-item>
                                                            </el-form>
                                                        </div>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'更多导出按钮'">
                                                        <div class="clear">
                                                            <el-table class="diy-table" :data="CurrentSysMenuModel.ExportMoreBtns" style="width: 100%">
                                                                <el-table-column :label="$t('Msg.Sort')" width="100">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.Sort" type="number" placeholder="" />
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="'Id'" width="100">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.Id" placeholder="" />
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="$t('Msg.Name')" width="200">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.Name" placeholder="" />
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="$t('Msg.Icon')" width="55">
                                                                    <template #default="scope">
                                                                        <i
                                                                            style="padding-top: 5px"
                                                                            :class="DiyCommon.IsNull(scope.row.Icon) ? 'far fa-smile-wink hand' : 'hand ' + scope.row.Icon"
                                                                            @click="$refs['fasMoreBtnIcon_' + scope.$index].show()"
                                                                        />
                                                                        <Fontawesome :ref="'fasMoreBtnIcon_' + scope.$index" v-model:model="scope.row.Icon" />
                                                                    </template>
                                                                </el-table-column>
                                                                <el-table-column :label="'按钮样式'" width="150">
                                                                    <template #default="scope">
                                                                        <el-select v-model="scope.row.BtnStyle">
                                                                            <el-option :label="'默认按钮'" :value="''"></el-option>
                                                                            <el-option :label="'主要按钮'" :value="'primary'"></el-option>
                                                                            <el-option :label="'成功按钮'" :value="'success'"></el-option>
                                                                            <el-option :label="'信息按钮'" :value="'info'"></el-option>
                                                                            <el-option :label="'警告按钮'" :value="'warning'"></el-option>
                                                                            <el-option :label="'危险按钮'" :value="'danger'"></el-option>
                                                                        </el-select>
                                                                    </template>
                                                                </el-table-column>

                                                                <!-- <el-table-column :label="'V8引擎'">
                                                                <template #default="scope">
                                                                    <el-input
                                                                        v-model="scope.row.V8Code"
                                                                        placeholder="V8Code"
                                                                        style="width:100px" />
                                                                    <el-button
                                                                        @click="OpenV8CodeEditor(scope.row.Name, 'V8Code', 'ExportMoreBtns')"
                                                                        type="primary" :icon="Tools"></el-button>
                                                                </template>
                                                            </el-table-column> -->
                                                                <el-table-column :label="$t('Msg.Url')" width="100">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.Url" placeholder="" />
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="'按钮显示条件V8'">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.V8CodeShow" placeholder="V8CodeShow" style="width: 100px" />
                                                                        <el-button @click="OpenV8CodeEditor(scope.row.Name, 'V8CodeShow', 'ExportMoreBtns')" type="primary" :icon="Tools"></el-button>
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column width="65" :label="$t('Msg.Action')">
                                                                    <template #default="scope">
                                                                        <!-- <el-button
                                                                            @click="AddDiyTableTab(scope.row)"
                                                                            type="primary"
                                                                           >保存</el-button> -->
                                                                        <el-button type="text" :icon="Delete" @click="DelMoreBtn(scope.row, 'ExportMoreBtns')">{{ $t("Msg.Delete") }}</el-button>
                                                                    </template>
                                                                </el-table-column>
                                                            </el-table>
                                                        </div>
                                                        <div class="clear">
                                                            <el-form :inline="true" :model="CurrentSysMenuExportMoreBtnsModel" class="demo-form-inline">
                                                                <el-form-item label="">
                                                                    <el-input v-model="CurrentSysMenuExportMoreBtnsModel.Sort" style="width: 100px" type="number" :placeholder="$t('Msg.Sort')" />
                                                                </el-form-item>
                                                                <el-form-item label="">
                                                                    <el-input v-model="CurrentSysMenuExportMoreBtnsModel.Name" style="width: 200px" :placeholder="$t('Msg.Name')" />
                                                                </el-form-item>
                                                                <el-form-item label="">
                                                                    <!-- <el-input
                                                                    style="width:60px;"
                                                                    v-model="CurrentDiyTableTabModel.Icon"
                                                                    :placeholder="$t('Msg.Icon')">
                                                                </el-input> -->
                                                                    <i
                                                                        :class="
                                                                            DiyCommon.IsNull(CurrentSysMenuExportMoreBtnsModel.Icon)
                                                                                ? 'far fa-smile-wink hand'
                                                                                : 'hand ' + CurrentSysMenuExportMoreBtnsModel.Icon
                                                                        "
                                                                        @click="$refs.fasCDTTMIcon.show()"
                                                                    />
                                                                    <Fontawesome ref="fasCDTTMIcon" v-model:model="CurrentSysMenuExportMoreBtnsModel.Icon" />
                                                                </el-form-item>
                                                                <!-- <el-form-item label="" v-show="false">
                                                                <el-input
                                                                    value=""
                                                                    v-model="CurrentSysMenuExportMoreBtnsModel.V8Code"
                                                                    style="width:60px;" />
                                                            </el-form-item> -->
                                                                <el-form-item label="" v-show="false">
                                                                    <el-input value="" placeholder="Url" v-model="CurrentSysMenuExportMoreBtnsModel.Url" style="width: 60px" />
                                                                </el-form-item>
                                                                <el-form-item label="" v-show="false">
                                                                    <el-input value="" v-model="CurrentSysMenuExportMoreBtnsModel.V8CodeShow" style="width: 60px" />
                                                                </el-form-item>
                                                                <el-form-item>
                                                                    <el-button style="width: 45px" :icon="Plus" type="text" @click="AddMoreBtn('ExportMoreBtns')">{{ $t("Msg.Add") }}</el-button>
                                                                </el-form-item>
                                                            </el-form>
                                                        </div>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'批量选择更多按钮'">
                                                        <div class="clear">
                                                            <el-table class="diy-table" :data="CurrentSysMenuModel.BatchSelectMoreBtns" style="width: 100%">
                                                                <el-table-column :label="$t('Msg.Sort')" width="100">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.Sort" type="number" placeholder="" />
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="'Id'" width="100">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.Id" placeholder="" />
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="$t('Msg.Name')" width="200">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.Name" placeholder="" />
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="$t('Msg.Icon')" width="55">
                                                                    <template #default="scope">
                                                                        <i
                                                                            style="padding-top: 5px"
                                                                            :class="DiyCommon.IsNull(scope.row.Icon) ? 'far fa-smile-wink hand' : 'hand ' + scope.row.Icon"
                                                                            @click="$refs['fasBSMBIcon_' + scope.$index].show()"
                                                                        />
                                                                        <Fontawesome :ref="'fasBSMBIcon_' + scope.$index" v-model:model="scope.row.Icon" />
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="'按钮样式'" width="150">
                                                                    <template #default="scope">
                                                                        <el-select v-model="scope.row.BtnStyle">
                                                                            <el-option :label="'默认按钮'" :value="''"></el-option>
                                                                            <el-option :label="'主要按钮'" :value="'primary'"></el-option>
                                                                            <el-option :label="'成功按钮'" :value="'success'"></el-option>
                                                                            <el-option :label="'信息按钮'" :value="'info'"></el-option>
                                                                            <el-option :label="'警告按钮'" :value="'warning'"></el-option>
                                                                            <el-option :label="'危险按钮'" :value="'danger'"></el-option>
                                                                        </el-select>
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="'V8引擎'">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.V8Code" placeholder="V8Code" style="width: 100px" />
                                                                        <el-button @click="OpenV8CodeEditor(scope.row.Name, 'V8Code', 'BatchSelectMoreBtns')" type="primary" :icon="Tools"></el-button>
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="'按钮显示条件V8'">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.V8CodeShow" placeholder="V8CodeShow" style="width: 100px" />
                                                                        <el-button
                                                                            @click="OpenV8CodeEditor(scope.row.Name, 'V8CodeShow', 'BatchSelectMoreBtns')"
                                                                            type="primary"
                                                                            :icon="Tools"
                                                                        ></el-button>
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column width="65" :label="$t('Msg.Action')">
                                                                    <template #default="scope">
                                                                        <!-- <el-button
                                                                            @click="AddDiyTableTab(scope.row)"
                                                                            type="primary"
                                                                           >保存</el-button> -->
                                                                        <el-button type="text" :icon="Delete" @click="DelMoreBtn(scope.row, 'BatchSelectMoreBtns')">{{ $t("Msg.Delete") }}</el-button>
                                                                    </template>
                                                                </el-table-column>
                                                            </el-table>
                                                        </div>
                                                        <div class="clear">
                                                            <el-form :inline="true" :model="CurrentSysMenuBatchSelectMoreBtnsModel" class="demo-form-inline">
                                                                <el-form-item label="">
                                                                    <el-input v-model="CurrentSysMenuBatchSelectMoreBtnsModel.Sort" style="width: 100px" type="number" :placeholder="$t('Msg.Sort')" />
                                                                </el-form-item>
                                                                <el-form-item label="">
                                                                    <el-input v-model="CurrentSysMenuBatchSelectMoreBtnsModel.Name" style="width: 200px" :placeholder="$t('Msg.Name')" />
                                                                </el-form-item>
                                                                <el-form-item label="">
                                                                    <!-- <el-input
                                                                    style="width:60px;"
                                                                    v-model="CurrentDiyTableTabModel.Icon"
                                                                    :placeholder="$t('Msg.Icon')">
                                                                </el-input> -->
                                                                    <i
                                                                        :class="
                                                                            DiyCommon.IsNull(CurrentSysMenuBatchSelectMoreBtnsModel.Icon)
                                                                                ? 'far fa-smile-wink hand'
                                                                                : 'hand ' + CurrentSysMenuBatchSelectMoreBtnsModel.Icon
                                                                        "
                                                                        @click="$refs.fasCDTTMIcon.show()"
                                                                    />
                                                                    <Fontawesome ref="fasCDTTMIcon" v-model:model="CurrentSysMenuBatchSelectMoreBtnsModel.Icon" />
                                                                </el-form-item>
                                                                <el-form-item label="" v-show="false">
                                                                    <el-input value="" v-model="CurrentSysMenuBatchSelectMoreBtnsModel.V8Code" style="width: 60px" />
                                                                </el-form-item>
                                                                <el-form-item label="" v-show="false">
                                                                    <el-input value="" v-model="CurrentSysMenuBatchSelectMoreBtnsModel.V8CodeShow" style="width: 60px" />
                                                                </el-form-item>
                                                                <el-form-item>
                                                                    <el-button style="width: 45px" :icon="Plus" type="text" @click="AddMoreBtn('BatchSelectMoreBtns')">{{ $t("Msg.Add") }}</el-button>
                                                                </el-form-item>
                                                            </el-form>
                                                        </div>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'页面更多按钮'">
                                                        <div class="clear">
                                                            <el-table class="diy-table" :data="CurrentSysMenuModel.PageBtns" style="width: 100%">
                                                                <el-table-column :label="$t('Msg.Sort')" width="100">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.Sort" type="number" placeholder="" />
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="'Id'" width="100">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.Id" placeholder="" />
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="$t('Msg.Name')" width="200">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.Name" placeholder="" />
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="$t('Msg.Icon')" width="55">
                                                                    <template #default="scope">
                                                                        <i
                                                                            style="padding-top: 5px"
                                                                            :class="DiyCommon.IsNull(scope.row.Icon) ? 'far fa-smile-wink hand' : 'hand ' + scope.row.Icon"
                                                                            @click="$refs['fasPageBtnsIcon_' + scope.$index].show()"
                                                                        />
                                                                        <Fontawesome :ref="'fasPageBtnsIcon_' + scope.$index" v-model:model="scope.row.Icon" />
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="'按钮样式'" width="150">
                                                                    <template #default="scope">
                                                                        <el-select v-model="scope.row.BtnStyle">
                                                                            <el-option :label="'默认按钮'" :value="''"></el-option>
                                                                            <el-option :label="'主要按钮'" :value="'primary'"></el-option>
                                                                            <el-option :label="'成功按钮'" :value="'success'"></el-option>
                                                                            <el-option :label="'信息按钮'" :value="'info'"></el-option>
                                                                            <el-option :label="'警告按钮'" :value="'warning'"></el-option>
                                                                            <el-option :label="'危险按钮'" :value="'danger'"></el-option>
                                                                        </el-select>
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="'V8引擎'">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.V8Code" placeholder="V8Code" style="width: 100px" />
                                                                        <el-button @click="OpenV8CodeEditor(scope.row.Name, 'V8Code', 'PageBtns')" type="primary" :icon="Tools"></el-button>
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="'按钮显示条件V8'">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.V8CodeShow" placeholder="V8CodeShow" style="width: 100px" />
                                                                        <el-button @click="OpenV8CodeEditor(scope.row.Name, 'V8CodeShow', 'PageBtns')" type="primary" :icon="Tools"></el-button>
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column width="65" :label="$t('Msg.Action')">
                                                                    <template #default="scope">
                                                                        <!-- <el-button
                                                                            @click="AddDiyTableTab(scope.row)"
                                                                            type="primary"
                                                                           >保存</el-button> -->
                                                                        <el-button type="text" :icon="Delete" @click="DelMoreBtn(scope.row, 'PageBtns')">{{ $t("Msg.Delete") }}</el-button>
                                                                    </template>
                                                                </el-table-column>
                                                            </el-table>
                                                        </div>
                                                        <div class="clear">
                                                            <el-form :inline="true" :model="CurrentSysMenuPageBtnsModel" class="demo-form-inline">
                                                                <el-form-item label="">
                                                                    <el-input v-model="CurrentSysMenuPageBtnsModel.Sort" style="width: 100px" type="number" :placeholder="$t('Msg.Sort')" />
                                                                </el-form-item>
                                                                <el-form-item label="">
                                                                    <el-input v-model="CurrentSysMenuPageBtnsModel.Name" style="width: 200px" :placeholder="$t('Msg.Name')" />
                                                                </el-form-item>
                                                                <el-form-item label="">
                                                                    <!-- <el-input
                                                                    style="width:60px;"
                                                                    v-model="CurrentDiyTableTabModel.Icon"
                                                                    :placeholder="$t('Msg.Icon')">
                                                                </el-input> -->
                                                                    <i
                                                                        :class="
                                                                            DiyCommon.IsNull(CurrentSysMenuPageBtnsModel.Icon) ? 'far fa-smile-wink hand' : 'hand ' + CurrentSysMenuPageBtnsModel.Icon
                                                                        "
                                                                        @click="$refs.fasCDTTMIcon.show()"
                                                                    />
                                                                    <Fontawesome ref="fasCDTTMIcon" v-model:model="CurrentSysMenuPageBtnsModel.Icon" />
                                                                </el-form-item>
                                                                <el-form-item label="" v-show="false">
                                                                    <el-input value="" v-model="CurrentSysMenuPageBtnsModel.V8Code" style="width: 60px" />
                                                                </el-form-item>
                                                                <el-form-item label="" v-show="false">
                                                                    <el-input value="" v-model="CurrentSysMenuPageBtnsModel.V8CodeShow" style="width: 60px" />
                                                                </el-form-item>
                                                                <el-form-item>
                                                                    <el-button style="width: 45px" :icon="Plus" type="text" @click="AddMoreBtn('PageBtns')">{{ $t("Msg.Add") }}</el-button>
                                                                </el-form-item>
                                                            </el-form>
                                                        </div>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="24" :xs="24">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'页面多Tab'">
                                                        <div class="clear diy-table">
                                                            <el-table :data="CurrentSysMenuModel.PageTabs" class="diy-table table-table table-data" style="width: 100%">
                                                                <el-table-column :label="$t('Msg.Sort')" width="100">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.Sort" type="number" placeholder="" />
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="'Id'" width="100">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.Id" placeholder="" />
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="$t('Msg.Name')" width="200">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.Name" placeholder="" />
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="$t('Msg.Icon')" width="55">
                                                                    <template #default="scope">
                                                                        <i
                                                                            style="padding-top: 5px"
                                                                            :class="DiyCommon.IsNull(scope.row.Icon) ? 'far fa-smile-wink hand' : 'hand ' + scope.row.Icon"
                                                                            @click="$refs['fasPageTabsIcon_' + scope.$index].show()"
                                                                        />
                                                                        <Fontawesome :ref="'fasPageTabsIcon_' + scope.$index" v-model:model="scope.row.Icon" />
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="'V8引擎'">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.V8Code" placeholder="V8Code" style="width: 100px" />
                                                                        <el-button @click="OpenV8CodeEditor(scope.row.Name, 'V8Code', 'PageTabs')" type="primary" :icon="Tools"></el-button>
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column :label="'按钮显示条件V8'">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.V8CodeShow" placeholder="V8CodeShow" style="width: 100px" />
                                                                        <el-button @click="OpenV8CodeEditor(scope.row.Name, 'V8CodeShow', 'PageTabs')" type="primary" :icon="Tools"></el-button>
                                                                    </template>
                                                                </el-table-column>
                                                                <el-table-column :label="'Id'">
                                                                    <template #default="scope">
                                                                        <el-input v-model="scope.row.Id" placeholder="" disabled style="width: 100px" />
                                                                    </template>
                                                                </el-table-column>

                                                                <el-table-column width="65" :label="$t('Msg.Action')">
                                                                    <template #default="scope">
                                                                        <!-- <el-button
                                                                            @click="AddDiyTableTab(scope.row)"
                                                                            type="primary"
                                                                           >保存</el-button> -->
                                                                        <el-button type="text" :icon="Delete" @click="DelMoreBtn(scope.row, 'PageTabs')">{{ $t("Msg.Delete") }}</el-button>
                                                                    </template>
                                                                </el-table-column>
                                                            </el-table>
                                                        </div>
                                                        <div class="clear">
                                                            <el-form :inline="true" :model="CurrentSysMenuPageTabsModel" class="demo-form-inline">
                                                                <el-form-item label="">
                                                                    <el-input v-model="CurrentSysMenuPageTabsModel.Sort" style="width: 100px" type="number" :placeholder="$t('Msg.Sort')" />
                                                                </el-form-item>
                                                                <el-form-item label="">
                                                                    <el-input v-model="CurrentSysMenuPageTabsModel.Name" style="width: 200px" :placeholder="$t('Msg.Name')" />
                                                                </el-form-item>
                                                                <el-form-item label="">
                                                                    <!-- <el-input
                                                                    style="width:60px;"
                                                                    v-model="CurrentDiyTableTabModel.Icon"
                                                                    :placeholder="$t('Msg.Icon')">
                                                                </el-input> -->
                                                                    <i
                                                                        :class="
                                                                            DiyCommon.IsNull(CurrentSysMenuPageTabsModel.Icon) ? 'far fa-smile-wink hand' : 'hand ' + CurrentSysMenuPageTabsModel.Icon
                                                                        "
                                                                        @click="$refs.fasCDTTMIcon.show()"
                                                                    />
                                                                    <Fontawesome ref="fasCDTTMIcon" v-model:model="CurrentSysMenuPageTabsModel.Icon" />
                                                                </el-form-item>
                                                                <el-form-item label="" v-show="false">
                                                                    <el-input value="" v-model="CurrentSysMenuPageTabsModel.V8Code" style="width: 60px" />
                                                                </el-form-item>
                                                                <el-form-item label="" v-show="false">
                                                                    <el-input value="" v-model="CurrentSysMenuPageTabsModel.V8CodeShow" style="width: 60px" />
                                                                </el-form-item>
                                                                <el-form-item>
                                                                    <el-button style="width: 45px" :icon="Plus" type="text" @click="AddMoreBtn('PageTabs')">{{ $t("Msg.Add") }}</el-button>
                                                                </el-form-item>
                                                            </el-form>
                                                        </div>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="4" :xs="12">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'新增按钮V8'">
                                                        <el-input v-model="CurrentSysMenuModel.AddPageV8" placeholder="V8Code" style="width: 100px" />
                                                        <el-button @click="OpenV8CodeEditor('', '', 'AddPageV8')" type="primary" :icon="Tools"></el-button>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="4" :xs="12">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'新增按钮(显示条件)'">
                                                        <el-input v-model="CurrentSysMenuModel.AddCodeShowV8" placeholder="V8Code" style="width: 100px" />
                                                        <el-button @click="OpenV8CodeEditor('', '', 'AddCodeShowV8')" type="primary" :icon="Tools"></el-button>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="4" :xs="12">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'详情按钮V8'">
                                                        <el-input v-model="CurrentSysMenuModel.DetailPageV8" placeholder="V8Code" style="width: 100px" />
                                                        <el-button @click="OpenV8CodeEditor('', '', 'DetailPageV8')" type="primary" :icon="Tools"></el-button>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="4" :xs="12">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'详情按钮(显示条件)'">
                                                        <el-input v-model="CurrentSysMenuModel.DetailCodeShowV8" placeholder="V8Code" style="width: 100px" />
                                                        <el-button @click="OpenV8CodeEditor('', '', 'DetailCodeShowV8')" type="primary" :icon="Tools"></el-button>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="4" :xs="12">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'编辑按钮(显示条件)'">
                                                        <el-input v-model="CurrentSysMenuModel.EditCodeShowV8" placeholder="V8Code" style="width: 100px" />
                                                        <el-button @click="OpenV8CodeEditor('', '', 'EditCodeShowV8')" type="primary" :icon="Tools"></el-button>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="4" :xs="12">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'删除按钮(显示条件)'">
                                                        <el-input v-model="CurrentSysMenuModel.DelCodeShowV8" placeholder="V8Code" style="width: 100px" />
                                                        <el-button @click="OpenV8CodeEditor('', '', 'DelCodeShowV8')" type="primary" :icon="Tools"></el-button>
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                            <el-col :span="6" :xs="12">
                                                <div class="container-form-item">
                                                    <el-form-item class="form-item" :label="'表格操作列固定宽度'">
                                                        <el-input-number v-model="CurrentSysMenuModel.TableActionFixedWidth" placeholder="单位px" />
                                                    </el-form-item>
                                                </div>
                                            </el-col>
                                        </template>
                                    </el-row>
                                </el-form>
                            </div>
                        </el-tab-pane>
                        <!-- <el-tab-pane
                        v-if="CurrentSysMenuModel.OpenType == 'Diy'"
                        label="其它" name="DiyOther">
                        <div
                        :class="'field-form field-border'">
                        <el-form
                                status-icon
                               
                                :model="CurrentSysMenuModel"
                                :LabelPosition="'top'"
                                label-width="150px"
                                >
                                <el-row :gutter="20">
                                    <template v-if="!DiyCommon.IsNull(CurrentSysMenuModel.DiyTableId)">
                                    </template>
                                </el-row>
                            </el-form>
                        </div>
                    </el-tab-pane> -->
                    </el-tabs>
                </div>
            </div>
            <template #footer>
                <div class="offset-sm-2 col-sm-10">
                    <el-button :loading="BtnLoading" :icon="CircleCheck" v-if="!DiyCommon.IsNull(CurrentSysMenuModel.Id)" class="el-button--primary mr-2" @click="UptSysMenu()">
                        {{ $t("Msg.Save") }}
                    </el-button>
                    <el-button :loading="BtnLoading" :icon="$getIcon(!DiyCommon.IsNull(CurrentSysMenuModel.Id) ? 'copy-document' : 'circle-plus')" class="mr-2" @click="AddSysMenu(null, true)">
                        {{ !DiyCommon.IsNull(CurrentSysMenuModel.Id) ? $t("Msg.Copy") : $t("Msg.Add") }}
                    </el-button>
                    <!-- <el-button
                    :icon="Delete"
                    v-if="!DiyCommon.IsNull(CurrentSysMenuModel.Id)" class="btn-danger mr-2" @click="DelSysMenu(CurrentSysMenuModel)">
                    {{$t('Msg.Delete')}}
                </el-button> -->
                    <el-button :icon="Close" type="default" @click="ShowMenuForm = false">
                        {{ $t("Msg.Close") }}
                    </el-button>
                </div>
            </template>
        </el-dialog>
        <!-- :destroy-on-close="如果为true， 关闭的时候直接卡死" -->
        <el-dialog
            draggable
            width="70%"
            class="dialog-v8-wrapper"
            custom-class="dialog-v8"
            :modal-append-to-body="false"
            v-model="ShowV8CodeEditor"
            :close-on-click-modal="false"
            :destroy-on-close="false"
            :modal="false"
            :append-to-body="true"
        >
            <!-- <DiyV8Design
            ref="refDiyV8Code"
            :key="'refDiyV8Code'"f
            :fields="DiyFieldList"
            v-model:model="CurrentV8Code"
        ></DiyV8Design> -->
            <el-tabs v-model="DialogV8Code">
                <el-tab-pane label="V8代码" name="Code">
                    <!-- <div class="code-example">
                    <div class="codemirror">
                        <codemirror
                            ref="cmObj"
                            v-model="CurrentV8Code"
                            :options="CmOptions" />
                    </div>
                </div> -->
                    <DiyCodeEditor ref="diyCodeEditor" :key="CurrentV8Sign + CurrentV8SignCol + CurrentV8SignFieldName" v-model="CurrentV8Code" :height="CodeEditorHeight"> </DiyCodeEditor>
                </el-tab-pane>
                <!-- <C_V8Explain></C_V8Explain> -->
                <!-- <el-tab-pane
                label="说明"
                name="Explain">
                <DiyDocument></DiyDocument>
            </el-tab-pane> -->
            </el-tabs>

            <template #footer>
                <el-button type="primary" :icon="Close" @click="CloseV8CodeEditor">{{ $t("Msg.Close") }}({{ $t("Msg.AutoSave") }})</el-button>
            </template>
        </el-dialog>

        <Fontawesome ref="fasCSMMIcon" v-model:model="CurrentSysMenuModel.IconClass" />

        <!-- 快速建表弹窗 -->
        <el-dialog
            draggable
            width="550px"
            ref="refQuickCreateTableDialog"
            :modal-append-to-body="false"
            v-model="ShowQuickCreateTableDialog"
            title="快速建表"
            :close-on-click-modal="false"
            :append-to-body="true"
            :destroy-on-close="false"
            @open="onDialogOpen('refQuickCreateTableDialog')"
            @close="onDialogClose('refQuickCreateTableDialog')"
        >
            <el-alert class="marginBottom15" title="表名建议固定前缀且小写，如：diy_tablename、microi_doc_paper" type="info" :closable="false" show-icon> </el-alert>
            <el-form :model="QuickCreateTableModel" label-width="90px">
                <el-form-item label="表名">
                    <el-input v-model="QuickCreateTableModel.Name" />
                </el-form-item>
                <el-form-item label="描述">
                    <el-input v-model="QuickCreateTableModel.Description" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button :loading="SaveQuickCreateTableLoading" type="primary" :icon="QuestionFilled" @click="SaveQuickCreateTable">{{ $t("Msg.Save") }}</el-button>
                <el-button :icon="Close" @click="ShowQuickCreateTableDialog = false">{{ $t("Msg.Cancel") }}</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script>
import { computed } from "vue";
import Sortable from "sortablejs";
import _ from "underscore";
import { DiyApi } from "@/utils/api.itdos";
import { useDiyStore } from "@/pinia";
import DiyDocument from "./diy-document";

export default {
    name: "diy-module",
    components: {
        DiyDocument
    },
    directives: {},
    props: {
        modal: {
            type: Boolean,
            default: false
        }
    },
    watch: {
        "CurrentSysMenuModel.OpenType"(val) {
            var self = this;
            if (val == "Diy" && !self.DiyCommon.IsNull(self.CurrentSysMenuModel.DiyTableId)) {
                self.$nextTick(function () {
                    self.SetDiyFieldSort();
                });
            }
        },
        "CurrentSysMenuModel.DiyTableId"(val) {
            var self = this;
            if (!self.DiyCommon.IsNull(val) && self.CurrentSysMenuModel.OpenType == "Diy") {
                self.$nextTick(function () {
                    self.SetDiyFieldSort();
                });
            }
        }
    },
    beforeCreate() {},
    setup() {
        const diyStore = useDiyStore();
        const GetCurrentUser = computed(() => diyStore.GetCurrentUser);
        const DesktopBg = computed(() => diyStore.DesktopBg);
        const CurrentTime = computed(() => diyStore.CurrentTime);
        const LoginCover = computed(() => diyStore.LoginCover);
        const OsClient = computed(() => diyStore.OsClient);
        const Lang = computed(() => diyStore.Lang);
        const EnableEnEdit = computed(() => diyStore.EnableEnEdit);
        const SystemStyle = computed(() => diyStore.SystemStyle);
        const SysConfig = computed(() => diyStore.SysConfig);
        return {
            diyStore,
            GetCurrentUser,
            DesktopBg,
            CurrentTime,
            LoginCover,
            OsClient,
            Lang,
            EnableEnEdit,
            SystemStyle,
            SysConfig
        };
    },
    computed: {},
    destroyed() {},
    mounted() {
        var self = this;
        // self.Init();
        self.GetApiEngineList();
    },
    data() {
        return {
            ApiEngineList: [],
            BtnLoading: false,
            CodeEditorHeight: "500px",
            DefaultOrderBy: "",
            DefaultOrderByType: "",

            DefaultOrderByArray: [],

            DiyFieldList: [],
            TempSearchFieldIds: [],
            TempJoinTables: [],
            // TableDiyFieldIdsSearch:[],
            CurrentSysMenuMoreBtnsModel: {
                Id: this.DiyCommon.NewGuid(),
                Sort: 0,
                Name: "",
                V8Code: "",
                V8CodeShow: "",
                Icon: "",
                Url: ""
            },
            CurrentSysMenuExportMoreBtnsModel: {
                Id: this.DiyCommon.NewGuid(),
                Sort: 0,
                Name: "",
                V8Code: "",
                V8CodeShow: "",
                Icon: "",
                Url: ""
            },
            CurrentSysMenuBatchSelectMoreBtnsModel: {
                Id: this.DiyCommon.NewGuid(),
                Sort: 0,
                Name: "",
                V8Code: "",
                V8CodeShow: "",
                Icon: "",
                Url: ""
            },
            CurrentSysMenuPageBtnsModel: {
                Id: this.DiyCommon.NewGuid(),
                Sort: 0,
                Name: "",
                V8Code: "",
                V8CodeShow: "",
                Icon: "",
                Url: ""
            },
            CurrentSysMenuFormBtnsModel: {
                Id: this.DiyCommon.NewGuid(),
                Sort: 0,
                Name: "",
                V8Code: "",
                V8CodeShow: "",
                Icon: "",
                Url: ""
            },
            CurrentSysMenuPageTabsModel: {
                Id: this.DiyCommon.NewGuid(),
                Sort: 0,
                Name: "",
                V8Code: "",
                V8CodeShow: "",
                Icon: "",
                Url: ""
            },
            CurrentV8Sign: "",
            CurrentV8SignCol: "",
            CurrentV8SignFieldName: "",
            DiyTableList: [],
            CurrentV8Code: "",
            DialogV8Code: "Code", // Explain
            ShowV8CodeEditor: false,
            ParentName: this.$t("Msg.TopLevel"),
            CurrentSysMenuModelTab: "Info",
            ShowMenuForm: false,
            CurrentSysMenuModel: {
                IconClass: ""
            },
            SysMenuList: [],
            SysMenuTreeProps: {
                children: "_Child",
                label: "Name", // this.Lang == 'cn' ? 'Name' : 'EnName'
                Enlabel: "EnName"
            },
            // 快速建表相关
            ShowQuickCreateTableDialog: false,
            SaveQuickCreateTableLoading: false,
            QuickCreateTableModel: {
                Name: "diy_",
                Description: ""
            }
            // CmOptions: {
            //     // 所有参数配置见：https://codemirror.net/doc/manual.html#config
            //     tabSize: 4,
            //     styleActiveLine: true,
            //     lineNumbers: true,
            //     line: true,
            //     foldGutter: true,
            //     styleSelectedText: true,
            //     mode: 'text/javascript',
            //     // keyMap: "sublime",
            //     matchBrackets: true,
            //     showCursorWhenSelecting: true,
            //     theme: 'base16-dark',
            //     extraKeys: {
            //         'Ctrl': 'autocomplete'
            //     },
            //     hintOptions: {
            //         completeSingle: false
            //     },
            //     lineWrapping: true // 自动换行
            // },
        };
    },
    methods: {
        Init(sysMenuId, callback) {
            var self = this;
            self.GetDiyTable();
            self.GetSysMenu();
            if (self.Lang == "zh-CN") {
                self.SysMenuTreeProps.lable = "Name";
            } else {
                self.SysMenuTreeProps.lable = "EnName";
            }
            self.OpenMenuForm(sysMenuId, callback);
        },
        GetApiEngineList() {
            var self = this;
            console.log("获取ApiEngineList-2");
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
        ChangeDefaultSort(id) {
            var self = this;
            var model = self.DiyFieldList.find((item) => item.Id == id);
            if (!model) {
                model = self.SysDefaultField.find((item) => item.Id == id);
            }
            var uptModel = self.DefaultOrderByArray.find((item) => item.Id == id);
            uptModel.Name = model.Name;
        },
        AddDefaultSort() {
            var self = this;
            self.DefaultOrderByArray.push({
                Id: "",
                Name: "",
                Sort: self.DefaultOrderByArray.length + 5,
                Type: "ASC"
            });
        },
        //2025-8-9,删除排序
        DelDefaultSort(item) {
            var self = this;
            let index = self.DefaultOrderByArray.indexOf(item); // 找到值为3的元素的索引
            if (index !== -1) {
                // 如果找到了该元素（即index不为-1）
                self.DefaultOrderByArray.splice(index, 1); // 从找到的索引位置开始，删除1个元素
            }
        },
        MenuNameBlur() {
            var self = this;
            if (self.DiyCommon.IsNull(self.CurrentSysMenuModel.Url) && !self.DiyCommon.IsNull(self.CurrentSysMenuModel.Name)) {
                self.CurrentSysMenuModel.Url = ("/" + self.DiyCommon.ChineseToPinyin(self.CurrentSysMenuModel.Name, 4, 3)).toString();
            }
        },
        UptSysMenu() {
            var self = this;
            self.BtnLoading = true;
            var param = {
                ...self.CurrentSysMenuModel
            };

            if (!self.DiyCommon.IsNull(self.DefaultOrderBy) && !self.DiyCommon.IsNull(self.DefaultOrderByType)) {
                param.DefaultOrderBy = JSON.stringify([{ Id: self.DefaultOrderBy, Type: self.DefaultOrderByType }]);
            } else {
                param.DefaultOrderBy = "";
            }

            if (self.DefaultOrderByArray.length > 0) {
                param.DefaultOrderBy = JSON.stringify(self.DefaultOrderByArray);
            }

            self.ForConvertSysMenuParam(param);

            // param.OsClient = self.OsClient;
            param._Child = null;
            // param.TableName = 'Sys_Menu';

            //2024-05-12 BASE64传输，防止请求被拦截，服务器端通过事件解析BASE64
            var stringToBase64Arr = ["SqlWhere", "SqlJoin", "MoreBtns", "FormBtns", "ExportMoreBtns", "BatchSelectMoreBtns", "PageBtns", "PageTabs"];
            stringToBase64Arr.forEach((item) => {
                if (param[item]) {
                    param[item] = self.Base64.encode(param[item]);
                }
            });

            var realParam = {
                FormEngineKey: "Sys_Menu",
                Id: param.Id,
                _RowModel: { ...param }
            };

            // self.DiyCommon.Post(self.DiyApi.UptSysMenu(), param, function (result) {
            self.DiyCommon.Post(self.DiyApi.FormEngine.UptFormData, realParam, function (result) {
                if (self.DiyCommon.Result(result)) {
                    self.DiyCommon.Tips(self.$t("Msg.Success"));
                    self.GetSysMenu();
                    self.ShowMenuForm = false;
                }
                self.BtnLoading = false;
            });
        },
        ForConvertSysMenuParam(param) {
            var self = this;
            self.DiyCommon.SysMenuNeedConvertField.forEach((convertField) => {
                if (self.DiyCommon.IsNull(param[convertField])) {
                    if (convertField == "DiyConfig") {
                        param[convertField] = "{}";
                    } else {
                        param[convertField] = "[]";
                    }
                } else {
                    if (convertField == "StatisticsFields") {
                        var tempResult = [];
                        param[convertField].forEach((calcId) => {
                            tempResult.push({
                                Id: calcId,
                                Type: "Sum"
                            });
                        });
                        param[convertField] = JSON.stringify(tempResult);
                    } else {
                        param[convertField] = JSON.stringify(param[convertField]);
                    }
                }
            });
        },
        async GetDiyTable() {
            var self = this;
            return new Promise((resolve) => {
                self.DiyCommon.Post(
                    DiyApi.GetDiyTable,
                    {
                        OsClient: self.OsClient
                    },
                    function (result) {
                        if (self.DiyCommon.Result(result)) {
                            self.DiyTableList = result.Data;
                        }
                        resolve(result);
                    }
                );
            });
        },
        GetSysMenu() {
            var self = this;

            self.DiyCommon.Post(
                self.DiyApi.GetSysMenuStep(),
                {
                    // self.DiyCommon.Post(self.DiyApi.GetDiyTableRowTree, {
                    _SelectFields: [
                        "Id",
                        "Name",
                        "Icon",
                        "IconClass",
                        "Display",
                        "AppDisplay",
                        "IsMicroiService",
                        "OpenType",
                        "ComponentName",
                        "ComponentPath",
                        "PageTemplate",
                        "Url",
                        "DiyTableId",
                        "ParentId",
                        "Sort"
                    ],
                    TableName: "Sys_Menu",
                    _OrderBy: "Sort",
                    _OrderByType: "ASC"
                    // _ChildSystemId : childSystemId
                },
                function (result) {
                    if (self.DiyCommon.Result(result)) {
                        // result.Data.forEach((data) => {
                        //     self.DiyCommon.ForConvertSysMenu(data);
                        // });
                        self.SysMenuList = result.Data;
                    }
                }
            );
        },
        async OpenMenuForm(sysMenuId, callback) {
            var self = this;
            var joinTables = [];
            self.DefaultParent(); // 默认父级
            if (sysMenuId) {
                var getSysMenuModelResult = await self.DiyCommon.PostAsync(self.DiyApi.GetSysMenuModel, {
                    Id: sysMenuId
                });
                if (self.DiyCommon.Result(getSysMenuModelResult)) {
                    var tempModel = getSysMenuModelResult.Data;
                    //转换之前，先改造下 SearchFieldIds,从List<Guid>变为  List<{Id,Name,Label,AsName,TableId,TableName,TableDescription,DisplayType:'In/Out',DisplaySelect}>
                    if (!self.DiyCommon.IsNull(tempModel.SearchFieldIds)) {
                        if (tempModel.SearchFieldIds.length > 0 && tempModel.SearchFieldIds[0].Name == "") {
                            //typeof(tempModel.SearchFieldIds[0]) == 'string'
                            var index = 0;
                            tempModel.SearchFieldIds.forEach((fieldOldModel) => {
                                var fieldModel = _.where(self.DiyFieldList, {
                                    Id: fieldOldModel.Id
                                })[0];
                                // if (fieldModel) {
                                //     var newFieldModel = {
                                //         Id: fieldOldModel.Id ,
                                //         Name : fieldModel.Name,
                                //         Label : fieldModel.Label,
                                //         AsName: '' ,
                                //         TableId: fieldModel.TableId,
                                //         TableName:fieldModel.TableName,
                                //         TableDescription : fieldModel.TableDescription,
                                //         DisplayType:'In',//Out
                                //         DisplaySelect: false
                                //     };
                                //     tempModel.SearchFieldIds[index] = newFieldModel;
                                // }
                                if (fieldModel) {
                                    fieldOldModel.Name = fieldModel.Name;
                                    fieldOldModel.Label = fieldModel.Label;
                                    fieldOldModel.TableId = fieldModel.TableId;
                                    fieldOldModel.TableName = fieldModel.TableName;
                                    fieldOldModel.TableDescription = fieldModel.TableDescription;
                                }
                                index++;
                            });
                        }
                    }
                    self.DiyCommon.ForConvertSysMenu(tempModel);
                    // tempModel.Display = tempModel.Display ? true : false;
                    // tempModel.InTableEdit = tempModel.InTableEdit ? true : false;
                    tempModel.IsMicroiService = tempModel.IsMicroiService ? true : false;
                    self.CurrentSysMenuModel = tempModel;
                    if (
                        (self.CurrentSysMenuModel.TableDiyFieldIds.length > 0 && self.CurrentSysMenuModel.SelectFields.length == 0) ||
                        self.CurrentSysMenuModel.TableDiyFieldIds.length != self.CurrentSysMenuModel.SelectFields.length
                    ) {
                        self.CurrentSysMenuModel.TableDiyFieldIds.forEach((fieldId) => {
                            if (_.where(self.CurrentSysMenuModel.SelectFields, { Id: fieldId }).length == 0) {
                                var fieldModel = _.where(self.DiyFieldList, { Id: fieldId })[0];
                                if (fieldModel) {
                                    self.CurrentSysMenuModel.SelectFields.push({
                                        Id: fieldId,
                                        AsName: "",
                                        Name: fieldModel.Name,
                                        Label: fieldModel.Label,
                                        TableId: fieldModel.TableId,
                                        TableName: fieldModel.TableName,
                                        TableDescription: fieldModel.TableDescription
                                    });
                                }
                            }
                        });
                    }
                }
            } else {
                var tempModel = { Url: "", Display: 1, AppDisplay: 1 };
                self.DiyCommon.ForConvertSysMenu(tempModel);
                self.CurrentSysMenuModel = tempModel;
            }
            //按钮排序2025-8-9
            self.CurrentSysMenuModel.FormBtns.sort((a, b) => a.Sort - b.Sort);
            self.CurrentSysMenuModel.MoreBtns.sort((a, b) => a.Sort - b.Sort);
            self.CurrentSysMenuModel.ExportMoreBtns.sort((a, b) => a.Sort - b.Sort);
            self.CurrentSysMenuModel.BatchSelectMoreBtns.sort((a, b) => a.Sort - b.Sort);
            self.CurrentSysMenuModel.PageBtns.sort((a, b) => a.Sort - b.Sort);
            self.CurrentSysMenuModel.PageTabs.sort((a, b) => a.Sort - b.Sort);

            if (!self.DiyCommon.IsNull(self.CurrentSysMenuModel.DiyTableId)) {
                joinTables = self.DiyCommon.IsNull(self.CurrentSysMenuModel.JoinTables) ? [] : self.CurrentSysMenuModel.JoinTables;

                self.DiyFieldList = [];
                await self.GetDiyField(self.CurrentSysMenuModel.DiyTableId, joinTables);
            }

            if (!self.DiyCommon.IsNull(self.CurrentSysMenuModel.ImportTemplate)) {
                //取临时链接 _ImportTemplateUrl
                // self.DiyCommon.Post('/api/Aliyun/GetOssDownloadUrl',{
                self.DiyCommon.Post(
                    "/api/HDFS/GetPrivateFileUrl",
                    {
                        FilePathName: self.CurrentSysMenuModel.ImportTemplate,
                        HDFS: self.SysConfig.HDFS || "Aliyun"
                    },
                    function (result) {
                        if (self.DiyCommon.Result(result)) {
                            result = result.Data;
                        } else {
                            result = "";
                        }
                        self.CurrentSysMenuModel["_ImportTemplateUrl"] = result;
                        // resolve(result);
                    }
                );
            }

            if (self.DiyCommon.IsNull(self.CurrentSysMenuModel.DefaultOrderBy)) {
                self.DefaultOrderBy = "";
                self.DefaultOrderByType = "";

                self.DefaultOrderByArray = [];
            } else {
                try {
                    var tArr = JSON.parse(self.CurrentSysMenuModel.DefaultOrderBy);
                    tArr.sort((a, b) => a.Sort - b.Sort);
                    self.DefaultOrderByArray = tArr;

                    self.DefaultOrderBy = tArr[0].Id;
                    self.DefaultOrderByType = tArr[0].Type;
                } catch (error) {
                    self.DefaultOrderBy = "";
                    self.DefaultOrderByType = "";
                }
            }

            if (!self.DiyCommon.IsNull(self.CurrentSysMenuModel.Id)) {
                // var parentModel = _.where(self.SysMenuList, { Id : self.CurrentSysMenuModel.ParentId});
                //var parentModel = self.DiyCommon.FindRecursion(self.SysMenuList, '_Child', self.CurrentSysMenuModel.ParentId);

                var parentModel;
                var parentResult = await self.DiyCommon.PostAsync(self.DiyApi.GetSysMenuModel, {
                    Id: self.CurrentSysMenuModel.ParentId
                });
                if (parentResult.Code == 1) {
                    parentModel = parentResult.Data;
                }

                self.DiyCommon.ForConvertSysMenu(self.CurrentSysMenuModel);

                // if (!self.DiyCommon.IsNull(self.CurrentSysMenuModel.DiyTableId)) {
                //     self.GetDiyField();
                // }
                // 选中Parent

                console.log("self.DiyCommon.GuidEmpty", self.DiyCommon.GuidEmpty);

                if (self.CurrentSysMenuModel.ParentId == self.DiyCommon.GuidEmpty) {
                    self.CurrentSysMenuModel.ParentName = "顶级";
                    self.ParentName = "顶级";
                } else {
                    if (parentModel) {
                        self.CurrentSysMenuModel.ParentName = parentModel.Name;
                        self.ParentName = parentModel.Name;
                    }
                }
            }

            self.ShowMenuForm = true;
            if (callback) {
                callback();
            }

            self.$nextTick(function () {
                self.SetDiyFieldSort();
            });
        },
        AddJoinTable() {
            var self = this;
            self.TempJoinTables.forEach((tableId) => {
                var temp = _.where(self.CurrentSysMenuModel.JoinTables, {
                    Id: tableId
                });
                if (temp.length == 0) {
                    var tableModel = _.where(self.DiyTableList, { Id: tableId })[0];
                    self.CurrentSysMenuModel.JoinTables.push({
                        Id: tableModel.Id,
                        AsName: "",
                        Name: tableModel.Name,
                        Description: tableModel.Description
                    });
                }
            });
            self.TempJoinTables = [];
            self.GetDiyField();
        },
        async GetDiyField(diyTableId, joinTables) {
            var self = this;
            self.DiyFieldList = [];
            diyTableId = !self.DiyCommon.IsNull(diyTableId) ? diyTableId : self.CurrentSysMenuModel.DiyTableId;
            joinTables = !self.DiyCommon.IsNull(joinTables) ? joinTables : self.CurrentSysMenuModel.JoinTables;
            joinTables = self.DiyCommon.IsNull(joinTables) ? [] : joinTables;
            if (!self.DiyCommon.IsNull(diyTableId)) {
                var tableIds = [diyTableId];
                // var joinTables = self.DiyCommon.IsNull(self.CurrentSysMenuModel.JoinTables) ? [] : self.CurrentSysMenuModel.JoinTables;
                joinTables.forEach((element) => {
                    tableIds.push(element.Id);
                });
                var result = await self.DiyCommon.PostAsync(DiyApi.GetDiyFieldByDiyTables, {
                    TableIds: tableIds
                });
                if (self.DiyCommon.Result(result)) {
                    self.DiyCommon.SysDefaultField.forEach((item) => {
                        var findResult = result.Data.find((item2) => item2.Name == item.Name);
                        if (!findResult) {
                            item.TableDescription = "";
                            item.TableName = "";
                            result.Data.push(item);
                        }
                    });
                    self.DiyFieldList = result.Data;
                    // //初始化列配置，要修复老数据
                    // var isNeedFix = self.TableDiyFieldIds.length > 0 && typeof(self.TableDiyFieldIds[0]) == 'string';
                    // if (isNeedFix) {
                    //     self.TableDiyFieldIds.forEach(element => {
                    //         var fields = _.where(self.DiyFieldList, { Id : element });
                    //         if (fields && fields.length > 0) {
                    //             var field = fields[0];
                    //             element = {
                    //                 FieldId : field.Id,
                    //                 _FieldName : field.Name,
                    //                 _FieldLabel : field.Label,
                    //                 AsName:'',
                    //                 IsSelect : true,
                    //                 IsShow : true,
                    //                 IsOrderBy : true,
                    //                 IsSearch : true,
                    //                 IsEditor : true,
                    //                 Type:'',//Field、Custom
                    //             };
                    //         }
                    //     });
                    // }

                    // self.setSort();
                }
            } else {
                self.DiyFieldList = [];
            }
        },
        AddSearchFieldId() {
            var self = this;
            self.TempSearchFieldIds.forEach((fieldId) => {
                var temp = _.where(self.CurrentSysMenuModel.SearchFieldIds, {
                    Id: fieldId
                });
                if (temp.length == 0) {
                    // var fieldModel = _.where(self.DiyFieldList, { Id : fieldId })[0];
                    var fieldModel = _.find(self.DiyFieldList, function (item) {
                        return item.Id == fieldId;
                    });
                    if (!fieldModel) {
                        fieldModel = _.find(self.DiyCommon.SysDefaultField, function (item) {
                            return item.Id == fieldId;
                        });
                        //已经有了Id、Label、Name
                        if (fieldModel) {
                            var tempFieldModel = _.find(self.DiyFieldList, function (item) {
                                return item.TableId == self.CurrentSysMenuModel.DiyTableId;
                            });
                            if (tempFieldModel) {
                                fieldModel.TableId = tempFieldModel.TableId;
                                fieldModel.TableName = tempFieldModel.TableName;
                                fieldModel.TableDescription = tempFieldModel.TableDescription;
                            }
                        }
                    }

                    if (fieldModel) {
                        self.CurrentSysMenuModel.SearchFieldIds.push({
                            Id: fieldModel.Id,
                            AsName: "",
                            Name: fieldModel.Name,
                            Label: fieldModel.Label,
                            TableId: fieldModel.TableId,
                            TableName: fieldModel.TableName,
                            TableDescription: fieldModel.TableDescription,
                            DisplayType: "In", //Out
                            DisplaySelect: false,
                            Hide: false,
                            Equal: false
                        });
                    }
                }
            });
            self.TempSearchFieldIds = [];
            self.GetDiyField();
        },
        DelJoinTable(index) {
            var self = this;
            self.CurrentSysMenuModel.JoinTables.splice(index, 1);
            self.GetDiyField();
        },
        DelSearchFieldId(index) {
            var self = this;
            self.CurrentSysMenuModel.SearchFieldIds.splice(index, 1);
            self.GetDiyField();
        },
        DelSelectField(index) {
            var self = this;
            self.CurrentSysMenuModel.SelectFields.splice(index, 1);
        },
        AddMoreBtn(fieldName) {
            var self = this;
            self.CurrentSysMenuModel[fieldName].push(self["CurrentSysMenu" + fieldName + "Model"]);
            self["CurrentSysMenu" + fieldName + "Model"] = {
                Id: self.DiyCommon.NewGuid(),
                Sort: 0,
                Name: "",
                V8Code: "",
                V8CodeShow: "",
                Icon: ""
            };
        },
        DelMoreBtn(tabModel, fieldName) {
            var self = this;
            var index = 0;
            for (let index = 0; index < self.CurrentSysMenuModel[fieldName].length; index++) {
                if (self.CurrentSysMenuModel[fieldName][index].Name == tabModel.Name) {
                    self.CurrentSysMenuModel[fieldName].splice(index, 1);
                    break;
                }
            }
        },
        OpenV8CodeEditor(type, colType, fieldName) {
            var self = this;

            self.CurrentV8Sign = type;
            self.CurrentV8SignCol = colType;
            self.CurrentV8SignFieldName = fieldName;
            if (
                fieldName == "DetailPageV8" ||
                fieldName == "AddPageV8" ||
                fieldName == "AddCodeShowV8" ||
                fieldName == "DetailCodeShowV8" ||
                (fieldName == fieldName) == "AddCodeShowV8" ||
                fieldName == "EditCodeShowV8" ||
                fieldName == "DelCodeShowV8"
            ) {
                self.CurrentV8Code = self.CurrentSysMenuModel[fieldName];
            } else {
                self.CurrentSysMenuModel[fieldName].forEach((btn) => {
                    if (btn.Name == type) {
                        self.CurrentV8Code = self.DiyCommon.IsNull(btn[colType]) ? "" : btn[colType];
                    }
                });
            }

            self.ShowV8CodeEditor = true;
        },
        CloseV8CodeEditor() {
            var self = this;
            if (
                self.CurrentV8SignFieldName == "DetailPageV8" ||
                self.CurrentV8SignFieldName == "AddPageV8" ||
                self.CurrentV8SignFieldName == "AddCodeShowV8" ||
                self.CurrentV8SignFieldName == "DetailCodeShowV8" ||
                self.CurrentV8SignFieldName == "EditCodeShowV8" ||
                self.CurrentV8SignFieldName == "DelCodeShowV8"
            ) {
                self.CurrentSysMenuModel[self.CurrentV8SignFieldName] = self.CurrentV8Code;
            } else {
                self.CurrentSysMenuModel[self.CurrentV8SignFieldName].forEach((btn) => {
                    if (btn.Name == self.CurrentV8Sign) {
                        btn[self.CurrentV8SignCol] = self.CurrentV8Code;
                    }
                });
            }

            self.ShowV8CodeEditor = false;
        },
        GetDefaultOrderBy() {
            var self = this;
            if (condition) {
                //CurrentSysMenuModel.DefaultOrderBy
            }
        },
        DiyTableIdChange(value) {
            var self = this;
            self.CurrentSysMenuModel.ModuleEngineKey = self.DiyTableList.find((item) => item.Id == value)?.Name;
            self.GetDiyField();
        },
        JoinDiyTableChange() {
            var self = this;
            // self.GetDiyField();
        },
        UrlApiEngineIdChange() {
            var self = this;
            if (self.CurrentSysMenuModel.UrlApiEngineId) {
                self.CurrentSysMenuModel.Url = "/iframe/" + self.CurrentSysMenuModel.UrlApiEngineId;
            } else {
                self.CurrentSysMenuModel.Url = "";
            }
        },
        ChangeTableDiyFieldIds(fieldIds, a2) {
            var self = this;
            //要可能是删除，也有可能是新增
            //如果A存在，B不存在，就要新增
            self.CurrentSysMenuModel.TableDiyFieldIds.forEach((fieldId) => {
                var currentIndex = _.findIndex(self.CurrentSysMenuModel.SelectFields, {
                    Id: fieldId
                });
                if (currentIndex == -1) {
                    var fieldModel = _.where(self.DiyFieldList, { Id: fieldId })[0];
                    if (fieldModel) {
                        self.CurrentSysMenuModel.SelectFields.push({
                            Id: fieldId,
                            AsName: "",
                            Name: fieldModel.Name,
                            Label: fieldModel.Label,
                            TableId: fieldModel.TableId,
                            TableName: fieldModel.TableName,
                            TableDescription: fieldModel.TableDescription
                        });
                    }
                }
            });
            //如果B存在，A不存在，就要删除
            // var index = 0;
            // self.CurrentSysMenuModel.SelectFields.forEach(fieldModel => {
            //     var currentIndex = _.findIndex(self.CurrentSysMenuModel.TableDiyFieldIds, {Id : fieldModel.Id});
            //     if (currentIndex == -1) {
            //         self.CurrentSysMenuModel.SelectFields.splice(index, 1);
            //     }
            //     index++;
            // });
        },
        RemoveTagTableDiyFieldIds(fieldId, p2) {
            var self = this;
            var currentIndex = _.findIndex(self.CurrentSysMenuModel.SelectFields, {
                Id: fieldId
            });
            if (currentIndex > -1) {
                self.CurrentSysMenuModel.SelectFields.splice(currentIndex, 1);
            }

            var currentIndex2 = self.CurrentSysMenuModel.TableDiyFieldIds.findIndex((item) => item == fieldId);
            if (currentIndex2 > -1) {
                self.CurrentSysMenuModel.TableDiyFieldIds.splice(currentIndex2, 1);
            }
        },
        DefaultParent() {
            this.CurrentSysMenuModel.ParentId = "00000000-0000-0000-0000-000000000000";
            this.CurrentSysMenuModel.ParentName = "顶级";
            this.ParentName = "顶级";
        },
        sysMenuTreeClick(data) {
            this.CurrentSysMenuModel.ParentId = data.Id;
            this.CurrentSysMenuModel.ParentName = data.Name;
            this.ParentName = data.Name;
        },
        // SwitchLeftTabs() {
        //     var self = this;
        //     self.LeftMenuHide = !self.LeftMenuHide;
        //     // 同时改变子组件的隐藏状态
        //     self.$refs.OsLeftMenuC.LeftMenuHide = self.LeftMenuHide;
        // },
        // SelectLeftTab(m) {
        //     var self = this;
        //     this.ActiveLeftMenu = m;
        //     if (m.Id == "basedata") {
        //         self.GetSysMenu();
        //     }
        // },
        setSort() {
            const el = this.$refs.dragTable.$el.querySelectorAll(".el-table__body-wrapper > table > tbody")[0];
            this.sortable = Sortable.create(el, {
                ghostClass: "sortable-ghost", // Class name for the drop placeholder,
                setData: function (dataTransfer) {
                    // to avoid Firefox bug
                    // Detail see : https://github.com/RubaXa/Sortable/issues/1012
                    dataTransfer.setData("Text", "");
                },
                onEnd: (evt) => {
                    const targetRow = this.DiyFieldList.splice(evt.oldIndex, 1)[0];
                    this.DiyFieldList.splice(evt.newIndex, 0, targetRow);

                    // for show the changes, you can delete in you code
                    // const tempIndex = this.newList.splice(evt.oldIndex, 1)[0]
                    // this.newList.splice(evt.newIndex, 0, tempIndex)
                }
            });
        },
        SetDiyFieldSort() {
            var self = this;
            try {
                const el = self.$refs.sltTableDiyFieldIds.$el.querySelectorAll(".el-select__tags > span")[0];
                this.sortable = Sortable.create(el, {
                    ghostClass: "sortable-ghost", // Class name for the drop placeholder,
                    setData: function (dataTransfer) {
                        dataTransfer.setData("Text", "");
                        // to avoid Firefox bug
                        // Detail see : https://github.com/RubaXa/Sortable/issues/1012
                    },
                    onEnd: (evt) => {
                        const targetRow = self.CurrentSysMenuModel.TableDiyFieldIds.splice(evt.oldIndex, 1)[0];
                        self.CurrentSysMenuModel.TableDiyFieldIds.splice(evt.newIndex, 0, targetRow);
                    }
                });
            } catch (error) {}
        },
        GetAllCanEditFieldList() {
            var self = this;
            var result = [];
            self.DiyFieldList.forEach((element) => {
                //2023-05-01 按理说不显示列也应该可以配置可编辑。因为列虽然配置为不显示，也可能使用V8动态重新设置为可显示。
                if (!(self.CurrentSysMenuModel.NotShowFields.indexOf(element.Id) > -1)) {
                    result.push(element);
                }
                // result.push(element);
            });
            return result;
        },
        handleAvatarSuccess(result, file) {
            var self = this;
            if (self.DiyCommon.Result(result)) {
                self.CurrentSysMenuModel.Icon = result.Data.Path; // URL.createObjectURL(file.raw);
                self.DiyCommon.Tips(self.$t("Msg.UploadSuccess"));
            }
        },
        handleImportTplSuccess(result, file) {
            var self = this;
            if (self.DiyCommon.Result(result)) {
                self.CurrentSysMenuModel.ImportTemplate = result.Data.Path; // URL.createObjectURL(file.raw);
                self.DiyCommon.Tips(self.$t("Msg.UploadSuccess"));

                //取临时链接 _ImportTemplateUrl
                // self.DiyCommon.Post('/api/Aliyun/GetOssDownloadUrl',{
                self.DiyCommon.Post(
                    "/api/HDFS/GetPrivateFileUrl",
                    {
                        FilePathName: self.CurrentSysMenuModel.ImportTemplate,
                        HDFS: self.SysConfig.HDFS || "Aliyun"
                    },
                    function (result) {
                        if (self.DiyCommon.Result(result)) {
                            result = result.Data;
                        } else {
                            result = "";
                        }
                        self.CurrentSysMenuModel["_ImportTemplateUrl"] = result;
                        // resolve(result);
                    }
                );
            }
        },

        sysMenuTreeLeftClick(data, node) {
            // var self = this;
            // self.SysMenuNeedConvertField.forEach((convertField) => {
            //     if (self.DiyCommon.IsNull(data[convertField])) {
            //         data[convertField] = [];
            //     } else if (typeof data[convertField] === "string") {
            //         data[convertField] = JSON.parse(data[convertField]);
            //     }
            // });
            // this.CurrentSysMenuModel = data;
            // if (!self.DiyCommon.IsNull(self.CurrentSysMenuModel.DiyTableId)) {
            //     self.GetDiyField();
            // }
            // // 选中Parent
            // if (data.ParentId == self.DiyCommon.GuidEmpty) {
            //     this.CurrentSysMenuModel.ParentName = "顶级";
            //     this.ParentName = "顶级";
            // } else {
            //     this.CurrentSysMenuModel.ParentName = node.parent.data.Name;
            //     this.ParentName = node.parent.data.Name;
            // }
        },
        AddSysMenu(parentModel, isCopy) {
            var self = this;
            self.BtnLoading = true;
            var param = {};
            if (!self.DiyCommon.IsNull(parentModel)) {
                param.ParentId = parentModel.Id;
                param.Name = self.$t("Msg.Unnamed");
            } else {
                param = {
                    ...self.CurrentSysMenuModel
                };
            }

            if (!self.DiyCommon.IsNull(self.DefaultOrderBy) && !self.DiyCommon.IsNull(self.DefaultOrderByType)) {
                param.DefaultOrderBy = JSON.stringify([{ Id: self.DefaultOrderBy, Type: self.DefaultOrderByType }]);
            } else {
                param.DefaultOrderBy = "";
            }

            if (self.DefaultOrderByArray.length > 0) {
                param.DefaultOrderBy = JSON.stringify(self.DefaultOrderByArray);
            }

            self.ForConvertSysMenuParam(param);

            // param.OsClient = self.OsClient;
            param._Child = null;
            // param.TableName = "Sys_Menu";
            if (isCopy) {
                param.Id = null;
            }
            if (!param.Sort) {
                param.Sort = 0;
            } else {
                param.Sort = parseInt(param.Sort);
            }
            param.MultRun = 1;
            param.Id = self.DiyCommon.NewGuid();
            // self.DiyCommon.Post(self.DiyApi.AddSysMenu(), param, function (result) {

            //2024-05-12 BASE64传输，防止请求被拦截，服务器端通过事件解析BASE64
            var stringToBase64Arr = ["SqlWhere", "SqlJoin", "MoreBtns", "FormBtns", "ExportMoreBtns", "BatchSelectMoreBtns", "PageBtns", "PageTabs"];
            stringToBase64Arr.forEach((item) => {
                if (param[item]) {
                    param[item] = self.Base64.encode(param[item]);
                }
            });

            var realParam = {
                FormEngineKey: "Sys_Menu",
                Id: param.Id,
                _RowModel: { ...param }
            };

            self.DiyCommon.Post(self.DiyApi.FormEngine.AddFormData, realParam, function (result) {
                if (self.DiyCommon.Result(result)) {
                    self.DiyCommon.Tips(self.$t("Msg.Success"));
                    self.GetSysMenu();

                    //给管理员添加权限(李赛赛)
                    let param2 = {
                        Id: self.DiyCommon.NewGuid(),
                        FkId: param.Id,
                        Type: "Menu",
                        Permission: `["Add","Edit","Del","Export","Import"]`,
                        RoleId: "5db47859-35a3-411a-a1f7-99482e057d24"
                    };
                    let realParam2 = {
                        FormEngineKey: "Sys_RoleLimit",
                        Id: param2.Id,
                        _RowModel: { ...param2 }
                    };
                    self.DiyCommon.Post(self.DiyApi.FormEngine.AddFormData, realParam2);
                }
                self.BtnLoading = false;
            });
        },
        OpenQuickCreateTable() {
            var self = this;
            // 重置表单数据
            self.QuickCreateTableModel = {
                Name: "diy_",
                Description: ""
            };
            // 显示弹窗
            self.ShowQuickCreateTableDialog = true;
        },
        SaveQuickCreateTable() {
            var self = this;
            self.SaveQuickCreateTableLoading = true;

            var param = {
                ...self.QuickCreateTableModel
            };

            // 使用与 diy-table.vue 相同的保存逻辑
            var url = "/api/diytable/addDiyTable";

            self.DiyCommon.Post(url, param, async function (result) {
                self.SaveQuickCreateTableLoading = false;
                if (self.DiyCommon.Result(result)) {
                    self.DiyCommon.Tips(self.$t("Msg.Success"));
                    // 刷新表列表
                    await self.GetDiyTable();
                    // 关闭弹窗
                    self.ShowQuickCreateTableDialog = false;
                    // 默认选中刚创建的表
                    if (result.Data && result.Data.Id) {
                        self.CurrentSysMenuModel.DiyTableId = result.Data.Id;
                        // 重新初始化相关数据
                        self.TempJoinTables = [];
                        // 触发字段加载
                        self.DiyTableIdChange();
                    }
                }
            });
        },
        onDialogOpen(refName) {
            // this.$nextTick(() => {
            //   // 只提升当前弹窗
            //   let dialog = this.$refs[refName];
            //   if (dialog && dialog.$el) {
            //     let wrapper = dialog.$el.closest(".el-dialog__wrapper");
            //     if (wrapper) wrapper.style.zIndex = 1900;
            //   }
            //   3;
            //   // 提升下拉菜单z-index
            //   let dropdowns = document.querySelectorAll(".el-select-dropdown, .el-popper");
            //   dropdowns.forEach((drop) => {
            //     drop.style.zIndex = 3100;
            //   });
            // });
        },
        onDialogClose(refName) {
            // this.$nextTick(() => {
            //   // 只还原当前弹窗
            //   let dialog = this.$refs[refName];
            //   if (dialog && dialog.$el) {
            //     let wrapper = dialog.$el.closest(".el-dialog__wrapper");
            //     if (wrapper) wrapper.style.zIndex = "";
            //   }
            //   // 还原下拉菜单z-index
            //   let dropdowns = document.querySelectorAll(".el-select-dropdown, .el-popper");
            //   dropdowns.forEach((drop) => {
            //     drop.style.zIndex = "";
            //   });
            // });
        }
    }
};
</script>

<style lang="scss">
.sortable-ghost {
    opacity: 0.8;
    color: #fff !important;
    background: #42b983 !important;
}
.drag-select :deep(.sortable-ghost) {
    opacity: 0.8;
    color: #fff !important;
    background: #42b983 !important;
}

.drag-select :deep(.el-tag) {
    cursor: pointer;
}

.sysMenuFormIcon .avatar-uploader-icon {
    width: 50px !important;
    height: 50px !important;
    line-height: 50px !important;
}
.input-append-width-1 .el-input-group__append {
    width: 800px;
}
.quick-create {
    margin-left: 10px !important;
}

.el-select-dropdown,
.el-popper {
    z-index: 3000 !important;
}
</style>
