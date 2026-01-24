<template>
    <div id="diy-table" class="pluginPage">
        <el-row>
            <el-col :span="24">
                <el-card class="box-card no-padding-body">
                    <el-form :model="SearchModel" inline @submit.prevent class="keyword-search">
                        <el-form-item :label="$t('Msg.Keyword')">
                            <el-input v-model="SearchModel.Keyword" @keyup.enter="GetSysLog(true)" />
                        </el-form-item>
                        <el-form-item :label="''">
                            <el-date-picker v-model="SearchModel.Month" type="month" format="yyyy年MM月" value-format="yyyyMM" placeholder="选择月份"> </el-date-picker>
                        </el-form-item>
                        <el-form-item :label="'日志级别'">
                            <el-input-number v-model="SearchModel.Level" controls-position="right"></el-input-number>
                        </el-form-item>
                        <el-form-item>
                            <el-button :icon="Search" @click="GetSysLog(true)">{{ $t("Msg.Search") }}</el-button>
                        </el-form-item>
                    </el-form>
                    <el-table v-loading="tableLoading" :data="SysLogList" style="width: 100%" class="diy-table no-border-outside" stripe border>
                        <el-table-column type="index" width="50" />
                        <el-table-column label="日志类型" width="150">
                            <template #default="scope">
                                {{ scope.row.Type }}
                            </template>
                        </el-table-column>
                        <el-table-column label="标题" width="400">
                            <template #default="scope">
                                <span :title="scope.row.Title">{{ scope.row.Title }}</span>
                            </template>
                        </el-table-column>
                        <el-table-column label="内容" width="400">
                            <template #default="scope">
                                <!-- <span :title="scope.row.Content">{{ scope.row.Content }}</span>-->
                                <el-tooltip effect="light" placement="bottom">
                                    <template #content><div style="max-width: 500px">
                                        {{ scope.row.Content }}
                                    </div>
                                    <div>{{ scope.row.Content }}</div>
                                    </template>
                                </el-tooltip>
                            </template>
                        </el-table-column>
                        <el-table-column prop="UserName" label="用户" width="120" />
                        <el-table-column prop="Api" label="Api">
                            <template #default="scope">
                                <el-tooltip effect="light" placement="bottom">
                                    <template #content><div style="max-width: 500px">
                                        {{ scope.row.Api }}
                                    </div>
                                    <div>{{ scope.row.Api }}</div>
                                    </template>
                                </el-tooltip>
                            </template>
                        </el-table-column>
                        <el-table-column prop="Param" label="Param">
                            <template #default="scope">
                                <el-tooltip effect="light" placement="bottom">
                                    <template #content><div style="max-width: 500px">
                                        {{ scope.row.Param }}
                                    </div>
                                    <div>{{ scope.row.Param }}</div>
                                    </template>
                                </el-tooltip>
                            </template>
                        </el-table-column>
                        <el-table-column prop="Timer" label="Timer" />
                        <el-table-column prop="Level" label="Level" />
                        <el-table-column prop="IP" label="IP" width="120" />
                        <el-table-column prop="Mac" label="Mac地址" width="130" />
                        <el-table-column prop="OtherInfo" label="其它信息">
                            <template #default="scope">
                                <el-tooltip effect="light" placement="bottom">
                                    <template #content><div style="max-width: 500px">
                                        {{ scope.row.OtherInfo }}
                                    </div>
                                    <div>{{ scope.row.OtherInfo }}</div>
                                    </template>
                                </el-tooltip>
                            </template>
                        </el-table-column>
                        <el-table-column prop="AppId" label="AppId" />
                        <el-table-column prop="Remark" label="备注" />
                        <el-table-column prop="CreateTime" label="创建时间" width="150" />
                    </el-table>

                    <el-pagination
                        style="margin-top: 10px; float: left; margin-bottom: 10px; clear: both"
                        background
                        layout="total, sizes, prev, pager, next, jumper"
                        :total="SysLogCount"
                        :page-size="SysLogPageSize"
                        @size-change="SysLogSizeChange"
                        @current-change="SysLogCurrentChange"
                    />
                </el-card>
            </el-col>
        </el-row>
    </div>
</template>

<script>
import _ from "underscore";
export default {
    name: "sys_log",
    directives: {
    },
    data() {
        return {
            tableLoading: true,
            ShowEditModelTitle: "",
            ShowEditModel: false,
            SearchModel: {
                Keyword: "",
                Month: new Date().Format("yyyyMM"),
                Level: undefined
            },
            SysLogList: [],
            CurrentSysLogModel: {},
            SysLogCount: 0,
            SysLogPageSize: 10,
            SysLogPageIndex: 1
        };
    },
    mounted() {
        var self = this;
        self.GetSysLog(true);
    },
    methods: {
        SysLogCurrentChange(val) {
            var self = this;
            self.SysLogPageIndex = val;
            self.GetSysLog();
        },
        SysLogSizeChange(val) {
            var self = this;
            self.SysLogPageSize = val;
            self.SysLogPageIndex = 1;
            self.GetSysLog(true);
        },
        GetSysLog(initPageIndex) {
            var self = this;
            if (initPageIndex === true) {
                self.SysLogPageIndex = 1;
            }
            self.tableLoading = true;
            self.DiyCommon.Post(
                "/api/syslog/GetSysLog",
                {
                    // OsClient: self.OsClient,
                    _PageSize: self.SysLogPageSize,
                    _PageIndex: self.SysLogPageIndex,
                    _Keyword: self.SearchModel.Keyword,
                    _SearchMonth: self.SearchModel.Month,
                    Level: self.SearchModel.Level
                },
                function (result) {
                    self.tableLoading = false;
                    if (self.DiyCommon.Result(result)) {
                        result.Data.forEach((item) => {
                            item.CreateTime = new Date(item.CreateTime).AddTime("H", 8).Format("yyyy-MM-dd HH:mm:ss");
                        });
                        self.SysLogList = result.Data;
                        self.SysLogCount = result.DataCount;
                    }
                }
            );
        }
    }
};
</script>

<style></style>
