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
        /// 搜索关键字
        /// </summary>
        public string Keyword { get; set; }
        /// <summary>
        /// 目标路径，用于复制/移动操作
        /// </summary>
        public string DestPath { get; set; }
    }
}

