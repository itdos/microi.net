#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：OracleProvider.cs
* Copyright(c) ITdos
* CLR 版本: 4.0.30319.18408
* 创 建 人：洪金波
* 创建日期：2016/6/10
* 文件描述：Oracle数据库驱动实现（Oracle.ManagedDataAccess.Core）
* 更新记录：2024 - 代码优化和规范化
******************************************************/

#endregion

using System;
using System.Data;
using System.Data.Common;
using Oracle.ManagedDataAccess.Client;
using Dos.ORM;
using Dos.ORM.Common;

namespace Dos.ORM.Oracle
{
    /// <summary>
    /// Oracle 数据库提供程序实现
    /// </summary>
    public class OracleProvider : DbProvider
    {
        public OracleProvider(string connectionString)
            : base(connectionString, OracleClientFactory.Instance, '"', '"', ':')
        {
        }

        /// <summary>
        /// Oracle 获取自增列值语句
        /// </summary>
        public override string RowAutoID => "select {0}.currval from dual";

        /// <summary>
        /// Oracle 支持批量操作
        /// </summary>
        public override bool SupportBatch => true;

        /// <summary>
        /// 构建表名（支持Schema前缀）
        /// </summary>
        /// <param name="name">表名</param>
        /// <param name="userName">用户名/Schema</param>
        /// <returns>处理后的表名</returns>
        public override string BuildTableName(string name, string userName)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                return name;
            }

            // 清理并格式化表名
            var cleanName = name.Trim(leftToken, rightToken);
            var quotedName = $"{leftToken}{cleanName}{rightToken}";

            // 如果指定了Schema，则添加Schema前缀
            if (!string.IsNullOrWhiteSpace(userName))
            {
                var cleanUserName = userName.Trim(leftToken, rightToken);
                return $"{leftToken}{cleanUserName}{rightToken}.{quotedName}";
            }

            return quotedName;
        }

        /// <summary>
        /// 创建分页查询（Oracle 12c+ OFFSET...FETCH 语法）
        /// </summary>
        /// <param name="fromSection">查询段</param>
        /// <param name="startIndex">起始行号（从1开始）</param>
        /// <param name="endIndex">结束行号</param>
        /// <returns>分页后的查询段</returns>
        public override FromSection CreatePageFromSection(FromSection fromSection, int startIndex, int endIndex)
        {
            // 检查参数有效性
            if (fromSection == null)
            {
                throw new ArgumentNullException(nameof(fromSection));
            }

            if (startIndex < 1 || endIndex < 1 || startIndex > endIndex)
            {
                throw new ArgumentException("startIndex 和 endIndex 必须大于等于1，且startIndex <= endIndex");
            }

            // Oracle 12c+ 使用 OFFSET...FETCH 语法
            // 单行查询优化
            if (startIndex == 1 && endIndex == 1)
            {
                fromSection.LimitString = " AND ROWNUM = 1";
            }
            else
            {
                // OFFSET n-1 ROWS FETCH NEXT m ROW ONLY
                int offset = startIndex - 1;
                int fetchCount = endIndex - startIndex + 1;
                fromSection.LimitString = $" OFFSET {offset} ROWS FETCH NEXT {fetchCount} ROW ONLY";
            }

            return fromSection;
        }


        /// <summary>
        /// 预处理命令参数（处理Oracle特定的数据类型转换）
        /// </summary>
        /// <param name="cmd">数据库命令</param>
        public override void PrepareCommand(DbCommand cmd)
        {
            if (cmd == null)
            {
                throw new ArgumentNullException(nameof(cmd));
            }

            base.PrepareCommand(cmd);

            // 处理参数类型转换
            foreach (OracleParameter param in cmd.Parameters)
            {
                // 跳过输出参数和返回值
                if (param.Direction == ParameterDirection.Output || param.Direction == ParameterDirection.ReturnValue)
                {
                    continue;
                }

                object value = param.Value;
                if (value == null || value == DBNull.Value)
                {
                    continue;
                }

                Type valueType = value.GetType();

                // 处理 GUID 转换
                if (param.DbType != DbType.Guid && valueType == typeof(Guid))
                {
                    param.OracleDbType = OracleDbType.Char;
                    param.Size = 36;
                    continue;
                }

                // 处理 TimeSpan 转换为数值
                if ((param.OracleDbType == OracleDbType.Date || param.OracleDbType == OracleDbType.TimeStamp) 
                    && valueType == typeof(TimeSpan))
                {
                    param.OracleDbType = OracleDbType.Double;
                    param.Value = ((TimeSpan)value).TotalDays;
                    continue;
                }

                // 根据数据类型处理大数据
                switch (param.OracleDbType)
                {
                    case OracleDbType.Blob:
                        // 大于2000字节使用BLOB类型
                        if (((byte[])value).Length > 2000)
                        {
                            param.OracleDbType = OracleDbType.Blob;
                        }
                        break;

                    case OracleDbType.Varchar2:
                        // 字符串大小判断，选择合适的Oracle数据类型
                        int strLen = value.ToString().Length;
                        if (strLen > 4000)
                        {
                            param.OracleDbType = OracleDbType.Clob;
                        }
                        else if (strLen > 2000)
                        {
                            param.OracleDbType = OracleDbType.NClob;
                        }
                        break;

                    case OracleDbType.NClob:
                        // 序列化复杂对象
                        param.OracleDbType = OracleDbType.NClob;
                        param.Value = SerializationManager.Serialize(value);
                        break;

                    default:
                        break;
                }
            }

            // 处理SQL函数替换（charindex -> instr）
            ProcessCharIndexFunction(cmd);

            // 处理TO_CHAR函数参数顺序
            ProcessToCharFunction(cmd);
        }

        /// <summary>
        /// 处理 charindex 函数转换为 Oracle instr 函数
        /// </summary>
        private void ProcessCharIndexFunction(DbCommand cmd)
        {
            int charIndexPos = cmd.CommandText.IndexOf("charindex(", StringComparison.OrdinalIgnoreCase);
            
            while (charIndexPos > 0)
            {
                int endPos = DataUtils.GetEndIndexOfMethod(cmd.CommandText, charIndexPos + "charindex(".Length);
                
                if (endPos > 0)
                {
                    string[] params_arr = DataUtils.SplitTwoParamsOfMethodBody(
                        cmd.CommandText.Substring(
                            charIndexPos + "charindex(".Length,
                            endPos - charIndexPos - "charindex(".Length));

                    // charindex(searchStr, targetStr) -> instr(targetStr, searchStr)
                    cmd.CommandText = cmd.CommandText.Substring(0, charIndexPos)
                        + $"instr({params_arr[1]},{params_arr[0]})"
                        + (cmd.CommandText.Length - 1 > endPos ? cmd.CommandText.Substring(endPos + 1) : string.Empty);

                    charIndexPos = cmd.CommandText.IndexOf("charindex(", endPos, StringComparison.OrdinalIgnoreCase);
                }
                else
                {
                    break;
                }
            }
        }

        /// <summary>
        /// 处理 to_char 函数参数顺序
        /// </summary>
        private void ProcessToCharFunction(DbCommand cmd)
        {
            int toCharPos = cmd.CommandText.IndexOf("to_char(", StringComparison.OrdinalIgnoreCase);
            
            if (toCharPos < 0)
            {
                return;
            }

            while (toCharPos > 0)
            {
                int endPos = DataUtils.GetEndIndexOfMethod(cmd.CommandText, toCharPos + "to_char(".Length);
                
                if (endPos > 0)
                {
                    string[] params_arr = DataUtils.SplitTwoParamsOfMethodBody(
                        cmd.CommandText.Substring(
                            toCharPos + "to_char(".Length,
                            endPos - toCharPos - "to_char(".Length));

                    // 调整参数顺序：to_char(format, value) -> to_char(value, format)
                    cmd.CommandText = cmd.CommandText.Substring(0, toCharPos)
                        + $"to_char({params_arr[1]},{params_arr[0]})"
                        + (cmd.CommandText.Length - 1 > endPos ? cmd.CommandText.Substring(endPos + 1) : string.Empty);

                    toCharPos = cmd.CommandText.IndexOf("to_char(", endPos, StringComparison.OrdinalIgnoreCase);
                }
                else
                {
                    break;
                }
            }
        }
    }
}
