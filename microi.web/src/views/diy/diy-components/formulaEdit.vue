<template>
  <div>
    <el-button style="margin-bottom: 10px" type="primary" @click="onEditForm">{{
      currentModel ? "已设置公式" : "公式编辑"
    }}</el-button>

    <!-- <el-input type="textarea" rows="10" v-model="formV8List"> </el-input> -->

    <el-dialog
      :visible.sync="showForm"
      width="60%"
      :destroy-on-close="true"
      :modal-append-to-body="false"
      append-to-body
      :close-on-click-modal="false"
    >
      <span slot="title">
        <span class="headTitle">公式编辑</span>
        <span class="subTitle">使用数学运算符编辑公式</span>
      </span>

      <el-card class="gongshi" shadow="never">
        <div slot="header" class="clearfix">
          <span>{{ chooseData.Label }} =</span>
        </div>
        <div class="code-div">
          <codemirror
            ref="cmObj"
            class="textarea"
            v-model="currentModel"
            :options="cmOptions"
            @input="modelChange"
          ></codemirror>
        </div>
      </el-card>

      <el-row :span="24" style="margin-top: 10px">
        <el-col :span="8" class="title"> 可用变量 </el-col>
        <el-col :span="4" class="title"> 函数 </el-col>
      </el-row>
      <el-row :span="24">
        <el-col :span="8">
          <el-card class="addCode" shadow="never" style="float: left">
            <div slot="header" class="clearfix">
              <span>
                <el-input
                  prefix-icon="el-icon-search"
                  v-model="variableSearch"
                  placeholder="搜索变量"
                  @input="querySearchAsync"
                  clearable
                ></el-input>
              </span>
            </div>
            <div class="addCodeDetail" v-loading="loading">
              <div
                v-show="newVariableList.length > 0"
                :class="
                  varValue == item.Label ? 'list-item selectColor' : 'list-item'
                "
                v-for="(item, index) in newVariableList"
                :key="index"
                @click="onSelectValue(item)"
                @mouseover="varValue = item.Label"
              >
                <span class="title">{{ item.Label }}</span>
                <span class="tig blue">
                  {{ item.fieldName }}
                </span>
              </div>
              <div
                v-show="newVariableList.length <= 0"
                style="color: #c3cdda; text-align: center"
              >
                没有对应的变量
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="4">
          <el-card class="addCode" shadow="never">
            <div slot="header" class="clearfix">
              <span>
                <el-input
                  prefix-icon="el-icon-search"
                  v-model="funSearch"
                  placeholder="搜索函数"
                  @input="queryFun"
                  clearable
                ></el-input>
              </span>
            </div>
            <div class="addCodeDetail" v-loading="funLoading">
              <el-collapse
                v-if="!showFun"
                v-model="activeNames"
                @change="handleChange"
              >
                <el-collapse-item
                  v-for="(item, index) in funList"
                  :key="index"
                  :title="item.label"
                  :name="index"
                  class="minHeight"
                >
                  <div
                    :class="
                      funTitle == i.name ? 'funClass selectColor' : ' funClass'
                    "
                    v-for="(i, o) in item.content"
                    :key="o"
                    @click="onSelectFun(o, i)"
                    @mouseover="onFocus(o, i)"
                  >
                    {{ i.name }}
                  </div>
                </el-collapse-item>
              </el-collapse>
              <div
                v-show="showFun && newFunlist.length > 0"
                :class="funIndex == o ? 'funClass selectColor' : ' funClass'"
                style="margin: 5px 0"
                v-for="(i, o) in newFunlist"
                :key="o"
                @click="onSelectFun(o, i)"
                @mouseover="onFocus(o, i)"
              >
                {{ i.name }}
              </div>
              <div
                v-show="showFun && newFunlist.length <= 0"
                style="color: #c3cdda; text-align: center"
              >
                没有对应的函数
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card class="addCode" shadow="never">
            <div v-if="funTitle" slot="header" class="header">
              <span style="margin-left: -10px">
                {{ funTitle }}
              </span>
            </div>
            <div class="addCodeDetail" v-if="funTitle" v-html="funDetail"></div>
            <div style="margin: -10px -20px" v-else>
              <ul style="color: #5e6d82; font-size: 15px">
                <li style="margin-bottom: 5px">
                  从左侧面板选择字段名和函数，或输入函数
                </li>
                <li>
                  可以直接选择字段名做加减乘除计算，如：字段A=字段B+字段C-字段D*字段E/字段F
                </li>
                <li>
                  公式编辑举例 :
                  <span style="color: #761086">DATEDIF</span
                  >(开始时间,结束时间,单位)
                </li>
              </ul>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <span slot="footer" class="dialog-footer">
        <el-button @click="showForm = false">取 消</el-button>
        <el-button type="primary" @click="saveFrom">确 定</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import qs from "qs";
let CodeMirror = require("codemirror/lib/codemirror");
import { codemirror } from "vue-codemirror";
require("codemirror/lib/codemirror.css");
require("codemirror/mode/javascript/javascript.js");
require("codemirror/mode/css/css.js");
import "codemirror/addon/hint/show-hint.css";
import "codemirror/addon/hint/show-hint.js";
import "codemirror/addon/hint/javascript-hint";
import "codemirror/addon/hint/xml-hint";
import "codemirror/addon/hint/sql-hint";
import "codemirror/addon/hint/anyword-hint";
import "codemirror/theme/colorforth.css";
export default {
  name: "formulaEdit",
  props: {
    fields: {
      type: Array,
      default: []
    },
    chooseData: {
      type: Object,
      default: {}
    },
    model: {
      type: String,
      defalut: ""
    }
    // chooseDataId:{
    //   type: String,
    //   defalut: ""
    // }
  },
  components: {
    codemirror
  },
  watch: {
    model: function (newVal, oldVal) {
      if (oldVal != newVal) {
        this.model = newVal;
        this.getV8();
      }
    }
    // chooseDataId:function(newVal, oldVal) {
    //   if (oldVal != newVal) {
    //     this.getChooseData(newVal)
    //   }
    // },
  },
  data() {
    return {
      showForm: false,
      currentModel: "",
      cmOptions: {
        // 所有参数配置见：https://codemirror.net/doc/manual.html#config
        tabSize: 4,
        styleActiveLine: true,
        lineNumbers: true,
        line: true,
        foldGutter: true,
        styleSelectedText: true,
        mode: "text/javascript",
        // mode: "application/xml",
        // keyMap: "sublime",
        matchBrackets: true,
        showCursorWhenSelecting: true,
        theme: "default",
        extraKeys: {
          Ctrl: "autocomplete"
        },
        hintOptions: {
          completeSingle: false
        },
        lineWrapping: true, // 自动换行
        flattenSpans: false
      },
      fieldList: [],
      newVariableList: [],
      funList: [
        {
          label: "数学函数",
          content: [
            {
              name: "AVERAGE",
              tex: '<span style="color:#761086;">AVERAGE</span>函数可以获取一组数值的算术平均值。<p>用法：<span style="color:#761086;">AVERAGE</span>(数字1,数字2,...)</p><p>示例：<span style="color:#761086;">AVERAGE</span>(语文成绩,数学成绩,英语成绩)返回三门课程的平均分</p>'
            },
            {
              name: "MAX",
              tex: '<span style="color:#761086;">MAX</span>函数可以获取一组数值的最大值。<p>用法：<span style="color:#761086;">MAX</span>(数字1,数字2,...)</p><p>示例：<span style="color:#761086;">MAX</span>(语文成绩,数学成绩,英语成绩)，返回三门课程中的最高分。</p>'
            },
            {
              name: "MIN",
              tex: '<span style="color:#761086;">MIN</span>函数可以获取一组数值的最小值。<p>用法：<span style="color:#761086;">MIN</span>(数字1,数字2,...)</p><p>示例：<span style="color:#761086;">MIN</span>(语文成绩,数学成绩,英语成绩)，返回三门课程中的最低分。</p>'
            }
          ]
        },
        {
          label: "逻辑函数",
          content: [
            {
              name: "AND",
              tex: '如果所有参数都为真，<span style="color:#761086;">AND</span>函数返回布尔值true，否则返回布尔值 false<p>示例：<span style="color:#761086;">AND</span>(逻辑表达式1,逻辑表达式2,...)</p><p>用法：<span style="color:#761086;">AND</span>(语文成绩>90,数学成绩>90,英语成绩>90)，如果三门课成绩都>90，返回true，否则返回false'
            },
            {
              name: "IF",
              tex: '<span style="color:#761086;">IF</span>函数判断一个条件能否满足；如果满足返回一个值，如果不满足则返回另外一个值<p>用法：<span style="color:#761086;">IF</span>(逻辑表达式,为true时返回的值,为false时返回的值)</p><p>示例：<span style="color:#761086;">IF</span>(语文成绩>60,"及格","不及格")，当语文成绩>60时返回及格，否则返回不及格。</p>'
            },
            {
              name: "IFS",
              tex: '<span style="color:#761086;">IFS</span>函数检查是否满足一个或多个条件，且返回符合第一个TRUE条件的值，IFS可以取代多个嵌套IF语句。<p>用法：<span style="color:#761086;">IFS</span>(逻辑表达式1,逻辑表达式1为true返回该值,逻辑表达式2,逻辑表达式2为true返回该值,...)</p><p>示例：<span style="color:#761086;">IFS</span>(语文成绩>90,"优秀",语文成绩>80,"良好",语文成绩>59,"及格",语文成绩<60,"不及格")，根据成绩返回对应的评价。</p>'
            },
            {
              name: "OR",
              tex: '如果任意参数为真，<span style="color:#761086;">OR</span> 函数返回布尔值true；如果所有参数为假，返回布尔值false。<p>示例：<span style="color:#761086;">OR</span>(逻辑表达式1,逻辑表达式2,...)</p><p>用法：<span style="color:#761086;">OR</span>(语文成绩>90,数学成绩>90,英语成绩>90)，任何一门课成绩>90，返回true，否则返回false'
            }
          ]
        },
        {
          label: "日期函数",
          content: [
            {
              name: "DATEDIF",
              tex: '<span style="color:#761086;">DATEDIF</span>函数可以计算两个日期时间相差的年数(y)、月数(M)、天数(d)、小时数(h)、分钟数(m)、秒数(s)。<p>用法：<span style="color:#761086;">DATEDIF</span>(开始时间,结束时间,\'h\')，如果开始时间是2021-01-01 9:00，结束时间为当天2021-01-01 10:30，计算得小时差为1.5。</p>'
            },
            {
              name: "DATEDELTA",
              tex: '<span style="color:#761086;">DATEDELTA</span>函数可以将指定日期加/减指定天数。<p>用法：<span style="color:#761086;">DATEDELTA</span>(指定日期,需要加减的天数)，如果指定日期是2021-01-01，加天数15，计算得日期为2021-01-16。</p>'
            },
            {
              name: "DAY",
              tex: '<span style="color:#761086;">DAY</span>函数可以获取某日期是当月的第几日。<p>用法：<span style="color:#761086;">DAY</span>(日期)，如果指定日期是2021-01-01，则返回结果是天数1。</p>'
            },
            {
              name: "HOUR",
              tex: '<span style="color:#761086;">HOUR</span>函数可以返回某日期的小时数。<p>用法：<span style="color:#761086;">HOUR</span>(日期)，如果指定日期是2021-01-01 19:01:12，则返回结果是小时数19。</p>'
            },
            {
              name: "MONTH",
              tex: '<span style="color:#761086;">MONTH</span>函数可以返回某日期的月份。<p>用法：<span style="color:#761086;">MONTH</span>(日期)，如果指定日期是2021-01-01 19:01:12，则返回结果是月份1。</p>'
            },
            {
              name: "MINUTE",
              tex: '<span style="color:#761086;">MINUTE</span>函数可以返回某日期的分钟数。<p>用法：<span style="color:#761086;">MINUTE</span>(日期)，如果指定日期是2021-01-01 19:30:12，则返回结果是分钟数30。</p>'
            },
            {
              name: "NOW",
              tex: '<span style="color:#761086;">NOW</span>函数可以获取当前时间。<p>用法：<span style="color:#761086;">NOW</span>()，返回结果如2021-01-01 19:30:12。</p>'
            },
            {
              name: "SECOND",
              tex: '<span style="color:#761086;">SECOND</span>函数可以返回某日期的秒数。<p>用法：<span style="color:#761086;">SECOND</span>(日期)，如果指定日期是2021-01-01 19:30:12，则返回结果是秒数12。</p>'
            },
            {
              name: "YEAR",
              tex: '<span style="color:#761086;">YEAR</span>函数可以返回某日期的年份。<p>用法：<span style="color:#761086;">YEAR</span>(日期)，如果指定日期是2021-01-01 19:30:12，则返回结果是年份2021。</p>'
            }
          ]
        }
      ],
      newFunlist: [],
      activeNames: "",
      variableSearch: "",
      funSearch: "",
      funIndex: "",
      funTitle: "",
      funDetail: "",
      varValue: "",
      loading: false,
      funLoading: false,
      showFun: false,
      isShowCursor: false,
      showEdit: false,

      formList: "",
      formV8List: "",
      formType: "新增",
      formIndex: 0,
      https: ""
    };
  },
  computed: {
    codeMirror() {
      return this.$refs.cmObj.codemirror;
    }
  },
  mounted() {
    this.getDiyApiBase();
    this.$nextTick(() => {
      this.$refs.cmObj && this.$refs.cmObj.codemirror.setSize("auto", "170px");
    });
    this.GetDiyTableRow(true);
    // this.getChooseData(this.chooseDataId)
  },
  methods: {
    //编辑表单
    onEditForm() {
      this.showForm = true;
    },
    //搜索函数
    queryFun(val) {
      let newFunlist = [];
      this.funList.map((item) => {
        item.content.map((i) => {
          newFunlist.push(i);
        });
      });
      this.funLoading = true;
      if (val) {
        this.showFun = true;
        var restaurants = newFunlist;
        this.newFunlist = val
          ? restaurants.filter(this.createFilter(val))
          : restaurants;
      } else {
        this.showFun = false;
      }
      this.funLoading = false;
    },
    createFilter(queryString) {
      return (state) => {
        return (
          state.name.toLowerCase().indexOf(queryString.toLowerCase()) === 0
        );
      };
    },
    //搜索变量
    querySearchAsync(val) {
      this.loading = true;
      if (val) {
        var restaurants = this.newVariableList;
        this.newVariableList = val
          ? restaurants.filter(this.createStateFilter(val))
          : restaurants;
      } else {
        this.GetDiyTableRow();
      }
      this.loading = false;
    },
    createStateFilter(queryString) {
      return (state) => {
        return (
          state.Label.toLowerCase().indexOf(queryString.toLowerCase()) === 0
        );
      };
    },
    //获取变量数据
    GetDiyTableRow(init = false) {
      let self = this;
      this.$axios
        .post(
          this.https + "/api/diytable/GetDiyTableRow",
          qs.stringify({
            Name: "Diy_Component",
            _OrderBy: "Sort",
            _OrderByType: "Asc"
          }),
          {
            headers: {
              authorization: "Bearer " + localStorage.getItem("authorization"),
              "content-type": "application/x-www-form-urlencoded",
              did: this.newGuid()
            }
          }
        )
        .then(function (response) {
          if (response.data.Code == 1) {
            self.fieldList = response.data.Data;
            let list = [];
            self.fields.map((item) => {
              self.fieldList.map((i) => {
                if (i.Control == item.Component) {
                  list.push({
                    ...item,
                    fieldName: i.Name
                  });
                }
              });
            });
            self.newVariableList = list;

            if (init) {
              self.getV8(init);
            }
          }
        })
        .catch(function (error) {
          console.log(error);
        });
    },
    //选择变量
    onSelectValue(item) {
      this.varValue = item.Label;
      // console.log(this.codeMirror);

      this.$nextTick(function () {
        if (this.$refs.cmObj) {
          // console.log(11111,this.$refs.cmObj.codemirror)
          this.$refs.cmObj.codemirror.focus();
          this.$refs.cmObj.codemirror.replaceSelection(item.Label);
        }
      });

      // this.codeMirror.focus();
      // this.codeMirror.replaceSelection(item.Label)
    },
    //选择函数
    onSelectFun(index, item) {
      this.funIndex = index;
      this.funTitle = item.name;
      this.funDetail = item.tex;
      this.varValue = item.Label;
      if (!this.isShowCursor) {
        this.currentModel = this.currentModel.concat(item.name + "()");
        this.$nextTick(() => {
          this.$refs.cmObj.codemirror.focus();
          this.$refs.cmObj.codemirror.setCursor(1);
          this.$refs.cmObj.codemirror.execCommand("goColumnLeft");
        });
        this.isShowCursor = true;
      } else {
        // let value = `<div style="color:blue;display:inline-block;">${item.name + "()"}</div>`
        // this.codeMirror.replaceSelection(value)

        this.$refs.cmObj.codemirror.replaceSelection(item.name + "()");
        this.$nextTick(() => {
          this.$refs.cmObj.codemirror.focus();
          this.$refs.cmObj.codemirror.execCommand("goColumnLeft");
        });
      }
    },
    onFocus(index, item) {
      // console.log('鼠标移入')
      this.funTitle = item.name;
      this.funDetail = item.tex;
    },
    //提交
    saveFrom() {
      if (this.currentModel == "") {
        return this.$message({
          message: "请输入公式!",
          type: "warning"
        });
      }

      // console.log(this.currentModel, "提交");

      // 将输入的公式变成V8代码
      this.writeV8(this.currentModel);

      this.$emit("update:model", this.formV8List);

      this.showForm = false;
    },
    writeV8(data) {
      // 替换中文字符为字段名（中文一定是字段名为前提）
      var reg1 = /(?<=)([\u4e00-\u9fa5]*)(?=)/g;
      var current = data;
      var lists = "";

      if (reg1.test(current)) {
        var ziduan = current.match(reg1);
        // console.log(888,ziduan)
        // console.log(888,this.newVariableList)
        this.newVariableList.map((item) => {
          ziduan.map((ite) => {
            if (item.Label == ite) {
              current = current.replace(ite, "V8.Form." + item.Name);
            }
          });
        });
      }
      var funcList = [];

      current = "V8.Form." + this.chooseData.Name + "=" + current;

      // 替换函数名为真正的函数
      if (current.indexOf("DATEDIF") > -1) {
        current = current.replace(/DATEDIF/g, "getDatedif");
        var txt = this.getDatedif();
        // console.log(12122,this.getDatedifOld('2012-04-02 18:00','2013-04-02 19:22:21','d'))
        funcList.push(txt);
      }
      if (current.indexOf("DATEDELTA") > -1) {
        current = current.replace(/DATEDELTA/g, "getDateDelta");
        var txt = this.getDateDelta();
        // console.log(12122,this.getDateDeltaOld('2012-04-02 18:00',12))
        funcList.push(txt);
      }
      if (current.indexOf("AVERAGE") > -1) {
        // var reg2 = /(?<=AVERAGE\()(\S*)(?=\))/g
        var reg2 = /AVERAGE\((.+?)\)/g;
        var str = current.match(reg2);
        var strList = [];
        // console.log(str,1212)

        str.map((item, i) => {
          current = current.replace(item, "getAverage(list" + i + ")");
          strList[i] = item.replace(reg2, "$1").split(",");
        });

        // console.log(1111111,str,strList)

        var aa = "";
        strList.map((item, i) => {
          aa +=
            "var list" +
            i +
            "=" +
            JSON.stringify(item).replace(/\"/g, "") +
            "\n";
        });

        current = aa + current;

        var txt = this.getAverage();
        // console.log(12122,current)
        // console.log(666666,txt)
        funcList.push(txt);
      }
      if (current.indexOf("IF(") > -1) {
        var reg2 = /IF\((.+?)\)/g;
        var str = current.match(reg2);
        // console.log(1333311,str)

        current = current.replace(/IF\(/g, "getIf(");
        var txt = this.getIf();

        funcList.push(txt);
        // console.log(12122,this.getIfOld(10>1,'V8.Form.Yunfei','V8.Form.Yunfei'))
      }
      if (current.indexOf("IFS") > -1) {
        var reg2 = /IFS\((.+?)\)/g;
        var str = current.match(reg2);
        var strList = [];
        // console.log(1333311,str)

        str.map((item, i) => {
          current = current.replace(item, "getIfs(flist" + i + ")");
          strList[i] = item.replace(reg2, "$1").split(",");
        });

        // console.log(1111111,str,strList)

        var aa = "";
        strList.map((item, i) => {
          aa +=
            "var flist" +
            i +
            "=" +
            JSON.stringify(item).replace(/\"/g, "") +
            "\n";
        });

        current = aa + current;

        // console.log(6666,current)

        var txt = this.getIfs();

        funcList.push(txt);
        var flist = [10 < 1, "V8.Form.Yunfei1", 10 > 1, "V8.Form.Yunfei2"];
        // console.log(12122, this.getIfsOld(flist));
      }
      if (current.indexOf("MAX") > -1) {
        var reg2 = /MAX\((.+?)\)/g;
        var str = current.match(reg2);
        var strList = [];
        // console.log(1333311,str)

        str.map((item, i) => {
          current = current.replace(item, "getMax(mlist" + i + ")");
          strList[i] = item.replace(reg2, "$1").split(",");
        });

        // console.log(1111111,str,strList)

        var aa = "";
        strList.map((item, i) => {
          aa +=
            "var mlist" +
            i +
            "=" +
            JSON.stringify(item).replace(/\"/g, "") +
            "\n";
        });

        current = aa + current;

        // console.log(6666,current)

        var txt = this.getMax();

        funcList.push(txt);
        // var mlist = [10,9,11,5]
        // console.log(12122,this.getMaxOld(mlist))
      }
      if (current.indexOf("MIN(") > -1) {
        var reg2 = /MIN\((.+?)\)/g;
        var str = current.match(reg2);
        var strList = [];
        // console.log(1333311,str)

        str.map((item, i) => {
          current = current.replace(item, "getMin(nlist" + i + ")");
          strList[i] = item.replace(reg2, "$1").split(",");
        });

        // console.log(1111111,str,strList)

        var aa = "";
        strList.map((item, i) => {
          aa +=
            "var nlist" +
            i +
            "=" +
            JSON.stringify(item).replace(/\"/g, "") +
            "\n";
        });

        current = aa + current;

        // console.log(6666,current)

        var txt = this.getMin();

        funcList.push(txt);
        // var nlist = [10,9,11,5]
        // console.log(12122,this.getMinOld(nlist))
      }
      if (current.indexOf("DAY(") > -1) {
        var reg2 = /DAY\((.+?)\)/g;
        var str = current.match(reg2);
        // console.log(1333311,str)

        current = current.replace(/DAY\(/g, "getDay(");
        var txt = this.getDay();

        funcList.push(txt);
        // console.log(12122,this.getDayOld('2021-01-01'))
      }
      if (current.indexOf("HOUR(") > -1) {
        var reg2 = /HOUR\((.+?)\)/g;
        var str = current.match(reg2);
        // console.log(1333311,str)

        current = current.replace(/HOUR\(/g, "getHour(");
        var txt = this.getHour();

        funcList.push(txt);
        // console.log(12122,this.getHourOld('2021-01-01 19:00:00'))
      }
      if (current.indexOf("MONTH(") > -1) {
        var reg2 = /MONTH\((.+?)\)/g;
        var str = current.match(reg2);
        // console.log(1333311,str)

        current = current.replace(/MONTH\(/g, "getMon(");
        var txt = this.getMon();

        funcList.push(txt);
        // console.log(12122,this.getMonOld('2021-01-01 19:00:00'))
      }
      if (current.indexOf("MINUTE(") > -1) {
        var reg2 = /MINUTE\((.+?)\)/g;
        var str = current.match(reg2);
        // console.log(1333311,str)

        current = current.replace(/MINUTE\(/g, "getMinute(");
        var txt = this.getMinute();

        funcList.push(txt);
        // console.log(12122,this.getMinuteOld('2021-01-01 19:25:00'))
      }
      if (current.indexOf("NOW(") > -1) {
        var reg2 = /NOW\((.+?)\)/g;
        var str = current.match(reg2);
        // console.log(1333311,str)

        current = current.replace(/NOW\(/g, "getNow(");
        var txt = this.getNow();

        funcList.push(txt);
        // console.log(12122,this.getNowOld())
      }
      if (current.indexOf("SECOND(") > -1) {
        var reg2 = /SECOND\((.+?)\)/g;
        var str = current.match(reg2);
        // console.log(1333311,str)

        current = current.replace(/SECOND\(/g, "getSecond(");
        var txt = this.getSecond();

        funcList.push(txt);
        // console.log(12122,this.getSecondOld('2021-01-01 19:25:23'))
      }
      if (current.indexOf("YEAR(") > -1) {
        var reg2 = /YEAR\((.+?)\)/g;
        var str = current.match(reg2);
        // console.log(1333311,str)

        current = current.replace(/YEAR\(/g, "getYear(");
        var txt = this.getYear();

        funcList.push(txt);
        // console.log(12122,this.getYearOld('2021-01-01 19:25:23'))
      }
      if (current.indexOf("AND(") > -1) {
        var reg2 = /AND\((.+?)\)/g;
        var str = current.match(reg2);
        var strList = [];
        // console.log(1333311,str)

        str.map((item, i) => {
          current = current.replace(item, "getAnd(alist" + i + ")");
          strList[i] = item.replace(reg2, "$1").split(",");
        });

        // console.log(1111111,str,strList)

        var aa = "";
        strList.map((item, i) => {
          aa +=
            "var alist" +
            i +
            "=" +
            JSON.stringify(item).replace(/\"/g, "") +
            "\n";
        });

        current = aa + current;

        var txt = this.getAnd();

        funcList.push(txt);
        // console.log(12122,this.getAndOld([10>1,20>1,30>1]))
      }
      if (current.indexOf("OR(") > -1) {
        var reg2 = /OR\((.+?)\)/g;
        var str = current.match(reg2);
        var strList = [];
        // console.log(1333311,str)

        str.map((item, i) => {
          current = current.replace(item, "getOr(olist" + i + ")");
          strList[i] = item.replace(reg2, "$1").split(",");
        });

        // console.log(1111111,str,strList)

        var aa = "";
        strList.map((item, i) => {
          aa +=
            "var olist" +
            i +
            "=" +
            JSON.stringify(item).replace(/\"/g, "") +
            "\n";
        });

        current = aa + current;

        var txt = this.getOr();

        funcList.push(txt);
        // console.log(12122,this.getOrOld([10<1,20<1,30<1]))
      }

      // 拼接V8字符串
      lists = current + "\n\n";

      if (funcList.length > 0) {
        funcList.map((item) => {
          lists = lists + item + "\n\n";
        });
      }

      //存所填写的公式
      this.formList = this.chooseData.Label + "=" + data;
      //存替换后的V8代码
      this.formV8List = "//###" + this.formList + "###\n" + lists;

      // console.log("------存所填写的公式------", this.formList);
      // console.log("------存替换后的V8代码------", this.formV8List);
    },
    //判断所传参数是否包含以下判断的字符
    getVal(arr) {
      var reg = /[A-Z]/g;
      if (reg.test(arr)) {
        return false;
      } else if (
        (arr.indexOf("+") > -1 ||
          arr.indexOf("-") > -1 ||
          arr.indexOf("*") > -1 ||
          arr.indexOf("/") > -1) &&
        arr.indexOf("=") > -1
      ) {
        return true;
      } else {
        return false;
      }
    },
    modelChange() {},
    handleChange(e) {},
    newGuid() {
      var guid = "";
      for (var i = 1; i <= 32; i++) {
        var n = Math.floor(Math.random() * 16.0).toString(16);
        guid += n;
        if (i == 8 || i == 12 || i == 16 || i == 20) guid += "-";
      }
      return guid;
    },
    // 时间日期计算时间差DATEDIF
    getDatedif() {
      var txt = "";

      txt =
        "function getDatedif(startTime,endTime,type){\n var date1 = new Date(startTime)\n" +
        " var date2 = new Date(endTime)\n var s1 = date1.getTime(),s2 = date2.getTime();\n" +
        " var total = (s2 - s1)/1000;\n if (type=='d'){\n  var day = total/(24*60*60)\n  return day.toFixed(0)\n }\n" +
        " if (type=='h'){\n  var hour = total/(60*60)\n  return hour.toFixed(0)\n }\n" +
        " if (type=='m'){\n  var minute = total/60\n  return minute.toFixed(0)\n }\n" +
        " if (type=='s'){\n  return total\n }\n" +
        " if (type=='y'){\n  var aa = 365\n  if (date1.getFullYear() % 4 == 0) aa = 366\n  var year = total/(24*60*60*aa)\n  return year.toFixed(0)\n }\n" +
        " if (type=='M'){\n  var month = total/(24*60*60*30)\n  return month.toFixed(0)\n }\n" +
        "}";

      return txt;
    },
    getDatedifOld(startTime, endTime, type) {
      var date1 = new Date(startTime);
      var date2 = new Date(endTime);

      var s1 = date1.getTime(),
        s2 = date2.getTime();
      var total = (s2 - s1) / 1000;

      if (type == "d") {
        var day = total / (24 * 60 * 60);
        return day.toFixed(0);
      } else if (type == "h") {
        var hour = total / (60 * 60);
        return hour.toFixed(0);
      } else if (type == "m") {
        var minute = total / 60;
        return minute.toFixed(0);
      } else if (type == "s") {
        return total;
      } else if (type == "y") {
        var aa = 365;
        if (date1.getFullYear() % 4 == 0) aa = 366;
        var year = total / (24 * 60 * 60 * aa);
        return year.toFixed(0);
      } else if (type == "M") {
        txt +=
          "var month = total/(24*60*60*30)\n" +
          result +
          " = month.toFixed(0)\n";
        return txt;
      }
    },
    // 时间日期计算加减天数DATEDELTA
    getDateDelta() {
      var txt = "";

      txt =
        "function getDateDelta(time,day){\n var dateA = time,dateB=''\n if (dateA.indexOf(':')>-1){\n" +
        "  dateB = dateA.split(' ')[1]\n }\n\n" +
        " var date = new Date(dateA);\n date.setDate(date.getDate() + parseInt(day));\n" +
        " var mm = date.getMonth() + 1;\n var dd = date.getDate();\n if (mm<10) mm ='0'+ mm;\n if (dd<10) dd ='0'+ dd;\n\n" +
        ' var cont = date.getFullYear() + "-" + mm + "-" + dd\n if (dateA.indexOf(\':\')>-1){\n' +
        "  cont = cont + ' ' + dateB\n }\n return cont\n}";

      return txt;
    },
    getDateDeltaOld(time, day) {
      var dateA = time,
        dateB = "";

      if (dateA.indexOf(":") > -1) {
        dateB = dateA.split(" ")[1];
      }

      var date = new Date(dateA);
      date.setDate(date.getDate() + parseInt(day));
      var mm = date.getMonth() + 1;
      var dd = date.getDate();

      if (mm < 10) mm = "0" + mm;
      if (dd < 10) dd = "0" + dd;

      var cont = date.getFullYear() + "-" + mm + "-" + dd;

      if (dateA.indexOf(":") > -1) {
        cont = cont + " " + dateB;
      }

      return cont;
    },
    // 平均数
    getAverage() {
      var txt = "";

      txt =
        "function getAverage(list){\n var sum = 0\n list.map(item=>{\n  sum+=parseInt(item)\n })\n return sum / list.length\n}";

      return txt;
    },
    getAverageOld(list) {
      var sum = 0;

      list.map((item) => {
        sum += parseInt(item);
      });

      return sum / list.length;
    },
    // 如果if判断
    getIf() {
      var txt = "";

      txt =
        "function getIf(str1,str2,str3){\n if (str1){\n  return str2\n }else{\n  return str3\n }\n}";

      return txt;
    },
    getIfOld(str1, str2, str3) {
      if (str1) {
        return str2;
      } else {
        return str3;
      }
    },
    // 如果ifs判断
    getIfs() {
      var txt = "";

      txt =
        "function getIfs(list){\n var arr= [];\n for(var i=0;i<list.length;i+=2){\n  arr.push(list.slice(i,i+2));" +
        " }\n var result = ''\n arr.map(item=>{\n  if (item[0]){\n   result = item[1]\n  }\n })\n return result\n}";

      return txt;
    },
    getIfsOld(list) {
      var arr = [];
      for (var i = 0; i < list.length; i += 2) {
        arr.push(list.slice(i, i + 2));
      }

      var result = "";
      arr.map((item) => {
        if (item[0]) {
          result = item[1];
        }
      });

      return result;
    },
    // 计算最大值
    getMax() {
      var txt = "";

      txt =
        "function getMax(list){\n var max = list[0]\n list.map(item=>{\n  if (item>max){\n   max = item\n  }\n })\n return max\n}";

      return txt;
    },
    getMaxOld(list) {
      var max = list[0];
      list.map((item) => {
        if (item > max) {
          max = item;
        }
      });

      return max;
    },
    // 计算最小值
    getMin() {
      var txt = "";

      txt =
        "function getMin(list){\n var min = list[0]\n list.map(item=>{\n  if (item<min){\n   min = item\n  }\n })\n return min\n}";

      return txt;
    },
    getMinOld(list) {
      var min = list[0];
      list.map((item) => {
        if (item < min) {
          min = item;
        }
      });

      return min;
    },
    // 获取天数
    getDay() {
      var txt = "";

      txt =
        "function getDay(data){\n var date = new Date(data);\n var dd = date.getDate();\n return dd\n}";

      return txt;
    },
    getDayOld(data) {
      var date = new Date(data);
      var dd = date.getDate();
      return dd;
    },
    // 获取小时数
    getHour() {
      var txt = "";
      txt =
        "function getHour(data){\n var date = new Date(data);\n var hh = date.getHours();\n return hh\n}";
      return txt;
    },
    getHourOld(data) {
      var date = new Date(data);
      var hh = date.getHours();
      return hh;
    },
    // 获取月份
    getMon() {
      var txt = "";
      txt =
        "function getMon(data){\n var date = new Date(data);\n var mm = date.getMonth()+1;\n return mm\n}";
      return txt;
    },
    getMonOld(data) {
      var date = new Date(data);
      var mm = date.getMonth() + 1;
      return mm;
    },
    // 获取分钟
    getMinute() {
      var txt = "";
      txt =
        "function getMinute(data){\n var date = new Date(data);\n var mm = date.getMinutes();\n return mm\n}";
      return txt;
    },
    getMinuteOld(data) {
      var date = new Date(data);
      var mm = date.getMinutes();
      return mm;
    },
    // 获取当前时间
    getNow() {
      var txt = "";

      txt =
        "function getNow(){\n var date = new Date();\n var yy = date.getFullYear();\n var MM = date.getMonth() + 1;\n " +
        " var dd = date.getDate();\n var hh = date.getHours();\n var mm = date.getMinutes();\n var ss = date.getSeconds();\n" +
        " var time = yy + '-'+addZero(MM)+'-'+addZero(dd)+' '+addZero(hh)+':'+addZero(mm)+':'+addZero(ss)\n\n" +
        " function addZero(s) {\n  return s < 10 ? ('0' + s) : s;\n }\n\n return time\n}";

      return txt;
    },
    getNowOld() {
      var date = new Date();
      var yy = date.getFullYear();
      var MM = date.getMonth() + 1;
      var dd = date.getDate();
      var hh = date.getHours();
      var mm = date.getMinutes();
      var ss = date.getSeconds();
      var time =
        yy +
        "-" +
        addZero(MM) +
        "-" +
        addZero(dd) +
        " " +
        addZero(hh) +
        ":" +
        addZero(mm) +
        ":" +
        addZero(ss);

      function addZero(s) {
        return s < 10 ? "0" + s : s;
      }

      return time;
    },
    // 获取秒
    getSecond() {
      var txt = "";
      txt =
        "function getSecond(data){\n var date = new Date(data);\n var ss = date.getSeconds();\n return ss\n}";
      return txt;
    },
    getSecondOld(data) {
      var date = new Date(data);
      var ss = date.getSeconds();
      return ss;
    },
    // 获取年份
    getYear() {
      var txt = "";
      txt =
        "function getYear(data){\n var date = new Date(data);\n var yy = date.getFullYear();\n return yy\n}";
      return txt;
    },
    getYearOld(data) {
      var date = new Date(data);
      var yy = date.getFullYear();
      return yy;
    },
    // AND逻辑函数
    getAnd() {
      var txt = "";
      txt =
        "function getAnd(list){\n var alist = []\n alist = list.map(item=>{\n  if (item){\n   return true\n  }else{\n   " +
        "return false\n  }\n })\n\n if (alist.findIndex(ite=>ite==false)==-1){\n  return true\n }else{\n  return false\n " +
        "}\n}";
      return txt;
    },
    getAndOld(list) {
      var alist = [];
      alist = list.map((item) => {
        if (item) {
          return true;
        } else {
          return false;
        }
      });

      // console.log(8989,alist)
      if (alist.findIndex((ite) => ite == false) == -1) {
        return true;
      } else {
        return false;
      }
    },
    // OR逻辑函数
    getOr() {
      var txt = "";
      txt =
        "function getOr(list){\n var olist = []\n olist = list.map(item=>{\n  if (item){\n   return true\n  }else{\n   " +
        "return false\n  }\n })\n\n if (olist.findIndex(ite=>ite==false)==-1){\n  return true\n }else{\n  return false\n " +
        "}\n}";
      return txt;
    },
    getOrOld(list) {
      var olist = [];
      olist = list.map((item) => {
        if (item) {
          return true;
        } else {
          return false;
        }
      });

      // console.log(8989, olist);
      if (olist.findIndex((ite) => ite == true) > -1) {
        return true;
      } else {
        return false;
      }
    },
    // 获取系统地址
    getDiyApiBase() {
      if (localStorage.getItem("DiyApiBase")) {
        this.https = localStorage.getItem("DiyApiBase");
      } else {
        this.https = "https://api-china.itdos.com";
      }
    },
    // 解析V8
    getV8(init) {
      if (this.model) {
        var substr = this.model.match(/(\/\/###=?)(\S*)(?=###)/)[2];
        var data = substr.split("=")[1];
        this.currentModel = data;
        if (init) {
          this.writeV8(data);
        }
      }
    },
    // 根据传入tableid获取该字段数据
    getChooseData(id) {
      var self = this;
      this.fields.map((item) => {
        if (item.Id == id) {
          self.chooseData = item;
          // console.log(self.chooseData,11111)
        }
      });
    }
  }
};
</script>

<style lang="scss">
.text {
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  i {
    padding: 0 10px;
  }
  .func {
    display: inline-block;
    width: 80%;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }
}
.item {
  padding: 5px 0;
}
.box-card {
  margin: 0;
  width: 480px;
  .el-card__body {
    padding: 10px;
  }
}
.headTitle {
  color: #1f2d3d;
  margin-right: 20px;
}
.subTitle {
  font-size: 13px;
  color: #91a1b7;
}
::v-deep .CodeMirror {
  height: 170px;
  border: 1px solid black;
  font-size: 12px;
  font-family: Aruak, monospace;
}
::v-deep .minHeight .el-collapse-item__wrap {
  height: 35px !important;
  line-height: 35px !important;
  border: none !important;
}
::v-deep .el-collapse-item__content {
  padding-left: 12px !important;
}
::v-deep .el-autocomplete-suggestion {
  display: none !important;
}
::v-deep .cm-variable {
  background: #ebf5ff;
  color: #008dcd;
}

.gongshi {
  width: 100%;
  height: 250px;
}
.code-div {
  height: 200px;
  overflow: auto;
  scrollbar-width: none; /* firefox */
  -ms-overflow-style: none; /* IE 10+ */
}
.code-div::-webkit-scrollbar {
  display: none; /* Chrome Safari */
}
::v-deep .code-div .CodeMirror {
  min-height: 170px !important;
}
.title {
  font-size: 12px;
  color: #91a1b7;
  line-height: 18px;
  margin-bottom: 5px;
}

.addCode {
  width: 98%;
  float: right;
  height: 240px;
  .header {
    padding: 10px 0;
  }
  .addCodeDetail {
    margin: -10px !important;
    height: 140px;
    overflow: auto;
    scrollbar-width: none; /* firefox */
    -ms-overflow-style: none; /* IE 10+ */
    .list-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px;
      cursor: pointer;
      .title {
        font-size: 14px;
        color: #333333;
      }
      .tig {
        padding: 2px 8px;
        border-radius: 10px;
      }
      .orange {
        background: rgba(252, 155, 59, 0.15);
        color: #fc9b3b;
      }
      .purple {
        color: #8e24f9;
        background: rgba(142, 36, 249, 0.15);
      }
      .blue {
        font-size: 12px;
        color: #248af9;
        background: rgba(36, 138, 249, 0.1);
      }
      .green {
        color: #05d1d1;
        background: rgba(5, 209, 209, 0.15);
      }
      .pink {
        color: #dc38dc;
        background: rgba(220, 56, 220, 0.15);
      }
      .yellow {
        color: #f4b700;
        background: rgba(244, 183, 0, 0.15);
      }
    }
    .funClass {
      padding-left: 10px;
      cursor: pointer;
    }
    .selectColor {
      background-color: #ecf5ff;
    }
  }
  .addCodeDetail::-webkit-scrollbar {
    display: none; /* Chrome Safari */
  }
}
</style>
