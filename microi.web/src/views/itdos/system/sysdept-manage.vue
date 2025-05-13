<template>
  <div id="divSysDeptManage" class="pluginPage">
    <el-row>
      <el-col :span="24">
        <el-card class="box-card no-padding-body">
          <el-form size="mini" :model="SearchModel" inline @submit.native.prevent class="keyword-search">
            <!-- <el-form-item
                        :label="$t('Msg.Keyword')"
                        size="mini">
                        <el-input
                            v-model="SearchModel.Keyword"
                            @keyup.enter.native="GetSysDept()" />
                    </el-form-item> -->
            <el-form-item :label="$t('Msg.State')" size="mini">
              <el-select v-model="SearchModel.State" placeholder="" size="mini">
                <el-option label="全部" :value="''" />
                <el-option label="启用" :value="1" />
                <el-option label="停用" :value="2" />
              </el-select>
            </el-form-item>
            <el-form-item size="mini">
              <el-button icon="el-icon-search" @click="GetSysDept()">{{ $t("Msg.Search") }}</el-button>
              <!-- <el-tooltip class="item" effect="dark" content="当含有子级的组织机构进行父级修改，子级的编号不会联动修改，使用此功能进行全部重新编排。" placement="bottom">
                            <el-button
                                type="primary"
                                icon="el-icon-plus"
                                @click="OpenMenuForm()">
                                    {{ '重新编排所有编码' }}
                                </el-button>
                        </el-tooltip> -->
              <el-button type="primary" icon="el-icon-plus" @click="OpenMenuForm()">{{ $t("Msg.Add") }}</el-button>
            </el-form-item>
          </el-form>
          <el-table v-loading="tableLoading" :data="SysDeptList" row-key="Id" :tree-props="{ children: '_Child' }" style="width: 100%" class="table-sysmenu diy-table no-border-outside" stripe border>
            <el-table-column type="index" width="50">
              <template slot-scope="scope">
                {{ scope.row.Sort }}
              </template>
            </el-table-column>
            <el-table-column label="名称" width="250">
              <template slot-scope="scope">
                <span
                  :style="{
                    marginLeft: (DiyCommon.IsNull(scope.row._Child) || scope.row._Child.length == 0) && scope.row.ParentId == DiyCommon.GuidEmpty ? '26px' : '0px'
                  }"
                >
                  {{ scope.row.Name }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="编码" width="250">
              <template slot-scope="scope">
                {{ DiyCommon.IsNull(scope.row.Code) ? "" : scope.row.Code.substring(0, scope.row.Code.length - 1) }}
              </template>
            </el-table-column>
            <el-table-column :label="$t('Msg.State')">
              <template slot-scope="scope">
                {{ scope.row.State == 1 ? "启用" : "停用" }}
              </template>
            </el-table-column>
            <el-table-column label="备注">
              <template slot-scope="scope">
                {{ scope.row.Remark }}
              </template>
            </el-table-column>
            <el-table-column prop="CreateTime" label="创建时间" width="200" />
            <el-table-column fixed="right" label="操作" width="300">
              <template slot-scope="scope">
                <el-button type="primary" size="mini" class="marginRight5" icon="el-icon-s-help" @click="OpenMenuForm(scope)">{{ $t("Msg.Edit") }}</el-button>
                <el-button type="primary" size="mini" class="marginRight5" icon="el-icon-s-help" @click="OpenMenuForm(null, scope.row)">{{ "新增下级" }}</el-button>
                <el-dropdown trigger="click">
                  <el-button>
                    {{ $t("Msg.More") }}
                    <i class="el-icon-arrow-down el-icon--right" />
                  </el-button>
                  <el-dropdown-menu slot="dropdown" class="table-more-btn">
                    <el-dropdown-item icon="el-icon-delete" divided @click.native="DelSysDept(scope.row)">{{ $t("Msg.Delete") }}</el-dropdown-item>
                  </el-dropdown-menu>
                </el-dropdown>
              </template>
            </el-table-column>
          </el-table>

          <el-pagination
            style="margin-top: 10px; float: left; margin-bottom: 10px; clear: both"
            background
            layout="total, sizes, prev, pager, next, jumper"
            :total="MenuListTotal"
            :page-size="MenuPageSize"
            @size-change="ManuSizeChange"
            @current-change="ManuPageChange"
          />
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-el-drag-dialog :width="'700px'" :modal-append-to-body="false" :visible.sync="ShowMenuForm" :close-on-click-modal="false" :close-on-press-escape="false" :destroy-on-close="false">
      <span slot="title">
        <i class="fas fa-bars" />
        {{ DiyCommon.IsNull(CurrentSysDeptModel.Name) ? "组织机构" : CurrentSysDeptModel.Name }}
      </span>
      <div class="list-group microi-desktop-tab-content openDiv" style="padding-top: 0px">
        <div v-show="ActiveLeftMenu.Id == 'basedata'" class="microi-desktop-tab-item">
          <el-form status-icon size="mini" :model="CurrentSysDeptModel" label-width="150px">
            <el-row :gutter="20">
              <!--开始循环组件-->
              <el-col :span="24" :xs="24">
                <div class="container-form-item">
                  <el-form-item class="form-item" :label="$t('Msg.Parent')" size="mini">
                    <el-popover placement="bottom" trigger="click" style="">
                      <el-tree :data="SysDeptList" node-key="Id" :props="sysMenuTreeProps" @node-click="sysMenuTreeClick" />
                      <el-button size="mini" slot="reference" style="width: 70%; margin-right: 15px">
                        {{ ParentName }}
                      </el-button>
                    </el-popover>
                    <i class="fas fa-undo-alt hand" style="margin-top: 8px; font-size: 18px" @click="DefaultParent" />
                  </el-form-item>
                </div>
              </el-col>
              <el-col :offset="12"> </el-col>
              <el-col :span="12" :xs="24">
                <div class="container-form-item">
                  <el-form-item class="form-item" :label="$t('Msg.Name')" size="mini">
                    <el-input v-model="CurrentSysDeptModel.Name" clearable></el-input>
                  </el-form-item>
                </div>
              </el-col>
              <el-col v-if="GetCurrentUser._IsAdmin" :span="12" :xs="24">
                <div class="container-form-item">
                  <el-form-item class="form-item" :label="'是否独立机构'" size="mini">
                    <el-switch v-model="CurrentSysDeptModel.IsCompany"></el-switch>
                  </el-form-item>
                </div>
              </el-col>
              <el-col v-if="GetCurrentUser._IsAdmin && TenantList.length > 0" :span="12" :xs="24">
                <div class="container-form-item">
                  <el-form-item class="form-item" :label="'所属租户'" size="mini">
                    <el-select v-model="CurrentSysDeptModel.TenantId" clearable filterable placeholder="" @change="ChangeTenant" size="mini">
                      <el-option v-for="item in TenantList" :key="item.Id" :label="item.TenantName" :value="item.Id" />
                    </el-select>
                  </el-form-item>
                </div>
              </el-col>
              <el-col :span="12" :xs="24">
                <div class="container-form-item">
                  <el-form-item class="form-item" :label="'编码'" size="mini">
                    <el-input
                      readonly
                      disabled
                      :value="DiyCommon.IsNull(CurrentSysDeptModel.Code) ? '' : CurrentSysDeptModel.Code.substring(0, CurrentSysDeptModel.Code.length - 1)"
                      placeholder="自动生成"
                    ></el-input>
                    <el-input readonly disabled style="display: none" v-model="CurrentSysDeptModel.Code" placeholder="自动生成"></el-input>
                  </el-form-item>
                </div>
              </el-col>
              <el-col :span="12" :xs="24">
                <div class="container-form-item">
                  <el-form-item class="form-item" :label="$t('Msg.Sort')" size="mini">
                    <el-input v-model="CurrentSysDeptModel.Sort" clearable></el-input>
                  </el-form-item>
                </div>
              </el-col>
              <el-col :span="12" :xs="24">
                <el-form-item :label="$t('Msg.State')" size="mini">
                  <el-select v-model="CurrentSysDeptModel.State" placeholder="" size="mini">
                    <el-option label="启用" :value="1" />

                    <el-option label="停用" :value="2" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="24" :xs="24">
                <div class="container-form-item">
                  <el-form-item class="form-item" :label="$t('Msg.Remark')" size="mini">
                    <el-input type="textarea" :rows="2" v-model="CurrentSysDeptModel.Remark"></el-input>
                  </el-form-item>
                </div>
              </el-col>
            </el-row>
          </el-form>
        </div>
      </div>
      <span slot="footer" class="dialog-footer">
        <div class="offset-sm-2 col-sm-10">
          <el-button v-if="!DiyCommon.IsNull(CurrentSysDeptModel.Id)" :loading="BtnLoading" type="primary" icon="el-icon-circle-plus-outline" @click="UptSysDept()">
            {{ $t("Msg.Update") }}
          </el-button>
          <el-button v-if="DiyCommon.IsNull(CurrentSysDeptModel.Id)" :loading="BtnLoading" type="primary" icon="el-icon-circle-plus-outline" @click="AddSysDept()">
            {{ $t("Msg.Add") }}
          </el-button>
          <el-button v-if="!DiyCommon.IsNull(CurrentSysDeptModel.Id)" :loading="BtnLoading" type="primary" icon="el-icon-delete" @click="DelSysDept(CurrentSysDeptModel)">
            {{ $t("Msg.Delete") }}
          </el-button>
          <el-button icon="el-icon-close" @click="ShowMenuForm = false">
            {{ $t("Msg.Close") }}
          </el-button>
        </div>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import { mapState, mapMutations, mapGetters } from "vuex";
import Sortable from "sortablejs";
import elDragDialog from "@/directive/el-drag-dialog";
import _ from "underscore";
// import C_V8Explain from '@/views/diy/v8-explain'

// 以下是vue-codemirror
import { codemirror } from "vue-codemirror";
// import language js
import "codemirror/mode/javascript/javascript.js";
// import base style
import "codemirror/lib/codemirror.css";
// import theme style
import "codemirror/theme/base16-dark.css";

export default {
  components: {
    codemirror
    // C_V8Explain
  },
  directives: {
    elDragDialog
  },
  watch: {
    "CurrentSysDeptModel.OpenType"(val) {
      var self = this;
      if (val == "Diy" && !self.DiyCommon.IsNull(self.CurrentSysDeptModel.SysDeptId)) {
        self.$nextTick(function () {
          self.SetDiyFieldSort();
        });
      }
    },
    "CurrentSysDeptModel.SysDeptId"(val) {
      var self = this;
      if (!self.DiyCommon.IsNull(val) && self.CurrentSysDeptModel.OpenType == "Diy") {
        self.$nextTick(function () {
          self.SetDiyFieldSort();
        });
      }
    }
  },
  beforeCreate() {},
  computed: {
    GetCurrentUser: function () {
      return this.$store.getters["DiyStore/GetCurrentUser"];
    },
    ...mapGetters({
      // GetCurrentUser: "itdos/GetCurrentUser",
    }),
    ...mapState({
      DesktopBg: (state) => state.DiyStore.DesktopBg,
      CurrentTime: (state) => state.DiyStore.CurrentTime,
      LoginCover: (state) => state.DiyStore.LoginCover,
      OsClient: (state) => state.DiyStore.OsClient,
      Lang: (state) => state.DiyStore.Lang,
      EnableEnEdit: (state) => state.DiyStore.EnableEnEdit,
      SystemStyle: (state) => state.DiyStore.SystemStyle,
      SysConfig: (state) => state.DiyStore.SysConfig
    })
  },
  destroyed() {
    // $("#ztree_metroStyle_id").remove();
    // UE.delEditor("ue_richtextContent");
  },
  mounted() {
    var self = this;
    self.Init();
  },
  data() {
    return {
      BtnLoading: false,
      CurrentSysDeptModelTab: "Info",
      CurrentV8Sign: "",
      CurrentV8SignCol: "",
      CurrentV8SignFieldName: "",
      CurrentV8Code: "",
      DialogV8Code: "Code", // Explain
      ShowV8CodeEditor: false,
      DefaultOrderBy: "",
      DefaultOrderByType: "",
      MenuListTotal: 0,
      MenuPageSize: 10,
      MenuPageIndex: 1,

      tableLoading: false,
      ShowMenuForm: false,
      // iTdos: iTdos,
      SearchModel: {
        Keyword: "",
        State: 1
      },
      ParentName: this.$t("Msg.TopLevel"),
      LoadingCount: 0,
      CurrentSysRichText: {
        Title: "",
        Key: "",
        Content: ""
      },
      tabActiveName: "tabInfo",
      leftMenulist: [
        {
          Id: "basedata",
          Name: this.$t("Msg.Menu"),
          IconClass: "fas fa-database",
          Disabled: false
        }
      ],
      ActiveLeftMenu: {},
      LeftMenuHide: false,
      SysDeptList: [],
      CurrentSysDeptModel: { IsCompany: false },
      sysMenuTreeProps: {
        children: "_Child",
        label: "Name", // this.Lang == 'cn' ? 'Name' : 'EnName'
        Enlabel: "EnName"
      },
      SysDeptList: [],
      DiyFieldList: [],
      TenantList: []
    };
  },
  methods: {
    Init() {
      var self = this;
      self.GetSysDept();
      self.ActiveLeftMenu = self.leftMenulist[0];
      self.$nextTick(function () {
        //self.FastClick.attach(document.querySelector(".layx-window"));
      });
      if (self.Lang == "zh-CN") {
        self.sysMenuTreeProps.lable = "Name";
      } else {
        self.sysMenuTreeProps.lable = "EnName";
      }
      // self.SetDiyFieldSort();
      self.GetTenantList();
    },
    ChangeTenant(val) {
      var self = this;
      if (val) {
        var tenantName = _.find(self.TenantList, function (item) {
          return item.Id == val;
        }).TenantName;
        self.CurrentSysDeptModel.TenantName = tenantName;
      } else {
        self.CurrentSysDeptModel.TenantName = "";
      }
    },
    async GetTenantList() {
      var self = this;
      var tenantListReslt = await self.DiyCommon.ApiEngine.Run("get_tenant_list");
      self.TenantList = tenantListReslt.Data || [];
    },
    AddMoreBtn(fieldName) {
      var self = this;
      self.CurrentSysDeptModel[fieldName].push(self["CurrentSysDept" + fieldName + "Model"]);
      self["CurrentSysDept" + fieldName + "Model"] = {
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
      for (let index = 0; index < self.CurrentSysDeptModel[fieldName].length; index++) {
        if (self.CurrentSysDeptModel[fieldName][index].Name == tabModel.Name) {
          self.CurrentSysDeptModel[fieldName].splice(index, 1);
          break;
        }
      }
    },
    OpenV8CodeEditor(type, colType, fieldName) {
      var self = this;
      self.CurrentV8Sign = type;
      self.CurrentV8SignCol = colType;
      self.CurrentV8SignFieldName = fieldName;
      if (fieldName == "DetailPageV8") {
        self.CurrentV8Code = self.CurrentSysDeptModel[fieldName];
      } else {
        self.CurrentSysDeptModel[fieldName].forEach((btn) => {
          if (btn.Name == type) {
            self.CurrentV8Code = self.DiyCommon.IsNull(btn[colType]) ? "" : btn[colType];
          }
        });
      }

      self.ShowV8CodeEditor = true;
    },
    CloseV8CodeEditor() {
      var self = this;
      if (self.CurrentV8SignFieldName == "DetailPageV8") {
        self.CurrentSysDeptModel[self.CurrentV8SignFieldName] = self.CurrentV8Code;
      } else {
        self.CurrentSysDeptModel[self.CurrentV8SignFieldName].forEach((btn) => {
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
        //CurrentSysDeptModel.DefaultOrderBy
      }
    },
    ManuSizeChange(val) {
      var self = this;
      self.MenuPageSize = val;
      localStorage.setItem("SysDeptPageSize", val);
      self.MenuPageIndex = 1;
      self.GetSysDept();
    },
    ManuPageChange(val) {
      var self = this;
      self.MenuPageIndex = val;
      self.GetSysDept();
    },
    OpenMenuForm(scope, childModel) {
      var self = this;
      self.BtnLoading = false;
      if (self.DiyCommon.IsNull(scope)) {
        var tempModel = { IsCompany: false };
        // self.DiyCommon.ForConvertSysDept(tempModel);
        self.CurrentSysDeptModel = tempModel;
        if (!self.DiyCommon.IsNull(childModel)) {
          self.CurrentSysDeptModel.ParentId = childModel.Id;
          self.CurrentSysDeptModel.ParentName = childModel.Name;
          self.ParentName = childModel.Name;
        }
      } else {
        scope.row.IsCompany = false;
        //2023-03-22：执行以下此句过后，会导致IsCompany控件点击后dom不刷新，element-ui的bug，临时解决方案：{...scope.row}
        // self.CurrentSysDeptModel = scope.row;
        self.CurrentSysDeptModel = { ...scope.row };
        //2023-03-22 再查询一次，为了兼容老程序/数据库
        self.DiyCommon.FormEngine.GetFormData(
          {
            FormEngineKey: "Sys_Dept",
            Id: self.CurrentSysDeptModel.Id
          },
          function (result) {
            if (self.DiyCommon.Result(result)) {
              if (result.Data.IsCompany != null && result.Data.IsCompany != undefined) {
                self.CurrentSysDeptModel.IsCompany = result.Data.IsCompany == true || result.Data.IsCompany == 1;
              }
            }
          }
        );
      }
      if (!self.DiyCommon.IsNull(self.CurrentSysDeptModel.ImportTemplate)) {
        //取临时链接 _ImportTemplateUrl
        // self.DiyCommon.Post('/api/Aliyun/GetOssDownloadUrl',{
        self.DiyCommon.Post(
          "/api/HDFS/GetPrivateFileUrl",
          {
            FilePathName: self.CurrentSysDeptModel.ImportTemplate,
            HDFS: self.SysConfig.HDFS || "Aliyun"
          },
          function (result) {
            if (self.DiyCommon.Result(result)) {
              result = result.Data;
            } else {
              result = "";
            }
            self.$set(self.CurrentSysDeptModel, "_ImportTemplateUrl", result);
            // resolve(result);
          }
        );
      }

      if (self.DiyCommon.IsNull(self.CurrentSysDeptModel.DefaultOrderBy)) {
        self.DefaultOrderBy = "";
        self.DefaultOrderByType = "";
      } else {
        try {
          var tArr = JSON.parse(self.CurrentSysDeptModel.DefaultOrderBy);
          self.DefaultOrderBy = tArr[0].Id;
          self.DefaultOrderByType = tArr[0].Type;
        } catch (error) {
          self.DefaultOrderBy = "";
          self.DefaultOrderByType = "";
        }
      }

      if (!self.DiyCommon.IsNull(self.CurrentSysDeptModel.Id)) {
        // var parentModel = _.where(self.SysDeptList, { Id : self.CurrentSysDeptModel.ParentId});
        //这里有可能查出来是undefined，因为SysDeptList根据权限出来是查不出上一级部门的
        var parentModel = self.DiyCommon.FindRecursion(self.SysDeptList, "_Child", self.CurrentSysDeptModel.ParentId);
        // self.DiyCommon.ForConvertSysDept(self.CurrentSysDeptModel);

        if (!self.DiyCommon.IsNull(self.CurrentSysDeptModel.SysDeptId)) {
          self.GetDiyField();
        }
        // 选中Parent
        if (self.CurrentSysDeptModel.ParentId == self.DiyCommon.GuidEmpty) {
          self.CurrentSysDeptModel.ParentName = "顶级";
          self.ParentName = "顶级";
        } else {
          if (self.DiyCommon.IsNull(parentModel)) {
            self.CurrentSysDeptModel.ParentName = self.CurrentSysDeptModel.Name;
            self.ParentName = self.CurrentSysDeptModel.Name;
          } else {
            self.CurrentSysDeptModel.ParentName = parentModel.Name;
            self.ParentName = parentModel.Name;
          }
        }
      } else {
        // if (!self.GetCurrentUser._IsAdmin && self.SysDeptList.length == 0) {
        //     self.DiyCommon.Tips('未查询到组织机构数据，您无法添加组织机构！', false);
        //     return;
        // }
        if (!self.GetCurrentUser._IsAdmin && self.SysDeptList.length > 0) {
          self.CurrentSysDeptModel.ParentId = self.SysDeptList[0].Id;
          self.CurrentSysDeptModel.ParentName = self.SysDeptList[0].Name;
          self.ParentName = self.SysDeptList[0].Name;
        }
      }
      self.ShowMenuForm = true;
    },
    GetAllCanEditFieldList() {
      var self = this;
      var result = [];
      self.DiyFieldList.forEach((element) => {
        if (!(self.CurrentSysDeptModel.NotShowFields.indexOf(element.Id) > -1)) {
          result.push(element);
        }
      });
      return result;
    },
    SetDiyFieldSort() {
      var self = this;
      const el = self.$refs.sltTableDiyFieldIds.$el.querySelectorAll(".el-select__tags > span")[0];
      this.sortable = Sortable.create(el, {
        ghostClass: "sortable-ghost", // Class name for the drop placeholder,
        setData: function (dataTransfer) {
          dataTransfer.setData("Text", "");
          // to avoid Firefox bug
          // Detail see : https://github.com/RubaXa/Sortable/issues/1012
        },
        onEnd: (evt) => {
          const targetRow = self.CurrentSysDeptModel.TableDiyFieldIds.splice(evt.oldIndex, 1)[0];
          self.CurrentSysDeptModel.TableDiyFieldIds.splice(evt.newIndex, 0, targetRow);
        }
      });
    },
    SysDeptIdChange() {
      var self = this;
      self.GetDiyField();
    },
    handleAvatarSuccess(result, file) {
      var self = this;
      if (self.DiyCommon.Result(result)) {
        self.CurrentSysDeptModel.Icon = result.Data.Path; // URL.createObjectURL(file.raw);
        self.DiyCommon.Tips(self.$t("Msg.UploadSuccess"));
      }
    },
    handleImportTplSuccess(result, file) {
      var self = this;
      if (self.DiyCommon.Result(result)) {
        self.CurrentSysDeptModel.ImportTemplate = result.Data.Path; // URL.createObjectURL(file.raw);
        self.DiyCommon.Tips(self.$t("Msg.UploadSuccess"));

        //取临时链接 _ImportTemplateUrl
        self.DiyCommon.Post(
          "/api/Aliyun/GetOssDownloadUrl",
          {
            FilePathName: self.CurrentSysDeptModel.ImportTemplate,
            HDFS: self.SysConfig.HDFS || "Aliyun"
          },
          function (result) {
            if (self.DiyCommon.Result(result)) {
              result = result.Data;
            } else {
              result = "";
            }
            self.$set(self.CurrentSysDeptModel, "_ImportTemplateUrl", result);
            // resolve(result);
          }
        );
      }
    },

    sysMenuTreeLeftClick(data, node) {
      // var self = this;
      // self.SysDeptNeedConvertField.forEach((convertField) => {
      //     if (self.DiyCommon.IsNull(data[convertField])) {
      //         data[convertField] = [];
      //     } else if (typeof data[convertField] === "string") {
      //         data[convertField] = JSON.parse(data[convertField]);
      //     }
      // });
      // this.CurrentSysDeptModel = data;
      // if (!self.DiyCommon.IsNull(self.CurrentSysDeptModel.SysDeptId)) {
      //     self.GetDiyField();
      // }
      // // 选中Parent
      // if (data.ParentId == self.DiyCommon.GuidEmpty) {
      //     this.CurrentSysDeptModel.ParentName = "顶级";
      //     this.ParentName = "顶级";
      // } else {
      //     this.CurrentSysDeptModel.ParentName = node.parent.data.Name;
      //     this.ParentName = node.parent.data.Name;
      // }
    },
    DefaultParent() {
      var self = this;
      if (self.GetCurrentUser._IsAdmin) {
        self.CurrentSysDeptModel.ParentId = "00000000-0000-0000-0000-000000000000";
        self.CurrentSysDeptModel.ParentName = "顶级";
        self.ParentName = "顶级";
      } else {
        if (self.SysDeptList.length == 0) {
          self.DiyCommon.Tips("未查询到组织机构数据，您无法设置顶级！", false);
          return;
        }
        self.CurrentSysDeptModel.ParentId = self.SysDeptList[0].Id;
        self.CurrentSysDeptModel.ParentName = self.SysDeptList[0].Name;
        self.ParentName = self.SysDeptList[0].Name;
        // //注意：如果当前用户不是系统管理员，并且***，
        // //那么this.CurrentSysDeptModel.ParentId不应该是000，只能是SysDeptList[0].Name
        // if (!self.DiyCommon.IsNull(self.CurrentSysDeptModel.Id)) {
        //     //这里有可能查出来是undefined，因为SysDeptList根据权限出来是查不出上一级部门的
        //     var parentModel = self.DiyCommon.FindRecursion(self.SysDeptList, '_Child', self.CurrentSysDeptModel.ParentId);
        //     if (self.DiyCommon.IsNull(parentModel)) {
        //         self.CurrentSysDeptModel.ParentId = self.CurrentSysDeptModel.Id;
        //         self.CurrentSysDeptModel.ParentName = self.CurrentSysDeptModel.Name;
        //         self.ParentName = self.CurrentSysDeptModel.Name;
        //     }else{
        //         self.CurrentSysDeptModel.ParentId = "00000000-0000-0000-0000-000000000000";
        //         self.CurrentSysDeptModel.ParentName = "顶级";
        //         self.ParentName = "顶级";
        //     }
        // }else{

        // }
      }
    },
    sysMenuTreeClick(data) {
      this.CurrentSysDeptModel.ParentId = data.Id;
      this.CurrentSysDeptModel.ParentName = data.Name;
      this.ParentName = data.Name;
    },
    SelectLeftTab(m) {
      var self = this;
      this.ActiveLeftMenu = m;
      if (m.Id == "basedata") {
        self.GetSysDept();
      }
    },
    AddSysDept(parentModel) {
      var self = this;
      self.BtnLoading = true;
      var param = {};
      if (!self.DiyCommon.IsNull(parentModel)) {
        param.ParentId = parentModel.Id;
        param.Name = self.$t("Msg.Unnamed");
      } else {
        param = {
          ...self.CurrentSysDeptModel
        };
      }

      if (!self.DiyCommon.IsNull(self.DefaultOrderBy) && !self.DiyCommon.IsNull(self.DefaultOrderByType)) {
        param.DefaultOrderBy = JSON.stringify([{ Id: self.DefaultOrderBy, Type: self.DefaultOrderByType }]);
      } else {
        param.DefaultOrderBy = "";
      }

      // self.ForConvertSysDeptParam(param);

      param.OsClient = self.OsClient;

      self.DiyCommon.Post(self.DiyApi.AddSysDept, param, function (result) {
        self.BtnLoading = false;
        if (self.DiyCommon.Result(result)) {
          self.ShowMenuForm = false;
          self.DiyCommon.Tips(self.$t("Msg.Success"));
          self.GetSysDept();
        }
      });
    },
    UptSysDept() {
      var self = this;
      self.BtnLoading = true;
      var param = {
        ...self.CurrentSysDeptModel
      };
      if (!self.DiyCommon.IsNull(self.DefaultOrderBy) && !self.DiyCommon.IsNull(self.DefaultOrderByType)) {
        param.DefaultOrderBy = JSON.stringify([{ Id: self.DefaultOrderBy, Type: self.DefaultOrderByType }]);
      } else {
        param.DefaultOrderBy = "";
      }

      // self.ForConvertSysDeptParam(param);

      param.OsClient = self.OsClient;

      param._Child = [];

      self.DiyCommon.Post(self.DiyApi.UptSysDept, param, function (result) {
        self.BtnLoading = false;
        if (self.DiyCommon.Result(result)) {
          self.DiyCommon.Tips(self.$t("Msg.Success"));
          self.GetSysDept();
        }
      });
    },
    DelSysDept(m) {
      var self = this;
      self.DiyCommon.OsConfirm(self.$t("Msg.ConfirmDel") + self.$t("Msg.Menu") + "【" + m.Name + "】？", function () {
        self.BtnLoading = true;
        self.DiyCommon.Post(
          self.DiyApi.DelSysDept,
          {
            Id: m.Id,
            OsClient: self.OsClient
          },
          function (data1) {
            self.BtnLoading = false;
            if (self.DiyCommon.Result(data1)) {
              self.DiyCommon.Tips(self.$t("Msg.Success"));
              self.GetSysDept();
            }
          }
        );
      });
    },
    GetSysDept(initPageIndex) {
      var self = this;
      self.tableLoading = true;
      if (initPageIndex === true) {
        self.MenuPageIndex = 1;
      }
      self.DiyCommon.Post(
        self.DiyApi.GetSysDeptStep,
        {
          OsClient: self.OsClient,
          _PageIndex: self.MenuPageIndex,
          _PageSize: self.MenuPageSize,
          State: self.SearchModel.State
        },
        function (result) {
          if (self.DiyCommon.Result(result)) {
            self.MenuListTotal = result.DataCount;
            // result.Data.forEach((data) => {
            //     self.DiyCommon.ForConvertSysDept(data);
            // });
            self.SysDeptList = result.Data;
          }
          self.tableLoading = false;
        }
      );
    },
    GetDiyField() {
      var self = this;
      if (!self.DiyCommon.IsNull(self.CurrentSysDeptModel.SysDeptId)) {
        self.DiyCommon.Post(
          self.DiyApi.GetDiyField,
          {
            TableId: self.CurrentSysDeptModel.SysDeptId,
            OsClient: self.OsClient
          },
          function (result) {
            if (self.DiyCommon.Result(result)) {
              self.DiyFieldList = result.Data;
            }
          }
        );
      } else {
        self.DiyFieldList = [];
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.drag-select >>> .sortable-ghost {
  opacity: 0.8;
  color: #fff !important;
  background: #42b983 !important;
}

.drag-select >>> .el-tag {
  cursor: pointer;
}

.sysMenuFormIcon .avatar-uploader-icon {
  width: 50px !important;
  height: 50px !important;
  line-height: 50px !important;
}
</style>
