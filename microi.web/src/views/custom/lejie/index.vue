<template>
  <div class="newindex">
    <div class="zhuye">
      <!-- 业绩榜 -->
      <div class="word">业绩榜</div>
      <div>业绩详情</div>
      <!-- 合同新增--表格 -->
      <div class="word">合同新增</div>
      <div>
        <el-table :data="tableData" style="width: 100%">
          <el-table-column prop="date" label="日期" width="180"> </el-table-column>
          <el-table-column prop="name" label="姓名" width="180"> </el-table-column>
          <el-table-column prop="address" label="地址"></el-table-column>
        </el-table>
      </div>
      <!-- 本周工商办理--表格 -->
      <div class="word">本周工商办理</div>
      <div>
        <el-table :data="tableData" style="width: 100%">
          <el-table-column prop="date" label="地区" width="180"> </el-table-column>
          <el-table-column prop="name" label="办理中数量" width="180"> </el-table-column>
          <el-table-column prop="address" label="已逾期数量"></el-table-column>
          <el-table-column prop="address" label="已完结数量"></el-table-column>
          <el-table-column prop="address" label="本周完结数量"></el-table-column>
        </el-table>
      </div>
      <!-- 风险预警 -->
      <div class="word">风险预警</div>
      <div class="fengxian">
        <!-- 风险预警:1F:合同 -->
        <div class="pie">
          <!-- 上方文字 -->
          <div class="title">
            <span class="word">合同</span>
            <div>
              <el-select v-model="value1" placeholder="请选择" style="width: 100px">
                <el-option v-for="item in options" :key="item" :label="item" :value="item"> </el-option>
              </el-select>
            </div>
          </div>
          <div ref="chartContainer1" class="bingtu"></div>
        </div>
        <!-- 风险预警:2F:收款 -->
        <div class="pie">
          <!-- 上方文字 -->
          <div class="title">
            <span class="word">收款</span>
            <div>
              <el-select v-model="value2" placeholder="请选择" style="width: 100px">
                <el-option v-for="item in options" :key="item" :label="item" :value="item"> </el-option>
              </el-select>
            </div>
          </div>
          <div ref="chartContainer2" class="bingtu"></div>
        </div>
        <!-- 风险预警:3F:工商工单 -->
        <div class="pie">
          <!-- 上方文字 -->
          <div class="title">
            <span class="word">工商工单</span>
            <div>
              <el-select v-model="value3" placeholder="请选择" style="width: 100px">
                <el-option v-for="item in options" :key="item" :label="item" :value="item"> </el-option>
              </el-select>
            </div>
          </div>
          <div ref="chartContainer3" class="bingtu"></div>
        </div>
        <!-- 风险预警:4F:代账工单 -->
        <div class="pie">
          <!-- 上方文字 -->
          <div class="title">
            <span class="word">代账工单</span>
            <div>
              <el-select v-model="value4" placeholder="请选择" style="width: 100px">
                <el-option v-for="item in options" :key="item" :label="item" :value="item"> </el-option>
              </el-select>
            </div>
          </div>
          <div ref="chartContainer4" class="bingtu"></div>
        </div>
        <!-- 风险预警:5F:税控服务 -->
        <div class="pie">
          <!-- 上方文字 -->
          <div class="title">
            <span class="word">税控服务</span>
            <div>
              <el-select v-model="value5" placeholder="请选择" style="width: 100px">
                <el-option v-for="item in options" :key="item" :label="item" :value="item"> </el-option>
              </el-select>
            </div>
          </div>
          <div ref="chartContainer5" class="bingtu"></div>
        </div>
      </div>
      <div class="footer">
        <!-- 本周业绩总览 -->
        <div style="width: 29%">
          <div class="word">本月业绩总览</div>
          <div style="background-color: white">签单总金额 14500.00 元 相比上月增幅 104.23% 收款金额 14330.00 元 相比上月增幅 0% 新签合同数量 / 续签合同数量 2 / / 0 （个）</div>
        </div>
        <!-- 签约/收款 对比图 -->
        <div style="width: 69%">
          <div class="word">签约/收款 对比图</div>
          <div ref="chartContainer6" style="width: 100%; height: 300px; background-color: white"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import * as echarts from "echarts";
import "echarts/lib/chart/pie";
import "echarts/lib/component/title";

export default {
  data() {
    return {
      options: ["本月", "本季度", "本年"],
      value1: "本月",
      value2: "本月",
      value3: "本月",
      value4: "本月",
      value5: "本月"
    };
  },
  mounted() {
    this.renderChart();
  },
  methods: {
    //获取本月时间
    getMonthArray() {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;

      const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
      const lastDayOfMonth = new Date(currentYear, currentMonth, 0);

      const monthArray = [];
      for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
        const date = new Date(currentYear, currentMonth - 1, i);
        const formattedDate = formatDate(date);
        monthArray.push(formattedDate);
      }

      return monthArray;
    },
    //获取本年时间
    getYearArray() {
      const currentYear = new Date().getFullYear();

      const firstDayOfYear = new Date(currentYear, 0, 1);
      const lastDayOfYear = new Date(currentYear, 11, 31);

      const yearArray = [];
      for (let i = 0; i < 12; i++) {
        const date = new Date(currentYear, i, 1);
        const formattedDate = formatDate(date);
        yearArray.push(formattedDate);
      }

      return yearArray;
    },
    //获取本季度时间
    getQuarterArray() {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      const firstDayOfQuarter = new Date(currentYear, Math.floor((currentMonth - 1) / 3) * 3, 1);
      const lastDayOfQuarter = new Date(currentYear, Math.floor((currentMonth - 1) / 3 + 1) * 3, 0);

      const quarterArray = [];
      for (let i = firstDayOfQuarter.getMonth(); i <= lastDayOfQuarter.getMonth(); i++) {
        const date = new Date(currentYear, i, 1);
        const formattedDate = formatDate(date);
        quarterArray.push(formattedDate);
      }

      return quarterArray;
    },
    //获取表1合同的到期状态
    getTable1Data() {
      var self = this;
      this.DiyCommon.Post(
        "https://api-china.itdos.com/api/FormEngine/getTableData",
        {
          ModuleEngineKey: "diy_kehuhetong1",
          _Where: [
            {
              Name: "Name",
              Value: self.bumen,
              Type: "="
            }
          ]
        },
        function (res) {
          //console.log(res.Data.ZhaopinGSID);
          self.yingpinDWId = res.Data.ZhaopinGSID;
        }
      );
    },
    renderChart() {
      // 1
      const chartContainer1 = this.$refs.chartContainer1;
      const chart1 = echarts.init(chartContainer1);
      const option1 = {
        color: ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de", "#3ba272", "#fc8452", "#9a60b4", "#ea7ccc"],
        // title: {
        //   text: "总计",
        //   left: "center",
        //   top: "center",
        // },
        tooltip: {
          trigger: "item"
        },
        legend: {
          orient: "vertical",
          right: 10,
          top: 50,
          bottom: 10,
          itemWidth: 8, // 设置图例颜色块的宽度
          itemHeight: 8 // 设置图例颜色块的高度
        },
        series: [
          {
            type: "pie",
            radius: ["40%", "70%"],
            avoidLabelOverlap: false,
            label: {
              show: true
            },
            emphasis: {
              label: {
                show: true,
                fontSize: 25,
                fontWeight: "bold"
              }
            },
            labelLine: {
              show: false
            },
            data: [
              { value: 1048, name: "即将到期" },
              { value: 735, name: "已到期" },
              { value: 580, name: "未转单" },
              { value: 484, name: "未收款" }
            ]
          }
        ]
      };
      chart1.setOption(option1);
      //2
      const chartContainer2 = this.$refs.chartContainer2;
      const chart2 = echarts.init(chartContainer2);
      const option2 = {
        color: ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de", "#3ba272", "#fc8452", "#9a60b4", "#ea7ccc"],
        tooltip: {
          trigger: "item"
        },
        legend: {
          orient: "vertical",
          right: 10,
          top: 50,
          bottom: 10,
          itemWidth: 8, // 设置图例颜色块的宽度
          itemHeight: 8 // 设置图例颜色块的高度
        },
        series: [
          {
            type: "pie",
            radius: ["40%", "70%"],
            avoidLabelOverlap: false,
            label: {
              show: false,
              position: "center"
            },
            emphasis: {
              label: {
                show: true,
                fontSize: 25,
                fontWeight: "bold"
              }
            },
            labelLine: {
              show: false
            },
            data: [
              { value: 1048, name: "预警期" },
              { value: 735, name: "未收款" },
              { value: 580, name: "未到期" }
            ]
          }
        ]
      };
      chart2.setOption(option2);
      // 饼图3
      const chartContainer3 = this.$refs.chartContainer3;
      const chart3 = echarts.init(chartContainer3);
      const option3 = {
        color: ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de", "#3ba272", "#fc8452", "#9a60b4", "#ea7ccc"],
        tooltip: {
          trigger: "item"
        },
        legend: {
          orient: "vertical",
          right: 10,
          top: 50,
          bottom: 10,
          itemWidth: 8, // 设置图例颜色块的宽度
          itemHeight: 8 // 设置图例颜色块的高度
        },
        series: [
          {
            type: "pie",
            radius: ["40%", "70%"],
            avoidLabelOverlap: false,
            label: {
              show: false,
              position: "center"
            },
            emphasis: {
              label: {
                show: true,
                fontSize: 25,
                fontWeight: "bold"
              }
            },
            labelLine: {
              show: false
            },
            data: [
              { value: 1048, name: "未派单" },
              { value: 735, name: "正常进行" },
              { value: 580, name: "进行中预警" },
              { value: 484, name: "进行中延期" },
              { value: 300, name: "按时完成" },
              { value: 300, name: "延期完成" },
              { value: 300, name: "中止" }
            ]
          }
        ]
      };
      chart3.setOption(option3);

      // 饼图4
      const chartContainer4 = this.$refs.chartContainer4;
      const chart4 = echarts.init(chartContainer4);
      const option4 = {
        color: ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de", "#3ba272", "#fc8452", "#9a60b4", "#ea7ccc"],
        tooltip: {
          trigger: "item"
        },
        legend: {
          orient: "vertical",
          right: 10,
          top: 50,
          bottom: 10,
          itemWidth: 8, // 设置图例颜色块的宽度
          itemHeight: 8 // 设置图例颜色块的高度
        },
        series: [
          {
            type: "pie",
            radius: ["40%", "70%"],
            avoidLabelOverlap: false,
            label: {
              show: false,
              position: "center"
            },
            emphasis: {
              label: {
                show: true,
                fontSize: 25,
                fontWeight: "bold"
              }
            },
            labelLine: {
              show: false
            },
            data: [
              { value: 1048, name: "未派单" },
              { value: 735, name: "未开始" },
              { value: 580, name: "正常进行" },
              { value: 484, name: "完成" },
              { value: 300, name: "中止" }
            ]
          }
        ]
      };
      chart4.setOption(option4);

      // 饼图5
      const chartContainer5 = this.$refs.chartContainer5;
      const chart5 = echarts.init(chartContainer5);
      const option5 = {
        color: ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de", "#3ba272", "#fc8452", "#9a60b4", "#ea7ccc"],
        tooltip: {
          trigger: "item"
        },
        legend: {
          orient: "vertical",
          right: 10,
          top: 50,
          bottom: 10,
          itemWidth: 8, // 设置图例颜色块的宽度
          itemHeight: 8 // 设置图例颜色块的高度
        },
        series: [
          {
            type: "pie",
            radius: ["40%", "70%"],
            avoidLabelOverlap: false,
            label: {
              show: false,
              position: "center"
            },
            emphasis: {
              label: {
                show: true,
                fontSize: 25,
                fontWeight: "bold"
              }
            },
            labelLine: {
              show: false
            },
            data: [
              { value: 1048, name: "未派单" },
              { value: 735, name: "正常进行" },
              { value: 580, name: "进行中预警" },
              { value: 484, name: "进行中延期" },
              { value: 300, name: "按时完成" },
              { value: 300, name: "延期完成" },
              { value: 300, name: "中止" }
            ]
          }
        ]
      };
      chart5.setOption(option5);
      //柱状图6
      const chartContainer6 = this.$refs.chartContainer6;
      const chart6 = echarts.init(chartContainer6);
      const option6 = {
        color: ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de", "#3ba272", "#fc8452", "#9a60b4", "#ea7ccc"],
        xAxis: {
          type: "category",
          data: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]
        },
        yAxis: {
          type: "value",
          min: -25000,
          max: 75000,
          interval: 25000
        },
        series: [
          {
            name: "数据1",
            type: "bar",
            data: [10000, 20000, 30000, 40000, 50000, 60000, 70000, 80000, 90000, 100000, 110000, 120000]
          },
          {
            name: "数据2",
            type: "bar",
            data: [-5000, -10000, -15000, -20000, -25000, -30000, -35000, -40000, -45000, -50000, -55000, -60000]
          },
          {
            name: "数据3",
            type: "bar",
            data: [20000, 25000, 30000, 35000, 40000, 45000, 50000, 55000, 60000, 65000, 70000, 75000]
          }
        ]
      };
      chart6.setOption(option6);
    }
  }
};
</script>

<style lang="scss" scoped>
.newindex {
  // background-color: white;
  width: 100%;
}

.zhuye {
  // background-color: white;
  // display: flex;
  // align-items: center;
  // justify-content: space-between;
  width: 100%;
  // flex-wrap: wrap;
  // padding: 10vw;
}
.fengxian {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  flex-wrap: wrap;
}
.pie {
  width: 49%;
  background-color: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 300px;
  padding: 20px;
  height: 400px;
  margin-top: 20px;
  // margin-right:20px ;
}
.bingtu {
  display: flex;
  align-items: center;
  width: 100%;
  height: 300px;
}
.word {
  font-size: 14px;
  font-weight: bold;
  display: inline-block;
  overflow-wrap: break-word;
}
.title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.footer {
  // background-color: white;
  width: 100%;
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
}
</style>
