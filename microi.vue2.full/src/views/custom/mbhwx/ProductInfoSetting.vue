<template>
  <div class="app-container" v-loading="loading">
    <!-- <div>
      <div class="title title-list">
        {{ tableData.ProductData.Name }}
      </div>
      <div v-for="item in tableData.ProductData.Data" :key="item.Name" class="item-list">
        <el-checkbox v-model="item.checked" @change="handleChecked($event,item)">
          <ul class="item-flex item-ul">
            <el-tooltip class="item" effect="dark" :content="item.Name" placement="top">
              <li>{{ item.Name }}</li>
            </el-tooltip>
            <el-tooltip class="item" effect="dark" :content="item.Data" placement="top">
              <li>{{ item.Data }}</li>
            </el-tooltip>
          </ul>
        </el-checkbox>
      </div>
    </div> -->
    <div v-for="(item,index) in tableData" :key="index">
      <div class=" title-list" v-if="item.Title">
        <ul class="item-ul title item-flex">
          <li v-for="item_title in item.Title" :key="item_title">{{ item_title }}</li>
        </ul>
      </div>
      <div class="item-flex title-list" v-if="item.Name">
        <ul class="item-ul title">
          <li>{{ item.Name }}</li>
        </ul>
      </div>
      <div v-for="item_Data in item.Data" :key="item_Data.Name" class="item-list">
        <el-checkbox v-model="item_Data.checked" @change="handleChecked($event,item)">
          <ul class="item-flex item-ul">
            <li >{{ item_Data.Name }}</li>
            <li v-if="item_Data.TestStandard">{{ item_Data.TestStandard }}</li>
            <!-- <li>{{ item.Condition1 }}</li> -->
            <li >{{ item_Data.Data }}</li>
            <li >{{ item_Data.Unit }}</li>
          </ul>
        </el-checkbox>
      </div>
    </div>
    <div class="item-btn">
      <el-button type="primary" size="medium" @click="handleCheckedSubmit" :loading="loadingBtn">确认</el-button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ProductInfoSetting',
  props: {
    DataAppend:{        
      type: Object,        
      default: () => {}    
    }
  },
  data() {
    return {
      tableData: [],
      Content: [],
      loading: false,
      loadingBtn: false,
    }
  },
  mounted() {
    this.getDetailData()
  },
  methods: {
    // 获取数据
    getDetailData(){
      console.log(this.DataAppend,111)
      this.loading = true
      this.DiyCommon.ApiEngine.Run('GetListShowParameter', {
        Id: this.DataAppend.Id
      }, (result) => {
        if (result.Code == 1) {
          this.loading = false
          this.Content = JSON.parse(result.Data.Content)
          for ( let i in result.Data) {
            if (i != 'Content') {
              this.tableData.push(result.Data[i])
            }
          }
          this.contrastChecked() // 比较是否有选中数据
        } else {
          this.loading = false
          this.$message.error(result.Msg);
        }
      })
    },
    // 比较是否有选中数据
    contrastChecked() {
      this.tableData.forEach((item) => {
        if (item.Data) {
          item.Data.forEach((item_Data) => {
            for (let i = 0; i < this.Content.length; i++) {
              for (let j = 0; j < this.Content[i].length; j++) {
                if (item_Data.Name == this.Content[i][j].k) {
                  item_Data.checked = true
                }
              }
            }
          })
        }
      })
    },
    handleChecked(val,item) {
      console.log(`当前选中: ${val}`,item)
    },
    // 提交选中数据
    handleCheckedSubmit() {
      console.log(this.tableData)
      const arr = []
      // 从this.tableData中获取选中的数据
      this.tableData.forEach((item) => {
        if (item.Data) {
          const data = []
          item.Data.forEach((item_Data) => {
            if (item_Data.checked) {
              data.push({
                k: item_Data.Name,
                v: item_Data.Data,
                u: item_Data.Unit || ''
              })
            }
          })
          if (data.length > 0) {
            arr.push(data)
          }
        }
      })
      console.log(arr,'data')
      if (arr.length == 0) {
        this.$message.warning('请先选择数据');
        return
      }
      this.loadingBtn = true
      this.DiyCommon.ApiEngine.Run('UpdateListShowParameter', {
        Id: this.DataAppend.Id,
        Content: JSON.stringify(arr)
      }, (result) => {
        if (result.Code == 1) {
          this.loadingBtn = false
          this.$message.success(result.Msg);
          this.DataAppend.V8.CloseThisDialog()
        } else {
          this.loadingBtn = false
          this.$message.error(result.Msg);
        }
      })
    }
  }
}
</script>
<style scoped lang="scss">
.app-container {
  padding: 20px;
  background: #fff;
}
.title-list{
  padding-left: 33px;
  background: #ccc;
}

.item-flex{
  display: flex;
}
.item-ul{
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
.item-list{
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
::v-deep .el-checkbox{
  margin: 0;
  width: 100%;
}
::v-deep .el-checkbox__label{
  width: 100% !important;
}
.item-btn{
  text-align: right;
  margin-top: 30px;
}
</style>