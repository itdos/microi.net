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
using Dos.Common;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Http;

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
    public interface IMicroiOffice
    {
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        Task<DosResult<byte[]>> ExportWordByTpl(OfficeExportParam param);
        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        DosResult<byte[]> ExportExcel(dynamic dynamicParam);
        Task<DosResult<byte[]>> ExportExcelAsync(DiyTableRowParam param);
        Task<DosResult> ImportExcel(DiyTableRowParam param, HttpContext _httpContext = null);
        DosResult SendEmail(dynamic dynamicParam);
        Task<DosResult> SendEmailAsync(EmailParam param);
        DosResultList<dynamic> ExcelToList(dynamic dynamicParam);
    }
}
