<template>
    <div>
        <el-card class="box-card" :body-style="{ padding: '10px' }">
            <el-table :data="tableData" border stripe size="medium" height="calc(80vh - 218px)" style="width: 100%">
                <el-table-column v-for="item in tableColumns" :prop="item.prop" :label="item.label" :key="item.prop" :width="item.width"> </el-table-column>
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
    </div>
</template>

<script>
export default {
    props: {
        StoreId: {
            type: String,
            default: () => {
                return "";
            }
        }
    },
    data() {
        return {
            tableData: [],
            tableColumns: [
                {
                    prop: "Name",
                    label: "用户名称"
                },
                {
                    prop: "Account",
                    label: "用户账号"
                },
                {
                    prop: "ShangpinMC",
                    label: "商品名称"
                },
                {
                    prop: "Score",
                    label: "积分"
                },
                {
                    prop: "Status",
                    label: "状态"
                },
                {
                    prop: "CreateTime",
                    label: "消费时间"
                }
            ],
            value: "",
            currentPage: 1,
            PageSize: 20,
            total: 0,
            pageSizes: [10, 20, 50, 100],
            dialogTableVisible: false
        };
    },
    methods: {
        getDetailData(value) {
            this.DiyCommon.ApiEngine.Run(
                "GetStoreHeXiaoCouponDetail",
                {
                    BeginDate: value[0],
                    EndDate: value[1],
                    PageIndex: this.currentPage,
                    PageSize: this.PageSize,
                    StoreId: this.StoreId
                },
                (result) => {
                    if (result.Code == 1) {
                        this.tableData = result.Data.DetailData;
                        this.total = result.Data.Total;
                    }
                }
            );
        },
        handleSizeChange(val) {
            console.log(`每页 ${val} 条`);
            this.PageSize = val;
            this.currentPage = 1;
            this.getDetailData();
        },
        handleCurrentChange(val) {
            console.log(`当前页: ${val}`);
            this.currentPage = val;
            this.getDetailData();
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
