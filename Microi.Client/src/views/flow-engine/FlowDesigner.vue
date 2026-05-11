<template>
    <div class="flow-designer">
        <div class="header">
            <el-button @click="$router.back()"><el-icon><Back /></el-icon> 返回</el-button>
            <span class="title">流程设计器</span>
            <div class="spacer"></div>
            <el-button type="primary" @click="save" :loading="saving"><el-icon><Check /></el-icon> 保存</el-button>
        </div>

        <el-row :gutter="16" style="margin-top: 12px;">
            <el-col :span="8">
                <el-card>
                    <template #header>基本信息</template>
                    <el-form :model="form" label-width="100px">
                        <el-form-item label="名称"><el-input v-model="form.Name" placeholder="如：订单超时取消" /></el-form-item>
                        <el-form-item label="编码"><el-input v-model="form.Code" placeholder="如：order_timeout_cancel" /></el-form-item>
                        <el-form-item label="触发类型">
                            <el-select v-model="form.TriggerType" style="width: 100%;">
                                <el-option label="手动 (manual)" value="manual" />
                                <el-option label="定时 (cron)" value="cron" />
                                <el-option label="Webhook" value="webhook" />
                                <el-option label="消息队列 (mq)" value="mq" />
                                <el-option label="状态变更 (state-change)" value="state-change" />
                                <el-option label="API 调用" value="api" />
                            </el-select>
                        </el-form-item>
                        <el-form-item label="触发配置">
                            <el-input v-model="form.TriggerConfig" type="textarea" :rows="3"
                                placeholder='JSON, 如 {"cron":"0 */5 * * * ?"}' />
                        </el-form-item>
                        <el-form-item label="描述"><el-input v-model="form.Description" type="textarea" :rows="2" /></el-form-item>
                        <el-form-item label="最大重试"><el-input-number v-model="form.MaxRetry" :min="0" :max="10" /></el-form-item>
                        <el-form-item label="超时(秒)"><el-input-number v-model="form.Timeout" :min="0" :max="3600" /></el-form-item>
                        <el-form-item label="启用">
                            <el-switch v-model="form.Status" :active-value="1" :inactive-value="0" />
                        </el-form-item>
                    </el-form>
                </el-card>
            </el-col>

            <el-col :span="16">
                <el-card>
                    <template #header>
                        <span>步骤节点（DAG）</span>
                        <el-dropdown @command="addNode" style="float:right;">
                            <el-button size="small" type="primary">+ 添加节点 <el-icon><ArrowDown /></el-icon></el-button>
                            <template #dropdown>
                                <el-dropdown-menu>
                                    <el-dropdown-item command="start">开始 (start)</el-dropdown-item>
                                    <el-dropdown-item command="end">结束 (end)</el-dropdown-item>
                                    <el-dropdown-item command="set">变量赋值 (set)</el-dropdown-item>
                                    <el-dropdown-item command="if">条件分支 (if)</el-dropdown-item>
                                    <el-dropdown-item command="delay">延迟 (delay)</el-dropdown-item>
                                    <el-dropdown-item command="sql">SQL 查询 (sql)</el-dropdown-item>
                                    <el-dropdown-item command="http">HTTP 请求 (http)</el-dropdown-item>
                                    <el-dropdown-item command="apiengine">接口引擎 (apiengine)</el-dropdown-item>
                                    <el-dropdown-item command="log">日志 (log)</el-dropdown-item>
                                </el-dropdown-menu>
                            </template>
                        </el-dropdown>
                    </template>

                    <el-table :data="nodes" border>
                        <el-table-column label="节点ID" width="120">
                            <template #default="{ row }"><el-input v-model="row.id" size="small" placeholder="n1" /></template>
                        </el-table-column>
                        <el-table-column label="类型" width="110">
                            <template #default="{ row }"><el-tag>{{ row.type }}</el-tag></template>
                        </el-table-column>
                        <el-table-column label="名称" width="140">
                            <template #default="{ row }"><el-input v-model="row.label" size="small" /></template>
                        </el-table-column>
                        <el-table-column label="配置 (JSON)" min-width="280">
                            <template #default="{ row }">
                                <el-input v-model="row.configText" size="small" type="textarea" :rows="2"
                                    :placeholder="placeholderFor(row.type)" @blur="syncConfig(row)" />
                            </template>
                        </el-table-column>
                        <el-table-column label="下一节点" min-width="160">
                            <template #default="{ row }">
                                <el-select v-model="row.nextNodeIds" size="small" multiple filterable allow-create
                                    placeholder="选择下一节点">
                                    <el-option v-for="n in nodes.filter(x => x.id !== row.id)" :key="n.id"
                                        :value="n.id" :label="(n.id + ' - ' + (n.label || n.type))" />
                                </el-select>
                            </template>
                        </el-table-column>
                        <el-table-column label="操作" width="80">
                            <template #default="{ $index }">
                                <el-button size="small" link type="danger" @click="nodes.splice($index, 1)">删除</el-button>
                            </template>
                        </el-table-column>
                    </el-table>

                    <div style="margin-top:12px;">
                        <el-alert type="info" :closable="false">
                            <p>提示：每个节点必须有唯一的 id。开始节点通常类型为 <code>start</code>，结束节点类型为 <code>end</code>。</p>
                            <p>配置示例：</p>
                            <ul>
                                <li><code>set</code>: {"vars":{"orderId":"$input.id"}}</li>
                                <li><code>if</code>: {"condition":"input.amount > 100", "trueNext":"n3", "falseNext":"n4"}</li>
                                <li><code>sql</code>: {"sql":"SELECT * FROM mall_order WHERE Id=@p0", "params":["$input.id"], "outputVar":"order"}</li>
                                <li><code>http</code>: {"method":"POST", "url":"https://...", "body":{...}, "outputVar":"resp"}</li>
                                <li><code>apiengine</code>: {"key":"order_assign", "params":{...}}</li>
                                <li><code>delay</code>: {"ms":1000}</li>
                            </ul>
                        </el-alert>
                    </div>
                </el-card>
            </el-col>
        </el-row>
    </div>
</template>

<script>
import { Back, Check, ArrowDown } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { FlowApi } from "./api.js";

export default {
    name: "FlowDesigner",
    components: { Back, Check, ArrowDown },
    data() {
        return {
            saving: false,
            form: { Id: "", Name: "", Code: "", TriggerType: "manual", TriggerConfig: "", Description: "", Status: 1, MaxRetry: 0, Timeout: 60 },
            nodes: []
        };
    },
    mounted() {
        const id = this.$route.params.id;
        if (id && id !== "new") this.load(id);
        else this.addNode("start");
    },
    methods: {
        async load(id) {
            const res = await FlowApi.get(id);
            if (res.Code !== 1) { ElMessage.error(res.Msg || "加载失败"); return; }
            const d = res.Data || {};
            this.form = {
                Id: d.Id, Name: d.Name, Code: d.Code,
                TriggerType: d.TriggerType || "manual",
                TriggerConfig: d.TriggerConfig || "",
                Description: d.Description || "",
                Status: d.Status ?? 1,
                MaxRetry: d.MaxRetry ?? 0,
                Timeout: d.Timeout ?? 60
            };
            let fd = {};
            try { fd = d.FlowData ? (typeof d.FlowData === "string" ? JSON.parse(d.FlowData) : d.FlowData) : {}; } catch { fd = {}; }
            const arr = Array.isArray(fd.nodes) ? fd.nodes : [];
            this.nodes = arr.map(n => ({
                id: n.id || "",
                type: n.type || "set",
                label: n.label || "",
                config: n.config || {},
                configText: JSON.stringify(n.config || {}, null, 0),
                nextNodeIds: Array.isArray(n.nextNodeIds) ? n.nextNodeIds : (n.nextNodeId ? [n.nextNodeId] : [])
            }));
        },
        addNode(type) {
            const idx = this.nodes.length + 1;
            const defaults = {
                start: {}, end: {}, set: { vars: {} }, if: { condition: "", trueNext: "", falseNext: "" },
                delay: { ms: 1000 }, sql: { sql: "", params: [], outputVar: "" },
                http: { method: "GET", url: "", body: null, outputVar: "" },
                apiengine: { key: "", params: {} }, log: { message: "" }
            };
            const cfg = defaults[type] || {};
            this.nodes.push({
                id: "n" + idx, type, label: type, config: cfg,
                configText: JSON.stringify(cfg, null, 0), nextNodeIds: []
            });
        },
        syncConfig(row) {
            try { row.config = JSON.parse(row.configText || "{}"); }
            catch { ElMessage.warning("节点 " + row.id + " 配置 JSON 解析失败"); }
        },
        placeholderFor(type) {
            const samples = {
                start: "{}", end: "{}", set: '{"vars":{"k":"v"}}',
                if: '{"condition":"input.x>1","trueNext":"n2","falseNext":"n3"}',
                delay: '{"ms":1000}', sql: '{"sql":"...","params":[],"outputVar":"r"}',
                http: '{"method":"POST","url":"..."}', apiengine: '{"key":"...","params":{}}',
                log: '{"message":"..."}'
            };
            return samples[type] || "{}";
        },
        async save() {
            if (!this.form.Name || !this.form.Code) { ElMessage.warning("请填写名称和编码"); return; }
            this.nodes.forEach(n => this.syncConfig(n));
            const flowData = { nodes: this.nodes.map(n => ({ id: n.id, type: n.type, label: n.label, config: n.config, nextNodeIds: n.nextNodeIds })) };
            const payload = { ...this.form, FlowData: JSON.stringify(flowData) };
            this.saving = true;
            try {
                const res = await FlowApi.save(payload);
                if (res.Code === 1) {
                    ElMessage.success("保存成功");
                    if (!this.form.Id && res.Data?.Id) { this.form.Id = res.Data.Id; this.$router.replace("/flow-engine/designer/" + res.Data.Id); }
                } else ElMessage.error(res.Msg || "保存失败");
            } finally { this.saving = false; }
        }
    }
};
</script>

<style scoped>
.flow-designer { padding: 16px; }
.header { display: flex; align-items: center; }
.title { margin-left: 12px; font-weight: 600; font-size: 16px; }
.spacer { flex: 1; }
code { background: #f5f7fa; padding: 1px 4px; border-radius: 3px; }
</style>
