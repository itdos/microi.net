<template>
    <div id="divSysMenuManage" class="pluginPage">
        <el-row>
            <el-col :span="24">
                <el-card class="box-card no-padding-body">
                    <el-form :model="SearchModel" inline @submit.prevent class="keyword-search">
                        <!-- <el-form-item
                        :label="$t('Msg.Keyword')"
                       >
                        <el-input
                            v-model="SearchModel.Keyword"
                            @keyup.enter="GetSysMenu()" />
                    </el-form-item> -->
                        <el-form-item>
                            <!-- <el-button
                            :icon="Search"
                            @click="GetSysMenu()">{{ $t('Msg.Search') }}</el-button> -->
                            <el-button type="primary" :icon="Plus" @click="OpenMenuForm()">{{ $t("Msg.Add") }}</el-button>
                        </el-form-item>
                    </el-form>
                    <el-table
                        v-loading="tableLoading"
                        :data="SysMenuList"
                        row-key="Id"
                        :tree-props="{ children: '_Child' }"
                        class="table-sysmenu diy-table no-border-outside"
                        style="width: 100%"
                        stripe
                        border
                    >
                        <el-table-column type="index" label="排序" width="70">
                            <template #default="scope">
                                {{ scope.row.Sort }}
                            </template>
                        </el-table-column>
                        <el-table-column label="名称" width="180">
                            <template #default="scope">
                                <span
                                    :style="{
                                        marginLeft: (DiyCommon.IsNull(scope.row._Child) || scope.row._Child.length == 0) && scope.row.ParentId == DiyCommon.GuidEmpty ? '26px' : '0px'
                                    }"
                                >
                                    {{ scope.row.Name }}
                                </span>
                            </template>
                        </el-table-column>
                        <el-table-column label="图标" width="70">
                            <template #default="scope">
                                <fa-icon :class="DiyCommon.IsNull(scope.row.IconClass) ? 'icon' : scope.row.IconClass"></fa-icon>
                            </template>
                        </el-table-column>
                        <el-table-column label="模块引擎Key" width="200">
                            <template #default="scope">
                                {{ scope.row.ModuleEngineKey }}
                            </template>
                        </el-table-column>
                        <el-table-column prop="EnName" label="英文名称" width="180"></el-table-column>
                        <el-table-column prop="Description" label="描述" />
                        <el-table-column prop="Url" label="地址" />
                        <el-table-column label="PC显示">
                            <template #default="scope">
                                <!-- <el-checkbox disabled v-model="scope.row.Display"></el-checkbox> -->
                                <el-switch v-model="scope.row.Display" disabled active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                            </template>
                        </el-table-column>
                        <el-table-column label="移动端显示">
                            <template #default="scope">
                                <!-- <el-checkbox disabled v-model="scope.row.Display"></el-checkbox> -->
                                <el-switch v-model="scope.row.AppDisplay" disabled active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                            </template>
                        </el-table-column>
                        <el-table-column label="微服务">
                            <template #default="scope">
                                <!-- <el-checkbox disabled v-model="scope.row.IsMicroiService"></el-checkbox> -->
                                <el-switch v-model="scope.row.IsMicroiService" disabled active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                            </template>
                        </el-table-column>
                        <el-table-column prop="CreateTime" label="创建时间" width="200" />
                        <el-table-column fixed="right" label="操作" width="180">
                            <template #default="scope">
                                <el-button type="primary" class="marginRight5" :icon="QuestionFilled" @click="OpenMenuForm(scope)">{{ $t("Msg.Edit") }}</el-button>
                                <el-dropdown trigger="click">
                                    <el-button>
                                        {{ $t("Msg.More") }}
                                        <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                                    </el-button>
                                    <template #dropdown
                                        ><el-dropdown-menu class="table-more-btn">
                                            <el-dropdown-item :icon="Delete" divided @click="DelSysMenu(scope.row)">{{ $t("Msg.Delete") }}</el-dropdown-item>
                                        </el-dropdown-menu></template
                                    >
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
        <DiyModule ref="refDiyModule"></DiyModule>
    </div>
</template>

<script>
import { computed } from "vue";
import { useDiyStore } from "@/pinia";
import _ from "underscore";
import { DiyModule } from "@/utils/microi.net.import";

export default {
    components: {
        DiyModule
    },
    directives: {},

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
        return {
            diyStore,
            GetCurrentUser,
            DesktopBg,
            CurrentTime,
            LoginCover,
            OsClient,
            Lang,
            EnableEnEdit,
            SystemStyle
        };
    },
    destroyed() {},
    mounted() {
        var self = this;
        self.Init();
    },
    data() {
        return {
            DefaultOrderBy: "",
            DefaultOrderByType: "",
            MenuListTotal: 0,
            MenuPageSize: 10,
            MenuPageIndex: 1,

            tableLoading: false,
            // iTdos: iTdos,
            SearchModel: {
                Keyword: ""
            },
            SysMenuList: []
        };
    },
    methods: {
        Init() {
            var self = this;
            self.GetSysMenu();
            self.$nextTick(function () {});
        },
        ManuSizeChange(val) {
            var self = this;
            self.MenuPageSize = val;
            localStorage.setItem("Microi.SysMenuPageSize", val);
            self.MenuPageIndex = 1;
            self.GetSysMenu();
        },
        ManuPageChange(val) {
            var self = this;
            self.MenuPageIndex = val;
            self.GetSysMenu();
        },
        async OpenMenuForm(scope) {
            var self = this;
            self.$refs.refDiyModule.Init(scope ? scope.row.Id : null);
        },
        DelSysMenu(m) {
            var self = this;
            self.DiyCommon.OsConfirm(self.$t("Msg.ConfirmDel") + self.$t("Msg.Menu") + "【" + m.Name + "】？", function () {
                self.DiyCommon.Post(
                    self.DiyApi.DelSysMenu(),
                    {
                        Id: m.Id,
                        OsClient: self.OsClient
                    },
                    function (data1) {
                        if (self.DiyCommon.Result(data1)) {
                            self.DiyCommon.Tips(self.$t("Msg.Success"));
                            self.GetSysMenu();
                        }
                    }
                );
            });
        },
        GetSysMenu(initPageIndex) {
            var self = this;
            self.tableLoading = true;
            if (initPageIndex === true) {
                self.MenuPageIndex = 1;
            }
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
                    _PageIndex: self.MenuPageIndex,
                    _PageSize: self.MenuPageSize,
                    _OrderBy: "Sort",
                    _OrderByType: "ASC"
                },
                function (result) {
                    if (self.DiyCommon.Result(result)) {
                        self.MenuListTotal = result.DataCount;

                        // result.Data.forEach((data) => {
                        //     self.DiyCommon.ForConvertSysMenu(data);
                        // });

                        self.SysMenuList = result.Data;
                    }
                    self.tableLoading = false;
                }
            );
        }
    }
};
</script>

<style lang="scss"></style>
