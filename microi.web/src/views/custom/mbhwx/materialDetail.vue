<template>
  <div>
    <el-card shadow="never" v-loading="loading">
      <div v-for="(item, index) in materialDetail" :key="index">
        <div v-if="item.Data.length > 0">
          <div class="title-list" v-if="item.Title">
            <ul class="item-ul title item-flex">
              <li v-for="item_title in item.Title" :key="item_title">
                {{ item_title }}
              </li>
            </ul>
          </div>
          <div class="item-flex title-list" v-if="item.Name">
            <ul class="item-ul title">
              <li>{{ item.Name }}</li>
            </ul>
          </div>
          <div
            v-for="(item_Data, index_data) in item.Data"
            :key="index_data"
            class="item-list"
          >
            <ul class="item-flex item-ul">
              <li>{{ item_Data.Name }}</li>
              <li v-if="item_Data.Text">{{ item_Data.Text }}</li>
              <li v-if="item_Data.TestStandard">
                {{ item_Data.TestStandard }}
              </li>
              <li>{{ item_Data.Data }}</li>
              <li>{{ item_Data.Unit }}</li>
            </ul>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script>
export default {
  props: {
    Id: {
      type: String,
      default: () => ""
    }
  },
  data() {
    return {
      materialDetail: [],
      loading: false
    };
  },
  mounted() {
    // this.GetMaterialDetail()
  },
  methods: {
    // 获取数据详情
    GetMaterialDetail() {
      this.loading = true;
      this.materialDetail = [];
      this.DiyCommon.ApiEngine.Run(
        "GetMaterialDetail",
        {
          Id: this.Id
        },
        (result) => {
          if (result.Code == 1) {
            this.loading = false;
            for (let i in result.Data) {
              if (
                typeof result.Data[i] === "object" &&
                !Array.isArray(result.Data[i]) &&
                result.Data[i]
              ) {
                this.materialDetail.push(result.Data[i]);
              }
            }
            console.log(this.materialDetail, "materialDetail");
          } else {
            this.loading = false;
            this.$message.error(result.Msg);
          }
        }
      );
    }
  }
};
</script>

<style scoped>
.title-list {
  padding-left: 10px;
  background: #ccc;
}

.item-flex {
  display: flex;
}
.item-ul {
  list-style: none;
  padding: 0;
  margin: 0;
  line-height: 35px;
  font-size: 14px;
  color: #333;
  width: 100%;
}
.item-ul li {
  margin-right: 20px;
  width: 40%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-ul li:first-child {
  width: 60%;
}
.item-list {
  padding-left: 10px;
}
.item-list:nth-child(even) {
  background-color: #f2f2f2;
}
.title {
  font-size: 16px;
  color: #333;
  font-weight: 600;
  line-height: 35px;
}
</style>
