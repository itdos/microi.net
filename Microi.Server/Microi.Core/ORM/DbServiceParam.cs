#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：
* Copyright(c) Microi.net
* CLR 版本: 
* 创 建 人：Anderson
* 电子邮箱：973702@qq.com
* 创建日期：
* 文件描述：
******************************************************
* 修 改 人：
* 修改日期：
* 备注描述：
*******************************************************/
#endregion
using System;
using System.Collections.Generic;
using Dos.Common;

namespace Microi.net
{
    public class DbInfo
    {
        public char L { get; set; }
        public char R { get; set; }
        public char P { get; set; }
        public DatabaseType DbType { get; set; }
        // public IMicroiORM DbService { get; set; }
    }
    public class DbServiceParam
    {
        public string FieldName { get; set; }
        public string NewFieldName { get; set; }
        public string FieldType { get; set; }
        public string OldFieldType { get; set; }
        public bool FieldNotNull { get; set; }
        public string FieldLabel { get; set; }

        public string DataBaseId { get; set; }
        public string OsClient { get; set; }
        public string TableName { get; set; }
        public string OldTableName { get; set; }
        public DiyField Field { get; set; }
        public List<DiyField> FieldList { get; set; } = new List<DiyField>();
        public DbInfo DbInfo { get; set; }
        public OsClientSecret OsClientModel { get; set; }
        public IMicroiDbSession DbSession { get; set; }
        public string _Lang = DiyMessage.Lang;
    }
}
