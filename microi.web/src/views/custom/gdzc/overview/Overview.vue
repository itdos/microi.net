<template>
  <div class="content">
    <div class="header">{{ $getCurrentUser.TenantName }}</div>
    <!-- <div
      class="to-home"
      @click="$router.push({ path: '/zongxungz/projectHome' })"
    > 
      返回 
    </div> -->
    <div class="overview">

      <Panel>
        <template slot="inner">
          <div style="height: 100%" flex="main:justify dir:top">
            <div class="title">资产状态</div>
            <chart
              ref="chart1"
              :options="returnPie(union.chartData)"
              style="
                width: 100%;
                height: 250px;
                display: block;
                margin-bottom: 40px;
              "
            ></chart>
            <div class="title" flex="main:justify">
              <span>资产报废以及预报废</span>
            </div>
            <div class="count-wrapper nowrap" style="padding: 0 8px 20px">
              <span class="square-bg data-change">
                <img
                  src="~@/assets/images/overview/icon_data.png"
                  alt=""
                  style="margin: 10px 0"
                /><br />
                <span>数据总量</span><br />
                <span class="num">{{ dataExchange.dataAll }}</span
                ><span></span>
              </span>
              <span
                class="square-bg data-change"
                style="
                  text-align: center;
                  width: 228px;
                  display: flex;
                  flex-wrap: wrap;
                "
                flex
              >
                <span style="width: 104px">
                  <span class="num">{{ dataExchange.getJiJData }}</span
                  ><span></span><br />
                  <span>即将报废</span><br />
                  <!-- <span style="line-height: 40px">正确率</span
                  ><span style="color: #00ccff; line-height: 40px"
                    >&nbsp;{{ dataExchange.getInCorrect }}</span
                  ><br /> -->
                </span>
                <span style="width: 104px">
                  <span class="num">{{ dataExchange.getYuData }}</span
                  ><span></span><br />
                  <span>预报废</span><br />
                  <!-- <span style="line-height: 40px">正确率</span
                  ><span style="color: #00ccff; line-height: 40px"
                    >&nbsp;{{ dataExchange.getOutCorrect }}</span
                  ><br /> -->
                </span>
                <span style="width: 104px">
                  <span class="num">{{ dataExchange.getKeData }}</span
                  ><span></span><br />
                  <span>可报废</span><br />
                </span>
                <span style="width: 104px">
                  <span class="num">{{ dataExchange.getYiData }}</span
                  ><span></span><br />
                  <span>已报废</span><br />
                </span>
              </span>
              <!-- <span
                class="square-bg data-change mt-1"
                style="padding-top: 12px"
              >
                <span>已对接部门数</span><br />
                <span class="num">{{
                  dataExchange.dockedNormal + dataExchange.dockedAbnormal
                }}</span
                ><span>（个）</span>
              </span>
              <span class="square-bg data-change mt-1">
                <span style="padding-bottom: 0; padding-top: 0">
                  <span>任务</span><br />
                  <span style="line-height: 40px">正常任务</span>&nbsp;<span
                    class="num"
                    >{{ dataExchange.dockedNormal }}</span
                  >&nbsp;<span style="line-height: 40px">异常</span>&nbsp;<span
                    class="num"
                    >{{ dataExchange.dockedAbnormal }}</span
                  >
                </span>
              </span> -->
            </div>
            <div style="margin: 10px 0">
              <el-date-picker
                v-model="yearData"
                type="year"
                placeholder="选择年"
                value-format="yyyy"
              >
              </el-date-picker>
              <el-button
                type="primary"
                style="margin-left: 10px"
                @click="getBaoFeiData"
                >搜索</el-button
              >
            </div>
            <chart
              ref="chart2"
              :options="returnBar(dataExchange.chartData)"
              style="
                width: 100%;
                height: 320px;
                display: block;
                margin-top: 10px;
              "
            ></chart>
          </div>
        </template>
      </Panel>
      <Panel
        style="padding-left: 0; padding-right: 0; display: block"
        flex="main:justify dir:top"
      >
        <template slot="outer">
          <div
            class="inner"
            style="overflow: hidden; min-width: 730px; height: 62%"
          >
            <div class="total-count">
              <span>资产总量</span>
              <span
                v-for="(item, index) in total"
                :key="index"
                class="total-num"
                :class="'num' + item"
              ></span>
              <span style="padding-left: 20px">条</span>
            </div>
            <div class="cube">
              <div class="inner-float"></div>
              <div class="cir-box">
                <div class="cir1">
                  <img src="~@/assets/images/overview/yuan01.png" alt="" />
                </div>
                <div class="cir2">
                  <img src="~@/assets/images/overview/yuan02.png" alt="" />
                </div>
                <div class="cir"></div>
              </div>
            </div>
            <div class="rotate">
              <div class="rotate-inner">
                <div
                  v-for="(item, index) in rotateData"
                  :key="index"
                  :class="['inner-item', `ball${index}`]"
                >
                  <!-- 
                  :style="`animation:animX 2s linear 0s infinite alternate,animY 2s linear -1s infinite alternate`" -->
                  <!-- animation: animX 11s cubic-bezier(0.36, 0, 0.64, 1) ${-5.5-index*2.1}s infinite alternate,animY 11s cubic-bezier(0.36, 0, 0.64, 1) ${-index*2.1}s infinite alternate; -->
                  <div class="inner-title">
                    <p>
                      <span>{{ item.name }}</span>
                    </p>
                    <p>
                      <span class="num"> {{ item.value }}</span
                      ><span>(条)</span>
                    </p>
                  </div>
                  <div class="inner-img">
                    <img src="~@/assets/images/overview/data.png" alt="" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
        <template slot="inner">
          <div style="height: 38%">
            <div class="title">部门资产状态</div>
            <div
              class="red-black-wrapper"
              style="
                display: flex;
                padding: 20px 0;
                min-width: 700px;
                overflow-x: auto;
                min-height: 330px;
              "
            >
              <el-carousel
                indicator-position="none"
                :interval="5000"
                arrow="hover"
                loop
              >
                <el-carousel-item
                  v-for="(item, index) in deptList"
                  :key="index"
                >
                  <div class="container1">
                    <div class="red-list">
                      <img
                        src="~@/assets/images/overview/icon_hong.png"
                        alt=""
                      />
                      <span class="white-font">{{ item.name }}</span>
                      <span class="num">{{ item.counts }}</span>
                      <span class="white-font">（个）</span>
                    </div>
                    <div class="msg-list">
                      <div
                        class="msg-list-item"
                        flex="main:center"
                        v-for="(t, i) in item.typeValue"
                        :key="i"
                      >
                        <img
                          class="rb-icon"
                          src="~@/assets/images/overview/icon_hgrz.png"
                          alt=""
                        />
                        <span>
                          <p class="white-font">{{ t.ZichanZT }}</p>
                          <p>
                            <span class="num">{{ t.counts }}</span
                            ><span class="white-font">（个）</span>
                          </p>
                        </span>
                      </div>
                    </div>
                  </div>
                </el-carousel-item>
              </el-carousel>
            </div>
          </div>
        </template>
      </Panel>
      <Panel>
        <template slot="inner">
          <div style="height: 100%" flex="main:justify dir:top">
            <div class="title">资产分类</div>
            <!-- <div class="count-wrapper">
              <div class="count-item square-bg">
                <span class="white-font" style="line-height: 40px"
                  >办公家具</span
                ><br />
                <span class="num">{{ collection.lv1 }}</span
                ><span>个</span>
              </div>
              <div class="count-item square-bg">
                <span class="white-font" style="line-height: 40px"
                  >办公设备</span
                ><br />
                <span class="num">{{ collection.lv2 }}</span
                ><span>个</span>
              </div>
              <div class="count-item square-bg">
                <span
                  class="white-font"
                  style="line-height: 40px; margin-right: 6px"
                  >资源数</span
                >
                <span class="num">{{ collection.resourceCount }}</span
                ><span>条</span>
              </div>
              <div class="count-item square-bg">
                <span
                  class="white-font"
                  style="line-height: 40px; margin-right: 6px"
                  >部门数</span
                >
                <span class="num">{{ collection.deptCount }}</span
                ><span>个</span>
              </div>
            </div> -->
            <chart
              ref="chart2"
              :options="returnCollection(collection.chartData)"
              style="width: 100%; height: 280px; display: block; margin: 20px 0"
            ></chart>
            <div class="title" style="margin-top: 10px" flex="main:justify">
              <span>资产处理金额统计</span>
              <!-- <span class="handle-btn" flex>
              <span class="btn" :class="handleBtnTab2 === 0 ? 'active' : ''" @click="changeReportDataMonth">本月</span>
              <span class="btn" :class="handleBtnTab2 === 1 ? 'active' : ''" @click="changeReportDataYear">本年</span> -->
              <!-- <b-date-picker type="daterange"
                             :open="dateOpen2"
                             :value="date2"
                             confirm
                             @on-change="handleChange2"
                             @on-clear="handleClear2"
                             @on-ok="handleOk2"
                             placeholder="Select date">
                <a style="display: block;width: 76px;"
                   href="javascript:void(0)"
                   @click="handleClick('dateOpen2')"> -->
              <!--<template v-if="date2 === ''">选择日期</template>
                  <template v-else>{{ date2 }}</template>-->
              <!-- <template>选择日期</template>
                </a>
              </b-date-picker> -->
              <!-- </span> -->
            </div>
            <div style="margin: 10px 0">
              <el-date-picker
                v-model="chuLiJEYear"
                type="year"
                placeholder="选择年"
                value-format="yyyy"
              >
              </el-date-picker>
              <el-button
                type="primary"
                style="margin-left: 10px"
                @click="getZiChanCLJE"
                >搜索</el-button
              >
            </div>
            <chart
              ref="chart2"
              :options="returnArea(report.chartData)"
              style="width: 100%; height: 220px; display: block; margin: 20px 0"
            ></chart>
            <div class="title">资产处理数据</div>
            <div style="margin: 10px 0">
              <el-date-picker
                v-model="chuLiYear"
                type="year"
                placeholder="选择年"
                value-format="yyyy"
              >
              </el-date-picker>
              <el-button
                type="primary"
                style="margin-left: 10px"
                @click="getZiChanCL"
                >搜索</el-button
              >
            </div>
            <div
              class="dept-list"
              style="
                margin: 20px 0 10px 0;
                overflow: auto;
                height: 240px;
                width: 360px;
              "
            >
              <div style="display: flex; justify-content: space-between">
                <span style="width: 32%; overflow: hidden; text-align: left"
                  >单据号码</span
                >
                <span style="width: 13%; overflow: hidden; text-align: left"
                  >类型</span
                >
                <span style="width: 12%; overflow: hidden; text-align: left"
                  >日期</span
                >
                <span style="width: 11%; overflow: hidden; text-align: left"
                  >数量</span
                >
                <span style="width: 12%; overflow: hidden; text-align: left"
                  >金额</span
                >
                <span style="width: 20%; overflow: hidden; text-align: left"
                  >单据状态</span
                >
              </div>
              <div
                style="display: flex; justify-content: space-between"
                v-for="(item, index) in submission"
                :key="index"
              >
                <span style="width: 32%; overflow: hidden; text-align: left">{{
                  item.DanjuBM
                }}</span>
                <span style="width: 13%; overflow: hidden; text-align: left">{{
                  item.ChuLiLX
                }}</span>
                <span style="width: 12%; overflow: hidden; text-align: left">{{
                  item.ChuliRQ
                }}</span>
                <span style="width: 11%; overflow: hidden; text-align: left">{{
                  item.ChuliSL
                }}</span>
                <span style="width: 12%; overflow: hidden; text-align: left">{{
                  item.ChuliJE
                }}</span>
                <span style="width: 20%; overflow: hidden; text-align: left">{{
                  item.DanjuZT
                }}</span>
              </div>
            </div>
          </div>
        </template>
      </Panel>
    </div>
  </div>
</template>

<script>
import { mapState } from "vuex";
import echarts from "echarts";
import Panel from "../../../components/Panel/Panel";
// 统一变量
const xyLineColor = "#535e83";
const splitLineColor = "#283353";
export default {
  name: "Overview",
  data() {
    return {
      color: [
        "#1167e2",
        "#4dcea7",
        "#fc9530",
        "#ff3b3c",
        "#563cff",
        "#0fbce0",
        "#0c31e2",
      ],
      // chart
      handleBtnTab1: 0,
      handleBtnTab2: 0,
      date1: "",
      date2: "",
      dateOpen1: false,
      dateOpen2: false,

      yearData: "",
      union: {
        memoCount: 0,
        measureCount: 0,
        deptCount: 0,
        chartData: {
          inner: [
            // { value: 1000, name: '已使用' },
            // { value: 2000, name: '未使用' }
          ],
          outer: [
            // { value: 400, name: '使用中' },
            // { value: 680, name: '借用中' },
            // { value: 1400, name: '闲置中' },
          ],
        },
      }, // 联合奖惩
      dataExchange: {
        dataAll: 0,
        getJiJData: 0,
        getYuData: 0,
        getKeData: 0,
        getYiData: 0,
        getInCorrect: "0%",
        getOutCorrect: "0%",
        dockedAbnormal: 0,
        dockedNormal: 0,
        chartData: {},
        // [
        // ['product', '报废', '已报废'],
        // ['1月', 100, 100],
        // ['2月', 83.1, 73.4],
        // ['3月', 86.4, 65.2],
        // ['4月', 72.4, 53.9],
        // ['5月', 72.4, 53.9],
        // ['6月', 72.4, 53.9],
        // ['7月', 72.4, 53.9],
        // ['8月', 72.4, 53.9],
        // ['9月', 72.4, 53.9],
        // ['10月', 72.4, 53.9],
        // ['11月', 72.4, 53.9],
        // ['12月', 72.4, 53.9]
        // ]
      },
      total: [],
      rotateData: [
        // { name: '街道办事处', value: 0 },
        // { name: '杭州文化馆', value: 0 },
        // { name: '浙江综讯数码产品有限公司', value: 0 },
        // { name: '白杨社区卫生中心', value: 0 },
      ],
      deptList: {}, // 部门
      collection: {
        resourceCount: 0,
        deptCount: 0,
        chartData: [],
      }, // 资产分类

      chuLiYear: "",
      chuLiJEYear: "",
      report: {
        chartData: [
          // ["product", "数量"],
          // ["1月", 1006],
          // ["2月", 1006],
          // ["3月", 1007],
          // ["4月", 1002],
          // ["5月", 1010],
          // ["6月", 1007],
          // ["7月", 1008],
          // ["8月", 1010],
          // ["9月", 1006],
          // ["10月", 1011],
          // ["11月", 1006],
          // ["12月", 1003],
        ],
      },
      submission: [],

      timer: null,
    };
  },
  components: {
    Panel,
  },
  created() {
    // 初始化页面数据
    // this.$store.dispatch("getOverview").then(() => {
    //   this.numChange(this.$store.state.overview.total);
    // });
  },
  mounted() {
    console.log(this.$getCurrentUser, 111111111);

    this.yearData = this.$moment(new Date()).format("yyyy");
    this.chuLiYear = this.$moment(new Date()).format("yyyy");
    this.chuLiJEYear = this.$moment(new Date()).format("yyyy");
    this.handleInit();

    this.timer = setInterval(() => {
      this.handleInit();
    }, 60 * 1000);

    
    console.log(this.DiyCommon,'DiyCommon')
    console.log(this.DiyApi,'DiyApi')
  },
  computed: {},
  watch: {},
  methods: {
    handleInit() {
      this.getHomeData();
      this.getBaoFeiData();
      this.getZiChanCL();
      this.getZiChanCLJE();
    },
    async getHomeData() {
      let res = await this.DiyCommon.DataSourceEngine.Run({
        DataSourceKey: "shuju_daping",
        TenantId: this.$getCurrentUser.TenantId,
      });
      if (res.Code == 1) {
        res.Data.map((item) => {
          if (item.type == "zichanzt") {
            this.union.chartData.outer = item.AllCount.map((i) => {
              return {
                name: i.ZichanZT,
                value: i.shuliang,
              };
            });
            let AllCount = 0;
            item.AllCount.map((i) => {
              AllCount += i.shuliang;
            });
            this.union.chartData.inner = [
              { name: "资产总数", value: AllCount },
            ];

            // console.log(this.union.chartData);
          } else if (item.type == "zichanbf") {
            this.dataExchange.getJiJData = item.AllCount[0].jjbf;
            this.dataExchange.getYuData = item.AllCount[0].ybf;
            this.dataExchange.getKeData = item.AllCount[0].kbf;
            this.dataExchange.getYiData = item.AllCount[0].yibf;
            this.dataExchange.dataAll =
              this.dataExchange.getJiJData +
              this.dataExchange.getYuData +
              this.dataExchange.getKeData +
              this.dataExchange.getYiData;
          } else if (item.type == "monthZichanBF") {
          } else if (item.type == "zichanfl") {
            this.collection.chartData = item.AllCount.map((item) => {
              return [item.FenleiMC, item.counts];
            });
          } else if (item.type == "zichancl") {
          } // 资产处理
          else if (item.type == "monthZichanCLJE") {
          } //处理金额
          else if (item.type == "dept") {
            this.rotateData = item.AllCount.map((i) => {
              return {
                name: i.Name,
                value: i.counts,
              };
            });
          } //部门
          else if (item.type == "zichangl") {
            this.total = item.AllCount.toString().padStart(9,'0');
          } //资产总量
          else if (item.type == "deptZichanZT") {
            this.deptList = item.AllCount;
          }
        });
      }
    },
    async getBaoFeiData() {
      let res = await this.DiyCommon.DataSourceEngine.Run({
        DataSourceKey: "year_zichanbf",
        TenantId: this.$getCurrentUser.TenantId, //'9a5fe12e-034c-43d4-890b-a3684041d13f',//
        year: this.yearData,
      });
      if (res.Code == 1) {
        // console.log(res.Data);
        let xAxisData = [];
        let jiJList = [],
          yuList = [],
          keList = [],
          yiList = [];
        res.Data.map((item) => {
          xAxisData.push(item.months);
          jiJList.push(item.jjbf);
          yuList.push(item.ybf);
          keList.push(item.kbf);
          yiList.push(item.yibf);
        });
        let yAxisData = [
          {
            name: "即将报废",
            type: "line",
            data: jiJList,
          },
          {
            name: "预报废",
            type: "line",
            data: yuList,
          },
          {
            name: "可报废",
            type: "line",
            data: keList,
          },
          {
            name: "已报废",
            type: "line",
            data: yiList,
          },
        ];

        this.dataExchange.chartData = {
          xAxisData,
          yAxisData,
        };
      }
    },
    async getZiChanCLJE() {
      let res = await this.DiyCommon.DataSourceEngine.Run({
        DataSourceKey: "year_zichanclje",
        TenantId: this.$getCurrentUser.TenantId, //'9a5fe12e-034c-43d4-890b-a3684041d13f',//
        year: this.chuLiJEYear,
      });
      if (res.Code == 1) {
        this.report.chartData = res.Data.map((item) => {
          return [item.months, item.ChuliJE];
        });
      }
    },
    async getZiChanCL() {
      let res = await this.DiyCommon.DataSourceEngine.Run({
        DataSourceKey: "year_zichancl",
        TenantId: this.$getCurrentUser.TenantId, //'9a5fe12e-034c-43d4-890b-a3684041d13f',//
        year: this.chuLiYear,
      });
      if (res.Code == 1) {
        this.submission = res.Data;
      }
    },
    getKeysTotal(data) {
      const keyList = Object.keys(data);
      let sum = keyList.reduce((total, item) => {
        return total + data[item];
      }, 0);
      return sum;
    },
    reSum(arr, key) {
      let copy = [];
      arr.forEach((item, index) => {
        if (index > 0) {
          copy.push(item[key]);
        }
      });
      let sum = (total, value) => total + value;
      return copy.reduce(sum, 0);
    },
    handleClick(param) {
      this[param] = !this[param];
    },
    handleChange1(date) {
      this.date1 = date;
    },
    handleChange2(date) {
      this.date2 = date;
    },
    handleClear1() {
      this.dateOpen1 = false;
    },
    handleOk1() {
      this.dateOpen1 = false;
      this.handleBtnTab1 = 2;
      // this.$store.dispatch('getOverviewDataExchange',this.date1)
    },
    handleClear2() {
      this.dateOpen2 = false;
    },
    handleOk2() {
      this.dateOpen2 = false;
      this.handleBtnTab2 = 2;
      // this.$store.dispatch("getOverviewReport", this.date2);
    },
    // 渲染pie图
    returnPie(data) {
      return {
        color: ["#34aec5", "#4065f1", "#fc9530", "#f93b3b"],
        tooltip: {
          trigger: "item",
          formatter: "{a} <br/>{b}: {c} ({d}%)",
        },
        series: [
          {
            name: "",
            type: "pie",
            selectedMode: "single",
            radius: [0, "40%"],
            label: {
              position: "center",
              formatter: "{b}:{c}",
              color: "#fff",
            },
            labelLine: {
              show: false,
            },
            /* data: [
                { value: 1000, name: '惩戒' },
                { value: 2000, name: '激励' }
              ] */
            data: data.inner,
          },
          {
            name: "",
            type: "pie",
            selectedMode: "single",
            radius: ["50%", "65%"],
            labelLine: {
              length: 5,
            },
            label: {
              formatter: "{a|{a}}\n{b|{b}}\n{c} ({d}%)",
              borderWidth: 1,
              borderRadius: 4,
              rich: {
                a: {
                  color: "#fff",
                  lineHeight: 22,
                  align: "center",
                },
                hr: {
                  borderColor: "#aaa",
                  width: "100%",
                  borderWidth: 0.5,
                  height: 0,
                },
                b: {
                  fontSize: 14,
                  lineHeight: 18,
                },
                per: {
                  color: "#eee",
                  backgroundColor: "#334455",
                  padding: [2, 4],
                  borderRadius: 2,
                },
              },
            },
            data: data.outer,
          },
        ],
      };
    },
    returnBar(data) {
      return {
        // grid: {
        //   top: 30,
        //   left: 50,
        //   right: 10,
        // },
        // legend: {
        //   bottom: "2%",
        //   textStyle: { color: "#fff" },
        // },
        // tooltip: {},
        // dataset: {
        //   // dimensions: ['product', 'collection', 'output'],
        //   source: data,
        // },
        // xAxis: {
        //   type: "category",
        //   axisLine: { lineStyle: { color: xyLineColor } },
        //   boundaryGap: ["20%", "20%"],
        // },
        // yAxis: {
        //   boundaryGap: ["20%", "20%"],
        //   axisLine: { lineStyle: { color: xyLineColor } },
        //   splitLine: { lineStyle: { color: splitLineColor } },
        //   name: "（条）",
        //   nameGap: 10,
        // },
        // series: [
        //   {
        //     type: "bar",
        //     barWidth: 8,
        //     barGap: 0,
        //     itemStyle: {
        //       color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        //         { offset: 0, color: "#00befc" },
        //         { offset: 1, color: "#00befc33" },
        //       ]),
        //     },
        //   },
        //   {
        //     type: "bar",
        //     barWidth: 8,
        //     itemStyle: {
        //       color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        //         { offset: 0, color: "#294bd5" },
        //         { offset: 1, color: "#294bd533" },
        //       ]),
        //     },
        //   },
        // ],
        tooltip: {
          trigger: "axis",
        },
        legend: {
          icon: "circle",
          show: true,
          bottom: "2%",
          textStyle: { color: "#535E83" },
        },
        grid: {
          top: 30,
          left: 30,
          right: 45,
          // containLabel: true
        },
        color: ["#FAC958", "#91CD76", "#73C0DF", "#EF6667"],
        xAxis: {
          type: "category",
          boundaryGap: false,
          data: data.xAxisData,
          axisLine: {
            lineStyle: { color: xyLineColor },
          },
          name: "（月）",
        },
        yAxis: {
          type: "value",
          axisLine: { lineStyle: { color: xyLineColor } },
          splitLine: { lineStyle: { color: splitLineColor } },
          name: "（件）",
        },
        series: data.yAxisData,
      };
    },
    returnCollection(data) {
      return {
        color: "#00abfb",
        tooltip: {
          trigger: "axis",
          axisPointer: {
            // 坐标轴指示器，坐标轴触发有效
            type: "shadow", // 默认为直线，可选为：'line' | 'shadow'
          },
        },
        grid: {
          left: "2%",
          right: "10%",
          bottom: 0,
          top: "12%",
          containLabel: true,
        },
        dataset: {
          source: data,
        },
        xAxis: {
          type: "value",
          boundaryGap: [0, 0.01],
          axisLine: {
            lineStyle: {
              color: xyLineColor,
            },
          },
          splitLine: { lineStyle: { color: splitLineColor } },
          name: "（件）",
          nameGap: 8,
        },
        yAxis: {
          type: "category",
          axisLine: {
            lineStyle: {
              color: xyLineColor,
            },
          },
        },
        series: [
          {
            type: "bar",
            barWidth: 10,
            itemStyle: {
              barBorderRadius: 8,
            },
          },
        ],
      };
    },
    returnArea(data) {
      return {
        dataset: {
          source: data,
        },
        tooltip: {
          trigger: "axis",
        },
        grid: {
          left: "3%",
          right: "13%",
          bottom: "3%",
          top: "15%",
          containLabel: true,
        },
        xAxis: {
          type: "category",
          boundaryGap: false,
          axisLine: {
            lineStyle: { color: xyLineColor },
          },
          name: "（月）",
        },
        yAxis: {
          type: "value",
          axisLine: { lineStyle: { color: xyLineColor } },
          splitLine: { lineStyle: { color: splitLineColor } },
          max: function (value) {
            return value.min - 1;
          },
          min: function (value) {
            return value.max + 1;
          },
          name: "（元）",
          nameGap: 10,
        },
        series: [
          {
            type: "line",
            itemStyle: {
              color: "rgba(2,203,255,1)",
            },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                {
                  offset: 0,
                  color: "rgba(2,203,255,0.8)",
                },
                {
                  offset: 1,
                  color: "rgba(2,203,255,0.2)",
                },
              ]),
            },
          },
        ],
      };
    },
    numChange(num) {
      let copy = JSON.parse(JSON.stringify(num));
      let change = setInterval(() => {
        let arr = [];
        num.forEach(() => {
          arr.push(parseInt(Math.random() * 10));
        });
        num.splice(0, 8);
        num.push(...arr);
      }, 20);
      setTimeout(() => {
        window.clearInterval(change);
        this.$store.state.overview.total = copy;
      }, 1000);
    },
    changeReportDataMonth() {
      this.handleBtnTab2 = 0;
      this.date2 = "";
      // this.$store.dispatch("getOverviewReport", "thisMonth");
    },
    changeReportDataYear() {
      this.handleBtnTab2 = 1;
      this.date2 = "";
      // this.$store.dispatch("getOverviewReport", "thisYear");
    },
    changeExchangeDataMonth() {
      this.handleBtnTab1 = 0;
      this.date1 = "";
      // this.$store.dispatch('getOverviewDataExchange','thisMonth')
    },
    changeExchangeDataYear() {
      this.handleBtnTab1 = 1;
      this.date1 = "";
      // this.$store.dispatch('getOverviewDataExchange','thisYear')
    },
  },
  destroyed() {
    clearInterval(this.timer);
  },
};
</script>

<style lang="stylus" scoped>
::v-deep .el-popper {
  background: #050819 !important;
  border: 1px solid #123E7C;
  color: #fff;
}

::v-deep .el-input--medium .el-input__inner {
  color: #fff;
}

::v-deep .el-input--medium .el-input__inner {
  background: #05091D;
  border: 1px solid #123E7C;
}

$p = 156;
$itemW = 110;
$itemH = 110;
$rotateW = 4 * $p;
$rotateH = 3.46 * $p;

[flex~='content:around'] {
  -webkit-box-pack: justify;
  -webkit-justify-content: space-around;
  -ms-flex-pack: justify;
  justify-content: space-around;
}

.white-font {
  color: #fff;
}

.content {
  min-width: 1625px;
  width: 100vw;
  height: 100vh;
  background: #050819;
  overflow: auto;
  overflow-x: scroll;
  box-sizing: border-box;
  1;
  position: relative;

  .header {
    background-image: url('~@/assets/images/top.png');
    height: 80px;
    width: 100%;
    background-repeat: no-repeat;
    background-size: auto 100%;
    background-position: center top;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #1d7acd;
    font-weight: bold;
    font-size: 35px;
    letter-spacing: 4px;
    position: relative;
  }
}

.to-home {
  position: absolute;
  top: 46px;
  right: 40px;
  bottom: 0;
  background-color: #0d1b4d;
  padding: 4px 20px;
  -webkit-border-radius: 18px;
  -moz-border-radius: 18px;
  border-radius: 18px;
  cursor: pointer;
  color: #fff;
  height: 30px;
}

.overview {
  display: flex;
  background: #050819;
  width: 100%;
  height: 1120px;
  box-sizing: border-box;
  padding: 20px 0;
  background-image: url('~@/assets/images/overview/ge.png');
  background-repeat: no-repeat;
  background-position: center 30%;

  .dept-list {
    color: #fff;

    .list-header {
      font-weight: 700;
    }

    div {
      height: 28px;
      line-height: 28px;

      &:nth-child(odd) {
        background-color: #001739;
      }

      &:nth-child(even) {
        background-color: #061029;
      }

      span {
        text-align: center;
      }
    }
  }

  .title {
    font-weight: 700;
    color: #ffffff;
    font-size: 18px;
    line-height: 32px;
    background-image: url('~@/assets/images/summary/t_bg.png');
    background-repeat: no-repeat;
    background-position: left bottom;
    -webkit-background-size: 100% 20px;
    background-size: 100% 20px;
    height: 36px;
    margin-top: 6px;
    margin-bottom: 10px;
  }

  > div {
    &:nth-child(1) {
      width: 450px;
    }

    &:nth-child(2) {
      width: calc(100% - 900px);
    }

    &:nth-child(3) {
      width: 450px;
    }
  }

  .count-wrapper {
    display: flex;
    justify-content: space-between;
    width: 100%;
    margin: 20px 0;

    .square-bg {
      width: 115px;

      .num {
        color: #02cbff;
        font-weight: 400;
        font-size: 22px;
      }
    }

    .count-item {
      width: 23%;
      padding-bottom: 8px;
      text-align: center;
      color: #fff;
    }

    .count-title {
      color: #ffffff;
      line-height: 20px;
      font-size: 14px;
    }

    span {
      padding: 7px;
      display: inline-block;

      .iconfont {
        color: $fontColor;
        font-weight: 700;
        font-size: 32px;
      }
    }

    .data-change {
      color: #fff;
      text-align: center;
      line-height: 18px;
      width: 120px;
      padding: 40px 0;

      &:nth-child(2) {
        span {
          padding-right: 0;
        }
      }

      &:nth-child(even) {
        text-align: left;
        width: 228px;
        padding-top: 28px;
        padding-left: 10px;
      }
    }
  }

  .nowrap {
    flex-wrap: wrap;
  }

  .inner {
    position: relative;
    width: $rotateW px;
    height: 678px;
    margin: 0 auto;

    .total-count {
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 800px;
      text-align: center;
      font-size: 26px;
      font-weight: 700;
      color: #fff;
      letter-spacing: 8px;

      span {
        display: inline-block;
        vertical-align: middle;
        margin: 4px;

        &:first-of-type {
          padding-right: 20px;
        }

        &.total-num {
          width: 49px;
          height: 55px;
        }

        &.num0 {
          background-image: url('~@/assets/images/overview/0.png');
        }

        &.num1 {
          background-image: url('~@/assets/images/overview/1.png');
        }

        &.num2 {
          background-image: url('~@/assets/images/overview/2.png');
        }

        &.num3 {
          background-image: url('~@/assets/images/overview/3.png');
        }

        &.num4 {
          background-image: url('~@/assets/images/overview/4.png');
        }

        &.num5 {
          background-image: url('~@/assets/images/overview/5.png');
        }

        &.num6 {
          background-image: url('~@/assets/images/overview/6.png');
        }

        &.num7 {
          background-image: url('~@/assets/images/overview/7.png');
        }

        &.num8 {
          background-image: url('~@/assets/images/overview/8.png');
        }

        &.num9 {
          background-image: url('~@/assets/images/overview/9.png');
        }
      }
    }

    .cube {
      display: inline-block;
      width: 100%;
      height: 100%;
      position: relative;
      z-index: 10;

      .inner-float {
        position: absolute;
        width: 100%;
        height: 100%;
        background-image: url('~@/assets/images/overview/cube.png');
        background-repeat: no-repeat;
        background-position: center 256px;
        -webkit-background-size: 160px 160px;
        background-size: 160px 160px;
        z-index: 20;
        animation: infinite shineCube 4s linear;
      }

      .cir-box {
        width: 100%;
        height: 100%;
        position: absolute;
        z-index: 10;
      }

      .cir {
        position: absolute;
        width: 500px;
        height: 500px;
        top: calc(50% + 100px);
        left: 50%;
        animation: shine infinite linear 6s;

        &::before {
          position: absolute;
          top: 0;
          left: 0;
          content: '';
          width: 110%;
          height: 110%;
          display: block;
          transform: translate(-50%, -50%) rotateX(60deg);
          border: 1px dashed $fontColor;
          -webkit-border-radius: 50%;
          -moz-border-radius: 50%;
          border-radius: 50%;
        }

        &::after {
          content: '';
          width: 130%;
          height: 130%;
          display: block;
          transform: translate(-50%, -50%) rotateX(60deg);
          border: 1px solid $fontColor;
          -webkit-border-radius: 50%;
          -moz-border-radius: 50%;
          border-radius: 50%;
        }
      }

      .cir1 {
        position: absolute;
        top: calc(50% + 100px);
        left: 50%;
        animation: shine infinite linear 6s;

        img {
          width: 450px;
          height: auto;
          transform: translate(-50%, -50%) rotateX(60deg);
        }

        &::before {
          content: '';
          width: 160%;
          height: 160%;
          border: 2px solid rgba(15, 100, 230, 0.5);
          display: block;
          position: absolute;
          top: 0;
          transform: translate(-50%, -50%) rotateX(60deg);
          -webkit-border-radius: 50%;
          -moz-border-radius: 50%;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(20, 140, 250, 0.4);
        }

        &::after {
          content: '';
          width: 130%;
          height: 130%;
          top: 0;
          border: 2px dashed rgba(15, 100, 230, 0.8);
          display: block;
          position: absolute;
          transform: translate(-50%, -50%) rotateX(60deg);
          -webkit-border-radius: 50%;
          -moz-border-radius: 50%;
          border-radius: 50%;
        }
      }

      .cir2 {
        position: absolute;
        top: calc(50% + 100px);
        left: 50%;
        animation: shine infinite linear 6s;

        // animation-delay 3s
        img {
          width: 300px;
          height: auto;
          transform: translate(-50%, -50%) rotateX(60deg);
        }
      }
    }
  }

  .red-black-wrapper {
    .el-carousel--horizontal {
      width: 100%;
    }

    .container1 {
      width: 100%;

      .num {
        color: #02cbff;
        font-weight: 400;
        font-size: 22px;
      }

      .red-list {
        padding-bottom: 10px;
        text-align: center;
        background-image: url('~@/assets/images/overview/tuopan.png');
        background-repeat: no-repeat;
        background-position: bottom center;

        img, span {
          vertical-align: middle;
          padding: 10px;
        }
      }

      .msg-list {
        display: flex;
        padding-top: 20px;
        flex-wrap: wrap;
        width: 100%;
        height: 270px;
        overflow: auto;
        padding-bottom: 20px;

        .msg-list-item {
          display: flex;
          // width: 50%;
          margin-top: 15px;

          .rb-icon {
            margin-right: 10px;
            width: 52px;
            height: 52px;
          }

          span {
            width: 112px;
          }
        }
      }

      .msg-list::-webkit-scrollbar {
        width: 4px;
        height: 6px;
      }

      .msg-list::-webkit-scrollbar-thumb {
        border-radius: 5px;
        -webkit-box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.2);
        background-color: rgba(0, 0, 0, 0.2);
      }

      .msg-list::-webkit-scrollbar-track { /* 滚动条里面轨道（背景） */
        -webkit-box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.2);
        border-radius: 0;
        background-color: rgba(0, 0, 0, 0.1);
      }
    }
  }
}

.red-black-wrapper::-webkit-scrollbar {
  width: 4px;
  height: 6px;
}

.red-black-wrapper::-webkit-scrollbar-thumb {
  border-radius: 5px;
  -webkit-box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.2);
  background-color: rgba(0, 0, 0, 0.2);
}

.red-black-wrapper::-webkit-scrollbar-track { /* 滚动条里面轨道（背景） */
  -webkit-box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.2);
  border-radius: 0;
  background-color: rgba(0, 0, 0, 0.1);
}

.rotate {
  position: absolute;
  margin: 0 auto;
  height: 400px;
  z-index: 20;
  top: 30%;
  left: 40px;
  width: 667px;
  border-radius: 60%;

  // transform-style: preserve-3d;
  // transform rotateX(-10deg)
  // background-color: #fff
  // animation: rotate3d linear 30s infinite;
  &:hover {
    animation-play-state: paused;
    -webkit-animation-play-state: paused;

    .rotate-inner {
      .inner-item {
        animation-play-state: paused;
        -webkit-animation-play-state: paused;
      }
    }
  }

  .rotate-inner {
    position: relative;
    width: 100%;
    height: 100%;
    color: #fff;
    border-radius: 60%;

    .inner-item {
      // animation: rotate3dOpposite linear infinite 30s;
      // transform-style preserve-3d
      // transform perspective(1000)
      width: 170 px;
      // height: $itemH px;
      text-align: center;
      position: absolute;

      .inner-title {
        wdith: 100% !important;
        text-align: center;
        margin-top: -45px;
        height: 50px;
        margin-left: -30px;

        p {
          height: 5px;
        }
      }

      // }
      .inner-img {
        position: absolute;
        left: 0;
        top: 0;
        width: 120px;
        height: 105px;
        text-align: center;
        // transform: translateX(-50%) rotateX(10deg) scaleY(2);
        background-image: url('~@/assets/images/overview/pan.png');
        background-position: center bottom;
        -webkit-background-size: contain;
        background-size: contain;
        background-repeat: no-repeat;
      }
    }

    .ball0 {
      animation: animX 9s cubic-bezier(0.36, 0, 0.64, 1) -4.5s infinite alternate, animY 9s cubic-bezier(0.36, 0, 0.64, 1) 0s infinite alternate;
    }

    .ball1 {
      animation: animX 9s cubic-bezier(0.36, 0, 0.64, 1) -8.5s infinite alternate, animY 9s cubic-bezier(0.36, 0, 0.64, 1) -4s infinite alternate;
    }

    .ball2 {
      animation: animX 9s cubic-bezier(0.36, 0, 0.64, 1) -12.5s infinite alternate, animY 9s cubic-bezier(0.36, 0, 0.64, 1) -8s infinite alternate;
    }

    .ball3 {
      animation: animX 9s cubic-bezier(0.36, 0, 0.64, 1) -16.5s infinite alternate, animY 9s cubic-bezier(0.36, 0, 0.64, 1) -12s infinite alternate;
    }

    .ball4 {
      animation: animX 9s cubic-bezier(0.36, 0, 0.64, 1) -20s infinite alternate, animY 9s cubic-bezier(0.36, 0, 0.64, 1) -16s infinite alternate;
    }

    .ball5 {
      animation: animX 9s cubic-bezier(0.36, 0, 0.64, 1) -24.5s infinite alternate, animY 9s cubic-bezier(0.36, 0, 0.64, 1) -20s infinite alternate;
    }

    .ball6 {
      animation: animX 9s cubic-bezier(0.36, 0, 0.64, 1) -28.5s infinite alternate, animY 9s cubic-bezier(0.36, 0, 0.64, 1) -24s infinite alternate;
    }

    .ball7 {
      animation: animX 9s cubic-bezier(0.36, 0, 0.64, 1) -32.5s infinite alternate, animY 9s cubic-bezier(0.36, 0, 0.64, 1) -28s infinite alternate;
    }

    .ball8 {
      animation: animX 9s cubic-bezier(0.36, 0, 0.64, 1) -36.5s infinite alternate, animY 9s cubic-bezier(0.36, 0, 0.64, 1) -32s infinite alternate;
    }

    .ball9 {
      animation: animX 9s cubic-bezier(0.36, 0, 0.64, 1) -39.5s infinite alternate, animY 9s cubic-bezier(0.36, 0, 0.64, 1) -35s infinite alternate;
    }

    .ball10 {
      animation: animX 9s cubic-bezier(0.36, 0, 0.64, 1) -44.5s infinite alternate, animY 9s cubic-bezier(0.36, 0, 0.64, 1) -40s infinite alternate;
    }
  }
}

.square-bg {
  background-color: #01173a;
  padding-bottom: 8px;
}

.chart-msg-bar {
  text-align: center;
  color: #fff;
}

.handle-btn {
  color: #fff;
  font-size: 12px;

  .active {
    background-color: #0d1b4d;
  }

  .btn {
    white-space: nowrap;
    line-height: 32px;
    height: 32px;
    padding: 0 10px;
    margin-right: 4px;
    -webkit-border-radius: 16px;
    -moz-border-radius: 16px;
    border-radius: 16px;
    cursor: pointer;
  }
}

.handle-btn >>> .bin-select-dropdown {
  background-color: #01173a;
}

.handle-btn >>> .bin-date-picker-rel {
  line-height: 32px;
}

@keyframes animX {
  0% {
    left: -20px;
  }

  100% {
    left: 560px;
  }
}

@keyframes animY {
  0% {
    top: -60px;
  }

  100% {
    top: 320px;
  }
}

@keyframes rotate3d {
  0% {
    transform: rotateX(60deg) rotateZ(0);
  }

  100% {
    transform: rotateX(60deg) rotateZ(1turn);
  }
}

@keyframes rotate3dOpposite {
  0% {
    transform: rotateZ(0);
  }

  100% {
    transform: rotateZ(-1turn);
  }
}

@keyframes shine {
  0% {
    opacity: 0;
    transform: scale(0.8);
    transform-origin: 0 0;
  }

  50% {
    opacity: 0.8;
    transform: scale(0.9);
    transform-origin: 0 0;
  }

  100% {
    opacity: 0;
    transform: scale(1);
    transform-origin: 0 0;
  }
}

@keyframes shineCube {
  0% {
    opacity: 1;
  }

  50% {
    opacity: 0.8;
  }

  100% {
    opacity: 1;
  }
}

@keyframes shadowShine {
  0% {
    box-shadow: 0 0 20px $lightShadowColor;
  }

  50% {
    box-shadow: 0 0 2px $lightShadowColor;
  }

  100% {
    box-shadow: 0 0 20px $lightShadowColor;
  }
}
</style>
