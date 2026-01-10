using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using RestSharp;

namespace Microi.net
{
    /// <summary>
    /// HTTP 请求接口定义
    /// </summary>
    public interface IMicroiHttp
    {
        /// <summary>
        /// 异步执行POST请求
        /// </summary>
        /// <param name="dynamicParam">动态参数</param>
        /// <returns>响应字符串</returns>
        Task<string> PostAsync(dynamic dynamicParam);

        /// <summary>
        /// 同步执行POST请求
        /// </summary>
        /// <param name="dynamicParam">动态参数</param>
        /// <returns>响应字符串</returns>
        string Post(dynamic dynamicParam);

        /// <summary>
        /// 使用指定URL执行POST请求
        /// </summary>
        /// <param name="url">请求URL</param>
        /// <param name="dynamicParam">动态参数</param>
        /// <returns>响应字符串</returns>
        string Post(string url, dynamic dynamicParam);

        /// <summary>
        /// 异步执行POST请求并返回完整响应
        /// </summary>
        /// <param name="dynamicParam">动态参数</param>
        /// <returns>V8EngineHttpResponse响应对象</returns>
        Task<V8EngineHttpResponse> PostResponseAsync(dynamic dynamicParam);

        /// <summary>
        /// 同步执行POST请求并返回完整响应
        /// </summary>
        /// <param name="dynamicParam">动态参数</param>
        /// <returns>V8EngineHttpResponse响应对象</returns>
        V8EngineHttpResponse PostResponse(dynamic dynamicParam);

        /// <summary>
        /// 异步执行GET请求
        /// </summary>
        /// <param name="dynamicParam">动态参数</param>
        /// <returns>响应字符串</returns>
        Task<string> GetAsync(dynamic dynamicParam);

        /// <summary>
        /// 同步执行GET请求
        /// </summary>
        /// <param name="dynamicParam">动态参数</param>
        /// <returns>响应字符串</returns>
        string Get(dynamic dynamicParam);

        /// <summary>
        /// 异步执行GET请求并返回完整响应
        /// </summary>
        /// <param name="dynamicParam">动态参数</param>
        /// <returns>V8EngineHttpResponse响应对象</returns>
        Task<V8EngineHttpResponse> GetResponseAsync(dynamic dynamicParam);

        /// <summary>
        /// 同步执行GET请求并返回完整响应
        /// </summary>
        /// <param name="dynamicParam">动态参数</param>
        /// <returns>V8EngineHttpResponse响应对象</returns>
        V8EngineHttpResponse GetResponse(dynamic dynamicParam);

        /// <summary>
        /// 异步执行GET请求并返回流
        /// </summary>
        /// <param name="dynamicParam">动态参数</param>
        /// <returns>响应流</returns>
        Task<Stream> GetStreamAsync(dynamic dynamicParam);

        /// <summary>
        /// 同步执行GET请求并返回流
        /// </summary>
        /// <param name="dynamicParam">动态参数</param>
        /// <returns>响应流</returns>
        Stream GetStream(dynamic dynamicParam);

        /// <summary>
        /// POST 请求返回字符串
        /// </summary>
        /// <param name="param">HTTP 请求参数</param>
        /// <returns>响应字符串</returns>
        Task<string> Post(DiyHttpParam param);

        /// <summary>
        /// POST 请求返回 RestResponse
        /// </summary>
        /// <param name="param">HTTP 请求参数</param>
        /// <returns>RestResponse 对象</returns>
        Task<RestResponse> PostResponse(DiyHttpParam param);

        /// <summary>
        /// 下载文件请求
        /// </summary>
        /// <param name="param">HTTP 请求参数</param>
        /// <returns>RestResponse 对象</returns>
        Task<RestResponse> Download(DiyHttpParam param);

        /// <summary>
        /// POST 请求返回泛型对象
        /// </summary>
        /// <typeparam name="T">返回类型</typeparam>
        /// <param name="param">HTTP 请求参数</param>
        /// <returns>泛型对象</returns>
        Task<T> Post<T>(DiyHttpParam param);

        /// <summary>
        /// POST 请求返回字符串
        /// </summary>
        /// <param name="param">HTTP 请求参数</param>
        /// <returns>响应字符串</returns>
        Task<string> PostString(DiyHttpParam param);

        /// <summary>
        /// GET 请求返回字符串
        /// </summary>
        /// <param name="param">HTTP 请求参数</param>
        /// <returns>响应字符串</returns>
        Task<string> Get(DiyHttpParam param);

        /// <summary>
        /// GET 请求返回 RestResponse
        /// </summary>
        /// <param name="param">HTTP 请求参数</param>
        /// <returns>RestResponse 对象</returns>
        Task<RestResponse> GetResponseAsync(DiyHttpParam param);

        /// <summary>
        /// GET 请求返回字符串
        /// </summary>
        /// <param name="url">请求URL</param>
        /// <returns>响应字符串</returns>
        Task<string> Get(string url);

        /// <summary>
        /// GET 请求返回泛型对象
        /// </summary>
        /// <typeparam name="T">返回类型</typeparam>
        /// <param name="param">HTTP 请求参数</param>
        /// <returns>泛型对象</returns>
        Task<T> Get<T>(DiyHttpParam param);

        /// <summary>
        /// GET 请求返回流
        /// </summary>
        /// <param name="param">HTTP 请求参数</param>
        /// <returns>响应流</returns>
        Task<Stream> GetStream(DiyHttpParam param);

        /// <summary>
        /// GET 请求返回流
        /// </summary>
        /// <param name="url">请求URL</param>
        /// <returns>响应流</returns>
        Task<Stream> GetStream(string url);

        /// <summary>
        /// GET 请求返回字节数组
        /// </summary>
        /// <param name="param">HTTP 请求参数</param>
        /// <returns>字节数组</returns>
        Task<byte[]> GetByte(DiyHttpParam param);

        /// <summary>
        /// GET 请求返回字节数组
        /// </summary>
        /// <param name="url">请求URL</param>
        /// <returns>字节数组</returns>
        Task<byte[]> GetByte(string url);
    }
}
