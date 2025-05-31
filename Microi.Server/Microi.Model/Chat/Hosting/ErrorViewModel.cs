using System;

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
    public class ErrorViewModel
    {
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string RequestId { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>

        public bool ShowRequestId => !string.IsNullOrEmpty(RequestId);
    }
}
