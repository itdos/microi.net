using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    
    public class GetV8LineValueParam : WFParam
    {
        public DbSession Db { get; set; }
        public DbSession DbRead { get; set; }
        //public SysUser CurrentSysUser { get; set; }
        public WFNode CurrentNodeModel { get; set; }
        public string FormData { get; set; }
        //public Dictionary<string, string> FormData { get; set; }
        //public Dictionary<string, object> FormData2 { get; set; }
        //public string FormData3 { get; set; }
        //public JObject FormData4 { get; set; }

        //public dynamic FormData { get; set; }
    }
    public partial class WFParam : BaseParam
    {
        public string FlowTitle { get; set; }
        public string FlowId { get; set; }
        public string FlowDesignId { get; set; }
        //public Dictionary<string, object> _RowModel { get; set; }
        private Dictionary<string, string> _rowModel = null;
        private Dictionary<string, string> _formData = null;
        //public Dictionary<string, string> _RowModel { get; set; }
        public Dictionary<string, string> _RowModel
        {
            get
            {
                if (_rowModel != null)
                {
                    return _rowModel;
                }
                if (_formData != null)
                {
                    return _formData;
                }
                return null;
            }
            set
            {
                _rowModel = value;
                _formData = value;
            }
        }
        public Dictionary<string, string> _FormData
        {
            get
            {
                if (_rowModel != null)
                {
                    return _rowModel;
                }
                if (_formData != null)
                {
                    return _formData;
                }
                return null;
            }
            set
            {
                _rowModel = value;
                _formData = value;
            }
        }
        public string OsClient { get; set; }
        public string LineValue { get; set; }
        public string FormData { get; set; }
        //前端格式 是{Id:'',Name:''}，不是FormData['Id']，这个参数整个直接为null
        //public Dictionary<string, string> FormData { get; set; }
        //public dynamic FormData { get; set; }
        //前端 不管是传对象，还是字符串，object收到都是null
        public Dictionary<string, object> FormData2 { get; set; }
        public string FormData3 { get; set; }
        //方法都不进，直接报错不能为null
        //public JObject FormData4 { get; set; }
        public string NodeId { get; set; }
        public string BackNodeId { get; set; }
        public string WorkId { get; set; }
        public string TableRowId { get; set; }
        public SysUser _CurrentSysUser { get; set; }
        public string ApprovalType { get; set; }
        public string ApprovalIdea { get; set; }
        public string WorkType { get; set; }
        public string NoticeFields { get; set; }
        public List<string> SelectUsers { get; set; }
        public List<string> AddUsers { get; set; }
        //public List<string> ForceSelectUsers { get; set; }
        public string[] ForceSelectUsers { get; set; }

        public WFFlowDesign _WFFlowDesign { get; set; }
        public List<WFLine> _WFLineList { get; set; }
        public List<WFNode> _WFNodeList { get; set; }
        public WFNode NextNode { get; set; }
        public List<IdName> NextTodoUsers { get; set; }
    }
    public partial class WFFlowDesign : BaseParam
    {
        /// <summary>
		/// 父级Id
		/// </summary>
		public string ParentId { get; set; }
        /// <summary>
        /// 创建时间
        /// </summary>
        public DateTime CreateTime { get; set; }
        /// <summary>
        /// 更新修改
        /// </summary>
        public DateTime? UpdateTime { get; set; }
        /// <summary>
        /// 操作人Id
        /// </summary>
        public string UserId { get; set; }
        /// <summary>
        /// 操作人
        /// </summary>
        public string UserName { get; set; }
        /// <summary>
        /// 是否删除
        /// </summary>
        public bool IsDeleted { get; set; }
        /// <summary>
        /// 流程名称
        /// </summary>
        public string FlowName { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string Category { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public bool? IsEnable { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string Description { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string JsonData { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string StartV8 { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string EndV8 { get; set; }
        public string LineValueV8 { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string Remark { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public int? Sort { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string Roles { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string Preview { get; set; }
        /// <summary>
        /// 关联表单
        /// </summary>
        public string TableId { get; set; }
    }
    public partial class WFFlow : BaseParam
    {
        public string HandlerUsers { get; set; }
        public string CopyUsers { get; set; }
        public string NotHandlerUsers { get; set; }



        public string StartNodeId { get; set; }
        public string StartNodeName { get; set; }
        public string NoticeFields { get; set; }
        public string TableRowId { get; set; }
        /// <summary>
        /// 父级Id
        /// </summary>
        public string ParentId { get; set; }
        /// <summary>
        /// 创建时间
        /// </summary>
        public DateTime CreateTime { get; set; }
        /// <summary>
        /// 更新修改
        /// </summary>
        public DateTime? UpdateTime { get; set; }
        /// <summary>
        /// 操作人Id
        /// </summary>
        public string UserId { get; set; }
        /// <summary>
        /// 操作人
        /// </summary>
        public string UserName { get; set; }
        /// <summary>
        /// 是否删除
        /// </summary>
        public bool IsDeleted { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string FlowDesignId { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string FlowState { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string SenderId { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string Sender { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string FlowTitle { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string FormData { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string TableId { get; set; }
    }
    public class WFWork : BaseParam
    {
        public string FlowState { get; set; }
        public string NoticeFields { get; set; }
        public string FirstSender { get; set; }
        public string FirstSenderId { get; set; }
        public string TableRowId { get; set; }
        /// <summary>
		/// 父级Id
		/// </summary>
		public string ParentId { get; set; }
        /// <summary>
        /// 创建时间
        /// </summary>
        public DateTime CreateTime { get; set; }
        /// <summary>
        /// 更新修改
        /// </summary>
        public DateTime? UpdateTime { get; set; }
        /// <summary>
        /// 操作人Id
        /// </summary>
        public string UserId { get; set; }
        /// <summary>
        /// 操作人
        /// </summary>
        public string UserName { get; set; }
        /// <summary>
        /// 是否删除
        /// </summary>
        public bool IsDeleted { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string FlowId { get; set; }
        /// <summary>
        /// Timeout
        /// </summary>
        public int? Timeout { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string WorkState { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string SenderId { get; set; }
        /// <summary>
        /// Remark
        /// </summary>
        public string Remark { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string Sender { get; set; }
        /// <summary>
        /// NodeName
        /// </summary>
        public string NodeName { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string NodeId { get; set; }
        public string FromNodeId { get; set; }
        public string FromNodeName { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string FlowDesignId { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string ReceiverId { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string Receiver { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string FormData { get; set; }
        /// <summary>
        /// FlowTitle
        /// </summary>
        public string FlowTitle { get; set; }
        /// <summary>
        /// TableId
        /// </summary>
        public string TableId { get; set; }
    }
    public partial class WFLine : BaseParam
    {
        /// <summary>
		/// 父级Id
		/// </summary>
		public string ParentId { get; set; }
        /// <summary>
        /// 创建时间
        /// </summary>
        public DateTime CreateTime { get; set; }
        /// <summary>
        /// 更新修改
        /// </summary>
        public DateTime? UpdateTime { get; set; }
        /// <summary>
        /// 操作人Id
        /// </summary>
        public string UserId { get; set; }
        /// <summary>
        /// 操作人
        /// </summary>
        public string UserName { get; set; }
        /// <summary>
        /// 是否删除
        /// </summary>
        public bool IsDeleted { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string LineName { get; set; }
        /// <summary>
        /// 流程图Id
        /// </summary>
        public string FlowDesignId { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string FromNodeId { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string ToNodeId { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string V8Code { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string LineValue { get; set; }
    }
    public partial class WFNode : BaseParam
    {
        public string AllowAddUserV8Code { get; set; }
        public bool? SameDeptApprove { get; set; }
        public bool? AllowRecall { get; set; }
        public bool? AllowAddUsers { get; set; }
        /// <summary>
        /// 手动指定审批人
        /// </summary>
        public bool? AllowSelectUsers { get; set; }
        public string FromNodeId { get; set; }
		public string FromNodeName { get; set; }
        /// <summary>
		/// 父级Id
		/// </summary>
		public string ParentId { get; set; }
        /// <summary>
        /// 创建时间
        /// </summary>
        public DateTime CreateTime { get; set; }
        /// <summary>
        /// 更新修改
        /// </summary>
        public DateTime? UpdateTime { get; set; }
        /// <summary>
        /// 操作人Id
        /// </summary>
        public string UserId { get; set; }
        /// <summary>
        /// 操作人
        /// </summary>
        public string UserName { get; set; }
        /// <summary>
        /// 是否删除
        /// </summary>
        public bool IsDeleted { get; set; }
        /// <summary>
        /// 节点名称
        /// </summary>
        public string NodeName { get; set; }
        /// <summary>
        /// 流程图Id
        /// </summary>
        public string FlowDesignId { get; set; }
        /// <summary>
        /// 开始V8
        /// </summary>
        public string StartV8 { get; set; }
        public string StartV8Server { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string EndV8 { get; set; }
        public string EndV8Server { get; set; }
        public string LineValueV8 { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public int? Timeout { get; set; }
        /// <summary>
        /// 节点类型
        /// </summary>
        public string NodeType { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string Roles { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string Depts { get; set; }
        /// <summary>
        /// 绑定账户
        /// </summary>
        public string Users { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string Description { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string Remark { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string BackNodes { get; set; }
        /// <summary>
        /// 坐标X
        /// </summary>
        public string PositionLeft { get; set; }
        /// <summary>
        /// 坐标Y
        /// </summary>
        public string PositionTop { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string Icon { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string DisplayFields { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string HideFields { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string EditFields { get; set; }
        /// <summary>
        /// 字段设置
        /// </summary>
        public string FieldsConfig { get; set; }
        /// <summary>
        /// 抄送
        /// </summary>
        public string CopyUsers { get; set; }
    }
    public partial class WFHistory : BaseParam
    {
        public string NoticeFields { get; set; }
        public string ToNodes { get; set; }
        public string TableRowId { get; set; }
        /// <summary>
		/// 父级Id
		/// </summary>
		public string ParentId { get; set; }
        /// <summary>
        /// 创建时间
        /// </summary>
        public DateTime CreateTime { get; set; }
        /// <summary>
        /// 更新修改
        /// </summary>
        public DateTime? UpdateTime { get; set; }
        /// <summary>
        /// 操作人Id
        /// </summary>
        public string UserId { get; set; }
        /// <summary>
        /// 操作人
        /// </summary>
        public string UserName { get; set; }
        /// <summary>
        /// 是否删除
        /// </summary>
        public bool IsDeleted { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string FlowTitle { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string FlowId { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string FlowDesignId { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string FromNodeName { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string FromNodeId { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string ToNodeId { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string ToNodeName { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string Sender { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string SenderId { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string Receivers { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string FlowName { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string FormData { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string ApprovalType { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string ApprovalIdea { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string LineValue { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string LineId { get; set; }
        /// <summary>
        /// null
        /// </summary>
        public string WorkId { get; set; }
        /// <summary>
        /// TableId
        /// </summary>
        public string TableId { get; set; }
        /// <summary>
        /// CopyUsers
        /// </summary>
        public string CopyUsers { get; set; }
    }

}
