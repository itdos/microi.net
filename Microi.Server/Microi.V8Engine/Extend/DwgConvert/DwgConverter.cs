using System;
using System.IO;
using ACadSharp;
using ACadSharp.IO;

namespace Microi.net
{
    /// <summary>
    /// DWG格式转换工具
    /// 用于将AutoCAD DWG文件转换为DXF格式，便于前端浏览和处理
    /// </summary>
    public class DwgConverter
    {
        /// <summary>
        /// 将DWG文件转换为DXF格式
        /// </summary>
        /// <param name="dwgFilePath">DWG文件路径</param>
        /// <param name="dxfFilePath">输出的DXF文件路径</param>
        /// <param name="isBinary">是否输出为二进制DXF格式，默认false(ASCII格式)</param>
        /// <returns>转换是否成功</returns>
        public static bool ConvertDwgToDxf(string dwgFilePath, string dxfFilePath, bool isBinary = false)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dwgFilePath))
                {
                    throw new ArgumentException("DWG文件路径不能为空", nameof(dwgFilePath));
                }

                if (string.IsNullOrWhiteSpace(dxfFilePath))
                {
                    throw new ArgumentException("DXF文件路径不能为空", nameof(dxfFilePath));
                }

                if (!File.Exists(dwgFilePath))
                {
                    throw new FileNotFoundException($"DWG文件不存在: {dwgFilePath}");
                }

                // 确保输出目录存在
                var outputDir = Path.GetDirectoryName(dxfFilePath);
                if (!string.IsNullOrWhiteSpace(outputDir) && !Directory.Exists(outputDir))
                {
                    Directory.CreateDirectory(outputDir);
                }

                // 读取DWG文件
                CadDocument cadDocument;
                using (DwgReader dwgReader = new DwgReader(dwgFilePath))
                {
                    cadDocument = dwgReader.Read();
                }

                // 写入DXF文件
                using (DxfWriter dxfWriter = new DxfWriter(dxfFilePath, cadDocument, isBinary))
                {
                    dxfWriter.Write();
                }

                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"DWG转DXF失败: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// 将DWG文件转换为DXF格式（流方式）
        /// </summary>
        /// <param name="dwgStream">DWG文件流</param>
        /// <param name="dxfStream">输出的DXF文件流</param>
        /// <param name="isBinary">是否输出为二进制DXF格式，默认false(ASCII格式)</param>
        /// <returns>转换是否成功</returns>
        public static bool ConvertDwgToDxf(Stream dwgStream, Stream dxfStream, bool isBinary = false)
        {
            try
            {
                if (dwgStream == null)
                {
                    throw new ArgumentNullException(nameof(dwgStream), "DWG文件流不能为空");
                }

                if (dxfStream == null)
                {
                    throw new ArgumentNullException(nameof(dxfStream), "DXF文件流不能为空");
                }

                if (!dwgStream.CanRead)
                {
                    throw new ArgumentException("DWG文件流不可读", nameof(dwgStream));
                }

                if (!dxfStream.CanWrite)
                {
                    throw new ArgumentException("DXF文件流不可写", nameof(dxfStream));
                }

                // 读取DWG文件
                CadDocument cadDocument;
                using (DwgReader dwgReader = new DwgReader(dwgStream))
                {
                    cadDocument = dwgReader.Read();
                }

                // 写入DXF文件
                using (DxfWriter dxfWriter = new DxfWriter(dxfStream, cadDocument, isBinary))
                {
                    dxfWriter.Write();
                }

                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"DWG转DXF失败: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// 将DWG文件转换为DXF字节数组
        /// </summary>
        /// <param name="dwgFilePath">DWG文件路径</param>
        /// <param name="isBinary">是否输出为二进制DXF格式，默认false(ASCII格式)</param>
        /// <returns>DXF文件的字节数组</returns>
        public static byte[] ConvertDwgToDxfBytes(string dwgFilePath, bool isBinary = false)
        {
            try
            {
                using (var memoryStream = new MemoryStream())
                {
                    using (var fileStream = File.OpenRead(dwgFilePath))
                    {
                        ConvertDwgToDxf(fileStream, memoryStream, isBinary);
                    }
                    return memoryStream.ToArray();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"DWG转DXF字节数组失败: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// 将DWG字节数组转换为DXF字节数组
        /// </summary>
        /// <param name="dwgBytes">DWG文件的字节数组</param>
        /// <param name="isBinary">是否输出为二进制DXF格式，默认false(ASCII格式)</param>
        /// <returns>DXF文件的字节数组</returns>
        public static byte[] ConvertDwgToDxfBytes(byte[] dwgBytes, bool isBinary = false)
        {
            try
            {
                if (dwgBytes == null || dwgBytes.Length == 0)
                {
                    throw new ArgumentException("DWG字节数组不能为空", nameof(dwgBytes));
                }

                using (var dwgStream = new MemoryStream(dwgBytes))
                using (var dxfStream = new MemoryStream())
                {
                    ConvertDwgToDxf(dwgStream, dxfStream, isBinary);
                    return dxfStream.ToArray();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"DWG字节数组转DXF字节数组失败: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// 获取DWG文件信息
        /// </summary>
        /// <param name="dwgFilePath">DWG文件路径</param>
        /// <returns>包含版本信息等的DWG文档对象</returns>
        public static CadDocument GetDwgInfo(string dwgFilePath)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dwgFilePath))
                {
                    throw new ArgumentException("DWG文件路径不能为空", nameof(dwgFilePath));
                }

                if (!File.Exists(dwgFilePath))
                {
                    throw new FileNotFoundException($"DWG文件不存在: {dwgFilePath}");
                }

                using (DwgReader dwgReader = new DwgReader(dwgFilePath))
                {
                    return dwgReader.Read();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"读取DWG文件信息失败: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// 批量转换DWG文件为DXF格式
        /// </summary>
        /// <param name="dwgDirectoryPath">DWG文件所在目录</param>
        /// <param name="dxfDirectoryPath">DXF文件输出目录</param>
        /// <param name="isBinary">是否输出为二进制DXF格式，默认false(ASCII格式)</param>
        /// <param name="searchPattern">搜索模式，默认"*.dwg"</param>
        /// <returns>成功转换的文件数量</returns>
        public static int BatchConvertDwgToDxf(string dwgDirectoryPath, string dxfDirectoryPath, 
            bool isBinary = false, string searchPattern = "*.dwg")
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dwgDirectoryPath))
                {
                    throw new ArgumentException("DWG目录路径不能为空", nameof(dwgDirectoryPath));
                }

                if (string.IsNullOrWhiteSpace(dxfDirectoryPath))
                {
                    throw new ArgumentException("DXF目录路径不能为空", nameof(dxfDirectoryPath));
                }

                if (!Directory.Exists(dwgDirectoryPath))
                {
                    throw new DirectoryNotFoundException($"DWG目录不存在: {dwgDirectoryPath}");
                }

                if (!Directory.Exists(dxfDirectoryPath))
                {
                    Directory.CreateDirectory(dxfDirectoryPath);
                }

                var dwgFiles = Directory.GetFiles(dwgDirectoryPath, searchPattern);
                int successCount = 0;

                foreach (var dwgFile in dwgFiles)
                {
                    try
                    {
                        var fileName = Path.GetFileNameWithoutExtension(dwgFile);
                        var dxfFilePath = Path.Combine(dxfDirectoryPath, fileName + ".dxf");

                        if (ConvertDwgToDxf(dwgFile, dxfFilePath, isBinary))
                        {
                            successCount++;
                            Console.WriteLine($"成功转换: {Path.GetFileName(dwgFile)} -> {Path.GetFileName(dxfFilePath)}");
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"转换文件失败 {Path.GetFileName(dwgFile)}: {ex.Message}");
                    }
                }

                return successCount;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"批量转换失败: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// 获取DWG文件的详细信息（用于诊断和分析）
        /// </summary>
        /// <param name="dwgFilePath">DWG文件路径</param>
        /// <returns>DWG文件详细信息的字符串描述</returns>
        public static string GetDwgDetailedInfo(string dwgFilePath)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dwgFilePath))
                {
                    throw new ArgumentException("DWG文件路径不能为空", nameof(dwgFilePath));
                }

                if (!File.Exists(dwgFilePath))
                {
                    throw new FileNotFoundException($"DWG文件不存在: {dwgFilePath}");
                }

                using (DwgReader dwgReader = new DwgReader(dwgFilePath))
                {
                    var cadDocument = dwgReader.Read();
                    var info = new System.Text.StringBuilder();
                    
                    info.AppendLine("==================== DWG文件详细信息 ====================");
                    info.AppendLine($"文件路径: {dwgFilePath}");
                    info.AppendLine($"文件名: {Path.GetFileName(dwgFilePath)}");
                    info.AppendLine($"文件大小: {new FileInfo(dwgFilePath).Length / 1024.0:F2} KB");
                    info.AppendLine();
                    
                    info.AppendLine("--- 基本信息 ---");
                    info.AppendLine($"DWG版本: {cadDocument.Header.Version}");
                    // info.AppendLine($"创建日期: {cadDocument.Header.CreateDate}");
                    // info.AppendLine($"修改日期: {cadDocument.Header.UpdateDate}");
                    info.AppendLine();
                    
                    info.AppendLine("--- 内容统计 ---");
                    info.AppendLine($"图层数量: {cadDocument.Layers.Count}");
                    info.AppendLine($"块数量: {cadDocument.BlockRecords.Count}");
                    info.AppendLine($"实体总数: {cadDocument.Entities.Count}");
                    info.AppendLine();
                    
                    // 统计实体类型
                    var entityTypes = new System.Collections.Generic.Dictionary<string, int>();
                    foreach (var entity in cadDocument.Entities)
                    {
                        var typeName = entity.GetType().Name;
                        if (entityTypes.ContainsKey(typeName))
                            entityTypes[typeName]++;
                        else
                            entityTypes[typeName] = 1;
                    }
                    
                    info.AppendLine("--- 实体类型分布 ---");
                    foreach (var kvp in entityTypes)
                    {
                        info.AppendLine($"{kvp.Key}: {kvp.Value}");
                    }
                    info.AppendLine();
                    
                    // 检查是否包含3D实体
                    bool has3DEntities = false;
                    var solidTypes = new[] { "Solid3d", "Body", "Region", "Surface", "Mesh" };
                    foreach (var type in solidTypes)
                    {
                        if (entityTypes.ContainsKey(type))
                        {
                            has3DEntities = true;
                            break;
                        }
                    }
                    
                    info.AppendLine("--- 内容分析 ---");
                    if (has3DEntities)
                    {
                        info.AppendLine("✅ 包含3D实体 - 这是一个3D模型");
                    }
                    else
                    {
                        info.AppendLine("📋 不包含3D实体 - 这是一个2D平面图");
                        info.AppendLine("   （前端显示为平面是正常的）");
                    }
                    
                    info.AppendLine();
                    info.AppendLine("--- 图层信息 ---");
                    int layerCount = 0;
                    foreach (var layer in cadDocument.Layers)
                    {
                        if (layerCount < 10) // 只显示前10个图层
                        {
                            info.AppendLine($"  {layer.Name} (颜色: {layer.Color})");
                        }
                        layerCount++;
                    }
                    if (layerCount > 10)
                    {
                        info.AppendLine($"  ... 还有 {layerCount - 10} 个图层");
                    }
                    
                    info.AppendLine("========================================================");
                    
                    return info.ToString();
                }
            }
            catch (Exception ex)
            {
                return $"读取DWG文件信息失败: {ex.Message}";
            }
        }

        /// <summary>
        /// 检查DWG文件是否为3D模型
        /// </summary>
        /// <param name="dwgFilePath">DWG文件路径</param>
        /// <returns>true表示包含3D实体，false表示仅为2D平面图</returns>
        public static bool Is3DModel(string dwgFilePath)
        {
            try
            {
                using (DwgReader dwgReader = new DwgReader(dwgFilePath))
                {
                    var cadDocument = dwgReader.Read();
                    
                    // 检查是否包含3D实体类型
                    var solid3DTypes = new[] { 
                        "Solid3d", "Body", "Region", "Surface", 
                        "Mesh", "SubDMesh", "PolygonMesh" 
                    };
                    
                    foreach (var entity in cadDocument.Entities)
                    {
                        var typeName = entity.GetType().Name;
                        foreach (var solidType in solid3DTypes)
                        {
                            if (typeName.Contains(solidType))
                            {
                                return true;
                            }
                        }
                    }
                    
                    return false;
                }
            }
            catch
            {
                return false;
            }
        }
    }
}
