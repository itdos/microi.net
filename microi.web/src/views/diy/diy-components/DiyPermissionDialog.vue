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
         */
        async getFormBtns() {
            var self = this;
            // 获取所有按钮
            self.btnList = self.getAllFormBtns(self.sysMenuModel);

            // 获取所有角色权限
            var result = await self.DiyCommon.PostAsync("/api/SysMenu/GetSysRoleLimitByMenuId", {
                OsClient: self.DiyCommon.GetOsClient(),
                MenuId: self.sysMenuModel.Id
            });
            if (self.DiyCommon.Result(result)) {
                self.roleList = result.Data || [];
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
            let newAllLimits = this.convertPermissionWithNames(this.roleList, this.btnList);
            
            await self.DiyCommon.PostAsync("/api/SysMenu/UpdateSysRoleLimitByMenuId", {
                OsClient: self.DiyCommon.GetOsClient(),
                Type: JSON.stringify(newAllLimits)
            });
            
            this.$message.success("权限已保存！");
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
    margin-bottom: 5px;
}
</style>
