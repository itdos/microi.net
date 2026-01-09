<template>
  <div class="gongziB">
    <div class="diy-table pluginPage" style="padding: 0px">
      <div class="el-tabs el-tabs--top table-rowlist-tabs tab-pane-hide">
        <div class="el-tabs__content">
          <!---->
          <div class="el-row">
            <div class="el-col el-col-24">
              <div class="el-card box-card box-card-table-row-list is-always-shadow">
                <!---->
                <div class="el-card__body">
                  <!---->
                  <div class="keyword-search" style="display: flex; flex-direction: column">
                    <div>
                      <el-button style="width: 70px; height: 31px; font-size: smaller" type="primary" @click="search">
                        <i class="more-btn mr-1 far fa-check-circle" style="margin-left: -10px"></i>
                        <span style="font-size: smaller"> 查询 </span>
                      </el-button>
                      <el-button @click="exportToExcel" style="width: 85px; height: 31px; font-size: smaller; padding-bottom: 20px">
                        <i class="el-icon-download"></i>
                        <span style="font-size: smaller">导出</span>
                      </el-button>
                      <el-button style="width: 90px; height: 31px; font-size: smaller; padding-bottom: 20px" type="primary" @click="handlePrint">打印表格</el-button>
                      <!--  -->
                      <el-button style="width: 90px; height: 31px; font-size: smaller; padding-bottom: 20px" type="primary" @click="handlePrint2">2重新获取</el-button>
                      <!--  -->
                      <el-button style="width: 90px; height: 31px; font-size: smaller; padding-bottom: 20px" type="primary" @click="handlePrint3">3是否发放</el-button>
                      <!--  -->
                    </div>

                    <div style="display: flex; flex-wrap: wrap; margin-left: -10px">
                      <!-- 款号 -->
                      <div class="search-input">
                        <div class="search-box">
                          <i class="el-icon-search" style="padding-top: 3px; padding-right: 5px"></i>
                          <span style="font-size: smaller">款&emsp;号</span>
                        </div>
                        <el-select v-model="kuanhao" placeholder="请选择款号" clearable filterable>
                          <el-option v-for="(item, index) in options3" :key="index" :label="`${item.HuopinDH} ${item.HuopinMC}`" :value="item.HuopinDH"> </el-option>
                        </el-select>
                        <!----><!----><!----><!---->
                      </div>
                      <!-- 工号 -->
                      <!-- <div class="search-input">
                          <div class="search-box" style="width: 95px; height: 31px">
                            <i class="el-icon-search" style="margin-top: 3px; margin-right: 5px"></i>
                            <span style="font-size: smaller">工&emsp;号</span>
                          </div>
                          <el-input type="text" autocomplete="off" placeholder="" v-model="gonghao"></el-input>
                        </div> -->
                      <!-- 姓名 -->
                      <div class="search-input">
                        <div class="search-box">
                          <i class="el-icon-search" style="padding-top: 3px; padding-right: 5px"></i>
                          <span style="font-size: smaller">姓&emsp;名</span>
                        </div>
                        <!-- 下拉 -->
                        <el-select v-model="xingming" placeholder="请选择姓名" clearable filterable>
                          <el-option v-for="(item, index) in options" :key="index" :label="`${item.id} ${item.name}`" :value="item.id"> </el-option>
                        </el-select>
                      </div>
                      <!-- 床次多选框 -->
                      <div class="search-input">
                        <div class="search-box">
                          <i class="el-icon-search" style="padding-top: 3px; padding-right: 5px"></i>
                          <span style="font-size: smaller">床&emsp;次</span>
                        </div>
                        <!-- 床次下拉多选 -->
                        <div>
                          <el-select v-model="chuangci" multiple placeholder="请选择床次" clearable collapse-tags>
                            <el-option v-for="item in options2" :key="item.value" :label="item.text" :value="item.value" clearable> </el-option>
                          </el-select>
                        </div>
                        <!--  -->
                      </div>
                      <!-- 时间 -->
                      <div class="search-input">
                        <div class="search-box" style="font-size: smaller">
                          <i class="el-icon-search" style="padding-top: 3px; padding-right: 5px"></i>
                          <span style="font-size: smaller">日&emsp;期</span>
                        </div>
                        <el-date-picker
                          v-model="Date_be"
                          type="datetimerange"
                          :picker-options="pickerOptions"
                          range-separator="至"
                          start-placeholder="开始日期"
                          end-placeholder="结束日期"
                          align="right"
                        >
                        </el-date-picker>
                      </div>
                    </div>

                    <div style="width: 100%" id="my-table">
                      <!-- tableData渲染在这 -->
                      <el-table
                        :data="tableData"
                        border
                        max-height="500"
                        :header-row-style="{
                          color: '#333',
                          fontWeight: 300,
                          fontSize: '14px'
                        }"
                        show-summary
                        :summary-method="getSummaries"
                        sum-text="总计"
                      >
                        <el-table-column type="index" width="100" label="序号"> </el-table-column>
                        <el-table-column v-for="(column, index) in columns" :key="index" :label="column.label" :prop="column.prop" width="150" sortable> </el-table-column>
                        <el-table-column label="金额（元）" prop="jine" sortable width="120">
                          <template slot-scope="scope">
                            {{ Number(scope.row.jine).toFixed(3) }}
                          </template>
                        </el-table-column>
                      </el-table>
                    </div>
                    <!-- 分页 -->
                    <div class="pagination" style="margin-top: 10px; float: left; margin-bottom: 10px; clear: both; margin-left: 10px">
                      <el-pagination
                        @size-change="handleSizeChange"
                        @current-change="handleCurrentChange"
                        :current-page="currentPage"
                        :page-sizes="[10, 15, 20, 30, 40, 50, 100]"
                        :page-size="pageSize"
                        layout="total, sizes, prev, pager, next, jumper"
                        :total="totalCount"
                      >
                      </el-pagination>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
import * as XLSX from "xlsx";
import printJS from "print-js";
import { clippingParents } from "@popperjs/core";
var reg190317 = new RegExp("(^|&)" + "OsClient" + "=([^&]*)(&|$)");
var r190317 = window.location.search.substr(1).match(reg190317);
var osClient = r190317 != null ? r190317[2] : "";
export default {
  created() {
    // 获取本月第一天和最后一天的时间戳
    const now = new Date(); // 获取当前日期
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1); // 当前月份第一天
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0); // 当前月份最后一天
    // 将时间戳数组赋值给Date_be属性
    this.Date_be = [startOfMonth.getTime(), endOfMonth.getTime()];
    this.list();
    this.list4();
    this.list3();
  },
  mounted() {
    // this.huoqujiage()
    this.list2();
  },
  data() {
    return {
      chuangci: [],
      sumData: {}, // 定义一个变量用于存储合计值
      currentPage: 1,
      pageSize: 15,
      totalCount: 0, // 声明 totalCount
      radio: "2",
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
      options: [],
      options2: [],
      options3: [], //款号
      xingming: "",
      Date_be: [],
      kuanhao: "",
      gonghao: "",
      tableData: [],
      columns: [
        { prop: "xingming", label: "姓名" },
        { prop: "gonghao", label: "工号" },
        { prop: "kuanhao", label: "款号" },
        { prop: "chuangci", label: "床次" },
        { prop: "gongxu", label: "工序" },
        { prop: "gongjia", label: "工价" },
        { prop: "shuliang", label: "数量" }
      ]
    };
  },
  methods: {
    //修改工资
    handlePrint2() {
      var self = this;
      this.$confirm("确定重新获取单价吗？点击确定后请点查询", "提示", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      })
        .then(() => {
          this.DiyCommon.Post(
            "https://e-erp-qrcode.microi.net/Ebu/MES_UpdateWages",
            {
              StyleCode: this.kuanhao
            },
            function (res) {
              console.log(res.code);
              if (res.code == 1) {
                self.$message({
                  message: "单价同步获取成功",
                  type: "success"
                });
              } else {
                self.$message({
                  message: "单价同步获取失败",
                  type: "warning"
                });
              }
            }
          );
        })
        .catch(() => {
          // 用户选择取消时的操作
        });
    },
    // huoqujiage(){
    //   this.DiyCommon.Post(
    //       "https://e-erp-qrcode.microi.net/Ebu/MES_UpdateWages",
    //       {
    //         StyleCode: this.kuanhao,
    //       },
    //       function (res) {
    //         console.log(res.code)
    //       })
    // },
    //是否发放
    handlePrint3() {
      console.log("发放了工资");
      //
      var self = this;
      const Date_b = this.formattedDate(this.Date_be[0]);
      const Date_e = this.formattedDate(this.Date_be[1]);
      this.$confirm("确定发放吗？注意：如果没有搜索条件则为全部发放", "提示", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      })
        .then(() => {
          this.DiyCommon.Post(
            "https://e-erp-qrcode.microi.net/Ebu/MES_Wages_",
            {
              StyleCode: this.kuanhao,
              UserCode: this.gonghao,
              UserName: this.xingming,
              Processes: this.Processes,
              Date_b: Date_b,
              Date_e: Date_e,
              _PageIndex: this.currentPage,
              _PageSize: this.pageSize,
              IsBedNumber: this.chuangci.join(","),
              Settlement: 1
            },
            function (res) {
              console.log(res.code);
              if (res.code == 1) {
                self.$message({
                  message: "工资发放成功",
                  type: "success"
                });
              } else {
                self.$message({
                  message: "工资发放失败",
                  type: "success"
                });
              }
            }
          );
        })
        .catch(() => {
          // 用户选择取消时的操作
        });
      //
    },
    //款号
    list4() {
      var self = this;
      this.DiyCommon.Post(
        "https://api-e-erp.microi.net/api/FormEngine/GetTableData",
        //"https://api-china.itdos.com/api/FormEngine/GetTableData",
        {
          ModuleEngineKey: "Diy_kuanshixinxi"
        },
        function (res) {
          // console.log("l4" + res.Data);
          if (res && res.Data && Array.isArray(res.Data)) {
            self.options3 = res.Data.map((item) => ({
              HuopinDH: item.HuopinDH,
              HuopinMC: item.HuopinMC
            }));
          } else {
            self.options3 = [];
          }
        }
      );
    },
    //此处获取床次信息
    list3() {
      var self = this;
      this.DiyCommon.Post("https://e-erp-qrcode.microi.net/Ebu/MES_BedNumber", {}, function (res) {
        //   console.log("chuangci:" + res.data);
        if (res && res.data && Array.isArray(res.data)) {
          self.options2 = res.data.map((item) => ({
            text: item,
            value: item
          }));
        } else {
          self.options2 = [];
        }
      });
    },
    printTable() {
      printJS({
        printable: "my-table", // 待打印的元素ID
        type: "html",
        header: "工资表", // 打印页头
        documentTitle: "我的打印", // 打印文档标题
        maxWidth: 1100,
        style: `
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #555; padding: 5px; text-align: center; }
            .el-table__footer-wrapper {display:none}
          `
      });
    },
    getSummaries(parameters) {
      const { columns, data } = parameters;
      const sums = [];
      columns.forEach((column, index) => {
        if (index === 0) {
          sums.push("总计");
          return;
        }
        /*
          if (index === 6 || index === 7) {
      const values = data.map((item) => parseFloat(item[column.property]));
      const sum = values.reduce((prev, curr) => prev + curr, 0);
     sums.push(sum.toFixed(3)); // 保留两位小数并添加到 sums 数组中
     this.$set(this.sumData, column.property, sum.toFixed(2)); // 存储到合计值对象中
    } else {
      sums.push("");
    }

        */
        if (index === 8 || index === 7) {
          // 假设两列列是需要计算合计的列
          const values = data.map((item) => parseFloat(item[column.property])); // 获取当前列所有数值
          const sum = values.reduce((prev, curr) => prev + curr, 0); // 计算数值和
          const formattedSum = index === 7 ? parseInt(sum) : sum.toFixed(3);
          sums.push(formattedSum);
          this.$set(this.sumData, column.property, formattedSum);
        } else {
          sums.push("");
        }
      });
      return sums;
    },
    handlePrint() {
      // 获取表格 HTML 元素
      const table = document.querySelector(".el-table .el-table__body-wrapper table");
      // 获取表头元素
      const header = document.querySelector(".el-table .el-table__header-wrapper table");
      // 为了避免直接修改表格样式，复制表格元素
      const cloneTable = table.cloneNode(true);
      const cloneHeader = header.cloneNode(true);
      // 调整表格样式
      cloneTable.style.fontSize = "14px";
      cloneTable.style.borderCollapse = "collapse";
      cloneTable.style.border = "1px solid black";
      cloneTable.querySelectorAll("th, td").forEach((el) => {
        el.style.border = "3px solid #555";
        el.style.padding = "8px";
      });
      // 设置单元格内边距和边框样式
      cloneHeader.querySelectorAll("th").forEach((el) => {
        el.style.padding = "8px";
        el.style.border = "1px solid #555";
      });
      cloneTable.style.borderSpacing = "0"; // 添加表格内边框，缩短每个单元格之间的距离
      // 隐藏表格中的分页和排序指示器
      cloneTable.querySelectorAll(".gutter").forEach((el) => el.remove());

      // 创建一个新的窗口，并把表格添加到新窗口中进行打印
      const printWindow = window.open("", "Print", "height=600,width=800");
      printWindow.document.write("<html><head><title>工资表</title></head><body></body></html>");
      printWindow.document.body.appendChild(cloneHeader);
      printWindow.document.body.appendChild(cloneTable);
      printWindow.document.close();
      printWindow.print();

      // 打印完成后，关闭窗口
      printWindow.close();
    },
    exportToExcel() {
      // 筛选需要导出的表格列
      const filteredTableData = this.tableData.map((item) => {
        return {
          姓名: item.xingming,
          工号: item.gonghao,
          款号: item.kuanhao,
          数量: item.shuliang,
          金额: item.jine,
          床次: item.chuangci,
          工序: item.gongxu
        };
      });
      // 将表格数据转换为 Excel 表格数据
      const sheet = XLSX.utils.json_to_sheet(filteredTableData);

      // 创建 Excel 工作簿
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");

      // 将工作簿写入二进制流
      const excelData = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array"
      });

      // 创建并下载 Excel 文件
      const blob = new Blob([excelData], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = "工资表.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    handleSizeChange(val) {
      //   console.log(`每页 ${val} 条`);
      this.pageSize = val;
      this.search();
    },
    handleCurrentChange(val) {
      //   console.log(`当前页: ${val}`);
      this.currentPage = val;
      this.search();
    },
    //姓名获取
    list() {
      var self = this;
      this.DiyCommon.Post(
        "https://api-e-erp.microi.net/api/FormEngine/GetTableData",
        //"https://api-china.itdos.com/api/FormEngine/GetTableData",
        {
          ModuleEngineKey: "Sys_User"
        },
        function (res) {
          console.log(res);
          if (res && res.Data && Array.isArray(res.Data)) {
            self.options = res.Data.map((item) => ({
              id: item.No,
              name: item.Name
            }));
          } else {
            self.options = [];
          }
        }
      );
    },
    formattedDate(date) {
      if (!date) {
        return null;
      }
      const dateObj = new Date(date);
      const year = dateObj.getFullYear();
      const month = (dateObj.getMonth() + 1).toString().padStart(2, "0");
      const day = dateObj.getDate().toString().padStart(2, "0");
      return `${year}-${month}-${day}`;
    },
    search() {
      var self = this;
      const Date_b = this.formattedDate(this.Date_be[0]);
      const Date_e = this.formattedDate(this.Date_be[1]);
      //   console.log(this.kuanhao);
      //   console.log(this.chuangci);
      this.DiyCommon.Post(
        "https://e-erp-qrcode.microi.net/Ebu/MES_Wages_",
        // "https://e-erp-qrcode-test.microi.net/Ebu/MES_Wages_",
        {
          StyleCode: this.kuanhao,
          UserCode: self.xingming,
          //UserName: self.xingming,
          // Processes: this.Processes,
          Date_b: Date_b,
          Date_e: Date_e,
          _PageIndex: this.currentPage,
          _PageSize: this.pageSize,
          IsBedNumber: this.chuangci.join(",")
        },
        function (res) {
          console.log(self.xingming);
          self.totalCount = res.dataCount;
          //   console.log(res);
          self.tableData = res.data;
        }
      );
    },
    list2() {
      const Date_b = this.formattedDate(this.Date_be[0]);
      const Date_e = this.formattedDate(this.Date_be[1]);
      var self = this;
      var parts = self.xingming.split("+");
      this.DiyCommon.Post(
        "https://e-erp-qrcode.microi.net/Ebu/MES_Wages_",
        {
          IsSize: 1,
          IsColor: 1,
          CylinderNumber: self.ganghao,
          Date_b: Date_b,
          Date_e: Date_e,
          _PageIndex: this.currentPage,
          _PageSize: this.pageSize,
          IsBedNumber: this.chuangci.join(","),
          StyleCode: this.kuanhao,
          UserCode: parts[0],
          UserName: parts[1],
          OsClient: osClient
        },
        function (res) {
          res.data.forEach((item) => {
            if (item.chima && item.chima.startsWith("Chima_")) {
              item.chima = item.chima.substr(6);
            }
          });
          self.totalCount = res.dataCount;
          self.tableData = res.data;
        }
      );
    }
  }
};
</script>

<style lang="scss" scoped>
.el-table__header-wrapper {
  height: 40px;
  display: flex;
  align-items: center;
}

.el-card__body {
  display: flex;
  flex-direction: column;
}

.pagination {
  white-space: nowrap;
  padding: 2px 5px;
  color: #303133;
  font-weight: 700;
}

.el-table__header th {
  color: #333;
  font-size: 14px;
  line-height: 38px;
  font-weight: 400;
  text-align: center;
}

.search-box {
  background-color: #f5f7fa;
  // display: flex;
  // justify-content: center;
  // align-items: center;
  text-align: center;
  width: 6vw;
  border: 1px solid #cdcbcb;
  padding: 5px 0;
  border-radius: 4px;
  // box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12), 0 0 6px rgba(0, 0, 0, 0.04);
  margin: 10px;
}

.search-input {
  display: flex;
  font-size: 15px;
  align-items: center;
}

@media print {
  .is-hidden-print {
    display: none;
  }

  thead {
    display: table-header-group;
  }

  /* 调整表格样式 */
  table {
    margin: 10px 0;
    border-collapse: collapse;
    width: 100%;
  }

  th,
  td {
    padding: 6px 12px;
    text-align: center;
    border: 2px solid #0e0d0d;
    font-size: 14px;
  }

  th {
    background-color: #f2f2f2;
    font-weight: bold;
  }

  /* 隐藏分页器和搜索框 */
  .has-gutter,
  .el-pagination,
  .el-input {
    display: none;
  }
}
</style>
