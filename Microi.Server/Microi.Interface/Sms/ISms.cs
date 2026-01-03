using System;
using Dos.Common;

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
	public interface ISms
	{
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        DosResult Send(SmsParam param);
    }
}

