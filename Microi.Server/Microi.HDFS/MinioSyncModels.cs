using System.Collections.Generic;

namespace Microi.net
{
    public class MinioConnectionOptions
    {
        public string Endpoint { get; set; }
        public string AccessKey { get; set; }
        public string SecretKey { get; set; }
        public string Region { get; set; }
        public string PrivateBucketName { get; set; }
        public string PublicBucketName { get; set; }
        public string RootPath { get; set; }
    }

    public class MinioProbeParam
    {
        public MinioConnectionOptions Connection { get; set; }
        public bool EnsureBuckets { get; set; }
    }

    public class MinioListObjectsParam
    {
        public MinioConnectionOptions Connection { get; set; }
        public string Path { get; set; }
        public bool Limit { get; set; } = true;
        public string Keyword { get; set; }
        public bool Recursive { get; set; }
        public int MaxKeys { get; set; } = 10000;
    }

    public class MinioCreateFolderParam
    {
        public MinioConnectionOptions Connection { get; set; }
        public string FilePathName { get; set; }
        public bool Limit { get; set; } = true;
    }

    public class MinioObjectSyncParam
    {
        public string CurrentOsClient { get; set; }
        public string SourcePlatformType { get; set; }
        public string TargetPlatformType { get; set; }
        public MinioConnectionOptions SourceConnection { get; set; }
        public MinioConnectionOptions TargetConnection { get; set; }
        public string SourcePath { get; set; }
        public string TargetPath { get; set; }
        public bool SourceLimit { get; set; } = true;
        public bool TargetLimit { get; set; } = true;
        public string SyncRule { get; set; }
    }

    public class MinioProbeResult
    {
        public List<string> Buckets { get; set; } = new List<string>();
        public string PrivateBucketName { get; set; }
        public string PublicBucketName { get; set; }
        public bool PrivateBucketCreated { get; set; }
        public bool PublicBucketCreated { get; set; }
    }
}
