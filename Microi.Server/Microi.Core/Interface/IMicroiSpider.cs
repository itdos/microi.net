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

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
    public interface IMicroiSpider
    {
        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        Task<DosResult> GetRenderHtml(MicroiSpiderParam param);

        /// <summary>
        /// 打开或复用一个本地浏览器采集会话，支持人工登录与登录态持久化。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        Task<DosResult> OpenSession(MicroiSpiderSessionParam param);

        /// <summary>
        /// 获取采集会话状态。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        Task<DosResult> GetSession(MicroiSpiderSessionParam param);

        /// <summary>
        /// 关闭采集会话。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        Task<DosResult> CloseSession(MicroiSpiderSessionParam param);

        /// <summary>
        /// 执行采集配方。manual步骤会暂停，用户人工操作后可用同一个SessionId和StartStepIndex继续执行。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        Task<DosResult> RunRecipe(MicroiSpiderRecipeParam param);
    }
}
