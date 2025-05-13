<template>
  <!-- <div>签单情况报表</div> -->
  <div class="qiandanBOM">
    <div class="diy-table pluginPage">
      <div style="display: flex; flex-wrap: wrap; padding: 10px; align-items: center">
        <div style="width: 120px; margin-right: 15px" class="el-input el-input--mini el-input-group el-input-group--prepend el-input--suffix">
          <div class="el-input-group__prepend" style="color: black">
            <i class="el-icon-search"></i>
            姓名
          </div>
          <el-input placeholder="请输入姓名" v-model="Name" clearable style="width: 200px"></el-input>
        </div>
        <!--  -->
        <div style="width: 120px; margin-right: 15px" class="el-input el-input--mini el-input-group el-input-group--prepend el-input--suffix">
          <div class="el-input-group__prepend" style="color: black">
            <i class="el-icon-search"></i>
            部门
          </div>
          <el-input placeholder="请输入部门" v-model="Department" clearable style="width: 200px"></el-input>
        </div>
        <!--  -->
        <div style="display: flex; margin-right: 15px">
          <div style="width: 120px; margin-right: 15px" class="el-input el-input--mini el-input-group el-input-group--prepend el-input--suffix">
            <div class="el-input-group__prepend" style="color: black">
              <i class="el-icon-search"></i>
              月份
            </div>
            <div class="block">
              <el-date-picker value-format="yyyy-MM-dd" v-model="Date_B" type="month" placeholder="选择月"> </el-date-picker>
            </div>
          </div>
          <!--          <div-->
          <!--            style="width: 120px; margin-right: 15px"-->
          <!--            class="el-input el-input&#45;&#45;mini el-input-group el-input-group&#45;&#45;prepend el-input&#45;&#45;suffix"-->
          <!--          >-->
          <!--            <div class="el-input-group__prepend" style="color: black">-->
          <!--              <i class="el-icon-search"></i>-->
          <!--              结束时间-->
          <!--            </div>-->
          <!--            <div class="block">-->
          <!--              <el-date-picker-->
          <!--                v-model="Date_E"-->
          <!--                type="date"-->
          <!--                style="width: 200px"-->
          <!--                placeholder="选择日期">-->
          <!--              </el-date-picker>-->
          <!--            </div>-->
          <!--          </div>-->
        </div>
        <div style="width: 150px; margin-right: 15px" class="el-input el-input--mini el-input-group el-input-group--prepend el-input--suffix">
          <div class="el-input-group__prepend" style="color: black">
            <i class="el-icon-search"></i>
            状态
          </div>
          <div class="block">
            <el-select v-model="Status" clearable placeholder="请选择状态" style="width: 150px">
              <el-option v-for="item in options" :key="item.value" :label="item.label" :value="item.value"> </el-option>
            </el-select>
          </div>
        </div>
        <!--        <div-->
        <!--          style="width: 150px; margin-right: 15px"-->
        <!--          class="el-input el-input&#45;&#45;mini el-input-group el-input-group&#45;&#45;prepend el-input&#45;&#45;suffix"-->
        <!--        >-->
        <!--          <div class="el-input-group__prepend" style="color: black">-->
        <!--            <i class="el-icon-search"></i>-->
        <!--            选择组织机构-->
        <!--          </div>-->
        <!--          <div class="block">-->
        <!--            <el-select v-model="DeptCode" clearable placeholder="请选择" style="width: 150px">-->
        <!--              <el-option-->
        <!--                v-for="item in DeptcodeList"-->
        <!--                :key="item.value"-->
        <!--                :label="item.label"-->
        <!--                :value="item.value">-->
        <!--              </el-option>-->
        <!--            </el-select>-->
        <!--          </div>-->
        <!--        </div>-->
        <div>
          <el-button type="primary" @click="search">查询</el-button>
        </div>
      </div>
      <!-- 分页 -->
      <!--      <div-->
      <!--        class="el-pagination is-background"-->
      <!--        style="display: flex; align-items: center; padding: 10px"-->
      <!--      >-->
      <!--        <el-pagination-->
      <!--          @size-change="handleSizeChange"-->
      <!--          @current-change="handleCurrentChange"-->
      <!--          :current-page="currentPage4"-->
      <!--          :page-sizes="[100, 200, 300, 400]"-->
      <!--          :page-size="100"-->
      <!--          layout="total, sizes, prev, pager, next, jumper"-->
      <!--          :total="total"-->
      <!--        >-->
      <!--        </el-pagination>-->
      <!--      </div>-->
    </div>
  </div>
</template>

<script>
import axios from "axios";

export default {
  mounted() {
    this.getDeptCode();
    //this.getData();
  },
  data() {
    return {
      Name: "",
      Department: "",
      Status: "",
      options: [
        {
          value: "生成",
          label: "生成"
        },
        {
          value: "",
          label: "查询"
        }
      ],
      type2: "",
      DeptCode: "",
      DeptcodeList: [],
      DeptJKSJ: [],
      tableData: [],
      gridData: [],
      kehuMC: "",
      kehuMCSK: "",
      Date_B: "",
      Date_E: "",
      xiaoshouRY: "",
      drawer: false,
      direction: "rtl",
      // items: [
      //   { prop: "lishiSK", label: "历年收款", width: "90" },
      //   { prop: "caishuiGW", label: "财税顾问", width: "100" },
      //   { prop: "bumen", label: "部门", width: "100" },
      //   { prop: "zubie", label: "组别", width: "90" },
      //   { prop: "xiaoshou", label: "销售", width: "90" },
      //   { prop: "shifouZZ", label: "是否在职", width: "90" },
      //   { prop: "xiaoshouZG", label: "销售主管", width: "90" },
      //   { prop: "xiaoshouJL", label: "销售经理", width: "90" },
      //   { prop: "xufeiren", label: "续费人", width: "90" },
      //   { prop: "jine", label: "末次收费", width: "100" },
      //   { prop: "fuwuSC", label: "服务时长", width: "180" },
      //   { prop: "fuwuNR", label: "服务内容", width: "180" },
      //   { prop: "shoufeiSJ", label: "末次收费时间", width: "180" },
      //   { prop: "xinqianYJ", label: "新签业绩", width: "90" },
      //   { prop: "xufeiYJ", label: "续费业绩", width: "90" },
      //   { prop: "yuejunSF", label: "月均收费", width: "90" },
      //   { prop: "zengsongSC", label: "赠送时长", width: "90" },
      //   { prop: "zhuanjieSGS", label: "转介绍公司", width: "180" },
      //   { prop: "nashuiRLX", label: "纳税人类型", width: "100" },
      //   { prop: "lianxiR", label: "联系人", width: "100" },
      //   { prop: "lianxiFS", label: "联系方式", width: "120" },
      //   { prop: "suozaiD", label: "所在地", width: "180" },
      //   { prop: "jutiDZ", label: "具体地址", width: "180" },
      // ],
      // itemsSKMX:[
      //   { prop: "Hetong", label: "公司名称", width: "180" },
      //   { prop: "ShouruLX", label: "收款类型", width: "180" },
      //   { prop: "SuoshuYWY", label: "收款业务员", width: "180" },
      //   { prop: "ZongjinE", label: "总计金额", width: "180" },
      //   { prop: "ShoukuanRQ", label: "收款日期", width: "180" },
      // ],
      // items_gdl:[
      //   { prop: "gongsiMC", label: "公司名称", width: "280" },
      // ],
      total: 0
    };
  },
  methods: {
    async getData() {
      try {
        this.response = await axios.get("https://e-erp-qrcode.microi.net/ReportForms/Wages", {
          params: {
            OsClient: "lejie",
            UserName: "",
            Date_B: "",
            // Date_E:'',
            CustomName: ""
            // DeptCode:this.type2
          }
        });
        // 处理接口返回的数据
      } catch (error) {
        console.error(error);
        // 处理错误
      }
      console.log(this.response.data.value);
      this.total = this.response.data.value.length;
      this.tableData = this.response.data.value;
    },
    async search() {
      if (this.DeptCode == "") {
        this.type2 = this.DeptJKSJ.Data2[0].Code;
      } else {
        this.type2 = this.DeptCode;
      }
      try {
        this.response = await axios.get("https://e-erp-qrcode.microi.net/ReportForms/Wages", {
          params: {
            OsClient: "lejie",
            Name: this.Name,
            Date_B: this.Date_B,
            // Date_E:this.Date_E,
            Status: this.Status,
            Department: this.Department
            // DeptCode:this.type2
          }
        });
        // 处理接口返回的数据
      } catch (error) {
        console.error(error);
        // 处理错误
      }
      // console.log(this.response.data.value)
      this.total = this.response.data.value.length;
      this.tableData = this.response.data.value;
      console.log(this.response);
      if (this.response.data.code == 1) {
        this.$router.push("/gongzibaobiao");
      }
    },
    cebiantanchu(index, res) {
      this.getDataKHHT(res[index].gongsiMC);
      this.drawer = true;
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
