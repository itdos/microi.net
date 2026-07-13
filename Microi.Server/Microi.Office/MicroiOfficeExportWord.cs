using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using Dos.Common;
using D = DocumentFormat.OpenXml.Drawing;
using PIC = DocumentFormat.OpenXml.Drawing.Pictures;
using WP = DocumentFormat.OpenXml.Drawing.Wordprocessing;
using W = DocumentFormat.OpenXml.Wordprocessing;

namespace Microi.net
{
    public partial class MicroiOffice : IMicroiOffice
    {
        public DosResult<byte[]> ExportWord(dynamic dynamicParam)
        {
            var param = ConvertDynamicParam<OfficeExportWordParam>(dynamicParam);
            return ExportWordAsync(param).ConfigureAwait(false).GetAwaiter().GetResult();
        }

        public Task<DosResult<byte[]>> ExportWordAsync(OfficeExportWordParam param)
        {
            param = param ?? new OfficeExportWordParam();
            try
            {
                if (!HasWordContent(param))
                {
                    return Task.FromResult(new DosResult<byte[]>(
                        0,
                        null,
                        DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang)
                    ));
                }

                byte[] result;
                using (var stream = new MemoryStream())
                {
                    using (var document = WordprocessingDocument.Create(stream, WordprocessingDocumentType.Document, true))
                    {
                        document.PackageProperties.Title = param.Title;
                        document.PackageProperties.Creator = param.Author;
                        document.PackageProperties.Subject = param.Subject;
                        document.PackageProperties.Keywords = param.Keywords;
                        document.PackageProperties.Description = param.Description;
                        var mainPart = document.AddMainDocumentPart();
                        mainPart.Document = new W.Document();
                        AddWordStyles(mainPart, param);

                        var body = new W.Body();
                        mainPart.Document.Append(body);
                        uint drawingId = 1;

                        if (!string.IsNullOrWhiteSpace(param.Title))
                        {
                            body.Append(CreateWordParagraph(param.Title, param, new OfficeWordParagraphParam
                            {
                                Alignment = param.TitleAlignment,
                                Bold = true,
                                FontSize = param.TitleFontSize,
                                SpacingAfter = 8
                            }));
                        }
                        if (!string.IsNullOrWhiteSpace(param.Subtitle))
                        {
                            body.Append(CreateWordParagraph(param.Subtitle, param, new OfficeWordParagraphParam
                            {
                                Alignment = param.TitleAlignment,
                                FontSize = param.SubtitleFontSize,
                                FontColor = "666666",
                                SpacingAfter = 12
                            }));
                        }

                        AppendWordParagraphs(body, param.Paragraphs, param);
                        AppendWordContent(body, param.Content, param);
                        AppendWordLines(body, param.Lines, param);
                        AppendWordTables(body, param.Tables, param);
                        AppendWordImages(mainPart, body, param.Images, param, ref drawingId);

                        foreach (var section in param.Sections ?? new List<OfficeWordSectionParam>())
                        {
                            AppendWordSection(mainPart, body, section, param, ref drawingId);
                        }

                        body.Append(CreateWordSectionProperties(mainPart, param));
                        mainPart.Document.Save();
                    }
                    result = stream.ToArray();
                }
                return Task.FromResult(new DosResult<byte[]>(1, result));
            }
            catch (Exception ex)
            {
                return Task.FromResult(new DosResult<byte[]>(0, null, ex.Message));
            }
        }

        private static bool HasWordContent(OfficeExportWordParam param)
        {
            return !string.IsNullOrWhiteSpace(param.Title)
                || !string.IsNullOrWhiteSpace(param.Subtitle)
                || !string.IsNullOrWhiteSpace(param.Content)
                || (param.Lines?.Any() == true)
                || (param.Paragraphs?.Any() == true)
                || (param.Sections?.Any() == true)
                || (param.Tables?.Any() == true)
                || (param.Images?.Any() == true);
        }

        private static void AddWordStyles(MainDocumentPart mainPart, OfficeExportWordParam param)
        {
            var stylesPart = mainPart.AddNewPart<StyleDefinitionsPart>();
            var fontFamily = GetFontFamily(param.FontFamily);
            var defaultRunProperties = new W.RunPropertiesDefault(
                new W.RunPropertiesBaseStyle(
                    new W.RunFonts
                    {
                        Ascii = fontFamily,
                        HighAnsi = fontFamily,
                        EastAsia = fontFamily
                    },
                    new W.FontSize { Val = ToHalfPoints(param.FontSize ?? 10.5) },
                    new W.FontSizeComplexScript { Val = ToHalfPoints(param.FontSize ?? 10.5) }
                )
            );
            stylesPart.Styles = new W.Styles(
                new W.DocDefaults(defaultRunProperties, new W.ParagraphPropertiesDefault())
            );
            stylesPart.Styles.Save();
        }

        private static void AppendWordSection(
            MainDocumentPart mainPart,
            W.Body body,
            OfficeWordSectionParam section,
            OfficeExportWordParam param,
            ref uint drawingId)
        {
            if (section == null) return;
            if (!string.IsNullOrWhiteSpace(section.Heading))
            {
                var level = Math.Max(1, Math.Min(6, section.HeadingLevel ?? 1));
                body.Append(CreateWordParagraph(section.Heading, param, new OfficeWordParagraphParam
                {
                    Bold = true,
                    FontSize = Math.Max(11, (param.TitleFontSize ?? 20) - level * 2),
                    SpacingBefore = level == 1 ? 12 : 8,
                    SpacingAfter = 6,
                    PageBreakBefore = section.PageBreakBefore
                }));
            }
            else if (section.PageBreakBefore == true)
            {
                body.Append(new W.Paragraph(new W.Run(new W.Break { Type = W.BreakValues.Page })));
            }

            AppendWordContent(body, section.Content, param);
            AppendWordParagraphs(body, section.Paragraphs, param);
            AppendWordTables(body, section.Tables, param);
            AppendWordImages(mainPart, body, section.Images, param, ref drawingId);
        }

        private static void AppendWordContent(W.Body body, string content, OfficeExportWordParam param)
        {
            if (string.IsNullOrWhiteSpace(content)) return;
            AppendWordLines(body, SplitLines(content), param);
        }

        private static void AppendWordLines(W.Body body, IEnumerable<string> lines, OfficeExportWordParam param)
        {
            if (lines == null) return;
            foreach (var line in lines)
            {
                body.Append(CreateWordParagraph(line ?? string.Empty, param, null));
            }
        }

        private static void AppendWordParagraphs(W.Body body, IEnumerable<OfficeWordParagraphParam> paragraphs, OfficeExportWordParam param)
        {
            if (paragraphs == null) return;
            foreach (var paragraph in paragraphs)
            {
                if (paragraph == null) continue;
                body.Append(CreateWordParagraph(paragraph.Text ?? string.Empty, param, paragraph));
            }
        }

        private static W.Paragraph CreateWordParagraph(string text, OfficeExportWordParam documentParam, OfficeWordParagraphParam paragraphParam)
        {
            paragraphParam = paragraphParam ?? new OfficeWordParagraphParam();
            var properties = new W.ParagraphProperties();
            if (paragraphParam.PageBreakBefore == true)
            {
                properties.Append(new W.PageBreakBefore());
            }
            properties.Append(new W.SpacingBetweenLines
            {
                Before = ToTwipsString(paragraphParam.SpacingBefore ?? 0),
                After = ToTwipsString(paragraphParam.SpacingAfter ?? documentParam.ParagraphSpacingAfter ?? 6),
                Line = Math.Max(1, (int)Math.Round((paragraphParam.LineSpacing ?? documentParam.LineSpacing ?? 1.25) * 240)).ToString(CultureInfo.InvariantCulture),
                LineRule = W.LineSpacingRuleValues.Auto
            });
            if ((paragraphParam.FirstLineIndent ?? 0) > 0)
            {
                properties.Append(new W.Indentation { FirstLine = ToTwipsString(paragraphParam.FirstLineIndent.Value) });
            }
            properties.Append(new W.Justification { Val = ToWordAlignment(paragraphParam.Alignment) });

            var runProperties = new W.RunProperties();
            var fontFamily = GetFontFamily(paragraphParam.FontFamily ?? documentParam.FontFamily);
            runProperties.Append(new W.RunFonts
            {
                Ascii = fontFamily,
                HighAnsi = fontFamily,
                EastAsia = fontFamily
            });
            if (paragraphParam.Bold == true) runProperties.Append(new W.Bold());
            if (paragraphParam.Italic == true) runProperties.Append(new W.Italic());
            runProperties.Append(new W.Color { Val = NormalizeHexColor(paragraphParam.FontColor ?? documentParam.FontColor, "000000") });
            runProperties.Append(new W.FontSize { Val = ToHalfPoints(paragraphParam.FontSize ?? documentParam.FontSize ?? 10.5) });
            if (paragraphParam.Underline == true) runProperties.Append(new W.Underline { Val = W.UnderlineValues.Single });

            var textElement = new W.Text(text ?? string.Empty) { Space = SpaceProcessingModeValues.Preserve };
            return new W.Paragraph(properties, new W.Run(runProperties, textElement));
        }

        private static void AppendWordTables(W.Body body, IEnumerable<OfficeWordTableParam> tables, OfficeExportWordParam param)
        {
            if (tables == null) return;
            foreach (var tableParam in tables)
            {
                if (tableParam == null) continue;
                if (!string.IsNullOrWhiteSpace(tableParam.Title))
                {
                    body.Append(CreateWordParagraph(tableParam.Title, param, new OfficeWordParagraphParam
                    {
                        Bold = true,
                        SpacingBefore = 8,
                        SpacingAfter = 4
                    }));
                }
                body.Append(CreateWordTable(tableParam, param));
            }
        }

        private static W.Table CreateWordTable(OfficeWordTableParam param, OfficeExportWordParam documentParam)
        {
            var borderColor = NormalizeHexColor(param.BorderColor, "B7C9D6");
            var borders = new W.TableBorders(
                CreateWordBorder<W.TopBorder>(borderColor),
                CreateWordBorder<W.LeftBorder>(borderColor),
                CreateWordBorder<W.BottomBorder>(borderColor),
                CreateWordBorder<W.RightBorder>(borderColor),
                CreateWordBorder<W.InsideHorizontalBorder>(borderColor),
                CreateWordBorder<W.InsideVerticalBorder>(borderColor)
            );
            var table = new W.Table(
                new W.TableProperties(
                    new W.TableWidth { Width = "5000", Type = W.TableWidthUnitValues.Pct },
                    new W.TableJustification { Val = ToTableAlignment(param.Alignment) },
                    borders
                )
            );

            var columnCount = Math.Max(
                param.Headers?.Count ?? 0,
                param.Rows?.Select(row => row?.Count ?? 0).DefaultIfEmpty(0).Max() ?? 0
            );
            if (columnCount == 0) return table;

            var grid = new W.TableGrid();
            for (var index = 0; index < columnCount; index++)
            {
                var width = index < (param.ColumnWidths?.Count ?? 0)
                    ? CentimetersToTwips(param.ColumnWidths[index])
                    : 2400;
                grid.Append(new W.GridColumn { Width = Math.Max(100, width).ToString(CultureInfo.InvariantCulture) });
            }
            table.Append(grid);

            if (param.Headers?.Any() == true)
            {
                var headerRow = new W.TableRow();
                for (var index = 0; index < columnCount; index++)
                {
                    var value = index < param.Headers.Count ? param.Headers[index] : string.Empty;
                    headerRow.Append(CreateWordTableCell(
                        value,
                        param.HeaderBackgroundColor,
                        param.HeaderFontColor,
                        param.HeaderBold == true,
                        param.FontSize ?? documentParam.FontSize ?? 10.5,
                        documentParam
                    ));
                }
                table.Append(headerRow);
            }

            foreach (var rowData in param.Rows ?? new List<List<object>>())
            {
                var row = new W.TableRow();
                for (var index = 0; index < columnCount; index++)
                {
                    var value = index < (rowData?.Count ?? 0) ? Convert.ToString(rowData[index], CultureInfo.InvariantCulture) : string.Empty;
                    row.Append(CreateWordTableCell(
                        value,
                        "FFFFFF",
                        documentParam.FontColor,
                        false,
                        param.FontSize ?? documentParam.FontSize ?? 10.5,
                        documentParam
                    ));
                }
                table.Append(row);
            }
            return table;
        }

        private static W.TableCell CreateWordTableCell(
            string text,
            string backgroundColor,
            string fontColor,
            bool bold,
            double fontSize,
            OfficeExportWordParam documentParam)
        {
            return new W.TableCell(
                new W.TableCellProperties(
                    new W.Shading { Val = W.ShadingPatternValues.Clear, Fill = NormalizeHexColor(backgroundColor, "FFFFFF") },
                    new W.TableCellVerticalAlignment { Val = W.TableVerticalAlignmentValues.Center }
                ),
                CreateWordParagraph(text ?? string.Empty, documentParam, new OfficeWordParagraphParam
                {
                    Bold = bold,
                    FontSize = fontSize,
                    FontColor = fontColor,
                    SpacingAfter = 0
                })
            );
        }

        private static T CreateWordBorder<T>(string color) where T : W.BorderType, new()
        {
            return new T
            {
                Val = W.BorderValues.Single,
                Color = color,
                Size = 4
            };
        }

        private static void AppendWordImages(
            MainDocumentPart mainPart,
            W.Body body,
            IEnumerable<OfficeExportImageParam> images,
            OfficeExportWordParam param,
            ref uint drawingId)
        {
            if (images == null) return;
            foreach (var image in images)
            {
                if (image == null || string.IsNullOrWhiteSpace(image.FileByteBase64)) continue;
                var paragraph = new W.Paragraph(
                    new W.ParagraphProperties(new W.Justification { Val = ToWordAlignment(image.Alignment) })
                );
                paragraph.Append(new W.Run(CreateWordImage(mainPart, image, drawingId++)));
                body.Append(paragraph);
                if (!string.IsNullOrWhiteSpace(image.Caption))
                {
                    body.Append(CreateWordParagraph(image.Caption, param, new OfficeWordParagraphParam
                    {
                        Alignment = image.Alignment,
                        FontSize = Math.Max(8, (param.FontSize ?? 10.5) - 1),
                        FontColor = "666666",
                        SpacingAfter = 6
                    }));
                }
            }
        }

        private static W.Drawing CreateWordImage(MainDocumentPart mainPart, OfficeExportImageParam image, uint drawingId)
        {
            var bytes = DecodeOfficeBase64(image.FileByteBase64);
            var imagePart = mainPart.AddImagePart(ToImagePartType(image.ContentType, image.FileName));
            using (var imageStream = new MemoryStream(bytes))
            {
                imagePart.FeedData(imageStream);
            }
            var relationshipId = mainPart.GetIdOfPart(imagePart);
            var width = CentimetersToEmu(image.Width ?? 15);
            var height = CentimetersToEmu(image.Height ?? 9);
            var name = string.IsNullOrWhiteSpace(image.FileName) ? $"Image {drawingId}" : image.FileName;

            return new W.Drawing(
                new WP.Inline(
                    new WP.Extent { Cx = width, Cy = height },
                    new WP.EffectExtent { LeftEdge = 0, TopEdge = 0, RightEdge = 0, BottomEdge = 0 },
                    new WP.DocProperties { Id = drawingId, Name = name },
                    new WP.NonVisualGraphicFrameDrawingProperties(new D.GraphicFrameLocks { NoChangeAspect = true }),
                    new D.Graphic(
                        new D.GraphicData(
                            new PIC.Picture(
                                new PIC.NonVisualPictureProperties(
                                    new PIC.NonVisualDrawingProperties { Id = 0, Name = name },
                                    new PIC.NonVisualPictureDrawingProperties()
                                ),
                                new PIC.BlipFill(
                                    new D.Blip { Embed = relationshipId },
                                    new D.Stretch(new D.FillRectangle())
                                ),
                                new PIC.ShapeProperties(
                                    new D.Transform2D(
                                        new D.Offset { X = 0, Y = 0 },
                                        new D.Extents { Cx = width, Cy = height }
                                    ),
                                    new D.PresetGeometry(new D.AdjustValueList()) { Preset = D.ShapeTypeValues.Rectangle }
                                )
                            )
                        ) { Uri = "http://schemas.openxmlformats.org/drawingml/2006/picture" }
                    )
                )
                {
                    DistanceFromTop = 0,
                    DistanceFromBottom = 0,
                    DistanceFromLeft = 0,
                    DistanceFromRight = 0
                }
            );
        }

        private static W.SectionProperties CreateWordSectionProperties(MainDocumentPart mainPart, OfficeExportWordParam param)
        {
            var section = new W.SectionProperties();
            if (!string.IsNullOrWhiteSpace(param.HeaderText))
            {
                var headerPart = mainPart.AddNewPart<HeaderPart>();
                headerPart.Header = new W.Header(CreateWordParagraph(param.HeaderText, param, new OfficeWordParagraphParam
                {
                    Alignment = "Center",
                    FontSize = Math.Max(8, (param.FontSize ?? 10.5) - 1),
                    FontColor = "666666",
                    SpacingAfter = 0
                }));
                headerPart.Header.Save();
                section.Append(new W.HeaderReference
                {
                    Type = W.HeaderFooterValues.Default,
                    Id = mainPart.GetIdOfPart(headerPart)
                });
            }
            if (!string.IsNullOrWhiteSpace(param.FooterText) || param.ShowPageNumber == true)
            {
                var footerPart = mainPart.AddNewPart<FooterPart>();
                var paragraph = CreateWordParagraph(param.FooterText ?? string.Empty, param, new OfficeWordParagraphParam
                {
                    Alignment = "Center",
                    FontSize = Math.Max(8, (param.FontSize ?? 10.5) - 1),
                    FontColor = "666666",
                    SpacingAfter = 0
                });
                if (param.ShowPageNumber == true)
                {
                    paragraph.Append(new W.Run(new W.Text(string.IsNullOrWhiteSpace(param.FooterText) ? string.Empty : "  ")));
                    paragraph.Append(
                        new W.Run(new W.FieldChar { FieldCharType = W.FieldCharValues.Begin }),
                        new W.Run(new W.FieldCode(" PAGE ") { Space = SpaceProcessingModeValues.Preserve }),
                        new W.Run(new W.FieldChar { FieldCharType = W.FieldCharValues.End })
                    );
                }
                footerPart.Footer = new W.Footer(paragraph);
                footerPart.Footer.Save();
                section.Append(new W.FooterReference
                {
                    Type = W.HeaderFooterValues.Default,
                    Id = mainPart.GetIdOfPart(footerPart)
                });
            }

            var isLandscape = string.Equals(param.Orientation, "Landscape", StringComparison.OrdinalIgnoreCase);
            var isLetter = string.Equals(param.PageSize, "Letter", StringComparison.OrdinalIgnoreCase);
            uint width = isLetter ? 12240U : 11906U;
            uint height = isLetter ? 15840U : 16838U;
            if (isLandscape)
            {
                var temp = width;
                width = height;
                height = temp;
            }
            section.Append(new W.PageSize
            {
                Width = width,
                Height = height,
                Orient = isLandscape ? W.PageOrientationValues.Landscape : W.PageOrientationValues.Portrait
            });
            section.Append(new W.PageMargin
            {
                Top = CentimetersToTwips(param.MarginTop ?? 2.54),
                Right = (uint)CentimetersToTwips(param.MarginRight ?? 2.54),
                Bottom = CentimetersToTwips(param.MarginBottom ?? 2.54),
                Left = (uint)CentimetersToTwips(param.MarginLeft ?? 2.54),
                Header = 720,
                Footer = 720,
                Gutter = 0
            });
            return section;
        }

        private static List<string> SplitLines(string content)
        {
            return (content ?? string.Empty)
                .Replace("\r\n", "\n")
                .Replace("\r", "\n")
                .Split(new[] { "\n" }, StringSplitOptions.None)
                .ToList();
        }

        private static W.JustificationValues ToWordAlignment(string alignment)
        {
            if (string.Equals(alignment, "Center", StringComparison.OrdinalIgnoreCase)) return W.JustificationValues.Center;
            if (string.Equals(alignment, "Right", StringComparison.OrdinalIgnoreCase)) return W.JustificationValues.Right;
            if (string.Equals(alignment, "Justify", StringComparison.OrdinalIgnoreCase)) return W.JustificationValues.Both;
            return W.JustificationValues.Left;
        }

        private static W.TableRowAlignmentValues ToTableAlignment(string alignment)
        {
            if (string.Equals(alignment, "Left", StringComparison.OrdinalIgnoreCase)) return W.TableRowAlignmentValues.Left;
            if (string.Equals(alignment, "Right", StringComparison.OrdinalIgnoreCase)) return W.TableRowAlignmentValues.Right;
            return W.TableRowAlignmentValues.Center;
        }

        private static string ToHalfPoints(double points)
        {
            return Math.Max(2, (int)Math.Round(points * 2)).ToString(CultureInfo.InvariantCulture);
        }

        private static string ToTwipsString(double points)
        {
            return Math.Max(0, (int)Math.Round(points * 20)).ToString(CultureInfo.InvariantCulture);
        }

        private static int CentimetersToTwips(double centimeters)
        {
            return Math.Max(0, (int)Math.Round(centimeters / 2.54 * 1440));
        }

        private static long CentimetersToEmu(double centimeters)
        {
            return Math.Max(1, (long)Math.Round(centimeters / 2.54 * 914400));
        }

        private static string GetFontFamily(string fontFamily)
        {
            return string.IsNullOrWhiteSpace(fontFamily) ? "Microsoft YaHei" : fontFamily.Trim();
        }

        private static string NormalizeHexColor(string color, string fallback)
        {
            var value = string.IsNullOrWhiteSpace(color) ? fallback : color.Trim().TrimStart('#');
            if (value.Length == 8) value = value.Substring(2);
            return value.Length == 6 && value.All(Uri.IsHexDigit) ? value.ToUpperInvariant() : fallback;
        }

        private static byte[] DecodeOfficeBase64(string base64)
        {
            var value = (base64 ?? string.Empty).Trim();
            var commaIndex = value.IndexOf(',');
            if (value.StartsWith("data:", StringComparison.OrdinalIgnoreCase) && commaIndex >= 0)
            {
                value = value.Substring(commaIndex + 1);
            }
            return Convert.FromBase64String(value);
        }

        private static PartTypeInfo ToImagePartType(string contentType, string fileName)
        {
            var value = ((contentType ?? string.Empty) + " " + (fileName ?? string.Empty)).ToLowerInvariant();
            if (value.Contains("gif")) return ImagePartType.Gif;
            if (value.Contains("bmp")) return ImagePartType.Bmp;
            if (value.Contains("tif")) return ImagePartType.Tiff;
            if (value.Contains("jpg") || value.Contains("jpeg")) return ImagePartType.Jpeg;
            return ImagePartType.Png;
        }
    }
}
