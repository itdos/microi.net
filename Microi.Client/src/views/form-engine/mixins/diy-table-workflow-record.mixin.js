function parseJsonObject(value) {
    if (!value) return {};
    if (typeof value === "object") return { ...value };
    try {
        return JSON.parse(value) || {};
    } catch {
        return {};
    }
}

function parseJsonArray(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function isWorkflowTrue(value) {
    return value === true || value === 1 || value === "1" || value === "true" || value === "True";
}

function escapeHtml(value) {
    const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    };
    return String(value || "").replace(/[&<>"']/g, (char) => map[char] || char);
}

export default {
    methods: {
        ResolveWorkflowRecordNodeId(record, workType) {
            const currentUserId = String(this.GetCurrentUser?.Id || "");
            if (workType === "Todo") return record?.NodeId || "";
            if (workType === "Sender") return record?.StartNodeId || "";

            const sourceField = workType === "Done"
                ? "HandlerUsers"
                : workType === "Copy"
                    ? "CopyUsers"
                    : "NotHandlerUsers";
            const matches = parseJsonArray(record?.[sourceField])
                .filter((item) => String(item?.Id || "") === currentUserId && item?.NodeId);
            return matches.length ? matches[matches.length - 1].NodeId : "";
        },

        async ResolveWorkflowRecordWorkModel(record, currentFlowId, currentNodeId, openWorkType) {
            if (record?.WorkState === "Todo") return record;
            if (openWorkType !== "Recall" && openWorkType !== "Cancel") return {};

            const result = await this.DiyCommon.FormEngine.GetFormData({
                FormEngineKey: "WF_Work",
                _Where: [
                    { Name: "WorkState", Value: "Done", Type: "=" },
                    { Name: "ReceiverId", Value: this.GetCurrentUser?.Id, Type: "=" },
                    { Name: "NodeId", Value: currentNodeId, Type: "=" },
                    { Name: "FlowId", Value: currentFlowId, Type: "=" }
                ]
            });
            return result?.Code === 1 && result.Data ? result.Data : {};
        },

        async InitWorkflowRecordDialog(options) {
            const self = this;
            const openFormDialogToken = (self._openFormDialogToken || 0) + 1;
            self._openFormDialogToken = openFormDialogToken;
            if (self._openFormDialogTimer) {
                clearTimeout(self._openFormDialogTimer);
                self._openFormDialogTimer = null;
            }

            self.BtnLoading = true;
            if (typeof self.WarmupDiyFormDialog === "function") {
                await self.WarmupDiyFormDialog();
            }
            self._shouldRenderDiyFormDialog = true;
            await self.$nextTick();

            return new Promise((resolve) => {
                let retryCount = 0;
                const maxRetries = 100;
                const tryInit = () => {
                    if (self._isDestroyed || openFormDialogToken !== self._openFormDialogToken) {
                        self.BtnLoading = false;
                        self._openFormDialogTimer = null;
                        resolve(false);
                        return;
                    }

                    let dialog = self.$refs.refDiyTable_DiyFormDialog;
                    if (Array.isArray(dialog)) dialog = dialog[0];
                    if (dialog && typeof dialog.Init === "function") {
                        dialog.Init({
                            TableId: options.TableId,
                            TableName: "",
                            SysMenuId: "",
                            Id: options.TableRowId,
                            FormMode: options.FormMode,
                            DialogType: "Drawer",
                            IsDefaultOpen: true,
                            IsOpenWorkFlowForm: true,
                            WFParam: options.WFParam
                        });
                        self.BtnLoading = false;
                        self._openFormDialogTimer = null;
                        resolve(true);
                        return;
                    }

                    if (retryCount < maxRetries) {
                        retryCount++;
                        self._openFormDialogTimer = setTimeout(tryInit, 50);
                        return;
                    }

                    console.error("[OpenWorkflowRecord] refDiyTable_DiyFormDialog 始终未挂载，已重试" + maxRetries + "次");
                    self.BtnLoading = false;
                    self._openFormDialogTimer = null;
                    self.DiyCommon.Tips("流程表单加载失败，请稍后重试。", false);
                    resolve(false);
                };

                tryInit();
            });
        },

        /**
         * 从标准 WF_Work / WF_Flow 模块打开其绑定的真实业务表单。
         * 供模块引擎 MoreBtns 调用，避免每个“我的工作”页面重复实现流程抽屉。
         */
        async OpenWorkflowRecord(record, options = {}) {
            const self = this;
            if (!record?.TableId || !record?.TableRowId) {
                self.DiyCommon.Tips("当前流程记录缺少业务表或数据标识。", false);
                return false;
            }

            const workType = String(options.WorkType || (record.WorkState === "Todo" ? "Todo" : "Done"));
            const formMode = options.FormMode || (workType === "Todo" ? "Edit" : "View");
            const openWorkType = options.OpenWorkType || "";
            const rowResult = await self.DiyCommon.FormEngine.GetFormData({
                FormEngineKey: record.TableId,
                Id: record.TableRowId
            });
            if (rowResult?.Code === 2) {
                self.DiyCommon.Tips("此业务数据已删除，无法打开流程。", false);
                self.GetDiyTableRow({ _PageIndex: 1 });
                return false;
            }
            if (!rowResult || rowResult.Code !== 1) {
                self.DiyCommon.Tips(rowResult?.Msg || "业务数据读取失败。", false);
                return false;
            }

            const currentFlowId = workType === "Todo" ? record.FlowId : record.Id;
            const currentNodeId = self.ResolveWorkflowRecordNodeId(record, workType);
            if (!currentFlowId || !currentNodeId || !record.FlowDesignId) {
                self.DiyCommon.Tips("当前流程记录缺少流程、节点或流程图信息。", false);
                return false;
            }
            const workModel = await self.ResolveWorkflowRecordWorkModel(
                record,
                currentFlowId,
                currentNodeId,
                openWorkType
            );
            if ((openWorkType === "Recall" || openWorkType === "Cancel") && !workModel?.Id) {
                self.DiyCommon.Tips("未找到可执行该操作的已办工作记录。", false);
                return false;
            }

            return self.InitWorkflowRecordDialog({
                TableId: record.TableId,
                TableRowId: record.TableRowId,
                FormMode: formMode,
                WFParam: {
                    WorkType: "DoWork",
                    FlowDesignId: record.FlowDesignId,
                    CurrentFlowId: currentFlowId,
                    CurrentNodeId: currentNodeId,
                    WorkModel: workModel || {},
                    FormMode: formMode,
                    OpenWorkType: openWorkType
                }
            });
        },

        async GetWorkflowBatchFormData(workModel) {
            let formData = parseJsonObject(workModel?.FormData);
            if (workModel?.TableId && workModel?.TableRowId) {
                try {
                    const rowResult = await this.DiyCommon.FormEngine.GetFormData({
                        FormEngineKey: workModel.TableId,
                        Id: workModel.TableRowId
                    });
                    if (rowResult?.Code === 1) formData = { ...(rowResult.Data || {}) };
                    if (rowResult?.Code === 2) throw new Error("业务数据已删除");
                } catch (error) {
                    if (Object.keys(formData).length === 0) throw error;
                }
            }
            if (!formData.Id && workModel?.TableRowId) formData.Id = workModel.TableRowId;
            return formData;
        },

        BuildWorkflowBatchNoticeFields(workModel, formData, nodeModel) {
            const noticeFields = [];
            parseJsonArray(nodeModel?.FieldsConfig).forEach((config) => {
                if (config?.Notice === true) {
                    noticeFields.push({
                        Id: config.Id,
                        Name: config.Name,
                        Label: config.Label,
                        Value: formData?.[config.Name] ?? ""
                    });
                }
            });
            if (noticeFields.length) return JSON.stringify(noticeFields);
            if (!workModel?.NoticeFields) return "[]";
            return typeof workModel.NoticeFields === "string"
                ? workModel.NoticeFields
                : JSON.stringify(workModel.NoticeFields);
        },

        async BuildWorkflowBatchApprovalPayload(workModel) {
            const formData = await this.GetWorkflowBatchFormData(workModel);
            const formDataJson = JSON.stringify(formData || {});
            const nodeResult = await this.DiyCommon.PostAsync("/api/WorkFlow/getWFNodeModel", {
                NodeId: workModel.NodeId
            });
            if (!nodeResult || nodeResult.Code !== 1 || !nodeResult.Data) {
                throw new Error(nodeResult?.Msg || "未获取到当前节点");
            }

            const nodeModel = nodeResult.Data;
            let selectUsers = [];
            if (isWorkflowTrue(nodeModel.AllowSelectUsers)) {
                const usersResult = await this.DiyCommon.PostAsync("/api/WorkFlow/getNextNodeConfirmUsers", {
                    NodeId: workModel.NodeId,
                    ApprovalType: "Agree",
                    BackNodeId: "",
                    WorkId: workModel.Id,
                    TableRowId: workModel.TableRowId,
                    FormData: formDataJson
                });
                if (!usersResult || usersResult.Code !== 1) {
                    throw new Error(usersResult?.Msg || "获取下一节点审批人失败");
                }
                selectUsers = (Array.isArray(usersResult.Data?.SelectUsers) ? usersResult.Data.SelectUsers : [])
                    .map((user) => user?.Id)
                    .filter((id, index, list) => id && list.indexOf(id) === index);
                if (!selectUsers.length) throw new Error("节点需要选择审批人，但未找到可选审批人");
            }

            return {
                WorkId: workModel.Id,
                FlowId: workModel.FlowId,
                FormData: formDataJson,
                ApprovalType: "Agree",
                ApprovalIdea: "同意",
                BackNodeId: "",
                NoticeFields: this.BuildWorkflowBatchNoticeFields(workModel, formData, nodeModel),
                AddUsers: [],
                SelectUsers: selectUsers,
                ForceSelectUsers: []
            };
        },

        /** 供模块引擎 BatchSelectMoreBtns 调用。 */
        async BatchApproveWorkflowRecords(records) {
            const self = this;
            const selectedRows = Array.isArray(records) ? records.filter(Boolean) : [];
            if (!selectedRows.length) {
                self.DiyCommon.Tips("请选择要审批的流程。", false);
                return false;
            }
            const rows = selectedRows.filter((row) => (
                String(row?.WorkState || "") === "Todo"
                && String(row?.FlowState || "") !== "Done"
            ));
            const skippedCount = selectedRows.length - rows.length;
            if (!rows.length) {
                self.DiyCommon.Tips("所选流程均已结束或不再处于待办状态。", false);
                return false;
            }

            return new Promise((resolve) => {
                self.DiyCommon.OsConfirm(
                    `确定要批量审批 ${rows.length} 条有效待办吗？${skippedCount ? `（已忽略 ${skippedCount} 条已结束记录）` : ""}`,
                    async () => {
                        self.tableLoading = true;
                        let successCount = 0;
                        const failures = [];
                        for (const workModel of rows) {
                            try {
                                const payload = await self.BuildWorkflowBatchApprovalPayload(workModel);
                                const result = await self.DiyCommon.PostAsync("/api/WorkFlow/sendWork", payload);
                                if (result?.Code === 1) {
                                    successCount++;
                                } else {
                                    failures.push({ Title: workModel.FlowTitle || workModel.Id, Msg: result?.Msg || "审批失败" });
                                }
                            } catch (error) {
                                failures.push({ Title: workModel.FlowTitle || workModel.Id, Msg: error?.message || "审批失败" });
                            }
                        }

                        self.tableLoading = false;
                        self.ResetTableSelection();
                        const summary = `批量审批完成，成功 ${successCount} 条，失败 ${failures.length} 条${skippedCount ? `，忽略已结束 ${skippedCount} 条` : ""}。`;
                        self.DiyCommon.Tips(summary, failures.length === 0, 10);
                        if (failures.length) {
                            let details = failures.slice(0, 5)
                                .map((item) => `${escapeHtml(item.Title)}：${escapeHtml(item.Msg)}`)
                                .join("<br>");
                            if (failures.length > 5) details += `<br>还有 ${failures.length - 5} 条失败未显示`;
                            self.DiyCommon.Tips(`批量审批失败明细：<br>${details}`, false, 15);
                        }
                        self.GetDiyTableRow({ _PageIndex: 1 });
                        resolve({ SuccessCount: successCount, FailureCount: failures.length });
                    },
                    () => resolve(false)
                );
            });
        }
    }
};
