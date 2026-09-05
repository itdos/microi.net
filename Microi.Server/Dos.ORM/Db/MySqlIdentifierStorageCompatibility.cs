using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Linq;
using System.Text.RegularExpressions;
using MySql.Data.MySqlClient;

namespace Dos.ORM
{
    // MYSQL_IDENTIFIER_FOREIGN_KEY_SCOPE_V1. Only type-preserving string widening;
    // no caller SQL, DML, dropped constraints, global settings, or pooled session state.
    internal static class MySqlIdentifierStorageCompatibility
    {
        internal static int Widen(Database database, string tableName, string specifications)
        {
            if (!Regex.IsMatch(tableName ?? "", @"^[A-Za-z_][A-Za-z0-9_]*$"))
                throw new ArgumentException("Invalid identifier table name.");
            var widths = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            foreach (var specification in (specifications ?? "").Split(','))
            {
                var match = Regex.Match(specification, @"^([A-Za-z_][A-Za-z0-9_]*Id|Id):(\d+)$", RegexOptions.IgnoreCase);
                if (!match.Success || !int.TryParse(match.Groups[2].Value, out var width) || width < 36 || width > 255)
                    throw new ArgumentException("Identifier columns must declare a width between 36 and 255.");
                widths.Add(match.Groups[1].Value, width);
            }
            using (var connection = database.CreateConnection())
            {
                if (!(connection is MySqlConnection)) throw new NotSupportedException("MySQL identifier compatibility requires MySQL.");
                // Keep credentials entirely inside the backend. Even a failed restore or
                // a killed process cannot return foreign_key_checks=0 to a shared pool.
                connection.ConnectionString = new MySqlConnectionStringBuilder(connection.ConnectionString) { Pooling = false }.ConnectionString;
                database.OpenConnectionWithGuard(connection);
                using (var command = connection.CreateCommand())
                {
                    command.CommandText = "SELECT @@SESSION.foreign_key_checks";
                    var originalChecks = Convert.ToInt32(command.ExecuteScalar());
                    if (originalChecks != 1) throw new InvalidOperationException("Identifier upgrade requires enabled foreign key checks.");
                    command.CommandText = "SHOW CREATE TABLE `" + tableName + "`";
                    string definition;
                    using (var reader = command.ExecuteReader())
                    {
                        if (!reader.Read()) throw new InvalidOperationException("Identifier table definition was not returned.");
                        definition = reader.GetString(1);
                    }
                    var changes = new List<string>();
                    var changedWidths = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                    foreach (var item in widths)
                    {
                        var pattern = @"^\s*`" + Regex.Escape(item.Key) + @"`\s+char\(36\)(?=\s|,|$).*$";
                        var line = Regex.Match(definition, pattern, RegexOptions.Multiline | RegexOptions.IgnoreCase);
                        if (!line.Success) continue;
                        var original = line.Value.Trim().TrimEnd(',');
                        changes.Add("MODIFY COLUMN " + Regex.Replace(original,
                            @"^(`[^`]+`\s+)char\(36\)", "${1}varchar(" + item.Value + ")", RegexOptions.IgnoreCase));
                        changedWidths.Add(item.Key, item.Value);
                    }
                    if (changes.Count == 0) return 0;
                    var beforeKeys = ForeignKeySnapshot(command, tableName);
                    try
                    {
                        command.CommandText = "SET SESSION foreign_key_checks=0";
                        command.ExecuteNonQuery();
                        command.CommandText = "ALTER TABLE `" + tableName + "` " + string.Join(", ", changes);
                        command.ExecuteNonQuery();
                    }
                    finally
                    {
                        command.CommandText = "SET SESSION foreign_key_checks=1";
                        command.ExecuteNonQuery();
                    }
                    if (!string.Equals(beforeKeys, ForeignKeySnapshot(command, tableName), StringComparison.Ordinal))
                        throw new InvalidOperationException("Identifier widening changed a foreign key definition.");
                    command.CommandText = "SELECT COLUMN_NAME,COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@table";
                    command.Parameters.Clear();
                    var parameter = command.CreateParameter(); parameter.ParameterName = "@table"; parameter.Value = tableName; command.Parameters.Add(parameter);
                    var actual = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                    using (var reader = command.ExecuteReader()) while (reader.Read()) actual[reader.GetString(0)] = reader.GetString(1);
                    foreach (var item in changedWidths)
                        if (!actual.TryGetValue(item.Key, out var type) || !string.Equals(type, "varchar(" + item.Value + ")", StringComparison.OrdinalIgnoreCase))
                            throw new InvalidOperationException("Identifier widening readback failed: " + tableName + "." + item.Key);
                    return changes.Count;
                }
            }
        }

        private static string ForeignKeySnapshot(DbCommand command, string tableName)
        {
            command.CommandText = "SELECT k.CONSTRAINT_SCHEMA,k.TABLE_NAME,k.CONSTRAINT_NAME,k.COLUMN_NAME,k.ORDINAL_POSITION,k.REFERENCED_TABLE_SCHEMA,k.REFERENCED_TABLE_NAME,k.REFERENCED_COLUMN_NAME,r.UPDATE_RULE,r.DELETE_RULE " +
                "FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE k JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.TABLE_NAME=k.TABLE_NAME AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME " +
                "WHERE (k.TABLE_SCHEMA=DATABASE() AND k.TABLE_NAME=@table) OR (k.REFERENCED_TABLE_SCHEMA=DATABASE() AND k.REFERENCED_TABLE_NAME=@table) " +
                "ORDER BY k.CONSTRAINT_SCHEMA,k.TABLE_NAME,k.CONSTRAINT_NAME,k.ORDINAL_POSITION";
            command.Parameters.Clear();
            var parameter = command.CreateParameter(); parameter.ParameterName = "@table"; parameter.Value = tableName; command.Parameters.Add(parameter);
            var rows = new List<string>();
            using (var reader = command.ExecuteReader())
                while (reader.Read()) rows.Add(string.Join("\u001f", Enumerable.Range(0, reader.FieldCount).Select(index => Convert.ToString(reader.GetValue(index)))));
            command.Parameters.Clear();
            return string.Join("\u001e", rows);
        }
    }
}
