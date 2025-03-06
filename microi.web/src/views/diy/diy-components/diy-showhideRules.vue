<template>
    <div>
        <el-button class="edit" @click="ruleShow" type="primary">已有{{rulesLists.length}}条显隐规则</el-button>

        <el-dialog :visible.sync="showRule" width="60%" :before-close="handleClose" title="字段显隐规则"
        :modal-append-to-body="false" append-to-body>
            <div class="rulesList">
                <el-button class="add-rules" @click="show" type="primary" size="medium">添加显隐规则</el-button>
                <el-row class="rules-item" v-for="(item,index) in rulesLists" :key="index">
                    <el-col :span="20">
                        <div>
                            <div class="rules-item-condition" v-for="(item1,index1) in item.field" :key="index1">
                                <span v-if="index1==0">当</span>
                                <span v-if="index1>0&&item.tiaojian=='所有'">且</span>
                                <span v-if="index1>0&&item.tiaojian=='任一'">或</span>
                                {{item1.label}} <span>{{item1.condition.label}} {{item1.option.label}}</span>
                                <span v-if="index1==item.field.length-1">时</span>
                            </div> 
                            <div style="color:#91A1B7;">
                                显示
                                <div class="rules-item-xianshi" v-for="(item2,index2) in item.xianshi" :key="index2">
                                    「<span>{{item2.Label}}</span>」
                                </div>
                            </div>
                        </div>
                    </el-col>
                    <el-col :span="4">
                        <el-button class="edit" @click="editRule(item,index)" type="primary">编辑</el-button>
                        <el-button class="edit" @click="delRule(item,index)">删除</el-button>
                    </el-col>
                    <!-- <el-col>
                        <el-input type="textarea" v-model="item.code" :rows="5">
                        </el-input>
                    </el-col> -->
                </el-row>
            </div>
        </el-dialog>

        <el-dialog :visible.sync="dialogShow" width="60%" :before-close="handleClose" title="字段显隐规则"
        :modal-append-to-body="false" append-to-body>
            <div class="showhide">

                <el-row class="top">
                    <el-col :span="2" style="width:auto;">
                        满足以下
                    </el-col>
                    <el-col :span="2" style="margin:0 10px;">
                        <el-select v-model="value" placeholder="请选择">
                            <el-option label="所有" value="所有">
                            </el-option>
                            <el-option label="任一" value="任一">
                            </el-option>
                        </el-select>
                    </el-col>
                    <el-col :span="2">
                        条件时
                    </el-col>
                </el-row>

                <el-row v-for="(item,index) in form" :key="index" style="margin-bottom:20px;">
                    <el-col :span="5">
                        <el-select v-model="item.field" placeholder="请选择" @change="fieldChange">
                            <el-option :label="itemField.Label" :value="itemField.Id" v-for="(itemField,indexField) in fieldsList" :key="indexField"></el-option>
                        </el-select>
                    </el-col>
                    <el-col :span="4" style="margin:0 40px;">
                        <el-select v-model="item.condition" placeholder="请选择">
                            <el-option :label="itemCon.label" :value="itemCon.value" v-for="(itemCon,indexCon) in item.conditionList" :key="indexCon"></el-option>
                        </el-select>
                    </el-col>
                    <el-col :span="10">
                        <el-select v-model="item.options" placeholder="请选择" style="width:80%">
                            <el-option :label="itemOpt.label" :value="itemOpt.value" v-for="(itemOpt,indexOpt) in item.optionsList" :key="indexOpt"></el-option>
                        </el-select>
                    </el-col>
                    <el-col :span="2" v-if="form.length>1">
                        <el-button type="primary" @click="delForm(index)">删除</el-button>
                    </el-col>
                </el-row>
                <el-row style="margin-top:30px;">
                    <el-button type="primary" icon="el-icon-circle-plus-outline" @click="addShowHide">添加条件</el-button>
                </el-row>
                <el-row style="margin-top:50px;">
                    <el-col>
                        显示以下字段
                    </el-col>
                    <el-col style="margin-top:20px;">
                        <el-select v-model="showField" placeholder="请选择" style="width:100%;" multiple @change="showFieldChange" @focus="focusShow">
                            <el-option :label="item.Label" :value="item.Id" v-for="(item,index) in showList" :key="index"></el-option>
                        </el-select>
                    </el-col>
                </el-row>
                <el-row class="bottom">
                    <el-col >
                        <a style="color:#a5a5a5;">注：只能选择下拉单选/开关属性的字段，其余无数据！</a>
                    </el-col>
                    <el-col style="text-align: right;">
                        <el-button size="medium" @click="dialogShow=false">取消</el-button>
                        <el-button size="medium" type="primary" @click="onSubmit">确认</el-button>
                    </el-col>
                </el-row>
            </div>
        </el-dialog>
    </div>
</template>

<script>
import qs from 'qs'
export default {
    props:{
        fields:{
            type:Array,
            default:[]
        },
        model: {
            type:String,
            default:''
        }
    },
    watch:{
        model(newVal,oldVal){
            if (oldVal != newVal) {
                this.model = newVal;
                this.handleCode()
            }
        }
    },
    data(){
        return {
            dialogShow: false,
            value:'所有',
            form:[
                {
                    field:'',// 字段
                    condition:'==', //条件
                    options:'',//选项
                    conditionList:[
                        {
                            label:'等于',
                            value:'==',
                        }
                    ],
                    optionsList:[
                        
                    ],
                }
            ],
            showField:'',//显示字段
            showFieldList:[],
            rulesList:[],
            showRule:false,
            rulesLists:[],
            type:'',
            rulesIndex:'',
            fieldsList:[],
            showList:[],
            hideList:[],
            https:'',
        }
    },
    methods:{
        ruleShow(){
            this.showRule=true
        },
        show(){
            this.dialogShow = true
            this.type = '新增'
            this.reset()
            this.fieldsList = []
            this.fields.map(item=>{
                if (item.Component=='Switch'||item.Component=='Select'){
                    this.fieldsList.push(item)
                }
            })
        },
        // 重置
        reset(){
            this.form = [
                {
                    field:'',// 字段
                    condition:'==', //条件
                    options:'',//选项
                    conditionList:[
                        {
                            label:'等于',
                            value:'==',
                        }
                    ],
                    optionsList:[
                        
                    ],
                }
            ]
            this.value = '所有'
            this.showField = ''
            this.showFieldList = []
        },
        handleClose(done){
            done()
        },
        //满足条件的 第一个选项 选择时
        fieldChange(e){
            // console.log(12212,e,333,this.form)
            var aa = '',list = ''
            var self = this
            this.form.map((item,i)=>{
                if (item.field==e){
                    aa = i
                }
            })
            // console.log(1111,aa)
            this.fields.map(item=>{
                if (item.Id==e){
                    list = item
                }
            })

            this.form[aa].options=''

            if (list.Component=='Switch'){
                // 字段Component为开关的时候
                
                this.form[aa].optionsList = [
                    {
                        label:'是',
                        value:'true',
                    },
                    {
                        label:'否',
                        value:'false',
                    },
                ]
            }else if (list.Component=='Select'){
                // 字段Component为下拉单选的时候，关联选项无法获取数据！
                this.getSeletOptions(list.Id,aa,JSON.parse(list.Config).SelectLabel)
            }else{
                this.form[aa].optionsList = []
            }
        },
        // 显示以下字段  选择调用
        showFieldChange(e){
            // console.log(5555,e,this.showField)
            var list = []
            this.fields.map(item=>{
                e.map(ite=>{
                    if (item.Id==ite){
                        list.push(item)
                    }
                })
            })

            // console.log(6666,list)

            this.showFieldList = list.map(item=>{
                return {
                    Label: item.Label,
                    Name: item.Name,
                    Id: item.Id,
                }
            })

        },
        // 显示字段要去掉已选择条件的字段
        focusShow(){
            // console.log(222,this.form)
            // console.log(222333,this.fields)
            
            this.showList = this.getArrDifSameValue(this.form,this.fields)

        },
        getArrDifSameValue(arr1,arr2){
            var result = [];
            for(var i = 0; i < arr2.length; i++){
                var obj = arr2[i];
                var id = obj.Id;
                var isExist = false;
                for(var j = 0; j < arr1.length; j++){
                    var aj = arr1[j];
                    var n = aj.field;
                    if(n == id){
                        isExist = true;
                        break;
                    }
                }
                if(!isExist){
                    result.push(obj);
                }
            }
            return result;
        },
        // 获取下拉单选的选项
        getSeletOptions(id,i,label){
            var self = this
            this.$axios.post(this.https+'/api/diytable/getDiyFieldSqlData', qs.stringify({
                _FieldId: id,
                // OsClient: shopdiy,
                // _SqlParamValue: {}
            }),{
                headers:{
                'authorization': 'Bearer '+localStorage.getItem('authorization'),
                'content-type': 'application/x-www-form-urlencoded',
                'did': this.newGuid()
                }
            })
            .then(function (response) {
                if (response.data.Code==1){
                    self.form[i].optionsList = response.data.Data.map(item=>{
                        return {
                            label:item[label],
                            value:item.Id,
                        }
                    })
                }else{
                    self.form[i].optionsList = []
                }
            })
            .catch(function (error) {
                console.log(error);
            });
        },
        // 确认提交
        onSubmit(){
            // console.log(1111111,this.showFieldList)
            // console.log(2222222,this.form)
            // console.log(3333333,this.rulesLists)
            
            var rules = true

            // 验证需填项是否为空
            if (this.showFieldList.length==0){
                rules = false
            }else{
                this.form.map(item=>{
                    if (item.options==''){
                        rules = false
                    }
                })
            }


            // 编辑状态下，验证是否已有需要先去掉自身的显示字段
            if (this.type=='编辑'){
                var copylist = []
                this.rulesLists.map((ite,i)=>{
                    if (this.rulesIndex!==i){
                        copylist.push(ite)
                    }
                })

                if (copylist.length>0){

                    var list = []

                    copylist.map(item=>{
                        item.xianshi.map(ite=>{
                            list.push(ite)
                        })
                    })

                    var showRules = true

                    this.showFieldList.map(ite=>{
                        list.map(item=>{
                            if (item.Id==ite.Id){
                                return showRules = false ,rules = false
                            }
                        })
                    })

                    if (!showRules){
                        this.$message({
                            message: '有显示字段已被其他显隐规则设置！',
                            type: 'warning'
                        });
                        return false
                    }

                }
            }else{
                // 验证显示字段是否被其他显隐规则设置过
                if (this.rulesLists.length>0){

                    var list = []

                    this.rulesLists.map(item=>{
                        item.xianshi.map(ite=>{
                            list.push(ite)
                        })
                    })

                    var showRules = true

                    this.showFieldList.map(ite=>{
                        list.map(item=>{
                            if (item.Id==ite.Id){
                                return showRules = false ,rules = false
                            }
                        })
                    })

                    if (!showRules){
                        this.$message({
                            message: '有显示字段已被其他显隐规则设置！',
                            type: 'warning'
                        });
                        return false
                    }

                }
            }
            


            // 验证无误后提交
            if (rules){
                // console.log('可提交！！！')
                
                this.getRules()

                this.getCode()

                this.dialogShow = false

            }else{
                this.$message({
                    message: '请填写完整！',
                    type: 'warning'
                });
            }
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
        // 添加条件
        addShowHide(){
            this.form.push(
                {
                    field:'',// 字段
                    condition:'==', //条件
                    options:'',//选项
                    conditionList:[
                        {
                            label:'等于',
                            value:'==',
                        }
                    ],
                    optionsList:[
                        
                    ],
                }
            )
            this.showField = ''
            this.showFieldList = []
        },
        // 删除
        delForm(index){
            this.form.splice(index,1)
            
        },
        // 生成显隐规则
        getRules(){
            // console.log(222,this.form)
            // console.log(444,this.value)
            // console.log(666,this.showFieldList)

            var fieldTest = []

            this.form.map(item=>{
                var bb = '',cc = '',dd = ''
                this.fields.map(ite=>{
                    if (item.field==ite.Id){
                        cc = ite
                    }
                })

                // console.log(14324234,item)

                if (item.options=='true'){
                    bb = {
                        value:true,
                        label:'是'
                    }
                }else if(item.options=='false'){
                    bb = {
                        value:false,
                        label:'否'
                    }
                }else{
                    item.optionsList.map(res=>{
                        if (res.value==item.options){
                            bb = {
                                value:res.value,
                                label:res.label
                            }
                        }
                    })
                }
                
                item.conditionList.map(res=>{
                    if (res.value==item.condition){
                        dd = res
                    }
                })

                fieldTest.push({
                    name:cc.Name,
                    label:cc.Label,
                    id:cc.Id,
                    option:bb,
                    condition:dd
                })
            })

            var aa = {
                field:fieldTest,
                tiaojian:this.value,
                xianshi:this.showFieldList,
            }
            // console.log('aaaaaa099090',aa)

            if (this.type=='新增'){
                this.rulesLists.push(aa)
            }
            if (this.type=='编辑'){
                this.rulesLists[this.rulesIndex] = aa
            }



        },
        // 合成代码
        getCode(){
            // console.log('合成代码-->',this.rulesLists)
            var self = this
            this.rulesLists.map(item=>{
                item.xianshiCode = [],item.code = []
                item.xianshi.map(ite=>{

                    // 根据id再去查找一遍重新赋值，以防字段名有修改
                    self.fields.map(fi=>{
                        if (fi.Id==ite.Id){
                            ite.Name = fi.Name,
                            ite.Label = fi.Label
                        }
                    })
                    // console.log(1111111111,newName)
                    item.xianshiCode.push('V8.FieldSet(\'' + ite.Name + '\',\'Visible\',true);')
                })
                
                item.field.map(res=>{
                    // 根据id再去查找一遍重新赋值，以防字段名有修改
                    self.fields.map(fi=>{
                        if (fi.Id==res.id){
                            res.name = fi.Name,
                            res.label = fi.Label
                        }
                    })

                    if (typeof res.option.value == 'boolean'){
                        item.code.push('V8.Form.'+res.name + res.condition.value + res.option.value)
                    }else{
                        item.code.push('V8.Form.'+res.name + res.condition.value + '\'' + res.option.label + '\'')
                    }
                })

                var txt1 = '',txt2 = '',txt3 = ''

                item.code.map((codeit,i)=>{
                    if (i==0){
                        txt1 = codeit
                    }else{
                        if (item.tiaojian == '所有'){
                            txt1 = txt1 + '&&' + codeit
                        }else{
                            txt1 = txt1 + '||' + codeit
                        }
                    }
                    
                })
                item.xianshiCode.map((xian,i)=>{
                    txt2 = txt2 + xian + '\n'
                })

                let {xianshiCode,code,...pick} = item

                item.code = '//##字段显隐START\nif (' + txt1 + '){\n' + txt2 + '}\n//##字段显隐END\n//codeSTART' + JSON.stringify(pick) + 'codeEND\n\n'

            })
            // console.log('aaaaa',this.rulesLists)

            
            var str = ''
            this.rulesLists.map(res1=>{
                str += res1.code
            })

            // console.log(33333,str)
            this.$emit("update:model", str);

        },
        // 编辑已有显隐规则时，显示详情
        editRule(item,index){
            this.fieldsList = []
            this.fields.map(item=>{
                if (item.Component=='Switch'||item.Component=='Select'){
                    this.fieldsList.push(item)
                }
            })

            this.focusShow()

            var self = this
            this.type = '编辑'
            this.rulesIndex = index
            // console.log(this.type,item)
            this.dialogShow = true
            this.showFieldList = item.xianshi

            // 1显示以下字段赋值----
            var aa = []
            this.showFieldList.map(ite=>{
                this.fields.map(res=>{
                    if (res.Name==ite.Name){
                        aa.push(res.Id)
                    }
                })
            })
            
            this.showField = aa

            // console.log('1111showField',this.showField)
            // console.log('showFieldList111',this.showFieldList)

            // 2满足条件时----
            var bb = []
            item.field.map(ite=>{
                this.fields.map(res=>{
                    if (res.Name==ite.name){
                        bb.push(res.Id)
                    }
                })
            })

            // console.log(bb)

            // 2-0根据条件数量赋值form的数量重置
            this.form = []
            for (var i=0;i<bb.length;i++){
                this.form.push(
                    {
                        field:'',// 字段Id
                        condition:'==', //条件
                        options:'',//选项
                        conditionList:[
                            {
                                label:'等于',
                                value:'==',
                            }
                        ],
                        optionsList:[
                            
                        ],
                    }
                )
            }
            // 2-1将已选择的的选项赋值到每个form
            bb.map((res,i1)=>{
                this.form.map((ite,i2)=>{
                    if (i1==i2){
                        ite.field = res
                    }
                    item.field.map(res1=>{
                        if (res1.Name==ite.Name){
                            ite.condition = res1.condition.value
                        }
                    })
                })
            })
            
            // 2-2将每个选项对应的条件的列表赋值到form上
            this.form.map((e,i)=>{
                var list = ''
                this.fields.map(code=>{
                    if (code.Id == e.field){
                        list = code
                    }
                })
                

                if (list.Component=='Switch'){
                    // 字段Component为开关的时候
                    
                    e.optionsList = [
                        {
                            label:'是',
                            value:'true',
                        },
                        {
                            label:'否',
                            value:'false',
                        },
                    ]
                }else if (list.Component=='Select'){
                    // 字段Component为下拉单选的时候，关联选项无法获取数据！
                    this.getSeletOptions(list.Id,i,JSON.parse(list.Config).SelectLabel)
                }else{
                    e.optionsList = []
                }
            })

            // 2-3将每个选项对应的条件赋值到form上
            // console.log(this.form,121212)
            item.field.map(res=>{
                this.form.map(ite=>{
                    var listCode = ''
                    this.fields.map(code=>{
                        if (code.Id == ite.field){
                            listCode = code
                        }
                    })
                    if (res.name==listCode.Name){
                        if (typeof res.option.value == 'boolean'){
                            ite.options = JSON.stringify(res.option.value)
                        }else{
                            ite.options = res.option.value
                        }
                        
                    }
                })
            })

            // 3所有或任一条件匹配
            this.value = item.tiaojian

            // console.log(33222222,this.form)
            
        },
        // 删除已有显隐规则
        delRule(item,index){

            this.$confirm('确定要删除此显隐规则？', '提示', {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning'
            }).then(() => {
                this.rulesLists.splice(index,1)
                this.getCode()
                this.$message({
                    type: 'success',
                    message: '删除成功!'
                });
            })

        },
        // 分析传入code值，赋值给rulesLists
        handleCode(){
            // console.log(this.model)
            this.rulesLists = []

            if (this.model.length>0){

                var str = this.model.match(/(?<=codeSTART)(\S*)(?=codeEND)/g)
                str.map(res=>{
                    this.rulesLists.push(JSON.parse(res))
                })
                
                // list = this.model.match(/(?<=FieldSet\(\').*?(?=\',')/g)
                // console.log(6666,this.rulesLists)

                this.getCode()
            }

        },
        // 分析传入的V8Code显隐规则，解析成数组
        analyseVode(code){
            var list = [],sumList = []
            if (code){
                var str = code.match(/(?<=codeSTART)(\S*)(?=codeEND)/g)
                str.map(res=>{
                    list.push(JSON.parse(res))
                })

                list.map(item=>{

                    item.xianshiCode = [],item.code = []
                    item.xianshi.map(ite=>{
                        item.xianshiCode.push('V8.FieldSet(\'' + ite.Name + '\',\'Visible\',true);')
                    })

                    item.field.map(res=>{
                        if (typeof res.option.value == 'boolean'){
                            item.code.push('V8.Form.'+res.name + res.condition.value + res.option.value)
                        }else{
                            item.code.push('V8.Form.'+res.name + res.condition.value + '\'' + res.option.label + '\'')
                        }
                    })

                    var txt1 = '',txt2 = ''

                    item.code.map((codeit,i)=>{
                        if (i==0){
                            txt1 = codeit
                        }else{
                            if (item.tiaojian == '所有'){
                                txt1 = txt1 + '&&' + codeit
                            }else{
                                txt1 = txt1 + '||' + codeit
                            }
                        }
                        
                    })
                    item.xianshiCode.map((xian,i)=>{
                        txt2 = txt2 + xian + '\n'
                    })

                    let {xianshiCode,code,...pick} = item

                    item.code = '//##字段显隐START\nif (' + txt1 + '){\n' + txt2 + '}\n//##字段显隐END\n//codeSTART' + JSON.stringify(pick) + 'codeEND\n\n'

                    var fieldList = []
                    item.field.map(res1=>{
                        fieldList.push(res1.id)
                    })    

                    sumList.push({
                        fieldIds:fieldList,
                        V8Code:item.code
                    })

                })
            }

            // console.log('V8code',list)
            // console.log('解析后',sumList)

            return sumList
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
        this.handleCode()

        // console.log('解析V8字段显隐规则',this.analyseVode(this.model))
    }
}
</script>

<style lang="scss" scoped>
.rulesList{
    height: 600px;
    overflow-y: auto;
    .rules-item{
        padding: 20px 0;
        border-top: 1px solid #e1e1e1;
        font-size: 15px;
        line-height: 26px;
        .rules-item-condition{
            color: #1F2D3D;
            span{
                color: #91A1B7;
            }
        }
        .rules-item-xianshi{
            display: inline-block;
            span{
                color: #1F2D3D;
            }
        }
    }
    .rules-item:last-child{
        border-bottom: 1px solid #e1e1e1;
    }
    .add-rules{
        margin-bottom: 20px;
    }
}
.showhide{
    padding: 0 20px 10px;
    max-height: 600px;
    overflow-y: auto;
    .top{
        display: flex;
        justify-content: flex-start;
        align-items: center;
        margin-bottom: 20px;
    }
    .bottom{
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 40px;
    }
}
</style>