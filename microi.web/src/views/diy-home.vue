<template>
    <div class="diy-home container-fluid" style="padding-left: 0px; padding-right: 0px">
        <div class="row">
            <div class="col-md-8">
                <div class="row">
                    <div class="col-md-6">
                        <el-card class="box-card">
                            <template #header
                                ><div class="clearfix">
                                    <span><i class="fas fa-tasks" /> 我的待办</span>
                                    <!-- <el-button style="float: right; padding: 3px 0" type="text">操作按钮</el-button> -->
                                </div></template
                            >
                            <div class="row card-body card-body-item card-body-todo">
                                <div class="col-md-6 col-xs-6 hand">
                                    <div class="item" @click="$router.push('/my-work')">
                                        <div class="title no-br">我的待办</div>
                                        <div>
                                            <count-to :start-val="0" :end-val="IndexData.WorkTodoCount" :duration="1000" class="number" />
                                        </div>
                                        <div class="icon-div">
                                            <i class="fas fa-tasks icon" />
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6 col-xs-6 hand">
                                    <div class="item" @click="SwitchDiyChatShow()">
                                        <div class="title no-br">未读消息</div>
                                        <div>
                                            <count-to :start-val="0" :end-val="IndexData.UnreadCount" :duration="1000" class="number" />
                                        </div>
                                        <div class="icon-div">
                                            <i class="fas fa-comment-dots icon" />
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6 col-xs-6 hand">
                                    <div class="item" @click="$router.push('/my-work')">
                                        <div class="title no-br">已超时</div>
                                        <div>
                                            <count-to :start-val="0" :end-val="IndexData.WorkTimeoutCount" :duration="1000" class="number" />
                                        </div>
                                        <div class="icon-div">
                                            <i class="fas fa-check-square icon" />
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6 col-xs-6 hand">
                                    <div class="item" @click="$router.push('/my-work')">
                                        <div class="title no-br">即将超时</div>
                                        <div>
                                            <count-to :start-val="0" :end-val="IndexData.WorkWillTimeoutCount" :duration="1000" class="number" />
                                        </div>
                                        <div class="icon-div">
                                            <i class="fas fa-users icon" />
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6 col-xs-6 hand">
                                    <div class="item" @click="$router.push('/my-work')">
                                        <div class="title no-br">催办</div>
                                        <div>
                                            <count-to :start-val="0" :end-val="IndexData.WorkUrgeCount" :duration="1000" class="number" />
                                        </div>
                                        <div class="icon-div">
                                            <i class="fas fa-users icon" />
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6 col-xs-6 hand">
                                    <div class="item" @click="$router.push('/my-work')">
                                        <div class="title no-br">我处理的</div>
                                        <div>
                                            <count-to :start-val="0" :end-val="IndexData.WorkMydoCount" :duration="1000" class="number" />
                                        </div>
                                        <div class="icon-div">
                                            <i class="fas fa-users icon" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </el-card>
                    </div>
                    <div class="col-md-6">
                        <el-card class="box-card">
                            <template #header
                                ><div class="clearfix">
                                    <span
                                        ><el-icon><BellFilled /></el-icon> 通知公告</span
                                    >
                                    <el-button style="float: right; padding: 3px 0" :icon="DArrowRight" type="text" @click="$router.push('/notice')">查看更多</el-button>
                                </div></template
                            >
                            <div class="row card-body card-body-item">
                                <div v-for="item in IndexData.NoticeList" :key="item.Id" class="col-md-12 col-xs-12 card-body-item-row">
                                    <div class="pull-left no-br over-hide card-body-item-row-left">
                                        <el-icon><InfoFilled /></el-icon> {{ item.Biaoti }}
                                    </div>
                                    <div class="pull-right card-body-item-row-right">
                                        {{ item.CreateTime }}
                                    </div>
                                </div>
                                <div v-if="LoadingIndexData">
                                    <el-icon><Loading /></el-icon> Loading...
                                </div>
                                <div v-if="!LoadingIndexData && IndexData.NoticeList.length == 0">无数据</div>
                                <!-- <div class="col-md-3 col-xs-6 hand" @click="$router.push('/diy-document')">
                  <div class="icon-div">
                    <i class="fab fa-windows icon" />
                  </div>
                  <div class="title no-br">平台文档</div>
                </div>
                <div class="col-md-3 col-xs-6 hand" @click="$router.push('/my-work')">
                  <div class="icon-div">
                    <i class="fas fa-palette icon" />
                  </div>
                  <div class="title no-br">我的工作</div>
                </div>
                <div class="col-md-3 col-xs-6 hand" @click="$router.push('/notice')">
                  <div class="icon-div">
                    <i class="fas fa-language icon" />
                  </div>
                  <div class="title no-br">通知公告</div>
                </div>
                <div class="col-md-3 col-xs-6 hand" @click="$router.push('/microi-upt-log')">
                  <div class="icon-div">
                    <i class="fas fa-user icon" />
                  </div>
                  <div class="title no-br">更新日志</div>
                </div>
                <div class="col-md-3 col-xs-6 hand">
                  <div class="icon-div">
                    <i class="fas fa-newspaper icon" />
                  </div>
                  <div class="title no-br">建设中</div>
                </div> -->
                            </div>
                        </el-card>
                    </div>
                    <div class="col-md-6">
                        <!-- style="min-height: calc(100vh - 410px);" -->
                        <el-card class="box-card">
                            <template #header
                                ><div class="clearfix">
                                    <span
                                        ><el-icon><Monitor /></el-icon> 我的常用</span
                                    >
                                    <!-- <el-button style="float: right;" :icon="Plus" type="primary">新增模块</el-button> -->
                                </div></template
                            >
                            <div class="row card-body card-body-item card-body-todo">
                                <div
                                    v-for="item in IndexData.MyUseMenuList"
                                    :key="item.Id"
                                    class="col-md-3 col-xs-3 card-body-item-row hand"
                                    style="text-align: center"
                                    @click="$router.push(item.Url)"
                                >
                                    <div>
                                        <fa-icon :icon="item.IconClass ? item.IconClass : 'fas fa-tasks'" style="font-size: 30px" />
                                    </div>
                                    <div>{{ item.Name }}</div>
                                </div>
                                <div v-if="LoadingIndexData">
                                    <el-icon><Loading /></el-icon> Loading...
                                </div>
                            </div>
                        </el-card>
                    </div>
                    <div class="col-md-6">
                        <!-- style="min-height: calc(100vh - 410px);" -->
                        <el-card class="box-card">
                            <template #header
                                ><div class="clearfix">
                                    <span
                                        ><el-icon><Avatar /></el-icon> 我的申请</span
                                    >
                                    <el-button style="float: right; padding: 3px 0" :icon="DArrowRight" type="text" @click="$router.push('/my-work')">查看更多</el-button>
                                </div></template
                            >
                            <div class="row card-body card-body-item">
                                <div v-for="item in IndexData.MyApplyList" :key="item.Id" class="col-md-12 col-xs-12 card-body-item-row">
                                    <div class="pull-left no-br over-hide card-body-item-row-left">
                                        <el-icon><InfoFilled /></el-icon> {{ item.FlowTitle }}
                                        <i>{{ item.FlowState }}</i>
                                    </div>
                                    <div class="pull-right card-body-item-row-right">
                                        {{ item.CreateTime }}
                                    </div>
                                </div>
                                <div v-if="LoadingIndexData">
                                    <el-icon><Loading /></el-icon> Loading...
                                </div>
                                <div v-if="!LoadingIndexData && IndexData.MyApplyList.length == 0">无数据</div>
                            </div>
                        </el-card>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <!-- <el-card class="box-card">
          <template #header><div class="clearfix">
                <span>服务器状态</span>
                <el-button style="float: right; padding: 3px 0" type="text">操作按钮</el-button>
            </div></template>
          <div class="row card-body card-body-server-state">
            <div class="col-md-4 col-xs-12 hand">
                <div class="title no-br">CPU使用率</div>
                <el-progress type="dashboard" :percentage="ServerState.CPU" :color="DashboardColors"></el-progress>
                <div class="desc">0核心</div>
            </div>
            <div class="col-md-4 col-xs-12 hand">
                <div class="title no-br">内存使用率</div>
                <el-progress type="dashboard" :percentage="ServerState.Memory" :color="DashboardColors"></el-progress>
                <div class="desc">0/8000(MB)</div>
            </div>
            <div class="col-md-4 col-xs-12 hand">
                <div class="title no-br">硬盘使用率</div>
                <el-progress type="dashboard" :percentage="ServerState.Disk" :color="DashboardColors"></el-progress>
                <div class="desc">0/40(GB)</div>
            </div>
          </div>
        </el-card> -->
                <el-card class="box-card">
                    <template #header
                        ><div class="clearfix">
                            <span
                                ><el-icon><Notebook /></el-icon> 新闻</span
                            >
                            <el-button style="float: right; padding: 3px 0" :icon="DArrowRight" type="text" @click="$router.push('/news')">查看更多</el-button>
                        </div></template
                    >
                    <div class="row card-body card-body-item">
                        <div v-for="item in IndexData.NewsList" :key="item.Id" class="col-md-12 col-xs-12 card-body-item-row">
                            <div class="pull-left no-br over-hide card-body-item-row-left">
                                <el-icon><InfoFilled /></el-icon> {{ item.Biaoti }}
                            </div>
                            <div class="pull-right card-body-item-row-right">
                                {{ item.CreateTime }}
                            </div>
                        </div>
                        <div v-if="LoadingIndexData">
                            <el-icon><Loading /></el-icon> Loading...
                        </div>
                        <div v-if="!LoadingIndexData && IndexData.NewsList.length == 0">无数据</div>
                    </div>
                </el-card>
                <!-- <el-card class="box-card">
          <template #header><div class="clearfix">
                <span><el-icon><Link /></el-icon> 发文</span>
                	<el-button style="float: right;padding: 3px 0;" :icon="DArrowRight" type="text">查看更多</el-button>
            </div></template>
          <div class="row card-body card-body-item">
            <div class="col-md-12 col-xs-12">

            </div>
          </div>
        </el-card> -->
                <el-card class="box-card">
                    <template #header
                        ><div class="clearfix">
                            <span
                                ><el-icon><Clock /></el-icon> 日程</span
                            >
                        </div></template
                    >
                    <div class="row card-body card-body-item">
                        <div class="col-md-12 col-xs-12">
                            <el-calendar v-model="CalendarData"> </el-calendar>
                        </div>
                    </div>
                </el-card>
            </div>
        </div>
    </div>
</template>

<script>
import { computed } from "vue";
import { useDiyStore, useAppStore } from "@/pinia";
// vue-count-to 不支持 Vue 3，暂时禁用
// import CountTo from "vue-count-to";
export default {
    name: "IplanIndex",
    components: {
        // CountTo  // 已禁用
    },
    setup() {
        const diyStore = useDiyStore();
        const appStore = useAppStore();

        const sidebar = computed(() => appStore.sidebar);
        const device = computed(() => appStore.device);
        const ThemeClass = computed(() => diyStore.ThemeClass);
        const ThemeBodyClass = computed(() => diyStore.ThemeBodyClass);
        const Lang = computed(() => diyStore.Lang);
        const WebTitle = computed(() => diyStore.WebTitle);
        const OsClient = computed(() => diyStore.OsClient);
        const SystemStyle = computed(() => diyStore.SystemStyle);
        const DiyChatShow = computed(() => diyStore.DiyChat?.Show);
        const SysConfig = computed(() => diyStore.SysConfig);
        const GetCurrentUser = computed(() => diyStore.GetCurrentUser);

        return {
            diyStore,
            appStore,
            sidebar,
            device,
            ThemeClass,
            ThemeBodyClass,
            Lang,
            WebTitle,
            OsClient,
            SystemStyle,
            DiyChatShow,
            SysConfig,
            GetCurrentUser
        };
    },
    data() {
        return {
            CalendarData: new Date(),
            // 存储定时器引用，用于组件销毁时清理，防止内存泄漏
            timers: [],
            ServerState: {
                CPU: 10,
                Memory: 50,
                Disk: 80
            },
            LoadingIndexData: true,
            IndexData: {
                WorkTodoCount: 0,
                UnreadCount: 0,
                WorkTimeoutCount: 0,
                WorkWillTimeoutCount: 0,
                WorkUrgeCount: 0,
                WorkMydoCount: 0,
                NoticeList: [],
                NewsList: [],
                MyUseMenuList: [],
                MyApplyList: []
            }
        };
    },
    computed: {
        WebSocketOnline: function () {
            return !(this.$websocket == null || this.$websocket.state != "Connected");
        }
    },
    created() {
        this.GetIndexData();
    },
    mounted() {
        var self = this;
        // self.TempFunc();
    },
    beforeDestroy() {
        var self = this;
        // 清理所有定时器，防止内存泄漏
        self.timers.forEach(function (timer) {
            clearInterval(timer);
        });
        self.timers = [];
    },
    methods: {
        GetIndexData() {
            var self = this;
            self.DiyCommon.ApiEngine.Run("get_index_data", {}, function (result) {
                if (result.Code == 1) {
                    self.IndexData = result.Data;
                }
                self.LoadingIndexData = false;
            });
        },
        SwitchDiyChatShow() {
            var self = this;
            self.diyStore.setDiyChatShow(true);
            if (self.DiyChatShow) {
                self.$websocket
                    .invoke("SendLastContacts", {
                        UserId: self.GetCurrentUser.Id,
                        ContactUserId: "",
                        OsClient: self.DiyCommon.GetOsClient()
                    })
                    .then((res) => {})
                    .catch((err) => {
                        console.log("获取最近联系人列表失败：", err);
                    });
            }
        },
        TempFunc() {
            var self = this;
            var temp = true;
            var timer = setInterval(function () {
                if (temp) {
                    self.ServerState.CPU += 25;
                    self.ServerState.Memory += 5;
                } else {
                    self.ServerState.CPU -= 25;
                    self.ServerState.Memory -= 5;
                }
                temp = !temp;
            }, 3000);
            // 保存定时器引用，防止内存泄漏
            self.timers.push(timer);
        },
        DashboardColors(percentage) {
            if (percentage < 80) {
                return "#1890ff";
            } else {
                return "red";
            }
        }
    }
};
</script>

<style lang="scss">
.diy-home {
    .el-progress--dashboard {
        width: 100%;
    }
    .el-progress-circle {
        height: 100% !important;
        width: 100% !important;
    }
    .box-card {
        margin-bottom: 20px;
        .card-body-item {
            padding-bottom: 0px;
            padding-top: 10px;
            padding-left: 10px;
            padding-right: 10px;
            min-height: 310px;
            display: block;
            .col-md-6 {
                margin-bottom: 20px;
            }
            .item {
                padding: 15px;
                position: relative;
                background-color: #f8f8f8;
                height: 80px;
                width: 100%;

                .number {
                    font-size: 30px;
                }

                .icon-div {
                    position: absolute;
                    opacity: 0.5;
                    font-size: 30px;
                    right: 20px;
                    top: 20px;
                }
            }
            .card-body-item-row {
                height: 30px;
                line-height: 30px;
                display: block;
                .card-body-item-row-left {
                    max-width: calc(100% - 150px);
                    i {
                        color: #999;
                        margin-right: 5px;
                    }
                }
                .card-body-item-row-right {
                    color: #999;
                }
            }
            .el-calendar-day {
                height: auto !important;
                padding: 5px;
            }
            .el-calendar__body {
                padding-bottom: 0px;
            }
        }
        .card-body-todo {
            display: flex !important;
        }
    }
    .box-card .icon-div {
        text-align: center;
    }
    .box-card .card-body-server-state {
        // padding: 0px;
        text-align: center;
        .title {
            font-size: 14px;
            line-height: 30px;
        }
        .desc {
            font-size: 12px;
            line-height: 20px;
            color: #666;
        }
    }
    .box-card .card-body-shortcut {
        min-height: 220px;
        padding-bottom: 0px;
        padding-top: 0px;
        .col-md-3 {
            margin-bottom: 20px;
        }
        .icon-div .icon {
            font-size: 30px;
            height: 55px;
            background-color: #f8f8f8;
            line-height: 55px;
            width: 100%;
        }
    }
    .box-card .card-body-shortcut .title {
        text-align: center;
        line-height: 25px;
        margin-top: 5px;
        font-size: 14px;
    }

    .box-card .el-card__body {
        padding-bottom: 5px !important;
        padding-top: 10px;
    }
}
</style>
