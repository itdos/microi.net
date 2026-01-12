<template>
    <div class="project-team">
        <el-card class="box-card">
            <div v-if="teamMembers.length > 0" class="team-grid">
                <div v-for="(member, index) in teamMembers" :key="index" class="member-card">
                    <div class="member-header">
                        <div class="title">{{ member.Zhineng || "未设置人员" }}</div>
                        <!-- <div class="subtitle">{{ member.Zhineng }}</div> -->
                    </div>
                    <div class="member-content" v-for="(item, index) in member.Chengyuan" :key="index">
                        <div class="avatar-wrapper">
                            <el-avatar v-if="item.Avatar" :size="50" :src="DiyCommon.GetFileServer() + item.Avatar"></el-avatar>
                            <el-avatar v-else-if="item.Name" :size="50">{{ item.Name.charAt(0) }}</el-avatar>
                        </div>
                        <div class="member-info">
                            <div class="name">{{ item.Name }}</div>
                            <div class="date">{{ formatDate(item.CreateTime) }}</div>
                            <div class="phone">{{ item.Phone }}</div>
                            <div class="department">{{ formatRoleIds(item.RoleIds) }}</div>
                        </div>
                    </div>
                    <div class="avatar-wrapper-add" @click="selectMember(index)">
                        <el-avatar :size="50" icon="el-icon-plus"></el-avatar>
                    </div>
                </div>
            </div>
            <div v-else class="empty-data">
                <el-empty description="暂无团队成员数据">
                    <!-- <el-button type="primary" @click="selectMember(0)">添加成员</el-button> -->
                </el-empty>
            </div>
        </el-card>

        <el-dialog title="选择团队成员" :visible.sync="dialogVisible" width="500px" :append-to-body="true">
            <div class="member-selection">
                <el-checkbox-group v-model="selectedMemberIds" class="checkbox-grid">
                    <el-checkbox v-for="person in availableMembers" :key="person.Id" :label="person.Id">
                        {{ person.Name }}
                    </el-checkbox>
                </el-checkbox-group>
            </div>
            <span slot="footer" class="dialog-footer">
                <el-button @click="dialogVisible = false">取消</el-button>
                <el-button type="primary" @click="confirmSelection">确定</el-button>
            </span>
        </el-dialog>
    </div>
</template>

<script>
export default {
    name: "ProjectTeam",
    computed: {
        GetCurrentUser: function () {
            return this.$store.getters["DiyStore/GetCurrentUser"];
        }
    },
    data() {
        return {
            teamMembers: [],
            availableMembers: [],
            dialogVisible: false,
            selectedMemberIds: [],
            currentEditIndex: null,
            isAddingNew: false
        };
    },
    created() {
        this.getTeamList();
        this.getAvailableMembers();
    },
    methods: {
        selectMember(index) {
            this.currentEditIndex = index;
            this.isAddingNew = false;
            // 预选当前成员的IDs
            const currentMember = this.teamMembers[index];
            const currentMemberIds = (currentMember.Chengyuan || []).map((member) => member.Id);
            this.selectedMemberIds = currentMemberIds || [];
            this.dialogVisible = true;
        },
        addNewMember() {
            this.isAddingNew = true;
            this.selectedMemberIds = [];
            this.dialogVisible = true;
        },
        async confirmSelection() {
            if (this.selectedMemberIds.length === 0) {
                this.$message.warning("请至少选择一个成员");
                return;
            }

            // 先关闭弹窗
            this.dialogVisible = false;

            if (this.currentEditIndex !== null) {
                // 获取当前职能组
                const currentTeamMember = this.teamMembers[this.currentEditIndex];

                // 保存原始成员数据用于日志记录
                const originalChengyuan = JSON.stringify(currentTeamMember.Chengyuan || []);

                // 将选中的成员数据添加到Chengyuan数组
                const selectedMembers = this.selectedMemberIds.map((id) => {
                    const member = this.availableMembers.find((m) => m.Id === id);
                    return {
                        Id: member.Id,
                        Name: member.Name,
                        Phone: member.Phone,
                        RoleIds: member.RoleIds,
                        Avatar: member.Avatar,
                        Email: member.Email,
                        CreateTime: member.CreateTime
                    };
                });

                // 更新Chengyuan数组
                currentTeamMember.Chengyuan = selectedMembers;

                // 准备数据日志
                const dataLog = [
                    {
                        Name: "Chengyuan",
                        Label: "成员",
                        Component: "MultipleSelect",
                        OVal: originalChengyuan,
                        NVal: JSON.stringify(selectedMembers)
                    }
                ];

                // 提交更新
                await this.updateTeamMember(currentTeamMember, dataLog);
            }

            // 重置选择状态
            this.selectedMemberIds = [];
            this.getTeamList(); // 刷新列表
        },
        formatDate(date) {
            if (!date) return "";
            try {
                // 尝试将日期格式化为年月日
                const dateObj = new Date(date);
                if (isNaN(dateObj.getTime())) return date; // 如果无效日期，返回原值

                const year = dateObj.getFullYear();
                const month = (dateObj.getMonth() + 1).toString().padStart(2, "0");
                const day = dateObj.getDate().toString().padStart(2, "0");

                return `${year}-${month}-${day}`;
            } catch (e) {
                return date || "";
            }
        },
        formatRoleIds(roleIds) {
            if (!roleIds) return "";
            try {
                // 尝试解析JSON字符串
                const roles = typeof roleIds === "string" ? JSON.parse(roleIds) : roleIds;
                // 如果是数组，提取所有Name并用逗号连接
                if (Array.isArray(roles)) {
                    return roles.map((role) => role.Name).join(", ");
                }
                // 如果是单个对象
                else if (roles.Name) {
                    return roles.Name;
                }
                return "";
            } catch (e) {
                // 如果解析失败，返回原始值
                return roleIds;
            }
        },
        // 提交数据
        async updateTeamMember(teamMemberInfo, dataLog) {
            // 将Chengyuan数组转为JSON字符串保存
            const chengyuanJSON = JSON.stringify(teamMemberInfo.Chengyuan || []);

            // 将dataLog转换为字符串
            const dataLogString = JSON.stringify(dataLog);
            const res = await this.DiyCommon.ApiEngine.Run("SaveProjectTeam", {
                id: teamMemberInfo.Id,
                chengyuanJSON: chengyuanJSON,
                dataLogString: dataLogString
            });

            if (res.Code === 1) {
                this.$message.success("保存成功");

                // 刷新当前项目成员数据
                teamMemberInfo.Chengyuan = JSON.parse(chengyuanJSON);
                this.getTeamList(); // 刷新列表
            } else {
                this.$message.error("保存失败，请稍后再试");
            }
        },
        // 获取项目团队列表
        async getTeamList() {
            const res = await this.DiyCommon.FormEngine.GetTableData({
                FormEngineKey: "diy_ProjectTeam",
                _Where: [{ Name: "ProjectId", Value: this.GetCurrentUser.ProjectID, Type: "Equal" }]
            });
            if (res.Code === 1) {
                this.teamMembers = res.Data.map((item) => ({
                    ...item,
                    Chengyuan: JSON.parse(item.Chengyuan)
                }));
                console.log(this.teamMembers);
            }
        },
        // 获取可选成员列表
        async getAvailableMembers() {
            // 获取 DeptCode 的第一个字符
            const deptFirstChar = this.GetCurrentUser.DeptCode ? this.GetCurrentUser.DeptCode.charAt(0) : "";
            const res = await this.DiyCommon.FormEngine.GetTableData({
                FormEngineKey: "Sys_User",
                _Where: [
                    { Name: "DeptCode", Value: deptFirstChar, Type: "Like" },
                    { Name: "State", Value: 1, Type: "Equal" }
                ]
            });
            if (res.Code === 1) {
                this.availableMembers = res.Data;
            }
        }
    }
};
</script>

<style scoped>
.project-team {
    padding: 10px;
}

.team-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
}

.empty-data {
    padding: 40px 0;
    text-align: center;
}

.member-card {
    background: #fff;
    border: 1px solid #ebeef5;
    border-radius: 8px;
    padding: 16px;
    cursor: pointer;
    transition: all 0.3s;
}

.member-card:hover {
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.member-content {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 10px;
}

.avatar-wrapper {
    flex-shrink: 0;
}

.avatar-wrapper :deep(.el-avatar) {
    background-color: #6366f1;
    font-size: 20px;
}

.member-info {
    flex-grow: 1;
}

.member-info .name {
    font-size: 15px;
    font-weight: 500;
    color: #333;
    margin-bottom: 5px;
}

.member-info .date,
.member-info .phone,
.member-info .department {
    font-size: 14px;
    color: #666;
    margin-bottom: 4px;
}

.box-card {
    margin-bottom: 20px;
}

.member-card {
    background: #f2f3f5;
    border-radius: 16px;
    padding: 16px;
}

.avatar-wrapper {
    display: flex;
    justify-content: center;
    margin-bottom: 12px;
    cursor: pointer;
}

.member-info {
    text-align: left;
}

.name {
    font-size: 16px;
    font-weight: 500;
    margin-bottom: 8px;
    color: #333;
}

.role {
    font-size: 14px;
    color: #666;
    margin-bottom: 8px;
}

.contact {
    font-size: 12px;
    color: #999;
    > div {
        margin-bottom: 4px;
    }
}

.member-selection {
    max-height: 400px;
    overflow-y: auto;
}

.member-selection .checkbox-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    padding: 8px;
}

.member-selection .el-checkbox {
    margin-right: 0;
    margin-left: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.dialog-footer {
    margin-top: 20px;
}
.flex {
    display: flex;
}

.member-header {
    margin-bottom: 16px;
    display: flex;
}

.member-header .title {
    font-size: 16px;
    font-weight: 600;
    color: #333;
    margin-right: 4px;
}

.member-header .subtitle {
    font-size: 12px;
    color: #fff;
    background-color: #6a72ff;
    padding: 2px 8px;
    border-radius: 20px;
    display: inline-block;
}

.avatar-wrapper-add {
    cursor: pointer;
    text-align: right;
}
</style>
