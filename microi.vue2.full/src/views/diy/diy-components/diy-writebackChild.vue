<template>
    <div>
        <el-button class="edit" @click="show" type="primary">编辑</el-button>
        <el-timeline :reverse="reverse">
            <el-timeline-item
                v-for="(activity, index) in engineList"
                :key="index"
                :timestamp="activity.code">
                {{activity.title}}
            </el-timeline-item>
        </el-timeline>

        <el-dialog :visible.sync="dialogShow" width="60%" :before-close="handleClose" title="回写子表"
        :modal-append-to-body="false" append-to-body>
            <div class="child-list">
                <el-row>
                    <el-col :span="8">
                        <el-form ref="childTable" class="fieldset-form" :model="form" label-width="80px" :rules="rules" >
                        <el-form-item label="父级字段" prop="father">
                            <el-select v-model="form.father" placeholder="请选择" filterable >
                                <el-option :label="value.Label" :value="`${value.Label}:${value.Name}`" v-for="(value,index) in fields" :key="index"></el-option>
                            </el-select>
                        </el-form-item>
                        <el-form-item label="子表字段" prop="child">
                            <el-select v-model="form.child" placeholder="请选择" filterable >
                                <el-option :label="value.Label" :value="`${value.Label}:${value.Name}`" v-for="(value,index) in childList" :key="index"></el-option>
                            </el-select>
                        </el-form-item>
                        <el-form-item>
                            <el-button type="primary" @click="onSubmit()">添加</el-button>
                        </el-form-item>
                    </el-form>
                    </el-col>
                    <el-col :span="8" style="min-height: 500px;max-height: 700px;overflow-y: auto;">
                        <el-col v-for="(item,index) in engineList" :key="index" style="margin:10px 0;">
                            {{item.title}}
                            <el-button style="margin-left:20px;" size="mini" @click="delSearch(item,index)">删除</el-button>
                        </el-col>
                    </el-col>
                    <el-col :span="8">
                        <div class="codemirror">
                            <codemirror
                                ref="cmObj"
                                v-model="currentModel"
                                :options="cmOptions"
                                @input="modelChange" />
                        </div>
                        <p class="tips">注：可以直接在输入框内写代码，请注意格式正确！！</p>
                        <p class="tips">
                            [{"Father":"FielName1","Child":"FielName2"},{"Father":"FielName3","Child":"FielName4"}]
                        </p>
                    </el-col>
                </el-row>
            </div>
        </el-dialog>
    </div>
</template>

<script>
import qs from 'qs'
import 'codemirror/lib/codemirror.css'
import { codemirror } from 'vue-codemirror'
require("codemirror/mode/javascript/javascript.js")
export default {
    components:{
        codemirror
    },
    props:{
        fields:{
            type:Array,
            default:[]
        },
        childTableId: {
            type: String,
            defalut: ""
        },
        model: {
            type: String,
            defalut: ""
        }
    },
    data() {
        return {
            reverse: true,
            dialogShow:false,
            form:{
                father:'',
                child:'',
            },
            rules:{
                father:[
                    { required: true, message: '请选择', trigger: 'change' }
                ],
                child:[
                    { required: true, message: '请选择', trigger: 'change' }
                ],
            },
            childList:[],
            engineList:[],
            currentModel:this.model,
            // 代码输入框
            cmOptions: {
                // 所有参数配置见：https://codemirror.net/doc/manual.html#config
                tabSize: 4,
                styleActiveLine: true,
                lineNumbers: true,
                line: true,
                foldGutter: true,
                styleSelectedText: true,
                mode: 'text/javascript',
                // keyMap: "sublime",
                matchBrackets: true,
                showCursorWhenSelecting: true,
                // theme: 'base16-dark',
                extraKeys: {
                    'Ctrl': 'autocomplete'
                },
                hintOptions: {
                    completeSingle: false
                },
                lineWrapping: true // 自动换行
            },
            options: [],
            value: [],
            list: [],
            loading: false,
            menuIndex:'',
            codeList:[],
            https:'',
        }
    },
    watch:{
        childTableId(newVal,oldVal){
            if (newVal!=oldVal&&newVal!=''){
                this.getChild()
            }
        },
        model(newVal,oldVal){
            if (oldVal != newVal) {
                this.currentModel = newVal;
                this.getChild()
            }
        }
    },
    methods:{
        show(){
            var self = this
            this.dialogShow = true
            self.$nextTick(function () {
                if (self.$refs.cmObj) {
                    self.$refs.cmObj.refresh()
                }
            })
        },
        handleClose(done) {
            done();
        },
        getChild(){
            var self = this
            this.$axios.post(this.https+'/api/diyfield/getDiyField', qs.stringify({
                TableId: this.childTableId
            }),{
                headers:{
                'authorization': 'Bearer '+localStorage.getItem('authorization'),
                'content-type': 'application/x-www-form-urlencoded',
                'did': this.newGuid()
                }
            })
            .then(function (response) {
                if (response.data.Code==1){
                    self.childList = response.data.Data
                    self.getCode()
                }
            })
            .catch(function (error) {
                console.log(error);
            });
        },
        newGuid() {
            var guid = "";
            for (var i = 1; i <= 32; i++) {
                var n = Math.floor(Math.random() * 16.0).toString(16);
                guid += n;
                if ((i == 8) || (i == 12) || (i == 16) || (i == 20))
                guid += "-";
            }
            return guid;
        },
        onSubmit(){
            // console.log(this.form)
            this.engineList.push({
                title:this.form.father + ' ~ ' + this.form.child
            })
            this.codeList.push({
                father:this.form.father,
                child:this.form.child,
            })
            // console.log(66666,this.codeList)
            this.forCode()
        },
        modelChange(e){
            this.$emit("update:model", e);
            this.currentModel = e
            this.getCode()
        },
        delSearch(item,index){
            this.engineList.splice(index,1)
            this.codeList.splice(index,1)

            this.forCode()
        },
        forCode(){
            // console.log(55555,this.codeList)
            if (this.codeList.length>0){
                var aa = '',bb = ''
                this.codeList.map((item,i)=>{
                    if (i==0){
                        var father = item.father.split(':')[1]
                        var child = item.child.split(':')[1]
                        aa = '{"Father":"' + father + '","Child":"' + child + '"}'
                    }else{
                        var father = item.father.split(':')[1]
                        var child = item.child.split(':')[1]
                        aa = aa + ',{"Father":"' + father + '","Child":"' + child + '"}'
                    }
                })

                bb = '[' + aa + ']'
                this.$emit("update:model", bb);
                this.currentModel = bb

            }else{
                this.$message({
                    message: '不能为空！',
                    type: 'warning'
                });
            }
        },
        getCode(){
            var self = this

            if (this.currentModel&&this.currentModel!=''){
                // console.log(JSON.parse(this.currentModel))
                var aa = JSON.parse(this.currentModel)
                aa.map(item=>{
                    // console.log(333,item)
                    self.childList.map(ite=>{
                        // console.log(444,item.Child,ite.Name)
                        if (item.Child == ite.Name){
                            item.childLabel = ite.Label
                        }
                    })
                    self.fields.map(ite=>{
                        // console.log(444,item.Child,ite.Name)
                        if (item.Father == ite.Name){
                            item.fatherLabel = ite.Label
                        }
                    })
                    
                })

                this.engineList = []
                this.codeList = []

                aa.map(item=>{
                    self.engineList.push({
                        title: item.fatherLabel + ':' + item.Father + ' ~ ' + item.childLabel + ':' + item.Child
                    })
                    self.codeList.push({
                        father:item.fatherLabel + ':' + item.Father,
                        child:item.childLabel + ':' + item.Child,
                    })
                })

            }
            
        },
        getMirror(){
            let that = this;
            that.clientHeight = `${document.documentElement.clientHeight}`;//获取浏览器可视区域高度
            // 获取codemirror对象  // 获取报错bug未解决，输出this.$refs为{}内容，this.$nextTick试过了
            that.editor = this.$refs.cmObj.codemirror;
            // 设置codemirror高度
            that.editor.setSize('auto',this.clientHeight - 50);
             
            // 监听屏幕
            window.onresize = function () {
                that.clientHeight = `${document.documentElement.clientHeight}`;
                // 设置代码区域高度
                that.editor.setSize('auto',parseFloat(that.clientHeight) - 105);
            }
        },
        // 获取系统地址
        getDiyApiBase(){
            if(localStorage.getItem('DiyApiBase')){
                this.https =  localStorage.getItem('DiyApiBase');
            }else{
                this.https =  'https://api-china.itdos.com'
            }
        }
    },
    mounted(){
        this.getDiyApiBase()
        this.getChild()
        // this.getMirror()
    }
}
</script>

<style lang="scss" scoped>
.edit{
    margin-bottom: 20px;
}
.child-list{
    min-height: 500px;
}
.el-timeline{
    padding: 0;
}
.el-timeline-item{
    padding-bottom: 10px;
}
.tips{
    font-size:12px;
    color:#a5a5a5;
}
</style>