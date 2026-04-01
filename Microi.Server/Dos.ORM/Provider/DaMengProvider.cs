#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：DaMengProvider.cs
* Copyright(c) ITdos
* 创 建 人：Microi吾码
* 创建日期：2025
* 文件描述：达梦数据库驱动实现（DmProvider）
* 备注：达梦数据库兼容Oracle，语法高度相似
******************************************************/
#endregion

using System;
using System.Data;
using System.Data.Common;
using Dm;
using Dos.ORM;
using Dos.ORM.Common;

namespace Dos.ORM.DaMeng
{
    /// <summary>
    /// 达梦 数据库提供程序实现
    /// </summary>
    public class DaMengProvider : DbProvider
    {
        public DaMengProvider(string connectionString)
            : base(connectionString, DmClientFactory.Instance, '"', '"', ':')
        {
        }

        /// <summary>
        /// 达梦 获取自增列值语句
        /// </summary>
        public override string RowAutoID => "select @@identity";

        /// <summary>
        /// 达梦 支持批量操作
        /// </summary>
        public override bool SupportBatch => true;

        /// <summary>
        /// 构建表名（支持Schema前缀）
        /// </summary>
        public override string BuildTableName(string name, string userName)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                return name;
            }

            var cleanName = name.Trim(leftToken, rightToken);
            var quotedName = $"{leftToken}{cleanName}{rightToken}";

            if (!string.IsNullOrWhiteSpace(userName))
            {
                var cleanUserName = userName.Trim(leftToken, rightToken);
                return $"{leftToken}{cleanUserName}{rightToken}.{quotedName}";
            }

            return quotedName;
        }

        /// <summary>
        /// 创建分页查询（达梦兼容Oracle，使用 OFFSET...FETCH 语法）
        /// </summary>
        public override FromSection CreatePageFromSection(FromSection fromSection, int startIndex, int endIndex)
        {
            if (fromSection == null)
            {
                throw new ArgumentNullException(nameof(fromSection));
            }

            if (startIndex < 1 || endIndex < 1 || startIndex > endIndex)
            {
                throw new ArgumentException("startIndex 和 endIndex 必须大于等于1，且startIndex <= endIndex");
            }

            // 达梦统一使用 OFFSET...FETCH 语法，兼容性更好
            int offset = startIndex - 1;
            int fetchCount = endIndex - startIndex + 1;
            fromSection.LimitString = $" OFFSET {offset} ROWS FETCH NEXT {fetchCount} ROW ONLY";

            return fromSection;
        }

        /// <summary>
        /// 预处理命令参数（处理达梦特定的数据类型转换）
        /// </summary>
        public override void PrepareCommand(DbCommand cmd)
        {
            if (cmd == null)
            {
                throw new ArgumentNullException(nameof(cmd));
            }

            base.PrepareCommand(cmd);

            foreach (DmParameter param in cmd.Parameters)
            {
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
                    param.DmSqlType = DmDbType.Char;
                    param.Size = 36;
                    continue;
                }

                // 处理 TimeSpan 转换为数值
                if (param.DbType == DbType.DateTime && valueType == typeof(TimeSpan))
                {
                    param.DmSqlType = DmDbType.Double;
                    param.Value = ((TimeSpan)value).TotalDays;
                    continue;
                }

                // 处理大文本
                if (param.DbType == DbType.String && value.ToString().Length > 4000)
                {
                    param.DmSqlType = DmDbType.Clob;
                }

                // 处理二进制大数据
                if (param.DbType == DbType.Binary && ((byte[])value).Length > 2000)
                {
                    param.DmSqlType = DmDbType.Blob;
                }
            }

            // 处理 SQL 标准函数替换为达梦函数
            ProcessSqlFunctionReplacement(cmd);

            // 处理 charindex -> instr 函数替换（达梦兼容Oracle语法）
            ProcessCharIndexFunction(cmd);

            // 处理 TO_CHAR 函数参数顺序（达梦兼容Oracle）
            ProcessToCharFunction(cmd);
        }

        /// <summary>
        /// 处理 SQL 标准函数替换为达梦函数
        /// </summary>
        private void ProcessSqlFunctionReplacement(DbCommand cmd)
        {
            cmd.CommandText = cmd.CommandText
                .Replace("len(", "length(")
                .Replace("getdate()", "SYSDATE")
                .Replace("datepart(year,", "extract(year from ")
                .Replace("datepart(month,", "extract(month from ")
                .Replace("datepart(day,", "extract(day from ");
        }

        /// <summary>
        /// 处理 charindex 函数转换为 instr 函数（达梦兼容Oracle）
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
        /// 处理 to_char 函数参数顺序（达梦兼容Oracle）
        /// to_char(format, value) -> to_char(value, format)
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
