<template>
  <!-- <div>签单情况报表</div> -->
  <div class="qiandanBOM">
    <div class="diy-table pluginPage">
      <div style="display: flex; flex-wrap: wrap; padding: 10px; align-items: center">
        <div style="width: 120px; margin-right: 15px" class="el-input el-input--mini el-input-group el-input-group--prepend el-input--suffix">
          <div class="el-input-group__prepend" style="color: black">
            <i class="el-icon-search"></i>
            名称
          </div>
          <el-input placeholder="请输人员名称" v-model="UserName" clearable style="width: 200px"></el-input>
        </div>
        <div style="display: flex; margin-right: 15px">
          <!-- <div
          style="width: 150px; margin-right: 15px"
          class="el-input el-input--mini el-input-group el-input-group--prepend el-input--suffix"
        > -->
          <div class="el-input-group__prepend" style="color: black; width: 80px; padding-top: 3px">
            <i class="el-icon-search"></i>
            时间
          </div>

          <el-date-picker v-model="Time" type="daterange" align="right" unlink-panels range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" :picker-options="pickerOptions">
          </el-date-picker>
          <!-- <div class="el-input-group__prepend" style="color: black">
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
          </div> -->
        </div>
        <div style="width: 150px; margin-right: 15px" class="el-input el-input--mini el-input-group el-input-group--prepend el-input--suffix">
          <div class="el-input-group__prepend" style="color: black">
            <i class="el-icon-search"></i>
            选择服务类型
          </div>
          <div class="block">
            <el-select v-model="type" clearable placeholder="请选择" style="width: 150px">
              <el-option v-for="item in options" :key="item.value" :label="item.label" :value="item.value"> </el-option>
            </el-select>
          </div>
        </div>

        <div style="width: 150px; margin-right: 15px" class="el-input el-input--mini el-input-group el-input-group--prepend el-input--suffix">
          <div class="el-input-group__prepend" style="color: black">
            <i class="el-icon-search"></i>
            选择组织机构
          </div>
          <div class="block">
            <el-select v-model="DeptCode" clearable placeholder="请选择" style="width: 150px">
              <el-option v-for="item in DeptcodeList" :key="item.value" :label="item.label" :value="item.value"> </el-option>
            </el-select>
          </div>
        </div>
        <div>
          <el-button type="primary" @click="getData">搜索</el-button>
        </div>
      </div>
      <div class="qiandanTable">
        <el-table
          highlight-current-row
          :data="tableData.slice((currentPage - 1) * pagesize, currentPage * pagesize)"
          stripe
          border
          height="700"
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
          <el-table-column type="index" width="49" label="编号" class="el-table__row"></el-table-column>
          <el-table-column v-for="(item, index) in xingming" :key="index" :prop="item.prop" :label="item.label" :width="item.width" align="center"> </el-table-column>
          <el-table-column label="新签" align="center">
            <el-table-column v-for="(item, index) in items_xingQ" :key="index" :prop="item.prop" :label="item.label" :width="item.width" align="center"> </el-table-column>
          </el-table-column>
          <el-table-column label="续签" align="center">
            <el-table-column v-for="(item, index) in items2_xvQ" :key="index" :prop="item.prop" :label="item.label" :width="item.width" align="center"> </el-table-column>
          </el-table-column>
          <el-table-column v-for="(item, index) in HJ" :key="index" :prop="item.prop" :label="item.label" :width="item.width" align="center"> </el-table-column>
        </el-table>
      </div>
      <!-- 分页 -->
      <div class="el-pagination is-background" style="display: flex; align-items: center; padding: 10px">
        <el-pagination
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
          :current-page="currentPage4"
          :page-sizes="[15, 30, 60, 100]"
          :page-size="100"
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
        >
        </el-pagination>
      </div>
    </div>
  </div>
</template>

<script>
import axios from "axios";
export default {
  mounted() {
    // this.getDeptCode();
    // this.fetchData();
    this.getDeptCode();

    // 等待0.5秒钟
    setTimeout(() => {
      // 调用 fetchData
      this.fetchData();
    }, 500);
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
      UserName: [],
      kehuMC: "",
      xiaoshouRY: "",
      Time: "",
      kaishiSJ: "",
      jieshuSJ: "",
      response: [],
      arr: [],
      zongjinE: "",
      type: "",
      options: [
        {
          value: "工商",
          label: "工商"
        },
        {
          value: "代账",
          label: "代账"
        },
        {
          value: "",
          label: "所有"
        }
      ],
      type2: "",
      DeptCode: "",
      DeptcodeList: [],
      DeptJKSJ: [],
      HJ: [
        { prop: "zongjinE", label: "金额合计", width: "88" },
        { prop: "yejiHJ", label: "业绩合计", width: "88" }
      ],
      xingming: [
        { prop: "name", label: "姓名", width: "88" },
        { prop: "type", label: "服务类型", width: "120" }
      ],
      items_xingQ: [
        { prop: "num", label: "数量", width: "88" },
        { prop: "money", label: "金额", width: "88" },
        { prop: "expenditure", label: "支出", width: "88" },
        { prop: "cost", label: "核定成本", width: "88" },
        { prop: "performance", label: "业绩", width: "88" }
      ],
      items2_xvQ: [
        { prop: "num_x", label: "数量", width: "88" },
        { prop: "money_x", label: "金额", width: "88" },
        { prop: "expenditure_x", label: "支出", width: "88" },
        { prop: "cost_x", label: "核定成本", width: "88" },
        { prop: "performance_x", label: "业绩", width: "88" }
      ],
      items_gys: [],
      total: 0
    };
  },
  methods: {
    async getData() {
      this.kaishiSJ = "";
      this.jieshuSJ = "";
      if (this.Time) {
        this.kaishiSJ = this.Time[0];
        this.jieshuSJ = this.Time[1];
      }
      if (this.DeptCode == "") {
        this.type2 = this.DeptJKSJ.Data2[0].Code;
      } else {
        this.type2 = this.DeptCode;
      }
      try {
        this.response = await axios.get("https://e-erp-qrcode.microi.net/ReportForms/SalePerformance?", {
          params: {
            OsClient: "lejie",
            UserName: this.UserName,
            Date_B: this.kaishiSJ,
            Date_E: this.jieshuSJ,
            Type: this.type,
            DeptCode: this.type2
          }
        });
        // 处理接口返回的数据
      } catch (error) {
        console.error(error);
        // 处理错误
      }
      this.tableData = this.response.data.value;
      for (let i = 0; i < this.response.data.value.length; i++) {
        var yejiHJ = 0;
        this.zongjinE = 0;
        this.zongjinE = +this.zongjinE + +this.response.data.value[i].money + +this.response.data.value[i].money_x;
        yejiHJ = +yejiHJ + +this.response.data.value[i].performance + +this.response.data.value[i].performance_x;
        this.tableData[i].zongjinE = this.zongjinE;
        this.tableData[i].yejiHJ = yejiHJ;
      }
      console.log(this.tableData);
    },
    async fetchData() {
      try {
        this.response = await axios.get("https://e-erp-qrcode.microi.net/ReportForms/SalePerformance?", {
          params: {
            OsClient: "lejie",
            UserName: "",
            Date_B: "",
            Date_E: "",
            Type: "",
            DeptCode: this.type2
          }
        });
        // 处理接口返回的数据
      } catch (error) {
        console.error(error);
        // 处理错误
      }
      this.tableData = this.response.data.value;
      for (let i = 0; i < this.response.data.value.length; i++) {
        var yejiHJ = 0;
        this.zongjinE = 0;
        this.zongjinE = +this.zongjinE + +this.response.data.value[i].money + +this.response.data.value[i].money_x;
        yejiHJ = +yejiHJ + +this.response.data.value[i].performance + +this.response.data.value[i].performance_x;
        this.tableData[i].zongjinE = this.zongjinE;
        this.tableData[i].yejiHJ = yejiHJ;
      }
      console.log(this.tableData);
    },
    handleSizeChange: function (size) {
      this.pagesize = size;
      console.log(this.pagesize); //每页下拉显示数据
    },
    handleCurrentChange: function (currentPage) {
      this.currentPage = currentPage;
      console.log(this.currentPage); //点击第几页
    },
    getDeptCode() {
      var self = this;
      self.DiyCommon.Post(
        "https://api-china.itdos.com/api/ApiEngine/Run",
        {
          ApiEngineKey: "huoquBMJGXX"
        },
        function (res) {
          if (res.Code == 1) {
            var list = res.Data;
            self.DeptJKSJ = res;
            if (list.Code == 1) {
              for (var i = 0; i < list.Data.length; i++) {
                self.DeptcodeList.push({
                  value: list.Data[i].Code,
                  label: list.Data[i].Name
                });
              }
            }
            // self.DeptcodeList.push({
            //   value:res.Data2[0].Code,
            //   label:''
            // })
            self.type2 = res.Data2[0].Code;
          } else {
          }
        }
      );
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
