<template>
  <!-- <div>签单情况报表</div> -->
  <div class="yejiBOM">
    <div class="diy-table pluginPage" style="padding: 0px">
      <div style="
          display: flex;
          flex-wrap: wrap;
          padding: 10px;
          align-items: center;
        ">
        <div style="width: 150px; margin-right: 15px"
          class="el-input el-input--mini el-input-group el-input-group--prepend el-input--suffix">
          <div class="el-input-group__prepend" style="color: black">
            <i class="el-icon-search"></i>
            签单人姓名
          </div>
          <el-input placeholder="请输入签单人姓名" v-model="UserName" clearable style="width: 250px"></el-input>
        </div>
        <!--  -->
        <div style="display: flex; margin-right: 15px">
          <div class="el-input-group__prepend" style="color: black; width: 80px; padding-top: 3px">
            <i class="el-icon-search"></i>
            时间
          </div>

          <el-date-picker v-model="Time" type="daterange" align="right" unlink-panels range-separator="至"
            start-placeholder="开始日期" end-placeholder="结束日期" :picker-options="pickerOptions">
          </el-date-picker>

          <!-- <div
            style="width: 150px; margin-right: 15px"
            class="el-input el-input--mini el-input-group el-input-group--prepend el-input--suffix"
          >

            <div class="el-input-group__prepend" style="color: black">
              <i class="el-icon-search"></i>
              开始时间
            </div>
            <div class="block">
              <el-date-picker
                v-model="Date_B"
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
                v-model="Date_E"
                type="date"
                placeholder="选择日期">
              </el-date-picker>
            </div>
          </div> -->
        </div>
        <div style="width: 150px; margin-right: 15px"
          class="el-input el-input--mini el-input-group el-input-group--prepend el-input--suffix">
          <div class="el-input-group__prepend" style="color: black">
            <i class="el-icon-search"></i>
            收款情况
          </div>
          <div class="block">
            <el-select v-model="status" clearable placeholder="请选择" style="width: 150px">
              <el-option v-for="item in shoukuanList" :key="item.value" :label="item.label" :value="item.value">
              </el-option>
            </el-select>
          </div>
        </div>
        <!--  -->
        <div>
          <el-button type="primary" @click="search"><span>搜索</span></el-button>

          <el-button @click="exportToExcel">
            <i class="el-icon-download"></i>
            <span>导出</span>
          </el-button>
        </div>
      </div>
      <div class="qiandanTable">
        <el-table highlight-current-row :data="tableData.slice(
            (currentPage - 1) * pagesize,
            currentPage * pagesize
          )
            " stripe border height="655" max-height="700" fit :header-row-style="{
            color: '#333',
            fontWeight: 300,
            fontSize: '14px',
            height: '38px',
            padding: 0
          }" show-summary :summary-method="getSummaries" sum-text="总计" width="100%">
          <el-table-column type="index" width="50" label="编号" class="el-table__row" fixed="left"></el-table-column>
          <el-table-column v-for="(item, index) in items" :key="index" :label="item.label" :prop="item.prop"
            :width="item.width"></el-table-column>
          <el-table-column v-for="(item, index) in items_gdl" :key="index" :label="item.label" :prop="item.prop"
            :width="item.width" fixed="left">
          </el-table-column>
        </el-table>
      </div>
      <!-- 分页 -->
      <div class="el-pagination is-background" style="display: flex; align-items: center; padding: 10px">
        <el-pagination @size-change="handleSizeChange" @current-change="handleCurrentChange"
          :current-page="currentPage4" :page-sizes="[15, 30, 60, 100]" :page-size="15"
          layout="total, sizes, prev, pager, next, jumper" :total="total">
        </el-pagination>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'
import { downloadXlsx } from '/src/utils/xlsx.js'

export default {
  mounted() {
    this.getDeptCode()

    // 等待2秒钟
    setTimeout(() => {
      // 调用 fetchData
      this.fetchData()
    }, 500)
  },
  data() {
    return {
      pickerOptions: {
        shortcuts: [
          {
            text: '最近一周',
            onClick(picker) {
              const end = new Date()
              const start = new Date()
              start.setTime(start.getTime() - 3600 * 1000 * 24 * 7)
              picker.$emit('pick', [start, end])
            }
          },
          {
            text: '最近一个月',
            onClick(picker) {
              const end = new Date()
              const start = new Date()
              start.setTime(start.getTime() - 3600 * 1000 * 24 * 30)
              picker.$emit('pick', [start, end])
            }
          },
          {
            text: '最近三个月',
            onClick(picker) {
              const end = new Date()
              const start = new Date()
              start.setTime(start.getTime() - 3600 * 1000 * 24 * 90)
              picker.$emit('pick', [start, end])
            }
          }
        ]
      },
      userTableData: [], // 用户列表
      currentPage: 1, // 初始页
      pagesize: 15, // 初始每页的数据
      tableData: [],
      kehuMC: '',

      xiaoshouRY: '',
      UserName: '',
      Time: '',
      Date_B: '',
      Date_E: '',
      type: '',
      response: [],
      shoukuanList: [
        {
          value: '通过',
          label: '已收款'
        },
        {
          value: '未通过',
          label: '未收款'
        },
        {
          value: '',
          label: '所有'
        }
      ],
      type2: '',
      DeptCode: '',
      DeptcodeList: [],
      DeptJKSJ: [],
      items: [
        { prop: 'bumen', label: '部门', width: '100' },
        { prop: 'fuwuLX', label: '服务类型', width: '140' },
        { prop: 'fuwuNR', label: '服务内容', width: '180' },
        { prop: 'kaishiSJ', label: '开始时间', width: '120' },
        { prop: 'jieshuSJ', label: '结束时间', width: '120' },
        // { prop: 'yeji', label: '业绩', width: '120' },
        // { prop: 'shoukuanJE', label: '收款金额', width: '120' },
        // { prop: 'chengben', label: '成本', width: '120' },
        // { prop: 'tuikuanJE', label: '退款', width: '120' },
        { prop: 'shoukuanSJ', label: '收款时间', width: '180' },
        { prop: 'isFapiao', label: '是否开票', width: '100' },
        { prop: 'waiqinRY', label: '外勤人员', width: '200' },
        { prop: 'waiqinHS', label: '外勤核算', width: '100' },
        { prop: 'jizhangKJ', label: '记账会计', width: '100' },
        { prop: 'chengjiaoR', label: '成交人', width: '100' }
      ],
      items_gdl: [
        { prop: 'kehuMC', label: '客户名称', width: '180' },
        { prop: 'xiaoshou', label: '销售', width: '70' }
      ],
      total: 0
    }
  },
  methods: {
    async fetchData() {
      try {
        this.response = await axios.get(
          'https://e-erp-qrcode.microi.net/ReportForms/PerformanceDetails?OsClient=lejie',
          {
            params: {
              OsClient: 'lejie',
              UserName: '',
              Date_B: '',
              Date_E: '',
              Type: '外勤',
              DeptCode: this.type2
            }
          }
        )
        // 处理接口返回的数据
      } catch (error) {
        console.error(error)
        // 处理错误
      }
      // console.log('11' + JSON.stringify(this.response));
      console.log(this.response.data.value)
      this.total = this.response.data.value.length
      this.tableData = this.response.data.value
    },
    async search() {
      this.Date_B = ''
      this.Date_E = ''
      if (this.Time) {
        this.Date_B = this.Time[0]
        this.Date_E = this.Time[1]
      }

      if (this.DeptCode == '') {
        this.type2 = this.DeptJKSJ.Data2[0].Code
      } else {
        this.type2 = this.DeptCode
      }
      try {
        this.response = await axios.get(
          'https://e-erp-qrcode.microi.net/ReportForms/PerformanceDetails',
          {
            params: {
              OsClient: 'lejie',
              UserName: this.UserName,
              Date_B: this.Date_B,
              Date_E: this.Date_E,
              Type: '外勤',
              status: this.status,
              DeptCode: this.type2
            }
          }
        )
        // 处理接口返回的数据
      } catch (error) {
        console.error(error)
        // 处理错误
      }
      // console.log('11' + JSON.stringify(this.response));
      console.log(this.response.data.value)
      this.total = this.response.data.value.length
      this.tableData = this.response.data.value
    },
    handleSizeChange: function (size) {
      this.pagesize = size
      console.log(this.pagesize) //每页下拉显示数据
    },
    handleCurrentChange: function (currentPage) {
      this.currentPage = currentPage
      console.log(this.currentPage) //点击第几页
    },
    async getDeptCode() {
      //该接口已弃用**********************************
      var self = this
      await self.DiyCommon.Post(
        'https://api-china.itdos.com/api/ApiEngine/Run',
        {
          ApiEngineKey: 'huoquBMJGXX'
        },
        function (res) {
          if (res.Code == 1) {
            var list = res.Data
            self.DeptJKSJ = res
            if (list.Code == 1) {
              for (var i = 0; i < list.Data.length; i++) {
                self.DeptcodeList.push({
                  value: list.Data[i].Code,
                  label: list.Data[i].Name
                })
              }
            }
            // self.DeptcodeList.push({
            //   value:res.Data2[0].Code,
            //   label:''
            // })
            self.type2 = res.Data2[0].Code
          } else {
          }
        }
      )
    },
    //导出按钮
    exportToExcel() {
      console.log('点击了导出按钮！')
      let datalist = [] //导出表格表头
      datalist.push([
        '客户名称',
        '销售',
        '部门',
        '服务类型',
        '服务内容',
        '开始时间',
        '结束时间',
        '业绩',
        '收款金额',
        '成本',
        '退款',
        '收款时间',
        '外勤人员',
        '记账会计',
        '成交人'
      ])
      this.tableData.map((item) => {
        datalist.push([
          item.kehuMC,
          item.xiaoshou,
          item.bumen,
          item.fuwuLX,
          item.fuwuNR,
          item.kaishiSJ,
          item.jieshuSJ,
          item.yeji,
          item.shoukuanJE,
          item.chengben,
          item.tuikuanJE,
          item.shoukuanSJ,
          item.waiqinRY,
          item.jizhangKJ,
          item.chengjiaoR
        ])
      })
      if (datalist.length > 0) {
        downloadXlsx(datalist, '生产进度表.xlsx')
      }
    } //导出按钮结束
  }
}
</script>

<style lang="scss" scoped>
.el-main {
  line-height: 38px;
}

.body {
  height: 100vh;
  height: 100%;
}

.yejiBOM {
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

::v-deep .yejiBOM .el-table td.el-table__cell>.cell {
  padding: 6px;
  white-space: nowrap;
  text-align: center;
  font-weight: 500;
  color: #090404;
  font-size: 14px;
}
</style>
