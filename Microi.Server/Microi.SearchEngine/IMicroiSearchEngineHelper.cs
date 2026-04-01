using Nest;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Microi.net
{
    public interface IMicroiSearchEngineHelper
    {
        Task<MicroiSearchEngineResult> AsyncIndex(string tableId, string osClient = null);

        Task<MicroiSearchEngineResult> AddDocument(string tableName, string id, string osClient = null);

        Task<MicroiSearchEngineResult> UpdateDocument(string tableName, string id, string osClient = null);

        Task<MicroiSearchEngineResult> DeleteDocument(string index, string id, string osClient = null);

        Task<MicroiSearchEngineResult> AddField(MicroiSearchEngineFieldModel fieldModel, string osClient = null);

        Task<MicroiSearchEngineResult> GetSearchResponse(MicroiSearchEngineParam searchParam);

        Task<MicroiSearchEngineResult> AsyncTableDataToIndex(string tableId, string osClient = null);
    }
}
