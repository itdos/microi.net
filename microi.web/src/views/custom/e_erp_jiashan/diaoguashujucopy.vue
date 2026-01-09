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
                    <!-- <div>
                      <el-button
                        style="width: 70px; height: 31px; font-size: smaller"
                        type="primary"
                        @click="search"
                      >
                        <i
                          class="more-btn mr-1 far fa-check-circle"
                          style="margin-left: -10px"
                        ></i>
                        <span> 查询 </span>
                      </el-button>
                      <el-button
                        @click="exportToExcel"
                        style="
                          width: 85px;
                          height: 31px;
                          font-size: smaller;
                          padding-bottom: 20px;
                        "
                      >
                        <i class="el-icon-download"></i>
                        <span>导出</span>
                      </el-button>
                      <el-button
                        style="
                          width: 90px;
                          height: 31px;
                          font-size: smaller;
                          padding-bottom: 20px;
                        "
                        type="primary"
                        @click="handlePrint"
                        >打印表格</el-button
                      >
                      
                      <el-button
                        style="width: 90px; height: 31px; padding-bottom: 20px"
                        type="primary"
                        @click="Print"
                        >打印表格2</el-button
                      >
                      <el-button
                        style="width: 90px; height: 31px; padding-bottom: 20px"
                        type="danger"
                        @click="handlePrint3"
                        >是否发放</el-button
                      >

                    </div> -->

                    <div style="display: flex; flex-wrap: wrap; margin-left: -10px">
                      <!-- 款号 -->
                      <!-- <div class="search-input">
                        <div class="search-box">
                          <i
                            class="el-icon-search"
                            style="padding-top: 3px; padding-right: 5px"
                          ></i>
                          <span style="font-size: smaller">款&emsp;号</span>
                        </div>
                        <el-select
                          v-model="kuanhaos"
                          placeholder="请选择款号"
                          clearable
                          filterable
                          multiple
                          collapse-tags
                          @change="handleSelect"
                        >
                          <el-option
                            v-for="(item) in options3"
                            :key="item.Id"
                            :label="`${item.HuopinDH} ${item.HuopinMC}`"
                            :value="item.Id"
                            clearble
                          >
                          </el-option>
                        </el-select>

                      </div> -->
                      <!-- <div class="search-input">
                        <el-popover
                          ref="myPopover"
                          placement="right"
                          width="800"
                          trigger="click"
                          >
                          <div>
                            <el-table :data="gridData" height="450" @selection-change="handleSelectionChange">
                              <el-table-column type="selection" width="55"> </el-table-column>
                              <el-table-column width="250" property="HuopinDHs" label="款号"></el-table-column>
                              <el-table-column width="250" property="name" label="款名"></el-table-column>
                              <el-table-column width="300" property="address" label="创建时间"></el-table-column>
                            </el-table>
                            <div style="text-align: right; margin-top: 10px;">
                              <el-button type="primary" @click="handleConfirm">确认</el-button>
                            </div>
                          </div>
                          <el-button slot="reference">选择款号</el-button>
                        </el-popover>
                      </div> -->
                      <!-- 工序 -->
                      <!-- <div class="search-input">
                        <div class="search-box">
                          <i
                            class="el-icon-search"
                            style="padding-top: 3px; padding-right: 5px"
                          ></i>
                          <span style="font-size: smaller">工&emsp;序</span>
                        </div>
                        <el-select
                          v-model="processes"
                          placeholder="请选择工序"
                          clearable
                          filterable
                        >
                          <el-option
                            v-for="(item, index) in processesOptions"
                            :key="index"
                            :label="item.label"
                            :value="item.value"
                          >
                          </el-option>
                        </el-select>
                      </div> -->
                      <!-- 姓名 -->
                      <!-- <div class="search-input">
                        <div class="search-box">
                          <i
                            class="el-icon-search"
                            style="padding-top: 3px; padding-right: 5px"
                          ></i>
                          <span style="font-size: smaller">姓&emsp;名</span>
                        </div> -->
                      <!-- 下拉 -->
                      <!-- <el-select
                          v-model="xingming"
                          placeholder="请选择姓名"
                          clearable
                          filterable
                        >
                          <el-option
                            v-for="(item, index) in options"
                            :key="index"
                            :label="`${item.id} ${item.name}`"
                            :value="`${item.id}+${item.name}`"
                          >
                          </el-option>
                        </el-select> -->
                      <!-- </div> -->
                      <!-- 床次多选框 -->
                      <!-- <div class="search-input"> -->
                      <!-- <div class="search-box">
                          <i
                            class="el-icon-search"
                            style="padding-top: 3px; padding-right: 5px"
                          ></i>
                          <span style="font-size: smaller">床&emsp;次</span>
                        </div> -->
                      <!-- 床次下拉多选 -->
                      <!-- <div>
                          <el-select
                            v-model="chuangci"
                            multiple
                            placeholder="请选择床次"
                            clearable
                            collapse-tags
                          >
                            <el-option
                              v-for="item in options2"
                              :key="item.value"
                              :label="item.text"
                              :value="item.value"
                              clearable
                            >
                            </el-option>
                          </el-select>
                        </div> -->
                      <!--  -->
                      <!-- </div> -->
                      <!-- 工序描述 -->
                      <div style="display: flex; align-items: center; margin-left: 10px">
                        <div class="el-input-group__prepend" style="color: black; font-size: smaller; height: 31px; width: 80px; height: 28px; display: flex; align-items: center">
                          <i class="el-icon-search"></i>
                          工序描述
                        </div>
                        <el-input placeholder="请输入工序" v-model="ganghao" clearable style="width: 120px"> </el-input>
                      </div>
                      <!-- 生产线号 -->
                      <div style="display: flex; align-items: center; margin-left: 10px">
                        <div class="el-input-group__prepend" style="color: black; font-size: smaller; height: 31px; width: 80px; height: 28px; display: flex; align-items: center">
                          <i class="el-icon-search"></i>
                          生产线号
                        </div>
                        <el-input placeholder="请输入生产线号" v-model="yanse" clearable style="width: 120px"> </el-input>
                      </div>
                      <!-- 款式编号 -->
                      <div style="display: flex; align-items: center; margin-left: 10px">
                        <div class="el-input-group__prepend" style="color: black; font-size: smaller; height: 31px; width: 80px; height: 28px; display: flex; align-items: center">
                          <i class="el-icon-search"></i>
                          款式编号
                        </div>
                        <el-input placeholder="请输入款式编号" v-model="chima" clearable style="width: 120px"> </el-input>
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
                    <!-- <div class="search-input1">
                      <div class="search-box">
                        <i
                          class="el-icon-search"
                          style="padding-top: 3px; padding-right: 5px"
                        ></i>
                        <span style="font-size: smaller">结算工序</span>
                      </div>
                      <div>
                        <el-select
                          v-model="End_processes"
                          multiple
                          placeholder="请选择结算工序"
                          clearable
                          filterable
                          collapse-tags
                        >
                          <el-option
                            v-for="(item, index) in End_processesOptions"
                            :key="index"
                            :label="item.label"
                            :value="item.value"
                            clearable
                          >
                          </el-option>
                        </el-select>
                      </div>
                      
                      <div
                          class="el-input-group__prepend"
                          style="
                            color: black;
                            font-size: smaller;
                            height: 31px;
                            width: 80px;
                            height: 28px;
                            display: flex;
                            align-items: center;
                            padding-left: 10px;
                            margin-left: 15px;
                          "
                        >
                          <i class="el-icon-search"></i>
                          总产量
                        </div>
                        <el-input
                          placeholder="0"
                          v-model="zongchanliang"
                          clearable
                          class="birthday"
                          :readonly="true"
                        >
                        </el-input>

                      <div
                          class="el-input-group__prepend"
                          style="
                            color: black;
                            font-size: smaller;
                            height: 31px;
                            width: 80px;
                            height: 28px;
                            display: flex;
                            align-items: center;
                            padding-left: 10px;
                            margin-left: 15px;
                          "
                        >
                          <i class="el-icon-search"></i>
                          总薪资
                        </div>
                        <el-input
                          placeholder="0"
                          v-model="zongxinzi"
                          clearable
                          class="birthday"
                          :readonly="true"
                        >
                        </el-input>

                    </div> -->
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
                        <el-table-column fixed="right" label="操作" width="100">
                          <template slot-scope="scope">
                            <!-- <el-button @click="handleClick(scope.row)" type="text" size="small" class="watch">查看</el-button>
                             -->
                            <el-popover placement="right" width="1090" max-height="400" trigger="click">
                              <div
                                style="
                                  display: flex;

                                  align-items: center;
                                  margin-left: 10px;
                                "
                              >
                                <div style="display: flex; align-items: center; margin-left: 10px">
                                  <div
                                    class="search-box"
                                    style="color: black; font-size: smaller; height: 31px; width: 100px; height: 28px; display: flex; justify-content: center; align-items: center"
                                  >
                                    <i class="el-icon-search"></i>
                                    工序描述
                                  </div>
                                  <el-input placeholder="请输入工序" v-model="ganghao" clearable style="width: 120px"> </el-input>
                                </div>
                                <!-- 生产线号 -->
                                <div style="display: flex; text-align: center; align-items: center; margin-left: 10px">
                                  <div
                                    class="search-box"
                                    style="color: black; font-size: smaller; height: 31px; width: 100px; height: 28px; display: flex; align-items: center; justify-content: center"
                                  >
                                    <i class="el-icon-search"></i>
                                    生产线号
                                  </div>
                                  <el-input placeholder="请输入生产线号" v-model="yanse" clearable style="width: 120px"> </el-input>
                                </div>
                                <!-- 款式编号 -->
                                <div style="display: flex; align-items: center; margin-left: 10px">
                                  <div
                                    class="search-box"
                                    style="color: black; font-size: smaller; height: 31px; width: 100px; height: 28px; display: flex; align-items: center; justify-content: center"
                                  >
                                    <i class="el-icon-search"></i>
                                    款式编号
                                  </div>
                                  <el-input placeholder="请输入款式编号" v-model="chima" clearable style="width: 150px"> </el-input>
                                </div>
                                <!-- 员工姓名 -->
                                <div style="display: flex; align-items: center; margin-left: 10px">
                                  <div
                                    class="search-box"
                                    style="color: black; font-size: smaller; height: 31px; width: 100px; height: 28px; display: flex; align-items: center; justify-content: center"
                                  >
                                    <i class="el-icon-search"></i>
                                    员工姓名
                                  </div>
                                  <el-input placeholder="请输入员工姓名" v-model="chima" clearable style="width: 150px"> </el-input>
                                </div>
                              </div>
                              <!-- 时间 -->
                              <div class="search-input2">
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
                                <el-button type="primary" style="margin-left: 30px">主要按钮</el-button>
                              </div>
                              <div>
                                <el-table :data="gridDatas" stripe max-height="600" border :row-style="{ height: '38px' }" class="custom-table">
                                  <el-table-column width="120" property="ShengchanXH" label="生产线号"></el-table-column>
                                  <el-table-column width="120" property="KuanshiBH" label="款式编号"></el-table-column>
                                  <el-table-column width="120" property="KuanshiPM" label="款式品名"></el-table-column>
                                  <el-table-column width="120" property="YuangongGH" label="员工工号"></el-table-column>
                                  <el-table-column width="120" property="YuangongXM" label="员工姓名"></el-table-column>
                                  <el-table-column width="100" property="ShangcaiS" label="上裁数"></el-table-column>
                                  <el-table-column width="110" property="Colors" label="颜色描述"></el-table-column>
                                  <el-table-column width="110" property="Chima" label="尺码描述"></el-table-column>
                                  <el-table-column width="110" property="GongxuBH" label="工序编号"></el-table-column>
                                  <el-table-column width="120" property="GongxuMS" label="工序描述"></el-table-column>
                                  <!-- <el-table-column width="120" property="GongxuH" label="工序号"></el-table-column> -->
                                </el-table>
                              </div>

                              <!-- <div
                                  class="pagination"
                                  style="
                                    margin-top: 10px;
                                    float: left;
                                    margin-bottom: 10px;
                                    clear: both;
                                    margin-left: 10px;
                                  "
                                >
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
                                </div> -->
                              <el-button slot="reference" @click="MXS(scope.row)">详情</el-button>
                            </el-popover>
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
    console.log(this.osClient);
    // 获取本月第一天和最后一天的时间戳
    const now = new Date(); // 获取当前日期
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1); // 当前月份第一天
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0); // 当前月份最后一天
    // 将时间戳数组赋值给Date_be属性
    this.Date_be = [startOfMonth.getTime(), endOfMonth.getTime()];
    // this.list();
    // this.list4();
    // this.list3();
    this.list5();
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
      //   "https://api-e-erp.microi.net/api/FormEngine/GetFormData",
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
      //       "https://api-e-erp.microi.net/api/FormEngine/GetTableData",
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
      items: [],
      allData: [],
      selectedDate: null,
      excel: [],
      kuanhaos: [],
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
      gridDatas: [],
      options2: [],
      options3: [], //款号
      options4: [],
      xingming: "",
      Date_be: [],
      kuanhao: "",
      gonghao: "",
      tableData: [],
      ganghao: "",
      gridData: [],
      selectedValue: "",
      newArr: [],
      columns: [
        {
          prop: "xianhao",
          label: "生产线号",
          width: "200"
        },
        {
          prop: "kuanshiBH",
          label: "款式编号",
          width: "200"
        },
        {
          prop: "kuanshiPM",
          label: "款式品名",
          width: "200"
        },
        {
          prop: "yuangongGH",
          label: "员工工号",
          width: "200"
        },
        {
          prop: "yuangongXM",
          label: "员工姓名",
          width: "200"
        },
        {
          prop: "shangcaiS",
          label: "上裁数",
          width: "150"
        },
        // {
        //   prop: "yanse",
        //   label: "颜色描述",
        //   width: "110",
        // },
        // {
        //   prop: "chima",
        //   label: "尺码",
        //   width: "110",
        // },
        {
          prop: "gongxuBH",
          label: "工序编号",
          width: "200"
        },
        {
          prop: "gongxuMS",
          label: "工序描述",
          width: "150"
        }
        // {
        //   prop: "gongxuH",
        //   label: "工序号",
        //   width: "150",
        // }
      ]
    };
  },
  methods: {
    MXS(row) {
      console.log(row);
      var self = this;
      this.DiyCommon.Post(
        BaseUrl + "/api/FormEngine/GetTableData",
        {
          ModuleEngineKey: "c78f2b88-444e-4472-906b-f5deecfa49d5",
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
          // 检查响应是否有效
          console.log(res);
          if (res && res.Data && Array.isArray(res.Data) && res.Data !== null) {
            console.log(row.xianhao);
            self.gridDatas = res.Data.filter((item) => {
              return (
                row.xianhao == item.VHR_HRD_Line &&
                row.kuanshiBH == item.VHR_ST_ID &&
                row.kuanshiPM == item.VHR_ST_Collection &&
                row.yuangongGH == item.VHR_HRD_EM_Key &&
                row.yuangongXM == item.VHR_EM_LCD_Name &&
                // row.shangcaiS == item.VHR_HM_Garments_Per_Hanger
                row.gongxuBH == item.VHR_HRD_OC_Key &&
                row.gongxuMS == item.VHR_OC_Description
              );
            }).map((item) => ({
              // 在这里选择您需要的属性
              ShengchanXH: item.VHR_HRD_Line, // 替换为实际属性名称
              KuanshiBH: item.VHR_ST_ID, // 替换为实际属性名称
              KuanshiPM: item.VHR_ST_Collection, // 替换为实际属性名称
              YuangongGH: item.VHR_HRD_EM_Key, // 替换为实际属性名称
              YuangongXM: item.VHR_EM_LCD_Name, // 替换为实际属性名称
              ShangcaiS: item.VHR_HM_Garments_Per_Hanger, // 替换为实际属性名称
              Colors: item.VHR_CM_Description, // 替换为实际属性名称
              Chima: item.VHR_SM_Description, // 替换为实际属性名称
              GongxuBH: item.VHR_HRD_OC_Key, // 替换为实际属性名称
              GongxuMS: item.VHR_OC_Description // 替换为实际属性名称
              // 可以继续添加其他需要的属性
            }));
            console.log(self.gridDatas);
          } else {
            self.gridDatas = [];
          }
        }
      );
    },
    chakanMX: {},
    handleSelect(kuanhaos) {
      console.log(kuanhaos);
      console.log(this.options3);
      kuanhaos.forEach((i) => {
        console.log(i);
        const selectedItem = this.options3.find((item) => item.Id == i);
        if (selectedItem) {
          this.selectedValue = `${selectedItem.HuopinDH}`;
          console.log(this.selectedValue);
        } else {
          this.selectedValue = ""; // 处理未找到的情况
          console.log(this.selectedValue);
        }
      });
    },
    //弹出表格多选款号
    handleSelectionChange(val) {
      // self.options4 = val
      this.options4 = val;
    },

    handleConfirm() {
      // console.log(this.options4)
      // 获取选中的数据
      const selectedIds = this.options4.map((row) => row.Id);

      // 设置 el-select 的选中状态
      this.kuanhaos = selectedIds;
      this.$refs.myPopover.doClose();
      // 你可以在这里处理选中的数据，例如发送到服务器或进行其他操作
    },

    //获取工序
    getProcess() {
      var self = this;
      self.DiyCommon.Post(
        "https://api-e-erp.microi.net/api/FormEngine/GetTableData",
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
      var x = "";
      let arr = [];
      const Date_b = this.formattedDate(this.Date_be[0]);
      const Date_e = this.formattedDate(this.Date_be[1]);
      this.$confirm("确定发放吗？注意：如果没有搜索条件则为全部发放", "提示", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      })
        .then(() => {
          console.log(11111111);
          let ars = "";
          console.log(this.options4.length);
          console.log(this.options4);
          if (this.options4.length > 0) {
            console.log(2222);
            this.options4.forEach((item, index) => {
              arr.push(item.HuopinDHs);
            });
            console.log(arr.join(","));
            ars = arr.join(",");
            console.log(ars);
          } else {
            ars = this.selectedValue;
            console.log(ars);
          }
          this.DiyCommon.Post(
            erp_Api + "/Ebu/MES_Wages_",
            {
              StyleCode: ars,
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
        BaseUrl + "/api/FormEngine/GetTableData",
        //"https://api-china.itdos.com/api/FormEngine/GetTableData",
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
          console.log(res);
          if (res && res.Data && Array.isArray(res.Data) && res.Data !== null) {
            self.options3 = res.Data.map((item) => ({
              HuopinDH: item.HuopinDH,
              HuopinMC: item.HuopinMC,
              Id: item.Id
            }));
            self.gridData = res.Data.map((item) => ({
              HuopinDHs: item.HuopinDH,
              name: item.HuopinMC,
              Id: item.Id,
              address: item.CreateTime
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
        if (index === 6) {
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
      let arr = [];
      console.log("options4" + this.options4);
      let ars;
      if (this.options4.length > 0) {
        this.options4.forEach((item, index) => {
          arr.push(item.HuopinDHs);
        });
        console.log(arr.join(","));
        ars = arr.join(",");
        if (this.chuangci != "") {
          x = this.chuangci.join(",");
        }
      } else {
        ars = this.selectedValue;
      }

      this.DiyCommon.Post(
        erp_Api + "/Ebu/MES_Wages_",
        {
          Date_b: Date_b,
          Date_e: Date_e,
          IsBedNumber: x,
          StyleCode: ars,
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
          console.log(self.tableData);
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
      let arr = [];
      let ars;
      if (this.options4.length > 0) {
        this.options4.forEach((item, index) => {
          arr.push(item.HuopinDHs);
        });
        console.log(arr.join(","));
        ars = arr.join(",");
        if (this.chuangci != "") {
          x = this.chuangci.join(",");
        }
      } else {
        ars = this.selectedValue;
      }
      this.DiyCommon.Post(
        erp_Api + "/Ebu/MES_Wages_",
        {
          Color: self.yanse,
          Size: self.chima,
          IsSize: 1,
          IsColor: 1,
          CylinderNumber: self.ganghao,
          StyleCode: ars,
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
      //   console.log(`每页 ${val} 条`);
      this.pageSize = val;
      this.list5();
    },
    handleCurrentChange(val) {
      //   console.log(`当前页: ${val}`);
      this.currentPage = val;
      this.list5();
    },
    updateItems() {
      const start = (this.currentPage - 1) * this.pageSize; // 计算当前页开始的索引
      const end = start + this.pageSize; // 计算当前页结束的索引
      this.tableData = this.allData.slice(start, end);
      this.totalCount = this.allData.length;
      console.log(this.tableData);
      console.log(this.totalCount);
    },
    //姓名获取
    list() {
      var self = this;
      this.DiyCommon.Post(
        BaseUrl + "/api/FormEngine/GetTableData",
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
    //查询明细
    list5() {
      var self = this;

      this.DiyCommon.Post(
        BaseUrl + "/api/ApiEngine/Run",
        {
          ApiEngineKey: "diaoguahuizong",
          OsClient: osClient,
          _PageIndex: this.currentPage,
          _PageSize: this.pageSize
        },
        function (res) {
          // self.allData = res.Data

          self.totalCount = res.DataCount;
          // self.updateItems();
          console.log(self.totalCount);
          console.log(res);
          if (res && res.Data && Array.isArray(res.Data) && res.Data !== null) {
            self.tableData = res.Data.map((item) => ({
              xianhao: item.VHR_HRD_Line,
              kuanshiBH: item.VHR_ST_ID,
              kuanshiPM: item.VHR_ST_Collection,
              yuangongGH: item.VHR_HRD_EM_Key,
              yuangongXM: item.VHR_EM_LCD_Name,
              shangcaiS: item.VHR_HM_Garments_Per_Hanger,
              gongxuBH: item.VHR_HRD_OC_Key,
              gongxuMS: item.VHR_OC_Description
            }));
            console.log(self.tableData);
          } else {
            self.tableData = [];
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
      console.log(this.options4);
      let arr = [];
      this.options4.forEach((item, index) => {
        arr.push(item.HuopinDHs);
      });
      console.log(arr.join(","));
      console.log(this.options3);
      let ars;
      if (arr.length > 0) {
        ars = arr.join(",");
        console.log(ars);
      } else {
        ars = this.selectedValue;
        console.log(ars);
      }

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
          StyleCode: ars,
          UserCode: parts[0],
          UserName: parts[1],
          Processes: self.processes,
          End_Processes: self.End_processes,
          Date_b: Date_b,
          Date_e: Date_e,
          _PageIndex: self.currentPage,
          _PageSize: self.pageSize,

          IsBedNumber: x,
          OsClient: osClient
        },
        function (res) {
          self.totalCount = res.dataCount;
          console.log(res);
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
          console.log(res);
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
  margin: 10px 0 10px 10px;
}

.search-input {
  display: flex;
  font-size: 15px;
  align-items: center;
  margin-left: 10px;
}

.search-input2 {
  display: flex;
  font-size: 15px;
  align-items: center;
  margin-left: 20px;
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
.watch {
  width: 50px;
  background-color: #409eff;
  color: #f5f7fa;
  font-size: 13px;
  // padding: 0 5px 0;
}
.custom-table ::v-deep .el-table__header th {
  height: 38px !important; /* 设置表头高度 */
  line-height: 38px !important; /* 确保表头内容垂直居中 */
}
</style>
