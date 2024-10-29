using System;
namespace Microi.net
{
    public class DbInfo
    {
        public char L { get; set; }
        public char R { get; set; }
        public char P { get; set; }
        public string DbType { get; set; }
        public IDbService DbService { get; set; }
    }
}

