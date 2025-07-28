<template>
  <div class="plugin-management">
    <el-card>
      <div slot="header">
        <span>插件管理</span>
        <el-button style="float: right; padding: 3px 0" type="text" @click="refreshPlugins"> 刷新 </el-button>
      </div>

      <el-table :data="pluginList" style="width: 100%">
        <el-table-column prop="name" label="插件名称" width="180">
          <template slot-scope="scope">
            <span>{{ scope.row.displayName || scope.row.name }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="description" label="描述" />

        <el-table-column prop="version" label="版本" width="100" />

        <el-table-column prop="author" label="作者" width="120" />

        <el-table-column prop="status" label="状态" width="100">
          <template slot-scope="scope">
            <el-tag :type="scope.row.enabled ? 'success' : 'info'">
              {{ scope.row.enabled ? "已启用" : "已禁用" }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="200">
          <template slot-scope="scope">
            <el-button v-if="!scope.row.enabled" size="mini" type="success" @click="enablePlugin(scope.row)"> 启用 </el-button>
            <el-button v-else size="mini" type="warning" @click="disablePlugin(scope.row)"> 禁用 </el-button>
            <el-button size="mini" type="info" @click="showPluginInfo(scope.row)"> 详情 </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 插件详情对话框 -->
    <el-dialog title="插件详情" :visible.sync="dialogVisible" width="600px">
      <div v-if="currentPlugin">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="插件名称">
            {{ currentPlugin.displayName || currentPlugin.name }}
          </el-descriptions-item>
          <el-descriptions-item label="版本">
            {{ currentPlugin.version }}
          </el-descriptions-item>
          <el-descriptions-item label="作者">
            {{ currentPlugin.author }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="currentPlugin.enabled ? 'success' : 'info'">
              {{ currentPlugin.enabled ? "已启用" : "已禁用" }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="描述" :span="2">
            {{ currentPlugin.description }}
          </el-descriptions-item>
        </el-descriptions>

        <div style="margin-top: 20px">
          <h4>功能特性</h4>
          <el-tag v-for="feature in currentPlugin.features" :key="feature" style="margin-right: 10px; margin-bottom: 10px">
            {{ feature }}
          </el-tag>
        </div>

        <div style="margin-top: 20px">
          <h4>权限要求</h4>
          <el-tag v-for="permission in currentPlugin.permissions" :key="permission" type="warning" style="margin-right: 10px; margin-bottom: 10px">
            {{ permission }}
          </el-tag>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import pluginManager from "@/plugins/plugin-manager";

export default {
  name: "PluginManagement",
  data() {
    return {
      pluginList: [],
      dialogVisible: false,
      currentPlugin: null
    };
  },

  mounted() {
    this.loadPluginList();
  },

  methods: {
    async loadPluginList() {
      try {
        // 这里可以从API获取插件列表，或者从本地配置读取
        this.pluginList = [
          {
            name: "test-plugin",
            displayName: "测试插件",
            description: "这是一个简单的测试插件，用于熟悉插件系统的使用流程。包含计数器、表单和列表等基本功能。",
            version: "1.0.0",
            author: "Your Company",
            enabled: false,
            features: ["计数器功能", "表单处理", "列表管理", "状态管理", "路由导航"],
            permissions: ["test:read", "test:write"]
          }
          // 可以添加更多插件
        ];
      } catch (error) {
        console.error("加载插件列表失败:", error);
        this.$message.error("加载插件列表失败");
      }
    },

    async enablePlugin(plugin) {
      try {
        await pluginManager.registerPlugin(plugin.name, { enabled: true });
        plugin.enabled = true;
        this.$message.success(`插件 ${plugin.displayName} 启用成功`);
      } catch (error) {
        console.error("启用插件失败:", error);
        this.$message.error("启用插件失败");
      }
    },

    async disablePlugin(plugin) {
      try {
        await pluginManager.unregisterPlugin(plugin.name);
        plugin.enabled = false;
        this.$message.success(`插件 ${plugin.displayName} 禁用成功`);
      } catch (error) {
        console.error("禁用插件失败:", error);
        this.$message.error("禁用插件失败");
      }
    },

    showPluginInfo(plugin) {
      this.currentPlugin = plugin;
      this.dialogVisible = true;
    },

    refreshPlugins() {
      this.loadPluginList();
      this.$message.success("插件列表已刷新");
    }
  }
};
</script>

<style scoped>
.plugin-management {
  padding: 20px;
}
</style>
