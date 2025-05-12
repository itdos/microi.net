<template>
  <div>
    <el-card>
      <el-form inline class="keyword-search">
        <el-form-item label="关键字">
          <el-input
            v-model="Keyword"
            placeholder="搜索编码，序列号，名称等"
            clearable
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            icon="el-icon-search"
            @click="getTableList(true)"
          >
            搜索
          </el-button>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onExportExcel">
            导出Excel
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
    <div class="flexible-table">
      <el-table v-loading="tableLoading" stripe border :data="tableList">
        <el-table-column label="资产编码" prop="ZichanBH" width="120" />
        <el-table-column label="序列号" prop="XulieH" />
        <el-table-column
          label="资产名称"
          prop="ZichanMC"
          width="180"
          show-overflow-tooltip
        />
        <el-table-column label="资产来源" prop="ZichanLY" />
        <el-table-column label="资产净值" prop="ZichanJZ" />
        <el-table-column label="资产价格" prop="ZichanJG" />
        <el-table-column
          label="资产规格"
          prop="ZichanGG"
          width="180"
          show-overflow-tooltip
        />
        <el-table-column label="品牌" prop="Pinpai" />
        <el-table-column label="计量单位" prop="JiliangDW" />
        <el-table-column label="资产状态" prop="ZichanZT" />
        <el-table-column
          label="存放库位"
          prop="CunfangKW"
          width="180"
          show-overflow-tooltip
        />
        <el-table-column label="领用次数" prop="ApplyCount" />
        <el-table-column label="退还次数" prop="ReturnCount" />
        <el-table-column label="借用次数" prop="BorrowCount" />
        <el-table-column label="归还次数" prop="BackCount" />
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

    <pagination
      v-show="PageTotal > 0"
      :auto-scroll="false"
      :total="PageTotal"
      :page.sync="PageIndex"
      :limit.sync="PageSize"
      @pagination="(e) => getTableList(false)"
    />
  </div>
</template>

<script>
import Pagination from "@/components/Pagination";
import elDragDialog from "@/directive/el-drag-dialog";
import qs from "qs";
export default {
  name: "PropertyList",
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
      const url =
        `${this.$apiHost}/export/zichan_report_export?` + qs.stringify(payload);

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
        ApiEngineKey: "zichan_report"
      };
      this.tableLoading = true;
      const res = await this.DiyCommon.ApiEngine.Run(payload);
      console.log(res);
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
