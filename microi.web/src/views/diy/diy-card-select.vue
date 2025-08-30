<template>
  <el-card class="box-card" style="height: 113vh">
    <div slot="header" class="clearfix">
      <span>已选择列</span>
      <el-button style="float: right; padding: 3px 0" type="text" @click.stop="handleDelete()">清空选择</el-button>
    </div>
    <div class="card-content-wrapper">
      <el-collapse v-model="activeName" accordion>
        <el-collapse-item :name="item.Id" v-for="item in paginatedData" :key="item.Id">
          <template #title>
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
              <span style="margin-left: 15px">{{ item[tableSelectRow.ShowListName] }}</span>
              <el-button
                type="text"
                size="small"
                style="color: #f56c6c; padding: 0; margin: 0; margin-right: 5px"
                @click.stop="handleDelete(item.Id)"
              >
                删除
              </el-button>
            </div>
          </template>
          <el-descriptions v-if="activeName === item.Id" :column="1" style="margin-left: 15px; margin-right: 10px">
            <el-descriptions-item :label="el_item.Label" v-for="el_item in ShowDiyFieldList" :key="el_item.Id">
              {{ item[el_item.Name] }}
            </el-descriptions-item>
          </el-descriptions>
        </el-collapse-item>
      </el-collapse>

      <!-- 分页组件 -->
      <el-pagination
        v-if="TableMultipleSelection.length > 0"
        style="margin-top: 20px; text-align: center;"
        @current-change="handlePageChange"
        :current-page="currentPage"
        :page-size="pageSize"
        :total="TableMultipleSelection.length"
        layout="prev, pager, next, total"
      />
    </div>
  </el-card>
</template>

<script>

export default {
  props: {
    tableSelectRow: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      activeName: '',
      TableMultipleSelection: [],
      ShowDiyFieldList: [],
      currentPage: 1,
      pageSize: 15
    };
  },
  computed: {
    paginatedData() {
      const start = (this.currentPage - 1) * this.pageSize;
      const end = start + this.pageSize;
      return this.TableMultipleSelection.slice(start, end);
    },
    totalPages() {
      return Math.ceil(this.TableMultipleSelection.length / this.pageSize);
    }
  },
  watch: {
    tableSelectRow(newVal) {
      this.TableMultipleSelection = newVal.TableIndexDataList || [];
      this.ShowDiyFieldList = newVal.ShowDiyFieldList || [];
      this.currentPage = 1; // 数据更新时回到第一页
    }
  },
  methods: {
    handleDelete(Id) {
      this.$emit('getOpenAnyTableParam', {
        OldTableMultipleSelection: this.tableSelectRow.TableIndexDataList,
        TableMultipleSelection: Id
          ? this.tableSelectRow.TableIndexDataList.filter(uns => uns.Id !== Id)
          : [],
        ShowDiyFieldList: this.ShowDiyFieldList,
        Type: 'N'
      });
    },
    handlePageChange(page) {
      this.currentPage = page;
    }
  }
};
</script>

<style scoped>
.box-card {
  height: 113vh; /* 或 60vh，按需调整 */
}

.box-card >>> .el-card__body {
  height: calc(100% - 60px); /* 减去 header 高度，可根据实际调整 */
  overflow-y: auto;
  padding: 0;
}

.card-content-wrapper {
  padding-left: 10px;
  padding-right: 10px;
  height: 100%;
}
</style>
