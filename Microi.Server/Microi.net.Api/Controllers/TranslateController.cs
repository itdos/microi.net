using System.Collections.Generic;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;

namespace Microi.net.Api
{
    /// <summary>
    /// Tenant-bound translation gateway. Provider URL, credentials and OsClient are
    /// always resolved on the server from the authenticated token and SaaS engine.
    /// </summary>
    [EnableCors("any")]
    [Route("api/[controller]/[action]")]
    public sealed class TranslateController : ControllerBase
    {
        private readonly ITranslateEngine _translate;

        public TranslateController(ITranslateEngine translate)
        {
            _translate = translate;
        }

        [HttpPost]
        [ServiceFilter(typeof(DiyFilter<dynamic>))]
        public async Task<DosResult<MicroiTranslateTextResult>> TranslateText(
            [FromBody] MicroiTranslateTextParam param)
        {
            param = param ?? new MicroiTranslateTextParam();
            var token = await DiyToken.GetCurrentToken(false);
            if (token?.CurrentUser == null || token.OsClient.DosIsNullOrWhiteSpace())
                return NoLogin<MicroiTranslateTextResult>(param.OsClient, param._Lang);
            param.OsClient = token.OsClient;
            return _translate.TranslateText(param);
        }

        [HttpPost]
        [ServiceFilter(typeof(DiyFilter<dynamic>))]
        public async Task<DosResult<List<MicroiTranslateDetection>>> Detect(
            [FromBody] MicroiTranslateDetectParam param)
        {
            param = param ?? new MicroiTranslateDetectParam();
            var token = await DiyToken.GetCurrentToken(false);
            if (token?.CurrentUser == null || token.OsClient.DosIsNullOrWhiteSpace())
                return NoLogin<List<MicroiTranslateDetection>>(param.OsClient, param._Lang);
            param.OsClient = token.OsClient;
            return _translate.Detect(param);
        }

        [HttpPost]
        [ServiceFilter(typeof(DiyFilter<dynamic>))]
        public async Task<DosResult<List<MicroiTranslateLanguage>>> Languages(
            [FromBody] BaseParam param)
        {
            param = param ?? new BaseParam();
            var token = await DiyToken.GetCurrentToken(false);
            if (token?.CurrentUser == null || token.OsClient.DosIsNullOrWhiteSpace())
                return NoLogin<List<MicroiTranslateLanguage>>(param.OsClient, param._Lang);
            return _translate.GetLanguages(token.OsClient);
        }

        [HttpPost]
        [ServiceFilter(typeof(DiyFilter<dynamic>))]
        [RequestSizeLimit(30 * 1024 * 1024)]
        public async Task<DosResult<MicroiTranslateFileResult>> TranslateFile(
            [FromBody] MicroiTranslateFileParam param)
        {
            param = param ?? new MicroiTranslateFileParam();
            var token = await DiyToken.GetCurrentToken(false);
            if (token?.CurrentUser == null || token.OsClient.DosIsNullOrWhiteSpace())
                return NoLogin<MicroiTranslateFileResult>(param.OsClient, param._Lang);
            param.OsClient = token.OsClient;
            return _translate.TranslateFile(param);
        }

        [HttpPost]
        [ServiceFilter(typeof(DiyFilter<dynamic>))]
        public async Task<DosResult<MicroiTranslateSuggestionResult>> Suggest(
            [FromBody] MicroiTranslateSuggestParam param)
        {
            param = param ?? new MicroiTranslateSuggestParam();
            var token = await DiyToken.GetCurrentToken(false);
            if (token?.CurrentUser == null || token.OsClient.DosIsNullOrWhiteSpace())
                return NoLogin<MicroiTranslateSuggestionResult>(param.OsClient, param._Lang);
            param.OsClient = token.OsClient;
            return _translate.Suggest(param);
        }

        [HttpPost]
        [ServiceFilter(typeof(DiyFilter<dynamic>))]
        public async Task<DosResult<MicroiTranslateHealthResult>> Health(
            [FromBody] BaseParam param)
        {
            param = param ?? new BaseParam();
            var token = await DiyToken.GetCurrentToken(false);
            if (token?.CurrentUser == null || token.OsClient.DosIsNullOrWhiteSpace())
                return NoLogin<MicroiTranslateHealthResult>(param.OsClient, param._Lang);
            return _translate.Health(token.OsClient);
        }

        private static DosResult<T> NoLogin<T>(string osClient, string lang)
        {
            return new DosResult<T>(1001, default(T), DiyMessage.GetLang(osClient, "NoLogin", lang));
        }
    }
}
