<template>
  <div>
    <el-card>
      <el-form inline class="keyword-search">
        <el-form-item>
          <el-input
            v-model="Keyword"
            placeholder="请输入RFID,名称,编号等"
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
    <div>
      <el-table v-loading="tableLoading" stripe border :data="tableList">
        <el-table-column label="序号" width="80">
          <template slot-scope="scope">
            {{ scope.$index + 1 }}
          </template>
        </el-table-column>
        <el-table-column
          prop="YubaoFRQ"
          label="预报废日期"
          show-overflow-tooltip
        />
        <el-table-column
          prop="YubaoFNX"
          label="预报废年限"
          show-overflow-tooltip
        />
        <el-table-column
          prop="GoumaiRQ"
          label="购买日期"
          show-overflow-tooltip
        />
        <el-table-column prop="RFID" label="RFID" show-overflow-tooltip />
        <el-table-column prop="ZichanMC" label="名称" show-overflow-tooltip />
        <el-table-column prop="ZichanBH" label="编号" show-overflow-tooltip />
        <el-table-column label="状态">
          <template slot-scope="scope">
            <span :class="getTypeColor(scope.row.ZichanZT)">{{
              scope.row.ZichanZT
            }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="Pinpai" label="品牌" />
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
  name: "YuBaoFeiList",
  directives: {
    elDragDialog
  },
  components: {
    Pagination
  },
  computed: {
    getTypeColor() {
      return (state) => {
        let classVal = "";
        if (state == "在用中") {
          classVal = "type blue";
        } else if (state == "闲置中") {
          classVal = "type green";
        } else if (state == "借用中") {
          classVal = "type info";
        } else {
          classVal = "type";
        }
        return classVal;
      };
    }
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
        `${this.$apiHost}/export/export_yubaofei_zichan_report?` +
        qs.stringify(payload);

      window.open(url);
    },
    //获取列表
    async getTableList(init = false) {
      let self = this;
      if (init) {
        this.PageIndex = 1;
        this.PageSize = 10;
        this.PageTotal = 0;
      }
      const payload = {
        pageNumber: this.PageIndex,
        pageSize: this.PageSize,
        keyword: this.Keyword
      };
      this.tableLoading = true;

      this.DiyCommon.Get(
        `${self.$apiHost}/zichan/get_yubaofei_zichan`,
        payload,
        function (result) {
          if (result.Code == 1) {
            self.tableList = result.List;
            self.PageTotal = result.TotalCount;
            self.tableLoading = false;
          } else {
            self.tableLoading = false;
          }
        }
      );
    }
  }
};
</script>

<style lang="scss" scoped>
.type {
  color: #fff;
  padding: 1px 5px;
  border-radius: 15px;
  font-size: 12px;
  background-color: #dc3545;
}
.info {
  background-color: #909399;
}
.blue {
  background-color: #007bff;
}
.green {
  background-color: #28a745;
}
</style>
