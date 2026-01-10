using System;
using System.Collections.Generic;
using System.Configuration;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;

namespace Dos.Common
{
    /// <summary>
    /// 日志帮助类。AppSettings节点可以配置Dos.LogHelper.Debug=0或Dos.LogHelper.Error=0来关闭日志记录。
    /// 如果不传入path参数，默认是在~/Log/下生成日志文件，也可以在AppSettings节点配置Dos.LogHelper.Path来设置默认日志文件路径，格式：D:\\File\\Log\\。
    /// </summary>
    public class LogHelper
    {
        private static readonly object Olock = new object();
        private enum LogHelperType
        {
            debug, error
        }
        /// <summary>
        /// 记录调试日志
        /// </summary>
        /// <Param name="content">内容。如需换行可使用：\r\n</Param>
        /// <Param name="filePrefixName"></Param>
        /// <Param name="path">格式：D:\\File\\Logs\\</Param>
        public static void Debug(string content, string filePrefixName = null, string path = null)
        {
            Write(LogHelperType.debug, content, filePrefixName, path);
        }
        /// <summary>
        /// 记录错误日志
        /// </summary>
        /// <Param name="content">内容。如需换行可使用：\r\n</Param>
        /// <Param name="filePrefixName"></Param>
        /// <Param name="path">格式：D:\\File\\Logs\\</Param>
        public static void Error(string content, string filePrefixName = null, string path = null)
        {
            Write(LogHelperType.error, content, filePrefixName, path);
        }

        /// <summary>
        /// filePrefixName是文件名前缀，最好用中文，方便在程序Logs文件下查看。
        /// </summary>
        /// <Param name="content">内容。如需换行可使用：\r\n</Param>
        /// <Param name="filePrefixName"></Param>
        /// <Param name="path"></Param>
        /// <Param name="logtype"></Param>
        private static void Write(LogHelperType logtype, string content, string filePrefixName = null, string path = null)
        {
            ThreadPool.QueueUserWorkItem((state) =>
            {
                lock (Olock)
                {
                    try
                    {
                        if (logtype == LogHelperType.debug)
                        {
#if NETFRAMEWORK
                            var dosDebug = ConfigurationManager.AppSettings["Dos.LogHelper.Debug"];
                            if (dosDebug != null && dosDebug != "1")
                            {
                                return;
                            }
#endif
                        }
                        else
                        {
#if NETFRAMEWORK
                            var dosError = ConfigurationManager.AppSettings["Dos.LogHelper.Error"];
                            if (dosError != null && dosError != "1")
                            {
                                return;
                            }
#endif
                        }
                        #region 日志文件



                        var fileName = filePrefixName + DateTime.Now.ToString("yyyyMMdd") + logtype.ToString() + ".txt";

                        if (string.IsNullOrWhiteSpace(path))
                        {
#if NETFRAMEWORK
                            var dosPath = ConfigurationManager.AppSettings["Dos.LogHelper.Path"];
#else
                            var dosPath = "";
#endif
                            if (string.IsNullOrWhiteSpace(dosPath))
                            {
                                path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Logs/", fileName);
                            }
                            else
                            {
                                path = Path.Combine(dosPath, fileName);
                            }
                        }
                        else
                        {
                            path += fileName;
                        }
                        var di = new DirectoryInfo(path.Replace(fileName, ""));
                        if (!di.Exists)
                        {
                            di.Create();
                        }
                        //判断文件大小，需要新开文件

                        //取今天共有多少个文件
                        var count = di.GetFiles(filePrefixName + DateTime.Now.ToString("yyyyMMdd") + logtype.ToString()).Length;
                        if (count > 1)
                        {
                            path = path.Replace(".txt", " - " + count + ".txt");
                        }

                        //如果文件体积较大
                        if (File.Exists(path) && new FileInfo(path).Length >= 1024 * 1024)
                        {
                            path = path.Replace(" - " + count + ".txt", " - " + count++ + ".txt");
                        }


                        using (var fs = new FileStream(path, FileMode.Append, FileAccess.Write))
                        using (var sw = new StreamWriter(fs))
                        {
                            sw.Write(DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff"));
                            sw.WriteLine();
                            sw.Write(content);
                            sw.WriteLine();
                            sw.Write("-----------------------------------------------------------------------------");
                            sw.WriteLine();
                            sw.Flush();
                        }
                        #endregion
                    }
                    catch
                    {
                    }
                }
            });

        }
    }
}
