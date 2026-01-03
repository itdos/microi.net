#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：
* Copyright(c) Microi.net
* CLR 版本: 
* 创 建 人：Anderson
* 电子邮箱：973702@qq.com
* 创建日期：
* 文件描述：
******************************************************
* 修 改 人：
* 修改日期：
* 备注描述：
*******************************************************/
#endregion
using System;
using Dos.Common;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Aliyun.OSS;
using Minio;
using Newtonsoft.Json.Linq;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text;
using Dos.ORM;
using static Aliyun.OSS.Model.ListPartsResult;
using Newtonsoft.Json;
using Jint;

namespace Microi.net.Api
{

    /// <summary>
    /// 
    /// </summary>
    public class MicroiHDFS
    {
        /// <summary>
        /// 上传文件或不压缩的图片。返回/路径。
        /// 必传：OsClient、
        /// Path：根目录，如：upload、download、ueditor等
        /// Multiple：是否多文件（可选）
        /// Limit：是否上传至需要有权限才能访问的文件夹
        /// Preview：是否压缩
        /// </summary>
        /// <returns></returns>
        public async Task<DosResult> Upload(DiyUploadParam param, Microsoft.AspNetCore.Http.HttpContext _httpContext = null)
        {
            #region check
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyToken.GetCurrentOsClient();
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, "DiyCommon.Upload()的OsClient不能为空！");
            }

            var files = new Dictionary<string, Stream>();


            if (param.FilesByte != null && param.FilesByte.Any())
            {
                foreach (var file in param.FilesByte)
                {
                    files.Add(file.Key, StreamHelper.BytesToStream(file.Value));
                }
            }

            if (param.FilesByteBase64 != null && param.FilesByteBase64.Any())
            {
                foreach (var file in param.FilesByteBase64)
                {
                    files.Add(file.Key, StreamHelper.BytesToStream(Convert.FromBase64String(file.Value)));
                }
            }

            if (param.Files != null && param.Files.Any())
            {
                files = param.Files;
                foreach (var item in files)
                {
                    if (item.Value.Length == 0)
                    {
                        return new DosResult(0, null, "文件体积为0：" + item.Key);
                    }
                }
            }

            if (files.Count == 0)
            {
                var httpContext = DiyHttpContext.Current ?? _httpContext;//param.HttpContext;
                if (httpContext == null)
                {
                    return new DosResult(0, null, "未找到文件流或HttpContext！");
                }
                foreach (var file in httpContext.Request.Form.Files)
                {
                    if (file != null)
                        files.Add(file.FileName, file.OpenReadStream());
                }
            }

            if (files.Count == 0)
            {
                return new DosResult(1, null, "The file was not found!");
            }

            #endregion

            #region init。后期需改成动态，自由扩展第三方存储。
            var clientModel = OsClient.GetClient(param.OsClient);
            //默认阿里云，兼容低代码平台老版本数据库
            var hdfs = "Aliyun";
            if (!clientModel.HDFS.DosIsNullOrWhiteSpace())
            {
                hdfs = clientModel.HDFS;
            }
            var _iMicroiHDFS = default(IMicroiHDFS);
            switch (hdfs)
            {
                case "MinIO":
                    _iMicroiHDFS = MicroiEngine.HDFS(HDFSType.MinIO);
                    break;
                case "S3":
                    _iMicroiHDFS = MicroiEngine.HDFS(HDFSType.AmazonS3);
                    break;
                default:
                    _iMicroiHDFS = MicroiEngine.HDFS(HDFSType.Aliyun);
                    break;
            }
            
            #endregion

            #region 路径前缀处理
            param.Path = (param.Path ?? "").DosTrim('/');
            var yearMonth = DateTime.Now.ToString("yyyyMMdd");
            param.Path = ("/" + param.OsClient
                        //2024-10-31：修复当Path为空时出现两个斜杠 --by Anderson
                        + (param.Path.DosTrim('/').DosIsNullOrWhiteSpace() ? "" : "/" + param.Path.DosTrim('/'))
                        + "/" + yearMonth
                        ).ToLower();
            #endregion

            var result = new List<object>();
            foreach (var file in files)
            {
                #region 完整路径处理，包括压缩前后的路径，且判断是否已存在此文件名称
                //这里不转小写是为了保持上传后的文件名不变。 Guid.NewGuid().ToString().ToLower();
                var realFileName = ReplaceDbCode(Path.GetFileNameWithoutExtension(file.Key));
                if (clientModel.FileNameGuid == 1)
                {
                    realFileName = Guid.NewGuid().ToString();
                }
                var fileSuffix = Path.GetExtension(file.Key).ToLower();
                //判断文件是否存在。注意，当Limit为false时，也要判断为true时是否存在，因为原图要在私有oss存1次，原图不存公有。
                var objectExist = false;
                var objectExistResult = await _iMicroiHDFS.ObjectExist(new HDFSParam()
                {
                    ClientModel = clientModel,
                    Limit = param.Limit,
                    FileFullPath = (param.Path + "/" + realFileName + fileSuffix).DosTrimStart('/')
                });
                if (objectExistResult.Code != 1)
                {
                    return new DosResult(0, null, objectExistResult.Msg);
                }
                objectExist = objectExistResult.Data;

                //加一个时间戳，访问同样文件名被覆盖 +"_" + new DateTimeOffset(DateTime.UtcNow).ToUnixTimeSeconds()
                if (objectExist)
                {
                    realFileName += "-" + new DateTimeOffset(DateTime.UtcNow).ToUnixTimeSeconds();
                }
                //定义压缩后或不压缩的图片路径
                var resultPath = param.Path + "/" + realFileName + fileSuffix;

                //定义压缩前的图片路径
                var pathOrigin = param.Path + "/" + realFileName + "_origin" + fileSuffix;


                //如果是Preview，需要压缩。默认需要压缩。Preview为False则直接在else里面保存
                //当Preview为空时，默认压缩
                //注意：只压缩jpg、jpeg、bmp、png等格式，gif那些不压缩。
                var isCanPreview = false;
                if (fileSuffix == ".jpg"
                    || fileSuffix == ".jpeg"
                    || fileSuffix == ".png"
                    || fileSuffix == ".bmp"
                    )
                {
                    isCanPreview = true;
                }

                #endregion

                #region 压缩处理
                if (isCanPreview && (param.Preview == null || param.Preview == true))
                {

                    var previewMaxLength = param.CompressMaxSize ?? 500;
                    var previewMaxWidth = param.CompressMaxWidth ?? 1920;

                    #region 裁剪压缩之前，先将原图保存。值得注意的是，原图只存私有，不存公有。
                    var putResult = await _iMicroiHDFS.PutObject(new HDFSParam()
                    {
                        ClientModel = clientModel,
                        Limit = true,//param.Limit,
                        FileFullPath = pathOrigin,
                        FileStream = file.Value
                    });
                    if (putResult.Code != 1)
                    {
                        return putResult;
                    }
                    #endregion

                    //判断是否裁剪。OSS暂时还没有处理裁剪。
                    if (!string.IsNullOrWhiteSpace(DiyHttpContext.Current.Request.Form["pw"]) &&
                        !string.IsNullOrWhiteSpace(DiyHttpContext.Current.Request.Form["ph"]) &&
                        !string.IsNullOrWhiteSpace(DiyHttpContext.Current.Request.Form["px"]) &&
                        !string.IsNullOrWhiteSpace(DiyHttpContext.Current.Request.Form["py"]))
                    {
                        #region 裁剪。 裁剪目前在docker环境下有点问题，每次更新后要安装一个包，不安装会报错，所以处理方式为即使裁剪失败也不管。
                        try
                        {
                            float pw = float.Parse(DiyHttpContext.Current.Request.Form["pw"]);
                            float ph = float.Parse(DiyHttpContext.Current.Request.Form["ph"]);
                            float px = float.Parse(DiyHttpContext.Current.Request.Form["px"]);
                            float py = float.Parse(DiyHttpContext.Current.Request.Form["py"]);
                            // Bitmap b = new Bitmap(file.Value);//.InputStream
                            //                                   //剪裁图片
                            // if (px + pw > b.Width)
                            // {
                            //     pw = b.Width - px;
                            // }
                            // if (py + ph > b.Height)
                            // {
                            //     ph = b.Height - py;
                            // }
                            // RectangleF rec = new RectangleF(px, py, pw, ph);
                            // Bitmap nb = b.Clone(rec, System.Drawing.Imaging.PixelFormat.Format32bppArgb);
                            // //重新保存图片
                            // var ms = new MemoryStream();
                            // nb.Save(ms, b.RawFormat);
                            // var img = ImageHelper.MakeThumbnail(new ImageParam()
                            // {
                            //     Mode = EnumHelper.ImageMode.W,
                            //     MaxWidth = previewMaxWidth,
                            //     Image = ms,
                            //     MaxLength = previewMaxLength
                            // });

                            // //var img = ImageHelper.MakeThumbnailV2(new ImageParam()
                            // //{
                            // //    FileSuffix = fileSuffix,
                            // //    Image = ms,
                            // //    MaxLength = previewMaxLength
                            // //});

                            // var putCaijianResult = await _iMicroiHDFS.PutObject(new HDFSParam()
                            // {
                            //     ClientModel = clientModel,
                            //     Limit = param.Limit,
                            //     FileFullPath = resultPath,
                            //     FileStream = img
                            // });
                            // if (putCaijianResult.Code != 1)
                            // {
                            //     return putCaijianResult;
                            // }
                        }
                        catch (Exception ex)
                        {
                            
                            var putCaijianResult = await _iMicroiHDFS.PutObject(new HDFSParam()
                            {
                                ClientModel = clientModel,
                                Limit = param.Limit,
                                FileFullPath = resultPath,
                                FileStream = file.Value
                            });
                            if (putCaijianResult.Code != 1)
                            {
                                return putCaijianResult;
                            }
                        }
                        #endregion
                    }
                    else
                    {
                        #region 压缩处理
                        //是否使用阿里OSS的图片压缩服务。注：oss压缩只能指定最大宽高、按比例压缩质量，并不能像程序那样控制MaxLength最大体积。
                        // ConfigHelper.GetAppSettings("UseAliOssImgProcess")
                        if (hdfs == "Aliyun" && clientModel.UseAliOssImgProcess == "1")
                        {
                            #region 阿里云压缩
                            var putCaijianResult = await _iMicroiHDFS.PutObject(new HDFSParam()
                            {
                                ClientModel = clientModel,
                                Limit = param.Limit,
                                FileFullPathOrigin = pathOrigin,
                                FileFullPath = resultPath,
                                Preview = true,
                            });
                            if (putCaijianResult.Code != 1)
                            {
                                return putCaijianResult;
                            }
                            #endregion
                        }
                        else
                        {
                            #region 服务器压缩
                            //centos会有错，一直没解决
                            Stream newImgStream = null;
                            try
                            {
                                newImgStream = ImageHelper.MakeThumbnail(new ImageParam()
                                {
                                    Mode = EnumHelper.ImageMode.W,
                                    MaxWidth = previewMaxWidth,
                                    Image = file.Value,//file.InputStream,
                                    MaxLength = previewMaxLength
                                });
                                //newImgStream = ImageHelper.MakeThumbnailV2(new ImageParam()
                                //{
                                //    FileSuffix = fileSuffix,
                                //    Image = file.Value,
                                //    MaxLength = previewMaxLength
                                //});
                            }
                            catch (Exception ex)
                            {
                                
                                newImgStream = file.Value;
                                newImgStream.Position = 0;
                            }

                            var putYasuoResult = await _iMicroiHDFS.PutObject(new HDFSParam()
                            {
                                ClientModel = clientModel,
                                Limit = param.Limit,
                                FileFullPath = resultPath,
                                FileStream = newImgStream
                            });
                            if (putYasuoResult.Code != 1)
                            {
                                return putYasuoResult;
                            }
                            #endregion
                        }
                        #endregion
                    }
                }
                #endregion

                #region 如果不压缩
                else
                {
                    var putResult = await _iMicroiHDFS.PutObject(new HDFSParam()
                    {
                        ClientModel = clientModel,
                        Limit = param.Limit,
                        FileFullPath = resultPath,
                        FileStream = file.Value
                    });
                    if (putResult.Code != 1)
                    {
                        return putResult;
                    }
                }
                #endregion

                #region 返回结果拼接
                //如果是多上传
                if (param.Multiple == true || files.Count > 1)
                {
                    result.Add(new
                    {
                        Path = resultPath,
                        Name = realFileName,//file.FileName,
                        Size = file.Value.Length, // file.Length.GetFileSize(),
                        CreateTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                        Id = param.FileId.DosIsNullOrWhiteSpace() ? Guid.NewGuid().ToString() : param.FileId
                    });
                }
                //如果是单文件上传
                else
                {
                    var tResult = new
                    {
                        Path = resultPath,
                        Name = realFileName,//file.FileName,
                        Size = file.Value.Length, //file.Length.GetFileSize(),
                        CreateTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                        Id = param.FileId.DosIsNullOrWhiteSpace() ? Guid.NewGuid().ToString() : param.FileId
                    };
                    //new SysLogLogic().AddSysLog(new SysLogParam()
                    //{
                    //    Type = "文件上传",
                    //    Title = "单文件上传成功",
                    //    Content = JsonConvert.SerializeObject(tResult),
                    //    OsClient = param.OsClient
                    //});
                    return new DosResult(1, tResult);
                }
                #endregion

            }

            #region 返回结果
            if (param.Multiple == true || files.Count > 1)
            {
                if (result.Any())
                {
                    //new SysLogLogic().AddSysLog(new SysLogParam()
                    //{
                    //    Type = "文件上传",
                    //    Title = "多文件上传成功",
                    //    Content = JsonConvert.SerializeObject(result),
                    //    OsClient = param.OsClient
                    //});
                    return new DosResult(1, result);
                }
            }
            #endregion

            return new DosResult(0, null, "An unknown error.");
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> GetPrivateFileByte(DiyUploadParam param)
        {
            param.ReturnFileType = "Byte";
            return await GetPrivateFileUrl(param);
        }
        /// <summary>
        /// 必传FilePathName或FilePathNames
        /// 传入OsClient、HDFS
        /// HDFS之所以前端传过来，为了将来支持部分是阿里云、部分是MinIO
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> GetPrivateFileUrl(DiyUploadParam param)
        {
            if (param.FilePathName.DosIsNullOrWhiteSpace() && (param.FilePathNames == null || !param.FilePathNames.Any()))
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient,  "ParamError", param._Lang));
            }

            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                param.OsClient = DiyToken.GetCurrentOsClient();
            }
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient,  "OsClientNotNull", param._Lang));
            }
            #region init。后期需改成动态，自由扩展第三方存储。
            var clientModel = OsClient.GetClient(param.OsClient);
            //默认阿里云，兼容低代码平台老版本数据库
            var hdfs = "Aliyun";
            if (!clientModel.HDFS.DosIsNullOrWhiteSpace())
            {
                hdfs = clientModel.HDFS;
            }
            var _iMicroiHDFS = default(IMicroiHDFS);
            switch (hdfs)
            {
                case "MinIO":
                    _iMicroiHDFS = MicroiEngine.HDFS(HDFSType.MinIO);
                    break;
                case "S3":
                    _iMicroiHDFS = MicroiEngine.HDFS(HDFSType.AmazonS3);
                    break;
                default:
                    _iMicroiHDFS = MicroiEngine.HDFS(HDFSType.Aliyun);
                    break;
            }

            #endregion
            DbSession dbSession = clientModel.Db;
            DbSession dbRead = clientModel.DbRead;
            //var resultSysConfig = await _formEngine.GetFormDataAsync(new
            //{
            //    FormEngineKey = "Sys_Config",
            //    _Where = new List<DiyWhere>{
            //                    new DiyWhere {
            //                        Name = "IsEnable",
            //                        Value = "1",
            //                        Type = "="
            //                    }
            //                },
            //    OsClient = param.OsClient
            //});
            var resultSysConfig = await MicroiEngine.FormEngine.GetSysConfig(param.OsClient);
            if (resultSysConfig.Code == 1 && param.HDFS.DosIsNullOrWhiteSpace())
            {
                try
                {
                    param.HDFS = (string)resultSysConfig.Data.HDFS;
                }
                catch (Exception ex)
                {

                }
            }
            var v8EngineParam = new V8EngineParam()
            {
                Db = dbSession,
                DbRead = dbRead,
                FormSubmitAction = "Insert",
                SysConfig = resultSysConfig.Data,
                InvokeType = param._InvokeType?.ToString(),
                OsClient = param.OsClient,
                Engine = V8Engine.CreateEngine()
            };

            v8EngineParam.Param.Add("FormEngineKey", param.FormEngineKey);
            v8EngineParam.Param.Add("FilePathName", param.FilePathName);
            v8EngineParam.Param.Add("FilePathNames", param.FilePathNames);
            v8EngineParam.Param.Add("HDFS", param.HDFS);
            v8EngineParam.Param.Add("FormDataId", param.FormDataId);
            v8EngineParam.Param.Add("FieldId", param.FieldId);

            if (param._CurrentUser != null)
                v8EngineParam.CurrentUser = param._CurrentUser;
            else
                v8EngineParam.CurrentUser = param._CurrentSysUser;

            #region 执行获取前事件
            try
            {
                if (resultSysConfig.Code == 1)
                {
                    var getPrivateFileBeforeServerV8 = (string)resultSysConfig.Data.GetPrivateFileBeforeServerV8;
                    if (!getPrivateFileBeforeServerV8.DosIsNullOrWhiteSpace())
                    {
                        #region 先执行全局服务器端v8引擎代码

                        try
                        {
                            //解密
                            try
                            {
                                resultSysConfig.Data.GlobalServerV8Code = Encoding.Default.GetString(Convert.FromBase64String(resultSysConfig.Data.GlobalServerV8Code));
                            }
                            catch (Exception ex)
                            {
                                

                            }
                            v8EngineParam.V8Code = resultSysConfig.Data.GlobalServerV8Code;
                            // v8EngineParam = MicroiEngine.V8Engine.Run(v8EngineParam);
                            v8EngineParam.SyncRun = true;
                            var v8RunResult = await MicroiEngine.V8Engine.Run(v8EngineParam);
                            if(v8RunResult.Code != 1)
                            {
                                return new DosResult(0, null, v8RunResult.Msg, 0, v8RunResult.DataAppend);
                            }
                            v8EngineParam = v8RunResult.Data;
                        }
                        catch (Exception ex)
                        {
                            
                            //throw new Exception("执行[全局服务器端V8引擎代码]出现错误：" + ex.Message);
                        }
                        #endregion
                        #region 执行表单提交前v8
                        //v8EngineParam.Param.Add("FormSubmitAction", "Insert");
                        //解密
                        try
                        {
                            getPrivateFileBeforeServerV8 = Encoding.Default.GetString(Convert.FromBase64String(getPrivateFileBeforeServerV8));
                        }
                        catch (Exception ex) {  }
                        
                
                        //然后执行服务器端数据处理v8引擎代码
                        try
                        {
                            //v8EngineParam.Form = param._RowModel;
                            v8EngineParam.V8Code = getPrivateFileBeforeServerV8;
                            // v8EngineParam = MicroiEngine.V8Engine.Run(v8EngineParam);
                            var v8RunResult = await MicroiEngine.V8Engine.Run(v8EngineParam);
                            if(v8RunResult.Code != 1)
                            {
                                return new DosResult(0, null, v8RunResult.Msg, 0, v8RunResult.DataAppend);
                            }
                            v8EngineParam = v8RunResult.Data;
                            if (v8EngineParam.Result != null)
                            {
                                return ((JObject)JObject.FromObject(v8EngineParam.Result)).ToObject<DosResult>();
                            }
                            //param._RowModel = v8EngineParam.Form as Dictionary<string, string>;
                        }
                        catch (Exception ex)
                        {
                            
                        }
                        #endregion
                    }
                }


            }
            catch (Exception ex)
            {
                        
                

            }
            #endregion

            DosResult result = await _iMicroiHDFS.GetPrivateFileUrl(new HDFSParam()
            {
                ClientModel = clientModel,
                FileFullPath = param.FilePathName,
                FileFullPaths = param.FilePathNames,
                ReturnFileType = param.ReturnFileType
            });
            #region 执行获取后事件
            try
            {
                if (resultSysConfig.Code == 1)
                {
                    var getPrivateFileAfterServerV8 = (string)resultSysConfig.Data.GetPrivateFileAfterServerV8;
                    if (!getPrivateFileAfterServerV8.DosIsNullOrWhiteSpace())
                    {
                        #region 先执行全局服务器端v8引擎代码
                        try
                        {
                            //解密
                            try
                            {

                                resultSysConfig.Data.GlobalServerV8Code = Encoding.Default.GetString(Convert.FromBase64String(resultSysConfig.Data.GlobalServerV8Code));
                            }
                            catch (Exception ex)
                            {
                                
                            }
                            v8EngineParam.V8Code = resultSysConfig.Data.GlobalServerV8Code;
                            // v8EngineParam = MicroiEngine.V8Engine.Run(v8EngineParam);
                            v8EngineParam.SyncRun = true;
                            var v8RunResult = await MicroiEngine.V8Engine.Run(v8EngineParam);
                            if(v8RunResult.Code != 1)
                            {
                                return new DosResult(0, null, v8RunResult.Msg, 0, v8RunResult.DataAppend);
                            }
                            v8EngineParam = v8RunResult.Data;
                        }
                        catch (Exception ex)
                        {
                            
                            //throw new Exception("执行[全局服务器端V8引擎代码]出现错误：" + ex.Message);
                        }
                        #endregion
                        #region 执行表单提交前v8
                        //v8EngineParam.Param.Add("FormSubmitAction", "Insert");
                        //解密
                        try
                        {
                            getPrivateFileAfterServerV8 = Encoding.Default.GetString(Convert.FromBase64String(getPrivateFileAfterServerV8));
                        }
                        catch (Exception ex) {  }
                        
                
                        //然后执行服务器端数据处理v8引擎代码
                        try
                        {
                            //v8EngineParam.Form = param._RowModel;
                            v8EngineParam.V8Code = getPrivateFileAfterServerV8;
                            // v8EngineParam = MicroiEngine.V8Engine.Run(v8EngineParam);
                            var v8RunResult = await MicroiEngine.V8Engine.Run(v8EngineParam);
                            if(v8RunResult.Code != 1)
                            {
                                return new DosResult(0, null, v8RunResult.Msg, 0, v8RunResult.DataAppend);
                            }
                            v8EngineParam = v8RunResult.Data;
                            if (v8EngineParam.Result != null)
                            {
                                return ((JObject)JObject.FromObject(v8EngineParam.Result)).ToObject<DosResult>();
                            }
                            //param._RowModel = v8EngineParam.Form as Dictionary<string, string>;
                        }
                        catch (Exception ex)
                        {
                            
                        }
                        #endregion
                    }
                }


            }
            catch (Exception ex)
            {
                        
                

            }
            #endregion

            return result;
        }
        private static string ReplaceDbCode(string fileName)
        {
            if (fileName.DosIsNullOrWhiteSpace())
            {
                return fileName;
            }
            //? * : " < > \ / |
            return fileName.Replace("'", "_")
                            .Replace("`", "_")
                            .Replace("?", "_")
                            .Replace("*", "_")
                            .Replace(":", "_")
                            .Replace("<", "_")
                            .Replace(">", "_")
                            .Replace("\\", "_")
                            .Replace("/", "_")
                            .Replace("|", "_")
                            .Replace(")", "_")
                            .Replace("(", "_")
                            .Replace("(", "_")
                            .Replace("!", "_")
                            .Replace("@", "_")
                            .Replace("#", "_")
                            .Replace("$", "_")
                            .Replace("%", "_")
                            .Replace("^", "_")
                            .Replace("+", "_")
                            .Replace("=", "_")
                            .Replace("[", "_")
                            .Replace("]", "_")
                            .Replace("{", "_")
                            .Replace("}", "_")
                            .Replace(";", "_")
                            .Replace(",", "_")
                            .Replace("\"", "_")
                            .Replace(">", "_")
                            .Replace("<", "_")
                            .Replace(".", "_")
                            .Replace("~", "_")
                            .Replace("·", "_")
                            .Replace(" ", "_")
                ;
        }
    }
}
