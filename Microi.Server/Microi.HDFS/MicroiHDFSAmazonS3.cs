using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using Minio;
using Minio.DataModel.Args;

namespace Microi.net
{
    /// <summary>
    /// 亚马逊云S3分布式存储桶，共有、私有均支持CDN。
    /// 之所以未使用官方的Amazon.S3 SDK，是因为它并不支持.net standard2.0，所以使用MinIO SDK实现。
    /// </summary>
	public class MicroiHDFSAmazonS3 : MicroiHDFS, IMicroiHDFS
    {
        /// <summary>
        /// 获取私有文件的临时访问url，支持CDN鉴权
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> GetPrivateFileUrl(HDFSParam param)
        {
            var result = new DosResult();
            try
            {
                var clientModel = param.ClientModel;
                //2023-06-11：
                //如果MinIOEndPoint填写的是局域网IP+端口，虽然上传走了内网，但返回的地址用域名是不能访问此文件的
                //所以临时建议MinIOEndPoint填写外网地址：也就是9010映射的file.microios.com
                //2023-08-22：如果是S3，可能私有、公有是2个不同的EndPoint，所以不能单纯的使用MinIOEndPointInternet
                var endPoint = clientModel.MinIOEndPoint;
                var minioClient = new MinioClient()
                                    .WithEndpoint(endPoint)
                                    .WithCredentials(clientModel.MinIOAccessKey, clientModel.MinIOSecretKey);
                if (clientModel.MinIOEndPointSSL == 1)
                {
                    minioClient = minioClient.WithSSL();
                }
                if (!clientModel.MinIORegion.DosIsNullOrWhiteSpace())
                {
                    minioClient.WithRegion(clientModel.MinIORegion);//"ap-southeast-1"
                }
                minioClient = minioClient.Build();

                //如果是单文件
                if (!param.FileFullPath.DosIsNullOrWhiteSpace())
                {
                    //如果是返回byte[]
                    if (param.ReturnFileType == "Byte")
                    {
                        GetObjectArgs getArgs = new GetObjectArgs()
                                               .WithBucket(clientModel.MinIOPrivateBucketName);
                        //getArgs.WithFile(param.FilePathName.TrimStart('/'));
                        getArgs.WithObject(param.FileFullPath.TrimStart('/'));

                        MemoryStream memoryStream = new MemoryStream();

                        getArgs.WithCallbackStream(stream =>
                        {
                            stream.CopyTo(memoryStream);
                        });

                        var byteResult = await minioClient.GetObjectAsync(getArgs);
                        memoryStream.Position = 0;

                        result = new DosResult(1, StreamHelper.StreamToBytes(memoryStream));
                    }
                    #region 如果开启了私有文件cdn
                    else if (!clientModel.CloudFrontPrivateCDN.DosIsNullOrWhiteSpace())
                    {
                        var fileSuffix = Path.GetExtension(param.FileFullPath).ToLower();
                        var url = CreateCannedPrivateURL(clientModel.CloudFrontPrivateCDN + param.FileFullPath, "minutes", "30", "temp" + fileSuffix, clientModel.CloudFrontPrivatePemXml, clientModel.CloudFrontPublicPemId);
                        result = new DosResult(1, url);
                    }
                    #endregion
                    else//如果是返回Url
                    {
                        PresignedGetObjectArgs args = new PresignedGetObjectArgs()
                                                .WithBucket(clientModel.MinIOPrivateBucketName)
                                                .WithExpiry(60 * 30);//30分钟
                        args = args.WithObject(param.FileFullPath.TrimStart('/'));
                        var url = await minioClient.PresignedGetObjectAsync(args);
                        result = new DosResult(1, url);
                    }

                }
                else //如果是多文件
                {
                    PresignedGetObjectArgs args = new PresignedGetObjectArgs()
                                                .WithBucket(clientModel.MinIOPrivateBucketName)
                                                .WithExpiry(60 * 30);//30分钟
                    var fileList = new List<string>();
                    foreach (var item in param.FileFullPaths)
                    {
                        if (!clientModel.CloudFrontPrivateCDN.DosIsNullOrWhiteSpace())
                        {
                            var fileSuffix = Path.GetExtension(item).ToLower();
                            var url = CreateCannedPrivateURL(clientModel.CloudFrontPrivateCDN + param.FileFullPath, "minutes", "30", "temp" + fileSuffix, clientModel.CloudFrontPrivatePemXml, clientModel.CloudFrontPublicPemId);
                            fileList.Add(url);
                        }
                        else
                        {
                            args = args.WithObject(item.TrimStart('/'));
                            var url = await minioClient.PresignedGetObjectAsync(args);
                            fileList.Add(url);
                        }
                       
                    }
                    result = new DosResult(1, fileList);
                }
            }
            catch (Exception ex)
            {
                        
                
                result = new DosResult(0, null, ex.Message);
            }
            return result;
        }

        public async Task<DosResult<bool>> ObjectExist(HDFSParam param)
        {
            var clientModel = param.ClientModel;
            if (clientModel.MinIOEndPoint.DosIsNullOrWhiteSpace()
                    || clientModel.MinIOEndPointInternet.DosIsNullOrWhiteSpace()
                    || clientModel.MinIOAccessKey.DosIsNullOrWhiteSpace()
                    || clientModel.MinIOSecretKey.DosIsNullOrWhiteSpace()
                    || clientModel.MinIOPrivateBucketName.DosIsNullOrWhiteSpace()
                    || clientModel.MinIOPublicBucketName.DosIsNullOrWhiteSpace()
                    )
            {
                return new DosResult<bool>(0, false, "MinIO分布式存储配置不完整！");
            }

            var bucketName = "";

            IMinioClient minIOClient = null;
            var endPoint = clientModel.MinIOEndPoint;
            if (param.Limit != true)
            {
                endPoint = clientModel.MinIOEndPointInternet;
            }

            minIOClient = new MinioClient()
                                .WithEndpoint(endPoint)
                                .WithCredentials(clientModel.MinIOAccessKey, clientModel.MinIOSecretKey);

            if (clientModel.MinIOEndPointSSL == 1)
            {
                minIOClient = minIOClient.WithSSL();
            }

            minIOClient = minIOClient.Build();
            var objectExist = false;
            if (param.Limit == true)
            {
                bucketName = clientModel.MinIOPrivateBucketName;
            }
            else
            {
                bucketName = clientModel.MinIOPublicBucketName;
            }

            try
            {
                var statObjectArgs = new StatObjectArgs()
                                    .WithBucket(bucketName)
                                    .WithObject(param.FileFullPath.DosTrimStart('/'));

                var tempResult = await minIOClient.StatObjectAsync(statObjectArgs);
                objectExist = !tempResult.ObjectName.DosIsNullOrWhiteSpace();
            }
            catch (Exception ex)
            {
                        
                
                objectExist = false;
            }
            return new DosResult<bool>(1, objectExist);
        }

        public async Task<DosResult> PutObject(HDFSParam param)
        {
            var clientModel = param.ClientModel;
            if (clientModel.MinIOEndPoint.DosIsNullOrWhiteSpace()
                    || clientModel.MinIOEndPointInternet.DosIsNullOrWhiteSpace()
                    || clientModel.MinIOAccessKey.DosIsNullOrWhiteSpace()
                    || clientModel.MinIOSecretKey.DosIsNullOrWhiteSpace()
                    || clientModel.MinIOPrivateBucketName.DosIsNullOrWhiteSpace()
                    || clientModel.MinIOPublicBucketName.DosIsNullOrWhiteSpace()
                    )
            {
                return new DosResult(0, null, "MinIO分布式存储配置不完整！");
            }

            var bucketName = "";

            IMinioClient minIOClient = null;
            var endPoint = clientModel.MinIOEndPoint;
            if (param.Limit != true)
            {
                endPoint = clientModel.MinIOEndPointInternet;
            }

            minIOClient = new MinioClient()
                                .WithEndpoint(endPoint)
                                .WithCredentials(clientModel.MinIOAccessKey, clientModel.MinIOSecretKey);

            if (clientModel.MinIOEndPointSSL == 1)
            {
                minIOClient = minIOClient.WithSSL();
            }

            minIOClient = minIOClient.Build();

            if (param.Limit == true)
            {
                bucketName = clientModel.MinIOPrivateBucketName;
            }
            else
            {
                bucketName = clientModel.MinIOPublicBucketName;
            }

            var fileSuffix = Path.GetExtension(param.FileFullPath).ToLower();
            var contentType = "application/octet-stream";
            if (fileSuffix == ".pdf")
                contentType = "application/pdf";
            else if (fileSuffix == ".gif")
                contentType = "image/gif";
            else if (fileSuffix == ".png")
                contentType = "image/png";
            else if (fileSuffix == ".bmp")
                contentType = "image/bmp";
            else if (fileSuffix == ".jpg" || fileSuffix == ".jpeg")
                contentType = "image/jpeg";

            try
            {
                // 上传文件。注意：objectName不能以/开头，并且objectName区分大小写
                var putObjParam = new PutObjectArgs()
                                .WithObject(param.FileFullPath.DosTrimStart('/'))
                                .WithStreamData(param.FileStream)
                                .WithObjectSize(param.FileStream.Length)
                                .WithContentType(contentType)
                                ;
                if (!clientModel.MinIORegion.DosIsNullOrWhiteSpace())
                {
                    minIOClient.WithRegion(clientModel.MinIORegion);//"ap-southeast-1"
                }
                else
                {
                }
                putObjParam = putObjParam.WithBucket(bucketName);

                await minIOClient.PutObjectAsync(putObjParam);
                return new DosResult(1);
            }
            catch (Exception ex)
            {
                        
                
                return new DosResult(0, null, "MinIO Upload Error5:" + ex.Message);
            }
        }


        public static string ToUrlSafeBase64String(byte[] bytes)
        {
            return System.Convert.ToBase64String(bytes)
                .Replace('+', '-')
                .Replace('=', '_')
                .Replace('/', '~');
        }

        public static string CreateCannedPrivateURL(string urlString,
            string durationUnits, string durationNumber, string pathToPolicyStmnt,
            string pathToPrivateKey, string privateKeyId)
        {
            // args[] 0-thisMethod, 1-resourceUrl, 2-seconds-minutes-hours-days 
            // to expiration, 3-numberOfPreviousUnits, 4-pathToPolicyStmnt, 
            // 5-pathToPrivateKey, 6-PrivateKeyId

            TimeSpan timeSpanInterval = GetDuration(durationUnits, durationNumber);

            // Create the policy statement.
            string strPolicy = CreatePolicyStatement(pathToPolicyStmnt,
                urlString,
                DateTime.Now,
                DateTime.Now.Add(timeSpanInterval),
                "0.0.0.0/0");
            if ("Error!" == strPolicy) return "Invalid time frame." +
                "Start time cannot be greater than end time.";

            // Copy the expiration time defined by policy statement.
            string strExpiration = CopyExpirationTimeFromPolicy(strPolicy);

            // Read the policy into a byte buffer.
            byte[] bufferPolicy = Encoding.ASCII.GetBytes(strPolicy);

            // Initialize the SHA1CryptoServiceProvider object and hash the policy data.
            using (SHA1CryptoServiceProvider
                cryptoSHA1 = new SHA1CryptoServiceProvider())
            {
                bufferPolicy = cryptoSHA1.ComputeHash(bufferPolicy);

                // Initialize the RSACryptoServiceProvider object.
                RSACryptoServiceProvider providerRSA = new RSACryptoServiceProvider();
                //XmlDocument xmlPrivateKey = new XmlDocument();

                // Load PrivateKey.xml, which you created by converting your 
                // .pem file to the XML format that the .NET framework uses.  
                // Several tools are available. 
                //xmlPrivateKey.Load(pathToPrivateKey);
                //xmlPrivateKey.LoadXml(pathToPrivateKey);//.Replace("\n", "")

                // Format the RSACryptoServiceProvider providerRSA and 
                // create the signature.
                //providerRSA.FromXmlString(Convert.ToBase64String(Encoding.UTF8.GetBytes(pathToPrivateKey)));
                providerRSA.FromXmlString(pathToPrivateKey);
                RSAPKCS1SignatureFormatter rsaFormatter =
                    new RSAPKCS1SignatureFormatter(providerRSA);
                rsaFormatter.SetHashAlgorithm("SHA1");
                byte[] signedPolicyHash = rsaFormatter.CreateSignature(bufferPolicy);

                // Convert the signed policy to URL-safe base64 encoding and 
                // replace unsafe characters + = / with the safe characters - _ ~
                string strSignedPolicy = ToUrlSafeBase64String(signedPolicyHash);

                // Concatenate the URL, the timestamp, the signature, 
                // and the key pair ID to form the signed URL.
                return urlString +
                    "?Expires=" +
                    strExpiration +
                    "&Signature=" +
                    strSignedPolicy +
                    "&Key-Pair-Id=" +
                    privateKeyId;
            }
        }
        public static TimeSpan GetDuration(string units, string numUnits)
        {
            TimeSpan timeSpanInterval = new TimeSpan();
            switch (units)
            {
                case "seconds":
                    timeSpanInterval = new TimeSpan(0, 0, 0, int.Parse(numUnits));
                    break;
                case "minutes":
                    timeSpanInterval = new TimeSpan(0, 0, int.Parse(numUnits), 0);
                    break;
                case "hours":
                    timeSpanInterval = new TimeSpan(0, int.Parse(numUnits), 0, 0);
                    break;
                case "days":
                    timeSpanInterval = new TimeSpan(int.Parse(numUnits), 0, 0, 0);
                    break;
                default:
                    Console.WriteLine("Invalid time units; use seconds, minutes, hours, or days");
                    break;
            }
            return timeSpanInterval;
        }
        public static string CreatePolicyStatement(string policyStmnt, string resourceUrl,
                               DateTime startTime, DateTime endTime, string ipAddress)
        {
            // Create the policy statement.
            //FileStream streamPolicy = new FileStream(policyStmnt, FileMode.Open, FileAccess.Read);
            //using (StreamReader reader = new StreamReader(streamPolicy))
            {
                //string strPolicy = reader.ReadToEnd();
                string strPolicy = "{\"Statement\":[{\"Resource\":\"RESOURCE\",\"Condition\":{\"DateLessThan\":{\"AWS:EpochTime\":EXPIRES}}}]}";

                TimeSpan startTimeSpanFromNow = (startTime - DateTime.Now);
                TimeSpan endTimeSpanFromNow = (endTime - DateTime.Now);
                TimeSpan intervalStart =
                    (DateTime.UtcNow.Add(startTimeSpanFromNow)) - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);
                TimeSpan intervalEnd =
                    (DateTime.UtcNow.Add(endTimeSpanFromNow)) - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);

                int startTimestamp = (int)intervalStart.TotalSeconds; // START_TIME
                int endTimestamp = (int)intervalEnd.TotalSeconds;  // END_TIME

                if (startTimestamp > endTimestamp)
                    return "Error!";

                // Replace variables in the policy statement.
                strPolicy = strPolicy.Replace("RESOURCE", resourceUrl);
                strPolicy = strPolicy.Replace("START_TIME", startTimestamp.ToString());
                strPolicy = strPolicy.Replace("END_TIME", endTimestamp.ToString());
                strPolicy = strPolicy.Replace("IP_ADDRESS", ipAddress);
                strPolicy = strPolicy.Replace("EXPIRES", endTimestamp.ToString());
                return strPolicy;
            }
        }
        public static string CopyExpirationTimeFromPolicy(string policyStatement)
        {
            int startExpiration = policyStatement.IndexOf("EpochTime");
            string strExpirationRough = policyStatement.Substring(startExpiration + "EpochTime".Length);
            char[] digits = { '0', '1', '2', '3', '4', '5', '6', '7', '8', '9' };
            List<char> listDigits = new List<char>(digits);
            StringBuilder buildExpiration = new StringBuilder(20);
            foreach (char c in strExpirationRough)
            {
                if (listDigits.Contains(c))
                    buildExpiration.Append(c);
            }
            return buildExpiration.ToString();
        }
    }
}

