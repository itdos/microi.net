<template>
    <section class="sysrole-ai-policy-panel" v-mci-loading:form="loading">
        <el-alert
            v-if="!available"
            title="当前租户尚未启用 AI 角色策略表，请先完成平台升级或创建 mci_ai_role_policy。"
            type="warning"
            :closable="false"
            show-icon
        />
        <template v-else>
            <el-form :model="model" label-width="120px">
                <el-row :gutter="18">
                    <el-col :span="12" :xs="24">
                        <el-form-item label="启用分析">
                            <el-switch v-model="model.Enabled" :active-value="1" :inactive-value="0" />
                        </el-form-item>
                    </el-col>
                    <el-col :span="12" :xs="24">
                        <el-form-item label="数据范围">
                            <el-select v-model="model.DataScope" style="width: 100%">
                                <el-option label="仅本人数据" value="Self" />
                                <el-option label="本部门数据" value="Department" />
                                <el-option label="本租户数据" value="Tenant" />
                                <el-option label="全部数据" value="All" />
                            </el-select>
                        </el-form-item>
                    </el-col>
                    <el-col :span="24">
                        <el-form-item label="授权业务表">
                            <el-select
                                v-model="model.AllowedDomains"
                                multiple
                                filterable
                                collapse-tags
                                collapse-tags-tooltip
                                :loading="tableLoading"
                                style="width: 100%"
                                placeholder="选择允许 AI 查询的业务表"
                            >
                                <el-option
                                    v-for="item in tableOptions"
                                    :key="item.Name"
                                    :label="`${item.Description || item.Name} (${item.Name})`"
                                    :value="item.Name"
                                />
                            </el-select>
                        </el-form-item>
                    </el-col>
                    <el-col :span="24">
                        <el-form-item label="可用模型">
                            <el-select
                                v-model="model.AllowedModels"
                                multiple
                                collapse-tags
                                collapse-tags-tooltip
                                style="width: 100%"
                                placeholder="请选择角色可用的 AI 模型"
                            >
                                <el-option
                                    v-for="item in modelOptions"
                                    :key="item.Id"
                                    :label="item.Name || item.AiModel"
                                    :value="item.Id"
                                />
                            </el-select>
                        </el-form-item>
                    </el-col>
                    <el-col :span="8" :xs="24">
                        <el-form-item label="单次上限">
                            <el-input-number v-model="model.MaxRows" :min="1" :max="100" controls-position="right" />
                        </el-form-item>
                    </el-col>
                    <el-col :span="8" :xs="24">
                        <el-form-item label="通用查询">
                            <el-switch
                                v-model="model.AllowRawSql"
                                :active-value="1"
                                :inactive-value="0"
                                :disabled="model.DataScope !== 'All'"
                            />
                        </el-form-item>
                    </el-col>
                    <el-col :span="24">
                        <el-alert
                            title="NL2SQL 仅允许“全部数据 + 通用查询”。最终白名单还会与该用户真实菜单/高级表只读权限取交集；带菜单行级范围的表不会交给通用 SQL，请改用经过审核的接口引擎。"
                            type="info"
                            :closable="false"
                            show-icon
                            class="sysrole-ai-policy-panel__alert"
                        />
                    </el-col>
                    <el-col :span="24">
                        <el-form-item label="备注">
                            <el-input v-model="model.Remark" type="textarea" :rows="2" />
                        </el-form-item>
                    </el-col>
                </el-row>
            </el-form>
            <footer class="sysrole-ai-policy-panel__footer">
                <el-button @click="close">取消</el-button>
                <el-button type="primary" :loading="saving" @click="save">保存策略</el-button>
            </footer>
        </template>
    </section>
</template>

<script>
export default {
    name: "SysroleAiPolicyPanel",
    props: {
        DataAppend: { type: Object, default: () => ({}) }
    },
    data() {
        return {
            loading: false,
            saving: false,
            tableLoading: false,
            available: true,
            modelOptions: [],
            tableOptions: [],
            model: {}
        };
    },
    computed: {
        role() {
            return this.DataAppend?.Role || {};
        }
    },
    mounted() {
        this.load();
    },
    methods: {
        parseList(value) {
            if (Array.isArray(value)) return value;
            if (!value) return [];
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                return String(value).split(",").map((item) => item.trim()).filter(Boolean);
            }
        },
        createModel(source) {
            const highPrivilege = Number(this.role.Level || 0) >= 9999;
            return {
                Id: source?.Id || "",
                RoleId: this.role.Id,
                RoleName: this.role.Name,
                Enabled: source?.Enabled === undefined ? 1 : Number(source.Enabled),
                DataScope: source?.DataScope || (highPrivilege ? "All" : "Self"),
                AllowedDomains: this.parseList(source?.AllowedDomains),
                AllowedModels: this.parseList(source?.AllowedModels),
                MaxRows: Number(source?.MaxRows || (highPrivilege ? 100 : 30)),
                AllowRawSql: Number(source?.AllowRawSql || 0),
                Remark: source?.Remark || ""
            };
        },
        async load() {
            if (!this.role.Id) {
                this.available = false;
                return;
            }
            this.loading = true;
            this.tableLoading = true;
            this.available = true;
            this.model = this.createModel();
            try {
                const [policyResult, modelResult, tableResult] = await Promise.all([
                    this.DiyCommon.FormEngine.GetTableData("mci_ai_role_policy", {
                        _Where: [["RoleId", "=", this.role.Id]],
                        _PageIndex: 1,
                        _PageSize: 1
                    }),
                    this.DiyCommon.FormEngine.GetTableData("mic_ai", {
                        _Where: [["IsEnable", "=", "1"]],
                        _OrderBy: "CreateTime",
                        _OrderByType: "DESC",
                        _PageSize: 100
                    }),
                    this.DiyCommon.PostAsync("/api/Ai/GetNl2SqlPolicyTableOptions", {}, null, null, "json")
                ]);
                if (!policyResult || Number(policyResult.Code) !== 1) {
                    this.available = false;
                    return;
                }
                this.modelOptions = modelResult && Number(modelResult.Code) === 1 ? (modelResult.Data || []) : [];
                this.tableOptions = tableResult && Number(tableResult.Code) === 1 ? (tableResult.Data || []) : [];
                this.model = this.createModel((policyResult.Data || [])[0]);
            } catch (error) {
                this.available = false;
            } finally {
                this.loading = false;
                this.tableLoading = false;
            }
        },
        close() {
            if (typeof this.DataAppend?.V8?.CloseThisDialog === "function") {
                this.DataAppend.V8.CloseThisDialog();
            }
        },
        async save() {
            if (!this.model.AllowedDomains.length) {
                this.DiyCommon.Tips("请至少选择一个授权业务表", false);
                return;
            }
            if (!this.model.AllowedModels.length) {
                this.DiyCommon.Tips("请至少选择一个可用模型", false);
                return;
            }
            if (this.model.DataScope !== "All") this.model.AllowRawSql = 0;
            this.saving = true;
            try {
                const payload = {
                    ...this.model,
                    AllowedDomains: JSON.stringify(this.model.AllowedDomains),
                    AllowedModels: JSON.stringify(this.model.AllowedModels)
                };
                const result = payload.Id
                    ? await this.DiyCommon.FormEngine.UptFormData("mci_ai_role_policy", payload)
                    : await this.DiyCommon.FormEngine.AddFormData("mci_ai_role_policy", payload);
                if (result && Number(result.Code) === 1) {
                    this.DiyCommon.Tips("AI数据权限已保存");
                    this.close();
                } else {
                    this.DiyCommon.Tips(result?.Msg || "AI数据权限保存失败", false);
                }
            } catch (error) {
                this.DiyCommon.Tips(error?.message || "AI数据权限保存失败", false);
            } finally {
                this.saving = false;
            }
        }
    }
};
</script>

<style scoped>
.sysrole-ai-policy-panel {
    min-height: 220px;
}

.sysrole-ai-policy-panel__alert {
    margin-bottom: 18px;
}

.sysrole-ai-policy-panel__footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding-top: 8px;
    border-top: 1px solid var(--el-border-color-lighter);
}
</style>
