using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    public interface IDataSourceEngine
    {
        Task<dynamic> RunAsync(dynamic dynamicParam);
    }
}
