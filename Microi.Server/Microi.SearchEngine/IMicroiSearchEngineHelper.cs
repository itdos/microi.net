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
        Task<MicroiSearchEngineResult> AsyncIndex( string tableId);

        Task<MicroiSearchEngineResult> AddDocument(string tableName, string id);

        Task<MicroiSearchEngineResult> UpdateDocument(string tableName, string id);

        Task<MicroiSearchEngineResult> DeleteDocument(string index, string id);

        Task<MicroiSearchEngineResult> AddField(MicroiSearchEngineFieldModel fieldModel);

        Task<MicroiSearchEngineResult> GetSearchResponse(MicroiSearchEngineParam searchParam);

        Task<MicroiSearchEngineResult> AsyncTableDataToIndex(string tableId);
    }
}
