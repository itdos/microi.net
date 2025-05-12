<template>
  <div>
    <el-card class="box-card" :body-style="{ padding: '10px' }">
      <el-form :label-position="labelPosition" size="small">
        <div v-for="(item, index) in tableColumns" :key="index">
          <el-form-item :label="item.label">
            <el-input v-model="tableData[item.prop]" :disabled="true"></el-input>
          </el-form-item>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script>
export default {
  props: {
    DataAppend: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      labelPosition: "right",
      tableData: {},
      tableColumns: [
        {
          prop: "MemberName",
          label: "用户名称"
        },
        {
          prop: "MemberAccount",
          label: "用户账号"
        },
        {
          prop: "FensiCount",
          label: "粉丝数量"
        },
        {
          prop: "FensiTotal",
          label: "粉丝总消费"
        },
        {
          prop: "ComputeTotal",
          label: "可计算佣金消费"
        },
        {
          prop: "CommissionTotal",
          label: "佣金总额"
        },
        {
          prop: "HaveWithdrawalMoney",
          label: "已提现金额"
        },
        {
          prop: "LockWithdrawalMoney",
          label: "锁定金额"
        },
        {
          prop: "WithdrawalMoney",
          label: "可提现金额"
        }
      ]
    };
  },
  mounted() {
    this.getDetailData();
  },
  methods: {
    getDetailData() {
      this.DiyCommon.ApiEngine.Run(
        "GetFensiDetail",
        {
          MemberId: this.DataAppend.MemberId
        },
        (result) => {
          if (result.Code == 1) {
            this.tableData = result.Data;
          }
        }
      );
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
