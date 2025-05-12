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
        height="70vh"
      >
        <template v-slot:footer>
          <el-table-column label="合计" align="center">
            {{ shuliang }}
          </el-table-column>
        </template>
        <el-table-column
          label="款号"
          prop="styleCode"
          align="center"
          width="100"
        >
        </el-table-column>
        <el-table-column label="款名" prop="styleName" align="center">
        </el-table-column>
        <el-table-column
          prop="gongxuMC"
          label="工序名称"
          align="center"
          sortable
          width="150"
        ></el-table-column>
        <el-table-column
          prop="gongxuSL"
          label="产量"
          sortable
          align="center"
        ></el-table-column>
        <el-table-column label="完成进度">
          <template slot-scope="scope">
            <el-progress
              :text-inside="true"
              :stroke-width="22"
              :percentage="gongxuJD[scope.$index]"
              :color="customColors"
            ></el-progress>
          </template>
        </el-table-column>
        <!-- <el-table-column
          prop="Ruku"
          label="入库"
          align="center"
          sortable
          width="150"
        ></el-table-column>
        <el-table-column
          prop="Chuku"
          label="出库"
          align="center"
          sortable
          width="150"
        ></el-table-column>
        <el-table-column
          prop="Kucun"
          label="库存"
          align="center"
          sortable
          width="150"
        ></el-table-column> -->
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
      gongxuJD: [],
      Ruku: "",
      Chuku: "",
      kucun: "",
      shuliang: 0,
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
        "https://e-erp-qrcode.microi.net/Ebu/MES_ScheduleCustomized",
        // "https://localhost:44337/Ebu/MES_ScheduleCustomized",
        {
          // Date_b: self.Date_b,
          // Date_e: self.Date_e,
          StyleCode: self.kuanhao,
          OsClient: osClient
          // Status: 2,
          // BedNum: self.chuangci,
          // CylinderNumber: self.ganghao,
          // Size: self.chima,
          // Color: self.yanse,
          // Process: self.gongxuMC, //工序
          // IsSize: 1,
          // IsColor: 1
        },
        function (res) {
          console.log("res.data");
          console.log(res.data);
          res.data.forEach((e) => {
            self.shuliang += e.gongxuSL;
            if (e.gongxuMC == "裁剪") {
              self.gongxuJD.push(100);
            } else if (
              e.gongxuZB != null &&
              e.gongxuZB != "" &&
              e.gongxuZB != NaN
            ) {
              let percentageString = e.gongxuZB; // 假设获取的百分比字符串是 "1.13%"
              let percentage = parseFloat(percentageString);
              self.gongxuJD.push(percentage);
              console.log(self.gongxuJD);
            } else if (e.gongxuZB == null || e.gongxuZB == NaN) {
              self.gongxuJD.push(0);
            }
          });
          // let lastThreeItems = res.data.slice(-3)
          // self.Ruku = lastThreeItems[0]
          // self.Chuku = lastThreeItems[1]
          // self.kucun = lastThreeItems[2]
          // self.tableData = res.data.slice(0, -3);
          self.tableData = res.data;
        }
      );
    },
    // calculatePercentage(row) {
    //    if (row.gongxuMC != "裁剪") {
    //      var value = Math.abs(row.xiugaiSL / row.chanliang) * 100;
    //    } else {
    //        return (value = 0);
    //      return Number(value.toFixed(0));
    //    }
    // },
    //calculatePercentage (gongxuJD) {
    //  this.tableData.forEach (e => {
    //    if (e.gongxuZB == '裁剪') {
    //      gongxuJD = 100
    //      return gongxuJD
    //    } else {
    //      //console.log(e.gongxuZB)
    //      let gongxuJD = parseFloat(e.gongxuZB) / 100;
    //      return gongxuJD
    //    }
    //  })
    //},
    objectSpanMethod({ row, column, rowIndex, columnIndex }) {
      // console.log(row.kuanhao);
      // console.log(column);
      // console.log(rowIndex);
      //console.log(columnIndex);
      if (columnIndex === 1 || columnIndex == 0) {
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
