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
            开始时间
          </div>
          <div class="block">
            <el-date-picker
              v-model="kaishiSJ"
              type="date"
              placeholder="选择日期">
            </el-date-picker>
          </div>

        </div>
        <div
          style="width: 150px; margin-right: 15px"
          class="el-input el-input--mini el-input-group el-input-group--prepend el-input--suffix"
        >
          <div class="el-input-group__prepend" style="color: black">
            <i class="el-icon-search"></i>
            结束时间
          </div>
          <div class="block">
            <el-date-picker
              v-model="jieshuSJ"
              type="date"
              placeholder="选择日期">
            </el-date-picker>
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
        <div>
          <el-button type="primary" @click="search">搜索</el-button>
        </div>
      </div>
      <div class="qiandanTable">
        <el-table
          highlight-current-row
          :data="tableData.slice((currentPage-1)*pagesize,currentPage*pagesize)"
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
            padding: 0,
          }"
          show-summary
          :summary-method="getSummaries"
          sum-text="总计"
          width="100%"
        >
          <el-table-column
            type="index"
            width="49"
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
          :page-size="15  "
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
        >
        </el-pagination>
      </div>
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
      userTableData: [], // 用户列表
      currentPage:1, // 初始页
      pagesize:15,  // 初始每页的数据
      tableData: [],
      kehuMC: "",
      xiaoshouRY: "",
      kaishiSJ:"",
      jieshuSJ:"",
      items: [
        { prop: "gsmc", label: "公司", width: "73" },
        { prop: "yf", label: "月份", width: "91" },
        { prop: "xzzc", label: "行政支出", width: "77" },
        { prop: "gzzc", label: "工资支出", width: "77" },
        { prop: "bxzc", label: "报销支出", width: "77" },
        { prop: "swzc", label: "税务支出", width: "77" },
        { prop: "xczc", label: "宣传支出", width: "77" },
        { prop: "hdzc", label: "活动支出", width: "77" },
        { prop: "yjcgzc", label: "硬件采购支出", width: "105" },
        { prop: "zchj", label: "支出合计", width: "77" },
        { prop: "yjsr", label: "硬件销售收入", width: "105" },
        { prop: "hdsr", label: "活动收入", width: "77" },
        { prop: "srhj", label: "收入合计", width: "77" },
        { prop: "lrhj", label: "利润合计", width: "77" },
      ],
      total: 0,
    };
  },
  methods: {
    getData() {
      // search("2023-12-01","2023-12-31");
      var self = this;
      self.DiyCommon.Post(
        "https://api-china.itdos.com/api/ApiEngine/Run",
        {
          ApiEngineKey: "GonsiFYTJ",
          KaishiSJ : "",
          JieshuSJ : ""
        },
        function (res) {
          if(res.Code == 0){
            self.tableData = res.Data;
            self.total = res.Data.length;
          }else{

          }
        }
      );
      console.log(self.tableData)
    },
    search(kaishiSJ, jieshuSJ) {
      var self = this;
      self.DiyCommon.Post(
        "https://api-china.itdos.com/api/ApiEngine/Run",
        {
          ApiEngineKey: "GonsiFYTJ",
          KaishiSJ : self.kaishiSJ,
          JieshuSJ : self.jieshuSJ
        },
        function (res) {
          if(res.Code == 0){
            self.tableData = res.Data;
            self.total = res.Data.length;
          }else{

          }
        }
      );
      console.log(self.tableData)
    },
  },
  // 初始页currentPage、初始每页数据数pagesize和数据data
  handleSizeChange: function (size) {
    this.pagesize = size;
    console.log(this.pagesize)  //每页下拉显示数据
  },
  handleCurrentChange: function(currentPage){
    this.currentPage = currentPage;
    console.log(this.currentPage)  //点击第几页
  },
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
