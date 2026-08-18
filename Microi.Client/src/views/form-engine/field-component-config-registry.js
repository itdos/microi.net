// 表单设计器双击字段时的组件专项配置事实源。
// 这里仅登记真正暴露 openConfig() 的控件；未登记控件回退到通用字段属性，
// 避免根据异步组件 ref 是否恰好已加载来误判并打开错误配置。
export const NATIVE_FIELD_CONFIG_COMPONENTS = Object.freeze([
    "Alert",
    "Address",
    "Autocomplete",
    "AutoNumber",
    "Button",
    "Cascader",
    "Checkbox",
    "CodeEditor",
    "ColorPicker",
    "CollapseGroup",
    "DateTime",
    "Department",
    "DevComponent",
    "Divider",
    "FileUpload",
    "FontAwesome",
    "Guid",
    "Html",
    "ImgUpload",
    "Input",
    "InputNumber",
    "JoinForm",
    "JoinTable",
    "JsonTable",
    "Map",
    "MapArea",
    "MultipleSelect",
    "NumberText",
    "OpenTable",
    "Progress",
    "Qrcode",
    "Radio",
    "Rate",
    "RichText",
    "Select",
    "SelectTree",
    "Slider",
    "StaticText",
    "Switch",
    "TableChild",
    "Tabs",
    "TagInput",
    "Text",
    "Textarea",
    "Transfer",
    "TreeCheckbox"
]);

// 这些控件本身没有独立运行参数，双击时应进入通用字段属性，而不是展示
// 其它控件遗留的配置。显式登记可让新增控件必须先选择正确的配置归属。
export const GENERIC_FIELD_CONFIG_COMPONENTS = Object.freeze([
]);

const nativeFieldConfigSet = new Set(NATIVE_FIELD_CONFIG_COMPONENTS);
const genericFieldConfigSet = new Set(GENERIC_FIELD_CONFIG_COMPONENTS);

export function hasNativeFieldConfig(componentName) {
    return nativeFieldConfigSet.has(String(componentName || ""));
}

export function hasGenericFieldConfig(componentName) {
    return genericFieldConfigSet.has(String(componentName || ""));
}
