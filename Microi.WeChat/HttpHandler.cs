using System;
using System.IO;
using System.Net.Http;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;

namespace HttpHandlerDemo
{
    // 使用方法
    // HttpClient client = new HttpClient(new HttpHandler("{商户号}", "{商户证书序列号}"));
    // ...
    // var response = client.GetAsync("https://api.mch.weixin.qq.com/v3/certificates");
    public class HttpHandler : DelegatingHandler
    {
        private readonly string merchantId;
        private readonly string serialNo;

        public HttpHandler(string merchantId, string merchantSerialNo)
        {
            InnerHandler = new HttpClientHandler();

            this.merchantId = merchantId;
            this.serialNo = merchantSerialNo;
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
            // NOTE： 私钥不包括私钥文件起始的-----BEGIN PRIVATE KEY-----
            //        亦不包括结尾的-----END PRIVATE KEY-----
            string privateKey = "MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDQ4uV5OZE3gCZ4\nhHNweYyP1hyj+3VGXERkxAGINz02n6lpNgp2IGMD3YvmDtndYca+6Fw3o9yLfWkF\n9R6+gRIdGTrqi4KXfi6OrM06J/dB3Db1MosdwD5+3pM3laRms78TFsCffXKNAdXQ\nbUl2QOtOiX8XEEL7n1QepAmGNK3YlPrgf3c6U+X7uLtYfSJRA7xgzKa4VH1uCzCd\nCifIBPUx0cu2Eq6ieUCslvkpCzypkT/X4C1KfmfiL7lwABqJsDovk686UG8B3R/+\nUGtqcsJhwscLITOFuGEd9oTYWaA+fTd3QR/Kfa6oPu/aVSxORA4v9HvCkwWhYkmd\nD1n3XQEvAgMBAAECggEATxsOUjlV4FHcv9lRKnAtpi8sy4EoKYw5rnt4JRDeUrhm\nXNzFW3TqaoVVPLu1EBy+OoAepEee9wh4ZHQuv3B73p82a6qHuz1i/k88rWCDR+LQ\nwUzx2EN8p2k9EVjPWMGLg/wi2IOWhQYD5hntLyZotmZlxeM3qrjtD2mJ3dRHXfRm\nMZFhMKJLrBb8WDBijLvaw3yp4BLquqwmmoQ3E0i4IbDeEptMu2jjBUugrIDGHnnZ\nQ3DwVUNWvILqQMaoIbcHY/uFo5641LeK+tSuqHcqNLpGPJSe5UfH1RNwQ/rto7bC\np20p3k8tIaCKR+55O0P8Bcjp3YV4Ea4asJUs3rGjmQKBgQDybsl+9rt3FRxHtLGg\nusTLCkN8P+yuLMr3IQePWE1duKVeUBQcPg3FhFJ05g00pMg239WpKLl5DBPwxKSm\n7HMQYW63cBZjxpyvaMkDK3bBBthAV+MCvUeHUj2Qk3ndBmqQultq83asZAiW8vLF\n8OCro9rzWWI6Skimw4tzbgf8RQKBgQDck4GQOuUpM1h2k+R7ERmOpMdO36BrJ7kp\nSzaYkLnrJEtH7jy2247tng35EvZppQDm6suBj7zIzCCk/nvxnU85JJ+iTOj0nf2C\nzmhVmHdPctyh9p6wlTYOUdIg9/H4zrbwkYQAsxSMJ7S2nj7akplzlukBgtRWdow9\nG+GazrQQ4wKBgCtMgC5t8NN28MMZ0bPMR8OfxKfXXvVIyMNUod4HPmIjzV1H3h+h\nMaJ6XKPGRsuFNsEePzHkNSQadSFGbcXmazKcxEJ9AXK2kVt+0o//XklhaJQtXj0q\nAzF3DcnZnSVNtRC+R/+VFjf58dLL93JE8EuXi051Q2b3x3wJZsmp+EElAoGAPb8l\nI+T4xaHT/83CxhixWNcT3CaJ17VVBhRCAk9xXDvavxYX9PBdgHMgYjtGs6g3Km1L\n7sb4CBXshYOf2rE4vjxcW6jABco8b2OsnVmC/MCgts48+h2q9jM9aXE/UXE8kPeL\nRk7bT6jF0+FUowcq4cq7C2s+Wb3x4CFv9FAs5BUCgYB2BWD8Nb2eqVqz/CSxZ4f5\nsmPCol02DtY/OWpRz60+UWmJ+lCVw0E6w2dhELhFjrqyotxL4E7CirWwPGI3bJ4a\nlfH9QSEAp1b6aHu5l50JtxGW5J/GjhE/ygoKCwnSdkRrCwykmWy8XSPsO1f7483t\nvvnJbYDZyVVhq+tG3DOO9Q==";
            byte[] keyData = Convert.FromBase64String(privateKey);

            var rsa = RSA.Create();
            //适用该方法的版本https://learn.microsoft.com/zh-cn/dotnet/api/system.security.cryptography.asymmetricalgorithm.importpkcs8privatekey?view=net-7.0
            rsa.ImportPkcs8PrivateKey(keyData, out _);
            rsa.ImportPkcs8PrivateKey(keyData, out _);
            byte[] data = System.Text.Encoding.UTF8.GetBytes(message);
            return Convert.ToBase64String(rsa.SignData(data, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1));
        }
    }
}