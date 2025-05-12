<template>
  <div id="diy-table" class="pluginPage">
    <el-row :gutter="20">
      <el-col :span="5" :xs="24">
        <el-card class="box-card">
          <div slot="header" class="clearfix">
            <span style="font-size: 14px"
              ><i class="fas fa-sitemap mr-2"></i> 组织机构</span
            >
            <!-- <el-button style="float: right; padding: 3px 0" type="text">操作按钮</el-button> -->
          </div>
          <div
            class="text item"
            style="max-height: calc(100vh - 220px); overflow-y: scroll"
          >
            <div
              class="hand"
              @click="AllDeptSearch"
              style="line-height: 26px; padding-left: 24px"
            >
              全部
            </div>
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
          <el-form
            size="mini"
            :model="SearchModel"
            inline
            @submit.native.prevent
            class="keyword-search mr-2"
          >
            <el-form-item size="mini">
              <el-button
                type="primary"
                icon="el-icon-plus"
                @click="OpenSysUser()"
                >{{ $t("Msg.Add") }}</el-button
              >
            </el-form-item>
            <el-form-item size="mini">
              <el-input
                v-model="SearchModel.Keyword"
                @input="GetSysUser(true)"
                :placeholder="$t('Msg.Keyword')"
                class="input-left-borderbg"
                style="margin-top: 1px"
              >
                <el-button
                  slot="append"
                  icon="el-icon-search"
                  @click="GetSysUser(true)"
                ></el-button>
              </el-input>
            </el-form-item>
            <el-form-item :label="$t('Msg.Role')" size="mini">
              <el-select
                v-model="SearchModel.RoleIds"
                clearable
                filterable
                multiple
                placeholder=""
                value-key="Id"
                size="mini"
              >
                <el-option
                  v-for="item in SysRoleList"
                  :key="item.Id"
                  :label="item.Name"
                  :value="item.Id"
                />
              </el-select>
            </el-form-item>
            <el-form-item :label="$t('Msg.State')" size="mini">
              <el-select v-model="SearchModel.State" placeholder="" size="mini">
                <el-option label="全部" :value="''" />
                <el-option label="启用" :value="1" />
                <el-option label="停用" :value="2" />
              </el-select>
            </el-form-item>
            <el-form-item size="mini">
              <el-dropdown trigger="click" @command="ChangeDataViewType">
                <el-button type="primary">
                  切换视图<i class="el-icon-arrow-down el-icon--right"></i>
                </el-button>
                <el-dropdown-menu slot="dropdown" class="dropdown-big-button">
                  <el-dropdown-item command="Card">
                    <i class="icon el-icon-postcard mr-1"></i>
                    卡片形式</el-dropdown-item
                  >
                  <el-dropdown-item command="Table">
                    <i class="icon el-icon-s-grid mr-1"></i>
                    表格形式</el-dropdown-item
                  >
                </el-dropdown-menu>
              </el-dropdown>
            </el-form-item>
          </el-form>
          <template v-if="DataViewType == 'Table'">
            <el-table
              v-loading="tableLoading"
              :data="SysUserList"
              style="width: 100%"
              class="diy-table no-border-outside"
              stripe
              border
            >
              <el-table-column type="index" width="50" />
              <el-table-column :label="$t('Msg.Account')" width="150">
                <template slot-scope="scope">
                  <span :title="scope.row.Account">{{
                    scope.row.Account
                  }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="Name" width="150" :label="$t('Msg.Name')">
                <template slot-scope="scope">
                  <span :title="scope.row.Name">{{ scope.row.Name }}</span>
                </template>
              </el-table-column>
              <el-table-column
                prop="Phone"
                width="100"
                :label="$t('Msg.Phone')"
              >
                <template slot-scope="scope">
                  <span :title="scope.row.Phone">{{ scope.row.Phone }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="Level" :label="$t('Msg.Level')" />
              <el-table-column prop="DeptName" :label="'组织机构'">
                <template slot-scope="scope">
                  <span :title="scope.row.DeptName">{{
                    scope.row.DeptName
                  }}</span>
                </template>
              </el-table-column>
              <el-table-column width="300" :label="$t('Msg.Role')">
                <template slot-scope="scope">
                  <span :title="GetRolesStr(scope.row._Roles)">{{
                    GetRolesStr(scope.row._Roles)
                  }}</span>
                </template>
              </el-table-column>
              <el-table-column :label="$t('Msg.State')">
                <template slot-scope="scope">
                  {{ scope.row.State == 1 ? "启用" : "停用" }}
                </template>
              </el-table-column>
              <el-table-column
                prop="CreateTime"
                :label="$t('Msg.CreateTime')"
                width="200"
              />
              <el-table-column
                fixed="right"
                :label="$t('Msg.Operation')"
                width="180"
              >
                <template slot-scope="scope">
                  <el-button
                    type="text"
                    size="mini"
                    class="marginRight5"
                    icon="el-icon-s-help"
                    @click="OpenSysUser(scope.row)"
                    >{{ $t("Msg.Edit") }}</el-button
                  >
                  <el-button
                    type="text"
                    size="mini"
                    class="marginRight5"
                    icon="el-icon-chat-dot-round"
                    @click="$root.OpenDiyChat(scope.row)"
                    >{{ "微聊" }}</el-button
                  >
                  <el-button
                    type="text"
                    size="mini"
                    class="marginRight5"
                    icon="el-icon-s-help"
                    @click="DelSysUser(scope.row)"
                    >{{ $t("Msg.Del") }}</el-button
                  >
                </template>
              </el-table-column>
            </el-table>
            <el-pagination
              style="
                margin-top: 20px;
                float: left;
                margin-bottom: 10px;
                clear: both;
              "
              background
              layout="total, sizes, prev, pager, next, jumper"
              :total="SysUserCount"
              :page-size="SysUserPageSize"
              :page-sizes="[8, 12, 16, 20, 28, 36, 48, 100]"
              @size-change="SysUserSizeChange"
              @current-change="SysUserCurrentChange"
            />
          </template>
        </el-card>
        <template v-if="DataViewType == 'Card'">
          <el-row :gutter="20">
            <el-skeleton style="width: 100%" :loading="tableLoading" animated>
              <template slot="template">
                <el-col
                  :xs="24"
                  :span="6"
                  v-for="(model, index) in EmptyData"
                  :key="model.Id"
                  style="margin-top: 20px"
                >
                  <el-card class="box-card card-data-animate">
                    <div slot="header">
                      <el-skeleton-item variant="text" style="width: 100%" />
                    </div>
                    <div class="item">
                      <el-skeleton-item />
                    </div>
                    <div class="item">
                      <el-skeleton-item />
                    </div>
                    <div class="bottom-time">
                      <el-skeleton-item variant="text" style="width: 100%" />
                    </div>
                  </el-card>
                </el-col>
              </template>
              <el-col
                :xs="24"
                :span="6"
                v-for="(model, index) in SysUserList"
                :key="model.Id"
                style="margin-top: 20px"
              >
                <el-card class="box-card card-data-animate">
                  <div slot="header">
                    <div>
                      <div class="pull-left marginRight5">
                        <el-avatar
                          class="sys-user-avatar"
                          :size="28"
                          :src="GetUserAvatar(model)"
                        ></el-avatar>
                      </div>
                      <div class="pull-left marginRight5 title">
                        {{ model.Name }}
                      </div>
                      <div class="pull-left">
                        <el-tag>Lv.{{ model.Level }}</el-tag>
                      </div>
                    </div>
                    <div style="float: right">
                      <el-button
                        type="text"
                        size="mini"
                        class="marginRight5"
                        icon="el-icon-s-help"
                        @click="OpenSysUser(model)"
                        >{{ $t("Msg.Edit") }}</el-button
                      >
                      <el-dropdown trigger="click">
                        <el-button type="text">
                          {{ $t("Msg.More")
                          }}<i class="el-icon-arrow-down el-icon--right" />
                        </el-button>
                        <el-dropdown-menu
                          slot="dropdown"
                          class="table-more-btn"
                        >
                          <el-dropdown-item
                            icon="el-icon-chat-dot-round"
                            @click.native="$root.OpenDiyChat(model)"
                          >
                            {{ "消息" }}
                          </el-dropdown-item>
                          <el-dropdown-item
                            icon="el-icon-delete"
                            divided
                            @click.native="DelSysUser(model)"
                          >
                            {{ $t("Msg.Delete") }}
                          </el-dropdown-item>
                        </el-dropdown-menu>
                      </el-dropdown>
                    </div>
                  </div>
                  <div class="item clear">
                    <i class="el-icon-user-solid"></i> {{ model.Account }}
                    <i
                      class="el-icon-mobile-phone"
                      style="margin-left: 10px"
                    ></i>
                    {{ model.Phone }}
                    <i class="el-icon-open" style="margin-left: 10px"></i>
                    {{ model.State == 1 ? "启用" : "停用" }}
                  </div>
                  <div class="item" style="padding-top: 3px">
                    <el-tag class="marginRight10">
                      <div class="over-hide no-br">{{ model.DeptName }}</div>
                    </el-tag>
                    <el-tooltip
                      v-if="GetRolesStr(model._Roles)"
                      effect="dark"
                      :content="GetRolesStr(model._Roles)"
                      placement="top"
                    >
                      <el-tag>
                        <div style="max-width: 150px" class="over-hide no-br">
                          {{ GetRolesStr(model._Roles) }}
                        </div>
                      </el-tag>
                    </el-tooltip>
                  </div>
                  <div class="bottom-time">
                    <i class="el-icon-time"></i> {{ model.CreateTime }}
                  </div>
                </el-card>
              </el-col>
            </el-skeleton>
          </el-row>
          <el-row>
            <el-col :span="24">
              <el-pagination
                style="
                  margin-top: 20px;
                  float: left;
                  margin-bottom: 10px;
                  clear: both;
                "
                background
                layout="total, sizes, prev, pager, next, jumper"
                :total="SysUserCount"
                :page-size="SysUserPageSize"
                :page-sizes="[8, 12, 16, 20, 28, 36, 48, 100]"
                @size-change="SysUserSizeChange"
                @current-change="SysUserCurrentChange"
              />
            </el-col>
          </el-row>
        </template>
      </el-col>
    </el-row>

    <!-- <el-row
     id="openSysUserModel"
     class="dialog-model"
     style="display:none;">
        <el-col :span="24">
            <el-form
                size="mini"
                :model="CurrentSysUserModel"
                >
                <el-form-item
                    label="表名"
                    size="mini">
                    <el-input v-model="CurrentSysUserModel.Name" />
                </el-form-item>
                <el-form-item
                    label="描述"
                    size="mini">
                    <el-input v-model="CurrentSysUserModel.Description" />
                </el-form-item>
            </el-form>
        </el-col>
    </el-row> -->
    <el-dialog
      v-el-drag-dialog
      width="700px"
      :modal-append-to-body="false"
      :visible.sync="ShowEditModel"
      :title="ShowEditModelTitle"
      :close-on-click-modal="false"
    >
      <el-form size="mini" :model="CurrentSysUserModel" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="24" :xs="24">
            <el-form-item :label="$t('Msg.Avatar')" size="mini">
              <el-upload
                :action="DiyApi.Upload()"
                :data="{ Path: '/avatar', Limit: false }"
                :headers="{
                  authorization: 'Bearer ' + DiyCommon.Authorization()
                }"
                class="avatar-uploader"
                :show-file-list="false"
                :on-success="ImgUploadSuccess"
                :before-upload="UploadImgBefore"
              >
                <img
                  v-if="!DiyCommon.IsNull(CurrentSysUserModel.Avatar)"
                  :src="DiyCommon.GetServerPath(CurrentSysUserModel.Avatar)"
                  class="avatar"
                  style="object-fit: cover"
                />
                <i v-else class="el-icon-plus avatar-uploader-icon"></i>
              </el-upload>
            </el-form-item>
          </el-col>
          <el-col :span="24" :xs="24">
            <el-form-item :label="$t('Msg.LoginAccount')" size="mini">
              <el-input v-model="CurrentSysUserModel.Account" />
            </el-form-item>
          </el-col>
          <el-col :span="16" :xs="24">
            <el-form-item :label="$t('Msg.Pwd')" size="mini">
              <el-input v-model="CurrentSysUserModel.Pwd" />
            </el-form-item>
          </el-col>
          <el-col
            :span="8"
            :xs="24"
            v-if="
              GetCurrentUser._IsAdmin === true &&
              !DiyCommon.IsNull(CurrentSysUserModel.Id)
            "
          >
            <el-form-item size="mini">
              <el-button type="primary" @click="GetSysUserPassword"
                >获取密码</el-button
              >
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24">
            <el-form-item :label="$t('Msg.FullName')" size="mini">
              <el-input v-model="CurrentSysUserModel.Name" />
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24">
            <el-form-item :label="$t('Msg.Sex')" size="mini">
              <el-radio-group v-model="CurrentSysUserModel.Sex">
                <el-radio :label="'男'">男</el-radio>
                <el-radio :label="'女'">女</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24">
            <el-form-item :label="$t('Msg.Phone')" size="mini">
              <el-input v-model="CurrentSysUserModel.Phone" />
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24">
            <el-form-item :label="$t('Msg.Email')" size="mini">
              <el-input v-model="CurrentSysUserModel.Email" />
            </el-form-item>
          </el-col>
          <el-col :span="24" :xs="24">
            <el-form-item :label="'组织机构'" size="mini">
              <el-cascader
                style="width: 100%"
                clearable
                v-model="CurrentSysUserModel.DeptId"
                :options="SysDeptList"
                :props="{
                  value: 'Id',
                  label: 'Name',
                  children: '_Child',
                  checkStrictly: true,
                  emitPath: false
                }"
                @change="DeptChange"
              ></el-cascader>
            </el-form-item>
          </el-col>
          <el-col :span="24" :xs="24">
            <el-form-item :label="'组织机构代码'" size="mini">
              <el-input
                readonly
                disabled
                :value="
                  DiyCommon.IsNull(CurrentSysUserModel.DeptCode)
                    ? ''
                    : CurrentSysUserModel.DeptCode.substring(
                        0,
                        CurrentSysUserModel.DeptCode.length - 1
                      )
                "
                placeholder="自动生成"
              />
              <el-input
                readonly
                disabled
                style="display: none"
                v-model="CurrentSysUserModel.DeptCode"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24" :xs="24">
            <el-form-item :label="'兼职组织机构'" size="mini">
              <el-cascader
                style="width: 100%"
                clearable
                v-model="CurrentSysUserModel.DeptIds"
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
          <!-- v-model="CurrentSysUserRoleIds" -->
          <el-col :span="24" :xs="24">
            <el-form-item :label="$t('Msg.Role')" size="mini">
              <el-select
                style="width: 100%"
                v-model="CurrentSysUserModel.RoleIds"
                clearable
                filterable
                multiple
                placeholder=""
                value-key="Id"
                size="mini"
                @change="SelectRoleChange"
              >
                <el-option
                  v-for="item in SysRoleList"
                  :key="item.Id"
                  :label="item.Name"
                  :value="item"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24">
            <el-form-item :label="$t('Msg.Level')" size="mini">
              <el-input readonly disabled v-model="CurrentSysUserModel.Level" />
            </el-form-item>
          </el-col>
          <el-col :span="12" :xs="24">
            <el-form-item :label="$t('Msg.State')" size="mini">
              <el-select
                v-model="CurrentSysUserModel.State"
                placeholder=""
                size="mini"
              >
                <el-option label="启用" :value="1" />

                <el-option label="停用" :value="2" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24" :xs="24">
            <el-form-item :label="$t('Msg.Remark')" size="mini">
              <el-input
                v-model="CurrentSysUserModel.Remark"
                type="textarea"
                :rows="2"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <span slot="footer" class="dialog-footer">
        <el-button
          :loading="SaveSysUserLoding"
          type="primary"
          size="mini"
          icon="el-icon-s-help"
          @click="SaveSysUser"
          >{{ $t("Msg.Save") }}</el-button
        >
        <el-button
          size="mini"
          icon="el-icon-close"
          @click="ShowEditModel = false"
          >{{ $t("Msg.Cancel") }}</el-button
        >
      </span>
    </el-dialog>
  </div>
</template>

<script>
import elDragDialog from "@/directive/el-drag-dialog";
import _ from "underscore";
import { mapState } from "vuex";

export default {
  name: "sys_user",
  directives: {
    elDragDialog
  },
  computed: {
    GetCurrentUser: function () {
      return this.$store.getters["DiyStore/GetCurrentUser"];
    },
    ...mapState({
      // OsClient: state => state.DiyStore.OsClient
      DiyChatShow: (state) => state.DiyStore.DiyChat.Show
    })
  },
  data() {
    return {
      DataViewType: "Card", //Table
      EmptyData: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      SaveSysUserLoding: false,
      tableLoading: true,
      ShowEditModelTitle: "",
      ShowEditModel: false,
      SearchModel: {
        Keyword: "",
        RoleIds: [],
        DeptId: "",
        State: 1
      },
      SysUserList: [],
      SysUserCount: 0,
      SysUserPageSize: 12,
      SysUserPageIndex: 1,

      LoadingCount: 0,
      tabActiveName: "tabInfo",
      // options: regionData,
      selectedOptions: [],
      leftMenulist: [
        {
          Id: "sysUser",
          Name: this.$t("Msg.List"),
          IconClass: "fas fa-database",
          Disabled: false
        }
      ],
      ActiveLeftMenu: {},
      LeftMenuHide: false,
      SysBaseDataList: [],
      OpenBizUserModel: {},
      Table1: {},
      PageIndex: 1,
      PageSize: 10,
      Keyword: "",
      zTree: {},
      CurrentSysUserModel: {
        Attachments: ""
      },
      CurrentSysUserRoleIds: [],
      Attachments_: {
        Yingyezz: "",
        Shuiwudjz: "",
        Zhuzhijgdm: "",
        Qiyezzdjzs: "",
        Liuxuezjzz: "",
        Yinsicrjzz: "",
        Guanlispxgzz: "",
        Yejiqd: ""
      },
      SysRoleList: [],
      SysDeptList: [],
      SysDeptListJainZhi: []
    };
  },
  mounted() {
    var self = this;
    var dataViewType = localStorage.getItem("DataViewType_" + "Sys_User");
    if (!self.DiyCommon.IsNull(dataViewType)) {
      self.DataViewType = dataViewType;
    }
    self.GetSysUser(true);
    self.GetSysRole();
    self.GetSysDept();
  },
  methods: {
    GetUserAvatar(m) {
      var self = this;
      if (self.DiyCommon.IsNull(m.Avatar)) {
        if (m.Sex == "女" || m.Sex == "0" || m.Sex == 0) {
          return "./static/img/nohead-girl.png";
          // return require('../../microi/img/nohead-girl.png');
        }
        return "./static/img/nohead-boy.png";
        // return require('../../microi/img/nohead-boy.png');
      }
      return self.DiyCommon.GetFileServer() + m.Avatar;
    },
    ChangeDataViewType(command) {
      var self = this;
      self.DataViewType = command;
      localStorage.setItem("DataViewType_" + "Sys_User", command);
    },
    SelectRoleChange(ids) {
      var self = this;
      var maxLavel = 0;
      if (self.DiyCommon.IsNull(ids) || ids.length == 0) {
        maxLavel = 0;
      } else {
        ids.forEach((id) => {
          // var tObj = _.where(self.SysRoleList, {Id : id});
          // if(tObj.length > 0 && !self.DiyCommon.IsNull(tObj[0].Level)){
          //     if (maxLavel < tObj[0].Level) {
          //         maxLavel = tObj[0].Level;
          //     }
          // }
          if (id.Level && id.Level > maxLavel) {
            maxLavel = parseInt(id.Level);
          }
        });
      }
      self.CurrentSysUserModel.Level = maxLavel;
    },
    TreeDeptClick(data) {
      var self = this;
      self.SearchModel.DeptId = data.Id;
      self.GetSysUser(true);
    },
    AllDeptSearch() {
      var self = this;
      self.SearchModel.DeptId = "";
      self.GetSysUser(true);
    },
    DeptChange(value) {
      var self = this;
      self.CurrentSysUserModel.DeptName = "";
      self.CurrentSysUserModel.DeptCode = "";
      self.CurrentSysUserModel.CompanyCode = "";
      self.CurrentSysUserModel.CompanyName = "";
      self.CurrentSysUserModel.CompanyId = "";
      if (value) {
        var tObj = self.DiyCommon.ArrayDeepSearch(
          self.SysDeptList,
          "_Child",
          "Id",
          value
        );
        if (!self.DiyCommon.IsNull(tObj)) {
          self.CurrentSysUserModel.DeptName = tObj.Name;
          self.CurrentSysUserModel.DeptCode = tObj.Code;

          var findCompany = tObj; //{ ParentId : tObj.ParentId};
          while (findCompany) {
            if (findCompany && findCompany.IsCompany) {
              self.CurrentSysUserModel.CompanyCode = findCompany.Code;
              self.CurrentSysUserModel.CompanyName = findCompany.Name;
              self.CurrentSysUserModel.CompanyId = findCompany.Id;
              break;
            }
            findCompany = self.DiyCommon.ArrayDeepSearch(
              self.SysDeptList,
              "_Child",
              "Id",
              findCompany.ParentId
            );
          }
        }
      }
    },
    ImgUploadSuccess(result, file, fileList) {
      var self = this;
      if (self.DiyCommon.Result(result)) {
        self.$set(self.CurrentSysUserModel, "Avatar", result.Data.Path);
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
        self.DiyCommon.Tips(
          self.$t("Msg.MaxSize") + self.DiyCommon.UploadImgMaxSize + "MB!",
          false
        );
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
    GetSysRole() {
      var self = this;
      // self.LoadingCount++;
      self.DiyCommon.Post(self.DiyApi.GetSysRole(), {}, function (result) {
        // self.LoadingCount--;
        if (self.DiyCommon.Result(result)) {
          var newArr = result.Data.map((item) => {
            return {
              Id: item.Id,
              Name: item.Name,
              Level: item.Level
            };
          });
          self.SysRoleList = newArr;
        }
      });
    },
    GetRolesStr(roles) {
      try {
        // var json = JSON.parse(roles);
        var json = roles;
        var result = "";
        json.forEach((element) => {
          result += element.Name + "，";
        });
        // return result.trimEnd(',');
        return result.substring(0, result.length - 1);
      } catch (error) {
        return "";
      }
    },
    GetSysUserPassword() {
      var self = this;
      self.DiyCommon.Post(
        "/api/SysUser/GetSysUserPassword",
        {
          Id: self.CurrentSysUserModel.Id
        },
        function (result) {
          // self.LoadingCount--;
          if (self.DiyCommon.Result(result)) {
            self.CurrentSysUserModel.Pwd = result.Data;
          }
        }
      );
    },
    SysUserCurrentChange(val) {
      var self = this;
      self.SysUserPageIndex = val;
      self.GetSysUser();
    },
    SysUserSizeChange(val) {
      var self = this;
      self.SysUserPageSize = val;
      self.SysUserPageIndex = 1;
      self.GetSysUser(true);
    },
    GetSysUser(initPageIndex) {
      var self = this;
      if (initPageIndex === true) {
        self.SysUserPageIndex = 1;
      }
      self.tableLoading = true;
      self.DiyCommon.Post(
        self.DiyApi.GetSysUser(),
        {
          // OsClient: self.OsClient,
          _PageSize: self.SysUserPageSize,
          _PageIndex: self.SysUserPageIndex,
          _Keyword: self.SearchModel.Keyword,
          RoleIds: self.SearchModel.RoleIds,
          DeptId: self.SearchModel.DeptId,
          State: self.SearchModel.State
        },
        function (result) {
          self.tableLoading = false;
          if (self.DiyCommon.Result(result)) {
            self.SysUserList = result.Data;
            self.SysUserCount = result.DataCount;
          }
        }
      );
    },
    DelSysUser(m) {
      var self = this;
      self.DiyCommon.OsConfirm(
        self.$t("Msg.ConfirmDelTo") + "【" + m.Name + "】？",
        function () {
          self.DiyCommon.Post(
            self.DiyApi.DelSysUser(),
            {
              Id: m.Id
            },
            function (result) {
              if (self.DiyCommon.Result(result)) {
                self.DiyCommon.Tips(self.$t("Msg.Success"));
                self.GetSysUser();
              }
            }
          );
        }
      );
    },

    OpenSysUser(m) {
      var self = this;
      var title = self.$t("Msg.Add");
      if (self.DiyCommon.IsNull(m)) {
        self.CurrentSysUserModel = {
          DeptIds: [],
          RoleIds: []
        };
        // self.CurrentSysUserRoleIds = [];
      } else {
        title = m.Name;
        if (self.DiyCommon.IsNull(m.DeptIds)) {
          m.DeptIds = [];
        }
        if (!Array.isArray(m.DeptIds)) {
          m.DeptIds = JSON.parse(m.DeptIds);
        }

        if (self.DiyCommon.IsNull(m.RoleIds)) {
          m.RoleIds = [];
        }
        if (!Array.isArray(m.RoleIds)) {
          m.RoleIds = JSON.parse(m.RoleIds);
        }

        //2023-05-22
        try {
          var roleIdsValue = [];
          for (var i = 0; i < m.RoleIds.length; i++) {
            if (typeof m.RoleIds[i] == "string") {
              roleIdsValue.push({ Id: m.RoleIds[i] });
            } else {
              roleIdsValue.push(m.RoleIds[i]);
            }
          }
          m.RoleIds = roleIdsValue;
        } catch (e) {
          m.RoleIds = [];
        }
        //---END

        self.CurrentSysUserModel = m;

        // var maxLavel = 0;
        // self.DiyCommon.Post(self.DiyApi.GetSysUserFk(), {
        //     UserId: m.Id,
        //     Type: 'Role'
        // }, function (result1) {
        //     // self.LoadingCount--;
        //     if (self.DiyCommon.Result(result1)) {
        //         var roleIds = [];
        //         result1.Data.forEach(element => {
        //             element.Id = element.FkId
        //             roleIds.push(element.FkId);
        //             if (maxLavel < element.Level) {
        //                 maxLavel = element.Level;
        //             }
        //         })
        //         // self.CurrentSysUserRoleIds = result1.Data
        //         self.CurrentSysUserModel.RoleIds = roleIds
        //         self.CurrentSysUserModel.Level = maxLavel
        //     }
        // })
      }
      self.ShowEditModelTitle = title;
      self.ShowEditModel = true;
    },
    SaveSysUser() {
      var self = this;
      try {
        self.SaveSysUserLoding = true;
        var realParam = {
          FormEngineKey: "Sys_User"
        };

        var { ...param } = self.CurrentSysUserModel;

        var url = "/api/FormEngine/addFormData"; //''/sysuser/uptsysuser'
        if (self.CurrentSysUserModel.Id) {
          url = "/api/FormEngine/uptFormData"; //'/api/SysUser/addsysuser'
          realParam.Id = self.CurrentSysUserModel.Id;
        } else {
        }

        if (!self.CurrentSysUserModel.DeptId) {
          self.DiyCommon.Tips("组织机构必选！", false);
          self.SaveSysUserLoding = false;
          return;
        }

        //兼职机构是否已经勾选了组织机构
        // if (self.CurrentSysUserModel.DeptId.length > 0) {
        //     var isHave = false;
        //     self.CurrentSysUserModel.DeptIds.forEach(elementArr => {
        //         if (elementArr == self.CurrentSysUserModel.DeptId){
        //             isHave = true;
        //         }
        //     });
        //     var tempDeptIds = [...self.CurrentSysUserModel.DeptIds];
        //     if (!isHave) {
        //         tempDeptIds.push(self.CurrentSysUserModel.DeptId);
        //     }
        //     self.CurrentSysUserModel.DeptIds = tempDeptIds;
        // }
        //---------------------------------------------------
        // param.OsClient = self.OsClient
        param._Roles = null;
        // param.RoleIds = _.pluck(self.CurrentSysUserRoleIds, 'Id');
        param.DeptIds = JSON.stringify(param.DeptIds);
        param.RoleIds = JSON.stringify(param.RoleIds);
        if (!param.Pwd) {
          delete param.Pwd;
        }
        realParam._FormData = param;
        self.DiyCommon.Post(
          url,
          realParam,
          function (result) {
            self.SaveSysUserLoding = false;
            if (self.DiyCommon.Result(result)) {
              self.DiyCommon.Tips(self.$t("Msg.Success"));
              self.GetSysUser();
              self.ShowEditModel = false;
            }
          },
          function () {
            self.SaveSysUserLoding = false;
          }
        );
      } catch (error) {
        console.log(error);
        self.SaveSysUserLoding = false;
      }
    }
  }
};
</script>

<style scoped lang="scss">
.sys-user-avatar {
  img {
    width: 100% !important;
  }
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
</style>
