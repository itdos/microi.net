/*************************************************************************
 * 文件名：MySqlProvider.cs
 * 
 * Hxj.Data - MySQL 数据库驱动实现
 * 
 * 原作者：steven hu (http://www.cnblogs.com/huxj)
 * 维护者：ITdos/Microi.net 团队
 * 
 * Change History:
 * 2024 - 代码优化和规范化
 * 
**************************************************************************/

using System;
using System.Data;
using System.Data.Common;
using MySql.Data.MySqlClient;
using Dos.ORM.Common;

namespace Dos.ORM.MySql
{
    /// <summary>
    /// MySQL 数据库提供程序实现
    /// </summary>
    public class MySqlProvider : DbProvider
    {
        /// <summary>
        /// 初始化 MySQL 数据库提供程序
        /// </summary>
        /// <param name="connectionString">数据库连接字符串</param>
        public MySqlProvider(string connectionString)
            : base(connectionString, MySqlClientFactory.Instance, '`', '`', '?')
        {
        }

        /// <summary>
        /// MySQL 获取自增列最后插入ID的SQL语句
        /// </summary>
        public override string RowAutoID => "select last_insert_id();";

        /// <summary>
        /// MySQL 支持批量操作
        /// </summary>
        public override bool SupportBatch => true;

        /// <summary>
        /// 预处理命令参数（处理MySQL特定的数据类型转换）
        /// </summary>
        /// <param name="cmd">数据库命令</param>
        public override void PrepareCommand(DbCommand cmd)
        {
            if (cmd == null)
            {
                throw new ArgumentNullException(nameof(cmd));
            }

            try
            {
                base.PrepareCommand(cmd);
            }
            catch (MySqlException ex)
            {
                // 追踪 MySQL 异常
                throw;
            }
            catch (Exception ex)
            {
                // 追踪其他异常
                throw;
            }

            // 处理参数类型转换
            foreach (DbParameter param in cmd.Parameters)
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
                var mySqlParam = (MySqlParameter)param;

                // 处理 GUID 转换
                if (valueType == typeof(Guid))
                {
                    mySqlParam.MySqlDbType = MySqlDbType.VarChar;
                    mySqlParam.Size = 36;
                    continue;
                }

                // 处理 TimeSpan 转换为数值
                if ((param.DbType == DbType.Time || param.DbType == DbType.DateTime) && valueType == typeof(TimeSpan))
                {
                    mySqlParam.MySqlDbType = MySqlDbType.Double;
                    mySqlParam.Value = ((TimeSpan)value).TotalDays;
                    continue;
                }

                // 根据数据类型处理大数据
                switch (param.DbType)
                {
                    case DbType.Binary:
                        // 大于2000字节使用LongBlob类型
                        if (((byte[])value).Length > 2000)
                        {
                            mySqlParam.MySqlDbType = MySqlDbType.LongBlob;
                        }
                        break;

                    case DbType.Time:
                    case DbType.DateTime:
                        // MySQL 时间类型统一使用DateTime
                        mySqlParam.MySqlDbType = MySqlDbType.DateTime;
                        break;

                    case DbType.AnsiString:
                    case DbType.String:
                        // 字符串大小判断，选择合适的MySQL数据类型
                        int strLen = value.ToString().Length;
                        if (strLen > 65535)
                        {
                            mySqlParam.MySqlDbType = MySqlDbType.LongText;
                        }
                        break;

                    case DbType.Object:
                        // 序列化复杂对象
                        mySqlParam.MySqlDbType = MySqlDbType.LongText;
                        param.Value = SerializationManager.Serialize(value);
                        break;

                    default:
                        break;
                }
            }

            // 处理SQL函数替换
            ProcessSqlFunctionReplacement(cmd);

            // 处理 charindex 函数转换为 MySQL instr 函数
            ProcessCharIndexFunction(cmd);
        }

        /// <summary>
        /// 处理 SQL 标准函数替换为 MySQL 函数
        /// </summary>
        private void ProcessSqlFunctionReplacement(DbCommand cmd)
        {
            // 使用 String.Replace 进行简单替换（大小写敏感）
            cmd.CommandText = cmd.CommandText
                .Replace("len(", "length(")
                .Replace("getdate()", "now()")
                .Replace("datepart(year,", "year(")
                .Replace("datepart(month,", "month(")
                .Replace("datepart(day,", "day(");
        }

        /// <summary>
        /// 处理 charindex 函数转换为 MySQL instr 函数
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
        /// 创建分页查询（MySQL LIMIT offset,count 语法）
        /// </summary>
        /// <param name="fromSection">查询段</param>
        /// <param name="startIndex">起始行号（从1开始）</param>
        /// <param name="endIndex">结束行号</param>
        /// <returns>分页后的查询段</returns>
        public override FromSection CreatePageFromSection(FromSection fromSection, int startIndex, int endIndex)
        {
            // 参数验证
            if (fromSection == null)
            {
                throw new ArgumentNullException(nameof(fromSection));
            }

            if (startIndex < 1 || endIndex < 1)
            {
                throw new ArgumentException("startIndex 和 endIndex 必须大于等于1");
            }

            if (startIndex > endIndex)
            {
                throw new ArgumentException("startIndex 必须小于等于 endIndex");
            }

            // MySQL LIMIT offset,count 语法
            // offset = startIndex - 1（转换为0基索引）
            // count = endIndex - startIndex + 1（行数）
            int offset = startIndex - 1;
            int pageSize = endIndex - startIndex + 1;
            fromSection.LimitString = $" limit {offset},{pageSize}";

            return fromSection;
        }
    }
}
