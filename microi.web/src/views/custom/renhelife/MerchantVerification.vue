<template>
  <div>
    <el-card class="box-card" :body-style="{ padding: '10px' }">
      <div class="hearder">
        <el-row :gutter="20">
          <el-col :sm="8">
            <el-date-picker
              v-model="value"
              type="daterange"
              :picker-options="pickerOptions"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              align="right"
              size="small"
              value-format="yyyy-MM-dd"
            >
            </el-date-picker>
          </el-col>
          <el-col :sm="8">
            <el-input
              v-model="search"
              placeholder="请输入商家编号"
              size="small"
              clearable
            >
              <i class="el-icon-search" slot="prepend"> </i>
            </el-input>
          </el-col>
          <el-col :sm="2">
            <el-button type="primary" @click="handleSearch" size="small"
              >查询</el-button
            >
          </el-col>
        </el-row>
      </div>
      <el-table
        v-loading="loading"
        :data="tableData"
        border
        stripe
        size="medium"
        height="calc(100vh - 218px)"
        style="width: 100%"
      >
        <el-table-column
          v-for="item in tableColumns"
          :prop="item.prop"
          :label="item.label"
          :key="item.prop"
          :width="item.width"
        >
        </el-table-column>
        <el-table-column fixed="right" label="操作" width="300">
          <template slot-scope="scope">
            <el-button
              @click.native.prevent="lookRow(scope.$index, tableData, 'trade')"
              size="small"
            >
              查看营业明细
            </el-button>
            <el-button
              @click.native.prevent="lookRow(scope.$index, tableData, 'coupon')"
              size="small"
            >
              查看优惠券明细
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-container">
        <el-pagination
          background
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
          :current-page="currentPage"
          :page-sizes="pageSizes"
          :page-size="PageSize"
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
        >
        </el-pagination>
      </div>
    </el-card>
    <el-dialog title="查看明细" :visible.sync="dialogTableVisible" width="70%">
      <div v-if="typeName == 'trade'">
        <merchant-verificatio-detail
          ref="MerchantVerificatioDetail"
          :StoreId="StoreId"
        ></merchant-verificatio-detail>
      </div>
      <div v-if="typeName == 'coupon'">
        <merchant-coupon
          ref="MerchantCoupon"
          :StoreId="StoreId"
        ></merchant-coupon>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import MerchantVerificatioDetail from "./MerchantVerificatioDetail.vue";
import MerchantCoupon from "./MerchantCoupon.vue";
export default {
  components: {
    MerchantVerificatioDetail,
    MerchantCoupon
  },
  data() {
    return {
      tableData: [],
      tableColumns: [
        {
          prop: "ShanghuBH",
          label: "商家编号"
        },
        {
          prop: "ShanghuMC",
          label: "商家名称"
        },
        {
          prop: "TotalCnsumer",
          label: "营业额"
        },
        {
          prop: "TotalCount",
          label: "已售数量"
        },
        {
          prop: "CouponCount",
          label: "优惠券发放数量"
        }
      ],
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
      value: "",
      search: "",
      currentPage: 1,
      PageSize: 20,
      total: 0,
      pageSizes: [10, 20, 50, 100],
      dialogTableVisible: false,
      StoreId: "", // 商铺id
      typeName: "",
      loading: false
    };
  },
  mounted() {
    this.gettoday();
    this.getData();
  },
  methods: {
    gettoday() {
      var today = new Date();
      var year = today.getFullYear();
      var month = (today.getMonth() + 1).toString().padStart(2, "0");
      var day = today.getDate().toString().padStart(2, "0");
      var date = year + "-" + month + "-" + day;
      this.value = [date, date];
    },
    getData() {
      this.loading = true;
      this.DiyCommon.ApiEngine.Run(
        "GetStoreStatisticsInfo",
        {
          BeginDate: this.value[0],
          EndDate: this.value[1],
          PageIndex: this.currentPage,
          PageSize: this.PageSize,
          StoreName: this.search
        },
        (result) => {
          if (result.Code == 1) {
            this.loading = false;
            this.tableData = result.Data.Data;
            this.total = result.Data.Count;
          } else {
            this.loading = false;
          }
        }
      );
    },
    // 点击查询
    handleSearch() {
      this.currentPage = 1;
      this.getData();
    },
    handleSizeChange(val) {
      console.log(`每页 ${val} 条`);
      this.PageSize = val;
      this.currentPage = 1;
      this.getData();
    },
    handleCurrentChange(val) {
      console.log(`当前页: ${val}`);
      this.currentPage = val;
      this.getData();
    },
    // 点击查看明细
    lookRow(index, tableData, type) {
      console.log(tableData[index]);
      this.dialogTableVisible = true;
      this.typeName = type;
      this.StoreId = tableData[index].Id;
      // 查看营业明细
      if (type == "trade") {
        this.$nextTick(() => {
          this.$refs?.MerchantVerificatioDetail.getDetailData(this.value);
        });
      }
      // 查看优惠券明细
      if (type == "coupon") {
        this.$nextTick(() => {
          this.$refs?.MerchantCoupon.getDetailData(this.value);
        });
      }
    }
  }
};
</script>

<style scoped>
.hearder {
  margin-bottom: 16px;
}
.pagination-container {
  margin-top: 16px;
}
</style>
