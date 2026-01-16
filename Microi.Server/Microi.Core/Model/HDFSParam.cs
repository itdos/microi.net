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
        public List<string> FileFullPaths { get; set; } = new List<string>();
        public Stream FileStream { get; set; }
        public bool Preview { get; set; }
        public string ReturnFileType { get; set; }
        public bool? NetworkIsInternet { get; set; }
        public string _Lang = DiyMessage.Lang;
    }
}

