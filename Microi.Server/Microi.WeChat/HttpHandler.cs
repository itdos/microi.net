using System;
using System.IO;
using System.Net.Http;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;

namespace HttpHandlerDemo
{
    // 使用方法
    // HttpClient client = new HttpClient(new HttpHandler(
    //     "{商户号}", "{商户证书序列号}", "{由密钥管理系统注入的PKCS#8私钥}"));
    // ...
    // var response = client.GetAsync("https://api.mch.weixin.qq.com/v3/certificates");
    public class HttpHandler : DelegatingHandler
    {
        private readonly string merchantId;
        private readonly string serialNo;
        private readonly byte[] privateKeyData;

        public HttpHandler(string merchantId, string merchantSerialNo, string privateKeyPkcs8Base64)
        {
            if (string.IsNullOrWhiteSpace(merchantId))
                throw new ArgumentException("微信支付商户号不能为空。", nameof(merchantId));
            if (string.IsNullOrWhiteSpace(merchantSerialNo))
                throw new ArgumentException("微信支付证书序列号不能为空。", nameof(merchantSerialNo));
            if (string.IsNullOrWhiteSpace(privateKeyPkcs8Base64))
                throw new ArgumentException("微信支付私钥必须由安全配置注入，禁止使用源码内置私钥。", nameof(privateKeyPkcs8Base64));

            InnerHandler = new HttpClientHandler();

            this.merchantId = merchantId;
            this.serialNo = merchantSerialNo;
            try
            {
                privateKeyData = Convert.FromBase64String(
                    privateKeyPkcs8Base64
                        .Replace("-----BEGIN PRIVATE KEY-----", string.Empty)
                        .Replace("-----END PRIVATE KEY-----", string.Empty)
                        .Replace("\r", string.Empty)
                        .Replace("\n", string.Empty)
                        .Trim());
            }
            catch (FormatException ex)
            {
                throw new ArgumentException("微信支付私钥不是合法的PKCS#8 Base64。", nameof(privateKeyPkcs8Base64), ex);
            }
        }

        protected async override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            var auth = await BuildAuthAsync(request);
            string value = $"WECHATPAY2-SHA256-RSA2048 {auth}";
            request.Headers.Add("Authorization", value);

            return await base.SendAsync(request, cancellationToken);
        }

        protected async Task<string> BuildAuthAsync(HttpRequestMessage request)
        {
            string method = request.Method.ToString();
            string body = "";
            if (method == "POST" || method == "PUT" || method == "PATCH")
            {
                var content = request.Content;
                body = await content.ReadAsStringAsync();
            }

            string uri = request.RequestUri.PathAndQuery;
            var timestamp = DateTimeOffset.Now.ToUnixTimeSeconds();
            string nonce = Path.GetRandomFileName();

            string message = $"{method}\n{uri}\n{timestamp}\n{nonce}\n{body}\n";
            string signature = Sign(message);
            return $"mchid=\"{merchantId}\",nonce_str=\"{nonce}\",timestamp=\"{timestamp}\",serial_no=\"{serialNo}\",signature=\"{signature}\"";
        }

        protected string Sign(string message)
        {
            using var rsa = RSA.Create();
            rsa.ImportPkcs8PrivateKey(privateKeyData, out _);
            byte[] data = System.Text.Encoding.UTF8.GetBytes(message);
            return Convert.ToBase64String(rsa.SignData(data, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1));
        }
    }
}
