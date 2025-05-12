<template>
  <!--
    基础数据管理模块
    此页面待重做！！！
-->
  <div id="diviTdosSystemManage" class="pluginPage">
    <div class="pluginPage-aero" />
    <div class="row microi-desktop-tab">
      <div :class="'microi-desktop-tab-right col-md-10 col-sm-10 col-xs-10 transition3 ' + (LeftMenuHide ? 'width100' : '')" style="">
        <div class="list-group microi-desktop-tab-content">
          <div v-show="ActiveLeftMenu.Id == 'basedata'" class="microi-desktop-tab-item">
            <div class="row">
              <div class="col-md-6">
                <ul id="basedataTree" class="ztree" />
              </div>
              <div class="col-md-6" v-if="!DiyCommon.IsNull(CurrentSysBaseDataModel.Id)">
                <el-form :model="CurrentSysBaseDataModel" class="demo-form-inline">
                  <el-form-item label="Key">
                    <el-input v-model="CurrentSysBaseDataModel.Key" placeholder="Code"></el-input>
                  </el-form-item>
                  <el-form-item label="Value">
                    <el-input v-model="CurrentSysBaseDataModel.Value" placeholder="值"></el-input>
                  </el-form-item>
                  <el-form-item label="备注">
                    <el-input v-model="CurrentSysBaseDataModel.Remark" placeholder=""></el-input>
                  </el-form-item>
                  <el-form-item label="Id">
                    <el-input v-model="CurrentSysBaseDataModel.Id" :readonly="true" :disabled="true" placeholder=""></el-input>
                  </el-form-item>
                  <el-form-item>
                    <el-button type="primary" @click.stop="UptSysBaseData">{{ $t("Msg.Save") }}</el-button>
                  </el-form-item>
                </el-form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import "../../../../public/static/js/zTree/metroStyle/metroStyle.css";
import "../../../../public/static/js/zTree/jquery.ztree.all.min.js";

import { mapState, mapMutations, mapGetters } from "vuex";
export default {
  components: {},
  data() {
    return {
      LoadingCount: 0,

      CurrentSysRichText: {
        Title: "",
        Key: "",
        Content: ""
      },
      tabWxEditorType: "title",
      WxEditorType: "title",
      tabActiveName: "tabInfo",

      leftMenulist: [
        {
          Id: "basedata",
          Name: this.$t("Msg.BaseData"),
          IconClass: "fas fa-database",
          Disabled: false
        }
      ],
      ActiveLeftMenu: {},
      LeftMenuHide: false,
      SysBaseDataList: [],
      Table1: {},
      PageIndex: 1,
      PageSize: 10,
      Keyword: "",
      zTree: {},
      CurrentSysBaseDataModel: {}
    };
  },
  beforeCreate() {},
  destroyed() {},
  mounted() {
    var self = this;

    self.Init();
  },
  methods: {
    Init() {
      var self = this;
      self.ActiveLeftMenu = self.leftMenulist[0];
      self.GetSysBaseData();
      $(function () {});
      self.$nextTick(function () {});
    },
    UptSysBaseData() {
      var self = this;
      self.DiyCommon.Post(
        self.DiyApi.UptSysBaseData(),
        {
          Id: self.CurrentSysBaseDataModel.Id,
          Key: self.CurrentSysBaseDataModel.Key,
          Value: self.CurrentSysBaseDataModel.Value,
          Remark: self.CurrentSysBaseDataModel.Remark
        },
        function (result2) {
          if (self.DiyCommon.Result(result2)) {
            self.DiyCommon.Tips(self.$t("Msg.Success"));
          }
        }
      );
    },

    GetSysBaseData() {
      var self = this;
      self.DiyCommon.SetWin10Loading(true);
      // self.LoadingCount++;
      self.DiyCommon.Post(self.DiyApi.GetSysBaseDataStep(), {}, function (result) {
        self.DiyCommon.SetWin10Loading(false);
        // self.LoadingCount--;
        if (self.DiyCommon.Result(result)) {
          self.SysBaseDataList = result.Data;
          var setting = {
            edit: {
              enable: true,
              showRemoveBtn: true,
              showRenameBtn: true
            },
            data: {
              key: {
                id: "Id",
                children: "_Child",
                name: "Value",
                parentId: "ParentId"
              }
            },
            view: {
              dblClickExpand: true,
              showLine: true,
              selectedMulti: false,
              addHoverDom: function (treeId, treeNode) {
                var sObj = $("#" + treeNode.tId + "_span");
                if (treeNode.editNameFlag || $("#addBtn_" + treeNode.tId).length > 0) {
                  return;
                }
                var addStr = "<span class='button add' id='addBtn_" + treeNode.tId + "' title='add node' onfocus='this.blur();'></span>";
                sObj.after(addStr);
                var btn = $("#addBtn_" + treeNode.tId);
                if (btn) {
                  btn.bind("click", function () {
                    var sort = 0;
                    if (!self.DiyCommon.IsNull(treeNode._Child)) {
                      sort = treeNode._Child.length;
                    }
                    var param = {
                      Key: self.$t("Msg.Unnamed") + Math.ceil(Math.random() * 10),
                      Value: self.$t("Msg.Unnamed") + Math.ceil(Math.random() * 10),
                      ParentId: treeNode.Id,
                      Sort: sort
                    };
                    self.DiyCommon.Post(self.DiyApi.AddSysBaseData(), param, function (data2) {
                      if (self.DiyCommon.Result(data2)) {
                        var param2 = {
                          Id: data2.Data.Id,
                          ParentId: data2.Data.ParentId,
                          Key: param.Key,
                          Value: param.Value
                        };
                        self.zTree.addNodes(treeNode, param2);
                        self.DiyCommon.Tips(self.$t("Msg.Success"));
                      }
                    });
                    return false;
                  });
                }
              },
              removeHoverDom: function (treeId, treeNode) {
                $("#addBtn_" + treeNode.tId)
                  .unbind()
                  .remove();
              }
            },
            callback: {
              // beforeDrop: function(treeId, treeNodes, targetNode, moveType) {
              //     if (targetNode == null) {
              //         return false;
              //     }
              // },
              onDrop: function (event, treeId, treeNodes, targetNode, moveType) {
                // treeId, treeNodes, targetNode, moveType
                // ----------------------------处理Sort排序和ParentId
                var newSort = 0;
                var pid = "";
                if (targetNode == null && moveType == null) {
                  // 拖到外面啥子都不干
                  return false;
                } else if (targetNode == null) {
                  // 如果是拉到顶级节点
                  // 这里要减1，是因为onDrop已经对层级移动生效了
                  newSort = self.zTree.getNodes().length - 1;
                  pid = self.DiyCommon.GuidEmpty;
                } else {
                  newSort = targetNode.getIndex();
                  pid = targetNode.ParentId;
                  if (moveType == "next") {
                    newSort++;
                  } else if (moveType == "prev") {
                    newSort--;
                  } else if (moveType == "inner") {
                    // 这里要减1，是因为onDrop已经对层级移动生效了
                    newSort = targetNode._Child.length - 1;
                    pid = targetNode.Id;
                  }
                }
                // ---------------end
                self.DiyCommon.Post(
                  self.DiyApi.UptSysBaseData(),
                  {
                    Id: treeNodes[0].Id,
                    ParentId: pid,
                    Sort: newSort
                  },
                  function (data5) {
                    if (self.DiyCommon.Result(data5)) {
                      self.DiyCommon.Tips(self.$t("Msg.Success"));
                    }
                  }
                );
              },
              beforeClick: function (treeId, treeNode) {
                self.CurrentSysBaseDataModel = treeNode;
              },
              onRemove: function (e, treeId, treeNode) {},
              beforeRemove: function (treeId, treeNode) {
                self.zTree.selectNode(treeNode);
                self.DiyCommon.OsConfirm(self.$t("Msg.ConfirmDelTo") + "？", function () {
                  self.DiyCommon.Post(
                    self.DiyApi.DelSysBaseData(),
                    {
                      Id: treeNode.Id
                    },
                    function (data1) {
                      if (self.DiyCommon.Result(data1)) {
                        self.DiyCommon.Tips(self.$t("Msg.Success"));
                        var treeNode = self.zTree.getSelectedNodes()[0];
                        self.zTree.removeNode(treeNode, false);
                      }
                    }
                  );
                });
                return false;
              },
              beforeRename: function (treeId, treeNode, newName, isCancel) {
                if (newName.length == 0) {
                  setTimeout(function () {
                    self.zTree.cancelEditName();
                    self.DiyCommon.TopTips("节点名称不能为空!");
                  }, 0);
                  return false;
                }
                var param = {
                  Id: treeNode.Id,
                  // Key: newName,
                  Value: newName
                };
                self.DiyCommon.Post(self.DiyApi.UptSysBaseData(), param, function (data3) {
                  if (self.DiyCommon.Result(data3)) {
                    self.DiyCommon.Tips(self.$t("Msg.Success"));
                  }
                });
                return true;
              }
            }
          };
          self.zTree = $.fn.zTree.init($("#basedataTree"), setting, result.Data);
          // self.zTree.expandAll(true);
        }
      });
    }
  }
};
</script>

<style>
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

.avatar-uploader-icon {
  font-size: 28px;
  color: #8c939d;
  width: 178px;
  height: 178px;
  line-height: 178px;
  text-align: center;
}

.avatar {
  width: 178px;
  height: 178px;
  display: block;
}
</style>
