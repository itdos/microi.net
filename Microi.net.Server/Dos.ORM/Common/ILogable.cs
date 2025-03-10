#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：
* Copyright(c) IT大师
* CLR 版本: 4.0.30319.18408
* 创 建 人：iTdos
* 电子邮箱：admin@iTdos.com
* 官方网站：www.iTdos.com
* 创建日期：2015/5/10 10:54:32
* 文件描述：
******************************************************
* 修 改 人：iTdos
* 修改日期：
* 备注描述：
*******************************************************/
#endregion
using System;
using System.Collections.Generic;
using System.Text;

namespace Dos.ORM
{
    /// <summary>
    /// A delegate used for log.
    /// </summary>
    /// <param name="logMsg">The msg to write to log.</param>
    public delegate void LogHandler(string logMsg);

    /// <summary>
    /// Mark a implementing class as loggable.
    /// </summary>
    interface ILogable
    {
        /// <summary>
        /// OnLog event.
        /// </summary>
        event LogHandler OnLog;
    }
}
