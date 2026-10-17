using System;
using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    /// <summary>AI 域输出已授权的文本增量和结构化执行摘要；宿主只负责流式传输。</summary>
    public interface IAiEventStream
    {
        Task<DosResult> ChatEventsWithContextAsync(AiParam param, Func<string, string, Task> onEvent);
    }
}
