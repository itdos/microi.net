using System;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    /// <summary>可选的取消能力；保留旧 AI 接口签名以兼容既有模块。</summary>
    public interface IAiCancellableStream
    {
        Task<DosResult> ChatEventsWithContextAsync(AiParam param, Func<string, string, Task> onEvent, CancellationToken cancellationToken);
        Task<DosResult> NL2V8Engine(NL2V8Param param, Func<string, Task> onChunkReceived, CancellationToken cancellationToken);
    }
}
