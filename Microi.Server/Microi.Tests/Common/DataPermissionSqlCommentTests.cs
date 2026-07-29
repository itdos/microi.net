using System.Reflection;
using Microi.net;
using Xunit;

namespace Microi.Tests.Common
{
    public class DataPermissionSqlCommentTests
    {
        [Fact]
        public void Normalize_RemovesDesignerLineCommentsAndMarker_ButKeepsExecutableSql()
        {
            var source = @"-- MICROI_DATA_PERMISSION_V1:YWJj
-- 【权限说明】总条件开始
(
  -- 【权限说明】租户隔离
  A.TenantId = '$CurrentUser.TenantId$'
  -- 【权限说明】组合关系
  AND (
    -- 【权限说明】超级管理员放行
    $CurrentUser.Level$ >= 9999
    -- 【权限说明】普通用户范围
    OR A.UserId = '$CurrentUser.Id$'
  )
)";

            var normalized = Normalize(source);

            Assert.DoesNotContain("MICROI_DATA_PERMISSION_V1", normalized);
            Assert.DoesNotContain("权限说明", normalized);
            Assert.Contains("A.TenantId = '$CurrentUser.TenantId$'", normalized);
            Assert.Contains("$CurrentUser.Level$ >= 9999", normalized);
            Assert.Contains("OR A.UserId = '$CurrentUser.Id$'", normalized);
        }

        [Fact]
        public void Normalize_RemovesLegacyDesignerLineComments()
        {
            var source = "-- 【吾码权限说明】历史版本生成的说明\nA.Status = 1";

            var normalized = Normalize(source);

            Assert.Equal("A.Status = 1", normalized);
        }

        [Fact]
        public void Normalize_RemovesReadableDesignerConfigMarker()
        {
            var source = @"-- MICROI_DATA_PERMISSION_CONFIG:{""scopeMode"":""department"",""departmentField"":""DepartmentId""}
A.DepartmentId = '$CurrentUser.DeptId$'";

            var normalized = Normalize(source);

            Assert.DoesNotContain("MICROI_DATA_PERMISSION_CONFIG", normalized);
            Assert.Equal("A.DepartmentId = '$CurrentUser.DeptId$'", normalized);
        }

        [Fact]
        public void Normalize_RemovesLegacyBlockDescriptionAndBlockMarker()
        {
            var source = @"/*
 * 吾码数据权限说明（由图形设计器自动生成）
 * 超级管理员：Level >= 9999
 */
(A.UserId = '$CurrentUser.Id$')
/* MICROI_DATA_PERMISSION_V1:YWJj */";

            var normalized = Normalize(source);

            Assert.Equal("(A.UserId = '$CurrentUser.Id$')", normalized);
        }

        [Fact]
        public void Normalize_PreservesUserMaintainedSqlComments()
        {
            var source = "-- 用户自定义说明\nA.Status = 1";

            var normalized = Normalize(source);

            Assert.Equal(source, normalized.Replace("\r\n", "\n"));
        }

        private static string Normalize(string sql)
        {
            var method = typeof(FormEngine).GetMethod(
                "NormalizeDataPermissionSqlWhereForExecution",
                BindingFlags.NonPublic | BindingFlags.Static);
            Assert.NotNull(method);
            return (string)method.Invoke(null, new object[] { sql });
        }
    }
}
