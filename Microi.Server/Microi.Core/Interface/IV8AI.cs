using System;
using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    /// <summary>
    /// V8.AI 的租户与用户绑定能力面。
    /// 实现必须使用当前 V8 执行上下文中的 OsClient、CurrentUser 和本机 License，
    /// 不得信任脚本传入的租户、用户、Endpoint 或 ApiKey。
    /// </summary>
    public interface IV8AI
    {
        OnlineAiLicenseState GetLicenseState();

        Task<DosResult> Chat(AiParam param);

        Task<DosResult> ChatStream(
            AiParam param,
            Func<string, Task> onChunkReceived);

        Task<DosResult> RecognizeIntent(AiParam param);

        Task<DosResult> NL2SQL(NL2SQLParam param);

        Task<DosResult> NL2SQLStream(
            NL2SQLParam param,
            Func<string, Task> onChunkReceived);

        Task<DosResult> NL2V8(NL2V8Param param);

        Task<DosResult> NL2V8Stream(
            NL2V8Param param,
            Func<string, Task> onChunkReceived);
    }
}
