<template>
  <div>
    <el-card>
      <el-form inline class="keyword-search">
        <el-form-item>
          <el-input
            v-model="Keyword"
            placeholder="请输入RFID,名称,编号等"
            clearable
          />
        </el-form-item>

        <span style="padding: 0 10px">审批时间</span>
        <el-date-picker
          v-model="pandianDate"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="yyyy-MM-dd HH:mm:ss"
          :default-time="['00:00:00', '23:59:59']"
        >
        </el-date-picker>
        <!-- <span style="padding: 0 10px">单据类型</span>
            <el-select v-model="type" placeholder="请选择">
              <el-option
                v-for="item in panDianTypeList"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              >
              </el-option>
            </el-select> -->
        <el-form-item style="padding: 0 10px">
          <el-button
            type="primary"
            icon="el-icon-search"
            @click="getTableList(true)"
          >
            搜索
          </el-button>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onExportExcel">
            导出Excel
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
    <div>
      <el-table v-loading="tableLoading" stripe border :data="tableList">
        <el-table-column label="序号" width="50">
          <template slot-scope="scope">
            {{ scope.$index + 1 }}
          </template>
        </el-table-column>
        <el-table-column prop="DanjuBH" label="单据编号" />
        <el-table-column prop="PandianRWMC" label="盘点任务名称" />
        <el-table-column prop="SuoshuZZ" label="所属组织" />
        <el-table-column prop="QuyuMC" label="区域" />
        <el-table-column prop="WanchengSJ" label="完成时间" width="160" />
        <el-table-column prop="PandianBZ" label="盘点备注" />
        <el-table-column prop="PandianS" label="总数">
          <template slot-scope="scope">
            <span class="shuliang" @click="handleGetDetail(scope.row, '')">{{
              scope.row.PandianS
            }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="YipanS" label="已盘">
          <template slot-scope="scope">
            <span
              class="shuliang"
              @click="handleGetDetail(scope.row, '已盘点')"
              >{{ scope.row.YipanS }}</span
            >
          </template>
        </el-table-column>
        <el-table-column prop="PanyingS" label="盘盈">
          <template slot-scope="scope">
            <span
              class="shuliang"
              @click="handleGetDetail(scope.row, '盘盈')"
              >{{ scope.row.PanyingS }}</span
            >
          </template>
        </el-table-column>
        <el-table-column prop="PankuiS" label="盘亏">
          <template slot-scope="scope">
            <span
              class="shuliang"
              @click="handleGetDetail(scope.row, '盘亏')"
              >{{ scope.row.PankuiS }}</span
            >
          </template>
        </el-table-column>
      </el-table>
    </div>

    <pagination
      v-show="PageTotal > 0"
      :auto-scroll="false"
      :total="PageTotal"
      :page.sync="PageIndex"
      :limit.sync="PageSize"
      @pagination="(e) => getTableList(false)"
    />

    <el-dialog
      :title="tableTitle"
      :visible.sync="dialogVisible"
      width="80%"
    >
      <div style="margin: -10px 0 15px 0">
        <el-input
          v-model="tableKeyword"
          @change="handleGetDetail(rowModel, rowModel.state)"
          suffix-icon="el-icon-search"
          placeholder="请输入关键字"
          style="width: 200px"
        />
        <el-button
          type="primary"
          style="margin-left: 10px"
          @click="handleGetDetail(rowModel, rowModel.state)"
          >搜索</el-button
        >
        <el-button
          type="primary"
          style="margin-right: 10px"
          @click="handleExport2"
          >导出Excel</el-button
        >
      </div>
      <el-table stripe border :data="detailList" height="500">
        <el-table-column label="序号" width="50">
          <template slot-scope="scope">
            {{ scope.$index + 1 }}
          </template>
        </el-table-column>
        <el-table-column prop="DanjuBH" label="资产编号" />
        <el-table-column prop="ZichanMC" label="资产名称" />
        <el-table-column prop="ZichanGG" label="资产规格" />
        <el-table-column prop="Pinpai" label="品牌" />
        <el-table-column prop="PandianZT" label="盘点状态" />
        <el-table-column prop="DanjuBH" label="单据编号" />
        <el-table-column prop="PandianRWMC" label="盘点任务名称" />
        <el-table-column prop="QuyuMC" label="区域" />
        <el-table-column prop="WanchengSJ" label="完成时间" width="160"/>
      </el-table>
      <pagination
        :auto-scroll="false"
        :total="tablePageTotal"
        :page.sync="tablePageNumber"
        :limit.sync="tablePageSize"
        @pagination="(e) => handleGetDetail(rowModel, rowModel.state)"
      />
      <span slot="footer" class="dialog-footer"> </span>
    </el-dialog>
  </div>
</template>
  
  <script>
import Pagination from "@/components/Pagination";
import elDragDialog from "@/directive/el-drag-dialog";
import qs from "qs";

export default {
  name: "YuBaoFeiList",
  directives: {
    elDragDialog,
  },
  components: {
    Pagination,
  },
  computed: {
    getTypeColor() {
      return (state) => {
        let classVal = "";
        if (state == "在用中") {
          classVal = "type blue";
        } else if (state == "闲置中") {
          classVal = "type green";
        } else if (state == "借用中") {
          classVal = "type info";
        } else {
          classVal = "type";
        }
        return classVal;
      };
    },
  },
  data() {
    return {
      Keyword: "",
      BtnAddLoading: false,
      ShowAllSearch: true,

      tableLoading: false,
      tableList: [],
      _OrderBy: "",
      _OrderByType: "",
      PageIndex: 1,
      PageSize: 10,
      PageTotal: 0,

      type: "",
      pandianDate: "",
      panDianTypeList: [
        { label: "全部", value: "" },
        { label: "已盘点", value: "已盘点" },
        { label: "盘盈", value: "盘盈" },
        { label: "盘亏", value: "盘亏" },
      ],

      dialogVisible: false,
      detailList: [],
      tableKeyword: "",
      tableTitle: "",
      rowModel: {},
      tablePageNumber: 1,
      tablePageSize: 10,
      tablePageTotal: 0,
    };
  },

  async mounted() {
    this.getTableList();
  },

  methods: {
    async onExportExcel() {
      let payload = {
        keyword: this.Keyword,
        Type: this.type,
        StatTime: this.startTime,
        EndTime: this.endTime,
        TenantId: this.$getCurrentUser.TenantId,
      };
      const url = `${this.$apiHost}/export/export_zichan_pandianrenwu_report?` + qs.stringify(payload);
      window.open(url);
    },
    handleExport2() {
      let payload = {
        PandanrwId:this.rowModel.Id,
        Keyword: this.tableKeyword,
        Type: this.rowModel.state,
        TenantID: localStorage.getItem('TenantId')
      };
      const url = `${this.$apiHost}/export/export_zichan_pandianjieguo_report?` + qs.stringify(payload);
      window.open(url);
    },
    //获取列表
    async getTableList(init = false) {
      let self = this;
      this.startTime = this.$moment(new Date())
        .startOf("month")
        .format("YYYY-MM-DD 00:00:00");
      this.endTime = this.$moment(new Date())
        .endOf("month")
        .format("YYYY-MM-DD 23:59:59");
      this.pandianDate = [this.startTime, this.endTime];
      if (init) {
        this.PageIndex = 1;
        this.PageSize = 10;
        this.PageTotal = 0;
      }
      const payload = {
        Keyword: this.Keyword,
        Type: this.type,
        PageIndex: this.PageIndex,
        PageSize: this.PageSize,
        StatTime: this.startTime,
        EndTime: this.endTime,
        TenantID: this.$getCurrentUser.TenantId,
      };
      this.tableLoading = true;
      this.DiyCommon.Post(
        `${self.$apiHost}/zichan/get_zichan_pandianrenwu`,
        payload,
        function (result) {
          if (result.Code == 1) {
            self.tableList = result.Data;
            self.PageTotal = result.DataCount;
            self.tableLoading = false;
          } else {
            self.tableLoading = false;
          }
        }
      );
    },
    handleGetDetail(row, type) {
      let self = this;
      this.rowModel = row;
      this.rowModel.state = type;
      this.dialogVisible = true;
      this.tableTitle = row.PandianRWMC;
      this.DiyCommon.Post(
        `${this.$apiHost}/zichan/get_zichan_pandianjieguo`,
        {
          PandanrwId: this.rowModel.Id,
          Keyword: this.tableKeyword,
          Type: this.rowModel.state,
          PageIndex: this.tablePageNumber,
          PageSize: this.tablePageSize,
          TenantID: this.$getCurrentUser.TenantId,
        },
        function (result) {
          if (result.Code == 1) {
            self.detailList = result.Data;
            self.tablePageTotal = result.DataCount;
          } else {
            self.DiyCommon.Tips(result.Msg, false);
          }
        }
      );
    },
  },
};
</script>
  
  <style lang="scss" scoped>
.type {
  color: #fff;
  padding: 1px 5px;
  border-radius: 15px;
  font-size: 12px;
  background-color: #dc3545;
}
.info {
  background-color: #909399;
}
.blue {
  background-color: #007bff;
}
.green {
  background-color: #28a745;
}
.shuliang {
  color: #007bff;
  font-size: 16px;
  cursor: pointer;
}
</style>
  