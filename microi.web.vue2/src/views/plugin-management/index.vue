<template>
    <div class="plugin-management">
        <el-card>
            <div slot="header">
                <span>插件管理</span>
                <el-button style="float: right; padding: 3px 0; margin-right: 10px" type="text" @click="resetToDefault"> 重置默认 </el-button>
                <el-button style="float: right; padding: 3px 0" type="text" @click="refreshPlugins"> 刷新 </el-button>
            </div>

            <el-table :data="pluginList" style="width: 100%" v-loading="loading">
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
import { pluginManager, pluginConfigManager, pluginDiscovery, registerAllPlugins } from "@/views/plugins/index.js";

export default {
    name: "PluginManagement",
    data() {
        return {
            pluginList: [],
            dialogVisible: false,
            currentPlugin: null,
            loading: false
        };
    },

    mounted() {
        // 确保插件配置已注册
        registerAllPlugins();
        this.loadPluginList();
    },

    methods: {
        async loadPluginList() {
            this.loading = true;
            try {
                // 扫描插件目录获取所有可用插件
                const availablePlugins = await pluginDiscovery.scanPlugins();

                // 从配置管理器获取启用状态并合并数据
                this.pluginList = availablePlugins.map((plugin) => ({
                    ...plugin,
                    enabled: pluginConfigManager.isPluginEnabled(plugin.name),
                    // 确保所有必要字段都有默认值
                    displayName: plugin.displayName || plugin.name,
                    description: plugin.description || "暂无描述",
                    version: plugin.version || "1.0.0",
                    author: plugin.author || "Unknown",
                    features: plugin.features || [],
                    permissions: plugin.permissions || []
                }));
            } catch (error) {
                console.error("加载插件列表失败:", error);
                this.$message.error("加载插件列表失败");
            } finally {
                this.loading = false;
            }
        },

        async enablePlugin(plugin) {
            try {
                // 启用插件配置
                pluginConfigManager.enablePlugin(plugin.name);

                // 注册插件到插件管理器
                try {
                    await pluginManager.registerPlugin(plugin.name, { enabled: true });
                } catch (registerError) {
                    console.warn(`注册插件 ${plugin.name} 时出现警告:`, registerError);
                    // 即使注册失败，配置已经启用，所以继续执行
                }

                // 更新本地状态
                plugin.enabled = true;

                this.$message.success(`插件 ${plugin.displayName} 启用成功`);

                // 提示用户需要刷新页面以应用路由变化
                this.$confirm("插件已启用，需要刷新页面以应用路由变化。是否立即刷新？", "提示", {
                    confirmButtonText: "刷新",
                    cancelButtonText: "稍后",
                    type: "info"
                })
                    .then(() => {
                        window.location.reload();
                    })
                    .catch(() => {
                        // 用户选择稍后刷新
                    });
            } catch (error) {
                console.error("启用插件失败:", error);
                this.$message.error("启用插件失败");
            }
        },

        async disablePlugin(plugin) {
            try {
                // 禁用插件配置
                pluginConfigManager.disablePlugin(plugin.name);

                // 尝试卸载插件（如果插件在管理器中注册过）
                try {
                    await pluginManager.unregisterPlugin(plugin.name);
                } catch (unregisterError) {
                    // 如果卸载失败，记录日志但不影响禁用流程
                    console.warn(`卸载插件 ${plugin.name} 时出现警告:`, unregisterError);
                }

                // 更新本地状态
                plugin.enabled = false;

                this.$message.success(`插件 ${plugin.displayName} 禁用成功`);

                // 提示用户需要刷新页面以应用路由变化
                this.$confirm("插件已禁用，需要刷新页面以应用路由变化。是否立即刷新？", "提示", {
                    confirmButtonText: "刷新",
                    cancelButtonText: "稍后",
                    type: "info"
                })
                    .then(() => {
                        window.location.reload();
                    })
                    .catch(() => {
                        // 用户选择稍后刷新
                    });
            } catch (error) {
                console.error("禁用插件失败:", error);
                this.$message.error("禁用插件失败");
            }
        },

        showPluginInfo(plugin) {
            this.currentPlugin = plugin;
            this.dialogVisible = true;
        },

        async refreshPlugins() {
            try {
                // 重新注册插件配置
                registerAllPlugins();
                // 重新加载插件列表
                await this.loadPluginList();
                this.$message.success("插件列表已刷新");
            } catch (error) {
                console.error("刷新插件列表失败:", error);
                this.$message.error("刷新插件列表失败");
            }
        },

        async resetToDefault() {
            try {
                await pluginConfigManager.resetAllPluginConfigsToDefault();
                this.$message.success("所有插件配置已重置为默认值");
                // 刷新插件列表以反映新的默认配置
                await this.loadPluginList();
            } catch (error) {
                console.error("重置插件配置失败:", error);
                this.$message.error("重置插件配置失败");
            }
        }
    }
};
</script>

<style scoped>
.plugin-management {
    padding: 20px;
}
</style>
