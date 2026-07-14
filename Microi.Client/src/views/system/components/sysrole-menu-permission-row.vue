<template>
    <div class="role-menu-node">
        <div class="role-menu-row" :style="{ paddingLeft: level * 22 + 'px' }">
            <div class="role-menu-name">
                <button
                    v-if="hasChildren"
                    type="button"
                    class="role-menu-expand"
                    :aria-label="expanded ? '收起当前行' : '展开当前行'"
                    @click="expanded = !expanded"
                >
                    <span :class="['role-menu-expand-arrow', { expanded }]">›</span>
                </button>
                <span v-else class="role-menu-expand-placeholder"></span>
                <label class="role-menu-check">
                    <input type="checkbox" :checked="row._Check === true" @change="emitNameChange" />
                    <i v-if="row.IconClass" :class="['icon', 'mr-2', row.IconClass]"></i>
                    <span>{{ row.Name || row.EnName }}</span>
                </label>
            </div>
            <div class="permission-checkbox-group">
                <label v-for="permission in basePermissions" :key="permission.value" class="perm-cb">
                    <input
                        type="checkbox"
                        :checked="hasPermission(permission.value)"
                        @change="emitPermissionChange($event, permission.value)"
                    />
                    {{ permission.label }}
                </label>
                <label v-for="btn in customButtons" :key="btn.Id" class="perm-cb">
                    <input type="checkbox" :checked="hasPermission(btn.Id)" @change="emitTogglePermission($event, btn.Id)" />
                    {{ btn.Name }}
                </label>
            </div>
        </div>
        <div v-if="hasChildren && expanded" class="role-menu-children">
            <SysroleMenuPermissionRow
                v-for="child in row._Child"
                :key="child.Id"
                :row="child"
                :level="level + 1"
                :permission-labels="permissionLabels"
                @name-change="forwardNameChange"
                @permission-change="forwardPermissionChange"
                @toggle-permission="forwardTogglePermission"
            />
        </div>
    </div>
</template>

<script>
export default {
    name: "SysroleMenuPermissionRow",
    props: {
        row: {
            type: Object,
            required: true
        },
        level: {
            type: Number,
            default: 0
        },
        permissionLabels: {
            type: Object,
            required: true
        }
    },
    emits: ["name-change", "permission-change", "toggle-permission"],
    data() {
        return {
            expanded: false
        };
    },
    computed: {
        hasChildren() {
            return Array.isArray(this.row._Child) && this.row._Child.length > 0;
        },
        basePermissions() {
            return [
                { value: "Add", label: this.permissionLabels.Add },
                { value: "Edit", label: this.permissionLabels.Edit },
                { value: "Del", label: this.permissionLabels.Del },
                { value: "Import", label: this.permissionLabels.Import },
                { value: "Export", label: this.permissionLabels.Export },
                { value: "NoDetail", label: this.permissionLabels.NoDetail },
                { value: "NoSearch", label: this.permissionLabels.NoSearch }
            ];
        },
        customButtons() {
            var result = [];
            var seen = new Set();
            ["MoreBtns", "ExportMoreBtns", "BatchSelectMoreBtns", "PageBtns", "PageTabs", "FormBtns"].forEach((key) => {
                var buttons = this.row[key];
                if (!Array.isArray(buttons)) return;
                buttons.forEach((button) => {
                    if (!button || !button.Id || seen.has(button.Id)) return;
                    seen.add(button.Id);
                    result.push(button);
                });
            });
            return result;
        }
    },
    methods: {
        hasPermission(value) {
            return Array.isArray(this.row.Permission) && this.row.Permission.includes(value);
        },
        emitNameChange(event) {
            this.$emit("name-change", event.target.checked, this.row);
        },
        emitPermissionChange(event, value) {
            this.$emit("permission-change", event.target.checked, this.row, value);
        },
        emitTogglePermission(event, value) {
            this.$emit("toggle-permission", event.target.checked, this.row, value);
        },
        forwardNameChange(checked, row) {
            this.$emit("name-change", checked, row);
        },
        forwardPermissionChange(checked, row, value) {
            this.$emit("permission-change", checked, row, value);
        },
        forwardTogglePermission(checked, row, value) {
            this.$emit("toggle-permission", checked, row, value);
        }
    }
};
</script>
