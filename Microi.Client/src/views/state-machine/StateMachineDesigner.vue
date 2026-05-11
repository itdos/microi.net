<template>
    <div class="sm-designer">
        <div class="header">
            <el-button @click="$router.back()">
                <el-icon><Back /></el-icon> 返回
            </el-button>
            <span class="title">状态机设计器</span>
            <div class="spacer"></div>
            <el-button type="primary" @click="save" :loading="saving">
                <el-icon><Check /></el-icon> 保存
            </el-button>
        </div>

        <el-row :gutter="16" style="margin-top:12px;">
            <el-col :span="10">
                <el-card>
                    <template #header>基本信息</template>
                    <el-form :model="form" label-width="100px">
                        <el-form-item label="名称"><el-input v-model="form.Name" placeholder="如：订单状态机" /></el-form-item>
                        <el-form-item label="编码"><el-input v-model="form.Code" placeholder="如：order_sm（唯一）" /></el-form-item>
                        <el-form-item label="绑定表名"><el-input v-model="form.TableName" placeholder="如：mall_order" /></el-form-item>
                        <el-form-item label="状态字段"><el-input v-model="form.StatusField" placeholder="如：Status" /></el-form-item>
                        <el-form-item label="初始状态"><el-input v-model="form.InitialState" placeholder="如：pending" /></el-form-item>
                        <el-form-item label="描述"><el-input v-model="form.Description" type="textarea" :rows="2" /></el-form-item>
                        <el-form-item label="启用">
                            <el-switch v-model="form.Status" :active-value="1" :inactive-value="0" />
                        </el-form-item>
                    </el-form>
                </el-card>
            </el-col>
            <el-col :span="14">
                <el-card>
                    <template #header>
                        <span>状态列表</span>
                        <el-button size="small" type="primary" link @click="addState" style="float:right;">+ 添加状态</el-button>
                    </template>
                    <el-table :data="states" border>
                        <el-table-column label="状态码" width="160">
                            <template #default="{ row }"><el-input v-model="row.code" size="small" placeholder="pending" /></template>
                        </el-table-column>
                        <el-table-column label="显示名" width="160">
                            <template #default="{ row }"><el-input v-model="row.label" size="small" placeholder="待处理" /></template>
                        </el-table-column>
                        <el-table-column label="颜色" width="120">
                            <template #default="{ row }"><el-color-picker v-model="row.color" size="small" /></template>
                        </el-table-column>
                        <el-table-column label="操作" width="80">
                            <template #default="{ $index }">
                                <el-button size="small" link type="danger" @click="states.splice($index,1)">删除</el-button>
                            </template>
                        </el-table-column>
                    </el-table>
                </el-card>

                <el-card style="margin-top:12px;">
                    <template #header>
                        <span>状态流转规则</span>
                        <el-button size="small" type="primary" link @click="addTransition" style="float:right;">+ 添加规则</el-button>
                    </template>
                    <el-table :data="transitions" border>
                        <el-table-column label="名称" width="140">
                            <template #default="{ row }"><el-input v-model="row.Name" size="small" placeholder="确认" /></template>
                        </el-table-column>
                        <el-table-column label="从状态" width="140">
                            <template #default="{ row }">
                                <el-select v-model="row.FromState" size="small" filterable allow-create>
                                    <el-option v-for="s in states" :key="s.code" :value="s.code" :label="s.label || s.code" />
                                </el-select>
                            </template>
                        </el-table-column>
                        <el-table-column label="到状态" width="140">
                            <template #default="{ row }">
                                <el-select v-model="row.ToState" size="small" filterable allow-create>
                                    <el-option v-for="s in states" :key="s.code" :value="s.code" :label="s.label || s.code" />
                                </el-select>
                            </template>
                        </el-table-column>
                        <el-table-column label="动作接口Key" min-width="160">
                            <template #default="{ row }"><el-input v-model="row.ActionApiEngineKey" size="small" placeholder="可选: order_confirm" /></template>
                        </el-table-column>
                        <el-table-column label="角色要求" width="140">
                            <template #default="{ row }"><el-input v-model="row.RequireRole" size="small" placeholder="可选" /></template>
                        </el-table-column>
                        <el-table-column label="操作" width="60">
                            <template #default="{ $index }">
                                <el-button size="small" link type="danger" @click="transitions.splice($index,1)">删除</el-button>
                            </template>
                        </el-table-column>
                    </el-table>
                </el-card>
            </el-col>
        </el-row>
    </div>
</template>

<script>
import { Back, Check } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { StateMachineApi } from "./api.js";

export default {
    name: "StateMachineDesigner",
    components: { Back, Check },
    data() {
        return {
            saving: false,
            form: { Id: "", Name: "", Code: "", TableName: "", StatusField: "Status", InitialState: "", Description: "", Status: 1 },
            states: [],
            transitions: []
        };
    },
    mounted() {
        const id = this.$route.params.id;
        if (id && id !== "new") this.load(id);
    },
    methods: {
        async load(id) {
            const res = await StateMachineApi.get(id);
            if (res.Code !== 1) { ElMessage.error(res.Msg || "加载失败"); return; }
            const d = res.Data || {};
            this.form = { Id: d.Id, Name: d.Name, Code: d.Code, TableName: d.TableName, StatusField: d.StatusField, InitialState: d.InitialState, Description: d.Description, Status: d.Status ?? 1 };
            try { this.states = d.States ? (typeof d.States === "string" ? JSON.parse(d.States) : d.States) : []; } catch { this.states = []; }
            this.transitions = Array.isArray(d.Transitions) ? d.Transitions : [];
        },
        addState() { this.states.push({ code: "", label: "", color: "#409EFF" }); },
        addTransition() { this.transitions.push({ Name: "", FromState: "", ToState: "", ActionApiEngineKey: "", RequireRole: "", Sort: this.transitions.length }); },
        async save() {
            if (!this.form.Name || !this.form.Code) { ElMessage.warning("请填写名称和编码"); return; }
            this.saving = true;
            try {
                const payload = { ...this.form, States: JSON.stringify(this.states), Transitions: this.transitions };
                const res = await StateMachineApi.save(payload);
                if (res.Code === 1) { ElMessage.success("保存成功"); if (!this.form.Id && res.Data?.Id) { this.form.Id = res.Data.Id; this.$router.replace("/state-machine/designer/" + res.Data.Id); } }
                else ElMessage.error(res.Msg || "保存失败");
            } finally { this.saving = false; }
        }
    }
};
</script>

<style scoped>
.sm-designer { padding: 16px; }
.header { display: flex; align-items: center; }
.title { margin-left: 12px; font-weight: 600; font-size: 16px; }
.spacer { flex: 1; }
</style>
