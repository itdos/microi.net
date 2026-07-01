using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Dos.Common;
using NPOI.XWPF.UserModel;

namespace Microi.net
{
    public partial class MicroiOffice : IMicroiOffice
    {
        private OfficeExportWordTextParam DynamicWordTextParam(dynamic dynamicParam)
        {
            return ConvertDynamicParam<OfficeExportWordTextParam>(dynamicParam);
        }

        public DosResult<byte[]> ExportWordText(dynamic dynamicParam)
        {
            var param = DynamicWordTextParam(dynamicParam);
            return ExportWordTextAsync(param).ConfigureAwait(false).GetAwaiter().GetResult();
        }

        public async System.Threading.Tasks.Task<DosResult<byte[]>> ExportWordTextAsync(OfficeExportWordTextParam param)
        {
            try
            {
                var lines = BuildWordTextLines(param);
                if (!lines.Any() && param.Title.DosIsNullOrWhiteSpace())
                {
                    return new DosResult<byte[]>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
                }

                using (var doc = new XWPFDocument())
                {
                    if (!param.Title.DosIsNullOrWhiteSpace())
                    {
                        var titlePara = doc.CreateParagraph();
                        titlePara.Alignment = ParagraphAlignment.CENTER;
                        titlePara.SpacingAfter = param.Compact == true ? 120 : 240;
                        var titleRun = titlePara.CreateRun();
                        titleRun.SetText(param.Title);
                        titleRun.IsBold = true;
                        titleRun.FontFamily = param.FontFamily.DosIsNullOrWhiteSpace() ? "Microsoft YaHei" : param.FontFamily;
                        titleRun.FontSize = param.TitleFontSize ?? 14;
                    }

                    foreach (var line in lines)
                    {
                        var para = doc.CreateParagraph();
                        para.Alignment = ParagraphAlignment.LEFT;
                        para.SpacingBefore = 0;
                        para.SpacingAfter = param.Compact == true ? (param.SpacingAfter ?? 40) : 120;

                        var run = para.CreateRun();
                        run.SetText(line ?? string.Empty);
                        run.FontFamily = param.FontFamily.DosIsNullOrWhiteSpace() ? "Microsoft YaHei" : param.FontFamily;
                        run.FontSize = param.FontSize ?? 9;
                    }

                    using (var ms = new MemoryStream())
                    {
                        doc.Write(ms);
                        return new DosResult<byte[]>(1, ms.ToArray());
                    }
                }
            }
            catch (Exception ex)
            {
                return new DosResult<byte[]>(0, null, ex.Message);
            }
        }

        private List<string> BuildWordTextLines(OfficeExportWordTextParam param)
        {
            if (param == null) return new List<string>();
            if (param.Lines != null && param.Lines.Any())
            {
                return param.Lines.Select(d => d ?? string.Empty).ToList();
            }
            if (param.Content.DosIsNullOrWhiteSpace()) return new List<string>();
            return param.Content
                .Replace("\r\n", "\n")
                .Replace("\r", "\n")
                .Split(new[] { "\n" }, StringSplitOptions.None)
                .Select(d => d ?? string.Empty)
                .ToList();
        }
    }
}
