#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：Biz_CarsInfoLogic
* Copyright(c) 道斯软件
* CLR 版本: 4.0.30319.17929
* 创 建 人：iTdos
* 电子邮箱：admin@iTdos.com
* 创建日期：2016/10/1 11:00:49
* 文件描述：
******************************************************
* 修 改 人：
* 修改日期：
* 备注描述：
*******************************************************/
#endregion
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace Microi.net
{

    public partial class SysRoleLimit
    {
        public string FkName { get; set; }
    }
    public partial class DiyDocument
    {
        public List<DiyDocument> _Child { get; set; }
    }
    public partial class DiyTable
    {
        public string AsName { get; set; }
        public string FormEngineKey { get; set; }
        public string TableId { get; set; }
        public string FieldId { get; set; }
        public string FormEngineFieldKey { get; set; }
        public string DataBaseId { get; set; }
        public int? EnableDataLog { get; set; }
    }

    public partial class DiyField
    {
        public string TableName { get; set; }
        public string TableDescription { get; set; }
        public bool _NotNull { get; set; }
        public string _NewName { get; set; }
        public string _OldType { get; set; }
    }

    //public class SysUserRole
    //{
    //    public string BaseLimit { get; set; }
    //    public string DeptIds { get; set; }
    //    public string Id { get; set; }
    //    public string Level { get; set; }
    //    public string Name { get; set; }
    //}
    //public class SysUserRoleLimit
    //{
    //    public string FkId { get; set; }
    //    public string FkName { get; set; }
    //    public string Permission { get; set; }
    //    public string RoleId { get; set; }
    //    public string Type { get; set; }
    //}
    public partial class SysUser
    {
        public List<SysDept> _Child { get; set; }
        public string ParentId { get; set; }
        public string GroupName { get; set; }
        public bool? _IsAdmin { get; set; }
        public List<SysRole> _Roles { get; set; }
        //public List<SysUserRole> _Roles { get; set; }
        public List<SysRoleLimit> _RoleLimits { get; set; }
        public string Authorization { get; set; }
        //public List<string> roles { get; set; } 
        //public string introduction { get; set; }
        //public string avatar { get; set; }
        //public string name { get; set; }

    }
    //public partial class BizCustomer
    //{
    //    public string RealName { get; set; }
    //}
    public partial class SysUserFk
    {
        public string GroupName { get; set; }
        public string RoleName { get; set; }
        public string DeptName { get; set; }
        public string PostName { get; set; }
        public int Level { get; set; }
    }
    //public partial class SysPost
    //{
    //    public List<SysPost> _Child { get; set; }
    //}
    public partial class SysDept
    {
        public List<SysDept> _Child { get; set; }
    }
    public partial class SysRole
    {
        public string ParentId { get; set; }
        public List<SysRole> _Child { get; set; }
        public List<string> SysMenuIds { get; set; }
        public List<SysRoleLimits> SysRoleLimits { get; set; }
        public string _Test { get; set; }
        public string DeptNames { get; set; }
    }
    //public class SysRoleSimple
    //{
    //    public string Id { get; set; }
    //    public string Name { get; set; }
    //    public string Level { get; set; }
    //}
    //public partial class SysGroup
    //{
    //    public List<SysGroup> _Child { get; set; }
    //}
    public partial class SysRichText
    {
        public List<SysRichText> _Child { get; set; }
    }

    /// <summary>
    /// Sys_BaseData表字段扩展
    /// </summary>
    public partial class SysBaseData
    {
        public List<SysBaseData> _Child { get; set; }
    }

    public partial class SysMenu
    {
        public List<SysMenu> _Child { get; set; }
    }

    public partial class SysMessage
    {
        public string ReceiverId { get; set; }
        public bool IsRead { get; set; }
        public string Avatar { get; set; }
    }

    public partial class RedisBizUser
    {
        public string ConnectionId { get; set; }
        public DateTime LastConnectTime { get; set; }
        public int Unread { get; set; }
        public double Score { get; set; }
    }
}
