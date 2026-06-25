using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public interface ITranslateEngine
    {
        DosResult Translate(TranslateParam param);
        DosResult Translate(dynamic dynamicParam);
        DosResult Translate(object sourceText, object lang);
        DosResult Translate(object sourceText, object lang, object fromLangOrOsClient);
        DosResult Translate(object sourceText, object lang, object fromLang, object osClient);
        string GetLang(string key, string lang = "cn", string osClient = "");
        JObject GetLangData(string key, string osClient = "");
        string GetLangCode(string key, string osClient = "");
    }
}
