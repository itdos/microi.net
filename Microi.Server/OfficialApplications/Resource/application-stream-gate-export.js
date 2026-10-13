/* APPLICATION_STREAM_GATE_PHYSICAL_EXPORT_V1
 * 固定官方应用包归属，只读取物理目录；不读取审计行，不接受调用方 DDL，
 * 不为安全台账伪造可写的 DIY 元数据。
 */
function appendApplicationStreamGatePhysicalContract(packageData) {
    if (V8.Param.IncludeApplicationStreamGateContract !== true) return;
    if (String(V8.OsClient).toLowerCase() != 'itdos' || Number((V8.CurrentUser || {}).Level) < 9999
        || String(V8.Param.PersistAppKey || '') != 'app.microi.store')
        throw new Error('应用流式发布物理契约仅允许官方管理员制作 app.microi.store');
    var tableName = 'mci_app_stream_gate_transition';
    if ((packageData.DiyTables || []).some(function (t) { return String(t.Name).toLowerCase() == tableName; })
        || (packageData.DataSets || []).some(function (d) { return String(d.TableName).toLowerCase() == tableName; }))
        throw new Error('应用流式发布审计表禁止 DIY 元数据或种子数据');
    var requiredColumns = APPLICATION_STREAM_GATE_AUDIT_COLUMNS;
    var requiredIndexes = APPLICATION_STREAM_GATE_INDEXES;
    var sourceType = String((V8.OsClientModel || {}).DbType || 'MySql').toLowerCase();
    if (sourceType.indexOf('mysql') < 0 && sourceType.indexOf('mariadb') < 0)
        throw new Error('应用流式发布物理契约导出尚不支持当前源数据库');
    var catalog = JSON.parse(JSON.stringify(V8.Db.FromSql('SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,DATA_TYPE,IS_NULLABLE,COLUMN_DEFAULT,COLUMN_COMMENT,COLUMN_KEY,EXTRA,ORDINAL_POSITION '
        + 'FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@p0 ORDER BY ORDINAL_POSITION')
        .AddInParameter('@p0', tableName).ToArray()));
    var definitions = [], exportedColumns = [];
    for (var ci = 0; ci < requiredColumns.length; ci++) {
        var required = requiredColumns[ci], matches = [];
        for (var ri = 0; ri < catalog.length; ri++) if (String(catalog[ri].COLUMN_NAME) == required[0]) matches.push(catalog[ri]);
        if (matches.length != 1) throw new Error('官方母版审计物理列缺失或重复：' + required[0]);
        var column = JSON.parse(JSON.stringify(matches[0]));
        var type = String(column.COLUMN_TYPE).toLowerCase().replace(/^(int|bigint)\(\d+\)$/, '$1');
        if (type != required[1]) throw new Error('官方母版审计物理列类型不一致：' + required[0]);
        if (required[2]) column.SQLSERVER_UNICODE = true;
        exportedColumns.push(column);
        definitions.push('`' + required[0] + '` ' + type + (required[0] == 'Id' ? ' NOT NULL PRIMARY KEY'
            : (String(column.IS_NULLABLE).toUpperCase() == 'NO' ? ' NOT NULL' : ' NULL')));
    }
    var indexes = JSON.parse(JSON.stringify(V8.Db.FromSql('SELECT TABLE_NAME,INDEX_NAME,COLUMN_NAME,SEQ_IN_INDEX,NON_UNIQUE,INDEX_TYPE,SUB_PART,COLLATION AS SORT_ORDER '
        + 'FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (@p0,@p1,@p2,@p3) ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX')
        .AddInParameter('@p0', 'sys_microistore').AddInParameter('@p1', 'mci_ai_app_version')
        .AddInParameter('@p2', 'mci_ai_app_file').AddInParameter('@p3', tableName).ToArray()));
    var additions = [{ TableName: tableName, DDL: 'CREATE TABLE IF NOT EXISTS `' + tableName + '` (' + definitions.join(',') + ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;', ApplicationStreamGateContract: true }];
    for (var ii = 0; ii < requiredIndexes.length; ii++) {
        var expected = requiredIndexes[ii];
        var rows = indexes.filter(function (row) { return String(row.TABLE_NAME) == expected.TableName && String(row.INDEX_NAME) == expected.IndexName; });
        if (rows.length != expected.Columns.length) throw new Error('官方母版门禁索引缺失：' + expected.IndexName);
        for (var ki = 0; ki < rows.length; ki++) {
            var row = rows[ki];
            if (String(row.COLUMN_NAME) != expected.Columns[ki] || Number(row.SEQ_IN_INDEX) != ki + 1
                || Number(row.NON_UNIQUE) != (expected.Unique ? 0 : 1) || String(row.INDEX_TYPE).toUpperCase() != 'BTREE'
                || (row.SUB_PART !== null && row.SUB_PART !== undefined) || String(row.SORT_ORDER).toUpperCase() != 'A')
                throw new Error('官方母版门禁索引定义不一致：' + expected.IndexName);
        }
        var ddl = { TableName: expected.TableName, IndexName: expected.IndexName,
            DDL: 'CREATE ' + (expected.Unique ? 'UNIQUE ' : '') + 'INDEX `' + expected.IndexName + '` ON `' + expected.TableName + '` ('
                + expected.Columns.map(function (name) { return '`' + name + '`'; }).join(',') + ');', ApplicationStreamGateContract: true };
        if (expected.SqlServerFilterColumn) ddl.SqlServerFilterColumn = expected.SqlServerFilterColumn;
        additions.push(ddl);
    }
    packageData.DDLStatements = (packageData.DDLStatements || []).filter(function (row) {
        return row.TableName != tableName && !requiredIndexes.some(function (index) {
            return index.TableName == row.TableName && (row.IndexName == index.IndexName
                || new RegExp('^CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+`?' + index.IndexName + '(?:`|\\s)', 'i').test(row.DDL));
        });
    }).concat(additions);
    packageData.PhysicalColumns = (packageData.PhysicalColumns || []).filter(function (row) { return row.TABLE_NAME != tableName; }).concat(exportedColumns);
    packageData.PackageInfo.DDLCount = packageData.DDLStatements.length;
    packageData.PackageInfo.PhysicalColumnCount = packageData.PhysicalColumns.length;
}
/* END_APPLICATION_STREAM_GATE_PHYSICAL_EXPORT_V1 */
