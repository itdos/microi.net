<template>
  <div>
    <div style="height: 40px">
      <el-button
        type="primary"
        @click="ShowWorkFlowDesign = true"
        icon="el-icon-info"
        >查看流程图</el-button
      >
    </div>
    <div class="workflow-history">
      <el-timeline style="padding-left: 2px">
        <el-timeline-item
          v-for="(history, index) in WFHistoryList"
          :key="history.Id"
          :icon="'el-icon-more'"
          :type="'primary'"
          :color="'#0bbd87'"
          :size="'large'"
          :timestamp="history.CreateTime"
        >
          <div slot="dot">
            <el-avatar :size="'small'" :src="history.SenderAvatar"></el-avatar>
          </div>
          <div
            :style="{
              color:
                history.ApprovalType == 'Disagree' ||
                history.ApprovalType == 'Recall' ||
                history.ApprovalType == 'Cancel'
                  ? 'red'
                  : '#303133'
            }"
          >
            <div style="padding-top: 2px">
              <!-- <i class="el-icon-user-solid"></i>  -->
              {{ history.Sender }}
              <el-tag
                v-if="GetApprovalTypeStr(history)"
                :type="GetApprovalTypeTag(history)"
                >{{ GetApprovalTypeStr(history) }}</el-tag
              >
              <el-tag>{{ history.FromNodeName }}</el-tag>
            </div>
            <div style="margin-top: 5px; color: #666">
              {{
                DiyCommon.IsNull(history.ApprovalIdea)
                  ? GetApprovalTypeStr(history)
                  : history.ApprovalIdea
              }}
            </div>
            <div style="margin-top: 5px" v-if="history.Receivers.length > 0">
              <div>
                <el-divider content-position="left" style="color: #666"
                  ><el-tag>接收人</el-tag></el-divider
                >
              </div>
              <div>
                <div
                  v-for="(copyUser, index2) in history.Receivers"
                  :key="'receiveUser_' + copyUser.Id"
                  style="
                    text-align: center;
                    margin-bottom: 5px;
                    margin-right: 5px;
                    float: left;
                  "
                >
                  <!-- <el-tooltip class="item" effect="dark" :content="copyUser.Name" placement="bottom" style="height:28px;"> -->
                  <el-tag class="user-item" type="danger">
                    <div class="user-item-avatar">
                      <el-avatar
                        :size="'small'"
                        :src="copyUser.Avatar"
                        shape="circle"
                        style="width: 22px; height: 22px"
                      >
                      </el-avatar>
                    </div>
                    <div class="user-item-name">{{ copyUser.Name }}</div>
                  </el-tag>
                  <!-- </el-tooltip> -->
                </div>
              </div>

              <div class="clear"></div>
            </div>
            <div style="margin-top: 5px" v-if="history.CopyUsers.length > 0">
              <div>
                <el-divider content-position="left"
                  ><el-tag>抄送人</el-tag></el-divider
                >
              </div>
              <div>
                <!-- <span v-for="(copyUser, index2) in history.CopyUsers"
                            :key="'copyUser_' + copyUser.Id"
                            style="text-align:center;margin-bottom:10px;margin-right:5px;float:left;">
                            <el-tooltip class="item" effect="dark" :content="copyUser.Name" placement="bottom" style="height:28px;">
                                <el-avatar 
                                    :size="'small'" 
                                    :src="copyUser.Avatar" 
                                    shape="square"
                                    style="width:28px;height:28px;">
                                </el-avatar>
                            </el-tooltip>
                        </span> -->
                <div
                  v-for="(copyUser, index2) in history.CopyUsers"
                  :key="'receiveUser_' + copyUser.Id"
                  style="
                    text-align: center;
                    margin-bottom: 5px;
                    margin-right: 5px;
                    float: left;
                  "
                >
                  <!-- <el-tooltip class="item" effect="dark" :content="copyUser.Name" placement="bottom" style="height:28px;"> -->
                  <el-tag class="user-item" type="danger">
                    <div class="user-item-avatar">
                      <el-avatar
                        :size="'small'"
                        :src="copyUser.Avatar"
                        shape="circle"
                        style="width: 22px; height: 22px"
                      >
                      </el-avatar>
                    </div>
                    <div class="user-item-name">{{ copyUser.Name }}</div>
                  </el-tag>
                  <!-- </el-tooltip> -->
                </div>
              </div>
              <div class="clear"></div>
            </div>
          </div>
        </el-timeline-item>
      </el-timeline>
    </div>
    <el-dialog
      v-el-drag-dialog
      title="查看流程图"
      :visible.sync="ShowWorkFlowDesign"
      :width="'80%'"
      :height="'70%'"
      :modal-append-to-body="false"
      :close-on-click-modal="false"
      append-to-body
    >
      <WFDesignPreview
        v-if="!DiyCommon.IsNull(CurrentFlowDesignId)"
        :props-flow-table-row-id="CurrentFlowDesignId"
        :props-current-node-id="CurrentNodeId"
      >
      </WFDesignPreview>
      <span slot="footer" class="dialog-footer">
        <el-button @click="ShowWorkFlowDesign = false">关闭</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import { mapState, mapGetters, mapMutations, mapActions } from "vuex";
import elDragDialog from "@/directive/el-drag-dialog";
import _ from "underscore";
export default {
  name: "WFHistory",
  directives: {
    elDragDialog
  },
  components: {},
  computed: {
    GetCurrentUser: function () {
      return this.$store.getters["DiyStore/GetCurrentUser"];
    },
    ...mapState({
      OsClient: (state) => state.DiyStore.OsClient
    })
  },
  props: {},
  watch: {},
  data() {
    return {
      ShowWorkFlowDesign: false,
      CurrentFlowDesignId: "",
      CurrentFlowId: "",
      CurrentNodeId: "",
      WFHistoryList: []
    };
  },
  mounted() {
    var self = this;
  },
  methods: {
    /**
     * 传入 CurrentFlowId
     */
    Init(param) {
      var self = this;
      self.CurrentFlowDesignId = param.CurrentFlowDesignId;
      self.CurrentFlowId = param.CurrentFlowId;
      self.CurrentNodeId = param.CurrentNodeId;

      self.WFHistoryList = [];

      if (!self.DiyCommon.IsNull(self.CurrentFlowId)) {
        var loadingHistoryList = self.$loading({
          target: ".workflow-history",
          text: "加载流程历史轨迹..."
        });
        self.DiyCommon.Post(
          "/api/WorkFlow/getWFHistory",
          { FlowId: self.CurrentFlowId },
          function (result2) {
            if (self.DiyCommon.Result(result2)) {
              var userIds = [];
              result2.Data.forEach((history) => {
                if (!(userIds.indexOf(history.SenderId) > -1)) {
                  userIds.push(history.SenderId);
                }
                if (!self.DiyCommon.IsNull(history.CopyUsers)) {
                  try {
                    history.CopyUsers = JSON.parse(history.CopyUsers);
                    history.CopyUsers.forEach((copyUser) => {
                      userIds.push(copyUser.Id);
                    });
                  } catch (error) {
                    history.CopyUsers = [];
                  }
                } else {
                  history.CopyUsers = [];
                }
                if (!self.DiyCommon.IsNull(history.Receivers)) {
                  try {
                    history.Receivers = JSON.parse(history.Receivers);
                    history.Receivers.forEach((copyUser) => {
                      userIds.push(copyUser.Id);
                    });
                  } catch (error) {
                    history.Receivers = [];
                  }
                } else {
                  history.Receivers = [];
                }
              });
              //获取头像。也可以改为服务器端处理，但无法使用inner join user表解决问题，因为还有CopyUsers、Receivers等JSON里面的用户头像。
              self.DiyCommon.Post(
                "/api/SysUser/getSysUserPublicInfo",
                { Ids: userIds },
                function (result3) {
                  if (self.DiyCommon.Result(result3)) {
                    result2.Data.forEach((history) => {
                      var searchUser = _.where(result3.Data, {
                        Id: history.SenderId
                      });
                      if (searchUser && searchUser.length > 0) {
                        if (!self.DiyCommon.IsNull(searchUser[0].Avatar)) {
                          history.SenderAvatar = self.DiyCommon.GetServerPath(
                            searchUser[0].Avatar
                          );
                        } else {
                          history.SenderAvatar = self.DiyCommon.GetServerPath(
                            "./static/img/icon/personal.png"
                          );
                        }
                      }
                      history.CopyUsers.forEach((copyUser) => {
                        var searchUser = _.where(result3.Data, {
                          Id: copyUser.Id
                        });
                        if (searchUser && searchUser.length > 0) {
                          if (!self.DiyCommon.IsNull(searchUser[0].Avatar)) {
                            copyUser.Avatar = self.DiyCommon.GetServerPath(
                              searchUser[0].Avatar
                            );
                          } else {
                            copyUser.Avatar = self.DiyCommon.GetServerPath(
                              "./static/img/icon/personal.png"
                            );
                          }
                        }
                      });
                      history.Receivers.forEach((copyUser) => {
                        var searchUser = _.where(result3.Data, {
                          Id: copyUser.Id
                        });
                        if (searchUser && searchUser.length > 0) {
                          if (!self.DiyCommon.IsNull(searchUser[0].Avatar)) {
                            copyUser.Avatar = self.DiyCommon.GetServerPath(
                              searchUser[0].Avatar
                            );
                          } else {
                            copyUser.Avatar = self.DiyCommon.GetServerPath(
                              "./static/img/icon/personal.png"
                            );
                          }
                        }
                      });
                    });
                    self.WFHistoryList = result2.Data;
                    loadingHistoryList.close();
                  }
                }
              );
            }
          }
        );
      }
    },
    GetApprovalTypeStr(history) {
      var self = this;
      if (history.ApprovalType == "Agree") {
        return "同意";
      } else if (history.ApprovalType == "Disagree") {
        return "不同意";
      } else if (history.ApprovalType == "Auto") {
        return "";
      } else if (history.ApprovalType == "Recall") {
        return "撤回";
      } else if (history.ApprovalType == "Cancel") {
        return "作废";
      } else if (history.ApprovalType == "HandOver") {
        return "移交";
      } else {
        return "";
      }
    },
    GetApprovalTypeTag(history) {
      var self = this;
      if (history.ApprovalType == "Agree") {
        return "success";
      } else if (history.ApprovalType == "Disagree") {
        return "danger";
      } else if (history.ApprovalType == "Auto") {
        return "success";
      } else if (history.ApprovalType == "Recall") {
        return "warning";
      } else if (history.ApprovalType == "Cancel") {
        return "warning";
      } else if (history.ApprovalType == "HandOver") {
        return "info";
      } else {
        return "";
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.workflow-history {
  .el-divider__text {
    background-color: rgb(245, 247, 250);
    color: rgb(48, 49, 51);
    font-weight: normal;
  }
  .user-item {
    border-radius: 12px;
    padding-left: 0px;
    height: 24px;
    line-height: 24px;
    .user-item-avatar,
    .user-item-name {
      float: left;
    }
    .user-item-avatar {
      margin-right: 5px;
    }
  }
}
</style>
