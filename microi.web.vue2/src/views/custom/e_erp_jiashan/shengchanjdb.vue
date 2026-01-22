<template>
    <div class="shengchanjdb">
        <div style="padding: 20px">
            <div class="el-tabs el-tabs--top table-rowlist-tabs tab-pane-hide" id="table-rowlist-tabs">
                <div class="el-tabs__content">
                    <!---->
                    <div class="el-row">
                        <div class="el-col el-col-24">
                            <div class="el-card box-card box-card-table-row-list is-always-shadow">
                                <div class="search-outside" style="padding: 10px">
                                    <section>
                                        <!-- 款号 -->
                                        <div style="display: flex">
                                            <div class="el-input el-input--medium el-input-group" style="min-width: 150px; max-width: 50vw; height: 28px; font-size: smaller">
                                                <div class="el-input-group__prepend" style="color: black; font-size: smaller; height: 28px">
                                                    <i class="el-icon-search"></i>
                                                    款号
                                                </div>
                                                <el-select v-model="kuanhao" placeholder="请选择" clearable filterable>
                                                    <el-option v-for="(item, index) in options3" :key="index" :label="`${item.HuopinDH} ${item.HuopinMC}`" :value="item.HuopinDH"> </el-option>
                                                </el-select>
                                            </div>

                                            <!-- 查询 -->
                                            <el-button type="primary" style="font-size: smaller; height: 31px" @click="search">
                                                <span>
                                                    <i class="el-icon-search"></i>
                                                    查询
                                                </span>
                                            </el-button>
                                            <el-button @click="exportToExcel" style="font-size: smaller; height: 31px; margin-bottom: 3px">
                                                <i class="el-icon-download"></i>
                                                <span>导出</span>
                                            </el-button>
                                            <el-button type="primary" @click="handlePrint" style="font-size: smaller; height: 31px">打印表格</el-button>
                                        </div>
                                    </section>
                                </div>
                                <div style="width: 100%">
                                    <!--tableData在这里 -->
                                    <el-table
                                        highlight-current-row
                                        :data="tableData"
                                        border
                                        stripe
                                        max-height="500"
                                        :header-row-style="{
                                            color: '#333',
                                            fontSize: '14px'
                                        }"
                                        height="calc((100vh - 148px) - 70px)"
                                        empty-text="暂无数据"
                                        lazy
                                    >
                                        <el-table-column label="序号">
                                            <template slot-scope="scope">{{ scope.$index + 1 }}</template>
                                        </el-table-column>
                                        <el-table-column label="裁床单号" width="150" prop="caichuangdan" sortable> </el-table-column>
                                        <el-table-column prop="styleCode" label="款号" sortable></el-table-column>
                                        <el-table-column prop="styleName" label="款名" width="150" sortable> </el-table-column>
                                        <el-table-column prop="ganghao" label="缸号" width="150" sortable> </el-table-column>
                                        <el-table-column label="裁剪数">
                                            <template slot-scope="scope">
                                                {{ scope.row.countList[0] }}
                                            </template>
                                        </el-table-column>

                                        <!-- 动态渲染列 -->
                                        <el-table-column v-for="(item, index) in getColumns()" :key="index" :label="item.label" width="150">
                                            <template slot-scope="scope">
                                                {{ (index - 1) % 2 === 0 ? scope.row.countList[index + 1] + "%" : scope.row.countList[index + 1] }}
                                            </template>
                                        </el-table-column>
                                    </el-table>

                                    <!-- 分页 -->
                                    <div style="height: 5vh"></div>
                                    <div class="block" style="margin-top: 10px; float: left; margin-bottom: 10px; clear: both; margin-left: 10px">
                                        <el-pagination
                                            @size-change="handleSizeChange"
                                            @current-change="handleCurrentChange"
                                            :current-page="currentPage"
                                            :page-sizes="[10, 15, 20, 30, 40, 50, 100]"
                                            :page-size="pageSize"
                                            layout="total, sizes, prev, pager, next, jumper"
                                            :total="totalCount"
                                        >
                                        </el-pagination>
                                    </div>
                                    <!--  -->
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { downloadXlsx } from "/src/utils/xlsx.js";
const BaseUrl = "https://api-e-erp.microi.net";
var reg190317 = new RegExp("(^|&)" + "OsClient" + "=([^&]*)(&|$)");
var r190317 = window.location.search.substr(1).match(reg190317);
var osClient = r190317 != null ? r190317[2] : "";
//osClient = osClient;
export default {
    BaseUrl,
    created() {
        this.list4();
    },
    data() {
        return {
            OsClient: "",
            currentPage: 1,
            kuanhao: "",
            tableData: [],
            GongxuMC: [],
            pageSize: 15,
            totalCount: 0, // 声明 totalCount
            options3: [],
            gx: []
        };
    },
    methods: {
        refreshPage() {
            this.kuanhao == "";
        },
        //款号
        list4() {
            var self = this;
            this.DiyCommon.Post(
                BaseUrl + "/api/FormEngine/GetTableData",
                //"https://api-china.itdos.com/api/FormEngine/GetTableData",
                {
                    ModuleEngineKey: "Diy_kuanshixinxi",
                    OsClient: OsClient
                },
                function (res) {
                    console.log("l4" + res.Data);
                    if (res && res.Data && Array.isArray(res.Data)) {
                        self.options3 = res.Data.map((item) => ({
                            HuopinDH: item.HuopinDH,
                            HuopinMC: item.HuopinMC
                        }));
                    }
                }
            );
        },
        handlePrint() {
            // 获取表格 HTML 元素
            const table = document.querySelector(".el-table .el-table__body-wrapper table");
            // 获取表头元素
            const header = document.querySelector(".el-table .el-table__header-wrapper table");
            // 为了避免直接修改表格样式，复制表格元素
            const cloneTable = table.cloneNode(true);
            const cloneHeader = header.cloneNode(true);
            // 调整表格样式
            cloneTable.style.fontSize = "14px";
            cloneTable.style.borderCollapse = "collapse";
            cloneTable.style.border = "1px solid black";
            cloneTable.querySelectorAll("th, td").forEach((el) => {
                el.style.border = "1px solid #ddd";
                el.style.padding = "4px";
            });
            // 设置单元格内边距和边框样式
            cloneHeader.querySelectorAll("th").forEach((el) => {
                el.style.padding = "4px";
                el.style.border = "1px solid #ddd";
            });
            cloneTable.style.borderSpacing = "0"; // 添加表格内边框，缩短每个单元格之间的距离
            // 隐藏表格中的分页和排序指示器
            cloneTable.querySelectorAll(".gutter").forEach((el) => el.remove());

            // 创建一个新的窗口，并把表格添加到新窗口中进行打印
            const printWindow = window.open("", "Print", "height=600,width=800");
            printWindow.document.write("<html><head><title>生产进度表</title></head><body></body></html>");
            printWindow.document.body.appendChild(cloneHeader);
            printWindow.document.body.appendChild(cloneTable);
            printWindow.document.close();
            printWindow.print();

            // 打印完成后，关闭窗口
            printWindow.close();
        },
        exportToExcel() {
            // 筛选需要导出的表格列
            const filteredTableData = this.tableData.map((item) => {
                return {
                    款号: item.styleCode,
                    款名: item.styleName,
                    裁剪数: item.countList[0],
                    [this.GongxuMC[0]]: item.countList[1],
                    [`${this.GongxuMC[0]}%`]: item.countList[2],
                    [this.GongxuMC[1]]: item.countList[3],
                    [`${this.GongxuMC[1]}%`]: item.countList[4],
                    [this.GongxuMC[2]]: item.countList[5],
                    [`${this.GongxuMC[2]}%`]: item.countList[6],
                    [this.GongxuMC[3]]: item.countList[7],
                    [`${this.GongxuMC[3]}%`]: item.countList[8],
                    [this.GongxuMC[4]]: item.countList[9],
                    [`${this.GongxuMC[4]}%`]: item.countList[10],
                    [this.GongxuMC[5]]: item.countList[11],
                    [`${this.GongxuMC[5]}%`]: item.countList[12],
                    [this.GongxuMC[6]]: item.countList[13],
                    [`${this.GongxuMC[6]}%`]: item.countList[14],
                    [this.GongxuMC[7]]: item.countList[15],
                    [`${this.GongxuMC[7]}%`]: item.countList[16],
                    [this.GongxuMC[8]]: item.countList[17],
                    [`${this.GongxuMC[8]}%`]: item.countList[18],
                    [this.GongxuMC[9]]: item.countList[19],
                    [`${this.GongxuMC[9]}%`]: item.countList[20],
                    [this.GongxuMC[10]]: item.countList[21],
                    [`${this.GongxuMC[10]}%`]: item.countList[22],
                    [this.GongxuMC[11]]: item.countList[23],
                    [`${this.GongxuMC[11]}%`]: item.countList[24],
                    [this.GongxuMC[12]]: item.countList[25],
                    [`${this.GongxuMC[12]}%`]: item.countList[26],
                    [this.GongxuMC[13]]: item.countList[27],
                    [`${this.GongxuMC[13]}%`]: item.countList[28],
                    [this.GongxuMC[14]]: item.countList[29],
                    [`${this.GongxuMC[14]}%`]: item.countList[30],
                    [this.GongxuMC[15]]: item.countList[31],
                    [`${this.GongxuMC[15]}%`]: item.countList[32],
                    [this.GongxuMC[16]]: item.countList[33],
                    [`${this.GongxuMC[16]}%`]: item.countList[34],
                    [this.GongxuMC[17]]: item.countList[35],
                    [`${this.GongxuMC[17]}%`]: item.countList[36],
                    [this.GongxuMC[18]]: item.countList[37],
                    [`${this.GongxuMC[18]}%`]: item.countList[38],
                    [this.GongxuMC[19]]: item.countList[39],
                    [`${this.GongxuMC[19]}%`]: item.countList[40]
                };
            });
            if (filteredTableData.length > 0) {
                downloadXlsx(filteredTableData, "生产进度表.xlsx");
            }

            // // 将表格数据转换为 Excel 表格数据
            // const sheet = XLSX.utils.json_to_sheet(filteredTableData);

            // // 创建 Excel 工作簿
            // const workbook = XLSX.utils.book_new();
            // XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");

            // // 将工作簿写入二进制流
            // const excelData = XLSX.write(workbook, {
            //   bookType: "xlsx",
            //   type: "array",
            // });

            // // 创建并下载 Excel 文件
            // const blob = new Blob([excelData], {
            //   type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            // });
            // const a = document.createElement("a");
            // const url = URL.createObjectURL(blob);
            // a.href = url;
            // a.download = "生产进度表.xlsx";
            // document.body.appendChild(a);
            // a.click();
            // document.body.removeChild(a);
            // URL.revokeObjectURL(url);
        },
        handleSizeChange(val) {
            this.pageSize = val;
            this.search();
        },
        handleCurrentChange(val) {
            this.currentPage = val;
            this.search();
        },
        processList() {
            var self = this;
            this.DiyCommon.Post(
                BaseUrl + "/api/FormEngine/GetTableData",
                //"https://api-china.itdos.com/api/FormEngine/GetTableData",
                {
                    ModuleEngineKey: "f9c3f7a7-3ef7-49c4-90d4-15c75886195e",
                    OsClient: osClient
                },
                function (res) {
                    this.GongxuMC = res.Data.map(function (item) {
                        return item.GongxuMC;
                    });
                    //console.log(this.GongxuMC);
                }.bind(this)
            );
        },
        getColumns() {
            const sequence = ["", ""];
            const count = this.tableData.reduce((acc, cur) => Math.max(acc, cur.countList.length - 1), 0);
            const result = [];
            for (let i = 0; i <= count / 2 - 1; i++) {
                for (let j = 0; j < sequence.length; j++) {
                    if (j % 2 == 1) {
                        result.push({
                            label: `${this.GongxuMC[i]}进度%`,
                            prop: `${this.GongxuMC[i]}进度%`
                        });
                    } else {
                        result.push({
                            label: `${this.GongxuMC[i]}`,
                            prop: `${this.GongxuMC[i]}`
                        });
                    }
                }
            }
            return result;
        },
        search() {
            var self = this;
            if (this.kuanhao == "") {
                this.$message.error("请选择款号");
            } else {
                this.DiyCommon.Post(
                    "https://e-erp-qrcode.microi.net/Ebu/MES_Schedule",
                    {
                        StyleCode: this.kuanhao,
                        // _PageIndex: this.currentPage,
                        // _PageSize: this.pageSize,

                        OsClient: osClient
                    },
                    function (res) {
                        console.log(res);
                        self.totalCount = res.dataCount;
                        if (res.dataList != 0 && self.kuanhao != "") {
                            self.GongxuMC = res.dataList;
                        } else {
                            self.processList();
                        }
                        self.tableData = res.data.map((item) => ({
                            styleCode: item.styleCode,
                            styleName: item.styleName,
                            countList: item.countList,
                            ganghao: item.ganghao,
                            caichuangdan: item.caichuangdan
                        }));
                    }
                );
            }
        },
        list() {
            var self = this;
            this.DiyCommon.Post(
                "https://e-erp-qrcode.microi.net/Ebu/MES_Schedule",
                {
                    StyleCode: "",
                    OsClient: osClient
                },
                function (res) {
                    // console.log(res);
                    // console.log("777" + self.GongxuMC);
                    self.totalCount = res.dataCount;
                    self.tableData = res.data.map((item) => ({
                        styleCode: item.styleCode,
                        styleName: item.styleName,
                        caichuangdan: item.caichuangdan,
                        ganghao: item.ganghao,
                        countList: item.countList
                    }));
                }
            );
        },
        xs() {
            // if (this.kuanhao == "") {
            //   this.list();
            // } else {
            //   this.search;
            // }
            if (this.kuanhao == "") {
            } else {
                this.search();
            }
        }
    },
    mounted() {
        this.xs();
        this.processList();
    }
};
</script>

<style lang="scss" scoped>
.shengchanjdb ::v-deep .el-table__header th {
    white-space: nowrap;
    text-align: center;
    font-weight: 500;
    font-size: 16px;
    color: #333;
}
.shengchanjdb ::v-deep .el-table--enable-row-transition .el-table__body td.el-table__cell {
    padding: 6px;
    white-space: nowrap;
    text-align: center;
    font-weight: 500;
    color: #090404;
    font-size: 14px;
}
.el-table--border th.el-table__cell {
    background-color: #f5f7fa;
}

// .el-table th.el-table__cell > .cell {
//   white-space: nowrap;
//   text-align: center;
// }

// .el-table td.el-table__cell > .cell {
//   text-align: center;
// }

.nav {
    display: flex;
}

.my-input {
    width: 30vw;
    /* 设置宽度 */
    margin-right: 20px;
}

/* .el-pagination {
  position: absolute;
  bottom: 0;
} */
.shengchanjdb .el-table {
    ::deep .el-table__body-wrapper::-webkit-scrollbar {
        width: 10px; /*滚动条宽度*/
        height: 20px; /*滚动条高度*/
    }
    /*定义滚动条轨道 内阴影+圆角*/
    .shengchanjdb ::deep .el-table__body-wrapper::-webkit-scrollbar-track {
        box-shadow: 0px 1px 3px #071e4a inset; /*滚动条的背景区域的内阴影*/
        border-radius: 10px; /*滚动条的背景区域的圆角*/
        background-color: #071e4a; /*滚动条的背景颜色*/
    }
    /*定义滑块 内阴影+圆角*/
    .shengchanjdb ::deep .el-table__body-wrapper::-webkit-scrollbar-thumb {
        box-shadow: 0px 1px 3px #00a0e9 inset; /*滚动条的内阴影*/
        border-radius: 10px; /*滚动条的圆角*/
        background-color: #00a0e9; /*滚动条的背景颜色*/
    }
}
</style>
