<template>
    <section class="mci-table-permission">
        <el-alert
            :title="policyAlertTitle"
            :type="policyLoadFailed ? 'error' : 'warning'"
            :closable="false"
            show-icon
            class="mci-table-permission__alert"
        />
        <div class="mci-table-permission__picker">
            <el-select
                v-model="pendingTableId"
                filterable
                remote
                clearable
                reserve-keyword
                :remote-method="searchTables"
                :loading="searchLoading"
                :disabled="!policyReady"
                placeholder="输入表名或说明，添加直连授权"
                style="width: 100%"
                @change="addTable"
            >
                <el-option
                    v-for="item in tableOptions"
                    :key="item.Id"
                    :label="`${item.Description || item.Name} (${item.Name})`"
                    :value="item.Id"
                    :disabled="!isTableSelectable(item.Name)"
                >
                    <span>{{ item.Description || item.Name }}（{{ item.Name }}）</span>
                    <el-tag
                        v-if="tablePolicyLabel(item.Name)"
                        :type="tablePolicyTagType(item.Name)"
                        size="small"
                        class="mci-table-permission__policy"
                    >
                        {{ tablePolicyLabel(item.Name) }}
                    </el-tag>
                </el-option>
            </el-select>
        </div>
        <el-table :data="rows" border stripe empty-text="未配置表直连权限（推荐状态）">
            <el-table-column label="数据表" min-width="260">
                <template #default="{ row }">
                    <div class="mci-table-permission__name">{{ row.Description || row.Name || row.Id }}</div>
                    <div class="mci-table-permission__key">{{ row.Name || row.Id }}</div>
                    <el-tag
                        v-if="tablePolicyLabel(row.Name)"
                        :type="tablePolicyTagType(row.Name)"
                        size="small"
                        class="mci-table-permission__row-policy"
                    >
                        {{ tablePolicyLabel(row.Name) }}
                    </el-tag>
                </template>
            </el-table-column>
            <el-table-column label="允许操作" min-width="330">
                <template #default="{ row }">
                    <el-checkbox-group v-model="row.Permission" @change="emitValue">
                        <el-checkbox value="Read" :disabled="!isPermissionAllowed(row.Name, 'Read')">查</el-checkbox>
                        <el-checkbox value="Add" :disabled="!isPermissionAllowed(row.Name, 'Add')">增</el-checkbox>
                        <el-checkbox value="Edit" :disabled="!isPermissionAllowed(row.Name, 'Edit')">改</el-checkbox>
                        <el-checkbox value="Del" :disabled="!isPermissionAllowed(row.Name, 'Del')">删</el-checkbox>
                    </el-checkbox-group>
                </template>
            </el-table-column>
            <el-table-column label="操作" width="90" align="center">
                <template #default="{ $index }">
                    <el-button type="danger" link :disabled="!policyReady" @click="removeTable($index)">移除</el-button>
                </template>
            </el-table-column>
        </el-table>
    </section>
</template>

<script>
const ALL_PERMISSIONS = ["Read", "Add", "Edit", "Del"];
const ADMINISTRATOR_ONLY_MODE = "AdministratorOnly";
const READ_ONLY_MODE = "ReadOnly";
const ROLE_MANAGED_MODE = "RoleManaged";

export default {
    name: "SysroleTablePermission",
    props: {
        modelValue: {
            type: Array,
            default: () => []
        }
    },
    emits: ["update:modelValue"],
    data() {
        return {
            rows: [],
            tableOptions: [],
            pendingTableId: "",
            searchLoading: false,
            loadingVersion: 0,
            policyByTableName: Object.create(null),
            policyReady: false,
            policyLoadFailed: false
        };
    },
    computed: {
        policyAlertTitle() {
            if (this.policyLoadFailed) {
                return "未能读取服务端授权策略，已停止编辑以避免误授权。请刷新页面后重试。";
            }
            return "高级直连权限仅用于没有菜单上下文的集成或工具。打印/页面表按角色授权；运行元数据仅可授予查询；账号、密钥、脚本及基础设施表仍由平台保护。";
        }
    },
    watch: {
        modelValue: {
            immediate: true,
            deep: true,
            handler(value) {
                this.loadRows(value || []);
            }
        }
    },
    mounted() {
        this.loadGrantPolicies();
    },
    methods: {
        parsePermission(value) {
            if (Array.isArray(value)) return value.filter(Boolean);
            if (!value) return ["Read"];
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) && parsed.length ? parsed : ["Read"];
            } catch (error) {
                return ["Read"];
            }
        },
        normalizePolicy(raw) {
            const tableName = raw && (raw.TableName || raw.tableName);
            const mode = raw && (raw.Mode || raw.mode);
            const allowed = raw && (raw.AllowedPermissions || raw.allowedPermissions);
            if (!tableName || !mode) return null;
            return {
                TableName: String(tableName),
                Mode: String(mode),
                AllowedPermissions: Array.isArray(allowed)
                    ? allowed.filter((item) => ALL_PERMISSIONS.includes(item))
                    : []
            };
        },
        async loadGrantPolicies() {
            this.policyReady = false;
            this.policyLoadFailed = false;
            try {
                const result = await this.DiyCommon.PostAsync(
                    "/api/SysRole/GetDirectTableGrantPolicies",
                    {},
                    null,
                    null,
                    "json"
                );
                if (!result || result.Code !== 1 || !Array.isArray(result.Data)) {
                    throw new Error((result && result.Msg) || "授权策略返回格式不正确");
                }
                const policyByTableName = Object.create(null);
                result.Data.forEach((raw) => {
                    const policy = this.normalizePolicy(raw);
                    if (policy) {
                        policyByTableName[policy.TableName.toLowerCase()] = policy;
                    }
                });
                this.policyByTableName = policyByTableName;
                this.policyReady = true;
                this.rows = this.rows.map((row) => this.applyPolicyToRow(row));
            } catch (error) {
                this.policyByTableName = Object.create(null);
                this.policyLoadFailed = true;
                this.tableOptions = [];
                console.error("Microi：加载数据表直连授权策略失败", error);
            }
        },
        getTablePolicy(name) {
            if (!this.policyReady || !name) {
                return {
                    Mode: "Unavailable",
                    AllowedPermissions: [],
                    IsPlatformTable: false
                };
            }
            const platformPolicy = this.policyByTableName[String(name).toLowerCase()];
            if (platformPolicy) {
                return { ...platformPolicy, IsPlatformTable: true };
            }
            return {
                Mode: ROLE_MANAGED_MODE,
                AllowedPermissions: ALL_PERMISSIONS,
                IsPlatformTable: false
            };
        },
        applyPolicyToRow(row) {
            const policy = this.getTablePolicy(row.Name);
            return {
                ...row,
                Permission: (row.Permission || []).filter((permission) =>
                    policy.AllowedPermissions.includes(permission)
                )
            };
        },
        isTableSelectable(name) {
            return this.policyReady
                && this.getTablePolicy(name).Mode !== ADMINISTRATOR_ONLY_MODE;
        },
        isPermissionAllowed(name, permission) {
            return this.policyReady
                && this.getTablePolicy(name).AllowedPermissions.includes(permission);
        },
        tablePolicyLabel(name) {
            const policy = this.getTablePolicy(name);
            if (!policy.IsPlatformTable) return "";
            if (policy.Mode === ADMINISTRATOR_ONLY_MODE) return "平台保护";
            if (policy.Mode === READ_ONLY_MODE) return "仅可授权查询";
            return "按角色授权";
        },
        tablePolicyTagType(name) {
            const mode = this.getTablePolicy(name).Mode;
            if (mode === ADMINISTRATOR_ONLY_MODE) return "danger";
            if (mode === READ_ONLY_MODE) return "warning";
            return "success";
        },
        async loadRows(limits) {
            const version = ++this.loadingVersion;
            const normalized = limits
                .filter((item) => item && (item.Id || item.FkId))
                .map((item) => ({
                    Id: item.Id || item.FkId,
                    Name: item.Name || "",
                    Description: item.Description || "",
                    Permission: this.parsePermission(item.Permission)
                }));
            this.rows = this.policyReady
                ? normalized.map((item) => this.applyPolicyToRow(item))
                : normalized;
            const ids = normalized.map((item) => item.Id);
            if (!ids.length) return;
            const result = await this.DiyCommon.FormEngine.GetTableData("diy_table", {
                Ids: ids,
                _PageSize: Math.max(ids.length, 20),
                _SelectFields: ["Id", "Name", "Description"]
            });
            if (version !== this.loadingVersion || !result || result.Code !== 1) return;
            const byId = new Map((result.Data || []).map((item) => [item.Id, item]));
            const hydrated = normalized
                .map((item) => ({ ...item, ...(byId.get(item.Id) || {}) }));
            this.rows = this.policyReady
                ? hydrated.map((item) => this.applyPolicyToRow(item))
                : hydrated;
        },
        async searchTables(keyword) {
            const text = String(keyword || "").trim();
            if (!this.policyReady || !text) {
                this.tableOptions = [];
                return;
            }
            this.searchLoading = true;
            try {
                const result = await this.DiyCommon.FormEngine.GetTableData("diy_table", {
                    _Where: [
                        ["(", "Name", "Like", text],
                        ["OR", "Description", "Like", text, ")"]
                    ],
                    _PageIndex: 1,
                    _PageSize: 30,
                    _SelectFields: ["Id", "Name", "Description"],
                    _OrderBy: "Description",
                    _OrderByType: "ASC"
                });
                this.tableOptions = result && result.Code === 1 ? result.Data || [] : [];
            } finally {
                this.searchLoading = false;
            }
        },
        addTable(tableId) {
            if (!tableId || this.rows.some((item) => item.Id === tableId)) {
                this.pendingTableId = "";
                return;
            }
            const table = this.tableOptions.find((item) => item.Id === tableId);
            if (!table || !this.isTableSelectable(table.Name)) {
                this.pendingTableId = "";
                return;
            }
            this.rows.push({
                Id: table.Id,
                Name: table.Name,
                Description: table.Description,
                Permission: ["Read"]
            });
            this.pendingTableId = "";
            this.emitValue();
        },
        removeTable(index) {
            this.rows.splice(index, 1);
            this.emitValue();
        },
        emitValue() {
            if (!this.policyReady) return;
            this.$emit(
                "update:modelValue",
                this.rows.map((row) => ({
                    Id: row.Id,
                    Permission: JSON.stringify(
                        (row.Permission || []).filter((permission) =>
                            this.isPermissionAllowed(row.Name, permission)
                        )
                    )
                }))
            );
        }
    }
};
</script>

<style scoped>
.mci-table-permission {
    width: 100%;
}

.mci-table-permission__alert {
    margin-bottom: var(--mci-space-3, 12px);
}

.mci-table-permission__picker {
    margin-bottom: var(--mci-space-3, 12px);
}

.mci-table-permission__name {
    color: var(--mci-text-primary, var(--el-text-color-primary));
    font-weight: 600;
}

.mci-table-permission__key {
    margin-top: 2px;
    color: var(--mci-text-tertiary, var(--el-text-color-secondary));
    font-family: var(--mci-font-mono, monospace);
    font-size: 12px;
}

.mci-table-permission__policy {
    float: right;
    margin-left: var(--mci-space-2, 8px);
}

.mci-table-permission__row-policy {
    margin-top: var(--mci-space-1, 4px);
}
</style>
