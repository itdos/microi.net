<template>
    <div class="dependency-demo">
        <el-card>
            <div slot="header">
                <span>依赖管理演示</span>
                <el-tag type="success" style="float: right">独立依赖</el-tag>
            </div>

            <el-row :gutter="20">
                <el-col :span="12">
                    <el-card shadow="hover">
                        <div slot="header">
                            <span>依赖状态检查</span>
                            <el-button type="text" @click="refreshDependencies" style="float: right" icon="el-icon-refresh"> 刷新状态 </el-button>
                        </div>

                        <div class="dependency-status">
                            <el-tag v-for="dep in dependencyStatus" :key="dep.name" :type="dep.available ? 'success' : 'danger'" style="margin: 5px; display: block; text-align: left">
                                {{ dep.name }}: {{ dep.available ? "可用" : "不可用" }}
                                <span v-if="dep.version" style="color: #666">({{ dep.version }})</span>
                            </el-tag>
                        </div>
                    </el-card>
                </el-col>

                <el-col :span="12">
                    <el-card shadow="hover">
                        <div slot="header">
                            <span>功能测试</span>
                        </div>

                        <div class="function-tests">
                            <el-button type="primary" @click="testLodash" :disabled="!isLodashAvailable" style="margin: 5px"> 测试 Lodash </el-button>

                            <el-button type="success" @click="testMoment" :disabled="!isMomentAvailable" style="margin: 5px"> 测试 Moment.js </el-button>
                        </div>
                    </el-card>
                </el-col>
            </el-row>

            <el-divider content-position="left">测试结果</el-divider>

            <el-card shadow="hover">
                <div slot="header">
                    <span>测试输出</span>
                    <el-button type="text" @click="clearResults" style="float: right"> 清空结果 </el-button>
                </div>

                <div class="test-results">
                    <pre v-if="testResults.length > 0">{{ testResults.join("\n") }}</pre>
                    <p v-else style="color: #999; text-align: center">暂无测试结果</p>
                </div>
            </el-card>

            <el-divider content-position="left">依赖管理说明</el-divider>

            <el-alert title="独立依赖管理特性" type="info" :closable="false" show-icon>
                <ul>
                    <li><strong>对等依赖</strong>：使用主项目的依赖包（如 Vue、Element UI、Vue Router、Vuex）</li>
                    <li><strong>外部依赖</strong>：从 CDN 动态加载第三方库（如 Lodash、Moment.js）</li>
                    <li><strong>依赖注入</strong>：插件可以通过依赖注入器获取所需的依赖</li>
                    <li><strong>智能缓存</strong>：避免重复加载相同的依赖</li>
                    <li><strong>降级方案</strong>：依赖加载失败时提供降级处理</li>
                </ul>
            </el-alert>
        </el-card>
    </div>
</template>

<script>
export default {
    name: "DependencyDemo",
    data() {
        return {
            testResults: [],
            dependencyStatus: [
                { name: "Vue", available: false, version: null },
                { name: "Vue Router", available: false, version: null },
                { name: "Vuex", available: false, version: null },
                { name: "Element UI", available: false, version: null },
                { name: "Lodash", available: false, version: null },
                { name: "Moment.js", available: false, version: null }
            ]
        };
    },

    computed: {
        isLodashAvailable() {
            return this.dependencyStatus.find((dep) => dep.name === "Lodash")?.available;
        },
        isMomentAvailable() {
            return this.dependencyStatus.find((dep) => dep.name === "Moment.js")?.available;
        }
    },

    mounted() {
        console.log("组件已挂载，开始检查依赖...");
        console.log("Vue 组件实例:", this);
        console.log("$router:", this.$router);
        console.log("$store:", this.$store);

        // 等待插件完全注册后再检查
        this.waitForPluginRegistration().then(() => {
            // 检查插件系统状态
            this.checkPluginSystemStatus();

            // 检查依赖状态
            this.checkDependencies();
        });
    },

    methods: {
        // 等待插件完全注册
        async waitForPluginRegistration(maxAttempts = 20, interval = 100) {
            const { pluginManager } = require("@/views/plugins");

            for (let i = 0; i < maxAttempts; i++) {
                const registeredPlugins = pluginManager.getRegisteredPlugins();
                if (registeredPlugins.includes("dependency-demo-plugin")) {
                    console.log("插件已注册，继续检查依赖");
                    return Promise.resolve();
                }
                await new Promise((resolve) => setTimeout(resolve, interval));
            }

            console.warn("等待插件注册超时，继续检查依赖");
            return Promise.resolve();
        },

        async checkPluginSystemStatus() {
            try {
                const { pluginManager } = require("@/views/plugins");
                console.log("=== 插件系统状态检查 ===");
                console.log("已注册插件:", pluginManager.getRegisteredPlugins());
                console.log("依赖管理器状态:", pluginManager.getDependencyStats());

                const injector = pluginManager.getPluginDependencyInjector("dependency-demo-plugin");
                if (injector) {
                    console.log("依赖注入器可用");
                    console.log("所有依赖:", injector.getAll());
                } else {
                    console.warn("依赖注入器不可用 - 插件可能未正确初始化");
                }

                const deps = pluginManager.getPluginDependencies("dependency-demo-plugin");
                console.log("插件依赖信息:", deps);
            } catch (error) {
                console.error("无法访问插件系统:", error);
            }
        },

        async checkDependencies() {
            // 尝试从插件系统中获取依赖注入器
            try {
                const { pluginManager } = require("@/views/plugins");
                const injector = pluginManager.getPluginDependencyInjector("dependency-demo-plugin");

                if (injector) {
                    console.log("使用依赖注入器检查依赖状态");

                    // 更新 Vue 相关依赖状态（对等依赖）
                    // 注意：这些依赖通过 Vue 组件系统提供，不一定挂在 window 上
                    this.updateDependencyStatus("Vue", {
                        available: true, // Vue 组件系统本身就能证明 Vue 可用
                        version: "2.7.x (通过组件系统)"
                    });

                    this.updateDependencyStatus("Vue Router", {
                        available: !!this.$router,
                        version: this.$router ? "3.x (通过组件系统)" : "不可用"
                    });

                    this.updateDependencyStatus("Vuex", {
                        available: !!this.$store,
                        version: this.$store ? "3.x (通过组件系统)" : "不可用"
                    });

                    this.updateDependencyStatus("Element UI", {
                        available: !!this.$el.querySelector(".el-button"),
                        version: "2.15.x (通过组件系统)"
                    });

                    // 检查外部依赖
                    this.updateDependencyStatus("Lodash", {
                        available: !!window._ || !!window.lodash,
                        version: window._?.VERSION || window.lodash?.VERSION || "unknown"
                    });

                    this.updateDependencyStatus("Moment.js", {
                        available: !!window.moment || injector.has("moment"),
                        version: window.moment?.version || "unknown"
                    });

                    this.$message.success("依赖状态已刷新");
                    return;
                }
            } catch (error) {
                console.warn("无法获取依赖注入器，使用默认检查方式:", error);
            }

            // 降级到原来的检查方式
            this.checkDependenciesBasic();
        },

        updateDependencyStatus(depName, status) {
            const dep = this.dependencyStatus.find((d) => d.name === depName);
            if (dep) {
                dep.available = status.available;
                dep.version = status.version;
            }
        },

        checkDependenciesBasic() {
            // 检查各种依赖的可用性
            this.dependencyStatus.forEach((dep) => {
                switch (dep.name) {
                    case "Vue":
                        // Vue 通过组件系统提供，组件本身存在就说明Vue可用
                        dep.available = true;
                        dep.version = "2.7.x (通过组件系统)";
                        break;
                    case "Vue Router":
                        // 通过 this.$router 检查
                        dep.available = !!this.$router;
                        dep.version = this.$router ? "3.x (通过组件系统)" : "未启用";
                        break;
                    case "Vuex":
                        // 通过 this.$store 检查
                        dep.available = !!this.$store;
                        dep.version = this.$store ? "3.x (通过组件系统)" : "未启用";
                        break;
                    case "Element UI":
                        // 通过 DOM 元素检查
                        dep.available = !!document.querySelector(".el-button");
                        dep.version = "2.15.x (通过组件系统)";
                        break;
                    case "Lodash":
                        dep.available = !!window.lodash || !!window._;
                        dep.version = window.lodash?.VERSION || window._?.VERSION;
                        break;
                    case "Moment.js":
                        dep.available = !!window.moment;
                        dep.version = window.moment?.version;
                        break;
                }
            });
        },

        // 手动刷新依赖状态
        async refreshDependencies() {
            this.$message.info("正在刷新依赖状态...");
            await this.checkDependencies();
        },

        testLodash() {
            if (window.lodash || window._) {
                const _ = window.lodash || window._;
                const result = _.debounce(() => {
                    this.addResult("Lodash debounce 测试成功");
                }, 300);

                this.addResult("Lodash 可用，版本: " + (_.VERSION || "unknown"));
                this.addResult("测试 debounce 函数...");

                // 模拟多次调用
                for (let i = 0; i < 5; i++) {
                    result();
                }

                setTimeout(() => {
                    this.addResult("debounce 函数执行完成（应该只执行一次）");
                }, 500);
            } else {
                this.addResult("Lodash 不可用");
            }
        },

        testMoment() {
            if (window.moment) {
                const now = window.moment();
                this.addResult("Moment.js 可用，版本: " + window.moment.version);
                this.addResult("当前时间: " + now.format("YYYY-MM-DD HH:mm:ss"));
                this.addResult("相对时间: " + now.fromNow());
                this.addResult("时间戳: " + now.valueOf());
            } else {
                this.addResult("Moment.js 不可用");
            }
        },

        addResult(message) {
            const timestamp = new Date().toLocaleTimeString();
            this.testResults.push(`[${timestamp}] ${message}`);
        },

        clearResults() {
            this.testResults = [];
        }
    }
};
</script>

<style scoped>
.dependency-demo {
    padding: 20px;
}

.dependency-status {
    min-height: 200px;
}

.function-tests {
    min-height: 200px;
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.test-results {
    min-height: 200px;
    max-height: 400px;
    overflow-y: auto;
    background-color: #f5f5f5;
    padding: 15px;
    border-radius: 4px;
}

.test-results pre {
    margin: 0;
    font-family: "Courier New", monospace;
    font-size: 12px;
    line-height: 1.4;
    white-space: pre-wrap;
    word-wrap: break-word;
}

.el-alert ul {
    margin: 10px 0;
    padding-left: 20px;
}

.el-alert li {
    margin: 5px 0;
    line-height: 1.5;
}
</style>
