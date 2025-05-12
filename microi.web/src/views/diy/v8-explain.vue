<template>
  <div class="v8-explain">
    <el-collapse>
      <el-collapse-item name="10">
        <template slot="title"> <i class="fas fa-code mr-2"></i> V8.Form：访问当前表单所有字段 </template>
        <div class="code">下拉框设定了绑定显示字段，则是V8.Form.字段名称.显示字段</div>
      </el-collapse-item>
      <el-collapse-item name="20">
        <template slot="title">
          <i class="fas fa-code mr-2"></i>
          V8.OldForm：访问当前表单修改前的所有字段
        </template>
        <div class="code">下拉框设定了绑定显示字段，则是V8.OldForm.字段名称.显示字段</div>
      </el-collapse-item>
      <el-collapse-item name="30">
        <template slot="title"> <i class="fas fa-code mr-2"></i> V8.FormSet：给当前表单某个字段赋值 </template>
        <div class="code">V8.FormSet('字段名称', '值')</div>
      </el-collapse-item>
      <el-collapse-item name="40">
        <template slot="title"> <i class="fas fa-code mr-2"></i> V8.Field：访问当前表单所有Field对象 </template>
        <div class="code">包含Name、Label、Config、Data(绑定数据源)等，如V8.Field.字段名称.Visible</div>
        <div class="code">Field对象所有属性较多，可通过debugger在代码中查看。</div>
      </el-collapse-item>
      <el-collapse-item name="50">
        <template slot="title"> <i class="fas fa-code mr-2"></i> V8.FieldSet：给字段属性赋值 </template>
        <div class="code">V8.FieldSet('字段名称', '属性', '值');如：Name、Label、Config、Data(绑定数据源)、Readonly、Visible、Placeholder等</div>
      </el-collapse-item>
      <el-collapse-item name="60">
        <template slot="title">
          <i class="fas fa-code mr-2"></i>
          V8.FormOutAction：离开表单类型，用于离开表单/提交表单后V8引擎
        </template>
        <div class="code">可能的值：Update/Insert/Close/Delete</div>
      </el-collapse-item>
      <el-collapse-item name="60">
        <template slot="title">
          <i class="fas fa-code mr-2"></i>
          V8.FormOutAfterAction：离开表单后类型，用于离开表单/提交表单后V8引擎
        </template>
        <div class="code">可能的值：Insert/Update/View/Close</div>
      </el-collapse-item>
    </el-collapse>
    <div>V8.ThisValue：访问下拉框选择后的值对象</div>
    <div>V8.RunSqlGetModel('sql语句', function(data){ //your code })：获取单条数据，返回model</div>
    <div>V8.RunSqlGetList('sql语句', function(data){ //your code })：获取列表数据，返回list</div>
    <div>V8.Tips(msgContent, true/false)：弹出提示，true为成功消息，false为错误消息</div>
    <div>V8.CurrentUser：访问当前登录用户信息，如V8.CurrentUser.Id</div>
    <div>V8.FormSubmitAction：表单提交类型（Insert/Update/Delete），可赋值V8.Result = false;以阻止表单提交。</div>
    <div>V8.Post(url, param, callback)：发起ajax请求，V8.Post('api url', {}, function(result){})</div>
    <div>V8.PostAsync：发起同步请求，var result = await V8.PostAsync('接口地址', {参数});</div>
    <div>V8.Get：发起ajax请求，V8.Get('api url', {}, function(result){})</div>
    <div>V8.GetAsync：发起同步请求，var result = V8.GetAsync('api url', {});</div>
    <div>V8.GetDiyTableRow(param, callback)：V8.GetDiyTableRow({}, function(data){})</div>
    <div>V8.UptDiyTableRow(param, callback)：V8.UptDiyTableRow({TableId:'',_TableRowId:'',_FormData:{FieldName : 'value'}}, function(data){})</div>
    <div>V8.AddDiyTableRow(param, callback)：V8.AddDiyTableRow({}, function(data){})</div>
    <div>V8.DelDiyTableRow(param, callback)：V8.DelDiyTableRow({}, function(data){})</div>
    <div>V8.ChineseToPinyin(chinese, fullPyLen, type)：中文转拼音，fullPyLen: 2(默认)，前几个字全拼音；type : 1 驼峰（默认），2全大写，3全小写</div>
    <div>V8.RefreshTable({ _PageIndex : -1 })：刷新表格。_PageIndex传入-1表示跳转到最后一页。</div>
    <div>V8.Router.Push(url)：页面跳转</div>
    <div>V8.Window.Open(url)：打开新页面</div>
    <div>V8.OpenForm(formModel, type)：打开表单，type：'View'/'Edit'/'Add'</div>
    <div>模板引擎部分参考语法：var html = `&lt;div&gt;${V8.Form.FieldName}&lt;/div&gt;`; V8.Result = html;</div>
    <div>[模块配置]按钮显示条件V8：V8.Result = true/false;是否显示</div>
    <div>V8.TableRowSelected：获取已选择的行数组，每行包含了所有数据</div>
    <div>V8向定制组件传数据：V8.FieldSet('FieldName', 'DataAppend', {}); 定制组件接收：props: { DataAppend : { type : Object,default: () => {} } }</div>
    <div>定制组件回传数据至Form：self.$emit('FormSet', fieldName, value)</div>
    <div>Tabs设置搜索条件：V8.SearchSet/SearchAppend({FieldName : value, FieldName2 : value})</div>
    <div>V8.IsNull(value)：是否为空</div>
    <div>V8.TableRowId：当前Form的Id</div>
    <div>V8.FormMode：当前Form打开的模式：Add、Edit、View</div>

    <div>子表操作：</div>
    <div>V8.TableSearchAppend(V8.Field.子表Name, {FiedlName : value, FieldName2 : value})</div>
    <div>V8.TableSearchSet(V8.Field.子表Name, {FiedlName : value, FieldName2 : value})</div>
    <div>V8.TableRefresh(V8.Field.子表Name, { _PageIndex : -1 }):_PageIndex传入-1表示跳转到最后一页</div>
    <div>V8.FormSubmit({CloseForm:true, SavedType:'Insert'})：提交表单。CloseForm是否关闭Form表单；SavedType保存表单后的操作Insert/Update/View</div>
    <div>父级操作：</div>

    <div>V8.ParentForm：访问父级表单所有字段</div>
    <div>V8.ParentFormSet('字段名称', '值')：给父级表单某个字段赋值</div>
    <div>V8.AddSysLog：新增日志。传入Type、Title、Content</div>
    <div>V8.KeyCode：键盘事件V8可获取键盘的code值，如Enter键对应13</div>
    <div>表单V8中：V8.ReloadForm：重新加载Form表单，如：V8.ReloadForm({Id : 'xxxx-xxxx-xxxx'}, 'Edit')</div>
    <div>V8.HideFormBtn('Update/Delete')：用于隐藏编辑、删除按钮</div>
    <div>V8.ConfirmTips：确认提示框。V8.ConfirmTips('确认审批？', okCallback, cancelCallback, option)。 option为可选参数，可配置{Title:'',OkText:'',CancelText:'',Icon:''}</div>
    <div>V8.TableId：获取当前DIY表的Id</div>
    <div>V8.ShowTableChildHideField：将子表已隐藏的字段强制显示出来，并且刷新子表。</div>
    <div>V8.RefreshChildTable(field, V8.Row)：刷新子表，第一个传入字段model，如V8.Field.XXXName。第二个可传入parentFormModel。</div>
    <div>V8.GetChildTableData('子表字段名称');</div>
    <div>V8.CurrentTableData;</div>
  </div>
</template>

<script>
export default {
  name: "DiyExplain",
  data() {
    return {};
  },
  mounted() {
    var self = this;
  },
  methods: {}
};
</script>

<style lang="scss">
.v8-explain {
  .el-collapse-item__content {
    padding-bottom: 10px;
  }
  .code {
  }
}
</style>
