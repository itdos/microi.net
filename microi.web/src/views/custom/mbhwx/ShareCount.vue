<template>
  <div>
    <el-card class="box-card" :body-style="{ padding: '10px' }">
      <div class="hearder">
        <div class="el-flex">
          <div>
            <el-date-picker
              v-model="value"
              type="daterange"
              :picker-options="pickerOptions"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              align="right"
              size="small"
              value-format="yyyy-MM-dd"
            >
            </el-date-picker>
          </div>
          <div style="margin-left: 10px">
            <el-button type="primary" @click="handleSearch" size="small">查询</el-button>
          </div>
        </div>
      </div>
      <el-table v-loading="loading" :data="tableData" border stripe size="medium" height="calc(100vh - 218px)" style="width: 100%">
        <el-table-column v-for="item in tableColumns" :prop="item.prop" :label="item.label" :key="item.prop" :width="item.width"> </el-table-column>
        <el-table-column fixed="right" label="操作" width="120">
          <template slot-scope="scope">
            <el-button type="" size="small" @click="handleDetail(scope.row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-container">
        <el-pagination
          background
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
          :current-page="currentPage"
          :page-sizes="pageSizes"
          :page-size="PageSize"
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
        >
        </el-pagination>
      </div>
    </el-card>
    <el-drawer title="查看详情" :visible.sync="dialogTableVisible" direction="rtl" size="70%">
      <material-detail ref="MerchantVerificatioDetail" :Id="Id"></material-detail>
    </el-drawer>
  </div>
</template>

<script>
import materialDetail from "./materialDetail.vue";
export default {
  name: "ShareCount",
  components: {
    materialDetail
  },
  data() {
    return {
      pickerOptions: {
        shortcuts: [
          {
            text: "最近一周",
            onClick(picker) {
              const end = new Date();
              const start = new Date();
              start.setTime(start.getTime() - 3600 * 1000 * 24 * 7);
              picker.$emit("pick", [start, end]);
            }
          },
          {
            text: "最近一个月",
            onClick(picker) {
              const end = new Date();
              const start = new Date();
              start.setTime(start.getTime() - 3600 * 1000 * 24 * 30);
              picker.$emit("pick", [start, end]);
            }
          },
          {
            text: "最近三个月",
            onClick(picker) {
              const end = new Date();
              const start = new Date();
              start.setTime(start.getTime() - 3600 * 1000 * 24 * 90);
              picker.$emit("pick", [start, end]);
            }
          }
        ]
      },
      value: [],
      currentPage: 1,
      PageSize: 10,
      tableData: [],
      total: 0,
      pageSizes: [10, 20, 50, 100],
      loading: false,
      tableColumns: [
        {
          prop: "Name",
          label: "子商标名称"
        },
        {
          prop: "TypeName",
          label: "种类名称"
        },
        {
          prop: "Grade",
          label: "牌号"
        },
        {
          prop: "ZhizaoSJC",
          label: "制造商简称"
        },
        {
          prop: "Count",
          label: "数量"
        }
      ],
      dialogTableVisible: false,
      Id: ""
    };
  },
  mounted() {
    this.gettoday();
    this.getData();
  },
  methods: {
    formatDate(date) {
      var year = date.getFullYear();
      var month = (date.getMonth() + 1).toString().padStart(2, "0");
      var day = date.getDate().toString().padStart(2, "0");
      return year + "-" + month + "-" + day;
    },
    gettoday() {
      var today = new Date();
      var start = new Date(today);
      var date = this.formatDate(new Date());
      let lastMonth = start.setTime(start.getTime() - 3600 * 1000 * 24 * 30);
      let lastMonthFormatted = this.formatDate(new Date(lastMonth));
      this.value = [lastMonthFormatted, date];
    },
    getData() {
      this.loading = true;
      this.DiyCommon.ApiEngine.Run(
        "GetShareStatistics",
        {
          StartDate: this.value[0],
          EndDate: this.value[1],
          PageIndex: this.currentPage,
          PageSize: this.PageSize
        },
        (result) => {
          if (result.Code == 1) {
            this.tableData = result.Data;
            this.total = result.Total;
            this.loading = false;
          } else {
            this.loading = false;
            this.$message.error(result.Msg);
          }
        }
      );
    },
    // 点击查询
    handleSearch() {
      this.currentPage = 1;
      this.getData();
    },
    handleSizeChange(val) {
      console.log(`每页 ${val} 条`);
      this.PageSize = val;
      this.currentPage = 1;
      this.getData();
    },
    handleCurrentChange(val) {
      console.log(`当前页: ${val}`);
      this.currentPage = val;
      this.getData();
    },
    handleDetail(row) {
      this.Id = row.Id;
      this.dialogTableVisible = true;
      this.$nextTick(() => {
        this.$refs?.MerchantVerificatioDetail?.GetMaterialDetail();
      });
    }
  }
};
</script>

<style scoped>
.el-flex {
  display: flex;
  margin-bottom: 10px;
}
</style>
