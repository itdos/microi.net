<template>
    <!-- <div>签单情况报表</div> -->
    <div class="qiandanBOM">
        <div class="diy-table pluginPage">
            <div style="display: flex; flex-wrap: wrap; padding: 10px; align-items: center">
                <div style="width: 150px; margin-right: 15px" class="el-input el-input--mini el-input-group el-input-group--prepend el-input--suffix">
                    <div class="el-input-group__prepend" style="color: black">
                        <i class="el-icon-search"></i>
                        开始时间
                    </div>
                    <div class="block">
                        <el-date-picker v-model="kaishiSJ" type="date" placeholder="选择日期"> </el-date-picker>
                    </div>
                </div>
                <div style="width: 150px; margin-right: 15px" class="el-input el-input--mini el-input-group el-input-group--prepend el-input--suffix">
                    <div class="el-input-group__prepend" style="color: black">
                        <i class="el-icon-search"></i>
                        结束时间
                    </div>
                    <div class="block">
                        <el-date-picker v-model="jieshuSJ" type="date" placeholder="选择日期"> </el-date-picker>
                    </div>
                </div>
                <div style="width: 120px; margin-right: 15px" class="el-input el-input--mini el-input-group el-input-group--prepend el-input--suffix">
                    <div class="el-input-group__prepend" style="color: black">
                        <i class="el-icon-search"></i>
                        业务员名称
                    </div>
                    <el-input placeholder="请输业务员名称" v-model="yewwuY" clearable style="width: 200px"></el-input>
                </div>
                <div style="width: 120px; margin-right: 15px" class="el-input el-input--mini el-input-group el-input-group--prepend el-input--suffix">
                    <div class="el-input-group__prepend" style="color: black">
                        <i class="el-icon-search"></i>
                        客户名称
                    </div>
                    <el-input placeholder="请输客户名称" v-model="kehuMC" clearable style="width: 200px"></el-input>
                </div>
                <div>
                    <el-button type="primary" @click="getData">搜索</el-button>
                </div>
            </div>

            <!-- show-summary
          :summary-method="getSummaries"
          sum-text="总计".slice((currentPage-1)*pagesize,currentPage*pagesize) -->
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
                    width="100%"
                >
                    <el-table-column type="index" width="49" label="编号" class="el-table__row" fixed="left"></el-table-column>
                    <el-table-column v-for="(item, index) in items1" :key="index" :prop="item.prop" :label="item.label" :width="item.width"> </el-table-column>
                    //测试
                    <el-table-column label="供应商" width="500px" align="center">
                        <template slot-scope="scope">
                            <!--              <el-table-->
                            <!--                :data="tableData[scope.$index].gongyingS"-->
                            <!--                style="width: 100%;">-->
                            <!--                <el-table-column-->
                            <!--                  v-for="(item, index) in items_gys2[scope.$index]"-->
                            <!--                  :label="item.label"-->
                            <!--                  width="160">-->
                            <!--                </el-table-column>-->
                            <!--              </el-table>-->
                            <el-table :data="tableData[scope.$index].gongyingStableData" style="width: 100%">
                                <el-table-column v-for="(item, index_gys) in tableData[scope.$index].gongyingStable" :key="index_gys" :label="item.label" :prop="item.prop" :width="item.width">
                                </el-table-column>
                                <!-- <el-table-column
                  v-for="(item, index) in items_gys[scope.$index]"
                  :label="item.label"
                  :prop="item.prop"
                  width="160">
                </el-table-column> -->
                            </el-table>
                        </template>
                    </el-table-column>

                    <el-table-column v-for="(item, index1) in items2" :key="index1" :prop="item.prop" :label="item.label" :width="item.width"> </el-table-column>
                    <el-table-column v-for="(item, index2) in items_gdl" :key="index2" :prop="item.prop" :label="item.label" :width="item.width" fixed="left"> </el-table-column>
                </el-table>
            </div>
            <!-- 分页 -->
            <div class="el-pagination is-background" style="display: flex; align-items: center; padding: 10px">
                <el-pagination
                    @size-change="handleSizeChange"
                    @current-change="handleCurrentChange"
                    :current-page="currentPage"
                    :page-sizes="[15, 30, 60, 100]"
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
import axios from "axios";
export default {
    mounted() {
        this.getData();
    },
    data() {
        return {
            userTableData: [], // 用户列表
            currentPage: 1, // 初始页
            pagesize: 15, // 初始每页的数据
            tableData: [],
            kehuMC: "",
            xiaoshouRY: "",
            gys: [],
            kaishiSJ: "",
            jieshuSJ: "",
            response: [],
            kuandu: [],
            yewwuY: "",
            arr: [],
            getgys: [],
            items1: [
                { prop: "qiandingRQ", label: "合同签订", width: "93" },
                { prop: "dingdanJE", label: "订单金额", width: "93" },
                { prop: "daozhangJE", label: "到账金额", width: "93" },
                { prop: "beizhu_DD", label: "订单备注", width: "93" },
                { prop: "fapiao_DD", label: "订单发票", width: "93" }
            ],
            items2: [
                { prop: "jinhuoZE", label: "进货总额", width: "93" },
                { prop: "yifuK", label: "已付款", width: "93" },
                { prop: "weifuK", label: "未付款", width: "93" },
                { prop: "beizhu_FK", label: "付款备注", width: "93" },
                { prop: "fapiao_FK", label: "付款发票", width: "93" },
                { prop: "lirun", label: "利润", width: "93" },
                { prop: "lirun_BY", label: "本月利润", width: "93" },
                { prop: "Yunfei", label: "运费", width: "93" },
                { prop: "fahuoQK", label: "发货情况", width: "93" },
                { prop: "tichengBL", label: "提成比例", width: "93" },
                { prop: "zongtiC", label: "总提成", width: "93" },
                { prop: "maoliL", label: "毛利率", width: "93" }
            ],
            items_gdl: [
                { prop: "mouth", label: "月份", width: "70" },
                { prop: "yewuY", label: "业务员", width: "65" },
                { prop: "kehuMC", label: "客户单位", width: "210" }
            ],
            items_gys: [],
            items_gys2: [],
            total: 0
        };
    },
    methods: {
        async fetchData() {
            try {
                this.response = await axios.get("https://e-erp-qrcode.microi.net/ReportForms/HardwareReconciliation", {
                    params: {
                        OsClient: "jiutai",
                        UserName: "",
                        CustomName: "",
                        Date_B: "",
                        Date_E: ""
                    }
                });
                // 处理接口返回的数据
            } catch (error) {
                console.error(error);
                // 处理错误
            }
            if (this.response.data.code == 1) {
                this.tableData = this.response.data.value;
                this.total = this.response.data.value.length;
                var kd = 0;
                for (var i = 0; i < this.response.data.value.length; i++) {
                    var gys = [];
                    var gys2 = [];
                    if (this.response.data.value[i].gongyingS.length > kd) {
                        kd = this.response.data.value[i].gongyingS.length;
                    }
                    for (var j = 0; j < this.response.data.value[i].gongyingS.length; j++) {
                        gys.push({
                            prop: "jinE",
                            label: this.response.data.value[i].gongyingS[j].name,
                            name: this.response.data.value[i].gongyingS[j].jinE,
                            width: "93"
                        });
                        gys2.push({
                            prop: "name",
                            label: this.response.data.value[i].gongyingS[j].name,
                            width: "93"
                        });
                    }
                    this.items_gys[i] = gys;
                    this.items_gys2[i] = gys2;
                }
                kd = +kd * 164.2;
                this.kuandu = kd + "px";
                this.tableData = this.response.data.value;
                this.total = this.response.data.value.length;
            }
        },
        async getData() {
            try {
                this.response = await axios.get("https://e-erp-qrcode.microi.net/ReportForms/HardwareReconciliation", {
                    params: {
                        OsClient: "jiutai",
                        UserName: this.yewwuY,
                        CustomName: this.kehuMC,
                        Date_B: this.kaishiSJ,
                        Date_E: this.jieshuSJ
                    }
                });
                // 处理接口返回的数据
            } catch (error) {
                console.error(error);
                // 处理错误
            }
            console.log(this.response.data);
            if (this.response.data.code == 1) {
                this.tableData = this.response.data.value;
                this.total = this.response.data.value.length;
                this.tableData.forEach((item) => {
                    item.gongyingStable = [];
                    item.gongyingStableData = [];
                    var obj = {};
                    item.gongyingS.forEach((item2) => {
                        item.gongyingStable.push({
                            prop: item2.name,
                            label: item2.name
                        });
                        obj[item2.name] = item2.jinE;
                    });
                    item.gongyingStableData.push(obj);
                });
                // for(var i=0;i<this.response.data.value.length;i++){
                //   var gys = [];
                //   var gys2 = [];
                //   for(var j=0;j < this.response.data.value[i].gongyingS.length;j++){
                //     console.log(this.response.data.value[i].gongyingS[j],j,123)
                //     gys.push({
                //       prop: 'name',
                //       label: this.response.data.value[i].gongyingS[j].jinE,
                //       width: "93"
                //     })
                //     gys2.push({
                //       prop:'name',
                //       label:this.response.data.value[i].gongyingS[j].name,
                //       width:'93'
                //     })
                //   }
                //   this.items_gys[i]=gys
                //   this.items_gys2[i]=gys2
                //   console.log(this.items_gys)
                // }
                console.log("111111111111", this.tableData);
            }
        },
        handleSizeChange: function (size) {
            this.pagesize = size;
            console.log(this.pagesize); //每页下拉显示数据
        },
        handleCurrentChange: function (currentPage) {
            this.currentPage = currentPage;
            console.log(this.currentPage); //点击第几页
        },
        shouldRenderColumn(index, row) {
            console.log(index, row);
            return index === 0;
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
    min-height: 800px;
    max-width: 100%;
    background-color: white;
    padding: 10px;
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
