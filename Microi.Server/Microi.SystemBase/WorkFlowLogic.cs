using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    public partial class WorkFlowLogic : WorkFlow
    {
        private static FormEngine _formEngine = new FormEngine();

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
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient,  "OsClientNotNull", param._Lang));
            }
            if (param._CurrentSysUser == null)
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient,  "ParamError", param._Lang));
            }
            #endregion

            if (param._WFFlowDesign == null || param._WFLineList == null || param._WFNodeList == null
                || !param._WFNodeList.Any() || !param._WFLineList.Any())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient,  "ParamError", param._Lang));
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
            var nodeIds = "";
            foreach (var nodeId in lineAllNodeList)
            {
                nodeIds += "'" + nodeId + "',";
            }
            nodeIds = nodeIds.TrimEnd(',');
            var selectWFResult = await _formEngine.GetTableDataAsync<WFNode>(new DiyTableRowParam()
            {
                TableName = "WF_Node",
                _CurrentSysUser = param._CurrentSysUser,
                _CurrentUser = param._CurrentUser,
                OsClient = param.OsClient,
                _AppendWhere = new List<string>() { " AND A.Id in (" + nodeIds + ")" }
                //_SearchEqual = new Dictionary<string, string>() { { "IsEnable", "1" } }
            });
            if (selectWFResult.Code != 1)
            {
                return new DosResult(0, null, selectWFResult.Msg);
            }
            foreach (var nodeId in lineAllNodeList)
            {
                if (!selectWFResult.Data.Any(d => d.Id == nodeId))
                {
                    //需要删除此node对应的所有线
                    var lines = param._WFLineList.Where(d => d.FromNodeId == nodeId || d.ToNodeId == nodeId).ToList();
                    var delLinesResult = await _formEngine.DelFormDataAsync(new DiyTableRowParam()
                    {
                        TableName = "WF_Line",
                        _CurrentSysUser = param._CurrentSysUser,
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
            var nodeModelResult = await _formEngine.GetFormDataAsync<dynamic>(new DiyTableRowParam()
            {
                TableName = "WF_Node",
                Id = param.NodeId,
                //_SearchEqual = new Dictionary<string, string>() {
                //    { "IsDeleted", ""},
                //},
                _CurrentSysUser = param._CurrentSysUser,
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
            if (param._CurrentSysUser == null)
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
                _CurrentSysUser = param._CurrentSysUser,
                _CurrentUser = param._CurrentUser,
            };
            var _where = new List<DiyWhere>();
            if(!param._Keyword.DosIsNullOrWhiteSpace()){
                _where.Add(new DiyWhere(){
                    GroupStart = true,
                    Name = "FlowTitle",
                    Value = param._Keyword,
                    Type = "Like"
                });
                _where.Add(new DiyWhere(){
                    AndOr = "OR",
                    Name = "NoticeFields",
                    Value = param._Keyword,
                    Type = "Like"
                });
                _where.Add(new DiyWhere(){
                    AndOr = "OR",
                    Name = "NodeName",
                    Value = param._Keyword,
                    Type = "Like"
                });
                _where.Add(new DiyWhere(){
                    AndOr = "OR",
                    Name = "Receiver",
                    Value = param._Keyword,
                    Type = "Like"
                });
                _where.Add(new DiyWhere(){
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
                    { "ReceiverId", param._CurrentSysUser.Id},
                    { "WorkState", "Todo"},
                };
            }
            //我发起的，在WF_Flow中获取
            //if (param.WorkType == "Sender")
            //{
            //    searchParam._SearchEqual = new Dictionary<string, string>() {
            //        { "SenderId", param._CurrentSysUser.Id}
            //    };
            //}
            //我处理的
            if (param.WorkType == "Done")
            {
                searchParam._SearchEqual = new Dictionary<string, string>() {
                    { "ReceiverId", param._CurrentSysUser.Id},
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
                searchParam._SearchEqual = new Dictionary<string, string>() {
                    { "ReceiverId", param._CurrentSysUser.Id},
                    { "WorkState", "OtherDone"},
                };
            }
            var wfWorkListResult = await _formEngine.GetTableDataAsync<WFWork>(searchParam);
            if (wfWorkListResult.Code == 1)
            {
                //2022-09-07 扩展FlowState
                var flowIds = wfWorkListResult.Data.Select(d => d.FlowId).ToList();
                var flowListResult = await _formEngine.GetTableDataAsync<WFFlow>(new
                {
                    FormEngineKey = "WF_Flow",
                    Ids = flowIds,
                    OsClient = param.OsClient,
                    _CurrentUser = param._CurrentUser,
                    _CurrentSysUser = param._CurrentSysUser,
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
            if (param._CurrentSysUser == null)
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
                _CurrentSysUser = param._CurrentSysUser,
                _CurrentUser = param._CurrentUser,
            };
            //我发起的
            if (param.WorkType == "Sender")
            {
                searchParam._SearchEqual = new Dictionary<string, string>() {
                    { "SenderId", param._CurrentSysUser.Id}
                };
            }
            //我处理的
            else if (param.WorkType == "Done")
            {
                searchParam._Where = new List<DiyWhere>() {
                    new DiyWhere(){
                        Name = "HandlerUsers",
                        Value = param._CurrentSysUser.Id,
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
                        Value = param._CurrentSysUser.Id,
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
                        Value = param._CurrentSysUser.Id,
                        Type = "Like"
                    }
                };
            }
            //var wfWorkListResult = await _diyTableLogic.GetDiyTableRow<WFFlow>(searchParam);
            var wfWorkListResult = await _formEngine.GetTableDataAsync(new
            {
                FormEngineKey = "WF_Flow",
                _Where = searchParam._Where,
                _SearchEqual = searchParam._SearchEqual,
                _PageIndex = param._PageIndex,
                _PageSize = param._PageSize,
                _Keyword = param._Keyword,
                OsClient = param.OsClient,
                _CurrentSysUser = param._CurrentSysUser,
                _CurrentUser = param._CurrentUser,
            });
            return wfWorkListResult;
        }

        /// <summary>
        /// 传入FlowId
        /// 传入：WorkType（Todo/Sender/Done//）
        /// </summary>
        /// <returns></returns>
        public async Task<DosResultList<dynamic>> GetWFHistory(WFParam param)
        {
            //如果没有传入 FlowId，则会取出所有流转记录数据
            if (param._CurrentSysUser == null || param.FlowId == null)
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
                _CurrentSysUser = param._CurrentSysUser,
                _CurrentUser = param._CurrentUser,
            };
            //抄送我的
            //if (param.WorkType == "Copy")
            //{
            //    searchParam._Search = new Dictionary<string, string>() {
            //        { "CopyUsers", param._CurrentSysUser.Id},
            //    };
            //}
            if (param.FlowId != null)
            {
                searchParam._SearchEqual = new Dictionary<string, string>() {
                    { "FlowId", param.FlowId},
                };
            }
            var wfWorkListResult = await _formEngine.GetTableDataAsync<dynamic>(searchParam);
            return wfWorkListResult;
        }
    }
}

