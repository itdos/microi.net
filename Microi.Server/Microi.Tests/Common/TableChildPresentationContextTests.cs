using Microi.net;
using Newtonsoft.Json;
using System.Reflection;

namespace Dos.Common.Tests;

public class TableChildPresentationContextTests
{
    [Fact]
    public void TableChildPresentationContext_ProvidesValidatedChildMenuForDefaultOrderAndStatistics()
    {
        var param = NewTableChildParam();
        var relationField = NewRelationField("child-table", "child-menu");

        var menuId = InvokePresentationMenuResolver(param, "child-table", relationField);

        Assert.Equal("child-menu", menuId);
    }

    [Fact]
    public void TableChildPresentationContext_RejectsAMenuBoundToAnotherChildTable()
    {
        var param = NewTableChildParam();
        var relationField = NewRelationField("other-child-table", "other-child-menu");

        var menuId = InvokePresentationMenuResolver(param, "child-table", relationField);

        Assert.Null(menuId);
    }

    [Fact]
    public void TableChildPresentationContext_DoesNotReapplyChildMenuSqlScopes()
    {
        Assert.Null(InvokeAuthorizationScopeResolver(
            authorizationPolicyValue: null,
            hasAuthorizationPolicy: false,
            menuValue: "A.HiddenByChildMenu = 1",
            isTableChildPresentationContext: true));
        Assert.Equal(
            "A.VisibleByOrdinaryMenu = 1",
            InvokeAuthorizationScopeResolver(
                authorizationPolicyValue: null,
                hasAuthorizationPolicy: false,
                menuValue: "A.VisibleByOrdinaryMenu = 1",
                isTableChildPresentationContext: false));
        Assert.Equal(
            "A.ParentId = @parent",
            InvokeAuthorizationScopeResolver(
                authorizationPolicyValue: "A.ParentId = @parent",
                hasAuthorizationPolicy: true,
                menuValue: "A.HiddenByChildMenu = 1",
                isTableChildPresentationContext: true));
    }

    private static DiyTableRowParam NewTableChildParam()
    {
        return new DiyTableRowParam
        {
            _TableChildAuth = new TableChildAuthorizationContext
            {
                ParentSysMenuId = "parent-menu",
                ParentTableId = "parent-table",
                ParentFieldId = "child-field",
                ParentRowId = "parent-row",
                ParentValue = "parent-row",
                ParentFormMode = "View"
            }
        };
    }

    private static DiyField NewRelationField(string childTableId, string childMenuId)
    {
        return new DiyField
        {
            Id = "child-field",
            TableId = "parent-table",
            Component = "TableChild",
            Config = JsonConvert.SerializeObject(new DiyFieldConfig
            {
                TableChildTableId = childTableId,
                TableChildSysMenuId = childMenuId,
                TableChildFkFieldName = "ParentId"
            })
        };
    }

    private static string InvokePresentationMenuResolver(
        DiyTableRowParam param,
        string childTableId,
        DiyField relationField)
    {
        var method = typeof(FormEngine).GetMethod(
            "ResolveValidatedTableChildPresentationMenuId",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(method);
        return method!.Invoke(null, new object[] { param, childTableId, relationField }) as string;
    }

    private static string InvokeAuthorizationScopeResolver(
        string authorizationPolicyValue,
        bool hasAuthorizationPolicy,
        string menuValue,
        bool isTableChildPresentationContext)
    {
        var method = typeof(FormEngine).GetMethod(
            "ResolveAuthorizationScopeValue",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(method);
        return method!.Invoke(
            null,
            new object[]
            {
                authorizationPolicyValue,
                hasAuthorizationPolicy,
                menuValue,
                isTableChildPresentationContext
            }) as string;
    }
}
