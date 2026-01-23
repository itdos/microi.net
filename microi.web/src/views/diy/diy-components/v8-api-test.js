/**
 * V8引擎智能提示测试代码
 * 在代码编辑器中输入以下代码来测试智能提示功能
 */

// 测试1: 输入 V8. 查看所有可用的属性和方法
// V8.

// 测试2: FormEngine.GetFormData 智能提示
async function testGetFormData() {
    // 输入 V8.FormEngine. 查看所有FormEngine方法
    var result = await V8.FormEngine.GetFormData("sys_user", {
        Id: "xxx-xxx"
    });

    if (result.Code == 1) {
        console.log("获取成功:", result.Data);
        V8.Tips("获取成功", true);
    } else {
        V8.Tips("获取失败: " + result.Msg, false);
    }
}

// 测试3: FormEngine.GetTableData 智能提示
async function testGetTableData() {
    // 输入 V8.FormEngine.GetTableData 会显示完整的代码片段
    var result = await V8.FormEngine.GetTableData("sys_user", {
        _Where: [{ Name: "Age", Value: "18", Type: ">" }],
        _PageSize: 20,
        _PageIndex: 1,
        _OrderBy: "CreateTime",
        _OrderByType: "DESC"
    });

    if (result.Code == 1) {
        console.log("数据列表:", result.Data);
        console.log("总数:", result.DataCount);
    }
}

// 测试4: FormEngine.AddFormData 智能提示
async function testAddFormData() {
    var result = await V8.FormEngine.AddFormData("sys_user", {
        Name: "张三",
        Age: 25,
        Phone: "13800138000",
        Email: "zhangsan@example.com"
    });

    if (result.Code == 1) {
        V8.Tips("添加成功", true);
        return result.Data;
    }
}

// 测试5: FormEngine.UptFormData 智能提示
async function testUptFormData() {
    var result = await V8.FormEngine.UptFormData("sys_user", {
        Id: "xxx-xxx",
        Name: "李四",
        Age: 30
    });

    if (result.Code == 1) {
        V8.Tips("修改成功", true);
    }
}

// 测试6: FormEngine.DelFormData 智能提示
async function testDelFormData() {
    // 先弹出确认框
    V8.ConfirmTips("确定要删除吗?", async function () {
        var result = await V8.FormEngine.DelFormData("sys_user", {
            Id: "xxx-xxx"
        });

        if (result.Code == 1) {
            V8.Tips("删除成功", true);
        }
    });
}

// 测试7: ApiEngine.Run 智能提示
async function testApiEngine() {
    // 输入 V8.ApiEngine.Run 查看智能提示
    var result = await V8.ApiEngine.Run("sysuser_reg", {
        Account: "test123",
        Name: "测试用户",
        Password: "123456"
    });

    if (result.Code == 1) {
        V8.Tips("注册成功", true);
    }
}

// 测试8: HTTP请求智能提示
async function testHttpRequest() {
    // POST请求
    var postResult = await V8.Post("/api/xxx", {
        id: "1",
        name: "test"
    });

    // GET请求
    var getResult = await V8.Get("/api/xxx");

    console.log("POST结果:", postResult);
    console.log("GET结果:", getResult);
}

// 测试9: 其他常用API
function testOtherApis() {
    // 判断空值
    if (V8.IsNull(V8.Form.UserName)) {
        V8.Tips("用户名不能为空", false);
        return;
    }

    // 生成GUID
    var newId = V8.NewGuid();
    console.log("新GUID:", newId);

    // 中文转拼音
    var pinyin = V8.ChineseToPinyin("中国");
    console.log("拼音:", pinyin);

    // 路由跳转
    // V8.Router.Push("/home");

    // 打开新窗口
    // V8.Window.Open("https://www.example.com");
}

// 测试10: 访问表单数据
function testFormData() {
    // 访问当前表单数据
    var currentName = V8.Form.UserName;

    // 访问修改前的表单数据
    var oldName = V8.OldForm.UserName;

    // 访问字段配置
    var fieldConfig = V8.Field.UserName;

    // 判断表单模式
    if (V8.FormMode === "Add") {
        console.log("新增模式");
    } else if (V8.FormMode === "Edit") {
        console.log("编辑模式");
    } else if (V8.FormMode === "View") {
        console.log("查看模式");
    }

    // 访问当前用户
    console.log("当前用户:", V8.CurrentUser);
}

/**
 * 使用说明:
 *
 * 1. 在代码编辑器中，输入 V8. 会自动弹出智能提示
 * 2. 选择 FormEngine 后，继续输入 . 会显示所有FormEngine的方法
 * 3. 选择任意方法后，会自动插入代码模板
 * 4. 使用Tab键在代码片段的占位符之间跳转
 * 5. 鼠标悬停在方法上可以查看详细文档
 */
