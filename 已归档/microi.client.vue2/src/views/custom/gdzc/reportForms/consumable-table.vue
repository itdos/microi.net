<template>
    <div>
        <el-card>
            <el-form inline class="keyword-search">
                <el-form-item label="关键字">
                    <el-input v-model="Keyword" placeholder="搜索编码，名称，型号等" clearable />
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" icon="el-icon-search" @click="getTableList(true)"> 搜索 </el-button>
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="onExportExcel"> 导出Excel </el-button>
                </el-form-item>
            </el-form>
        </el-card>
        <div>
            <el-table v-loading="tableLoading" stripe border :data="tableList">
                <el-table-column label="耗材名称" prop="HaocaiMC" />
                <el-table-column label="耗材编码" prop="HaocaiBM" />
                <el-table-column label="规格型号" prop="GuigeXH" />
                <el-table-column label="品牌" prop="Pinpai" />
                <el-table-column label="当前库位" prop="DangqianKW" />
                <el-table-column label="入库数量" prop="RukuCount" />
                <el-table-column label="出库数量" prop="ChukuCount" />
                <el-table-column label="当前库存" prop="DangqianKC" />
                <el-table-column label="库存总金额" prop="KucunZJE" />

                <!-- <el-table-column
          label="操作"
          width="180"
        >
          <template slot-scope="scope">
            <el-button
              icon="el-icon-edit"
              size="mini"
              @click="EditList(scope.row.id)"
            >
              编辑
            </el-button>
          </template>
        </el-table-column> -->
            </el-table>
        </div>

        <pagination v-show="PageTotal > 0" :auto-scroll="false" :total="PageTotal" :page.sync="PageIndex" :limit.sync="PageSize" @pagination="(e) => getTableList(false)" />
    </div>
</template>

<script>
import Pagination from "@/components/Pagination";
import elDragDialog from "@/directive/el-drag-dialog";
import qs from "qs";
export default {
    name: "ConsumableList",
    directives: {
        elDragDialog
    },
    components: {
        Pagination
    },
    data() {
        return {
            Keyword: "",
            BtnAddLoading: false,
            ShowAllSearch: true,

            tableLoading: false,
            tableList: [],
            _OrderBy: "",
            _OrderByType: "",
            PageIndex: 1,
            PageSize: 10,
            PageTotal: 0
        };
    },

    async mounted() {
        this.getTableList();
    },

    methods: {
        async onExportExcel() {
            let payload = {
                keyword: this.Keyword,
                TenantId: this.$getCurrentUser.TenantId
            };
            const url = `${this.$apiHost}/export/haocai_report_export?` + qs.stringify(payload);

            window.open(url);
        },
        //获取列表
        async getTableList(init = false) {
            if (init) {
                this.PageIndex = 1;
                this.PageSize = 10;
                this.PageTotal = 0;
            }
            const payload = {
                keyword: this.Keyword,
                pageNumber: this.PageIndex,
                pageSize: this.PageSize,
                ApiEngineKey: "haocai_report"
            };
            this.tableLoading = true;
            const res = await this.DiyCommon.ApiEngine.Run(payload);
            if (res.Code == 1) {
                this.tableList = res.Data;
                this.PageTotal = res.DataCount;
                this.tableLoading = false;
            } else {
                this.tableLoading = false;
            }
        }
    }
};
</script>

<style lang="scss" scoped></style>
