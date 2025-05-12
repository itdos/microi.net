<template>
  <div class="tree-box">
    <div class="tree-content">
      <div class="tree-content-left">
        <el-input placeholder="输入关键字进行过滤" v-model="filterText" style="border-radius: 5px"> </el-input>
        <div class="tree">
          <el-tree
            v-loading="loading"
            ref="tree"
            :data="treeData"
            :props="props"
            node-key="id"
            :load="loadNode"
            lazy
            show-checkbox
            check-strictly
            :filter-node-method="filterNode"
            @check="handleCheck"
          >
          </el-tree>
        </div>
      </div>
      <div class="tree-content-right">
        <div class="title">已选择：</div>
        <div class="item">{{ currentNode && currentNode.showName }}</div>
      </div>
    </div>
    <div class="tree-footer">
      <el-button type="primary" @click="submit" :disabled="!currentNode">确定</el-button>
      <el-button @click="cancel">取消</el-button>
    </div>
  </div>
</template>

<script>
/*
V8.OpenDialog({
  ComponentName:'DiyTree',//必传，其余参数可选。组件名称
  Title: '', //定制组件标题
  OpenType:'',//可传：Drawer
  TitleIcon: 'fas fa-plus',//标题左侧的图标
  Width: '70%',
  DataAppend:{//传入自定义附加数据，DataAppend为固定参数名称
    ChangzhanID: '1329393989833072640', //场站ID
    DeviceType: '输变电', //设备类型（例如：输变电）
    EchoField: '' // 表单回写字段
  }
});
*/
import { get } from "../utils/request";
export default {
  name: "DiyTree",
  props: {
    /**
     * 固定接收数据的对象，由V8代码传过来
     */
    DataAppend: {
      type: Object,
      default: () => {}
    }
  },
  watch: {
    filterText(val) {
      this.$refs.tree.filter(val);
    },
    ChangzhanID(newVal, oldVal) {
      // console.log('ChangzhanID', newVal, oldVal);
      this.GETDevice().then((data) => {
        // console.log('GETDevice', data);
        this.loading = false;
        this.dataList = data;
      });
    },
    //监听数据变化
    DataAppend: function (newVal, oldVal) {
      console.log("DataAppend", newVal);
      var self = this;
      if (!self.DosCommon.IsNull(newVal)) {
        if (newVal.hasOwnProperty("DeviceType")) {
          console.log(newVal.DeviceType);
          self.DeviceType = newVal.DeviceType;
        }
        if (!self.DosCommon.IsNull(newVal.ChangzhanID)) {
          self.ChangzhanID = newVal.ChangzhanID;
        }
        if (!self.DosCommon.IsNull(newVal.EchoField)) {
          self.EchoField = newVal.EchoField;
        }
        // self.GETDevice()
      }
    }
  },
  computed: {
    treeData() {
      let arr = [];
      // console.log('DeviceType', this.DeviceType);
      if (this.DeviceType === "all") {
        arr = this.dataList;
      } else {
        arr = this.dataList.filter((item) => {
          return item.elc_nam.includes(this.DeviceType);
        });
      }
      return arr;
    }
  },
  data() {
    return {
      loading: true,
      ChangzhanID: "",
      DeviceType: "",
      EchoField: "",
      filterText: "",
      dataList: [],
      props: {
        label: "showName",
        children: "children"
      },
      count: 1,
      currentNode: null
    };
  },
  mounted() {},
  methods: {
    GETDevice(id = "") {
      return get(`http://10.170.128.39:8082/logicaldevice/findAllDevice?id=${id}&czId=${this.ChangzhanID}`, {
        timeout: 20000
      });
    },
    submit() {
      //回写表单字段值
      console.log(this.EchoField);
      if (this.EchoField) {
        console.log(123123123);
        this.DataAppend.V8.FormSet(this.EchoField, this.currentNode);
        // this.$emit("FormSet", this.EchoField, this.currentNode);
      }
      this.DataAppend.V8.CloseThisDialog();
    },
    cancel() {
      this.DataAppend.V8.CloseThisDialog();
    },
    filterNode(value, data) {
      if (!value) return true;
      return data.label.indexOf(value) !== -1;
    },
    handleCheck(data, checkeds) {
      // console.log('handleCheck', data, checkeds);
      if (checkeds.checkedKeys.length > 1) {
        this.setSelectedNode(data);
      } else {
        if (checkeds.checkedKeys.length === 0) {
          this.currentNode = null;
        } else {
          this.currentNode = data;
        }
      }
    },
    setSelectedNode(data) {
      this.$refs.tree.setCheckedNodes([data]);
      const node = this.$refs.tree.getCheckedNodes();
      this.currentNode = node[0];
      // 更新你的数据模型或存储所选项
    },
    loadNode(node, resolve) {
      // console.log(node);
      if (node.level === 0) {
        return resolve([]);
      }
      this.GETDevice(node.data.id).then((data) => {
        resolve(data);
      });
    },
    RefresfTable() {
      var self = this;
      self.DataAppend.V8.RefreshTable();
      self.DataAppend.V8.CloseThisDialog();
    }
  }
};
</script>

<style lang="scss" scoped>
// scoped 也可以使用scoped，然后使用 /deep/
.tree-box {
  width: 100%;
  height: 500px;

  .tree-content {
    margin: 10px 0;
    display: flex;
    justify-content: space-between;
    height: calc(100% - 50px);

    .tree-content-left,
    .tree-content-right {
      width: calc(50% - 5px);
      height: 100%;
      border-radius: 5px;

      .title {
        width: 100%;
        height: 30px;
        line-height: 28px;
        background: #f7f7f7;
        border-top-left-radius: 4px;
        border-top-right-radius: 4px;
        border-bottom: 1px solid #e6e6e6;
        color: #777;
        font-size: 14px;
        padding: 0 10px;
      }

      .item {
        padding: 5px;
      }
    }

    .tree-content-left {
      margin-right: 5px;
      display: flex;
      flex-direction: column;

      .tree {
        flex: 1;
        margin-top: 10px;
        padding: 5px;
        border: 1px solid #e6e6e6;
        border-radius: 5px;
        overflow: auto;
      }
    }

    .tree-content-right {
      margin-left: 5px;
      border: 1px solid #e6e6e6;
    }
  }

  .tree-footer {
    text-align: right;
  }
}
</style>
