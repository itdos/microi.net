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

        /// <summary>
        /// 创建绑定当前 V8 租户和用户的 MiniMax 视频任务。
        /// 脚本不得传入供应商密钥、Endpoint、用户或租户。
        /// </summary>
        Task<DosResult> CreateMiniMaxVideo(MiniMaxVideoCreateParam param);

        /// <summary>
        /// 使用服务器签名的 TaskHandle 查询当前用户的视频任务。
        /// </summary>
        Task<DosResult> GetMiniMaxVideoTask(MiniMaxVideoTaskParam param);

        /// <summary>
        /// 使用服务器签名的 FileHandle 获取临时下载地址。
        /// </summary>
        Task<DosResult> GetMiniMaxVideoFile(MiniMaxVideoFileParam param);

        /// <summary>
        /// 平台管理员将当前用户的视频文件句柄转存到当前租户公有 HDFS。
        /// </summary>
        Task<DosResult> PersistMiniMaxVideoFile(MiniMaxVideoFileParam param);

        /// <summary>
        /// 平台管理员生成 MiniMax 无人声纯音乐并直接转存当前租户公有 HDFS。
        /// </summary>
        Task<DosResult> GenerateMiniMaxMusic(MiniMaxMusicGenerateParam param);
    }
}
