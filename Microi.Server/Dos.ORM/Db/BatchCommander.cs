#region << �� �� ע �� >>
/****************************************************
* �� �� ����
* Copyright(c) iTdos
* CLR �汾: 4.0.30319.18408
* �� �� �ˣ�steven hu
* �������䣺
* �ٷ���վ��www.iTdos.com
* �������ڣ�2010-2-10
* �ļ�������
******************************************************
* �� �� �ˣ�iTdos
* �޸����ڣ�
* ��ע������
*******************************************************/
#endregion

using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.Text;
using Dos;
using Dos.ORM;

namespace Dos.ORM
{
    /// <summary>
    /// BatchCommander is used to execute batch queries.
    /// </summary>
    public sealed class BatchCommander
    {
        #region Private Members

        private Database db;
        private int batchSize;
        private DbTransaction tran;
        private List<DbCommand> batchCommands;
        private bool isUsingOutsideTransaction = false;

        private DbCommand MergeCommands()
        {
            if (batchCommands.Count == 0)
            {
                DbCommand emptyCmd = db.GetSqlStringCommand(string.Empty);
                return emptyCmd;
            }

            DbCommand cmd = db.GetSqlStringCommand("init");
            
            // 预估 StringBuilder 容量：每个命令平均 200 字符
            var estimatedCapacity = batchCommands.Count * 200;
            var sb = new StringBuilder(estimatedCapacity);
            
            foreach (DbCommand item in batchCommands)
            {
                if (item.CommandType == CommandType.Text)
                {
                    // 添加参数
                    if (item.Parameters != null && item.Parameters.Count > 0)
                    {
                        foreach (DbParameter dbPara in item.Parameters)
                        {
                            DbParameter p = (DbParameter)((ICloneable)dbPara).Clone();
                            cmd.Parameters.Add(p);
                        }
                    }
                    
                    sb.Append(item.CommandText);
                    sb.Append(";");
                }
            }

            cmd.CommandText = sb.ToString();
            return cmd;
        }

        #endregion

        #region Public Members


        /// <summary>
        /// ִ��
        /// </summary>
        public void ExecuteBatch()
        {
            DbCommand cmd = MergeCommands();

            if (cmd.CommandText.Trim().Length > 0)
            {
                if (tran != null)
                {
                    cmd.Connection = tran.Connection;
                    cmd.Transaction = tran;

                }
                else
                {
                    cmd.Connection = db.GetConnection();
                }

                db.DbProvider.PrepareCommand(cmd);

                db.WriteLog(cmd);

                cmd.ExecuteNonQuery();
            }

            batchCommands.Clear();
        }

        /// <summary>
        /// Initializes a new instance of the <see cref="BatchCommander"/> class.
        /// </summary>
        /// <param name="db">The db.</param>
        /// <param name="batchSize">Size of the batch.</param>
        /// <param name="il">The il.</param>
        public BatchCommander(Database db, int batchSize, IsolationLevel il)
            : this(db, batchSize, db.BeginTransaction(il))
        {
            isUsingOutsideTransaction = false;
        }

        /// <summary>
        /// Initializes a new instance of the <see cref="BatchCommander"/> class.
        /// </summary>
        /// <param name="db">The db.</param>
        /// <param name="batchSize">Size of the batch.</param>
        /// <param name="tran">The tran.</param>
        public BatchCommander(Database db, int batchSize, DbTransaction tran)
        {
            Check.Require(db != null, "db could not be null.");
            Check.Require(batchSize > 0, "Arguments error - batchSize should > 0.");

            this.db = db;
            this.batchSize = batchSize;
            batchCommands = new List<DbCommand>(batchSize);
            this.tran = tran;
            if (tran != null)
            {
                isUsingOutsideTransaction = true;
            }

        }



        /// <summary>
        /// Initializes a new instance of the <see cref="BatchCommander"/> class.
        /// </summary>
        /// <param name="db">The db.</param>
        /// <param name="batchSize">Size of the batch.</param>
        public BatchCommander(Database db, int batchSize)
            : this(db, batchSize, db.BeginTransaction())
        {
            isUsingOutsideTransaction = false;
        }

        /// <summary>
        /// Processes the specified CMD.
        /// </summary>
        /// <param name="cmd">The CMD.</param>
        public void Process(DbCommand cmd)
        {
            if (cmd == null)
                return;

            // 清空连接和事务引用
            cmd.Transaction = null;
            cmd.Connection = null;

            batchCommands.Add(cmd);

            // 当不支持批处理或达到批处理大小时，执行批处理
            if (!db.DbProvider.SupportBatch || batchCommands.Count >= batchSize)
            {
                try
                {
                    ExecuteBatch();
                }
                catch
                {
                    if (tran != null && !isUsingOutsideTransaction)
                    {
                        try
                        {
                            tran.Rollback();
                        }
                        catch
                        {
                            // 忽略回滚异常
                        }
                    }
                    throw;
                }
            }
        }

        /// <summary>
        /// Closes this instance.
        /// </summary>
        public void Close()
        {
            try
            {
                ExecuteBatch();

                if (tran != null && !isUsingOutsideTransaction)
                {
                    try
                    {
                        tran.Commit();
                    }
                    catch
                    {
                        // 尝试回滚
                        try
                        {
                            tran.Rollback();
                        }
                        catch
                        {
                            // 忽略回滚异常
                        }
                        throw;
                    }
                }
            }
            finally
            {
                if (tran != null && !isUsingOutsideTransaction)
                {
                    try
                    {
                        db.CloseConnection(tran);
                    }
                    catch
                    {
                        // 忽略关闭异常
                    }
                }
            }
        }

        #endregion
    }
}
