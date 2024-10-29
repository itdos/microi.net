using System;
namespace Microi.net
{
    public class HandlerUsersModel
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string NodeId { get; set; }
        public string NodeName { get; set; }
        public string ApprovalType { get; set; }
        public DateTime HandlerTime { get; set; }
    }
    public class CopyUsersModel
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string NodeId { get; set; }
        public string NodeName { get; set; }
        public DateTime CopyTime { get; set; }
    }
    public class NotHandlerUsersModel
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string NodeId { get; set; }
        public string NodeName { get; set; }
    }
    /// <summary>
    /// 节点类型
    /// </summary>
    public enum NodeType
    {
        /// <summary>
        /// 开始节点
        /// </summary>
        Start,
        /// <summary>
        /// 自动节点
        /// </summary>
        Auto,
        /// <summary>
        /// 业务节点（只有提交，没有同意、不同意审核功能，但有填写意见）
        /// </summary>
        Business,
        /// <summary>
        /// 结束节点
        /// </summary>
        End,
        /// <summary>
        /// 自动结束节点
        /// </summary>
        AutoEnd,
        /// <summary>
        /// 会签节点
        /// </summary>
        Countersign,
        /// <summary>
        /// 审批节点
        /// </summary>
        Approve
    }
    /// <summary>
    /// 审批意见类型
    /// </summary>
    public enum ApprovalType
    {
        /// <summary>
        /// 自动
        /// </summary>
        Auto,
        /// <summary>
        /// 同意
        /// </summary>
        Agree,
        /// <summary>
        /// 不同意
        /// </summary>
        Disagree,
        /// <summary>
        /// 撤回
        /// </summary>
        Recall,
        /// <summary>
        /// 作废
        /// </summary>
        Cancel,
        /// <summary>
        /// 移交
        /// </summary>
        HandOver
    }
}

