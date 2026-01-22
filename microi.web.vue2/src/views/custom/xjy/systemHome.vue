<template>
    <!-- class="container" -->
    <el-card style="height: calc(100vh - 120px)">
        <div style="height: calc(100vh - 260px)">
            <div class="welcome">
                <!-- <div class="avatar">
        <img src="../../assets/logo.png" alt="" />
      </div> -->
                <h1 style="font-size: 2em">欢迎登录{{ WebTitle }}系统</h1>
            </div>
            <div v-if="!GetCurrentUser.TenantId">
                <!-- :filter-method="SelectFieldFilterMethod" -->
                <el-select v-model="CurrentShangjia" @change="SelectShangjiaChange" clearable filterable style="width: 500px" placeholder="选择商家查看数据">
                    <el-option v-for="item in ShangjiaList" :key="'CurrentShangjia_' + item.Id" :label="item.TenantName" :value="item.Id">
                        <span style="float: left">{{ item.TenantName }}</span>
                        <span style="float: right; color: #8492a6; font-size: 13px">{{ item.ZhuyingCP }}</span>
                    </el-option>
                </el-select>
            </div>
            <ul class="moudle-list">
                <template v-for="(item, index) in moudleList">
                    <li :style="{ background: item.background }" v-if="moudleListDisplay(item)" :key="index">
                        <h4>{{ item.name }}</h4>
                        <!-- 本月、本季、本年、所有 -->
                        <div class="info-items">
                            <dl style="cursor: pointer" @click="GotoListPage(item, 'MonthCount')">
                                <dt>本月新增</dt>
                                <dd>{{ item.MonthCount }}</dd>
                            </dl>
                            <dl style="cursor: pointer" @click="GotoListPage(item, 'QuarterCount')">
                                <dt>本季新增</dt>
                                <dd>{{ item.QuarterCount }}</dd>
                            </dl>

                            <dl style="cursor: pointer" @click="GotoListPage(item, 'YearCount')">
                                <dt>本年新增</dt>
                                <dd>{{ item.YearCount }}</dd>
                            </dl>

                            <dl style="cursor: pointer" @click="GotoListPage(item, 'YearCount')">
                                <dt>所有</dt>
                                <dd>{{ item.AllCount }}</dd>
                            </dl>
                        </div>
                        <i :class="`icon-${item.icon} iconfonts`" />
                    </li>
                </template>
            </ul>
        </div>
        <div style="height: 55px; line-height: 55px; text-align: center; border-top: 1px dashed #dcdfe6; margin-top: 50px; color: rgba(0, 0, 0, 0.45); font-size: 14px">
            ©Copyright 集福鲤管理平台 2022
        </div>
    </el-card>
</template>

<script>
import { mapState, mapGetters, mapMutations, mapActions } from "vuex";
export default {
    data() {
        return {
            ShangjiaList: [],
            CurrentShangjia: "",
            moudleList: [
                {
                    name: "商家",
                    background: "#1bc98e",
                    type: "Shangjia",
                    icon: "commodity",
                    AllCount: "...",
                    MonthCount: "...",
                    QuarterCount: "...",
                    YearCount: "..."
                },
                {
                    name: "订单",
                    background: "#e64758",
                    type: "Dingdan",
                    icon: "order",
                    AllCount: "...",
                    MonthCount: "...",
                    QuarterCount: "...",
                    YearCount: "..."
                },
                {
                    name: "商品",
                    background: "#00c4ff",
                    type: "Shangpin",
                    icon: "clue",
                    AllCount: "...",
                    MonthCount: "...",
                    QuarterCount: "...",
                    YearCount: "..."
                },
                {
                    name: "合作客户",
                    background: "#7538c7",
                    type: "Kehu",
                    icon: "order",
                    AllCount: "...",
                    MonthCount: "...",
                    QuarterCount: "...",
                    YearCount: "..."
                },
                {
                    name: "非合作客户",
                    background: "#f60",
                    type: "KehuNo",
                    icon: "orderService",
                    AllCount: "...",
                    MonthCount: "...",
                    QuarterCount: "...",
                    YearCount: "..."
                },
                {
                    name: "用户",
                    background: "#388df2",
                    type: "Yonghu",
                    icon: "customer",
                    AllCount: "...",
                    MonthCount: "...",
                    QuarterCount: "...",
                    YearCount: "..."
                }
            ]
        };
    },
    computed: {
        GetCurrentUser: function () {
            return this.$store.getters["DiyStore/GetCurrentUser"];
        },
        ...mapState({
            WebTitle: (state) => state.DiyStore.WebTitle
        }),
        getModuleType() {
            return (type) => {
                const itemType = type.replace(/( |^)[a-z]/g, (L) => L.toUpperCase());
                let result = `sys${itemType}SysHomeHomeItem`;
                return result;
            };
        }
    },
    mounted() {
        var self = this;
        self.handleHome();
        self.GetShangjiaList();
    },
    methods: {
        moudleListDisplay(item) {
            var self = this;
            if (item.type == "Shangjia" && (self.GetCurrentUser.TenantId || self.CurrentShangjia)) {
                return false;
            }
            return true;
        },
        SelectShangjiaChange(val) {
            var self = this;
            self.handleHome();
        },
        GetShangjiaList() {
            var self = this;
            self.DiyCommon.Post("/api/ModuleEngine/GetTableData", { ModuleEngineKey: "Diy_Tenant" }, function (result) {
                if (self.DiyCommon.Result(result)) {
                    self.ShangjiaList = result.Data;
                }
            });
        },
        GotoListPage(item, type) {
            var self = this;
            var _searchDateTime = "";
            var date = new Date();
            if (type == "MonthCount") {
                var allDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
                allDays = allDays > 9 ? allDays : "0" + allDays;
                _searchDateTime = "CreateTime|" + date.Format("yyyy-MM-01") + "|" + new Date().Format("yyyy-MM-" + allDays);
            } else if (type == "QuarterCount") {
                _searchDateTime = "CreateTime|" + date.Format("yyyy-MM-dd") + "|" + date.Format("yyyy-MM-dd");
            }
            if (item.type == "Shangjia") {
                //商家
                self.$router.push("/shangjia?_SearchDateTime=" + _searchDateTime);
            } else if (item.type == "Dingdan") {
                //订单
                self.$router.push("/dingdan?_SearchDateTime=" + _searchDateTime);
            } else if (item.type == "Shangpin") {
                //商品
                self.$router.push("/shangpin?_SearchDateTime=" + _searchDateTime);
            } else if (item.type == "Kehu") {
                //合作客户
                self.$router.push("/kehu?_SearchDateTime=" + _searchDateTime);
            } else if (item.type == "KehuNo") {
                //非合作客户
                self.$router.push("/kehu?_SearchDateTime=" + _searchDateTime);
            } else if (item.type == "Yonghu") {
                //用户
                self.$router.push("/system-account?_SearchDateTime=" + _searchDateTime);
            }
        },
        // 获取信息
        async handleHome() {
            var self = this;
            // const res = await this.$api.sysHomeAdminHome()
            var index_report_result = await self.DiyCommon.DataSourceEngine.Run("index_report", {
                TenantId: self.CurrentShangjia
            });
            if (index_report_result.Code == 1) {
                index_report_result.Data.forEach((element) => {
                    var model = _.find(self.moudleList, function (item) {
                        return item.type == element.type;
                    });
                    model.AllCount = element.AllCount;
                    model.MonthCount = element.MonthCount;
                    model.QuarterCount = element.QuarterCount;
                    model.YearCount = element.YearCount;
                });
            } else {
                self.DiyCommon.Tips(index_report_result.Msg, false);
            }
            this.$forceUpdate();
            // for (let key in res.data) {
            //   let index = this.moudleList.findIndex(item => this.getModuleType(item.type) == key)
            //   this.moudleList[index] = {
            //     ...this.moudleList[index],
            //     ...res.data[key],
            //   }
            //   this.$forceUpdate()
            // }
        }
    }
};
</script>
<style lang="scss" scoped>
@import "./style/iconfont.css";
$base-color-white: #fff;

.welcome {
    display: flex;
    align-items: center;
    margin: 10px 0 0;
    .avatar {
        background: #cb371d;
        border-radius: 50%;
        width: 60px;
        height: 60px;
        margin-right: 20px;
        padding: 10px;
        text-align: center;
        img {
            height: 100%;
        }
    }
}

.moudle-list {
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    list-style: none;
    width: calc(100% + 20px);
    margin-left: -10px;
    li {
        max-width: calc(33.33% - 20px);
        width: calc(33.33% - 20px);
        margin: 10px;
        padding: 30px 20px;
        background: #06c;
        color: #fff;
        border-radius: 4px;
        position: relative;
        // cursor: pointer;
        .iconfonts {
            opacity: 0.2;
            position: absolute;
            top: 40px;
            left: 40px;
            color: #fff;
            font-size: 100px;
        }
        h4 {
            margin: 0 0 40px;
        }
        .info-items {
            display: flex;
            position: relative;
            z-index: 2;
            dl {
                flex: 1;
                text-align: center;
                margin: 0;
                border-right: 1px solid rgba($base-color-white, 0.3);
                &:last-child {
                    border-right: none;
                }
                dt {
                    margin-bottom: 10px;
                    font-size: 12px;
                }
                dd {
                    margin: 0;
                    font-size: 25px;
                    font-weight: bold;
                }
            }
        }
    }
}
</style>
