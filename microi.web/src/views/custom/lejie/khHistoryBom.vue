<template>
    <!-- <div>签单情况报表</div> -->
    <div class="qiandanBOM">
        <div class="diy-table pluginPage">
            <div style="display: flex; flex-wrap: wrap; padding: 10px; align-items: center">
                <div style="width: 150px; margin-right: 15px" class="el-input el-input--mini el-input-group el-input-group--prepend el-input--suffix">
                    <div class="el-input-group__prepend" style="color: black">
                        <i class="el-icon-search"></i>
                        客户名称
                    </div>
                    <el-input placeholder="请输入客户名称" v-model="kehuMC" clearable style="width: 250px"></el-input>
                </div>

                <div>
                    <el-button type="primary" @click="search">搜索</el-button>
                </div>
            </div>
            <div class="qiandanTable">
                <el-table
                    highlight-current-row
                    :data="tableData"
                    stripe
                    border
                    height="700"
                    max-height="700"
                    fit
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
                    <el-table-column type="index" width="50" label="编号" class="el-table__row"></el-table-column>
                    <el-table-column v-for="(item, index) in items" :key="index" :label="item.label" :prop="item.prop" :width="item.width"> </el-table-column>
                </el-table>
            </div>
            <!-- 分页 -->
            <div class="el-pagination is-background" style="display: flex; align-items: center; padding: 10px">
                <el-pagination
                    @size-change="handleSizeChange"
                    @current-change="handleCurrentChange"
                    :current-page="currentPage4"
                    :page-sizes="[100, 200, 300, 400]"
                    :page-size="100"
                    layout="total, sizes, prev, pager, next, jumper"
                    :total="total"
                >
                </el-pagination>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    mounted() {
        this.getData();
    },
    data() {
        return {
            tableData: [],
            kehuMC: "",
            xiaoshouRY: "",
            items: [
                { prop: "GongsiMC", label: "公司名称", width: "180" },
                { prop: "NashuiRLX", label: "纳税人类型", width: "180" },
                { prop: "LianXR", label: "联系人", width: "180" },
                { prop: "LianFS", label: "联系方式", width: "180" },
                { prop: "SuozaiD", label: "所在地", width: "180" },
                { prop: "JutiDZ", label: "具体地址", width: "180" },
                { prop: "LishiSK", label: "历年收款", width: "180" },
                { prop: "CaishuiGW", label: "财税顾问", width: "180" },
                { prop: "Bumen", label: "部门", width: "180" },
                { prop: "Zubie", label: "组别", width: "180" },
                { prop: "Xiaoshou", label: "销售", width: "180" },
                { prop: "ShifouZZ", label: "是否在职", width: "180" },
                { prop: "XiaoshouZG", label: "销售主管", width: "180" },
                { prop: "XiaoshouJL", label: "销售经理", width: "180" },
                { prop: "ZhuanjieSGS", label: "转介绍公司", width: "180" },
                { prop: "mocishoufei", label: "末次收费", width: "180" }
            ],
            total: 0
        };
    },
    methods: {
        getData() {
            var self = this;
            self.DiyCommon.Post(
                "https://api-china.itdos.com/api/ApiEngine/Run",
                {
                    ApiEngineKey: "Baobiao_Lishihetong"
                },
                function (res) {
                    self.tableData = res.Data;
                    self.total = res.Data.length;
                }
            );
        },
        search() {
            var self = this;
            self.DiyCommon.Post(
                "https://api-china.itdos.com/api/ApiEngine/Run",
                {
                    ApiEngineKey: "Baobiao_Lishihetong",
                    KehuMC: self.kehuMC
                },
                function (res) {
                    self.tableData = res.Data;
                    self.total = res.Data.length;
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
