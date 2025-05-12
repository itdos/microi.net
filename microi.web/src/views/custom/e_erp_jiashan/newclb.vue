<template>
  <div style="margin: 0px 20px" class="newclb">
    <div style="display: flex; flex-wrap: wrap">
      <div style="display: flex; margin: 0 20px 10px 0">
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
          "
        >
          <i class="el-icon-search"></i>
          款号
        </div>
        <el-select
          v-model="kuanhao"
          clearable
          placeholder="请选择款号"
          style="width: 120px"
        >
          <el-option
            v-for="item in options"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          >
          </el-option>
        </el-select>
      </div>
      <!-- 床次 -->
      <div style="display: flex; margin: 0 20px 10px 0">
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
          "
        >
          <i class="el-icon-search"></i>
          床次
        </div>
        <el-input
          placeholder="请输入床次"
          v-model="chuangci"
          clearable
          style="width: 120px"
        >
        </el-input>
      </div>
      <!-- 缸号 -->
      <div style="display: flex; margin: 0 20px 10px 0">
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
          "
        >
          <i class="el-icon-search"></i>
          缸号
        </div>
        <el-input
          placeholder="请输入缸号"
          v-model="ganghao"
          clearable
          style="width: 120px"
        >
        </el-input>
      </div>
      <!-- 尺码 -->
      <div style="display: flex; margin: 0 20px 10px 0">
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
          "
        >
          <i class="el-icon-search"></i>
          尺码
        </div>
        <el-input
          placeholder="请输入尺码"
          v-model="chima"
          clearable
          style="width: 120px"
        >
        </el-input>
      </div>
      <!-- 颜色 -->
      <div style="display: flex; margin: 0 20px 10px 0">
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
          "
        >
          <i class="el-icon-search"></i>
          颜色
        </div>
        <el-input
          placeholder="请输入颜色"
          v-model="yanse"
          clearable
          style="width: 120px"
        >
        </el-input>
      </div>

      <!-- 工序名称 -->
      <div style="display: flex; margin: 0 20px 10px 0">
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
          "
        >
          <i class="el-icon-search"></i>
          工序
        </div>
        <el-select
          v-model="gongxuMC"
          clearable
          placeholder="请选择工序"
          style="width: 120px"
        >
          <el-option
            v-for="item in gongxuOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          >
          </el-option>
        </el-select>
      </div>
      <!-- 起始时间 -->
      <div style="display: flex; margin: 0 20px 10px 0">
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
          "
        >
          起始时间
        </div>
        <el-date-picker
          v-model="Date_b"
          type="date"
          placeholder="选择起始日期"
          style="width: 120px"
        >
        </el-date-picker>
      </div>
      <!-- 结束时间 -->
      <div style="display: flex; margin: 0 20px 10px 0">
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
          "
        >
          结束时间
        </div>
        <el-date-picker
          v-model="Date_e"
          type="date"
          placeholder="选择结束日期"
          style="width: 120px"
        >
        </el-date-picker>
      </div>
      <!-- 是否显示颜色 -->
      <div style="display: flex; margin: 0 20px 10px 0">
        <div class="el-tag el-tag--info el-tag--medium el-tag--light">
          显示颜色
        </div>
        <el-checkbox
          v-model="showColor"
          @change="changeColor"
          size="mini"
          border
          >显示颜色</el-checkbox
        >
      </div>
      <!-- 是否显示尺码 -->
      <div style="display: flex; margin: 0 20px 10px 0">
        <div class="el-tag el-tag--info el-tag--medium el-tag--light">
          显示尺码
        </div>
        <div>
          <el-checkbox
            v-model="showChima"
            @change="changeChima"
            size="mini"
            border
            >显示尺码</el-checkbox
          >
        </div>
      </div>
      <!-- 按钮 -->
      <div style="display: flex; margin: 0 20px 20px 0">
        <el-button type="primary" @click="search">搜索</el-button>
      </div>
    </div>

    <div style="height: 80vh; position: relative">
      <el-table
        highlight-current-row
        stripe
        :data="tableData"
        :span-method="objectSpanMethod"
        border
        style="width: 100%; margin-top: 20px"
        sum-text="合计"
        show-summary
        :summary-method="getSummaries"
        height="70vh"
      >
        <el-table-column prop="time" label="日期" width="100">
        </el-table-column>
        <!-- <el-table-column label="裁床单号">
        <template slot-scope="scope">
          <span v-if="scope.row.rowSpan" :rowspan="scope.row.rowSpan">{{
            scope.row.name
          }}</span>
        </template>
      </el-table-column> -->
        <el-table-column label="款号" prop="kuanhao" align="center" width="100">
          <!-- <template slot-scope="scope">
          <span v-if="scope.row.rowSpan" :rowspan="scope.row.rowSpan">{{
            scope.row.amount1
          }}</span>
        </template> -->
        </el-table-column>
        <el-table-column label="款名" prop="kuanming" align="center">
          <!-- <template slot-scope="scope">
          <span v-if="scope.row.rowSpan" :rowspan="scope.row.rowSpan">{{
            scope.row.amount2
          }}</span>
        </template> -->
        </el-table-column>
        <el-table-column
          label="缸号"
          prop="ganghao"
          width="80"
        ></el-table-column>
        <el-table-column
          label="床次"
          prop="chuangci"
          width="80"
        ></el-table-column>
        <!-- <el-table-column label="颜色">
        <template slot-scope="scope">
          <span v-if="scope.row.rowSpan" :rowspan="scope.row.rowSpan">{{
            scope.row.amount3
          }}</span>
        </template>
      </el-table-column>
      <el-table-column label="尺码">
        <template slot-scope="scope">
          <span v-if="scope.row.rowSpan" :rowspan="scope.row.rowSpan">{{
            scope.row.amount3
          }}</span>
        </template>
      </el-table-column> -->
        <el-table-column
          prop="gongxu"
          label="工序名称"
          align="center"
          width="150"
        ></el-table-column>
        <!-- <el-table-column prop="amount1" label="裁剪数"></el-table-column> -->
        <el-table-column
          prop="chanliang"
          label="产量"
          sortable
          align="center"
        ></el-table-column>
        <el-table-column
          v-if="showChima"
          prop="chima"
          label="尺码"
          sortable
          align="center"
        ></el-table-column>
        <el-table-column
          v-if="showColor"
          prop="yanse"
          label="颜色"
          sortable
          align="center"
        ></el-table-column>
        <el-table-column
          prop="xiugaiSL"
          label="完成数"
          sortable
          align="center"
          width="90"
        ></el-table-column>
        <el-table-column label="未完成数" align="center" width="100">
          <template slot-scope="scope">
            {{ Math.abs(scope.row.chanliang - scope.row.xiugaiSL) }}
          </template>
        </el-table-column>
        <el-table-column label="损耗数量" align="center">
          <template slot-scope="scope">
            {{ Math.abs(scope.row.chanliang - scope.row.xiugaiSL) }}
          </template>
        </el-table-column>
        <el-table-column label="完成进度">
          <template slot-scope="scope">
            <!-- {{ calculatePercentage(scope.row) }} -->
            <el-progress
              :text-inside="true"
              :stroke-width="22"
              :percentage="
                calculatePercentage(scope.row) > 100
                  ? 100
                  : calculatePercentage(scope.row)
              "
              :color="customColors"
            ></el-progress>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script>
var reg190317 = new RegExp("(^|&)" + "OsClient" + "=([^&]*)(&|$)");
var r190317 = window.location.search.substr(1).match(reg190317);
var osClient = r190317 != null ? r190317[2] : "";
export default {
  mounted() {
    // this.list();
    this.getItemNum();
  },
  data() {
    return {
      createDate: "",
      Date_e: "",
      Date_b: "",
      gongxuOptions: [], //工序下拉
      showColor: true,
      showChima: true,
      gongxuMC: "",
      chima: "",
      yanse: "",
      ganghao: "",
      chuangci: "",
      tableData: [], //表格内容
      kuanhao: "",
      options: [], //下拉内容
      customColors: [
        { color: "#F56C6C", percentage: 20 },
        { color: "#409EFF", percentage: 40 },
        { color: "#409EFF", percentage: 60 },
        { color: "#67C23A", percentage: 80 },
        { color: "#67C23A", percentage: 100 }
      ]
    };
  },
  watch: {
    kuanhao(newValue, oldValue) {
      var self = this;
      this.DiyCommon.Post(
        "https://api-e-erp.microi.net/api/ApiEngine/Run",
        {
          ApiEngineKey: "ProcessGet",
          HuopinDH: self.kuanhao
        },
        function (res) {
          if (res && res !== null) {
            self.gongxuOptions = res;
          } else {
            self.gongxuOptions = [];
          }
        }
      );
      self.gongxuMC = ""; // 重置的值
    }
  },
  methods: {
    changeColor(value) {
      this.showColor = value;
    },
    changeChima(value) {
      //console.log(this.showChima);
      // value = 1 ? (this.showColor = 1) : (this.showColor = 0);
      this.showChima = value;
    },
    search() {
      if (this.kuanhao == "") {
        this.$message.error("请选择款号");
      } else {
        this.list();
      }
    },
    getSummaries(param) {
      const { columns, data } = param;
      const sums = [];
      columns.forEach((column, index) => {
        if (index === 0) {
          sums.push("合计");
          return;
        }
        // console.log(data);
        // console.log(columns);

        if (
          column.property === "chanliang" ||
          column.property === "xiugaiSL" ||
          column.label === "未完成数" ||
          column.label === "损耗数量"
        ) {
          const values = data.map((item) => {
            if (column.property) {
              return parseFloat(item[column.property]);
            } else {
              return Math.abs(item.chanliang - item.xiugaiSL);
            }
          });
          const sum = values.reduce((prev, curr) => prev + curr, 0);
          sums.push(sum);
        } else {
          sums.push("");
        }
      });
      return sums;
    },
    calculatePercentage(row) {
      if (Math.abs(row.xiugaiSL) != 0 || Math.abs(row.chanliang) != 0) {
        var value = Math.abs(row.xiugaiSL / row.chanliang) * 100;
      } else {
        return (value = 0);
      }

      return Number(value.toFixed(0));
    },
    getItemNum() {
      var self = this;
      this.DiyCommon.Post(
        "https://api-e-erp.microi.net/api/FormEngine/getTableData-diy-kuanshixinxi",
        {
          ModuleEngineKey: "Diy_kuanshixinxi"
        },
        function (res) {
          self.options = res.Data;
          self.options = res.Data.map((item) => ({
            value: item.HuopinDH,
            label: `${item.HuopinDH} ${item.HuopinMC}`
          }));
        }
      );
    },
    list() {
      var self = this;
      this.DiyCommon.Post(
        "https://e-erp-qrcode.microi.net/Ebu/MES_Schedule",
        {
          Date_b: self.Date_b,
          Date_e: self.Date_e,
          StyleCode: self.kuanhao,
          OsClient: osClient,
          Status: 2,
          BedNum: self.chuangci,
          CylinderNumber: self.ganghao,
          Size: self.chima,
          Color: self.yanse,
          Process: self.gongxuMC, //工序
          IsSize: 1,
          IsColor: 1
          // _PageIndex: 15, //每页数量
          // _PageSize: 100, //显示页数
        },
        function (res) {
          self.createDate = res.dataAppend;
          // console.log(res.data);
          self.tableData = res.data;
          var formattedDateString = self.createDate.substring(0, 10);
          self.tableData = self.tableData.map((obj) => {
            return { ...obj, time: formattedDateString };
          });

          //console.log(self.tableData);
          // console.log("777" + self.GongxuMC);
          // self.totalCount = res.dataCount;
          // self.tableData = res.data.map((item) => ({
          //   styleCode: item.styleCode,
          //   styleName: item.styleName,
          //   caichuangdan: item.caichuangdan,
          //   ganghao: item.ganghao,
          //   countList: item.countList,
          // }));
        }
      );
    },
    objectSpanMethod({ row, column, rowIndex, columnIndex }) {
      // console.log(row.kuanhao);
      // console.log(column);
      // console.log(rowIndex);
      //console.log(columnIndex);
      if (columnIndex === 1 || columnIndex == 2 || columnIndex == 0) {
        // 判断当前列是否为"款号"列
        if (
          rowIndex > 0 &&
          row.kuanhao === this.tableData[rowIndex - 1].kuanhao
        ) {
          // 判断当前行的款号与上一行的款号是否相同
          return {
            rowspan: 0,
            colspan: 1
          };
        } else {
          let rowspan = 1;
          for (let i = rowIndex + 1; i < this.tableData.length; i++) {
            if (row[column.prop] === this.tableData[i][column.prop]) {
              rowspan++;
            } else {
              break;
            }
          }
          return {
            rowspan: rowspan,
            colspan: 1
          };
        }
      }
    }
  }
};
</script>

<style>
/* .el-input {
  width: 150px;
} */
.el-input-group__prepend {
  color: #333;
}
.body {
  /* visibility: hidden; */

  /* 显示滚动条 */
}
::v-deep .el-table__header th {
  color: #333;
  font-size: 24px;
  /* text-align: center; */
  padding: 0;
}
.newclb .el-table th.el-table__cell > .cell {
  white-space: nowrap;
  text-align: center;
  font-weight: 500;
  font-size: 16px;
  color: #333;
}
.newclb .el-table td.el-table__cell > .cell {
  padding: 6px;
  white-space: nowrap;
  text-align: center;
  font-weight: 500;
  color: #090404;
  font-size: 14px;
}
.newclb .el-table__footer-wrapper {
  position: absolute;
  bottom: 0;
}
/* .process-row {
  display: flex;
  flex-direction: column;

  gap: 0.5rem;
}

.process-cell {
  padding: 0.5rem;
  border: 1px solid #ccc;
} */
</style>
