using System;
using System.IO;

namespace Microi.net
{
    /// <summary>
    /// DWG转DXF工具使用示例
    /// </summary>
    public class DwgConverterExample
    {
        /// <summary>
        /// 示例1：基本文件转换
        /// </summary>
        public static void Example1_BasicConversion()
        {
            try
            {
                string dwgFilePath = @"/Users/Work/Microi.net/microi.web/src/views/file-manage/file/安顺百里城11、12、13号楼商业平面图.dwg";
                string dxfFilePath = @"/Users/Work/Microi.net/microi.web/src/views/file-manage/file/安顺百里城11、12、13号楼商业平面图.dxf";

                bool success = DwgConverter.ConvertDwgToDxf(dwgFilePath, dxfFilePath);
                
                if (success)
                {
                    Console.WriteLine("转换成功！");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"转换失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 示例2：转换为二进制DXF格式
        /// </summary>
        public static void Example2_BinaryDxf()
        {
            try
            {
                string dwgFilePath = @"/Users/Work/Microi.net/microi.web/src/views/file-manage/file/安顺百里城11、12、13号楼商业平面图.dwg";
                string dxfFilePath = @"/Users/Work/Microi.net/microi.web/src/views/file-manage/file/安顺百里城11、12、13号楼商业平面图_binary.dxf";

                // 第三个参数设置为true，输出二进制DXF格式（文件更小）
                bool success = DwgConverter.ConvertDwgToDxf(dwgFilePath, dxfFilePath, true);
                
                if (success)
                {
                    Console.WriteLine("转换为二进制DXF成功！");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"转换失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 示例3：使用流进行转换（适用于Web上传场景）
        /// </summary>
        public static void Example3_StreamConversion()
        {
            try
            {
                string dwgFilePath = @"/Users/Work/Microi.net/microi.web/src/views/file-manage/file/安顺百里城11、12、13号楼商业平面图.dwg";
                string dxfFilePath = @"/Users/Work/Microi.net/microi.web/src/views/file-manage/file/安顺百里城11、12、13号楼商业平面图_from_stream.dxf";

                using (var dwgStream = File.OpenRead(dwgFilePath))
                using (var dxfStream = File.Create(dxfFilePath))
                {
                    bool success = DwgConverter.ConvertDwgToDxf(dwgStream, dxfStream);
                    
                    if (success)
                    {
                        Console.WriteLine("使用流转换成功！");
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"转换失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 示例4：转换为字节数组（适用于API返回）
        /// </summary>
        public static void Example4_ConvertToBytes()
        {
            try
            {
                string dwgFilePath = @"C:\drawings\sample.dwg";

                // 转换为DXF字节数组
                byte[] dxfBytes = DwgConverter.ConvertDwgToDxfBytes(dwgFilePath);

                Console.WriteLine($"转换成功，DXF文件大小: {dxfBytes.Length} 字节");

                // 可以将字节数组返回给前端
                // return File(dxfBytes, "application/dxf", "sample.dxf");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"转换失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 示例5：批量转换DWG文件
        /// </summary>
        public static void Example5_BatchConversion()
        {
            try
            {
                string dwgDirectory = @"C:\drawings\source";
                string dxfDirectory = @"C:\drawings\output";

                int successCount = DwgConverter.BatchConvertDwgToDxf(dwgDirectory, dxfDirectory);

                Console.WriteLine($"批量转换完成，成功转换 {successCount} 个文件");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"批量转换失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 示例6：获取DWG文件信息
        /// </summary>
        public static void Example6_GetDwgInfo()
        {
            try
            {
                string dwgFilePath = @"C:\drawings\sample.dwg";

                var cadDocument = DwgConverter.GetDwgInfo(dwgFilePath);

                Console.WriteLine($"DWG版本: {cadDocument.Header.Version}");
                Console.WriteLine($"图层数量: {cadDocument.Layers.Count}");
                Console.WriteLine($"块数量: {cadDocument.BlockRecords.Count}");
                Console.WriteLine($"实体数量: {cadDocument.Entities.Count}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"读取信息失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 示例7：Web API中的使用示例（伪代码）
        /// </summary>
        public static void Example7_WebApiUsage()
        {
            /*
            // 在ASP.NET Core Web API中的使用示例

            [HttpPost("convert-dwg")]
            public IActionResult ConvertDwg(IFormFile dwgFile)
            {
                try
                {
                    if (dwgFile == null || dwgFile.Length == 0)
                    {
                        return BadRequest("请上传DWG文件");
                    }

                    using (var dwgStream = dwgFile.OpenReadStream())
                    using (var dxfStream = new MemoryStream())
                    {
                        // 转换为DXF格式（ASCII格式，前端更容易解析）
                        bool success = DwgConverter.ConvertDwgToDxf(dwgStream, dxfStream, false);

                        if (success)
                        {
                            dxfStream.Position = 0;
                            var fileName = Path.GetFileNameWithoutExtension(dwgFile.FileName) + ".dxf";
                            
                            // 返回DXF文件给前端
                            return File(dxfStream.ToArray(), "application/dxf", fileName);
                        }
                        else
                        {
                            return StatusCode(500, "转换失败");
                        }
                    }
                }
                catch (Exception ex)
                {
                    return StatusCode(500, $"转换出错: {ex.Message}");
                }
            }

            [HttpPost("convert-dwg-to-base64")]
            public IActionResult ConvertDwgToBase64(IFormFile dwgFile)
            {
                try
                {
                    if (dwgFile == null || dwgFile.Length == 0)
                    {
                        return BadRequest("请上传DWG文件");
                    }

                    using (var dwgStream = dwgFile.OpenReadStream())
                    using (var dxfStream = new MemoryStream())
                    {
                        bool success = DwgConverter.ConvertDwgToDxf(dwgStream, dxfStream, false);

                        if (success)
                        {
                            var dxfBytes = dxfStream.ToArray();
                            var base64String = Convert.ToBase64String(dxfBytes);
                            
                            // 返回Base64编码的DXF数据给前端
                            return Ok(new 
                            { 
                                success = true, 
                                data = base64String,
                                fileName = Path.GetFileNameWithoutExtension(dwgFile.FileName) + ".dxf"
                            });
                        }
                        else
                        {
                            return StatusCode(500, "转换失败");
                        }
                    }
                }
                catch (Exception ex)
                {
                    return StatusCode(500, $"转换出错: {ex.Message}");
                }
            }
            */
        }

        /// <summary>
        /// 示例8：检查DWG文件详细信息（诊断用）
        /// </summary>
        public static void Example8_CheckDwgInfo()
        {
            try
            {
                string dwgFilePath = @"/Users/Work/Microi.net/microi.web/src/views/file-manage/file/安顺百里城11、12、13号楼商业平面图.dwg";

                // 获取详细信息
                string info = DwgConverter.GetDwgDetailedInfo(dwgFilePath);
                Console.WriteLine(info);

                // 检查是否为3D模型
                bool is3D = DwgConverter.Is3DModel(dwgFilePath);
                Console.WriteLine($"\n是否为3D模型: {(is3D ? "是" : "否")}");
                
                if (!is3D)
                {
                    Console.WriteLine("\n说明：这是一个2D平面图，前端显示为平面是正常的。");
                    Console.WriteLine("如果需要3D效果，需要使用3D建模软件创建的DWG文件。");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"检查失败: {ex.Message}");
            }
        }
    }
}
