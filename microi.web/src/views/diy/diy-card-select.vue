<template>
  <el-card class="box-card" style="height: 113vh">
    <div slot="header" class="clearfix">
      <span>已选择列</span>
      <el-button style="float: right; padding: 3px 0" type="text" @click.stop="handleDelete()">清空选择</el-button>
    </div>
    <div class="card-content-wrapper">
      <el-collapse v-model="activeName" accordion>
        <el-collapse-item :name="item.Id" v-for="item in paginatedData" :key="item.Id" :disabled="NoPullDown">
          <template #title>
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
              <!-- 左侧：多个字段，支持换行、多行显示 -->
              <div style="display: flex; flex-direction: column; flex: 1;">
              <span style="
                font-weight: 500;
                margin-bottom: 2px;
                word-break: break-word;
                white-space: normal;
                line-height: 1.4;
              ">
                {{ ShowPrefix ? filedPrefix[ShowTitleName] + '：' + item[ShowTitleName] : item[ShowTitleName]}}
              </span>
              <span
                v-for="(fieldName, index) in ShowSubTitleList"
                :key="index"
                style="
                font-size: 12px;
                color: #666;
                margin-bottom: 1px;
                word-break: break-word;
                white-space: normal;
                line-height: 1.3;
                "
              >
                {{ ShowPrefix ? filedPrefix[fieldName]+ '：' + item[fieldName] : item[fieldName]}}
              </span>
              </div>

              <!-- 右侧：删除按钮，与左侧内容垂直居中对齐 -->
              <el-button
                type="text"
                size="small"
                style="
                color: #f56c6c;
                padding: 0;
                margin: 0;
                margin-left: 10px;
              "
                @click.stop="handleDelete(item.Id)"
              >
                删除
              </el-button>
            </div>
          </template>
          <el-descriptions v-show="activeName === item.Id" :column="1" style="margin-left: 15px; margin-right: 10px">
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
      // 主标题
      ShowTitleName: '',
      // 副标题
      ShowSubTitleList: [],
      // 前缀集合
      filedPrefix: {},
      // 是否禁用下拉
      NoPullDown: false,
      // 是否显示前缀
      ShowPrefix: false,
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
    },
  },
  watch: {
    tableSelectRow(newVal) {
      this.TableMultipleSelection = newVal.TableIndexDataList || [];
      this.currentPage = 1; // 数据更新时回到第一页

      // 显示下拉内容
      this.ShowDiyFieldList = newVal.ShowDiyFieldList || [];
      if (this.ShowPrefix) {
        this.filedPrefix = {}
        for (var item of this.ShowDiyFieldList) {
          var val = [...this.ShowSubTitleList,this.ShowTitleName].find(val => val === item.Name)
          if (val) {
            this.filedPrefix[item.Name] = item.Label
          }
        }

      }
    }
  },
  created () {
    this.TitleNameList()
  },
  methods: {
    TitleNameList () {
      var SelectRow = this.tableSelectRow
      // 是否禁用下拉
      this.NoPullDown = SelectRow.NoPullDown || false
      // 是否显示前缀 前缀为 ShowDiyFieldList[{Lable: '前缀中文名',Name: '英文名'}]
      this.ShowPrefix = SelectRow.ShowPrefix || false
      // 主标题
      this.ShowTitleName = SelectRow.ShowTitleName || ''
      // 副标题
      this.ShowSubTitleList = SelectRow.ShowSubTitleList || []
      // 显示条数
      this.pageSize = SelectRow.ShowPageSize || 15


    },
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
/* 尝试深度修改 el-collapse-item 的标题区域样式 */
.box-card >>> .el-collapse-item__header {
  height: auto !important; /* 允许标题栏高度自适应 */
  min-height: 40px; /* 可选：设置一个合理的最小高度 */
  padding: 8px 15px; /* 可选：增加一些内边距，让内容更舒适 */
  white-space: normal; /* 允许标题区域换行 */
}

.box-card >>> .el-collapse-item__header > div {
  white-space: normal !important;
  word-break: break-word !important;
  line-height: 1.4;
}
</style>
