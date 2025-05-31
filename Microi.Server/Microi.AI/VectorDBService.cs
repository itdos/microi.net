using System;
using System.Collections.Generic;

namespace Microi.AI
{
    // 新增向量数据库服务
    public class VectorDBService
    {
        // public void StoreVectors(IEnumerable<DataRecord> records)
        // {
        //     // 使用SentenceTransformers生成向量
        //     var embeddings = records.AsParallel()
        //         .Select(r => GenerateEmbedding($"{r.Product}|{r.Region}|{r.Date:yyyyMMdd}"))
        //         .ToList();

        //     // 本地FAISS存储（需安装Microsoft.ML.Faiss）
        //     using var index = FaissIndex.Create(embeddings.First().Length, FaissMetricType.METRIC_L2);
        //     index.Add(embeddings.ToArray());
        //     FaissIndex.Write(index, "data_vectors.idx");
        // }

        // private float[] GenerateEmbedding(string text)
        // {
        //     // 调用本地Embedding模型
        //     using var pipe = new SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2");
        //     return pipe.Encode(text).ToArray();
        // }
    }

}