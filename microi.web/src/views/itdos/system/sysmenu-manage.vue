<template>
  <div id="divSysMenuManage" class="pluginPage">
    <el-row>
      <el-col :span="24">
        <el-card class="box-card no-padding-body">
          <el-form
            size="mini"
            :model="SearchModel"
            inline
            @submit.native.prevent
            class="keyword-search"
          >
            <!-- <el-form-item
                        :label="$t('Msg.Keyword')"
                        size="mini">
                        <el-input
                            v-model="SearchModel.Keyword"
                            @keyup.enter.native="GetSysMenu()" />
                    </el-form-item> -->
            <el-form-item size="mini">
              <!-- <el-button
                            icon="el-icon-search"
                            @click="GetSysMenu()">{{ $t('Msg.Search') }}</el-button> -->
              <el-button
                type="primary"
                icon="el-icon-plus"
                @click="OpenMenuForm()"
                >{{ $t("Msg.Add") }}</el-button
              >
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
              <template slot-scope="scope">
                {{ scope.row.Sort }}
              </template>
            </el-table-column>
            <el-table-column label="名称" width="180">
              <template slot-scope="scope">
                <span
                  :style="{
                    marginLeft:
                      (DiyCommon.IsNull(scope.row._Child) ||
                        scope.row._Child.length == 0) &&
                      scope.row.ParentId == DiyCommon.GuidEmpty
                        ? '26px'
                        : '0px',
                  }"
                >
                  {{ scope.row.Name }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="图标" width="70">
              <template slot-scope="scope">
                <i
                  :class="
                    DiyCommon.IsNull(scope.row.IconClass)
                      ? 'icon'
                      : 'icon ' + scope.row.IconClass
                  "
                ></i>
              </template>
            </el-table-column>
            <el-table-column label="模块引擎Key" width="200">
              <template slot-scope="scope">
                {{ scope.row.ModuleEngineKey }}
              </template>
            </el-table-column>
            <el-table-column
              prop="EnName"
              label="英文名称"
              width="180"
            ></el-table-column>
            <el-table-column prop="Description" label="描述" />
            <el-table-column prop="Url" label="地址" />
            <el-table-column label="PC显示">
              <template slot-scope="scope">
                <!-- <el-checkbox disabled v-model="scope.row.Display"></el-checkbox> -->
                <el-switch
                  v-model="scope.row.Display"
                  disabled
                  active-color="#ff6c04"
                  :active-value="1"
                  :inactive-value="0"
                  inactive-color="#ccc"
                />
              </template>
            </el-table-column>
            <el-table-column label="移动端显示">
              <template slot-scope="scope">
                <!-- <el-checkbox disabled v-model="scope.row.Display"></el-checkbox> -->
                <el-switch
                  v-model="scope.row.AppDisplay"
                  disabled
                  active-color="#ff6c04"
                  :active-value="1"
                  :inactive-value="0"
                  inactive-color="#ccc"
                />
              </template>
            </el-table-column>
            <el-table-column label="微服务">
              <template slot-scope="scope">
                <!-- <el-checkbox disabled v-model="scope.row.IsMicroiService"></el-checkbox> -->
                <el-switch
                  v-model="scope.row.IsMicroiService"
                  disabled
                  active-color="#ff6c04"
                  :active-value="1"
                  :inactive-value="0"
                  inactive-color="#ccc"
                />
              </template>
            </el-table-column>
            <el-table-column prop="CreateTime" label="创建时间" width="200" />
            <el-table-column fixed="right" label="操作" width="180">
              <template slot-scope="scope">
                <el-button
                  type="primary"
                  size="mini"
                  class="marginRight5"
                  icon="el-icon-s-help"
                  @click="OpenMenuForm(scope)"
                  >{{ $t("Msg.Edit") }}</el-button
                >
                <el-dropdown trigger="click">
                  <el-button>
                    {{ $t("Msg.More") }}
                    <i class="el-icon-arrow-down el-icon--right" />
                  </el-button>
                  <el-dropdown-menu slot="dropdown" class="table-more-btn">
                    <el-dropdown-item
                      icon="el-icon-delete"
                      divided
                      @click.native="DelSysMenu(scope.row)"
                      >{{ $t("Msg.Delete") }}</el-dropdown-item
                    >
                  </el-dropdown-menu>
                </el-dropdown>
              </template>
            </el-table-column>
          </el-table>

          <el-pagination
            style="
              margin-top: 10px;
              float: left;
              margin-bottom: 10px;
              clear: both;
            "
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
import { mapState, mapMutations, mapGetters } from "vuex";
import _ from "underscore";
import { DiyModule } from "@/utils/microi.net.import";

export default {
  components: {
    DiyModule,
  },
  directives: {},

  beforeCreate() {},
  computed: {
    GetCurrentUser: function () {
      return this.$store.getters["DiyStore/GetCurrentUser"];
    },
    ...mapGetters({}),
    ...mapState({
      DesktopBg: (state) => state.DiyStore.DesktopBg,
      CurrentTime: (state) => state.DiyStore.CurrentTime,
      LoginCover: (state) => state.DiyStore.LoginCover,
      OsClient: (state) => state.DiyStore.OsClient,
      Lang: (state) => state.DiyStore.Lang,
      EnableEnEdit: (state) => state.DiyStore.EnableEnEdit,
      SystemStyle: (state) => state.DiyStore.SystemStyle,
    }),
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
        Keyword: "",
      },
      SysMenuList: [],
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
      localStorage.setItem("SysMenuPageSize", val);
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
      self.DiyCommon.OsConfirm(
        self.$t("Msg.ConfirmDel") +
          self.$t("Msg.Menu") +
          "【" +
          m.Name +
          "】？",
        function () {
          self.DiyCommon.Post(
            self.DiyApi.DelSysMenu(),
            {
              Id: m.Id,
              OsClient: self.OsClient,
            },
            function (data1) {
              if (self.DiyCommon.Result(data1)) {
                self.DiyCommon.Tips(self.$t("Msg.Success"));
                self.GetSysMenu();
              }
            }
          );
        }
      );
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
            "Sort",
          ],
          TableName: "Sys_Menu",
          _PageIndex: self.MenuPageIndex,
          _PageSize: self.MenuPageSize,
          _OrderBy: "Sort",
          _OrderByType: "ASC",
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
    },
  },
};
</script>

<style lang="scss"></style>
