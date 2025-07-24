<template>
  <div id="diy-table" class="pluginPage">
    <el-row :gutter="20">
      <el-col :span="5" :xs="24">
        <el-card class="box-card">
          <div slot="header" class="clearfix">
            <span style="font-size: 14px"><i class="fas fa-sitemap mr-2"></i> 组织机构</span>
            <!-- <el-button style="float: right; padding: 3px 0" type="text">操作按钮</el-button> -->
          </div>
          <div class="text item" style="max-height: calc(100vh - 220px); overflow-y: scroll">
            <div class="hand" @click="AllDeptSearch" style="line-height: 26px; padding-left: 24px">全部</div>
            <el-tree
              :data="SysDeptList"
              :props="{
                children: '_Child',
                label: 'Name'
              }"
              @node-click="TreeDeptClick"
            ></el-tree>
          </div>
        </el-card>
      </el-col>
      <el-col :span="19" :xs="24">
        <el-card class="box-card no-padding-body">
          <el-form size="mini" :model="SearchModel" inline @submit.native.prevent class="keyword-search mr-2">
            <el-form-item :label="$t('Msg.Keyword')" size="mini">
              <el-input v-model="SearchModel.Keyword" @keyup.enter.native="GetSysRole(true)" />
            </el-form-item>
            <el-form-item size="mini">
              <el-button icon="el-icon-search" @click="GetSysRole(true)">{{ $t("Msg.Search") }}</el-button>
              <el-button type="primary" icon="el-icon-plus" @click="OpenSysRole()">{{ $t("Msg.Add") }}</el-button>
            </el-form-item>
          </el-form>
          <el-table v-loading="tableLoading" :data="SysRoleList" style="width: 100%" class="diy-table no-border-outside cell-br" stripe border>
            <el-table-column type="index" width="50" />
            <el-table-column :label="$t('Msg.Name')" width="180">
              <template slot-scope="scope">
                {{ scope.row.Name }}
              </template>
            </el-table-column>
            <el-table-column prop="Level" :label="$t('Msg.Level')" />
            <el-table-column prop="Remark" :label="$t('Msg.Remark')" />
            <el-table-column prop="CreateTime" :label="$t('Msg.CreateTime')" width="200" />
            <el-table-column fixed="right" :label="$t('Msg.Operation')" width="250">
              <template slot-scope="scope">
                <el-button type="default" size="mini" class="marginRight5" icon="el-icon-s-help" @click="OpenSysRole(scope.row)">{{ $t("Msg.Edit") }}</el-button>
                <el-button type="danger" size="mini" class="marginRight5" icon="el-icon-delete" @click="DelSysRole(scope.row)">{{ $t("Msg.Del") }}</el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-pagination
            style="margin-top: 10px; float: left; margin-bottom: 10px; clear: both"
            background
            layout="total, sizes, prev, pager, next, jumper"
            :total="SysRoleCount"
            :page-size="PageSize"
            @size-change="SizeChange"
            @current-change="CurrentChange"
          />
        </el-card>
      </el-col>
    </el-row>
    <el-dialog v-el-drag-dialog :width="'75%'" :modal-append-to-body="false" :visible.sync="ShowEditModel" :title="ShowEditModelTitle" :close-on-click-modal="false">
      <el-form size="mini" :model="CurrentSysRoleModel" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12" :xs="24">
            <el-form-item :label="$t('Msg.Name')" size="mini">
              <el-input v-model="CurrentSysRoleModel.Name" />
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24">
            <el-form-item :label="$t('Msg.Level')" size="mini">
              <el-input v-model="CurrentSysRoleModel.Level" />
            </el-form-item>
          </el-col>
          <el-col :span="24" :xs="24">
            <el-form-item :label="$t('Msg.BaseLimit')" size="mini">
              <el-checkbox-group v-model="CurrentSysRoleModel.BaseLimit" size="mini">
                <el-checkbox :label="'Add'" border>{{ $t("Msg.Add") }}</el-checkbox>
                <el-checkbox :label="'Del'" border>
                  {{ $t("Msg.Del") }}
                </el-checkbox>
                <el-checkbox :label="'Edit'" border>
                  {{ $t("Msg.Edit") }}
                </el-checkbox>
                <!-- <el-checkbox
                                :label="$t('Msg.Query')"
                                :true-label="'Query'"
                                border /> -->
                <el-checkbox :label="'Special'" border>
                  {{ $t("Msg.Special") }}
                </el-checkbox>
                <el-checkbox :label="'OnlyGet'" border> 仅查询 </el-checkbox>
              </el-checkbox-group>
              <p class="help-block">特殊：如物理删除、发送验证码等。</p>
            </el-form-item>
          </el-col>
          <el-col :span="24" :xs="24">
            <el-form-item :label="'组织机构'" size="mini">
              <el-cascader
                clearable
                v-model="CurrentSysRoleModel.DeptIds"
                :options="SysDeptListJainZhi"
                :props="{
                  value: 'Id',
                  label: 'Name',
                  children: '_Child',
                  multiple: true,
                  checkStrictly: true
                }"
              ></el-cascader>
            </el-form-item>
          </el-col>
          <el-col :span="24" :xs="24">
            <el-form-item :label="$t('Msg.Remark')" size="mini">
              <el-input v-model="CurrentSysRoleModel.Remark" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
          <el-col :span="24" :xs="24">
            <el-form-item label="权限明细" size="mini">
              <el-table
                v-loading="tableLoading"
                :data="SysMenuList"
                row-key="Id"
                :tree-props="{ children: '_Child' }"
                class="diy-table table-sysmenu table-sysmenu-roles cell-br"
                style="width: 100%"
                stripe
                border
              >
                <el-table-column label="名称" width="250">
                  <template slot-scope="scope">
                    <span
                      :style="{
                        marginLeft: (DiyCommon.IsNull(scope.row._Child) || scope.row._Child.length == 0) && scope.row.ParentId == DiyCommon.GuidEmpty ? '23px' : '0px'
                      }"
                    >
                      <el-checkbox
                        v-model="scope.row._Check"
                        @change="
                          (val) => {
                            return NameChange(val, scope.row);
                          }
                        "
                      >
                        <i :class="DiyCommon.IsNull(scope.row.IconClass) ? 'icon mr-2' : 'icon  mr-2 ' + scope.row.IconClass"></i>
                        {{ DiyCommon.IsNull(scope.row.Name) ? scope.row.EnName : scope.row.Name }}
                      </el-checkbox>
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="权限">
                  <template slot-scope="scope">
                    <el-checkbox-group v-model="scope.row.Permission">
                      <el-checkbox
                        label="Add"
                        @change="
                          (val) => {
                            return BtnChange(val, scope.row, 'Add');
                          }
                        "
                        >{{ $t("Msg.Add") }}</el-checkbox
                      >
                      <el-checkbox
                        label="Edit"
                        @change="
                          (val) => {
                            return BtnChange(val, scope.row, 'Edit');
                          }
                        "
                        >{{ $t("Msg.Edit") }}</el-checkbox
                      >
                      <el-checkbox
                        label="Del"
                        @change="
                          (val) => {
                            return BtnChange(val, scope.row, 'Del');
                          }
                        "
                        >{{ $t("Msg.Del") }}</el-checkbox
                      >
                      <el-checkbox
                        label="Import"
                        @change="
                          (val) => {
                            return BtnChange(val, scope.row, 'Import');
                          }
                        "
                        >{{ $t("Msg.Import") }}</el-checkbox
                      >
                      <el-checkbox
                        label="Export"
                        @change="
                          (val) => {
                            return BtnChange(val, scope.row, 'Export');
                          }
                        "
                        >{{ $t("Msg.Export") }}</el-checkbox
                      >
                      <el-checkbox
                        label="NoDetail"
                        @change="
                          (val) => {
                            return BtnChange(val, scope.row, 'NoDetail');
                          }
                        "
                        >无{{ $t("Msg.Detail") }}</el-checkbox
                      >
                      <el-checkbox
                        label="NoSearch"
                        @change="
                          (val) => {
                            return BtnChange(val, scope.row, 'NoSearch');
                          }
                        "
                        >无{{ $t("Msg.Search") }}</el-checkbox
                      >

                      <el-checkbox v-for="(btn, btnI) in scope.row.MoreBtns" :key="'btni' + btnI + btn.Id" :label="btn.Id">{{ btn.Name }}</el-checkbox>
                      <el-checkbox v-for="(btn, btnI) in scope.row.ExportMoreBtns" :key="'btni' + btnI + btn.Id" :label="btn.Id">{{ btn.Name }}</el-checkbox>
                      <el-checkbox v-for="(btn, btnI) in scope.row.BatchSelectMoreBtns" :key="'btni' + btnI + btn.Id" :label="btn.Id">{{ btn.Name }}</el-checkbox>
                      <el-checkbox v-for="(btn, btnI) in scope.row.PageBtns" :key="'btni' + btnI + btn.Id" :label="btn.Id">{{ btn.Name }}</el-checkbox>
                      <el-checkbox v-for="(btn, btnI) in scope.row.PageTabs" :key="'btni' + btnI + btn.Id" :label="btn.Id">{{ btn.Name }}</el-checkbox>
                      <el-checkbox v-for="(btn, btnI) in scope.row.FormBtns" :key="'btni' + btnI + btn.Id" :label="btn.Id">{{ btn.Name }}</el-checkbox>
                    </el-checkbox-group>
                  </template>
                </el-table-column>
              </el-table>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <span slot="footer" class="dialog-footer">
        <el-button :loading="BtnLoading" type="primary" size="mini" icon="el-icon-s-help" @click="SaveSysRole">{{ $t("Msg.Save") }}</el-button>
        <el-button size="mini" icon="el-icon-close" @click="ShowEditModel = false">{{ $t("Msg.Cancel") }}</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
// import DiyStore from '@/store/diy.store'
import elDragDialog from "@/directive/el-drag-dialog";
import _ from "underscore";
import { mapState } from "vuex";
export default {
  name: "sys_role",
  directives: {
    elDragDialog
  },
  computed: {
    GetCurrentUser: function () {
      return this.$store.getters["DiyStore/GetCurrentUser"];
    },
    ...mapState({
      // OsClient: state => DiyStore.state.OsClient
    })
  },
  data() {
    return {
      BtnLoading: false,
      tableLoading: true,
      ShowEditModelTitle: "",
      ShowEditModel: false,
      SearchModel: {
        Keyword: "",
        RoleIds: [],
        DeptId: ""
      },
      SysRoleCount: 0,

      LoadingCount: 0,
      tabActiveName: "tabInfo",
      selectedOptions: [],
      ActiveLeftMenu: {},
      LeftMenuHide: false,
      SysBaseDataList: [],
      OpenBizUserModel: {},
      Table1: {},
      PageIndex: 1,
      PageSize: 10,
      Keyword: "",
      zTree: {},
      CurrentSysRoleModel: {
        DeptIds: [],
        BaseLimit: []
      },
      SysRoleList: [],
      SysDeptList: [],
      SysDeptListJainZhi: [],

      sysMenuTreeProps: {
        children: "_Child",
        label: "Name"
      },
      SysMenuList: []
    };
  },
  mounted() {
    var self = this;
    // self.GetSysUser(true)
    // self.GetSysRole();
    // self.GetSysDept();
    self.Init();
  },
  methods: {
    Init() {
      var self = this;
      // self.DiyCommon.SetWin10Loading(false)
      // self.ActiveLeftMenu = self.leftMenulist[0]
      self.GetSysRole();
      self.GetSysMenu();
      self.GetSysDept();
      // self.$nextTick(function () {
      //     //self.FastClick.attach(document.querySelector('.layx-window'))
      // })
    },
    BtnChange(val, row, type) {
      var self = this;
      self.ForBtnChange(val, row, type);
    },
    ForBtnChange(val, row, type) {
      var self = this;
      if (val) {
        row._Check = true;
        //递归选中子级的此权限
        if (row._Child) {
          row._Child.forEach((childRow) => {
            childRow._Check = true;
            if (!(childRow.Permission.indexOf(type) > -1)) {
              childRow.Permission.push(type);
            }
            self.ForBtnChange(val, childRow, type);
          });
        }
        //递归选中上级的主菜单
        self.SysMenuList.forEach((parentRow) => {
          if (parentRow._Child && parentRow._Child) {
            if (_.where(parentRow._Child, { Id: row.Id }).length > 0) {
              parentRow._Check = true;
              return;
            }
            //此递归比较特殊，需要传入Arr
            self.ForBtnParentChange(parentRow._Child, row, [parentRow]);
          }
        });
      } else {
        //递归取消子级的此权限
        if (row._Child) {
          row._Child.forEach((childRow) => {
            childRow._Check = true;
            if (childRow.Permission.indexOf(type) > -1) {
              for (let index = 0; index < childRow.Permission.length; index++) {
                if (childRow.Permission[index] == type) {
                  childRow.Permission.splice(index, 1);
                }
              }
            }
            self.ForBtnChange(val, childRow, type);
          });
        }
      }
    },
    ForBtnParentChange(allList, row, parentRowArr) {
      var self = this;
      //递归选中上级的主菜单
      allList.forEach((parentRow) => {
        if (parentRow._Child && parentRow._Child) {
          if (_.where(parentRow._Child, { Id: row.Id }).length > 0) {
            parentRow._Check = true;
            parentRowArr.forEach((tmpParentRow) => {
              tmpParentRow._Check = true;
            });
            return;
          }
          parentRowArr.push(parentRow);
          self.ForBtnParentChange(parentRow._Child, row, parentRowArr);
        }
      });
    },

    NameChange(val, row) {
      var self = this;
      self.ForNameChange(val, row);
    },
    ForNameChange(val, row) {
      var self = this;
      var moreBtns = ["MoreBtns", "ExportMoreBtns", "BatchSelectMoreBtns", "PageBtns", "PageTabs", "FormBtns"];
      if (val) {
        // 1. 默认权限
        var newPermission = ["Add", "Edit", "Del", "Export", "Import"];
        // 2. 当前节点自定义按钮
        moreBtns.forEach((btnKey) => {
          if (row[btnKey] && Array.isArray(row[btnKey])) {
            row[btnKey].forEach((btnModel) => {
              if (btnModel && btnModel.Id && newPermission.indexOf(btnModel.Id) === -1) {
                newPermission.push(btnModel.Id);
              }
            });
          }
        });
        row.Permission = newPermission;
        // 3. 递归处理所有子节点
        if (row._Child) {
          row._Child.forEach((childRow) => {
            childRow._Check = true;
            self.ForNameChange(val, childRow); // 递归对子节点做同样处理
          });
        }
      } else {
        row.Permission = [];
        if (row._Child) {
          row._Child.forEach((childRow) => {
            childRow._Check = false;
            self.ForNameChange(val, childRow);
          });
        }
      }
    },

    TreeDeptClick(data) {
      var self = this;
      self.SearchModel.DeptId = data.Id;
      self.GetSysRole(true);
    },
    AllDeptSearch() {
      var self = this;
      self.SearchModel.DeptId = "";
      self.GetSysRole(true);
    },
    DeptChange(value) {
      var self = this;
      // self.SysDeptListJainZhi.forEach(element => {
      //     element.disabled = false;
      // });
      //if (value.length > 0) {
      // var tempArr = [...self.SysDeptListJainZhi];
      // tempArr.forEach(element => {
      //     if(element.Id == value[0]){
      //         element.disabled = true;
      //     }
      // });
      // self.SysDeptListJainZhi = tempArr;

      //兼职机构是否已经勾选了组织机构
      // var isHave = false;
      // self.CurrentSysRoleModel.DeptIds.forEach(elementArr => {
      //     if (elementArr == value){
      //         isHave = true;
      //     }
      // });
      // var tempDeptIds = [...self.CurrentSysRoleModel.DeptIds];
      // if (!isHave) {
      //     tempDeptIds.push(value);
      // }
      // self.CurrentSysRoleModel.DeptIds = tempDeptIds;
      //}
    },
    ImgUploadSuccess(result, file, fileList) {
      var self = this;
      if (self.DiyCommon.Result(result)) {
        self.$set(self.CurrentSysRoleModel, "Avatar", result.Data.Path);
        self.DiyCommon.Tips(self.$t("Msg.UploadSuccess"));
      }
    },
    UploadImgBefore: function (file) {
      var self = this;
      const isJPG =
        file.type === "image/jpeg" ||
        file.type === "image/png" ||
        file.type === "image/bmp" ||
        file.type === "image/svg" ||
        file.type.toLowerCase().indexOf("icon") > -1 ||
        file.type.toLowerCase().indexOf("ico") > -1 ||
        file.type === "image/gif";

      const isLtMax = file.size / 1024 / 1024 < self.DiyCommon.UploadImgMaxSize;
      if (!isJPG) {
        self.DiyCommon.Tips(self.$t("Msg.FormatError") + file.type, false);
        return false;
      }
      if (!isLtMax) {
        self.DiyCommon.Tips(self.$t("Msg.MaxSize") + self.DiyCommon.UploadImgMaxSize + "MB!", false);
        return false;
      }
      self.DiyCommon.Tips(self.$t("Msg.Uploading"));
      var result = isJPG && isLtMax;
      if (result) {
      }
      return result;
    },
    GetSysDept() {
      var self = this;
      self.DiyCommon.Post(self.DiyApi.GetSysDeptStep, {}, function (result) {
        if (self.DiyCommon.Result(result)) {
          self.SysDeptList = result.Data;
          result.Data.forEach((element) => {
            element.disabled = false;
          });
          self.SysDeptListJainZhi = result.Data;
        }
      });
    },
    CurrentChange(val) {
      var self = this;
      self.PageIndex = val;
      self.GetSysRole();
    },
    SizeChange(val) {
      var self = this;
      self.PageSize = val;
      self.PageIndex = 1;
      self.GetSysRole(true);
    },

    GetSysMenu() {
      var self = this;
      // self.LoadingCount++;
      self.tableLoading = true;
      // self.DiyCommon.Post(self.DiyApi.GetSysMenuStep(), {
      //这里需要返回按钮的数据，以做权限配置
      self.DiyCommon.Post(
        self.DiyApi.GetDiyTableRowTree,
        {
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
            "Sort",
            "MoreBtns",
            "FormBtns",
            "ExportMoreBtns",
            "BatchSelectMoreBtns",
            "PageBtns",
            "PageTabs"
          ],
          // OsClient: self.OsClient,
          TableName: "Sys_Menu",
          _OrderBy: "Sort",
          _OrderByType: "ASC",
          _All: true,
          _TreeLazy: 0
        },
        function (result) {
          // self.LoadingCount--;
          if (self.DiyCommon.Result(result)) {
            self.ForSysMenuList(result.Data);

            result.Data.forEach((element) => {
              self.DiyCommon.ForConvertSysMenu(element);
            });

            self.SysMenuList = result.Data;
          }
          self.tableLoading = false;
        }
      );
    },
    ForSysMenuList(sysMenuList) {
      var self = this;
      sysMenuList.forEach((element) => {
        element._Check = false;
        element.Permission = [];
        // if (!self.DiyCommon.IsNull(element.Permission)) {
        //     if (!Array.isArray(element.Permission)) {
        //         self.$set(element, 'Permission', JSON.parse(element.Permission));
        //     }
        // }else{
        //     self.$set(element, 'Permission', []);
        // }
        if (!self.DiyCommon.IsNull(element._Child) && element._Child.length > 0) {
          self.ForSysMenuList(element._Child);
        }
      });
    },
    DelSysRole(m) {
      var self = this;
      self.DiyCommon.OsConfirm(self.$t("Msg.ConfirmDelTo") + "【" + m.Name + "】？", function () {
        self.DiyCommon.Post(
          self.DiyApi.DelSysRole(),
          {
            Id: m.Id
          },
          function (result) {
            if (self.DiyCommon.Result(result)) {
              self.DiyCommon.Tips(self.$t("Msg.Success"));
              self.GetSysRole();
            }
          }
        );
      });
    },
    //注意：menuIds，后来改成了 SysRoleLimits
    // ForSetSysMenuListCheck(sysMenuList, menuIds, checked) {
    ForSetSysMenuListCheck(sysMenuList, sysRoleLimits, checked) {
      var self = this;
      for (let index = 0; index < sysMenuList.length; index++) {
        var element = sysMenuList[index];
        // if (element.Id == menuId) {
        // if (menuIds.indexOf(element.Id) > -1) {
        var tempArr = _.where(sysRoleLimits, { Id: element.Id });
        if (tempArr.length > 0) {
          //选中菜单
          element._Check = checked;
          if (!self.DiyCommon.IsNull(tempArr[0].Permission)) {
            //选中细粒度权限按钮
            element.Permission = JSON.parse(tempArr[0].Permission);
          }
        }
        if (!self.DiyCommon.IsNull(element._Child) && element._Child.length > 0) {
          // self.ForSetSysMenuListCheck(element._Child, menuIds, checked);
          self.ForSetSysMenuListCheck(element._Child, sysRoleLimits, checked);
        }
      }
    },
    ForGetSysMenuListCheck(sysMenuList) {
      var self = this;
      var result = [];
      var defaultRoleTypes = ["Add", "Edit", "Del", "Export", "Import", "NoDetail", "NoSearch"];
      for (let index = 0; index < sysMenuList.length; index++) {
        var sysMenu = sysMenuList[index];
        if (sysMenu._Check == true) {
          // result.push(sysMenu.Id);
          //2023-03-11新增：根据BtnId查出Name，也存储一下
          //2023-04-14修复bug：
          var _permission = [];
          var allBtns = ["MoreBtns", "ExportMoreBtns", "BatchSelectMoreBtns", "PageBtns", "PageTabs", "FormBtns"];
          sysMenu.Permission.forEach((btnId) => {
            //这里的btnId也可能不是Id，可能是按钮名称、Add、Del等。
            if (defaultRoleTypes.indexOf(btnId) > -1) {
              _permission.push(btnId);
            }
            allBtns.forEach((btnClass) => {
              var findModel = _.where(sysMenu[btnClass], { Id: btnId });
              if (findModel.length > 0 && !(_permission.indexOf(findModel[0].Name) > -1)) {
                _permission.push(findModel[0].Id);
                _permission.push(findModel[0].Name);
              }
            });
          });
          result.push({
            Id: sysMenu.Id,
            Permission: JSON.stringify(_permission)
          });
        }
        if (!self.DiyCommon.IsNull(sysMenu._Child) && sysMenu._Child.length > 0) {
          var tmpResult = self.ForGetSysMenuListCheck(sysMenu._Child);
          tmpResult.forEach((tmpSysMenu) => {
            result.push({
              Id: tmpSysMenu.Id,
              Permission: tmpSysMenu.Permission
            });
          });
        }
      }
      return result;
    },
    OpenSysRole(m) {
      var self = this;
      var title = self.$t("Msg.Add");
      //先要清除所有选中
      self.ForSysMenuList(self.SysMenuList);
      var url = self.DiyApi.UptSysRole();
      if (self.DiyCommon.IsNull(m)) {
        url = self.DiyApi.AddSysRole();
        self.CurrentSysRoleModel = {
          DeptIds: [],
          BaseLimit: []
        };
      } else {
        title = m.Name;
        // self.CurrentSysRoleModel = m
        // self.LoadingCount++;
        self.DiyCommon.Post(
          self.DiyApi.GetSysRoleModel(),
          {
            Id: m.Id
          },
          function (result1) {
            if (self.DiyCommon.Result(result1)) {
              if (self.DiyCommon.IsNull(result1.Data.BaseLimit)) {
                result1.Data.BaseLimit = [];
              } else {
                result1.Data.BaseLimit = JSON.parse(result1.Data.BaseLimit);
              }
              if (self.DiyCommon.IsNull(result1.Data.DeptIds)) {
                result1.Data.DeptIds = [];
              } else {
                result1.Data.DeptIds = JSON.parse(result1.Data.DeptIds);
              }
              if (!self.DiyCommon.IsNull(result1.Data.SysRoleLimits)) {
                self.ForSetSysMenuListCheck(self.SysMenuList, result1.Data.SysRoleLimits, true);
              }
              self.CurrentSysRoleModel = result1.Data;
            }
          }
        );
      }
      self.ShowEditModel = true;
    },
    GetSysRole(initPageIndex) {
      var self = this;
      if (initPageIndex === true) {
        self.PageIndex = 1;
      }
      self.tableLoading = true;
      self.DiyCommon.Post(
        self.DiyApi.GetSysRole(),
        {
          _Keyword: self.SearchModel.Keyword,
          _DeptId: self.SearchModel.DeptId,
          _PageSize: self.PageSize,
          _PageIndex: self.PageIndex
        },
        function (result) {
          self.tableLoading = false;
          if (self.DiyCommon.Result(result)) {
            self.SysRoleList = result.Data;
            self.SysRoleCount = result.DataCount;
          }
        }
      );
    },
    SaveSysRole() {
      var self = this;
      self.BtnLoading = true;
      var param = { ...self.CurrentSysRoleModel };
      //SysRoleLimits格式：[{FkId:'xxxx-xxxx',Permission:"['Add', 'Edit', 'xxxx-xxxx']"}]
      //说明：FkId[就是SysMenuId]；Permission：为细粒度权限JSON.stringify后的值
      param.SysRoleLimits = self.ForGetSysMenuListCheck(self.SysMenuList);

      var paramType = "json";
      var url = "/api/SysRole/UptSysRoleFromBody"; //UptSysRole
      if (self.DiyCommon.IsNull(self.CurrentSysRoleModel.Id)) {
        url = "/api/SysRole/AddSysRoleFromBody"; //AddSysRole
      }
      param._Test = { Key: "aaa", Value: "bbb" };
      self.DiyCommon.Post(
        url,
        param,
        function (result) {
          self.BtnLoading = false;
          if (self.DiyCommon.Result(result)) {
            self.DiyCommon.Tips(self.$t("Msg.Success"));
            self.GetSysRole();
            self.ShowEditModel = false;
          }
        },
        null,
        {},
        paramType
      );
    }
  }
};
</script>

<style lang="scss">
.avatar-uploader .el-upload {
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}
.avatar-uploader .el-upload:hover {
  border-color: #409eff;
}
.avatar-uploader-icon {
  font-size: 28px;
  color: #8c939d;
  width: 100px;
  height: 100px;
  line-height: 100px;
  text-align: center;
}
.avatar {
  width: 100px;
  height: 100px;
  display: block;
}

.el-table.table-sysmenu-roles {
  .cell {
    white-space: normal;
  }
}
#divTzyCourseManage .rowAttachments .el-upload {
  display: block;
}

#divTzyCourseManage .rowAttachments .el-upload__tip {
  text-align: center;
}

#divTzyCourseManage .rowAttachments .col-md-3 {
  margin-bottom: 10px;
}

.avatar-uploader .el-upload {
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.avatar-uploader .el-upload:hover {
  border-color: #409eff;
}
</style>
