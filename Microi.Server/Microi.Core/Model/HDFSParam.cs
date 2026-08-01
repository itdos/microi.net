using System;
using System.Collections.Generic;
using System.IO;

namespace Microi.net
{
    public class HDFSParam
    {
        public OsClientSecret ClientModel { get; set; }
        public bool? Limit { get; set; }
        public string FileFullPath { get; set; }
        public string FileFullPathOrigin { get; set; }
        public List<string> FileFullPaths { get; set; }
        public Stream FileStream { get; set; }
        public bool Preview { get; set; }
        public string ReturnFileType { get; set; }
        public bool? NetworkIsInternet { get; set; }
        /// <summary>
        /// 单次对象存储请求超时（秒）。为空时由具体存储实现使用原有默认值；
        /// 大型备份等受控后台任务可显式放宽，但不改变普通文件上传的超时。
        /// </summary>
        public int? TimeoutSeconds { get; set; }
        public string _Lang = DiyMessage.Lang;

        /// <summary>
        /// 列表查询前缀
        /// </summary>
        public string Prefix { get; set; }
        /// <summary>
        /// 分隔符，用于模拟文件夹（通常为"/"）
        /// </summary>
        public string Delimiter { get; set; }
        /// <summary>
        /// 分页标记
        /// </summary>
        public string Marker { get; set; }
        /// <summary>
        /// 每页最大数量
        /// </summary>
        public int MaxKeys { get; set; } = 1000;
        /// <summary>
        /// 是否递归列出全部子目录。
        /// </summary>
        public bool? Recursive { get; set; }
        /// <summary>
        /// 搜索关键字
        /// </summary>
        public string Keyword { get; set; }
        /// <summary>
        /// 目标路径，用于复制/移动操作
        /// </summary>
        public string DestPath { get; set; }
    }
}

