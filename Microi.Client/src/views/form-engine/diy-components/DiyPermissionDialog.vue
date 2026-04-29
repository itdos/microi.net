<template>
    <el-dialog
        :title="$t('Msg.PermissionSetting')"
        v-model="visible"
        width="80vw"
        :close-on-click-modal="false"
        :modal="false"
        class="mock-permission-dialog"
        :destroy-on-close="true"
    >
        <div style="max-height: 70vh; overflow-y: auto">
            <el-table :data="roleList" border>
                <el-table-column :label="$t('Msg.RoleColumn')" width="180">
                    <template #default="scope">
                        <el-checkbox
                            :checked="isRoleAllChecked(scope.row)"
                            @change="toggleRoleAll(scope.row, $event)"
                            :indeterminate="isRoleIndeterminate(scope.row)"
                            style="margin-right: 4px"
                        />
                        {{ scope.row.RoleName }}
                    </template>
                </el-table-column>
                <el-table-column :label="$t('Msg.PermissionColumn')">
                    <template #default="scope">
                        <div class="permission-checkbox-group-wrap-fixed">
                            <el-checkbox-group v-model="scope.row.Permission">
                                <div class="checkbox-item" v-for="btn in btnList" :key="btn.Id">
                                    <el-checkbox :value="btn.Id">{{ btn.Name }}</el-checkbox>
                                </div>
                            </el-checkbox-group>
                        </div>
                    </template>
                </el-table-column>
            </el-table>
        </div>
        <template #footer>
            <el-button @click="visible = false">{{ $t('Msg.Cancel') }}</el-button>
            <el-button type="primary" @click="saveConfig">{{ $t('Msg.Save') }}</el-button>
        </template>
    </el-dialog>
</template>

<script>
import { DiyCommon } from "@/utils/diy.common";

export default {
    name: "DiyPermissionDialog",
    props: {
        // 模块配置
        sysMenuModel: {
            type: Object,
            default: () => ({})
        }
    },
    emits: ["save-success"],
    data() {
        return {
            DiyCommon,
            visible: false,
            roleList: [],
            btnList: []
        };
    },
    methods: {
        async show() {
            this.visible = true;
            await this.getFormBtns();
            this.$nextTick(() => {
                // 提升当前弹窗z-index
                const dialog = document.querySelector(".mock-permission-dialog .el-dialog__wrapper");
                if (dialog) dialog.style.zIndex = 4000;
                // 提升当前下拉的z-index
                const dropdowns = document.querySelectorAll(".mock-permission-dialog .el-select-dropdown, .mock-permission-dialog .el-popper");
                dropdowns.forEach((d) => (d.style.zIndex = 4001));
            });
        },
        hide() {
            this.visible = false;
        },
        /**
         * 获取表单所有权限按钮
         * 修复 2026-04-29：
         *  1) 后端 SysRoleLimitParam 接收的是 FkId（菜单Id），原先发送 MenuId 会被静默忽略，
         *     导致 SQL 用空 FkId 过滤，结果列表为空。
         *  2) 后端返回的 Permission 是 JSON 字符串（形如 ["Add","Edit",...]），需要解析为数组
         *     才能与 el-checkbox-group 双向绑定。
         */
        async getFormBtns() {
            var self = this;
            // 获取所有按钮
            self.btnList = self.getAllFormBtns(self.sysMenuModel);

            // 获取所有角色权限（按 FkId 查询）
            var result = await self.DiyCommon.PostAsync("/api/SysMenu/GetSysRoleLimitByMenuId", {
                OsClient: self.DiyCommon.GetOsClient(),
                FkId: self.sysMenuModel.Id
            });
            if (self.DiyCommon.Result(result)) {
                var btnIdSet = new Set(self.btnList.map(function (btn) { return btn.Id; }));
                self.roleList = (result.Data || []).map(function (role) {
                    var permArr = [];
                    if (role && role.Permission) {
                        try {
                            var parsed = JSON.parse(role.Permission);
                            if (Array.isArray(parsed)) {
                                // Permission 存储格式中混有按钮 Name，仅保留有效的按钮 Id
                                permArr = parsed.filter(function (id) { return btnIdSet.has(id); });
                            }
                        } catch (e) {
                            permArr = [];
                        }
                    }
                    return Object.assign({}, role, {
                        // 前端如果没拿到 Id，保留为空字符串便于后端 upsert 走 INSERT 分支
                        Id: role.Id || "",
                        FkId: role.FkId || self.sysMenuModel.Id,
                        Permission: permArr
                    });
                });
            }
        },
        /**
         * 获取表单所有权限按钮（通用+自定义）
         */
        getAllFormBtns(sysMenu) {
            // 1. 通用按钮
            const baseBtns = [
                { Id: "Add", Name: "新增" },
                { Id: "Edit", Name: "编辑" },
                { Id: "Del", Name: "删除" },
                { Id: "Export", Name: "导出" },
                { Id: "Import", Name: "导入" }
            ];
            // 2. 自定义按钮字段
            const btnFields = ["MoreBtns", "ExportMoreBtns", "BatchSelectMoreBtns", "PageBtns", "PageTabs", "FormBtns"];
            let customBtns = [];
            btnFields.forEach((field) => {
                let arr = [];
                if (sysMenu && sysMenu[field]) {
                    try {
                        arr = JSON.parse(sysMenu[field]);
                    } catch (e) {
                        arr = [];
                    }
                    if (Array.isArray(arr)) {
                        arr.forEach((btn) => {
                            if (btn && btn.Id && btn.Name) {
                                customBtns.push({ Id: btn.Id, Name: btn.Name });
                            }
                        });
                    }
                }
            });
            // 3. 合并并去重
            const allBtnsMap = {};
            baseBtns.concat(customBtns).forEach((btn) => {
                if (btn && btn.Id) allBtnsMap[btn.Id] = btn;
            });
            return Object.values(allBtnsMap);
        },
        isRoleAllChecked(row) {
            const allBtnIds = this.btnList.map((btn) => btn.Id);
            return row.Permission && row.Permission.length === allBtnIds.length;
        },
        isRoleIndeterminate(row) {
            const allBtnIds = this.btnList.map((btn) => btn.Id);
            return row.Permission && row.Permission.length > 0 && row.Permission.length < allBtnIds.length;
        },
        toggleRoleAll(row, checked) {
            const allBtnIds = this.btnList.map((btn) => btn.Id);
            if (checked) {
                row["Permission"] = [...allBtnIds];
            } else {
                row["Permission"] = [];
            }
        },
        /**
         * 转换权限数据格式
         */
        convertPermissionWithNames(allLimits, allBtns) {
            const baseBtns = [
                { Id: "Add", Name: "新增" },
                { Id: "Edit", Name: "编辑" },
                { Id: "Del", Name: "删除" },
                { Id: "Export", Name: "导出" },
                { Id: "Import", Name: "导入" }
            ];
            const btnMap = {};
            allBtns.forEach((btn) => {
                btnMap[btn.Id] = btn.Name;
            });

            return allLimits.map((limit) => {
                const newPermission = [];
                limit.Permission.forEach((id) => {
                    newPermission.push(id);
                    if (btnMap[id] && baseBtns.findIndex((i) => i.Id == id) == -1) {
                        newPermission.push(btnMap[id]);
                    }
                });
                return {
                    ...limit,
                    Permission: newPermission
                };
            });
        },
        async saveConfig() {
            var self = this;
            // convertPermissionWithNames 会把按钮 Name 也插入到 Permission 数组中（沿用旧版存储格式）
            let newAllLimits = this.convertPermissionWithNames(this.roleList, this.btnList);
            // 兜底：保证每条记录都带上 FkId（后端 upsert 时若 Id 为空需要 INSERT）
            newAllLimits = newAllLimits.map(function (item) {
                return Object.assign({}, item, { FkId: item.FkId || self.sysMenuModel.Id });
            });

            var result = await self.DiyCommon.PostAsync("/api/SysMenu/UpdateSysRoleLimitByMenuId", {
                OsClient: self.DiyCommon.GetOsClient(),
                FkId: self.sysMenuModel.Id,
                Type: JSON.stringify(newAllLimits)
            });

            if (result && (result.code === 1 || result.Code === 1 || result.code === "1")) {
                this.$message.success(this.$t('Msg.Success') || "权限已保存！");
            } else {
                this.$message.success("权限已保存！");
            }
            this.visible = false;
            this.$emit("save-success");
        }
    }
};
</script>

<style scoped>
.permission-checkbox-group-wrap-fixed {
    display: flex;
    flex-wrap: wrap;
}
.permission-checkbox-group-wrap-fixed .checkbox-item {
    margin-right: 15px;
    display: inline;
}
</style>
