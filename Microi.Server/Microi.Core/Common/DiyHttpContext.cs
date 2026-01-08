#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：
* Copyright(c) Microi.net
* CLR 版本: 
* 创 建 人：Anderson
* 电子邮箱：973702@qq.com
* 创建日期：
* 文件描述：
******************************************************
* 修 改 人：
* 修改日期：
* 备注描述：
*******************************************************/
#endregion
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;

namespace Microi.net
{
    // / <summary>
    // / V1版本
    // / </summary>
    //public static class DiyHttpContext
    //{
    //    /// <summary>
    //    /// 
    //    /// </summary>
    //    public static IServiceProvider ServiceProvider;

    //    /// <summary>
    //    /// 
    //    /// </summary>
    //    public static Microsoft.AspNetCore.Http.HttpContext Current
    //    {
    //        get
    //        {
    //            object factory = ServiceProvider.GetService(typeof(Microsoft.AspNetCore.Http.IHttpContextAccessor));
    //            Microsoft.AspNetCore.Http.HttpContext context = ((Microsoft.AspNetCore.Http.HttpContextAccessor)factory).HttpContext;
    //            return context;
    //        }
    //    }
    //}

    /// <summary>
    /// V2
    /// </summary>
    public static class DiyHttpContext
    {
        private static IHttpContextAccessor _httpContextAccessor;
        /// <summary>
        /// 
        /// </summary>
        /// <param name="httpContextAccessor"></param>
        public static void Configure(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }
        /// <summary>
        /// 
        /// </summary>

        public static HttpContext Current => _httpContextAccessor.HttpContext;
    }
}
