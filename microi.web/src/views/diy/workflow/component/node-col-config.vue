<template>
  <div style="padding: 10px">
    <div class="title-node">
      <p class="node-txt">字段权限</p>
      <el-input class="node-search" v-model="keyword" placeholder="请输入内容" @input="search"></el-input>
    </div>
    <el-table v-show="showTable" :data="tableData" border style="width: 100%">
      <el-table-column prop="Label" label="">
        <template slot-scope="scope">
          <span :class="scope.row.Label == '全选' ? 'nodeColor' : ''">{{ scope.row.Label }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="Display" label="可见" width="50">
        <template slot-scope="scope">
          <el-checkbox v-model="scope.row.Display" @change="change(scope.row, 'Display')"></el-checkbox>
        </template>
      </el-table-column>
      <el-table-column prop="Edit" label="可编辑" width="60">
        <template slot-scope="scope">
          <el-checkbox v-model="scope.row.Edit" @change="change(scope.row, 'Edit')"></el-checkbox>
        </template>
      </el-table-column>
      <el-table-column prop="Notice" label="通知" width="50">
        <template
          slot-scope="scope"
          v-if="
            scope.row.Component !== 'AutoNumber' &&
            scope.row.Component !== 'TableChild' &&
            scope.row.Component !== 'Guid' &&
            scope.row.Component !== 'Progress' &&
            scope.row.Component !== 'FontAwesome' &&
            scope.row.Component !== 'DevComponent' &&
            scope.row.Component !== 'ImgUpload' &&
            scope.row.Component !== 'FileUpload' &&
            scope.row.Component !== 'Divider' &&
            scope.row.Component !== 'HTML'
          "
        >
          <el-checkbox v-model="scope.row.Notice" @change="change(scope.row, 'Notice')"></el-checkbox>
        </template>
      </el-table-column>
    </el-table>

    <el-table v-show="!showTable" :data="newList" border style="width: 100%">
      <el-table-column prop="Label" label="">
        <template slot-scope="scope">
          <span :class="scope.row.Label == '全选' ? 'nodeColor' : ''">{{ scope.row.Label }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="Display" label="可见" width="50">
        <template slot-scope="scope">
          <el-checkbox v-model="scope.row.Display" @change="change(scope.row, 'Display')"></el-checkbox>
        </template>
      </el-table-column>
      <el-table-column prop="Edit" label="可编辑" width="60">
        <template slot-scope="scope">
          <el-checkbox v-model="scope.row.Edit" @change="change(scope.row, 'Edit')"></el-checkbox>
        </template>
      </el-table-column>
      <el-table-column prop="Notice" label="通知" width="50">
        <template
          slot-scope="scope"
          v-if="
            scope.row.Component !== 'AutoNumber' &&
            scope.row.Component !== 'TableChild' &&
            scope.row.Component !== 'Guid' &&
            scope.row.Component !== 'Progress' &&
            scope.row.Component !== 'FontAwesome' &&
            scope.row.Component !== 'DevComponent' &&
            scope.row.Component !== 'ImgUpload' &&
            scope.row.Component !== 'FileUpload' &&
            scope.row.Component !== 'Divider' &&
            scope.row.Component !== 'HTML'
          "
        >
          <el-checkbox v-model="scope.row.Notice" @change="change(scope.row, 'Notice')"></el-checkbox>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script>
import qs from "qs";
export default {
  name: "node_col_config",
  data() {
    return {
      tableData: [],
      keyword: "",
      newList: [],
      showTable: true,
      https: ""
    };
  },
  mounted() {},
  props: {
    DataAppend: {
      type: Object,
      default: () => {}
    }
  },
  watch: {
    DataAppend(newVal, oldVal) {
      if (newVal != oldVal) {
        this.getFieldList();
      }
    }
  },
  methods: {
    getFieldList() {
      var self = this;
      this.$axios
        .post(
          this.https + "/api/diyfield/getDiyField",
          qs.stringify({
            TableId: this.DataAppend.TableId
          }),
          {
            headers: {
              authorization: "Bearer " + localStorage.getItem("authorization"),
              "content-type": "application/x-www-form-urlencoded",
              did: this.newGuid()
            }
          }
        )
        .then(function (response) {
          if (response.data.Code == 1) {
            self.tableData = response.data.Data.map((item) => {
              return {
                Id: item.Id,
                Name: item.Name,
                Label: item.Label,
                Display: false,
                Edit: false,
                Notice: false,
                Component: item.Component
              };
            });

            self.tableData.unshift({
              Id: "",
              Name: "All",
              Label: "全选",
              Display: false,
              Edit: false,
              Notice: false,
              Component: ""
            });

            // console.log(1111111,self.tableData)
            if (self.DataAppend.Data) {
              var list = JSON.parse(self.DataAppend.Data);

              // console.log(1111111111111111,list)

              self.tableData.map((item) => {
                list.map((ite) => {
                  if (item.Id == ite.Id) {
                    item.Display = ite.Display;
                    item.Edit = ite.Edit;
                    item.Notice = ite.Notice;
                  }
                });
              });
            }
          }
        })
        .catch(function (error) {
          console.log(error);
        });
    },
    newGuid() {
      var guid = "";
      for (var i = 1; i <= 32; i++) {
        var n = Math.floor(Math.random() * 16.0).toString(16);
        guid += n;
        if (i == 8 || i == 12 || i == 16 || i == 20) guid += "-";
      }
      return guid;
    },
    change(e, type) {
      // console.log(3333,e,type)
      if (e.Name == "All") {
        if (e.Display && type == "Display") {
          this.tableData.map((item) => {
            item.Display = true;
          });
        } else if (e.Edit && type == "Edit") {
          this.tableData.map((item) => {
            item.Edit = true;
            item.Display = true;
          });
        } else if (e.Notice && type == "Notice") {
          this.tableData.map((item) => {
            item.Notice = true;
          });
        } else {
          if (!e.Display && type == "Display") {
            this.tableData.map((item) => {
              item.Display = false;
              item.Edit = false;
            });
          }
          if (!e.Edit && type == "Edit") {
            this.tableData.map((item) => {
              item.Edit = false;
            });
          }
          if (!e.Notice && type == "Notice") {
            this.tableData.map((item) => {
              item.Notice = false;
            });
          }
        }
      } else {
        if (type == "Display") {
          this.tableData[0].Display = false;
          if (!e.Display) {
            e.Edit = false;
          }
        }
        if (type == "Edit") {
          this.tableData[0].Edit = false;
          if (e.Edit) {
            e.Display = true;
          }
        }
        if (type == "Notice") {
          this.tableData[0].Notice = false;
        }
      }

      var list = [];
      this.tableData.map((item, i) => {
        if (item.Name !== "All" && (item.Display == true || item.Edit == true || item.Notice == true)) {
          list.push({
            Id: item.Id,
            Name: item.Name,
            Label: item.Label,
            Display: item.Display,
            Edit: item.Edit,
            Notice: item.Notice
          });
        }
      });

      // console.log(22222,list)

      // 提交赋值
      this.$emit("FormSet", "FieldsConfig", JSON.stringify(list));
    },
    search(val) {
      // console.log(val)
      if (val) {
        this.showTable = false;
        var list = this.tableData;
        this.newList = val ? list.filter(this.createStateFilter(val)) : list;
      } else {
        // this.getFieldList()
        this.showTable = true;
      }
    },
    createStateFilter(queryString) {
      return (state) => {
        return state.Label.toLowerCase().indexOf(queryString.toLowerCase()) === 0;
      };
    },
    // 获取系统地址
    getDiyApiBase() {
      if (localStorage.getItem("DiyApiBase")) {
        this.https = localStorage.getItem("DiyApiBase");
      } else {
        this.https = "https://api-china.itdos.com";
      }
    }
  },
  mounted() {
    this.getDiyApiBase();
    this.getFieldList();
  }
};
</script>

<style lang="scss">
.title-node {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.node-txt {
  font-weight: bold;
  white-space: nowrap;
}
.node-search {
  width: 60%;
}
.nodeColor {
  color: #409eff;
}
</style>
