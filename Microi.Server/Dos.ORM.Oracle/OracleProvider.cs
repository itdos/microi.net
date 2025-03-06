#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：
* Copyright(c) ITdos
* CLR 版本: 4.0.30319.18408
* 创 建 人：洪金波
* 创建日期：2016/6/10
* 文件描述：新增Oracle.ManagedDataAccess驱动
******************************************************/

#endregion

using System;
using System.Collections.Generic;
using System.Text;
using Oracle.ManagedDataAccess.Client;
using System.Data.Common;
using System.Data;
using Dos.ORM;
using Dos.ORM.Common;

namespace Dos.ORM.Oracle
{

    /// <summary>
    /// Oracle
    /// </summary>
    public class OracleProvider : DbProvider
    {

        public OracleProvider(string connectionString)
            : base(connectionString, OracleClientFactory.Instance, '"', '"', ':')
        {
        }

        public override string RowAutoID
        {
            get { return "select {0}.currval from dual"; }
        }

        public override bool SupportBatch
        {
            get { return true; }
        }

        public override string BuildTableName(string name, string userName)
        {
            userName = "";// "MICROI";
            if (string.IsNullOrWhiteSpace(userName))
            {
                //2023-07-21
                return string.Concat(name.Trim(leftToken, rightToken));
                return string.Concat(leftToken.ToString(), name.Trim(leftToken, rightToken), rightToken.ToString());
            }
            return string.Concat(userName.Trim(leftToken, rightToken))
                + "."
                + string.Concat(name.Trim(leftToken, rightToken));
        }

        /// <summary>
        /// 创建分页查询
        /// </summary>
        /// <param name="fromSection"></param>
        /// <param name="startIndex"></param>
        /// <param name="endIndex"></param>
        /// <returns></returns>
        public override FromSection CreatePageFromSection(FromSection fromSection, int startIndex, int endIndex)
        {
            //oracle 11g
            //Check.Require(startIndex, "startIndex", Check.GreaterThanOrEqual<int>(1));
            //Check.Require(endIndex, "endIndex", Check.GreaterThanOrEqual<int>(1));
            //Check.Require(startIndex <= endIndex, "startIndex must be less than endIndex!");
            //Check.Require(fromSection, "fromSection", Check.NotNullOrEmpty);
            ////Check.Require(fromSection.OrderByClip, "query.OrderByClip", Check.NotNullOrEmpty);

            //fromSection.TableName = string.Concat("(", fromSection.SqlString, ") tmpi_table");

            //fromSection.Select(new Field("tmpi_table.*"));
            //fromSection.AddSelect(new Field("rownum AS rn"));
            //fromSection.OrderBy(OrderByClip.None);
            ////fromSection.DistinctString = string.Empty;
            ////fromSection.PrefixString = string.Empty;
            //fromSection.GroupBy(GroupByClip.None);
            ////fromSection.Parameters = fromSection.Parameters;
            //fromSection.Where(new WhereClip("rownum <=" + endIndex.ToString()));
            //if (startIndex > 1)
            //{
            //    fromSection.TableName = string.Concat("(", fromSection.SqlString, ")");
            //    fromSection.Select(Field.All);
            //    fromSection.Where(new WhereClip(string.Concat("rn>=", startIndex.ToString())));
            //}


            //Oracle 12c：select * from DIY_TABLE ORDER BY NAME ASC OFFSET 1 ROWS FETCH NEXT 10 ROW ONLY;
            //2024-04-09：这个只是临时解决 oracle 11g的.First()，真正的分页要通过上面。 --by anderson
            if (startIndex == 1 && endIndex == 1)
            {
                fromSection.LimitString = $" AND ROWNUM = 1 ";
            }
            else
            {
                fromSection.LimitString = $" OFFSET {startIndex - 1} ROWS FETCH NEXT {endIndex - startIndex + 1} ROW ONLY ";// (startIndex - 1).ToString(), ",", (endIndex - startIndex + 1).ToString());
            }
            return fromSection;
        }


        /// <summary>
        /// 
        /// </summary>
        /// <param name="cmd"></param>
        public override void PrepareCommand(DbCommand cmd)
        {
            base.PrepareCommand(cmd);

            foreach (OracleParameter p in cmd.Parameters)
            {

                if (p.Direction == ParameterDirection.Output || p.Direction == ParameterDirection.ReturnValue)
                {
                    continue;
                }

                object value = p.Value;
                if (value == DBNull.Value)
                {
                    continue;
                }
                Type type = value.GetType();
                OracleParameter oracleParam = (OracleParameter)p;

                if (oracleParam.DbType != DbType.Guid && type == typeof(Guid))
                {
                    oracleParam.OracleDbType = OracleDbType.Char;
                    oracleParam.Size = 36;
                    continue;
                }

                if ((p.OracleDbType == OracleDbType.Date || p.OracleDbType == OracleDbType.TimeStamp) && type == typeof(TimeSpan))
                {
                    oracleParam.OracleDbType = OracleDbType.Double;
                    oracleParam.Value = ((TimeSpan)value).TotalDays;
                    continue;
                }

                switch (p.OracleDbType)
                {
                    case OracleDbType.Blob:
                        if (((byte[])value).Length > 2000)
                        {
                            oracleParam.OracleDbType = OracleDbType.Blob;
                        }
                        break;
                    case OracleDbType.Date:
                        oracleParam.OracleDbType = OracleDbType.Date;
                        break;
                    case OracleDbType.Varchar2:
                        if (value.ToString().Length > 4000)
                        {
                            oracleParam.OracleDbType = OracleDbType.Clob;
                        }
                        else if (value.ToString().Length > 2000)
                        {
                            oracleParam.OracleDbType = OracleDbType.NClob;
                        }
                        break;
                    case OracleDbType.NClob:
                        oracleParam.OracleDbType = OracleDbType.NClob;
                        p.Value = SerializationManager.Serialize(value);
                        break;
                    default:
                        break;
                }
            }
            //replace oracle specific function names in cmd.CommandText
            cmd.CommandText = cmd.CommandText
                //注释掉所有替换  --by Microi.net 2023-07-28
                //.Replace("N'", "'")//不能这样简单粗暴，会导致表名以N结尾的都报错。   --by Microi.net 2023-07-28 
                //.Replace("len(", "length(")
                //.Replace("substring(", "substr(")
                //.Replace("getdate()", "to_char(current_date,'dd-mon-yyyy hh:mi:ss')")
                //.Replace("isnull(", "nvl(")
                ;

            int startIndexOfCharIndex = cmd.CommandText.IndexOf("charindex(");
            while (startIndexOfCharIndex > 0)
            {
                int endIndexOfCharIndex = DataUtils.GetEndIndexOfMethod(cmd.CommandText, startIndexOfCharIndex + "charindex(".Length);
                string[] itemsInCharIndex = DataUtils.SplitTwoParamsOfMethodBody(
                    cmd.CommandText.Substring(startIndexOfCharIndex + "charindex(".Length,
                    endIndexOfCharIndex - startIndexOfCharIndex - "charindex(".Length));
                cmd.CommandText = cmd.CommandText.Substring(0, startIndexOfCharIndex)
                    + "instr(" + itemsInCharIndex[1] + "," + itemsInCharIndex[0] + ")"
                    + (cmd.CommandText.Length - 1 > endIndexOfCharIndex ?
                    cmd.CommandText.Substring(endIndexOfCharIndex + 1) : string.Empty);

                startIndexOfCharIndex = cmd.CommandText.IndexOf("charindex(", endIndexOfCharIndex);
            }

            //replace DATEPART with TO_CHAR(CURRENT_DATE,'XXXX')
            startIndexOfCharIndex = cmd.CommandText.IndexOf("datepart(");
            if (startIndexOfCharIndex > 0)
            {
                cmd.CommandText = cmd.CommandText
                    //.Replace("datepart(year", "to_char('yyyy'")
                    //.Replace("datepart(month", "to_char('mm'")
                    //.Replace("datepart(day", "to_char('dd'")
                    ;

                startIndexOfCharIndex = cmd.CommandText.IndexOf("to_char(");
                while (startIndexOfCharIndex > 0)
                {
                    int endIndexOfCharIndex = DataUtils.GetEndIndexOfMethod(cmd.CommandText, startIndexOfCharIndex + "to_char(".Length);
                    string[] itemsInCharIndex = DataUtils.SplitTwoParamsOfMethodBody(
                        cmd.CommandText.Substring(startIndexOfCharIndex + "to_char(".Length,
                        endIndexOfCharIndex - startIndexOfCharIndex - "to_char(".Length));
                    cmd.CommandText = cmd.CommandText.Substring(0, startIndexOfCharIndex)
                        + "to_char(" + itemsInCharIndex[1] + "," + itemsInCharIndex[0] + ")"
                        + (cmd.CommandText.Length - 1 > endIndexOfCharIndex ?
                        cmd.CommandText.Substring(endIndexOfCharIndex + 1) : string.Empty);

                    startIndexOfCharIndex = cmd.CommandText.IndexOf("to_char(", endIndexOfCharIndex);
                }
            }
        }
    }
}
