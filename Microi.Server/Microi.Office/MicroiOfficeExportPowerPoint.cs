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
using EP = DocumentFormat.OpenXml.ExtendedProperties;
using P = DocumentFormat.OpenXml.Presentation;

namespace Microi.net
{
    public partial class MicroiOffice : IMicroiOffice
    {
        private const string DrawingTableUri = "http://schemas.openxmlformats.org/drawingml/2006/table";

        public DosResult<byte[]> ExportPowerPoint(dynamic dynamicParam)
        {
            var param = ConvertDynamicParam<OfficeExportPowerPointParam>(dynamicParam);
            return ExportPowerPointAsync(param).ConfigureAwait(false).GetAwaiter().GetResult();
        }

        public Task<DosResult<byte[]>> ExportPowerPointAsync(OfficeExportPowerPointParam param)
        {
            param = param ?? new OfficeExportPowerPointParam();
            try
            {
                var slides = param.Slides ?? new List<OfficePowerPointSlideParam>();
                if (!slides.Any())
                {
                    if (string.IsNullOrWhiteSpace(param.Title))
                    {
                        return Task.FromResult(new DosResult<byte[]>(
                            0,
                            null,
                            DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang)
                        ));
                    }
                    slides.Add(new OfficePowerPointSlideParam
                    {
                        Layout = "TitleSlide",
                        Title = param.Title
                    });
                }

                byte[] result;
                using (var stream = new MemoryStream())
                {
                    using (var document = PresentationDocument.Create(stream, PresentationDocumentType.Presentation, true))
                    {
                        document.PackageProperties.Title = param.Title;
                        document.PackageProperties.Creator = param.Author;
                        document.PackageProperties.Subject = param.Subject;
                        document.PackageProperties.Keywords = param.Keywords;
                        if (!string.IsNullOrWhiteSpace(param.Company))
                        {
                            var extendedPropertiesPart = document.AddNewPart<ExtendedFilePropertiesPart>();
                            extendedPropertiesPart.Properties = new EP.Properties(
                                new EP.Company(param.Company),
                                new EP.Application("Microi")
                            );
                            extendedPropertiesPart.Properties.Save();
                        }
                        var presentationPart = document.AddPresentationPart();
                        var slideLayoutPart = CreatePresentationFoundation(presentationPart, param);
                        var slideIdList = presentationPart.Presentation.GetFirstChild<P.SlideIdList>();
                        uint slideId = 256;
                        var slideIndex = 1;

                        foreach (var slideParam in slides)
                        {
                            var slidePart = presentationPart.AddNewPart<SlidePart>();
                            slidePart.AddPart(slideLayoutPart);
                            slidePart.Slide = CreatePowerPointSlide(slidePart, slideParam ?? new OfficePowerPointSlideParam(), param, slideIndex);
                            slidePart.Slide.Save();
                            slideIdList.Append(new P.SlideId
                            {
                                Id = slideId++,
                                RelationshipId = presentationPart.GetIdOfPart(slidePart)
                            });
                            slideIndex++;
                        }
                        presentationPart.Presentation.Save();
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

        private static SlideLayoutPart CreatePresentationFoundation(PresentationPart presentationPart, OfficeExportPowerPointParam param)
        {
            var slideWidth = InchesToEmu(param.SlideWidth ?? 13.333);
            var slideHeight = InchesToEmu(param.SlideHeight ?? 7.5);
            presentationPart.Presentation = new P.Presentation(
                new P.SlideMasterIdList(),
                new P.SlideIdList(),
                new P.SlideSize
                {
                    Cx = checked((int)slideWidth),
                    Cy = checked((int)slideHeight),
                    Type = P.SlideSizeValues.Screen16x9
                },
                new P.NotesSize { Cx = 6858000, Cy = 9144000 },
                new P.DefaultTextStyle()
            );

            var slideMasterPart = presentationPart.AddNewPart<SlideMasterPart>();
            var themePart = slideMasterPart.AddNewPart<ThemePart>();
            themePart.Theme = CreatePresentationTheme(GetFontFamily(param.FontFamily));
            themePart.Theme.Save();

            var slideLayoutPart = slideMasterPart.AddNewPart<SlideLayoutPart>();
            slideLayoutPart.SlideLayout = new P.SlideLayout(
                new P.CommonSlideData(CreatePowerPointShapeTree()) { Name = "空白" },
                new P.ColorMapOverride(new D.MasterColorMapping())
            )
            {
                Type = P.SlideLayoutValues.Blank,
                Preserve = true
            };
            slideLayoutPart.AddPart(slideMasterPart);
            slideLayoutPart.SlideLayout.Save();

            var layoutId = new P.SlideLayoutId
            {
                Id = 2147483648,
                RelationshipId = slideMasterPart.GetIdOfPart(slideLayoutPart)
            };
            slideMasterPart.SlideMaster = new P.SlideMaster(
                new P.CommonSlideData(CreatePowerPointShapeTree()) { Name = "Microi Master" },
                new P.ColorMap
                {
                    Background1 = D.ColorSchemeIndexValues.Light1,
                    Text1 = D.ColorSchemeIndexValues.Dark1,
                    Background2 = D.ColorSchemeIndexValues.Light2,
                    Text2 = D.ColorSchemeIndexValues.Dark2,
                    Accent1 = D.ColorSchemeIndexValues.Accent1,
                    Accent2 = D.ColorSchemeIndexValues.Accent2,
                    Accent3 = D.ColorSchemeIndexValues.Accent3,
                    Accent4 = D.ColorSchemeIndexValues.Accent4,
                    Accent5 = D.ColorSchemeIndexValues.Accent5,
                    Accent6 = D.ColorSchemeIndexValues.Accent6,
                    Hyperlink = D.ColorSchemeIndexValues.Hyperlink,
                    FollowedHyperlink = D.ColorSchemeIndexValues.FollowedHyperlink
                },
                new P.SlideLayoutIdList(layoutId),
                new P.TextStyles(new P.TitleStyle(), new P.BodyStyle(), new P.OtherStyle())
            );
            slideMasterPart.SlideMaster.Save();

            presentationPart.Presentation.SlideMasterIdList.Append(new P.SlideMasterId
            {
                Id = 2147483648,
                RelationshipId = presentationPart.GetIdOfPart(slideMasterPart)
            });
            return slideLayoutPart;
        }

        private static P.Slide CreatePowerPointSlide(
            SlidePart slidePart,
            OfficePowerPointSlideParam slideParam,
            OfficeExportPowerPointParam documentParam,
            int slideIndex)
        {
            var backgroundColor = NormalizeHexColor(slideParam.BackgroundColor ?? documentParam.BackgroundColor, "FFFFFF");
            var commonSlideData = new P.CommonSlideData(
                new P.Background(
                    new P.BackgroundProperties(
                        new D.SolidFill(new D.RgbColorModelHex { Val = backgroundColor }),
                        new D.EffectList()
                    )
                ),
                CreatePowerPointShapeTree()
            );
            var slide = new P.Slide(commonSlideData, new P.ColorMapOverride(new D.MasterColorMapping()));
            var shapeTree = commonSlideData.ShapeTree;
            uint shapeId = 2;
            var layout = (slideParam.Layout ?? "TitleAndContent").Trim();
            var isTitleSlide = string.Equals(layout, "TitleSlide", StringComparison.OrdinalIgnoreCase);

            if (!string.IsNullOrWhiteSpace(slideParam.Title))
            {
                var titleY = isTitleSlide ? 1.7 : 0.35;
                var titleHeight = isTitleSlide ? 1.25 : 0.8;
                shapeTree.Append(CreatePowerPointTextShape(
                    shapeId++,
                    "Title",
                    0.6,
                    titleY,
                    (documentParam.SlideWidth ?? 13.333) - 1.2,
                    titleHeight,
                    new List<PowerPointTextLine>
                    {
                        new PowerPointTextLine
                        {
                            Text = slideParam.Title,
                            Bold = true,
                            FontSize = slideParam.TitleFontSize ?? documentParam.TitleFontSize ?? 28,
                            FontColor = slideParam.TitleColor ?? documentParam.TitleColor,
                            Alignment = isTitleSlide ? "Center" : "Left"
                        }
                    },
                    documentParam.FontFamily,
                    isTitleSlide ? "Center" : "Left"
                ));
            }

            if (!string.IsNullOrWhiteSpace(slideParam.Subtitle))
            {
                shapeTree.Append(CreatePowerPointTextShape(
                    shapeId++,
                    "Subtitle",
                    0.9,
                    isTitleSlide ? 3.1 : 1.15,
                    (documentParam.SlideWidth ?? 13.333) - 1.8,
                    0.7,
                    new List<PowerPointTextLine>
                    {
                        new PowerPointTextLine
                        {
                            Text = slideParam.Subtitle,
                            FontSize = Math.Max(12, (slideParam.BodyFontSize ?? documentParam.BodyFontSize ?? 18) - 1),
                            FontColor = slideParam.TextColor ?? documentParam.TextColor,
                            Alignment = isTitleSlide ? "Center" : "Left"
                        }
                    },
                    documentParam.FontFamily,
                    isTitleSlide ? "Center" : "Left"
                ));
            }

            var bodyLines = BuildPowerPointBodyLines(slideParam, documentParam);
            if (!isTitleSlide && bodyLines.Any())
            {
                var hasRightImage = slideParam.Images?.Any(image => image?.X == null) == true;
                var bodyWidth = hasRightImage ? 7.2 : (documentParam.SlideWidth ?? 13.333) - 1.4;
                shapeTree.Append(CreatePowerPointTextShape(
                    shapeId++,
                    "Content",
                    0.7,
                    1.35,
                    bodyWidth,
                    4.9,
                    bodyLines,
                    documentParam.FontFamily,
                    "Left"
                ));
            }

            var imageIndex = 0;
            foreach (var image in slideParam.Images ?? new List<OfficeExportImageParam>())
            {
                if (image == null || string.IsNullOrWhiteSpace(image.FileByteBase64)) continue;
                shapeTree.Append(CreatePowerPointPicture(slidePart, image, shapeId++, imageIndex, documentParam));
                imageIndex++;
            }

            foreach (var table in slideParam.Tables ?? new List<OfficePowerPointTableParam>())
            {
                if (table == null) continue;
                shapeTree.Append(CreatePowerPointTable(shapeId++, table, documentParam));
            }

            if (documentParam.ShowSlideNumber == true)
            {
                shapeTree.Append(CreatePowerPointTextShape(
                    shapeId++,
                    "Slide Number",
                    (documentParam.SlideWidth ?? 13.333) - 1.0,
                    (documentParam.SlideHeight ?? 7.5) - 0.45,
                    0.5,
                    0.25,
                    new List<PowerPointTextLine>
                    {
                        new PowerPointTextLine
                        {
                            Text = slideIndex.ToString(CultureInfo.InvariantCulture),
                            FontSize = 9,
                            FontColor = "777777",
                            Alignment = "Right"
                        }
                    },
                    documentParam.FontFamily,
                    "Right"
                ));
            }
            return slide;
        }

        private static List<PowerPointTextLine> BuildPowerPointBodyLines(
            OfficePowerPointSlideParam slideParam,
            OfficeExportPowerPointParam documentParam)
        {
            var result = new List<PowerPointTextLine>();
            foreach (var line in SplitLines(slideParam.Content))
            {
                if (string.IsNullOrWhiteSpace(line)) continue;
                result.Add(new PowerPointTextLine
                {
                    Text = line,
                    FontSize = slideParam.BodyFontSize ?? documentParam.BodyFontSize ?? 18,
                    FontColor = slideParam.TextColor ?? documentParam.TextColor
                });
            }
            foreach (var bullet in slideParam.Bullets ?? new List<string>())
            {
                result.Add(new PowerPointTextLine
                {
                    Text = bullet ?? string.Empty,
                    Bullet = true,
                    FontSize = slideParam.BodyFontSize ?? documentParam.BodyFontSize ?? 18,
                    FontColor = slideParam.TextColor ?? documentParam.TextColor
                });
            }
            foreach (var item in slideParam.TextItems ?? new List<OfficePowerPointTextParam>())
            {
                if (item == null) continue;
                result.Add(new PowerPointTextLine
                {
                    Text = item.Text ?? string.Empty,
                    Level = Math.Max(0, Math.Min(8, item.Level ?? 0)),
                    Bullet = item.Bullet == true || (item.Level ?? 0) > 0,
                    Bold = item.Bold == true,
                    Italic = item.Italic == true,
                    FontSize = item.FontSize ?? slideParam.BodyFontSize ?? documentParam.BodyFontSize ?? 18,
                    FontColor = item.FontColor ?? slideParam.TextColor ?? documentParam.TextColor,
                    Alignment = item.Alignment
                });
            }
            return result;
        }

        private static P.ShapeTree CreatePowerPointShapeTree()
        {
            return new P.ShapeTree(
                new P.NonVisualGroupShapeProperties(
                    new P.NonVisualDrawingProperties { Id = 1, Name = string.Empty },
                    new P.NonVisualGroupShapeDrawingProperties(),
                    new P.ApplicationNonVisualDrawingProperties()
                ),
                new P.GroupShapeProperties(
                    new D.TransformGroup(
                        new D.Offset { X = 0, Y = 0 },
                        new D.Extents { Cx = 0, Cy = 0 },
                        new D.ChildOffset { X = 0, Y = 0 },
                        new D.ChildExtents { Cx = 0, Cy = 0 }
                    )
                )
            );
        }

        private static P.Shape CreatePowerPointTextShape(
            uint id,
            string name,
            double x,
            double y,
            double width,
            double height,
            IEnumerable<PowerPointTextLine> lines,
            string fontFamily,
            string defaultAlignment)
        {
            var paragraphs = new List<D.Paragraph>();
            foreach (var line in lines ?? new List<PowerPointTextLine>())
            {
                var paragraphProperties = new D.ParagraphProperties
                {
                    Level = Math.Max(0, Math.Min(8, line.Level)),
                    Alignment = ToDrawingAlignment(line.Alignment ?? defaultAlignment)
                };
                if (line.Bullet)
                {
                    paragraphProperties.Append(new D.CharacterBullet { Char = "•" });
                }
                var runProperties = new D.RunProperties
                {
                    Language = "zh-CN",
                    FontSize = Math.Max(100, (int)Math.Round(line.FontSize * 100)),
                    Bold = line.Bold,
                    Italic = line.Italic
                };
                runProperties.Append(
                    new D.SolidFill(new D.RgbColorModelHex { Val = NormalizeHexColor(line.FontColor, "222222") }),
                    new D.LatinFont { Typeface = GetFontFamily(fontFamily) },
                    new D.EastAsianFont { Typeface = GetFontFamily(fontFamily) }
                );
                paragraphs.Add(new D.Paragraph(
                    paragraphProperties,
                    new D.Run(runProperties, new D.Text(line.Text ?? string.Empty)),
                    new D.EndParagraphRunProperties { Language = "zh-CN" }
                ));
            }
            if (!paragraphs.Any()) paragraphs.Add(new D.Paragraph(new D.EndParagraphRunProperties { Language = "zh-CN" }));

            var textBody = new P.TextBody(
                new D.BodyProperties
                {
                    Wrap = D.TextWrappingValues.Square,
                    Anchor = D.TextAnchoringTypeValues.Top
                },
                new D.ListStyle()
            );
            foreach (var paragraph in paragraphs) textBody.Append(paragraph);

            return new P.Shape(
                new P.NonVisualShapeProperties(
                    new P.NonVisualDrawingProperties { Id = id, Name = name },
                    new P.NonVisualShapeDrawingProperties(new D.ShapeLocks { NoGrouping = true }),
                    new P.ApplicationNonVisualDrawingProperties()
                ),
                new P.ShapeProperties(
                    new D.Transform2D(
                        new D.Offset { X = InchesToEmu(x), Y = InchesToEmu(y) },
                        new D.Extents { Cx = InchesToEmu(width), Cy = InchesToEmu(height) }
                    ),
                    new D.PresetGeometry(new D.AdjustValueList()) { Preset = D.ShapeTypeValues.Rectangle },
                    new D.NoFill(),
                    new D.Outline(new D.NoFill())
                ),
                textBody
            );
        }

        private static P.Picture CreatePowerPointPicture(
            SlidePart slidePart,
            OfficeExportImageParam image,
            uint shapeId,
            int imageIndex,
            OfficeExportPowerPointParam documentParam)
        {
            var bytes = DecodeOfficeBase64(image.FileByteBase64);
            var imagePart = slidePart.AddImagePart(ToImagePartType(image.ContentType, image.FileName));
            using (var stream = new MemoryStream(bytes)) imagePart.FeedData(stream);
            var relationshipId = slidePart.GetIdOfPart(imagePart);
            var x = image.X ?? Math.Max(0.5, (documentParam.SlideWidth ?? 13.333) - 4.8);
            var y = image.Y ?? (1.55 + imageIndex * 0.35);
            var width = image.Width ?? 4.2;
            var height = image.Height ?? 3.2;
            var name = string.IsNullOrWhiteSpace(image.FileName) ? $"Image {shapeId}" : image.FileName;

            return new P.Picture(
                new P.NonVisualPictureProperties(
                    new P.NonVisualDrawingProperties { Id = shapeId, Name = name },
                    new P.NonVisualPictureDrawingProperties(new D.PictureLocks { NoChangeAspect = true }),
                    new P.ApplicationNonVisualDrawingProperties()
                ),
                new P.BlipFill(
                    new D.Blip { Embed = relationshipId },
                    new D.Stretch(new D.FillRectangle())
                ),
                new P.ShapeProperties(
                    new D.Transform2D(
                        new D.Offset { X = InchesToEmu(x), Y = InchesToEmu(y) },
                        new D.Extents { Cx = InchesToEmu(width), Cy = InchesToEmu(height) }
                    ),
                    new D.PresetGeometry(new D.AdjustValueList()) { Preset = D.ShapeTypeValues.Rectangle }
                )
            );
        }

        private static P.GraphicFrame CreatePowerPointTable(
            uint shapeId,
            OfficePowerPointTableParam param,
            OfficeExportPowerPointParam documentParam)
        {
            var columnCount = Math.Max(
                param.Headers?.Count ?? 0,
                param.Rows?.Select(row => row?.Count ?? 0).DefaultIfEmpty(0).Max() ?? 0
            );
            columnCount = Math.Max(1, columnCount);
            var rowCount = (param.Rows?.Count ?? 0) + (param.Headers?.Any() == true ? 1 : 0);
            rowCount = Math.Max(1, rowCount);
            var totalWidth = InchesToEmu(param.Width ?? 11.9);
            var totalHeight = InchesToEmu(param.Height ?? 2.8);

            var tableGrid = new D.TableGrid();
            var specifiedWidth = (param.ColumnWidths ?? new List<double>()).Sum();
            for (var index = 0; index < columnCount; index++)
            {
                long width;
                if (specifiedWidth > 0 && index < (param.ColumnWidths?.Count ?? 0))
                {
                    width = Math.Max(1, (long)Math.Round(totalWidth * param.ColumnWidths[index] / specifiedWidth));
                }
                else
                {
                    width = Math.Max(1, totalWidth / columnCount);
                }
                tableGrid.Append(new D.GridColumn { Width = width });
            }

            var table = new D.Table(
                new D.TableProperties { FirstRow = param.Headers?.Any() == true, BandRow = true },
                tableGrid
            );
            var rowHeight = Math.Max(1, totalHeight / rowCount);
            if (param.Headers?.Any() == true)
            {
                table.Append(CreatePowerPointTableRow(
                    param.Headers.Cast<object>().ToList(),
                    columnCount,
                    rowHeight,
                    param.HeaderBackgroundColor,
                    param.HeaderFontColor,
                    true,
                    param.FontSize ?? 12,
                    documentParam.FontFamily
                ));
            }
            foreach (var row in param.Rows ?? new List<List<object>>())
            {
                table.Append(CreatePowerPointTableRow(
                    row,
                    columnCount,
                    rowHeight,
                    param.CellBackgroundColor,
                    param.CellFontColor,
                    false,
                    param.FontSize ?? 12,
                    documentParam.FontFamily
                ));
            }
            if (table.Elements<D.TableRow>().Count() == 0)
            {
                table.Append(CreatePowerPointTableRow(
                    new List<object>(),
                    columnCount,
                    rowHeight,
                    param.CellBackgroundColor,
                    param.CellFontColor,
                    false,
                    param.FontSize ?? 12,
                    documentParam.FontFamily
                ));
            }

            return new P.GraphicFrame(
                new P.NonVisualGraphicFrameProperties(
                    new P.NonVisualDrawingProperties { Id = shapeId, Name = $"Table {shapeId}" },
                    new P.NonVisualGraphicFrameDrawingProperties(),
                    new P.ApplicationNonVisualDrawingProperties()
                ),
                new P.Transform(
                    new D.Offset { X = InchesToEmu(param.X ?? 0.7), Y = InchesToEmu(param.Y ?? 3.8) },
                    new D.Extents { Cx = totalWidth, Cy = totalHeight }
                ),
                new D.Graphic(new D.GraphicData(table) { Uri = DrawingTableUri })
            );
        }

        private static D.TableRow CreatePowerPointTableRow(
            IList<object> values,
            int columnCount,
            long height,
            string backgroundColor,
            string fontColor,
            bool bold,
            double fontSize,
            string fontFamily)
        {
            var row = new D.TableRow { Height = height };
            for (var index = 0; index < columnCount; index++)
            {
                var text = index < (values?.Count ?? 0)
                    ? Convert.ToString(values[index], CultureInfo.InvariantCulture)
                    : string.Empty;
                var runProperties = new D.RunProperties
                {
                    Language = "zh-CN",
                    FontSize = Math.Max(100, (int)Math.Round(fontSize * 100)),
                    Bold = bold
                };
                runProperties.Append(
                    new D.SolidFill(new D.RgbColorModelHex { Val = NormalizeHexColor(fontColor, "222222") }),
                    new D.LatinFont { Typeface = GetFontFamily(fontFamily) },
                    new D.EastAsianFont { Typeface = GetFontFamily(fontFamily) }
                );
                row.Append(new D.TableCell(
                    new D.TextBody(
                        new D.BodyProperties { Anchor = D.TextAnchoringTypeValues.Center },
                        new D.ListStyle(),
                        new D.Paragraph(
                            new D.ParagraphProperties { Alignment = D.TextAlignmentTypeValues.Center },
                            new D.Run(runProperties, new D.Text(text ?? string.Empty)),
                            new D.EndParagraphRunProperties { Language = "zh-CN" }
                        )
                    ),
                    new D.TableCellProperties(
                        new D.SolidFill(new D.RgbColorModelHex { Val = NormalizeHexColor(backgroundColor, "FFFFFF") })
                    )
                ));
            }
            return row;
        }

        private static D.Theme CreatePresentationTheme(string fontFamily)
        {
            var colorScheme = new D.ColorScheme(
                new D.Dark1Color(new D.SystemColor { Val = D.SystemColorValues.WindowText, LastColor = "000000" }),
                new D.Light1Color(new D.SystemColor { Val = D.SystemColorValues.Window, LastColor = "FFFFFF" }),
                new D.Dark2Color(new D.RgbColorModelHex { Val = "17365D" }),
                new D.Light2Color(new D.RgbColorModelHex { Val = "EAF2F8" }),
                new D.Accent1Color(new D.RgbColorModelHex { Val = "2F75B5" }),
                new D.Accent2Color(new D.RgbColorModelHex { Val = "70AD47" }),
                new D.Accent3Color(new D.RgbColorModelHex { Val = "ED7D31" }),
                new D.Accent4Color(new D.RgbColorModelHex { Val = "A5A5A5" }),
                new D.Accent5Color(new D.RgbColorModelHex { Val = "5B9BD5" }),
                new D.Accent6Color(new D.RgbColorModelHex { Val = "FFC000" }),
                new D.Hyperlink(new D.RgbColorModelHex { Val = "0563C1" }),
                new D.FollowedHyperlinkColor(new D.RgbColorModelHex { Val = "954F72" })
            ) { Name = "Microi" };
            var fontScheme = new D.FontScheme(
                new D.MajorFont(
                    new D.LatinFont { Typeface = fontFamily },
                    new D.EastAsianFont { Typeface = fontFamily },
                    new D.ComplexScriptFont { Typeface = fontFamily }
                ),
                new D.MinorFont(
                    new D.LatinFont { Typeface = fontFamily },
                    new D.EastAsianFont { Typeface = fontFamily },
                    new D.ComplexScriptFont { Typeface = fontFamily }
                )
            ) { Name = "Microi" };
            var formatScheme = new D.FormatScheme(
                new D.FillStyleList(
                    ThemeSolidFill(),
                    ThemeSolidFill(),
                    ThemeSolidFill()
                ),
                new D.LineStyleList(
                    ThemeOutline(6350),
                    ThemeOutline(12700),
                    ThemeOutline(19050)
                ),
                new D.EffectStyleList(
                    new D.EffectStyle(new D.EffectList()),
                    new D.EffectStyle(new D.EffectList()),
                    new D.EffectStyle(new D.EffectList())
                ),
                new D.BackgroundFillStyleList(
                    ThemeSolidFill(),
                    ThemeSolidFill(),
                    ThemeSolidFill()
                )
            ) { Name = "Microi" };
            return new D.Theme(new D.ThemeElements(colorScheme, fontScheme, formatScheme)) { Name = "Microi" };
        }

        private static D.SolidFill ThemeSolidFill()
        {
            return new D.SolidFill(new D.SchemeColor { Val = D.SchemeColorValues.PhColor });
        }

        private static D.Outline ThemeOutline(int width)
        {
            return new D.Outline(
                new D.SolidFill(new D.SchemeColor { Val = D.SchemeColorValues.PhColor }),
                new D.PresetDash { Val = D.PresetLineDashValues.Solid }
            )
            {
                Width = width,
                CapType = D.LineCapValues.Flat,
                CompoundLineType = D.CompoundLineValues.Single,
                Alignment = D.PenAlignmentValues.Center
            };
        }

        private static D.TextAlignmentTypeValues ToDrawingAlignment(string alignment)
        {
            if (string.Equals(alignment, "Center", StringComparison.OrdinalIgnoreCase)) return D.TextAlignmentTypeValues.Center;
            if (string.Equals(alignment, "Right", StringComparison.OrdinalIgnoreCase)) return D.TextAlignmentTypeValues.Right;
            if (string.Equals(alignment, "Justify", StringComparison.OrdinalIgnoreCase)) return D.TextAlignmentTypeValues.Justified;
            return D.TextAlignmentTypeValues.Left;
        }

        private static long InchesToEmu(double inches)
        {
            return Math.Max(1, (long)Math.Round(inches * 914400));
        }

        private class PowerPointTextLine
        {
            public string Text { get; set; }
            public int Level { get; set; }
            public bool Bullet { get; set; }
            public bool Bold { get; set; }
            public bool Italic { get; set; }
            public double FontSize { get; set; }
            public string FontColor { get; set; }
            public string Alignment { get; set; }
        }
    }
}
