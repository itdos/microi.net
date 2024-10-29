<template>
    <div class="pluginPage">
      <el-row>
        <el-col :span="24">
          <el-card class="box-card" style="margin-bottom: 20px">
            <div class="">
              <div class="pull-left" style="font-size: 15px; font-weight: bold">
                <i :class="GetOpenTitleIcon()" />
                {{ GetOpenTitle() }}
              </div>
              <div class="pull-right">
                <el-button v-if="FormMode != 'View'" :loading="SaveDiyTableCommonLoding" type="danger" icon="el-icon-success" @click="SaveDiyTableCommon(true)">
                  {{ $t("Msg.SaveBack") }}
                </el-button>
                <!-- $t('Msg.Add') -->
                <el-button v-if="FormMode == 'View' && ShowUpdateBtn" :loading="SaveDiyTableCommonLoding" type="primary" :icon="'el-icon-edit'" @click="GotoEdit()">
                  {{ $t("Msg.Edit") }}
                </el-button>
                <!-- <el-button
                                  v-if="LimitDel() && FormMode != 'Add'"
                                  :loading="BtnLoading"
                                  type="danger"
                                  size="mini"
                                  icon="el-icon-delete"
                                  @click="DelDiyTableRow(CurrentRowModel, 'ShowFieldForm')">{{ $t('Msg.Delete') }}</el-button> -->
                <el-button type="default" icon="el-icon-back" @click="Go_1()">
                  {{ $t("Msg.Back") }}
                </el-button>
              </div>
              <div class="clear"></div>
            </div>
            <DiyForm
              ref="fieldForm"
              :form-mode="FormMode"
              :load-mode="'Page'"
              :table-id="TableId"
              :table-row-id="TableRowId"
              @CallbackFormSubmit="CallbackFormSubmit"
              @CallbackSetFormData="CallbackSetFormData"
              @CallbackSetDiyTableModel="CallbackSetDiyTableModel"
              @CallbackGetDiyField="CallbackGetDiyField"
              @CallbackReloadForm="CallbackReloadForm"
              @CallbackHideFormBtn="CallbackHideFormBtn"
            />
          </el-card>
        </el-col>
      </el-row>
    </div>
  </template>
  
  <script>
  import _ from "underscore";
  import { mapState } from "vuex";
  import merge from "webpack-merge";
  export default {
    name: "diy_form_page",
    components: {},
    computed: {
      GetCurrentUser: function () {
        return this.$store.getters["DiyStore/GetCurrentUser"];
      },
      ...mapState({
        // OsClient: state => state.DiyStore.OsClient
      }),
      FormMode() {
        return this.$route.query.FormMode;
      },
    },
    data() {
      return {
        BtnLoading: false,
        //   FormMode: "",
        SaveDiyTableCommonLoding: false,
        DiyFieldList: [],
        TableRowId: "",
        TableId: "",
        SysMenuId: "",
        CurrentDiyTableModel: {},
        CurrentRowModel: {},
        CallbackSetFormDataFinish: false,
        CallbackSetDiyTableModelFinish: false,
        ShowUpdateBtn: true,
        ShowDeleteBtn: true,
      };
    },
    watch: {
      FormMode: {
        immediate: true,
        handler(val) {
          console.log(val, "formMode");
          this.$nextTick(function () {
            this.$refs.fieldForm.Init();
          });
        },
      },
    },
    async mounted() {
      var self = this;
      self.TableId = self.$route.params.TableId;
      self.TableRowId = self.$route.params.TableRowId;
      if(!self.TableRowId){
            var guidResult = await self.DiyCommon.PostAsync('/api/diytable/NewGuid');
            if(guidResult.Code == 1){
                self.TableRowId = guidResult.Data;
            }
        }
      self.SysMenuId = self.$route.query.SysMenuId;
      if (!self.TableId || !self.FormMode) {
        self.DiyCommon.Tips("缺少参数！格式：/FormMode/TableId/TableRowId", false);
        return;
      }
      self.$nextTick(function () {
        self.$refs.fieldForm.Init();
      });
    },
    methods: {
      GotoEdit() {
        var self = this;
        self.$router.replace({
          query: merge(self.$route.query, { FormMode: "Edit" }),
        });
        self.$nextTick(function () {
          self.$refs.fieldForm.Init();
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
          if (!self.DosCommon.IsNull(self.TableRowId)) {
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
                //   self.FormMode = "Edit";
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
        self.$store.dispatch("tagsView/delView", self.$route);
        self.$router.go(-1);
      },
      GetOpenTitleIcon() {
        var self = this;
        return self.DosCommon.IsNull(self.CurrentRowModel) || self.DosCommon.IsNull(self.CurrentRowModel.Id) ? "fas fa-plus" : "far fa-edit";
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
          var tableName = self.DosCommon.IsNull(self.CurrentDiyTableModel) || self.DosCommon.IsNull(self.CurrentDiyTableModel.Description) ? "" : " - " + self.CurrentDiyTableModel.Description;
  
          result = formMode + firstValue + tableName;
          if ((self.CallbackSetFormDataFinish && self.CallbackSetDiyTableModelFinish) || (self.FormMode == "Add" && self.CallbackSetDiyTableModelFinish)) {
            // var item = this.$store.state.tagsView.visitedViews.filter(item => item.name == 'diy_form_page_' + (self.FormMode == 'Add' ? 'add' : 'edit'))
            var item = self.$store.state.tagsView.visitedViews.filter((item) => item.fullPath == self.$route.fullPath);
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
    },
  };
  </script>
  
  <style lang="scss">
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
  </style>
  