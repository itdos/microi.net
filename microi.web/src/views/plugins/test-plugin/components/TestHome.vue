<template>
  <div class="test-home">
    <el-card>
      <div slot="header">
        <span>测试插件首页</span>
      </div>

      <el-row :gutter="20">
        <el-col :span="8">
          <el-card shadow="hover">
            <div slot="header">
              <span>计数器状态</span>
            </div>
            <div class="counter-display">
              <h2>{{ counterValue }}</h2>
              <p>当前计数值</p>
            </div>
          </el-card>
        </el-col>

        <el-col :span="8">
          <el-card shadow="hover">
            <div slot="header">
              <span>测试列表</span>
            </div>
            <div class="list-info">
              <h3>{{ testListCount }}</h3>
              <p>总项目数</p>
              <el-tag type="success">{{ activeTestItems.length }} 个活跃</el-tag>
              <el-tag type="info">{{ inactiveTestItems.length }} 个非活跃</el-tag>
            </div>
          </el-card>
        </el-col>

        <el-col :span="8">
          <el-card shadow="hover">
            <div slot="header">
              <span>插件信息</span>
            </div>
            <div class="plugin-info">
              <p><strong>插件名称:</strong> 测试插件</p>
              <p><strong>版本:</strong> 1.0.0</p>
              <p><strong>状态:</strong> <el-tag type="success">已启用</el-tag></p>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-divider content-position="left">快速操作</el-divider>

      <el-row :gutter="20">
        <el-col :span="6">
          <el-button type="primary" @click="goToCounter" icon="el-icon-plus"> 计数器测试 </el-button>
        </el-col>
        <el-col :span="6">
          <el-button type="success" @click="goToForm" icon="el-icon-edit"> 表单测试 </el-button>
        </el-col>
        <el-col :span="6">
          <el-button type="warning" @click="resetCounter" icon="el-icon-refresh"> 重置计数器 </el-button>
        </el-col>
        <el-col :span="6">
          <el-button type="info" @click="showPluginInfo" icon="el-icon-info"> 插件详情 </el-button>
        </el-col>
      </el-row>

      <el-divider content-position="left">测试列表</el-divider>

      <el-table :data="testList" style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="status" label="状态" width="100">
          <template slot-scope="scope">
            <el-tag :type="scope.row.status === 'active' ? 'success' : 'info'">
              {{ scope.row.status === "active" ? "活跃" : "非活跃" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template slot-scope="scope">
            <el-button size="mini" type="danger" @click="removeItem(scope.row.id)"> 删除 </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-divider content-position="left">添加测试项目</el-divider>

      <el-form :model="newItem" inline>
        <el-form-item label="名称">
          <el-input v-model="newItem.name" placeholder="输入项目名称" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="newItem.status" placeholder="选择状态">
            <el-option label="活跃" value="active" />
            <el-option label="非活跃" value="inactive" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="addItem" :disabled="!newItem.name"> 添加项目 </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script>
import { mapGetters, mapActions, mapMutations } from "vuex";

export default {
  name: "TestHome",
  data() {
    return {
      newItem: {
        name: "",
        status: "active"
      }
    };
  },

  computed: {
    ...mapGetters("test-plugin", ["counterValue", "testList", "testListCount", "activeTestItems", "inactiveTestItems"])
  },

  methods: {
    ...mapActions("test-plugin", ["resetCounter"]),
    ...mapMutations("test-plugin", ["ADD_TEST_ITEM", "REMOVE_TEST_ITEM"]),

    goToCounter() {
      this.$router.push("/plugin/test-plugin/counter");
    },

    goToForm() {
      this.$router.push("/plugin/test-plugin/form");
    },

    showPluginInfo() {
      this.$message.info("这是一个测试插件，用于熟悉插件系统的使用流程");
    },

    addItem() {
      if (this.newItem.name.trim()) {
        this.ADD_TEST_ITEM({
          name: this.newItem.name,
          status: this.newItem.status
        });
        this.newItem.name = "";
        this.newItem.status = "active";
        this.$message.success("项目添加成功");
      }
    },

    removeItem(id) {
      this.$confirm("确定要删除这个项目吗？", "提示", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      })
        .then(() => {
          this.REMOVE_TEST_ITEM(id);
          this.$message.success("项目删除成功");
        })
        .catch(() => {
          this.$message.info("已取消删除");
        });
    }
  }
};
</script>

<style scoped>
.test-home {
  padding: 20px;
}

.counter-display {
  text-align: center;
}

.counter-display h2 {
  color: #409eff;
  font-size: 2.5em;
  margin: 10px 0;
}

.list-info {
  text-align: center;
}

.list-info h3 {
  color: #67c23a;
  font-size: 2em;
  margin: 10px 0;
}

.list-info .el-tag {
  margin: 5px;
}

.plugin-info p {
  margin: 8px 0;
}
</style>
