using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;

namespace Microi.net
{
    public partial class DiyCommon
    {
         public static DbInfo GetDbInfo(string dbType)
        {
            if (dbType.ToLower() == "mysql")
                return new DbInfo() {
                    L = '`',
                    R = '`',
                    P = '?',
                    DbType = DatabaseType.MySql,
                    // DbService = _mySqlService
                };
            else if (dbType.ToLower().DosContains("sqlserver"))
                return new DbInfo()
                {
                    L = '[',
                    R = ']',
                    P = '@',
                    DbType = DatabaseType.SqlServer,
                    // DbService = _sqlServerService
                };
            else if (dbType.ToLower().DosContains("oracle"))
                return new DbInfo()
                {
                    L = '"',
                    R = '"',
                    P = ':',
                    DbType = DatabaseType.Oracle,
                    // DbService = _oracleService
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
        public static bool IsBase64String(string input)
        {
            // 检查字符串是否为空或空字符串
            if (string.IsNullOrEmpty(input))
            {
                return false;
            }

            // 检查字符串长度是否是4的倍数
            if (input.Length % 4 != 0)
            {
                return false;
            }

            // 检查字符串是否只包含合法的Base64字符
            foreach (char c in input)
            {
                if (!IsBase64Character(c))
                {
                    return false;
                }
            }

            // 尝试解码字符串
            try
            {
                Convert.FromBase64String(input);
                return true;
            }
            catch (FormatException)
            {
                return false;
            }
        }

        private static bool IsBase64Character(char c)
        {
            return (c >= 'A' && c <= 'Z') ||
                (c >= 'a' && c <= 'z') ||
                (c >= '0' && c <= '9') ||
                c == '+' || c == '/' || c == '=';
        }
        /// <summary>
        /// Equal、NotEqual、In、NotIn、Like、NotLike、StartLike、NotStartLike、EndLike、NotEndLike
        /// </summary>
        // public static Dictionary<string, string> FieldWhereTypes = new Dictionary<string, string>() {
        //     { "Equal", "="},
        //     { "=", "="},
        //     { "==", "="},
        //     { ">", ">"},
        //     { ">=", ">="},
        //     { "<=", "<="},
        //     { "<", "<"},
        //     { "NotEqual", "<>"},
        //     { "<>", "<>"},
        //     { "!=", "<>"},
        //     { "In", "IN"},
        //     { "NotIn", "NOT IN"},
        //     { "Like", "LIKE"},
        //     { "NotLike", "NOT LIKE"},
        //     { "StartLike", "LIKE"},
        //     { "NotStartLike", "NOT LIKE"},
        //     { "EndLike", "LIKE"},
        //     { "NotEndLike", "NOT LIKE"}
        // };
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
            "JoinForm", "OpenTable", "DevComponent", "PhoneSMS", "TableChild", "Button", "Divider"
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
            var sql = " " + selectSql.ToLower().ToString();
            if (sql.Contains(" delete ")
                || sql.Contains(" insert ")
                || sql.Contains(" update ")
                || sql.Contains(" drop ")
                || sql.Contains(" alter ")
                || sql.Contains(" create ")
                || sql.Contains(" truncate ")
                || sql.Contains(" show ")
                || sql.Contains(" use ")
                || sql.Contains(" mysql ")
                )
            {
                return false;
            }
            return true;
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


