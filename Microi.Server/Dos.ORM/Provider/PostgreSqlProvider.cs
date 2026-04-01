#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：PostgreSqlProvider.cs
* Copyright(c) ITdos
* 创 建 人：Microi吾码
* 创建日期：2025
* 文件描述：PostgreSQL数据库驱动实现（Npgsql）
******************************************************/
#endregion

using System;
using System.Data;
using System.Data.Common;
using Npgsql;
using Dos.ORM;
using Dos.ORM.Common;

namespace Dos.ORM.PostgreSql
{
    /// <summary>
    /// PostgreSQL 数据库提供程序实现
    /// </summary>
    public class PostgreSqlProvider : DbProvider
    {
        public PostgreSqlProvider(string connectionString)
            : base(connectionString, NpgsqlFactory.Instance, '"', '"', '@')
        {
        }

        /// <summary>
        /// PostgreSQL 获取自增列值语句
        /// </summary>
        public override string RowAutoID => "select lastval()";

        /// <summary>
        /// PostgreSQL 支持批量操作
        /// </summary>
        public override bool SupportBatch => true;

        /// <summary>
        /// 构建表名
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
        /// 创建分页查询（LIMIT...OFFSET 语法）
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

            int offset = startIndex - 1;
            int fetchCount = endIndex - startIndex + 1;
            fromSection.LimitString = $" LIMIT {fetchCount} OFFSET {offset}";

            return fromSection;
        }

        /// <summary>
        /// 预处理命令参数
        /// </summary>
        public override void PrepareCommand(DbCommand cmd)
        {
            if (cmd == null)
            {
                throw new ArgumentNullException(nameof(cmd));
            }

            base.PrepareCommand(cmd);

            foreach (NpgsqlParameter param in cmd.Parameters)
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

                // 处理 GUID
                if (valueType == typeof(Guid))
                {
                    param.NpgsqlDbType = NpgsqlTypes.NpgsqlDbType.Varchar;
                    param.Size = 36;
                    continue;
                }

                // 处理 TimeSpan
                if (valueType == typeof(TimeSpan))
                {
                    param.NpgsqlDbType = NpgsqlTypes.NpgsqlDbType.Interval;
                    continue;
                }

                // 处理大文本
                if (param.DbType == DbType.String && value.ToString().Length > 4000)
                {
                    param.NpgsqlDbType = NpgsqlTypes.NpgsqlDbType.Text;
                }

                // 处理二进制大数据
                if (param.DbType == DbType.Binary && ((byte[])value).Length > 8000)
                {
                    param.NpgsqlDbType = NpgsqlTypes.NpgsqlDbType.Bytea;
                }
            }

            // 处理 SQL 标准函数替换为 PostgreSQL 函数
            ProcessSqlFunctionReplacement(cmd);

            // 处理 charindex -> position 函数替换
            ProcessCharIndexFunction(cmd);
        }

        /// <summary>
        /// 处理 SQL 标准函数替换为 PostgreSQL 函数
        /// </summary>
        private void ProcessSqlFunctionReplacement(DbCommand cmd)
        {
            cmd.CommandText = cmd.CommandText
                .Replace("len(", "length(")
                .Replace("getdate()", "now()")
                .Replace("datepart(year,", "extract(year from ")
                .Replace("datepart(month,", "extract(month from ")
                .Replace("datepart(day,", "extract(day from ");
        }

        /// <summary>
        /// 处理 charindex 函数转换为 PostgreSQL position 函数
        /// charindex(searchStr, targetStr) -> position(searchStr in targetStr)
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

                    // charindex(searchStr, targetStr) -> position(searchStr in targetStr)
                    cmd.CommandText = cmd.CommandText.Substring(0, charIndexPos)
                        + $"position({params_arr[0]} in {params_arr[1]})"
                        + (cmd.CommandText.Length - 1 > endPos ? cmd.CommandText.Substring(endPos + 1) : string.Empty);

                    charIndexPos = cmd.CommandText.IndexOf("charindex(", endPos, StringComparison.OrdinalIgnoreCase);
                }
                else
                {
                    break;
                }
            }
        }
    }
}
