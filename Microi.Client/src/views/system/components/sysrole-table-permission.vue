<template>
    <section class="mci-table-permission">
        <el-alert
            title="高级直连权限仅用于没有菜单上下文的集成或工具。常规业务表请通过上方菜单权限授权；平台敏感表始终仅限 Level ≥ 9999。"
            type="warning"
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
                placeholder="输入表名或说明，添加直连授权"
                style="width: 100%"
                @change="addTable"
            >
                <el-option
                    v-for="item in tableOptions"
                    :key="item.Id"
                    :label="`${item.Description || item.Name} (${item.Name})`"
                    :value="item.Id"
                    :disabled="isProtectedTable(item.Name)"
                >
                    <span>{{ item.Description || item.Name }}（{{ item.Name }}）</span>
                    <el-tag v-if="isProtectedTable(item.Name)" type="danger" size="small" class="mci-table-permission__protected">
                        平台保护
                    </el-tag>
                </el-option>
            </el-select>
        </div>
        <el-table :data="rows" border stripe empty-text="未配置表直连权限（推荐状态）">
            <el-table-column label="数据表" min-width="260">
                <template #default="{ row }">
                    <div class="mci-table-permission__name">{{ row.Description || row.Name || row.Id }}</div>
                    <div class="mci-table-permission__key">{{ row.Name || row.Id }}</div>
                </template>
            </el-table-column>
            <el-table-column label="允许操作" min-width="330">
                <template #default="{ row }">
                    <el-checkbox-group v-model="row.Permission" @change="emitValue">
                        <el-checkbox value="Read">查</el-checkbox>
                        <el-checkbox value="Add">增</el-checkbox>
                        <el-checkbox value="Edit">改</el-checkbox>
                        <el-checkbox value="Del">删</el-checkbox>
                    </el-checkbox-group>
                </template>
            </el-table-column>
            <el-table-column label="操作" width="90" align="center">
                <template #default="{ $index }">
                    <el-button type="danger" link @click="removeTable($index)">移除</el-button>
                </template>
            </el-table-column>
        </el-table>
    </section>
</template>

<script>
// Keep this explicit bootstrap list in sync with
// Microi.Core/Security/PlatformResourceSecurity.cs. Do not load it from
// diy_table: diy_table is itself a protected resource and must not become the
// authority for deciding which platform tables are protected.
const PROTECTED_TABLES = new Set([
    "sys_osclients",
    "sys_config",
    "sys_apiengine",
    "diy_table",
    "diy_field",
    "sys_menu",
    "sys_role",
    "sys_rolelimit",
    "sys_user",
    "sys_userfk",
    "sys_onlineuser",
    "sys_datasource",
    "diy_schedule_job",
    "diy_schedule_job_log",
    "sys_mq",
    "sys_mqtt",
    "mic_page",
    "mic_print",
    "wf_flowdesign",
    "wf_node",
    "wf_line",
    "microi_database",
    "sys_microiservice",
    "sys_microiservice_page",
    "sys_microistore",
    "sys_microistoreversion",
    "sys_appinstalled",
    "sys_business_blueprint",
    "sys_blueprint_relation",
    "sys_blueprint_history",
    "sys_log",
    "sys_servernode",
    "mic_ai",
    "mic_email_server",
    "wx_mp",
    "mic_micro_app",
    "mic_micro_app_asset",
    "mic_micro_app_version",
    "mci_database_backup",
    "mci_file_remote_connection",
    "mci_redis_connection",
    "mci_license_server",
    "mci_security_access_log",
    "mci_security_attack_event",
    "mci_security_ip_block",
    "mci_spider_account",
    "mci_spider_profile",
    "mci_spider_rule",
    "mci_ai_app",
    "mci_ai_app_file",
    "mci_ai_app_version",
    "mci_ai_data_domain",
    "mci_ai_role_policy"
]);

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
            loadingVersion: 0
        };
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
        isProtectedTable(name) {
            return PROTECTED_TABLES.has(String(name || "").toLowerCase());
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
            this.rows = normalized;
            const ids = normalized.map((item) => item.Id);
            if (!ids.length) return;
            const result = await this.DiyCommon.FormEngine.GetTableData("diy_table", {
                Ids: ids,
                _PageSize: Math.max(ids.length, 20),
                _SelectFields: ["Id", "Name", "Description"]
            });
            if (version !== this.loadingVersion || !result || result.Code !== 1) return;
            const byId = new Map((result.Data || []).map((item) => [item.Id, item]));
            this.rows = normalized
                .map((item) => ({ ...item, ...(byId.get(item.Id) || {}) }))
                .filter((item) => !this.isProtectedTable(item.Name));
        },
        async searchTables(keyword) {
            const text = String(keyword || "").trim();
            if (!text) {
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
            if (!table || this.isProtectedTable(table.Name)) {
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
            this.$emit(
                "update:modelValue",
                this.rows.map((row) => ({
                    Id: row.Id,
                    Permission: JSON.stringify(row.Permission || [])
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

.mci-table-permission__protected {
    float: right;
    margin-left: var(--mci-space-2, 8px);
}
</style>
