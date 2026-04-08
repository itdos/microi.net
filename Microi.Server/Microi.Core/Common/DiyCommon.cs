using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using Dos.Common;

using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;

using Dos.ORM;

namespace Microi.net
{
    public partial class DiyCommon
    {
        public const int MaxRoleLevel = 9999;
        // 定义一个与Guid.Empty类似的概念性“空ULID”常量
        // 格式：所有字符为'0'的26位有效ULID字符串
        public const string UlidEmpty = "00000000000000000000000000";        
        /// <summary>
        /// V8引擎/接口引擎慢执行日志阈值（毫秒），超过此值将输出警告日志并写入MongoDB。默认5000ms（5秒）
        /// </summary>
        public const int SlowExecutionThresholdMs = 5000;
        /// <summary>
        /// 数据库SQL慢查询阈值（毫秒），超过此值将记录慢SQL日志。默认5000ms（5秒）
        /// </summary>
        public const int SlowSqlThresholdMs = 5000;
        public static DbInfo GetDbInfo(string dbType)
        {
            if (dbType.ToLower() == "mysql")
                return new DbInfo()
                {
                    L = '`',
                    R = '`',
                    P = '?',
                    DbType = DatabaseType.MySql,
                };
            else if (dbType.ToLower().DosContains("sqlserver"))
                return new DbInfo()
                {
                    L = '[',
                    R = ']',
                    P = '@',
                    DbType = DatabaseType.SqlServer,
                };
            else if (dbType.ToLower().DosContains("oracle"))
                return new DbInfo()
                {
                    L = '"',
                    R = '"',
                    P = ':',
                    DbType = DatabaseType.Oracle,
                };
            else if (dbType.ToLower().DosContains("postgresql") || dbType.ToLower().DosContains("pgsql"))
                return new DbInfo()
                {
                    L = '"',
                    R = '"',
                    P = '@',
                    DbType = DatabaseType.PostgreSql,
                };
            else if (dbType.ToLower().DosContains("dameng") || dbType.ToLower() == "dm")
                return new DbInfo()
                {
                    L = '"',
                    R = '"',
                    P = ':',
                    DbType = DatabaseType.DaMeng,
                };
            else if (dbType.ToLower().DosContains("kingbase") || dbType.ToLower().DosContains("kdbndp"))
                return new DbInfo()
                {
                    L = '"',
                    R = '"',
                    P = ':',
                    DbType = DatabaseType.KingBase,
                };
            throw new Exception("DbType value error.");
        }

        /// <summary>
        /// 
        /// </summary>
        public static List<string> DefaultFields = new List<string>() { "Id", "CreateTime", "UpdateTime", "UserId", "UserName", "IsDeleted" };// "ParentId",
        /// <summary>
        /// 
        /// </summary>
        /// <param name="input"></param>
        /// <returns></returns>
        // public static bool IsBase64String(string input)
        // {
        //     // 使用正则表达式匹配 Base64 编码的字符串模式
        //     var base64Pattern = @"^[a-zA-Z0-9+/]*={0,2}$";
        //     return Regex.IsMatch(input, base64Pattern);
        // }
        /// <summary>
        /// 高性能 Base64 检测：单次遍历 + 严格 padding 校验，避免解码和异常开销
        /// </summary>
        public static bool IsBase64String(string input)
        {
            if (string.IsNullOrEmpty(input))
            {
                return false;
            }

            var len = input.Length;
            // Base64 长度必须是 4 的倍数
            if (len % 4 != 0)
            {
                return false;
            }

            // 统计尾部 padding 数，最多 2 个且只能在末尾
            var paddingCount = 0;
            if (len >= 2 && input[len - 1] == '=')
            {
                paddingCount++;
                if (input[len - 2] == '=')
                {
                    paddingCount++;
                }
            }

            var checkLen = len - paddingCount;
            // 检查有效位字符
            for (var i = 0; i < checkLen; i++)
            {
                var c = input[i];
                if (!((c >= 'A' && c <= 'Z') ||
                      (c >= 'a' && c <= 'z') ||
                      (c >= '0' && c <= '9') ||
                      c == '+' || c == '/'))
                {
                    return false;
                }
            }

            // 检查 padding 位字符
            for (var i = checkLen; i < len; i++)
            {
                if (input[i] != '=')
                {
                    return false;
                }
            }

            return true;
        }
        public static readonly Dictionary<string, string> FieldWhereTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            {"Equal", "="},
            {"=", "="},
            {"==", "="},
            {"NotEqual", "<>"},
            {"<>", "<>"},
            {"!=", "<>"},
            {">", ">"},
            {">=", ">="},
            {"<", "<"},
            {"<=", "<="},
            {"In", "IN"},
            {"NotIn", "NOT IN"},
            {"Like", "LIKE"},
            {"NotLike", "NOT LIKE"},
            {"StartLike", "LIKE"},
            {"NotStartLike", "NOT LIKE"},
            {"EndLike", "LIKE"},
            {"NotEndLike", "NOT LIKE"}
        };
        public static readonly List<DiyField> FixedDiyField = new List<DiyField>()
        {
            new DiyField() { Name = "Id" , Label = "Id", Type = "varchar(36)", Component = "Guid", Sort = 1, Visible = 0, TableWidth = 150 },
            new DiyField() { Name = "CreateTime" , Label = "创建时间", Type = "datetime", Component = "DateTime", Sort = 2, Visible = 1, TableWidth = 150 },
            new DiyField() { Name = "UpdateTime" , Label = "修改时间", Type = "datetime", Component = "DateTime", Sort = 3, Visible = 1, TableWidth = 150 },
            new DiyField() { Name = "UserId" , Label = "创建人Id", Type = "varchar(36)", Component = "Guid", Sort = 4, Visible = 0, TableWidth = 150 },
            new DiyField() { Name = "UserName" , Label = "创建人", Type = "varchar(255)", Component = "Text", Sort = 5, Visible = 1, TableWidth = 150 },
            new DiyField() { Name = "IsDeleted" , Label = "是否已删除", Type = "int", Component = "Switch", Sort = 6, Visible = 0, TableWidth = 50 }
        };
        public static readonly List<string> NoDbFieldComponent = new List<string>()
        {
            "OpenTable", "DevComponent", "PhoneSMS", "TableChild", "Button", "Divider"
        };
        public static JsonSerializer JsonConfig = new JsonSerializer()
        {
            ContractResolver = new DefaultContractResolver(),
            DateFormatString = "yyyy-MM-dd HH:mm:ss"
        };

        public static List<string> NotRealField = new List<string>() { "Divider", "Button" };
        /// <summary>
        /// 
        /// </summary>
        public static readonly Guid SuperAdminId = Guid.Parse("446C7239-E0D0-412D-B84C-A9C2F82AF44C");
        /// <summary>
        /// 
        /// </summary>
        public static readonly List<string> AllSpecialChar = new List<string>()
        {
            " ", "　", "~", "`", "！", "!", "@", "#", "￥", "$", "%", "^", "……", "&", "*", "(", ")", "（", "）", "——", "_", "-", "+", "=",
            "{", "}", "【", "】", "[", "]", "\\", "、", "|", ";", ":", "；", "‘", "'", "“", "《", "<", "，", ",", ">", "》", "。", ".", "?", "？", "/"
        };
        /// <summary>
        /// 校验排序方向，防止SQL注入。仅允许 ASC / DESC，其它值返回 "ASC"
        /// </summary>
        public static string SanitizeOrderDirection(string direction)
        {
            if (direction == null) return "ASC";
            var d = direction.Trim().ToUpperInvariant();
            return d == "DESC" ? "DESC" : "ASC";
        }

        /// <summary>
        /// 危险SQL关键字正则（用于校验SQL片段，防止注入）
        /// </summary>
        private static readonly System.Text.RegularExpressions.Regex _dangerousSqlRegex = new System.Text.RegularExpressions.Regex(
            @"\b(INSERT|DELETE|UPDATE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|GRANT|REVOKE|UNION|INTO)\b|;|--|\bXP_|\bSP_|/\*|\*/",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.Compiled);

        /// <summary>
        /// 校验SQL片段是否安全（用于 _AppendSelect / _AppendHaving 等前端可传入的SQL片段）。
        /// 拒绝包含危险关键字（INSERT/DELETE/UPDATE/DROP/UNION等）和注释符号的片段。
        /// </summary>
        public static bool IsSafeSqlFragment(string fragment)
        {
            if (string.IsNullOrWhiteSpace(fragment)) return false;
            return !_dangerousSqlRegex.IsMatch(fragment);
        }

        /// <summary>
        /// 转义SQL字符串值中的单引号，防止SQL注入。用于模板替换场景（$Keyword$、$CurrentUser.xxx$、$V8.Form.xxx$）。
        /// </summary>
        public static string EscapeSqlValue(string value)
        {
            return value?.Replace("'", "''");
        }

        /// <summary>
        /// 字段或表名称不能存在的字符
        /// </summary>
        public static readonly List<string> TableFieldNameNotChar = new List<string>()
        {
            " ", "　", "~", "`", "！", "!", "@", "#", "￥", "$", "%", "^", "……", "&", "*", "(", ")", "（", "）", "——", "-", "+", "=",
            "{", "}", "【", "】", "[", "]", "\\", "、", "|", ";", ":", "；", "‘", "'", "“", "《", "<", "，", ",", ">", "》", "。", ".", "?", "？", "/"
        };
        /// <summary>
        /// 
        /// </summary>
        /// <param name="strData"></param>
        /// <returns></returns>
        public static string SHA256Encode(string strData)
        {
            byte[] bytValue = System.Text.Encoding.UTF8.GetBytes(strData);
            SHA256 sha256 = new SHA256CryptoServiceProvider();

            byte[] retVal = sha256.ComputeHash(bytValue);
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < retVal.Length; i++)
            {
                sb.Append(retVal[i].ToString("x2"));
            }
            return sb.ToString();
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="action"></param>
        public static void TryAction(Action action)
        {
            try
            {
                action();
            }
            catch (Exception ex)
            {
            }
        }

        /// <summary>
        /// 检验字段名称，不能数字开头，中间不能有空格、特殊字符
        /// </summary>
        /// <returns></returns>
        public static string FilterTableFieldName(string name)
        {
            if (name == null)
            {
                return null;
            }
            if (name.DosIsNullOrWhiteSpace())
            {
                return "";
            }
            foreach (var item in TableFieldNameNotChar)
            {
                name = name.Replace(item, "");
            }
            return name;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="selectSql"></param>
        /// <returns></returns>
        public static bool CheckSqlOnlySelect(string selectSql)
        {
            if (selectSql.DosIsNullOrWhiteSpace())
            {
                return false;
            }
            // 使用正则 \b 词边界匹配，防止 tab/换行/注释绕过
            return !System.Text.RegularExpressions.Regex.IsMatch(
                selectSql,
                @"\b(DELETE|INSERT|UPDATE|DROP|ALTER|CREATE|TRUNCATE|SHOW|USE|MYSQL|EXEC|EXECUTE|GRANT|REVOKE)\b",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        public static string GetNo()
        {
            var year = DateTime.Now.Year.ToString().Substring(2, 2);
            return year + DateTime.Now.ToString("MMddHHmmssfff");
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="email"></param>
        /// <returns></returns>
        public static bool IsEmail(string email)
        {
            return System.Text.RegularExpressions.Regex.IsMatch(email, @"^([\w-\.]+)@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.)|(([\w-]+\.)+))([a-zA-Z]{2,4}|[0-9]{1,3})(\]?)$");
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="IdNo"></param>
        /// <returns></returns>
        public static int GetAge(string IdNo)
        {
            try
            {
                if (IdNo.DosIsNullOrWhiteSpace())
                {
                    return -1;
                }
                if (IdNo.Length == 18)
                {
                    var birth = IdNo.Substring(6, 4) + "-" + IdNo.Substring(10, 2) + "-" + IdNo.Substring(12, 2);
                    var age = DateTime.Now.Year - DateTime.Parse(birth).Year;
                    return age;
                }
                else if (IdNo.Length == 10 && IdNo.Contains('-'))
                {
                    var age = DateTime.Now.Year - DateTime.Parse(IdNo).Year;
                    return age;
                }
                return -1;
            }
            catch (Exception)
            {
                return -1;
            }
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="dbType"></param>
        /// <returns></returns>
        public static DatabaseType GetDbType(string dbType)
        {
            if (dbType.DosIsNullOrWhiteSpace())
            {
                return DatabaseType.MySql;
            }
            else if (dbType.ToLower() == "mysql")
            {
                return DatabaseType.MySql;
            }
            else if (dbType.ToLower() == "sqlserver9")
            {
                return DatabaseType.SqlServer9;
            }
            else if (dbType.ToLower() == "sqlserver")
            {
                return DatabaseType.SqlServer;
            }
            else if (dbType.ToLower() == "sqlite3")
            {
                return DatabaseType.Sqlite3;
            }
            else if (dbType.ToLower() == "oracle")
            {
                return DatabaseType.Oracle;
            }
            else if (dbType.ToLower() == "msaccess")
            {
                return DatabaseType.MsAccess;
            }
            return DatabaseType.MySql;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="value"></param>
        /// <param name="length"></param>
        /// <returns></returns>
        public static string Add0(string value, int length)
        {
            if (value.DosIsNullOrWhiteSpace())
            {
                return value;
            }
            var count0 = length - value.Length;
            for (var index = 0; index < count0; index++)
            {
                value = "0" + value;
            }
            return value;
        }



        /// <summary>
        /// 
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="table"></param>
        /// <returns></returns>
        public static List<T> ConvertTo<T>(DataTable table)
        {
            if (table == null)
            {
                return null;
            }

            List<DataRow> rows = new List<DataRow>();

            foreach (DataRow row in table.Rows)
            {
                rows.Add(row);
            }

            return ConvertTo<T>(rows);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="rows"></param>
        /// <returns></returns>
        public static List<T> ConvertTo<T>(List<DataRow> rows)
        {
            List<T> list = null;

            if (rows != null)
            {
                list = new List<T>();

                foreach (DataRow row in rows)
                {
                    T item = CreateItem<T>(row);
                    list.Add(item);
                }
            }

            return list;
        }
        ///    
        public static T CreateItem<T>(DataRow row)
        {
            T obj = default(T);
            if (row != null)
            {
                obj = Activator.CreateInstance<T>();

                foreach (DataColumn column in row.Table.Columns)
                {
                    PropertyInfo prop = obj.GetType().GetProperty(column.ColumnName);
                    try
                    {
                        object value = row[column.ColumnName];
                        prop.SetValue(obj, value, null);
                    }
                    catch
                    {  //You can log something here    
                       //throw;   
                    }
                }
            }

            return obj;
        }
    }
    /// <summary>
    /// 
    /// </summary>

}


