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
                        <span> 查询 </span>
                      </el-button>
                      <el-button @click="exportToExcel" style="width: 85px; height: 31px; font-size: smaller; padding-bottom: 20px">
                        <i class="el-icon-download"></i>
                        <span>导出</span>
                      </el-button>
                      <el-button style="width: 90px; height: 31px; font-size: smaller; padding-bottom: 20px" type="primary" @click="handlePrint">打印表格</el-button>
                      <!--  -->
                      <!-- <el-button style="
													width: 90px;
													height: 31px;
													font-size: smaller;
													padding-bottom: 20px;
													" type="primary" @click="handlePrint2">2重新获取</el-button> -->
                      <!--  -->
                      <el-button style="width: 90px; height: 31px; padding-bottom: 20px" type="primary" @click="Print">打印表格2</el-button>
                      <el-button style="width: 90px; height: 31px; padding-bottom: 20px" type="danger" @click="handlePrint3">是否发放</el-button>
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
                      <!-- 工序 -->
                      <div class="search-input">
                        <div class="search-box">
                          <i class="el-icon-search" style="padding-top: 3px; padding-right: 5px"></i>
                          <span style="font-size: smaller">工&emsp;序</span>
                        </div>
                        <el-select v-model="processes" placeholder="请选择工序" clearable filterable>
                          <el-option v-for="(item, index) in processesOptions" :key="index" :label="item.label" :value="item.value"> </el-option>
                        </el-select>
                      </div>
                      <!-- 姓名 -->
                      <div class="search-input">
                        <div class="search-box">
                          <i class="el-icon-search" style="padding-top: 3px; padding-right: 5px"></i>
                          <span style="font-size: smaller">姓&emsp;名</span>
                        </div>
                        <!-- 下拉 -->
                        <el-select v-model="xingming" placeholder="请选择姓名" clearable filterable>
                          <el-option v-for="(item, index) in options" :key="index" :label="`${item.id} ${item.name}`" :value="`${item.id}+${item.name}`"> </el-option>
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
                      <!-- 缸号 -->
                      <div style="display: flex; align-items: center; margin-left: 10px">
                        <div class="el-input-group__prepend" style="color: black; font-size: smaller; height: 31px; width: 80px; height: 28px; display: flex; align-items: center">
                          <i class="el-icon-search"></i>
                          缸号
                        </div>
                        <el-input placeholder="请输入缸号" v-model="ganghao" clearable style="width: 120px"> </el-input>
                      </div>
                      <!-- 颜色 -->
                      <div style="display: flex; align-items: center; margin-left: 10px">
                        <div class="el-input-group__prepend" style="color: black; font-size: smaller; height: 31px; width: 80px; height: 28px; display: flex; align-items: center">
                          <i class="el-icon-search"></i>
                          颜色
                        </div>
                        <el-input placeholder="请输入颜色" v-model="yanse" clearable style="width: 120px"> </el-input>
                      </div>
                      <div style="display: flex; align-items: center; margin-left: 10px">
                        <div class="el-input-group__prepend" style="color: black; font-size: smaller; height: 31px; width: 80px; height: 28px; display: flex; align-items: center">
                          <i class="el-icon-search"></i>
                          部门
                        </div>
                        <el-input placeholder="请输入部门" v-model="bumen" clearable style="width: 120px"> </el-input>
                      </div>
                      <!-- 尺码 -->
                      <div style="display: flex; align-items: center; margin-left: 10px">
                        <div class="el-input-group__prepend" style="color: black; font-size: smaller; height: 31px; width: 80px; height: 28px; display: flex; align-items: center">
                          <i class="el-icon-search"></i>
                          尺码
                        </div>
                        <el-input placeholder="请输入尺码" v-model="chima" clearable style="width: 120px"> </el-input>
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
                    <!-- 工序 -->
                    <div class="search-input1">
                      <div class="search-box">
                        <i class="el-icon-search" style="padding-top: 3px; padding-right: 5px"></i>
                        <span style="font-size: smaller">结算工序</span>
                      </div>
                      <!-- <el-select v-model="End_processes" placeholder="请选择" clearable filterable>
													<el-option v-for="(item, index) in End_processesOptions" :key="index"
														:label="item.label" :value="item.value">
													</el-option>
												</el-select> -->
                      <div>
                        <el-select v-model="End_processes" multiple placeholder="请选择结算工序" clearable filterable collapse-tags>
                          <el-option v-for="(item, index) in End_processesOptions" :key="index" :label="item.label" :value="item.value" clearable> </el-option>
                        </el-select>
                      </div>

                      <div
                        class="el-input-group__prepend"
                        style="color: black; font-size: smaller; height: 31px; width: 80px; height: 28px; display: flex; align-items: center; padding-left: 10px; margin-left: 15px"
                      >
                        <i class="el-icon-search"></i>
                        总产量
                      </div>
                      <el-input placeholder="0" v-model="zongchanliang" clearable class="birthday" :readonly="true"> </el-input>

                      <div
                        class="el-input-group__prepend"
                        style="color: black; font-size: smaller; height: 31px; width: 80px; height: 28px; display: flex; align-items: center; padding-left: 10px; margin-left: 15px"
                      >
                        <i class="el-icon-search"></i>
                        总薪资
                      </div>
                      <el-input placeholder="0" v-model="zongxinzi" clearable class="birthday" :readonly="true"> </el-input>
                    </div>
                    <div style="width: 100%" id="my-table">
                      <!-- tableData渲染在这 -->
                      <el-table
                        highlight-current-row
                        :data="tableData"
                        stripe
                        border
                        max-height="500"
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
                        <el-table-column type="index" width="80" label="序号" height="38px"> </el-table-column>
                        <el-table-column v-for="(column, index) in columns" :key="index" :label="column.label" :prop="column.prop" :width="column.width" sortable> </el-table-column>
                        <el-table-column label="金额（元）" prop="jine" sortable width="150">
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
import { downloadXlsx } from "/src/utils/xlsx.js";
const BaseUrl = "https://api-e-erp.microi.net";
const erp_Api = "https://e-erp-qrcode.microi.net";
// const erp_Api = "https://localhost:44337";
var reg190317 = new RegExp("(^|&)" + "OsClient" + "=([^&]*)(&|$)");
var r190317 = window.location.search.substr(1).match(reg190317);
var osClient = r190317 != null ? r190317[2] : "";
//osClient = osClient;
export default {
  BaseUrl,
  erp_Api,
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

    var reg190317 = new RegExp("(^|&)" + "OsClient" + "=([^&]*)(&|$)");
    var r190317 = window.location.search.substr(1).match(reg190317);
    var osClient = r190317 != null ? r190317[2] : "";
    osClient = osClient;
  },
  mounted() {
    this.list2();
    this.getProcess();
  },
  watch: {
    kuanhao(newValue, oldValue) {
      var self = this;
      this.DiyCommon.Post(
        erp_Api + "/Ebu/MES_BedNumber",
        {
          StyleCode: this.kuanhao,
          OsClient: osClient
        },
        function (res) {
          if (res && res.data && Array.isArray(res.data) && res.data !== null) {
            self.options2 = res.data.map((item) => ({
              label: item,
              value: item
            }));
          } else {
            self.options2 = [];
          }
        }
      );
      this.chuangci = ""; // 重置床次的值
      //工序
      // this.DiyCommon.Post(
      //   "https://api-e-erp.microi.net/api/FormEngine/getFormData",
      //   {
      //     FormEngineKey: "Diy_kuanshixinxi",
      //     _Where: [
      //       {
      //         Name: "HuopinDH",
      //         Value: this.kuanhao,
      //         Type: "=",
      //       },
      //     ],
      //   },
      //   function (res) {
      //     var zibiaoId = res.Data.Id;
      //     self.DiyCommon.Post(
      //       "https://api-e-erp.microi.net/api/FormEngine/getTableData",
      //       {
      //         FormEngineKey: "Diy_kuanshiZBgongxu",
      //         _Where: [
      //           {
      //             Name: "ZhubiaoGXID",
      //             Value: zibiaoId,
      //             Type: "=",
      //           },
      //         ],
      //       },
      //       function (res) {
      //         if (
      //           res &&
      //           res.Data &&
      //           Array.isArray(res.Data) &&
      //           res.Data !== null
      //         ) {
      //           self.processesOptions = res.Data.map((item) => ({
      //             label: `${item.Bianhao} ${item.GongxuMC}`,
      //             value: item.GongxuMC,
      //           }));
      //            console.log(self.processesOptions);
      //         } else {
      //           self.processesOptions = [];
      //         }
      //       }
      //     );
      //     this.processes = "";
      //   }
      // );
    }
  },
  data() {
    return {
      excel: [],
      processesOptions: [],
      End_processesOptions: [],
      processes: "",
      End_processes: "",
      yanse: "",
      chima: "",
      OsClient: "",
      chuangci: [],
      sumData: {}, // 定义一个变量用于存储合计值
      currentPage: 1,
      pageSize: 15,
      totalCount: 0, // 声明 totalCount
      radio: "2",
      zongxinzi: "",
      zongchanliang: "",
      bumen: "",
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
      ganghao: "",
      columns: [
        {
          prop: "xingming",
          label: "姓名",
          width: "120"
        },
        {
          prop: "gonghao",
          label: "工号",
          width: "120"
        },
        {
          prop: "kuanhao",
          label: "款号",
          width: "120"
        },
        {
          prop: "kuanming",
          label: "款名",
          width: "150"
        },
        {
          prop: "chuangci",
          label: "床次",
          width: "100"
        },
        {
          prop: "ganghao",
          label: "缸号",
          width: "100"
        },
        {
          prop: "chima",
          label: "尺码",
          width: "100"
        },
        {
          prop: "yanse",
          label: "颜色",
          width: "100"
        },
        {
          prop: "bagNum",
          label: "包数",
          width: "100"
        },
        {
          prop: "gongxu",
          label: "工序",
          width: "120"
        },
        {
          prop: "gongjia",
          label: "工价",
          width: "150"
        },
        {
          prop: "shuliang",
          label: "数量",
          width: "120"
        }
      ]
    };
  },
  methods: {
    //获取工序
    getProcess() {
      var self = this;
      self.DiyCommon.Post(
        "https://api-e-erp.microi.net/api/FormEngine/getTableData",
        {
          FormEngineKey: "Diy_gongxuguanli"
        },
        function (res) {
          if (res && res.Data && Array.isArray(res.Data) && res.Data !== null) {
            self.processesOptions = res.Data.map((item) => ({
              label: `${item.Bianhao} ${item.GongxuMC}`,
              value: item.GongxuMC
            }));
            self.End_processesOptions = self.processesOptions;
            console.log(self.processesOptions);
          } else {
            self.processesOptions = [];
          }
        }
      );
    },

    // 修改工资
    handlePrint2() {
      var self = this;
      this.$confirm("确定重新获取单价吗？点击确定后请点查询", "提示", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      })
        .then(() => {
          this.DiyCommon.Post(
            erp_Api + "/Ebu/MES_UpdateWages",
            {
              StyleCode: this.kuanhao,
              OsClient: osClient
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
    //是否发放
    handlePrint3() {
      console.log("发放了工资");
      //
      var self = this;
      var parts = self.xingming.split("+");
      const Date_b = this.formattedDate(this.Date_be[0]);
      const Date_e = this.formattedDate(this.Date_be[1]);
      this.$confirm("确定发放吗？注意：如果没有搜索条件则为全部发放", "提示", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      })
        .then(() => {
          this.DiyCommon.Post(
            erp_Api + "/Ebu/MES_Wages_",
            {
              StyleCode: this.kuanhao,
              UserCode: parts[0],
              UserName: parts[1],
              Processes: this.processes,
              End_Processes: this.End_processes,
              Date_b: Date_b,
              Date_e: Date_e,
              _PageIndex: this.currentPage,
              _PageSize: this.pageSize,
              IsBedNumber: this.chuangci.join(","),
              Settlement: 1,
              OsClient: osClient,
              Color: self.yanse,
              Size: self.chima,
              IsSize: 1,
              IsColor: 1
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
        BaseUrl + "/api/FormEngine/getTableData",
        //"https://api-china.itdos.com/api/FormEngine/getTableData",
        {
          ModuleEngineKey: "Diy_kuanshixinxi",
          _Where: [
            {
              Name: "IsDeleted",
              Value: 0,
              Type: "="
            }
          ],
          OsClient: osClient
        },
        function (res) {
          // console.log("l4" + res.Data);
          if (res && res.Data && Array.isArray(res.Data) && res.Data !== null) {
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
      this.DiyCommon.Post(
        erp_Api + "/Ebu/MES_BedNumber",
        {
          //StyleCode: "WTT",
          OsClient: osClient
        },
        function (res) {
          console.log("chuangci:" + res.data);
          if (res && res.data && Array.isArray(res.data) && res.data !== null) {
            self.options2 = res.data.map((item) => ({
              text: item,
              value: item
            }));
          } else {
            self.options2 = [];
          }
        }
      );
    },
    getSummaries(parameters) {
      const { columns, data } = parameters;
      const sums = [];
      columns.forEach((column, index) => {
        if (index === 0) {
          sums.push("总计");
          return;
        }
        if (index === 13 || index === 12) {
          // 假设两列列是需要计算合计的列
          const values = data.map((item) => parseFloat(item[column.property])); // 获取当前列所有数值
          const sum = values.reduce((prev, curr) => prev + curr, 0); // 计算数值和
          const formattedSum = index === 12 ? parseInt(sum) : sum.toFixed(3);
          sums.push(formattedSum);
          this.$set(this.sumData, column.property, formattedSum);
        } else {
          sums.push("");
        }
      });
      return sums;
    },
    handlePrint() {
      // 获取数据并进行打印
      this.listprint();
    },
    Print() {
      this.listAllprint();
    },
    listAllprint() {
      const Date_b = this.formattedDate(this.Date_be[0]);
      const Date_e = this.formattedDate(this.Date_be[1]);
      var self = this;
      var parts = self.xingming.split("+");
      var x = "";
      if (this.chuangci != "") {
        x = this.chuangci.join(",");
      }
      this.DiyCommon.Post(
        erp_Api + "/Ebu/MES_Wages_",
        {
          Date_b: Date_b,
          Date_e: Date_e,
          IsBedNumber: x,
          StyleCode: self.kuanhao,
          Processes: self.processes,
          End_Processes: self.End_processes,
          CylinderNumber: self.ganghao,
          UserCode: parts[0],
          UserName: parts[1],
          OsClient: osClient
          // IsSize: 1,
          // IsColor: 1,
        },
        function (res) {
          self.totalCount = res.dataCount;
          self.tableData = res.data;
          const riqi1 = Date_b;
          const riqi2 = Date_e;
          console.log("haha" + riqi1, riqi2);
          // 获取工号数组并按 gonghao 排序
          var gonghaoList = [...new Set(self.tableData.map((item) => item.gonghao))];
          gonghaoList.sort();

          // 创建一个包含所有表格的字符串
          var tableHTML = "";

          // 遍历工号数组，生成相应的表格
          gonghaoList.forEach(function (gonghao) {
            var data = self.tableData.filter((item) => item.gonghao === gonghao);

            // 添加表格的表头
            tableHTML += "<table style='border-collapse: collapse; border-spacing: 0; margin-bottom: 20px;width: 95%; margin-left: auto; margin-right: auto;'>";
            tableHTML += `<caption style='caption-side: top; text-align: center; font-weight: bold; font-size: 18px; margin-bottom: 10px;'>${data[0].xingming}-月度个人计件生产统计表</caption>`;
            //  <th style='padding: 5px; text-align: center;' colspan='3'>打印日期:${Date_b}</th>
            //<th style='padding: 5px; text-align: center;' colspan='2'>日期${Date_b}到${Date_e}</th>
            // <th style='padding: 5px; text-align: center;' colspan='2'>第页/总页</th>
            tableHTML += `<thead>

             <tr style='width: 90%; margin-left: auto; margin-right: auto;'>
     <th colspan="9" style='border: 2px solid black; padding: 5px; text-align: center; width: 100%;'>部门 - ${data[0].bumen}</th>
           </tr>
            <tr>
            <th style='border: 2px solid black; padding: 5px; text-align: center;'>姓名</th>
            <th style='border: 2px solid black; padding: 5px; text-align: center;'>${data[0].xingming}</th>
            <th style='border: 2px solid black; padding: 5px; text-align: center;'>工号</th>
            <th style='border: 2px solid black; padding: 5px; text-align: center;'>${data[0].gonghao}</th>
            <th style='border: 2px solid black; padding: 5px; text-align: center;'>日期</th>
            <th style='border: 2px solid black; padding: 5px; text-align: center;' colspan="4">${Date_b}到${Date_e}</th>
            </tr>
            <tr>`;
            tableHTML += "<th style='border: 2px solid black; padding: 5px; text-align: center;'>床次</th>";
            tableHTML += "<th style='border: 2px solid black; padding: 5px; text-align: center;'>款号</th>";
            tableHTML += "<th style='border: 2px solid black; padding: 5px; text-align: center;'>款名</th>";
            tableHTML += "<th style='border: 2px solid black; padding: 5px; text-align: center;'>缸号</th>";
            tableHTML += "<th style='border: 2px solid black; padding: 5px; text-align: center;'>工序</th>";
            tableHTML += "<th style='border: 2px solid black; padding: 5px; text-align: center;'>包数</th>";
            tableHTML += "<th style='border: 2px solid black; padding: 5px; text-align: center;'>实际数量</th>";
            tableHTML += "<th style='border: 2px solid black; padding: 5px; text-align: center;'>单价(元)</th>";
            tableHTML += "<th style='border: 2px solid black; padding: 5px; text-align: center;'>实际金额(元)</th>";

            tableHTML += `</tr>
            </thead>`;
            // tableHTML += "<button>打印</button>";
            // 添加表格的表体
            tableHTML += "<tbody>";

            let totalJine = data.reduce((total, item) => total + item.jine, 0).toFixed(3);
            let totalShuliang = data.reduce((total, item) => total + item.shuliang, 0);
            data.sort((a, b) => a.kuanhao.localeCompare(b.kuanhao));
            data.forEach((item) => {
              tableHTML += "<tr>";
              //tableHTML += `<td style='border: 2px solid black; padding: 5px; text-align: center;'>${item.xingming}</td>`;
              //tableHTML += `<td style='border: 2px solid black; padding: 5px; text-align: center;'>${item.gonghao}</td>`;
              tableHTML += `<td style='border: 2px solid black; padding: 5px; text-align: center;'>${item.chuangci || " "}</td>`;
              tableHTML += `<td style='border: 2px solid black; padding: 5px; text-align: center;'>${item.kuanhao}</td>`;
              tableHTML += `<td style='border: 2px solid black; padding: 5px; text-align: center;'>${item.kuanming}</td>`;
              tableHTML += `<td style='border: 2px solid black; padding: 5px; text-align: center;'>${item.ganghao || " "}</td>`;
              tableHTML += `<td style='border: 2px solid black; padding: 5px; text-align: center;'>${item.gongxu}</td>`;
              tableHTML += `<td style='border: 2px solid black; padding: 5px; text-align: center;'>${item.bagNum}</td>`;
              tableHTML += `<td style='border: 2px solid black; padding: 5px; text-align: center;'>${item.shuliang}</td>`;
              tableHTML += `<td style='border: 2px solid black; padding: 5px; text-align: center;'>${item.gongjia}</td>`;
              tableHTML += `<td style='border: 2px solid black; padding: 5px; text-align: center;'>${item.jine}</td>`;
              tableHTML += "</tr>";
            });
            tableHTML += `<th colspan="5" style='border: 2px solid black; padding: 5px; text-align: center;'>员工报工合计</th>`;

            tableHTML += `<th style='border: 2px solid black; padding: 5px; text-align: center;'></th>`;
            tableHTML += `<th style='border: 2px solid black; padding: 5px; text-align: center;'>${totalShuliang}</th>`;
            tableHTML += `<th style='border: 2px solid black; padding: 5px; text-align: center;'></th>`;
            tableHTML += `<th style='border: 2px solid black; padding: 5px; text-align: center;'>${totalJine}</th>`;
            tableHTML += "</>";
            tableHTML += "</table>";
            //tableHTML += "<button @click='hhh'>打印</button>";
            // 添加分页符，使相同工号的表格放在一页
            tableHTML += "<div style='page-break-after: always;'></div>";
          });

          // 创建一个新的窗口，并把所有表格添加到新窗口中进行打印预览
          const printWindow = window.open("", "Print Preview", "height=600,width=800");
          printWindow.document.write("<html><head><title>个人计件生产统计表</title></head><body>");
          printWindow.document.write(tableHTML);
          printWindow.document.write("</body></html>");

          // 打印预览
          printWindow.print();
        }
      );
    },
    listprint() {
      const Date_b = this.formattedDate(this.Date_be[0]);
      const Date_e = this.formattedDate(this.Date_be[1]);
      var self = this;
      var parts = self.xingming.split("+");
      var x = "";
      if (this.chuangci != "") {
        x = this.chuangci.join(",");
      }
      this.DiyCommon.Post(
        erp_Api + "/Ebu/MES_Wages_",
        {
          Color: self.yanse,
          Size: self.chima,
          IsSize: 1,
          IsColor: 1,
          CylinderNumber: self.ganghao,
          StyleCode: self.kuanhao,
          UserCode: parts[0],
          UserName: parts[1],
          Processes: self.processes,
          End_Processes: self.End_processes,
          Date_b: Date_b,
          Date_e: Date_e,
          IsBedNumber: x,
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
          const riqi1 = Date_b;
          const riqi2 = Date_e;
          console.log("haha" + riqi1, riqi2);
          // 获取工号数组并按 gonghao 排序
          var gonghaoList = [...new Set(self.tableData.map((item) => item.gonghao))];
          gonghaoList.sort();

          // 创建一个包含所有表格的字符串
          var tableHTML = "";

          // 遍历工号数组，生成相应的表格
          gonghaoList.forEach(function (gonghao) {
            var data = self.tableData.filter((item) => item.gonghao === gonghao);

            // 添加表格的表头
            tableHTML += "<table style='border-collapse: collapse; border-spacing: 0; margin-bottom: 20px;width: 95%; margin-left: auto; margin-right: auto;'>";
            tableHTML += `<caption style='caption-side: top; text-align: center; font-weight: bold; font-size: 18px; margin-bottom: 10px;'>${data[0].xingming}-月度个人计件生产统计表</caption>`;
            //  <th style='padding: 5px; text-align: center;' colspan='3'>打印日期:${Date_b}</th>
            //<th style='padding: 5px; text-align: center;' colspan='2'>日期${Date_b}到${Date_e}</th>
            // <th style='padding: 5px; text-align: center;' colspan='2'>第页/总页</th>
            tableHTML += `<thead>

             <tr style='width: 90%; margin-left: auto; margin-right: auto;'>
     <th colspan="11" style='border: 2px solid black; padding: 5px; text-align: center; width: 100%;'>部门 - ${data[0].bumen}</th>
           </tr>
            <tr>
            <th style='border: 2px solid black; padding: 5px; text-align: center;'>姓名</th>
            <th style='border: 2px solid black; padding: 5px; text-align: center;'>${data[0].xingming}</th>
            <th style='border: 2px solid black; padding: 5px; text-align: center;'>工号</th>
            <th style='border: 2px solid black; padding: 5px; text-align: center;'>${data[0].gonghao}</th>
            <th style='border: 2px solid black; padding: 5px; text-align: center;'>日期</th>
            <th style='border: 2px solid black; padding: 5px; text-align: center;' colspan="6">${Date_b}到${Date_e}</th>
            </tr>
            <tr>`;
            tableHTML += "<th style='border: 2px solid black; padding: 5px; text-align: center;'>床次</th>";
            tableHTML += "<th style='border: 2px solid black; padding: 5px; text-align: center;'>款号</th>";
            tableHTML += "<th style='border: 2px solid black; padding: 5px; text-align: center;'>款名</th>";
            tableHTML += "<th style='border: 2px solid black; padding: 5px; text-align: center;'>缸号</th>";
            tableHTML += "<th style='border: 2px solid black; padding: 5px; text-align: center;'>工序</th>";
            tableHTML += "<th style='border: 2px solid black; padding: 5px; text-align: center;'>尺码</th>";
            tableHTML += "<th style='border: 2px solid black; padding: 5px; text-align: center;'>颜色</th>";
            tableHTML += "<th style='border: 2px solid black; padding: 5px; text-align: center;'>包数</th>";
            tableHTML += "<th style='border: 2px solid black; padding: 5px; text-align: center;'>实际数量</th>";
            tableHTML += "<th style='border: 2px solid black; padding: 5px; text-align: center;'>单价(元)</th>";
            tableHTML += "<th style='border: 2px solid black; padding: 5px; text-align: center;'>金额(元)</th>";

            tableHTML += `</tr>
            </thead>`;
            // tableHTML += "<button>打印</button>";
            // 添加表格的表体
            tableHTML += "<tbody>";

            let totalJine = data.reduce((total, item) => total + item.jine, 0).toFixed(3);
            let totalShuliang = data.reduce((total, item) => total + item.shuliang, 0);
            data.sort((a, b) => a.kuanhao.localeCompare(b.kuanhao));
            data.forEach((item) => {
              tableHTML += "<tr>";
              //tableHTML += `<td style='border: 2px solid black; padding: 5px; text-align: center;'>${item.xingming}</td>`;
              //tableHTML += `<td style='border: 2px solid black; padding: 5px; text-align: center;'>${item.gonghao}</td>`;
              tableHTML += `<td style='border: 2px solid black; padding: 5px; text-align: center;'>${item.chuangci || " "}</td>`;
              tableHTML += `<td style='border: 2px solid black; padding: 5px; text-align: center;'>${item.kuanhao}</td>`;
              tableHTML += `<td style='border: 2px solid black; padding: 5px; text-align: center;'>${item.kuanming}</td>`;
              tableHTML += `<td style='border: 2px solid black; padding: 5px; text-align: center;'>${item.ganghao || " "}</td>`;
              tableHTML += `<td style='border: 2px solid black; padding: 5px; text-align: center;'>${item.gongxu}</td>`;
              tableHTML += `<td style='border: 2px solid black; padding: 5px; text-align: center;'>${item.chima.startsWith("Chima_") ? item.chima.replace("Chima_", "") : item.chima}</td>`;
              tableHTML += `<td style='border: 2px solid black; padding: 5px; text-align: center;'>${item.yanse}</td>`;
              tableHTML += `<td style='border: 2px solid black; padding: 5px; text-align: center;'>${item.bagNum}</td>`;
              tableHTML += `<td style='border: 2px solid black; padding: 5px; text-align: center;'>${item.shuliang}</td>`;
              tableHTML += `<td style='border: 2px solid black; padding: 5px; text-align: center;'>${item.gongjia}</td>`;
              tableHTML += `<td style='border: 2px solid black; padding: 5px; text-align: center;'>${item.jine}</td>`;
              tableHTML += "</tr>";
            });
            tableHTML += `<th colspan="4" style='border: 2px solid black; padding: 5px; text-align: center;'>员工报工合计</th>`;
            tableHTML += `<th style='border: 2px solid black; padding: 5px; text-align: center;'></th>`;
            tableHTML += `<th style='border: 2px solid black; padding: 5px; text-align: center;'></th>`;
            tableHTML += `<th style='border: 2px solid black; padding: 5px; text-align: center;'></th>`;
            tableHTML += `<th style='border: 2px solid black; padding: 5px; text-align: center;'></th>`;
            tableHTML += `<th style='border: 2px solid black; padding: 5px; text-align: center;'>${totalShuliang}</th>`;
            tableHTML += `<th style='border: 2px solid black; padding: 5px; text-align: center;'></th>`;
            tableHTML += `<th style='border: 2px solid black; padding: 5px; text-align: center;'>${totalJine}</th>`;
            tableHTML += "</>";
            tableHTML += "</table>";
            //tableHTML += "<button @click='hhh'>打印</button>";
            // 添加分页符，使相同工号的表格放在一页
            tableHTML += "<div style='page-break-after: always;'></div>";
          });

          // 创建一个新的窗口，并把所有表格添加到新窗口中进行打印预览
          const printWindow = window.open("", "Print Preview", "height=600,width=800");
          printWindow.document.write("<html><head><title>月度个人计件生产统计表</title></head><body>");
          printWindow.document.write(tableHTML);
          printWindow.document.write("</body></html>");

          // 打印预览
          printWindow.print();
        }
      );
    },
    //导出按钮
    exportToExcel() {
      var self = this;
      console.log("点击了导出按钮！");
      //this.handlePrint2()
      var parts = self.xingming.split("+");
      const Date_b = this.formattedDate(this.Date_be[0]);
      const Date_e = this.formattedDate(this.Date_be[1]);
      var x = "";
      if (this.chuangci != "") {
        x = self.chuangci.join(",");
      }
      this.DiyCommon.Post(
        erp_Api + "/Ebu/MES_Wages_",
        {
          Color: self.yanse,
          Size: self.chima,
          IsSize: 1,
          IsColor: 1,
          CylinderNumber: self.ganghao,
          StyleCode: self.kuanhao,
          UserCode: parts[0],
          UserName: parts[1],
          Processes: self.processes,
          End_Processes: self.End_processes,
          Date_b: Date_b,
          Date_e: Date_e,
          IsBedNumber: x,
          OsClient: osClient
        },
        function (res) {
          self.totalCount = res.dataCount;
          res.data.forEach((item) => {
            if (item.chima && item.chima.startsWith("Chima_")) {
              item.chima = item.chima.substr(6);
            }
          });
          console.log("调用接口：MES_Wages_，成功，并打印res.data(length" + self.excel.length + ") ↓↓↓↓↓↓");
          console.log(res.data);

          // self.excel = res.data;
          if (res.data.length > 0) {
            let datalist = []; //导出表格表头
            datalist.push(["姓名", "工号", "款号", "数量", "金额", "床次", "工序"]);
            res.data.forEach((item) => {
              datalist.push([item.xingming, item.gonghao, item.kuanhao, item.shuliang, item.jine, item.chuangci, item.gongxu]);
            });
            downloadXlsx(datalist, "工资表.xlsx");
            // // 筛选需要导出的表格列
            // const filteredTableData = self.excel.map(item => {
            // 	return {
            // 		姓名: item.xingming,
            // 		工号: item.gonghao,
            // 		款号: item.kuanhao,
            // 		数量: item.shuliang,
            // 		金额: item.jine,
            // 		床次: item.chuangci,
            // 		工序: item.gongxu
            // 	};
            // });
            // console.log('将需要打印的数据赋值到const filteredTableData中 ↓↓↓↓↓↓');
            // console.log(filteredTableData);
            // // 将表格数据转换为 Excel 表格数据
            // const sheet = XLSX.utils.json_to_sheet(filteredTableData);

            // // 创建 Excel 工作簿
            // const workbook = XLSX.utils.book_new();
            // XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");

            // // 将工作簿写入二进制流
            // const excelData = XLSX.write(workbook, {
            // 	bookType: "xlsx",
            // 	type: "array"
            // });

            // // 创建并下载 Excel 文件
            // const blob = new Blob([excelData], {
            // 	type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            // });
            // const a = document.createElement("a");
            // const url = URL.createObjectURL(blob);
            // a.href = url;
            // a.download = "工资表.xlsx";
            // document.body.appendChild(a);
            // a.click();
            // document.body.removeChild(a);
            // URL.revokeObjectURL(url);
          }
        }
      );
      //导出按钮结束
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
        BaseUrl + "/api/FormEngine/getTableData",
        {
          ModuleEngineKey: "Sys_User",
          _Where: [
            {
              Name: "State",
              Value: "1",
              Type: "=="
            }
          ],
          OsClient: osClient
        },
        function (res) {
          console.log(res);
          if (res && res.Data && Array.isArray(res.Data) && res.Data !== null) {
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
      //this.handlePrint2()
      var parts = self.xingming.split("+");
      const Date_b = this.formattedDate(this.Date_be[0]);
      const Date_e = this.formattedDate(this.Date_be[1]);
      var x = "";
      if (this.chuangci != "") {
        x = self.chuangci.join(",");
      }
      this.DiyCommon.Post(
        erp_Api + "/Ebu/MES_Wages_Weikai",
        {
          Color: self.yanse,
          Size: self.chima,
          IsSize: 1,
          IsColor: 1,
          CylinderNumber: self.ganghao,
          StyleCode: self.kuanhao,
          UserCode: parts[0],
          UserName: parts[1],
          Processes: self.processes,
          End_Processes: self.End_processes,
          Date_b: Date_b,
          Date_e: Date_e,
          _PageIndex: self.currentPage,
          _PageSize: self.pageSize,
          Bumen: self.bumen,
          IsBedNumber: x,
          OsClient: osClient
        },
        function (res) {
          self.totalCount = res.dataCount;
          res.data.forEach((item) => {
            if (item.chima && item.chima.startsWith("Chima_")) {
              item.chima = item.chima.substr(6);
            }
          });
          self.tableData = res.data;
          self.zongchanliang = res.dataList[0];
          self.zongxinzi = res.dataList[1];
        }
      );
    },
    list2() {
      const Date_b = this.formattedDate(this.Date_be[0]);
      const Date_e = this.formattedDate(this.Date_be[1]);
      var self = this;
      var parts = self.xingming.split("+");
      this.DiyCommon.Post(
        erp_Api + "/Ebu/MES_Wages_",
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
          self.zongchanliang = res.dataList[0];
          self.zongxinzi = res.dataList[1];
        }
      );
    }
  }
};
</script>

<style lang="scss" scoped>
::v-deep .birthday .el-input__inner {
  background-color: #f1f3f5;
  width: 150px !important;
}

.el-main {
  line-height: 38px;
}

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

::v-deep .el-table__header th {
  color: #333;
  font-size: 14px;
  font-weight: 400;
  // text-align: center;
  padding: 0;
}

.search-box {
  background-color: #f5f7fa;
  text-align: center;
  width: 6vw;
  border: 1px solid #cdcbcb;
  padding: 2px 0;
  border-radius: 4px;
  margin: 10px;
}

.search-input {
  display: flex;
  font-size: 15px;
  align-items: center;
}

.search-input1 {
  display: -webkit-box;
  font-size: 15px;
  align-items: center;
}

// @media print {
//   @page {
//     margin: 0;
//   }

//   body {
//     margin: 1cm;
//   }
// }
</style>
