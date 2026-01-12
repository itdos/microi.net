<template>
    <div class="test-counter">
        <el-card>
            <div slot="header">
                <span>计数器测试</span>
                <el-button style="float: right; padding: 3px 0" type="text" @click="goHome"> 返回首页 </el-button>
            </div>

            <el-row :gutter="20">
                <el-col :span="12">
                    <div class="counter-display">
                        <h1 class="counter-value">{{ counterValue }}</h1>
                        <p class="counter-label">当前计数值</p>
                    </div>
                </el-col>

                <el-col :span="12">
                    <div class="counter-controls">
                        <el-button-group>
                            <el-button type="primary" size="large" icon="el-icon-minus" @click="handleDecrement" :loading="loading"> 减少 </el-button>
                            <el-button type="primary" size="large" icon="el-icon-plus" @click="handleIncrement" :loading="loading"> 增加 </el-button>
                        </el-button-group>

                        <div style="margin-top: 20px">
                            <el-button type="warning" size="large" icon="el-icon-refresh" @click="handleReset" :loading="loading"> 重置为0 </el-button>
                        </div>

                        <div style="margin-top: 20px">
                            <el-input-number v-model="customValue" :min="-100" :max="100" size="large" placeholder="输入自定义值" />
                            <el-button type="success" size="large" icon="el-icon-check" @click="setCustomValue" :disabled="customValue === null" style="margin-left: 10px"> 设置 </el-button>
                        </div>
                    </div>
                </el-col>
            </el-row>

            <el-divider content-position="left">计数器历史</el-divider>

            <div class="counter-history">
                <el-timeline>
                    <el-timeline-item v-for="(activity, index) in counterHistory" :key="index" :timestamp="activity.timestamp" :type="activity.type">
                        {{ activity.message }}
                    </el-timeline-item>
                </el-timeline>
            </div>

            <el-divider content-position="left">计数器统计</el-divider>

            <el-row :gutter="20">
                <el-col :span="6">
                    <el-statistic title="最大值" :value="maxValue" />
                </el-col>
                <el-col :span="6">
                    <el-statistic title="最小值" :value="minValue" />
                </el-col>
                <el-col :span="6">
                    <el-statistic title="操作次数" :value="operationCount" />
                </el-col>
                <el-col :span="6">
                    <el-statistic title="当前值" :value="counterValue" />
                </el-col>
            </el-row>
        </el-card>
    </div>
</template>

<script>
import { mapGetters, mapActions, mapMutations } from "vuex";

export default {
    name: "TestCounter",
    data() {
        return {
            loading: false,
            customValue: null,
            counterHistory: [],
            maxValue: 0,
            minValue: 0,
            operationCount: 0
        };
    },

    computed: {
        ...mapGetters("test-plugin", ["counterValue"])
    },

    watch: {
        counterValue: {
            handler(newValue, oldValue) {
                this.updateStats(newValue, oldValue);
            },
            immediate: true
        }
    },

    methods: {
        ...mapActions("test-plugin", ["incrementCounter", "decrementCounter", "resetCounter"]),
        ...mapMutations("test-plugin", ["SET_COUNTER"]),

        goHome() {
            this.$router.push("/plugin/test-plugin/home");
        },

        async handleIncrement() {
            this.loading = true;
            try {
                await this.incrementCounter();
                this.addHistory("增加", "success");
            } catch (error) {
                this.$message.error("操作失败");
            } finally {
                this.loading = false;
            }
        },

        async handleDecrement() {
            this.loading = true;
            try {
                await this.decrementCounter();
                this.addHistory("减少", "warning");
            } catch (error) {
                this.$message.error("操作失败");
            } finally {
                this.loading = false;
            }
        },

        async handleReset() {
            this.loading = true;
            try {
                await this.resetCounter();
                this.addHistory("重置", "info");
            } catch (error) {
                this.$message.error("操作失败");
            } finally {
                this.loading = false;
            }
        },

        setCustomValue() {
            if (this.customValue !== null) {
                this.SET_COUNTER(this.customValue);
                this.addHistory(`设置为 ${this.customValue}`, "primary");
                this.customValue = null;
                this.$message.success("设置成功");
            }
        },

        addHistory(message, type) {
            this.counterHistory.unshift({
                message,
                type,
                timestamp: new Date().toLocaleTimeString()
            });

            // 只保留最近10条记录
            if (this.counterHistory.length > 10) {
                this.counterHistory = this.counterHistory.slice(0, 10);
            }
        },

        updateStats(newValue, oldValue) {
            this.operationCount++;

            if (newValue > this.maxValue) {
                this.maxValue = newValue;
            }

            if (newValue < this.minValue) {
                this.minValue = newValue;
            }
        }
    }
};
</script>

<style scoped>
.test-counter {
    padding: 20px;
}

.counter-display {
    text-align: center;
    padding: 40px 0;
}

.counter-value {
    font-size: 4em;
    color: #409eff;
    margin: 0;
    font-weight: bold;
}

.counter-label {
    font-size: 1.2em;
    color: #666;
    margin: 10px 0 0 0;
}

.counter-controls {
    text-align: center;
    padding: 40px 0;
}

.counter-history {
    max-height: 300px;
    overflow-y: auto;
    padding: 20px;
    border: 1px solid #ebeef5;
    border-radius: 4px;
    background-color: #fafafa;
}
</style>
