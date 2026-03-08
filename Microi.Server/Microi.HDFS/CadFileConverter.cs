using System;
using System.IO;
using System.Threading.Tasks;
using System.Diagnostics;
using System.Threading;
using Dos.Common;

namespace Microi.net
{
    /// <summary>
    /// CAD文件格式转换工具。
    /// 支持：DWG→DXF、STEP/STP→GLB(glTF二进制)。
    /// DWG转换依赖 ACadSharp（已在 Microi.V8Engine 中引用），
    /// STEP/STP转换依赖外部工具（如FreeCAD命令行）。
    /// </summary>
    public static class CadFileConverter
    {
        /// <summary>
        /// 需要转换的CAD文件扩展名（含点，小写）
        /// </summary>
        private static readonly string[] ConvertibleExtensions = { ".dwg", ".step", ".stp" };

        /// <summary>
        /// 判断文件是否需要转换为前端可预览格式
        /// </summary>
        public static bool NeedConvert(string fileSuffix)
        {
            if (string.IsNullOrWhiteSpace(fileSuffix)) return false;
            var ext = fileSuffix.ToLower().Trim();
            foreach (var e in ConvertibleExtensions)
            {
                if (e == ext) return true;
            }
            return false;
        }

        /// <summary>
        /// 获取转换后的目标文件扩展名
        /// </summary>
        public static string GetTargetExtension(string fileSuffix)
        {
            var ext = fileSuffix?.ToLower().Trim();
            switch (ext)
            {
                case ".dwg": return ".dxf";
                case ".step":
                case ".stp": return ".glb";
                default: return null;
            }
        }

        /// <summary>
        /// 获取转换后的文件路径（同目录，文件名加_preview后缀）
        /// </summary>
        public static string GetConvertedPath(string originalPath, string fileSuffix)
        {
            var targetExt = GetTargetExtension(fileSuffix);
            if (targetExt == null) return null;

            var dir = Path.GetDirectoryName(originalPath)?.Replace('\\', '/') ?? "";
            var nameWithoutExt = Path.GetFileNameWithoutExtension(originalPath);
            var result = (string.IsNullOrEmpty(dir) ? "" : dir + "/") + nameWithoutExt + "_preview" + targetExt;
            return result;
        }

        /// <summary>
        /// 将DWG流转换为DXF字节数组（使用ACadSharp）
        /// </summary>
        public static byte[] ConvertDwgToDxfBytes(Stream dwgStream)
        {
            try
            {
                // 动态调用 DwgConverter，避免 HDFS 项目硬依赖 ACadSharp
                var converterType = Type.GetType("Microi.net.DwgConverter, Microi.V8Engine");
                if (converterType == null)
                {
                    // 尝试从已加载的程序集中查找
                    foreach (var assembly in AppDomain.CurrentDomain.GetAssemblies())
                    {
                        converterType = assembly.GetType("Microi.net.DwgConverter");
                        if (converterType != null) break;
                    }
                }

                if (converterType != null)
                {
                    var method = converterType.GetMethod("ConvertDwgToDxf",
                        new[] { typeof(Stream), typeof(Stream), typeof(bool) });
                    if (method != null)
                    {
                        using (var dxfStream = new MemoryStream())
                        {
                            if (dwgStream.CanSeek) dwgStream.Position = 0;
                            method.Invoke(null, new object[] { dwgStream, dxfStream, false });
                            return dxfStream.ToArray();
                        }
                    }
                }

                Console.WriteLine("CadFileConverter: DwgConverter类未找到，请确保Microi.V8Engine已加载");
                return null;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"CadFileConverter: DWG→DXF转换失败: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// 将STEP/STP流转换为GLB字节数组。
        /// 使用FreeCAD命令行进行转换，如未安装FreeCAD则返回null。
        /// 部署时请确保服务器上安装了FreeCAD（apt install freecad 或 brew install freecad）。
        /// 也可以通过环境变量 FREECAD_PATH 指定FreeCAD的可执行文件路径。
        /// </summary>
        public static byte[] ConvertStepToGlbBytes(Stream stepStream)
        {
            string tempDir = null;
            try
            {
                tempDir = Path.Combine(Path.GetTempPath(), "microi_cad_" + Guid.NewGuid().ToString("N"));
                Directory.CreateDirectory(tempDir);

                var inputFile = Path.Combine(tempDir, "input.step");
                var outputFile = Path.Combine(tempDir, "output.glb");

                // 写入临时文件
                using (var fs = new FileStream(inputFile, FileMode.Create, FileAccess.Write))
                {
                    if (stepStream.CanSeek) stepStream.Position = 0;
                    stepStream.CopyTo(fs);
                }

                // 构造FreeCAD转换Python脚本
                var pythonScript = Path.Combine(tempDir, "convert.py");
                var scriptContent = @"
import sys
import os

# 尝试多种导入方式兼容不同的FreeCAD安装
try:
    import FreeCAD
    import Part
    import Mesh
    import MeshPart
except ImportError:
    # 尝试添加FreeCAD的lib路径
    freecad_paths = [
        '/usr/lib/freecad/lib',
        '/usr/lib/freecad-python3/lib', 
        '/usr/share/freecad/lib',
        '/Applications/FreeCAD.app/Contents/Resources/lib',
        '/snap/freecad/current/usr/lib/freecad/lib'
    ]
    for p in freecad_paths:
        if os.path.exists(p) and p not in sys.path:
            sys.path.insert(0, p)
    import FreeCAD
    import Part
    import Mesh
    import MeshPart

input_file = sys.argv[1]
output_file = sys.argv[2]

# 读取STEP文件
shape = Part.Shape()
shape.read(input_file)

# 转换为Mesh（三角网格）
mesh = MeshPart.meshFromShape(shape, LinearDeflection=0.1, AngularDeflection=0.5)

# 导出为STL（中间格式）
stl_file = output_file.replace('.glb', '.stl')
mesh.write(stl_file)
print('STEP_TO_STL_OK')
";
                File.WriteAllText(pythonScript, scriptContent);

                // 查找FreeCAD可执行文件
                var freecadPath = FindFreecadExecutable();
                if (freecadPath == null)
                {
                    Console.WriteLine("CadFileConverter: 未找到FreeCAD，STEP/STP文件将不会被转换。请安装FreeCAD以启用STEP预览功能。");
                    return null;
                }

                var stlFile = outputFile.Replace(".glb", ".stl");

                // 使用FreeCAD命令行转换STEP→STL
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = freecadPath,
                        Arguments = $"--console \"{pythonScript}\" \"{inputFile}\" \"{stlFile}\"",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true
                    }
                };

                process.Start();
                var output = process.StandardOutput.ReadToEnd();
                var errorOutput = process.StandardError.ReadToEnd();
                process.WaitForExit(60000); // 最多等待60秒

                if (process.ExitCode != 0 || !output.Contains("STEP_TO_STL_OK"))
                {
                    // FreeCAD方式失败，尝试使用Python + OCC方式
                    Console.WriteLine($"CadFileConverter: FreeCAD转换失败(ExitCode={process.ExitCode}), stderr={errorOutput}");

                    // 尝试直接用python3 + pythonocc调用
                    var convertResult = TryPythonOccConvert(inputFile, stlFile);
                    if (!convertResult)
                    {
                        Console.WriteLine("CadFileConverter: 所有STEP转换方式均失败");
                        return null;
                    }
                }

                // 读取STL文件并返回（前端Three.js可以直接加载STL）
                // 注意：这里返回STL而不是GLB，因为STL更轻量，且Three.js的STLLoader支持很好
                if (File.Exists(stlFile))
                {
                    var resultBytes = File.ReadAllBytes(stlFile);
                    return resultBytes;
                }

                return null;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"CadFileConverter: STEP→GLB转换异常: {ex.Message}");
                return null;
            }
            finally
            {
                // 清理临时文件
                try
                {
                    if (tempDir != null && Directory.Exists(tempDir))
                    {
                        Directory.Delete(tempDir, true);
                    }
                }
                catch { }
            }
        }

        /// <summary>
        /// 尝试使用python3 + pythonocc-core进行转换
        /// </summary>
        private static bool TryPythonOccConvert(string inputFile, string outputStlFile)
        {
            try
            {
                var scriptContent = @"
import sys
try:
    from OCP.STEPControl import STEPControl_Reader
    from OCP.StlAPI import StlAPI_Writer
    from OCP.BRepMesh import BRepMesh_IncrementalMesh
    
    reader = STEPControl_Reader()
    status = reader.ReadFile(sys.argv[1])
    if status == 1:
        reader.TransferRoots()
        shape = reader.OneShape()
        mesh = BRepMesh_IncrementalMesh(shape, 0.1, False, 0.5, True)
        mesh.Perform()
        writer = StlAPI_Writer()
        writer.Write(shape, sys.argv[2])
        print('OCC_CONVERT_OK')
    else:
        print('READ_FAILED')
        sys.exit(1)
except ImportError:
    print('OCC_NOT_AVAILABLE')
    sys.exit(1)
";
                var tempScript = Path.Combine(Path.GetDirectoryName(inputFile), "occ_convert.py");
                File.WriteAllText(tempScript, scriptContent);

                var python = FindPythonExecutable();
                if (python == null) return false;

                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = python,
                        Arguments = $"\"{tempScript}\" \"{inputFile}\" \"{outputStlFile}\"",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true
                    }
                };

                process.Start();
                var output = process.StandardOutput.ReadToEnd();
                process.WaitForExit(60000);

                return output.Contains("OCC_CONVERT_OK") && File.Exists(outputStlFile);
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// 查找FreeCAD可执行文件路径
        /// </summary>
        private static string FindFreecadExecutable()
        {
            // 1. 优先使用环境变量
            var envPath = Environment.GetEnvironmentVariable("FREECAD_PATH");
            if (!string.IsNullOrWhiteSpace(envPath) && File.Exists(envPath))
                return envPath;

            // 2. 常见路径
            var candidates = new[]
            {
                "freecadcmd",
                "FreeCADCmd",
                "/usr/bin/freecadcmd",
                "/usr/bin/FreeCADCmd",
                "/usr/local/bin/freecadcmd",
                "/snap/bin/freecad.cmd",
                "/Applications/FreeCAD.app/Contents/MacOS/FreeCADCmd",
                @"C:\Program Files\FreeCAD 0.21\bin\FreeCADCmd.exe",
                @"C:\Program Files\FreeCAD\bin\FreeCADCmd.exe"
            };

            foreach (var candidate in candidates)
            {
                try
                {
                    if (File.Exists(candidate)) return candidate;
                }
                catch { }
            }

            // 3. 尝试 which/where 命令
            try
            {
                var whichCmd = System.Runtime.InteropServices.RuntimeInformation.IsOSPlatform(
                    System.Runtime.InteropServices.OSPlatform.Windows) ? "where" : "which";

                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = whichCmd,
                        Arguments = "freecadcmd",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        CreateNoWindow = true
                    }
                };
                process.Start();
                var result = process.StandardOutput.ReadToEnd().Trim();
                process.WaitForExit(5000);
                if (!string.IsNullOrWhiteSpace(result) && File.Exists(result))
                    return result;
            }
            catch { }

            return null;
        }

        /// <summary>
        /// 查找Python可执行文件
        /// </summary>
        private static string FindPythonExecutable()
        {
            var candidates = new[] { "python3", "python", "/usr/bin/python3", "/usr/local/bin/python3" };
            foreach (var candidate in candidates)
            {
                try
                {
                    var process = new Process
                    {
                        StartInfo = new ProcessStartInfo
                        {
                            FileName = candidate,
                            Arguments = "--version",
                            UseShellExecute = false,
                            RedirectStandardOutput = true,
                            RedirectStandardError = true,
                            CreateNoWindow = true
                        }
                    };
                    process.Start();
                    process.WaitForExit(3000);
                    if (process.ExitCode == 0) return candidate;
                }
                catch { }
            }
            return null;
        }

        /// <summary>
        /// 异步执行CAD文件转换并上传转换后的文件到存储系统。
        /// 此方法在后台线程运行，不阻塞上传流程。
        /// </summary>
        /// <param name="fileStream">原始文件流（会被复制，调用方可以安全释放原流）</param>
        /// <param name="fileSuffix">文件扩展名（含点，如.dwg）</param>
        /// <param name="originalPath">原始文件在存储系统中的路径</param>
        /// <param name="clientModel">存储客户端配置</param>
        /// <param name="limit">是否私有存储</param>
        /// <param name="hdfsType">存储类型</param>
        public static void ConvertAndUploadAsync(
            Stream fileStream,
            string fileSuffix,
            string originalPath,
            OsClientSecret clientModel,
            bool? limit,
            string hdfsType)
        {
            if (!NeedConvert(fileSuffix)) return;

            // 复制流数据到字节数组，避免原流被释放后无法读取
            byte[] fileBytes;
            try
            {
                if (fileStream.CanSeek) fileStream.Position = 0;
                using (var ms = new MemoryStream())
                {
                    fileStream.CopyTo(ms);
                    fileBytes = ms.ToArray();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"CadFileConverter: 复制文件流失败: {ex.Message}");
                return;
            }

            var ext = fileSuffix.ToLower().Trim();
            var convertedPath = GetConvertedPath(originalPath, ext);
            if (convertedPath == null) return;

            // 在后台线程中执行转换和上传
            Task.Run(async () =>
            {
                try
                {
                    Console.WriteLine($"CadFileConverter: 开始异步转换 {ext} 文件: {originalPath}");

                    byte[] convertedBytes = null;
                    string actualTargetExt = GetTargetExtension(ext);

                    switch (ext)
                    {
                        case ".dwg":
                            using (var dwgStream = new MemoryStream(fileBytes))
                            {
                                convertedBytes = ConvertDwgToDxfBytes(dwgStream);
                            }
                            break;

                        case ".step":
                        case ".stp":
                            using (var stepStream = new MemoryStream(fileBytes))
                            {
                                convertedBytes = ConvertStepToGlbBytes(stepStream);
                                // STEP转换实际输出的是STL格式
                                if (convertedBytes != null)
                                {
                                    actualTargetExt = ".stl";
                                    convertedPath = GetConvertedPath(originalPath, ext)
                                        .Replace(".glb", ".stl");
                                }
                            }
                            break;
                    }

                    if (convertedBytes == null || convertedBytes.Length == 0)
                    {
                        Console.WriteLine($"CadFileConverter: 转换失败或无输出: {originalPath}");
                        return;
                    }

                    // 上传转换后的文件到存储系统
                    var _iMicroiHDFS = default(IMicroiHDFS);
                    switch (hdfsType)
                    {
                        case "MinIO":
                            _iMicroiHDFS = MicroiEngine.HDFSFactory(HDFSType.MinIO);
                            break;
                        case "S3":
                            _iMicroiHDFS = MicroiEngine.HDFSFactory(HDFSType.AmazonS3);
                            break;
                        default:
                            _iMicroiHDFS = MicroiEngine.HDFSFactory(HDFSType.Aliyun);
                            break;
                    }

                    using (var convertedStream = new MemoryStream(convertedBytes))
                    {
                        var putResult = await _iMicroiHDFS.PutObject(new HDFSParam()
                        {
                            ClientModel = clientModel,
                            Limit = limit,
                            FileFullPath = convertedPath,
                            FileStream = convertedStream
                        });

                        if (putResult.Code == 1)
                        {
                            Console.WriteLine($"CadFileConverter: 转换完成并上传成功: {originalPath} → {convertedPath}");
                        }
                        else
                        {
                            Console.WriteLine($"CadFileConverter: 转换文件上传失败: {putResult.Msg}");
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"CadFileConverter: 异步转换异常: {ex.Message}");
                }
            });
        }
    }
}
