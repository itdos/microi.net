using Dos.ORM;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class WorkFlowLogic // : WorkFlow
    {
        /// <summary>
        /// 保存流程设计图。传入_WFFlowDesign、_WFListList、_WFNodeList
        /// </summary>
        /// <returns></returns>
        public async Task<DosResult> SaveWFFlowDesign(WFParam param)
        {
            #region Check

            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyToken.GetCurrentOsClient();
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "OsClientNotNull", param._Lang));
            }
            if (param._CurrentUser == null)
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            #endregion

            if (param._WFFlowDesign == null || param._WFLineList == null || param._WFNodeList == null
                || !param._WFNodeList.Any() || !param._WFLineList.Any())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            //判断传入的NodeList是否有已经删除了的？

            #region 判断每条线是否存在前后已删除的节点。也就是判断是否存在脏数据线。
            var lineAllNodeList = new List<string>();
            foreach (var line in param._WFLineList)
            {
                if (!lineAllNodeList.Any(d => d.ToLower() == line.FromNodeId.ToLower()))
                {
                    lineAllNodeList.Add(line.FromNodeId);
                }
                if (!lineAllNodeList.Any(d => d.ToLower() == line.ToNodeId.ToLower()))
                {
                    lineAllNodeList.Add(line.ToNodeId);
                }
            }
            var selectWFResult = await MicroiEngine.FormEngine.GetTableDataAsync<WFNode>(new DiyTableRowParam()
            {
                TableName = "WF_Node",
                _Where = new List<List<object>>()
                {
                    new List<object> { "Id", "In", lineAllNodeList}
                },
                _CurrentUser = param._CurrentUser,
                OsClient = param.OsClient,
            });
            if (selectWFResult.Code != 1)
            {
                return new DosResult(0, null, selectWFResult.Msg);
            }
            foreach (var nodeId in lineAllNodeList)
            {
                if (selectWFResult.Data == null || !selectWFResult.Data.Any(d => d.Id == nodeId))
                {
                    //需要删除此node对应的所有线
                    var lines = param._WFLineList.Where(d => d.FromNodeId == nodeId || d.ToNodeId == nodeId).ToList();
                    var delLinesResult = await MicroiEngine.FormEngine.DelFormDataAsync(new DiyTableRowParam()
                    {
                        TableName = "WF_Line",
                        
                        _CurrentUser = param._CurrentUser,
                        OsClient = param.OsClient,
                        Ids = lines.Select(d => d.Id).ToList()
                    });
                    if (delLinesResult.Code != 1)
                    {
                        return new DosResult(0, null, delLinesResult.Msg);
                    }
                }
            }
            #endregion

            if (!param._WFNodeList.Any(d => d.NodeType == "Start"))
            {
                return new DosResult(0, null, "不存在开始节点！");
            }
            if (!param._WFNodeList.Any(d => d.NodeType == "End" || d.NodeType == "AutoEnd"))
            {
                return new DosResult(0, null, "不存在结束节点！");
            }

            return new DosResult(1);
        }
        /// <summary>
        /// 删除节点
        /// </summary>
        /// <returns></returns>
        public async Task<DosResult> DelWFNode()
        {
            return new DosResult();
        }
        /// <summary>
        /// 传入NodeId
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult<dynamic>> GetWFNodeModel(WFParam param)
        {
            if (param.NodeId == null)
            {
                return new DosResult<dynamic>(0, null, "请传入节点Id！");
            }
            var nodeModelResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(new DiyTableRowParam()
            {
                TableName = "WF_Node",
                Id = param.NodeId,
                //_SearchEqual = new Dictionary<string, string>() {
                //    { "IsDeleted", ""},
                //},
                
                _CurrentUser = param._CurrentUser,
                OsClient = param.OsClient,
            });
            if (nodeModelResult.Code != 1)
            {
                return nodeModelResult;
            }
            return new DosResult<dynamic>(1, nodeModelResult.Data);
        }

        /// <summary>
        /// 获取工作，包含：我的待办、我发起的、我处理的、我相关的、抄送我的
        /// 传入：WorkType（Todo/Sender/Done//）
        /// </summary>
        /// <returns></returns>
        public async Task<DosResultList<WFWork>> GetWFWork(WFParam param)
        {
            if (param._CurrentUser == null)
            {
                return new DosResultList<WFWork>(0, null, "参数错误！");
            }
            var searchParam = new DiyTableRowParam()
            {
                TableName = "WF_Work",
                _PageIndex = param._PageIndex,
                _PageSize = param._PageSize,
                // _Keyword = param._Keyword,
                IsDeleted = 0,
                OsClient = param.OsClient,
                
                _CurrentUser = param._CurrentUser,
            };
            var _where = new List<DiyWhere>();
            if (!param._Keyword.DosIsNullOrWhiteSpace())
            {
                _where.Add(new DiyWhere()
                {
                    GroupStart = true,
                    Name = "FlowTitle",
                    Value = param._Keyword,
                    Type = "Like"
                });
                _where.Add(new DiyWhere()
                {
                    AndOr = "OR",
                    Name = "NoticeFields",
                    Value = param._Keyword,
                    Type = "Like"
                });
                _where.Add(new DiyWhere()
                {
                    AndOr = "OR",
                    Name = "NodeName",
                    Value = param._Keyword,
                    Type = "Like"
                });
                _where.Add(new DiyWhere()
                {
                    AndOr = "OR",
                    Name = "Receiver",
                    Value = param._Keyword,
                    Type = "Like"
                });
                _where.Add(new DiyWhere()
                {
                    AndOr = "OR",
                    GroupEnd = true,
                    Name = "Sender",
                    Value = param._Keyword,
                    Type = "Like"
                });
                searchParam._Where = _where;
            }
            //我的待办
            if (param.WorkType == "Todo")
            {
                searchParam._SearchEqual = new Dictionary<string, string>() {
                    { "ReceiverId", param._CurrentUser?["Id"].Val<string>()},
                    { "WorkState", "Todo"},
                };
            }
            //我发起的，在WF_Flow中获取
            //if (param.WorkType == "Sender")
            //{
            //    searchParam._SearchEqual = new Dictionary<string, string>() {
            //        { "SenderId", param._CurrentUser?["Id"].Val<string>()}
            //    };
            //}
            //我处理的
            if (param.WorkType == "Done")
            {
                searchParam._SearchEqual = new Dictionary<string, string>() {
                    { "ReceiverId", param._CurrentUser?["Id"].Val<string>()},
                    { "WorkState", "Done"},
                };
            }
            //抄送我的，在WF_History
            //if (param.WorkType == "Copy")
            //{

            //}

            //我相关的
            if (param.WorkType == "Connect")
            {
                var userId = param._CurrentUser?["Id"].Val<string>();
                searchParam._SearchEqual = new Dictionary<string, string>() {
                    { "ReceiverId", userId},
                    { "WorkState", "OtherDone"},
                };
            }
            var wfWorkListResult = await MicroiEngine.FormEngine.GetTableDataAsync<WFWork>(searchParam);
            if (wfWorkListResult.Code == 1)
            {
                //2022-09-07 扩展FlowState
                var flowIds = wfWorkListResult.Data.Select(d => d.FlowId).ToList();
                var flowListResult = await MicroiEngine.FormEngine.GetTableDataAsync<WFFlow>(new
                {
                    FormEngineKey = "WF_Flow",
                    Ids = flowIds,
                    OsClient = param.OsClient,
                    _CurrentUser = param._CurrentUser,
                    
                });
                if (flowListResult.Code == 1)
                {
                    foreach (var wfWork in wfWorkListResult.Data)
                    {
                        var flowModel = flowListResult.Data.FirstOrDefault(d => d.Id == wfWork.FlowId);
                        if (flowModel != null)
                        {
                            wfWork.FlowState = flowModel.FlowState;
                        }
                    }
                }
            }

            return wfWorkListResult;
        }

        /// <summary>
        /// 获取工作，包含：我的待办、我发起的、我处理的、我相关的、抄送我的
        /// 传入：WorkType（Todo/Sender/Done//）
        /// </summary>
        /// <returns></returns>
        public async Task<DosResultList<dynamic>> GetWFFlow(WFParam param)
        {
            if (param._CurrentUser == null)
            {
                return new DosResultList<dynamic>(0, null, "参数错误！");
            }
            var searchParam = new DiyTableRowParam()
            {
                TableName = "WF_Flow",
                _PageIndex = param._PageIndex,
                _PageSize = param._PageSize,
                _Keyword = param._Keyword,
                IsDeleted = 0,
                OsClient = param.OsClient,
                
                _CurrentUser = param._CurrentUser,
            };
            //我发起的
            if (param.WorkType == "Sender")
            {
                searchParam._SearchEqual = new Dictionary<string, string>() {
                    { "SenderId", param._CurrentUser?["Id"].Val<string>()}
                };
            }
            //我处理的
            else if (param.WorkType == "Done")
            {
                searchParam._Where = new List<DiyWhere>() {
                    new DiyWhere(){
                        Name = "HandlerUsers",
                        Value = param._CurrentUser?["Id"].Val<string>(),
                        Type = "Like"
                    }
                };
            }
            //抄送我的
            else if (param.WorkType == "Copy")
            {
                searchParam._Where = new List<DiyWhere>() {
                    new DiyWhere(){
                        Name = "CopyUsers",
                        Value = param._CurrentUser?["Id"].Val<string>(),
                        Type = "Like"
                    }
                };
            }
            //我相关的
            else if (param.WorkType == "Connect")
            {
                searchParam._Where = new List<DiyWhere>() {
                    new DiyWhere(){
                        Name = "NotHandlerUsers",
                        Value = param._CurrentUser?["Id"].Val<string>(),
                        Type = "Like"
                    }
                };
            }
            var wfWorkListResult = await MicroiEngine.FormEngine.GetTableDataAsync(new
            {
                FormEngineKey = "WF_Flow",
                _Where = searchParam._Where,
                _SearchEqual = searchParam._SearchEqual,
                _PageIndex = param._PageIndex,
                _PageSize = param._PageSize,
                _Keyword = param._Keyword,
                OsClient = param.OsClient,
                
                _CurrentUser = param._CurrentUser,
            });
            return wfWorkListResult;
        }

        /// <summary>
        /// 获取“我的工作”统一统计。菜单角标为待办 + 未读抄送；各 Tab 使用各自业务口径。
        /// </summary>
        public async Task<DosResult<dynamic>> GetWFStats(WFParam param)
        {
            if (param._CurrentUser == null)
            {
                return new DosResult<dynamic>(0, null, "参数错误！");
            }

            var userId = param._CurrentUser?["Id"].Val<string>();
            if (userId.DosIsNullOrWhiteSpace())
            {
                return new DosResult<dynamic>(0, null, "未获取到当前用户！");
            }

            var todoTask = MicroiEngine.FormEngine.GetTableDataCountAsync(new
            {
                FormEngineKey = "WF_Work",
                _SearchEqual = new Dictionary<string, string>
                {
                    { "ReceiverId", userId },
                    { "WorkState", "Todo" }
                },
                IsDeleted = 0,
                OsClient = param.OsClient,
                _CurrentUser = param._CurrentUser
            });
            var senderTask = MicroiEngine.FormEngine.GetTableDataCountAsync(new
            {
                FormEngineKey = "WF_Flow",
                _SearchEqual = new Dictionary<string, string> { { "SenderId", userId } },
                IsDeleted = 0,
                OsClient = param.OsClient,
                _CurrentUser = param._CurrentUser
            });
            var doneTask = MicroiEngine.FormEngine.GetTableDataCountAsync(new
            {
                FormEngineKey = "WF_Flow",
                _Where = new List<DiyWhere>
                {
                    new DiyWhere { Name = "HandlerUsers", Value = userId, Type = "Like" }
                },
                IsDeleted = 0,
                OsClient = param.OsClient,
                _CurrentUser = param._CurrentUser
            });
            var connectTask = MicroiEngine.FormEngine.GetTableDataCountAsync(new
            {
                FormEngineKey = "WF_Flow",
                _Where = new List<DiyWhere>
                {
                    new DiyWhere { Name = "NotHandlerUsers", Value = userId, Type = "Like" }
                },
                IsDeleted = 0,
                OsClient = param.OsClient,
                _CurrentUser = param._CurrentUser
            });
            var copyTask = GetUnreadCopyCount(param, userId);

            await Task.WhenAll(todoTask, senderTask, doneTask, connectTask, copyTask);
            var countResults = new[] { todoTask.Result, senderTask.Result, doneTask.Result, connectTask.Result };
            var failedCount = countResults.FirstOrDefault(result => result == null || result.Code != 1);
            if (failedCount != null)
            {
                return new DosResult<dynamic>(0, null, failedCount.Msg ?? "工作流统计失败！");
            }
            if (copyTask.Result.Code != 1)
            {
                return new DosResult<dynamic>(0, null, copyTask.Result.Msg);
            }

            var todo = todoTask.Result.DataCount ?? 0;
            var sender = senderTask.Result.DataCount ?? 0;
            var done = doneTask.Result.DataCount ?? 0;
            var copy = copyTask.Result.Data;
            var connect = connectTask.Result.DataCount ?? 0;
            return new DosResult<dynamic>(1, new
            {
                Value = todo + copy,
                Todo = todo,
                Sender = sender,
                Done = done,
                Copy = copy,
                Connect = connect,
                Buttons = new Dictionary<string, int>
                {
                    { "mic_home_work_tab_todo", todo },
                    { "mic_home_work_tab_sender", sender },
                    { "mic_home_work_tab_done", done },
                    { "mic_home_work_tab_copy", copy },
                    { "mic_home_work_tab_connect", connect }
                }
            });
        }

        /// <summary>
        /// 将当前用户在指定流程中的显式未读抄送项标记为已读。
        /// </summary>
        public async Task<DosResult<dynamic>> MarkCopyRead(WFParam param)
        {
            if (param._CurrentUser == null || param.FlowId.DosIsNullOrWhiteSpace())
            {
                return new DosResult<dynamic>(0, null, "参数错误！");
            }

            var userId = param._CurrentUser?["Id"].Val<string>();
            var flowResult = await MicroiEngine.FormEngine.GetFormDataAsync<WFFlow>(new DiyTableRowParam
            {
                TableName = "WF_Flow",
                Id = param.FlowId,
                OsClient = param.OsClient,
                _CurrentUser = param._CurrentUser
            });
            if (flowResult.Code != 1 || flowResult.Data == null)
            {
                return new DosResult<dynamic>(flowResult.Code, null, flowResult.Msg);
            }
            if (!WorkflowCopyReadState.ContainsRecipient(flowResult.Data.CopyUsers, userId))
            {
                return new DosResult<dynamic>(0, null, "当前流程未抄送给您！");
            }

            var copyUsers = WorkflowCopyReadState.MarkRead(
                flowResult.Data.CopyUsers,
                userId,
                DateTime.Now,
                out var changed);
            if (changed)
            {
                var updateResult = await MicroiEngine.FormEngine.UptFormDataAsync(new
                {
                    FormEngineKey = "WF_Flow",
                    Id = param.FlowId,
                    CopyUsers = copyUsers,
                    OsClient = param.OsClient,
                    _CurrentUser = param._CurrentUser
                });
                if (updateResult.Code != 1)
                {
                    return new DosResult<dynamic>(0, null, updateResult.Msg);
                }
                await WorkflowStatsCache.InvalidateTenantAsync(param.OsClient);
            }

            return new DosResult<dynamic>(1, new { IsRead = true, Changed = changed });
        }

        private async Task<DosResult<int>> GetUnreadCopyCount(WFParam param, string userId)
        {
            const int pageSize = 500;
            var pageIndex = 1;
            var unread = 0;
            while (true)
            {
                var pageResult = await MicroiEngine.FormEngine.GetTableDataAsync<WFFlow>(new
                {
                    FormEngineKey = "WF_Flow",
                    _Where = new List<DiyWhere>
                    {
                        new DiyWhere { Name = "CopyUsers", Value = userId, Type = "Like" }
                    },
                    // The unread-copy calculation only parses these two columns.
                    // Avoid materializing the complete WF_Flow payload for every
                    // candidate row on the home-page badge hot path.
                    _SelectFields = new[] { "Id", "CopyUsers" },
                    _PageIndex = pageIndex,
                    _PageSize = pageSize,
                    IsDeleted = 0,
                    OsClient = param.OsClient,
                    _CurrentUser = param._CurrentUser
                });
                if (pageResult.Code != 1)
                {
                    return new DosResult<int>(0, 0, pageResult.Msg);
                }

                var rows = pageResult.Data ?? new List<WFFlow>();
                unread += WorkflowCopyReadState.CountUnreadForUser(rows, userId);
                if (rows.Count < pageSize || pageIndex * pageSize >= (pageResult.DataCount ?? rows.Count))
                {
                    break;
                }
                pageIndex++;
            }
            return new DosResult<int>(1, unread);
        }

        /// <summary>
        /// 传入FlowId
        /// 传入：WorkType（Todo/Sender/Done//）
        /// </summary>
        /// <returns></returns>
        public async Task<DosResultList<dynamic>> GetWFHistory(WFParam param)
        {
            //如果没有传入 FlowId，则会取出所有流转记录数据
            if (param._CurrentUser == null || param.FlowId == null)
            {
                return new DosResultList<dynamic>(0, null, "参数错误！");
            }
            var searchParam = new DiyTableRowParam()
            {
                TableName = "WF_History",
                _PageIndex = param._PageIndex,
                _PageSize = param._PageSize,
                _Keyword = param._Keyword,
                IsDeleted = 0,
                OsClient = param.OsClient,
                
                _CurrentUser = param._CurrentUser,
            };
            //抄送我的
            //if (param.WorkType == "Copy")
            //{
            //    searchParam._Search = new Dictionary<string, string>() {
            //        { "CopyUsers", param._CurrentUser?["Id"].Val<string>()},
            //    };
            //}
            if (param.FlowId != null)
            {
                searchParam._SearchEqual = new Dictionary<string, string>() {
                    { "FlowId", param.FlowId},
                };
            }
            var wfWorkListResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>(searchParam);
            return wfWorkListResult;
        }
    }
}

