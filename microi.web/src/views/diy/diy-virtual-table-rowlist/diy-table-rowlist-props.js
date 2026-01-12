export default {
    props: {
        ContainerClass: { type: String, default: "" },
        EnableMultipleSelect: { type: Boolean, default: false },
        FatherFormModel: { type: Object, default: () => ({}) }, //父表的model
        FormDefaultValues: { type: Object, default: () => ({}) },
        JoinTableField: { type: Object, default: () => ({}) },
        LoadMode: { type: String, default: "" }, // 加载模式：可能是Design（表单设计）
        ParentFormLoadFinish: { type: Boolean, default: null },
        ParentV8: { type: Object, default: () => ({}) },
        PrimaryTableFieldName: { type: String, default: "Id" },
        PropsIsJoinTable: { type: Boolean, default: false },
        PropsParentFieldList: { type: Object, default: () => ({}) }, //父级的所有字段对象
        PropsSysMenuId: { type: String, default: "" },
        PropsTableId: { type: String, default: "" },
        PropsTableType: { type: String, default: "" },
        PropsWhere: { type: Array, default: () => [] },
        SearchAppend: { type: Object, default: () => ({}) }, //追加搜索条件.{'FieldName' : value, 'FieldName': value}
        TableChildCallbackField: { type: String, default: "" },
        TableChildConfig: { type: Object, default: () => null },
        TableChildData: { type: Array, default: () => [] }, //子表数据，由DiyForm传进来，会直接赋值到Table表格
        TableChildField: { type: Object, default: () => ({}) }, //子表Field对象
        TableChildFkFieldName: { type: String, default: "" },
        TableChildFormMode: { type: String, default: "" },
        TableChildSysMenuId: { type: String, default: "" }, //子表模块配置Id
        TableChildTableId: { type: String, default: "" }, //子表的DiyTableId
        TableChildTableRowId: { type: [String, Number], default: "" },
        TypeFieldName: { type: String, default: "" }
    }
};
