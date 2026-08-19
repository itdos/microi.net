<template>
    <section class="mci-role-permission-field">
        <el-alert
            title="菜单权限决定可见菜单与表单引擎增删改查；接口引擎等平台控制面仍要求 9999 级管理员。"
            type="warning"
            :closable="false"
            show-icon
            class="mci-role-permission-field__notice"
        />
        <div class="mci-role-permission-field__toolbar">
            <el-input
                v-model="keyword"
                clearable
                placeholder="筛选菜单名称"
                :disabled="loading"
            />
            <el-button :loading="loading" @click="loadPermissions">刷新</el-button>
        </div>
        <el-skeleton v-if="loading" :rows="6" animated />
        <el-alert v-else-if="loadError" :title="loadError" type="error" :closable="false" show-icon />
        <div v-else class="mci-role-permission-field__tree">
            <div class="mci-role-permission-field__header">
                <div>名称</div>
                <div>权限</div>
            </div>
            <SysroleMenuPermissionRow
                v-for="menu in visibleMenus"
                :key="menu.Id"
                :row="menu"
                :permission-labels="permissionLabels"
                :disabled="readonly"
                @name-change="handleNameChange"
                @permission-change="handlePermissionChange"
                @toggle-permission="handleTogglePermission"
            />
            <el-empty v-if="visibleMenus.length === 0" description="没有匹配的菜单" :image-size="64" />
        </div>
    </section>
</template>

<script>
import SysroleMenuPermissionRow from "./sysrole-menu-permission-row.vue";
import { setRoleMenuChecked } from "../utils/sysrole-menu-permission.js";

const BASE_PERMISSION_NAMES = ["Read", "Add", "Edit", "Del", "Export", "Import"];
const BUTTON_GROUPS = ["MoreBtns", "ExportMoreBtns", "BatchSelectMoreBtns", "PageBtns", "PageTabs", "FormBtns"];

export default {
    name: "SysrolePermissionField",
    components: { SysroleMenuPermissionRow },
    props: {
        modelValue: { default: "" },
        FormData: { type: Object, default: () => ({}) },
        FormMode: { type: String, default: "" },
        LoadMode: { type: String, default: "" },
        FieldReadonly: { type: Boolean, default: false },
        ReadonlyFields: { type: Array, default: () => [] },
        field: { type: Object, default: () => ({}) }
    },
    emits: ["update:modelValue", "CallbackFormValueChange"],
    data() {
        return {
            menus: [],
            parentById: Object.create(null),
            keyword: "",
            loading: false,
            loadError: "",
            loadVersion: 0,
            loadedRoleId: null,
            loadPromise: null,
            finishLoad: null
        };
    },
    computed: {
        readonly() {
            return this.FieldReadonly
                || this.FormMode === "View"
                || this.ReadonlyFields.includes(this.field?.Name);
        },
        permissionLabels() {
            return {
                Read: "读取",
                Add: "新增",
                Edit: "编辑",
                Del: "删除",
                Import: "导入",
                Export: "导出"
            };
        },
        visibleMenus() {
            const keyword = String(this.keyword || "").trim().toLowerCase();
            if (!keyword) return this.menus;
            const matchesTree = (row) => String(row.Name || row.EnName || "").toLowerCase().includes(keyword)
                || (row._Child || []).some(matchesTree);
            // 保留原始响应对象，筛选状态下继续编辑时不会把变更写到临时克隆。
            return this.menus.filter(matchesTree);
        }
    },
    watch: {
        "FormData.Id"() {
            this.loadPermissions();
        }
    },
    mounted() {
        this.loadPermissions();
    },
    methods: {
        parsePermissions(value) {
            if (Array.isArray(value)) return value.filter(Boolean);
            if (!value) return [];
            try {
                const result = JSON.parse(value);
                return Array.isArray(result) ? result.filter(Boolean) : [];
            } catch (error) {
                return [];
            }
        },
        initializeMenuTree(rows, parent) {
            (rows || []).forEach((row) => {
                row._Check = false;
                row.Permission = [];
                if (parent) this.parentById[row.Id] = parent;
                if (Array.isArray(row._Child)) this.initializeMenuTree(row._Child, row);
            });
        },
        applyLimits(rows, limitsById) {
            (rows || []).forEach((row) => {
                const limit = limitsById.get(row.Id);
                row._Check = Boolean(limit);
                row.Permission = limit ? this.parsePermissions(limit.Permission) : [];
                if (Array.isArray(row._Child)) this.applyLimits(row._Child, limitsById);
            });
        },
        collectLimits(rows, result) {
            (rows || []).forEach((row) => {
                if (row._Check === true) {
                    const allowed = new Set(BASE_PERMISSION_NAMES);
                    BUTTON_GROUPS.forEach((groupName) => {
                        (row[groupName] || []).forEach((button) => {
                            if (button?.Id) allowed.add(button.Id);
                            if (button?.Name) allowed.add(button.Name);
                        });
                    });
                    const permissions = [];
                    (row.Permission || []).forEach((permission) => {
                        if (!allowed.has(permission) || permissions.includes(permission)) return;
                        permissions.push(permission);
                        BUTTON_GROUPS.forEach((groupName) => {
                            const button = (row[groupName] || []).find((item) => item?.Id === permission);
                            if (button?.Name && !permissions.includes(button.Name)) permissions.push(button.Name);
                        });
                    });
                    result.push({ Id: row.Id, Permission: JSON.stringify(permissions) });
                }
                if (Array.isArray(row._Child)) this.collectLimits(row._Child, result);
            });
            return result;
        },
        emitValue(notifyChange = true) {
            const value = JSON.stringify({ Menu: this.collectLimits(this.menus, []) });
            this.$emit("update:modelValue", value);
            if (notifyChange) {
                this.$emit("CallbackFormValueChange", this.field, value);
            }
            return value;
        },
        async loadPermissions() {
            const roleId = String(this.FormData?.Id || "");
            if (this.loading && this.loadedRoleId === roleId) {
                await this.loadPromise;
                return !this.loadError;
            }
            const version = ++this.loadVersion;
            this.loading = true;
            this.loadPromise = new Promise((resolve) => {
                this.finishLoad = resolve;
            });
            this.loadError = "";
            this.loadedRoleId = roleId;
            try {
                const requests = [
                    this.DiyCommon.PostAsync(this.DiyApi.GetDiyTableRowTree, {
                        TableName: "Sys_Menu",
                        _SelectFields: [
                            "Id", "Name", "IconClass", "ParentId", "Sort", "MoreBtns", "FormBtns",
                            "ExportMoreBtns", "BatchSelectMoreBtns", "PageBtns", "PageTabs"
                        ],
                        _OrderBy: "Sort",
                        _OrderByType: "ASC",
                        _All: true,
                        _TreeLazy: 0
                    })
                ];
                if (roleId) {
                    requests.push(this.DiyCommon.FormEngine.GetTableData("sys_rolelimit", {
                        _Where: [["RoleId", "=", roleId], ["Type", "=", "Menu"]],
                        _SelectFields: ["Id", "FkId", "Permission"],
                        _PageIndex: 1,
                        _PageSize: 5000
                    }));
                }
                const results = await Promise.all(requests);
                if (version !== this.loadVersion) return;
                const menuResult = results[0];
                if (!menuResult || Number(menuResult.Code) !== 1 || !Array.isArray(menuResult.Data)) {
                    throw new Error(menuResult?.Msg || "菜单权限加载失败");
                }
                menuResult.Data.forEach((row) => this.DiyCommon.ForConvertSysMenu(row));
                this.parentById = Object.create(null);
                this.initializeMenuTree(menuResult.Data, null);
                if (roleId && (!results[1] || Number(results[1].Code) !== 1)) {
                    throw new Error(results[1]?.Msg || "角色权限加载失败");
                }
                const limits = roleId ? results[1].Data || [] : [];
                this.applyLimits(menuResult.Data, new Map(limits.map((item) => [item.FkId || item.Id, item])));
                this.menus = menuResult.Data;
                // 初始化只同步虚拟字段值，不应把刚打开的表单标记成“已修改”。
                this.emitValue(false);
            } catch (error) {
                this.loadError = error?.message || "菜单权限加载失败";
            } finally {
                if (version === this.loadVersion) this.loading = false;
                if (this.finishLoad) this.finishLoad();
                this.finishLoad = null;
            }
            return !this.loadError;
        },
        handleNameChange(checked, row) {
            if (this.readonly) return;
            setRoleMenuChecked(row, checked);
            if (checked) {
                let parent = this.parentById[row.Id];
                while (parent) {
                    parent._Check = true;
                    if (!Array.isArray(parent.Permission)) parent.Permission = [];
                    // 父级只承担菜单路径可见性，不把子菜单的增删改权限扩散给父级。
                    if (!parent.Permission.includes("Read")) parent.Permission.push("Read");
                    parent = this.parentById[parent.Id];
                }
            }
            this.emitValue();
        },
        handlePermissionChange(checked, row, permission) {
            if (this.readonly) return;
            if (!Array.isArray(row.Permission)) row.Permission = [];
            if (checked && !row.Permission.includes(permission)) row.Permission.push(permission);
            if (!checked) row.Permission = row.Permission.filter((item) => item !== permission);
            this.propagatePermission(row, permission, checked);
            if (checked) {
                let parent = this.parentById[row.Id];
                while (parent) {
                    parent._Check = true;
                    parent = this.parentById[parent.Id];
                }
            }
            this.emitValue();
        },
        propagatePermission(row, permission, checked) {
            row._Check = checked ? true : row._Check;
            (row._Child || []).forEach((child) => {
                if (!Array.isArray(child.Permission)) child.Permission = [];
                child._Check = true;
                if (checked && !child.Permission.includes(permission)) child.Permission.push(permission);
                if (!checked) child.Permission = child.Permission.filter((item) => item !== permission);
                this.propagatePermission(child, permission, checked);
            });
        },
        handleTogglePermission(checked, row, permission) {
            if (this.readonly) return;
            if (!Array.isArray(row.Permission)) row.Permission = [];
            if (checked && !row.Permission.includes(permission)) row.Permission.push(permission);
            if (!checked) row.Permission = row.Permission.filter((item) => item !== permission);
            if (checked) row._Check = true;
            this.emitValue();
        },
        async flushPendingSync() {
            if (this.loading) {
                try {
                    await this.loadPermissions();
                } catch (error) {
                    return false;
                }
            }
            if (this.loadError) {
                this.DiyCommon.Tips(this.loadError, false);
                return false;
            }
            this.emitValue();
            return true;
        }
    }
};
</script>

<style scoped>
.mci-role-permission-field {
    width: 100%;
    min-width: 0;
}

.mci-role-permission-field__notice {
    margin-bottom: 12px;
}

.mci-role-permission-field__toolbar {
    display: grid;
    grid-template-columns: minmax(220px, 1fr) auto;
    gap: 10px;
    margin-bottom: 10px;
}

.mci-role-permission-field__tree {
    max-height: min(58vh, 680px);
    overflow: auto;
    border: 1px solid var(--el-border-color-light);
    border-radius: 6px;
}

.mci-role-permission-field__header {
    position: sticky;
    top: 0;
    z-index: 2;
    display: grid;
    grid-template-columns: minmax(230px, 36%) 1fr;
    gap: 12px;
    padding: 9px 12px;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-light);
    border-bottom: 1px solid var(--el-border-color-light);
    font-weight: 600;
}

.mci-role-permission-field__tree :deep(.role-menu-row) {
    display: grid;
    grid-template-columns: minmax(230px, 36%) minmax(460px, 1fr);
    min-width: 760px;
    min-height: 42px;
    border-top: 1px solid var(--el-border-color-lighter);
}

.mci-role-permission-field__tree :deep(.role-menu-row:hover) {
    background: var(--el-fill-color-lighter);
}

.mci-role-permission-field__tree :deep(.role-menu-row > div) {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    padding: 7px 12px;
    border-right: 1px solid var(--el-border-color-lighter);
}

.mci-role-permission-field__tree :deep(.role-menu-expand),
.mci-role-permission-field__tree :deep(.role-menu-expand-placeholder) {
    width: 22px;
    min-width: 22px;
    height: 22px;
}

.mci-role-permission-field__tree :deep(.role-menu-expand) {
    padding: 0;
    color: var(--el-text-color-secondary);
    background: transparent;
    border: 0;
    cursor: pointer;
}

.mci-role-permission-field__tree :deep(.role-menu-expand-arrow) {
    display: inline-block;
    font-size: 20px;
    line-height: 20px;
    transition: transform 0.12s ease;
}

.mci-role-permission-field__tree :deep(.role-menu-expand-arrow.expanded) {
    transform: rotate(90deg);
}

.mci-role-permission-field__tree :deep(.role-menu-check),
.mci-role-permission-field__tree :deep(.perm-cb) {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
}

.mci-role-permission-field__tree :deep(.permission-checkbox-group) {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
}

.mci-role-permission-field__tree :deep(.perm-cb) {
    padding: 2px 6px;
    font-size: 13px;
    white-space: nowrap;
    border-radius: 3px;
}

.mci-role-permission-field__tree :deep(input[type="checkbox"]) {
    margin-right: 5px;
    accent-color: var(--el-color-primary);
}

@media (max-width: 767px) {
    .mci-role-permission-field__toolbar {
        grid-template-columns: 1fr;
    }

    .mci-role-permission-field__tree {
        max-height: none;
    }
}
</style>
