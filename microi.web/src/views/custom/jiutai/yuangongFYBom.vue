<template>
  <!-- <div>签单情况报表</div> -->
  <div class="qiandanBOM">
    <div class="diy-table pluginPage">
      <div
        style="
          display: flex;
          flex-wrap: wrap;
          padding: 10px;
          align-items: center;
        "
      >
        <div
          style="width: 150px; margin-right: 15px"
          class="el-input el-input--mini el-input-group el-input-group--prepend el-input--suffix"
        >
          <div class="el-input-group__prepend" style="color: black">
            <i class="el-icon-search"></i>
            姓名
          </div>
          <el-input
            placeholder="请输入名字"
            v-model="Name"
            clearable
            style="width: 250px"
          ></el-input>
        </div>
        <div style="display: flex; margin-right: 15px">
          <div
            class="el-input-group__prepend"
            style="color: black; width: 80px; padding-top: 3px"
          >
            <i class="el-icon-search"></i>
            时间
          </div>

          <el-date-picker
            v-model="Time"
            type="daterange"
            align="right"
            unlink-panels
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            :picker-options="pickerOptions"
          >
          </el-date-picker>
        </div>
        <div>
          <el-button type="primary" @click="search">搜索</el-button>
        </div>
      </div>
      <!--  -->
      <!-- <div
          style="width: 150px; margin-right: 15px"
          class="el-input el-input--mini el-input-group el-input-group--prepend el-input--suffix"
        >
          <div class="el-input-group__prepend" style="color: black">
            <i class="el-icon-search"></i>
            销售人员名称
          </div>
          <el-input
            placeholder="请输入销售人员名称"
            v-model="xiaoshouRY"
            clearable
            style="width: 250px"
          ></el-input>
        </div> -->
      <!--  -->
    </div>
    <div class="qiandanTable">
      <el-table
        highlight-current-row
        :data="
          tableData.slice((currentPage - 1) * pagesize, currentPage * pagesize)
        "
        stripe
        border
        height="652"
        max-height="700"
        fit
        :header-row-style="{
          color: '#333',
          fontWeight: 300,
          fontSize: '14px',
          height: '38px',
          padding: 0
        }"
        show-summary
        :summary-method="getSummaries"
        sum-text="总计"
        width="100%"
      >
        <el-table-column
          type="index"
          width="50"
          label="编号"
          class="el-table__row"
        ></el-table-column>
        <el-table-column
          v-for="(item, index) in items"
          :key="index"
          :label="item.label"
          :prop="item.prop"
          :width="item.width"
        ></el-table-column>
      </el-table>
    </div>
    <!-- 分页 -->
    <div
      class="el-pagination is-background"
      style="display: flex; align-items: center; padding: 10px"
    >
      <el-pagination
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
        :current-page="currentPage4"
        :page-sizes="[15, 30, 60, 100]"
        :page-size="15"
        layout="total, sizes, prev, pager, next, jumper"
        :total="total"
      >
      </el-pagination>
    </div>
  </div>
</template>

<script>
export default {
  mounted() {
    this.getData();
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
      userTableData: [], // 用户列表
      currentPage: 1, // 初始页
      pagesize: 15, // 初始每页的数据
      tableData: [],
      kehuMC: "",
      xiaoshouRY: "",
      Time: "",
      kaishiSJ: "",
      jieshuSJ: "",
      Name: "",
      items: [
        { prop: "name", label: "员工", width: "93" },
        { prop: "yf", label: "月份", width: "93" },
        { prop: "gzzc", label: "工资支出", width: "93" },
        { prop: "clf", label: "差旅费", width: "93" },
        { prop: "qcf", label: "汽车费", width: "93" },
        { prop: "cyf", label: "餐饮费", width: "93" },
        { prop: "bgf", label: "办公费", width: "93" },
        { prop: "zchj", label: "支出合计", width: "93" },
        { prop: "yjys", label: "硬件营收", width: "93" },
        { prop: "hdys", label: "活动营收", width: "93" },
        { prop: "yshj", label: "营收合计", width: "93" },
        { prop: "llhj", label: "利润合计", width: "93" }
      ],
      total: 0
    };
  },
  methods: {
    getData() {
      // search("2023-12-01","2023-12-31");
      var self = this;
      self.DiyCommon.Post(
        "https://api-china.itdos.com/api/ApiEngine/Run",
        {
          ApiEngineKey: "YuangonFYTJ",
          KaishiSJ: "",
          JieshuSJ: "",
          Name: ""
        },
        function (res) {
          if (res.Code == 0) {
            self.tableData = res.Data;
            self.total = res.Data.length;
          } else {
          }
        }
      );
    },
    search(kaishiSJ, jieshuSJ, Name) {
      this.kaishiSJ = "";
      this.jieshuSJ = "";
      if (this.Time) {
        this.kaishiSJ = this.Time[0];
        this.jieshuSJ = this.Time[1];
      }
      var self = this;
      self.DiyCommon.Post(
        "https://api-china.itdos.com/api/ApiEngine/Run",
        {
          ApiEngineKey: "YuangonFYTJ",
          KaishiSJ: self.kaishiSJ,
          JieshuSJ: self.jieshuSJ,
          Name: self.Name
        },
        function (res) {
          if (res.Code == 0) {
            self.tableData = res.Data;
            self.total = res.Data.length;
          } else {
          }
        }
      );
    },
    handleSizeChange: function (size) {
      this.pagesize = size;
      console.log(this.pagesize); //每页下拉显示数据
    },
    handleCurrentChange: function (currentPage) {
      this.currentPage = currentPage;
      console.log(this.currentPage); //点击第几页
    }
  }
};
</script>

<style lang="scss" scoped>
.el-main {
  line-height: 38px;
}

.body {
  height: 100vh;
  height: 100%;
}

.qiandanBOM {
  max-height: 800px;
  max-width: 100%;
  background-color: white;
}

.qiandanTable {
  max-height: 700px;
  position: relative;
  width: 100%;
}

::v-deep .el-table__header th {
  color: #333;
  font-size: 14px;
  font-weight: 400;
  padding: 0;
}

::v-deep .qiandanBOM .el-table td.el-table__cell > .cell {
  padding: 6px;
  white-space: nowrap;
  text-align: center;
  font-weight: 500;
  color: #090404;
  font-size: 14px;
}
</style>
