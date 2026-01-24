<template>
    <div>
        <el-button class="edit" @click="show = true" type="primary">数据联动设置</el-button>

        <el-dialog v-model="show" width="60%" title="数据联动设置" :modal-append-to-body="false" append-to-body>
            <div class="showhide">
                <el-row>
                    <el-col class="head">联动表单</el-col>
                    <el-col :span="10">
                        <el-select v-model="table" filterable placeholder="请选择联动表单" style="width: 100%" @change="changeTable">
                            <el-option v-for="item in tableList" :key="item.Id" :label="item.Description" :value="item.Id"> </el-option>
                        </el-select>
                    </el-col>
                </el-row>

                <el-row class="head" style="margin-top: 40px"> 满足以下所有条件时 </el-row>
                <el-row v-for="(item, index) in form" :key="index" style="margin-bottom: 20px">
                    <el-col :span="5">
                        <el-select v-model="item.field" placeholder="联动表单字段">
                            <el-option :label="itemField.Label" :value="itemField.Name" v-for="(itemField, indexField) in fieldList" :key="indexField"></el-option>
                        </el-select>
                    </el-col>
                    <el-col :span="4" style="margin: 0 40px">
                        <el-select v-model="item.condition" placeholder="请选择">
                            <el-option :label="itemCon.label" :value="itemCon.value" v-for="(itemCon, indexCon) in item.conditionList" :key="indexCon"></el-option>
                        </el-select>
                    </el-col>
                    <el-col :span="10">
                        <el-select v-model="item.options" placeholder="当前表单字段" style="width: 80%">
                            <el-option :label="itemOpt.Label" :value="itemOpt.Name" v-for="(itemOpt, indexOpt) in fields" :key="indexOpt"></el-option>
                        </el-select>
                    </el-col>
                    <el-col :span="2" v-if="form.length > 1">
                        <el-button type="primary" @click="delForm(index)">删除</el-button>
                    </el-col>
                </el-row>
                <el-row style="margin-top: 30px">
                    <el-button type="primary" :icon="CirclePlusFilled" @click="addShowHide">添加条件</el-button>
                </el-row>

                <el-row class="head" style="margin-top: 40px"> 触发以下联动 </el-row>
                <el-row>
                    <el-col :span="5">
                        <el-input v-model="chooseData.Label" :disabled="true"></el-input>
                    </el-col>
                    <el-col :span="2" style="margin: 0 40px; font-size: 16px; line-height: 32px"> 联动显示 </el-col>
                    <el-col :span="10">
                        <el-select v-model="linkShow" placeholder="联动表单字段">
                            <el-option :label="itemField.Label" :value="itemField.Name" v-for="(itemField, indexField) in fieldList" :key="indexField"></el-option>
                        </el-select>
                        <span style="margin-left: 20px; font-size: 16px">的值</span>
                    </el-col>
                </el-row>

                <el-row class="bottom">
                    <el-col style="text-align: right">
                        <el-button @click="show = false">取消</el-button>
                        <el-button type="primary" @click="onSubmit">确认</el-button>
                    </el-col>
                </el-row>
            </div>
        </el-dialog>
    </div>
</template>

<script>
import qs from "qs";
export default {
    name: "DataLinkage",
    props: {
        model: {
            type: String,
            defalut: ""
        },
        fields: {
            type: Array,
            default: []
        },
        chooseData: {
            type: Object,
            default: {}
        }
    },
    data() {
        return {
            show: false,
            table: "",
            tableList: [],
            currentModel: this.model,
            https: "",
            fieldList: [],
            form: [
                {
                    field: "", // 联动表单字段
                    condition: "==", //条件
                    options: "", //当前表单字段
                    conditionList: [
                        {
                            label: "等于",
                            value: "=="
                        }
                    ]
                }
            ],
            linkShow: ""
        };
    },
    watch: {
        model: function (newVal, oldVal) {
            if (oldVal != newVal) {
                this.currentModel = newVal;
            }
        }
    },
    methods: {
        onSubmit() {
            // console.log('联动表单--',this.table)
            // console.log('满足条件--',this.form)
            // console.log('联动显示--',this.linkShow)

            var txt = "",
                dengyu = "",
                dengyuList = [];

            this.form.map((item, i) => {
                if (item.condition == "==") {
                    if (i == 0) {
                        dengyu += item.field + ":V8.Form." + item.options + ",\n";
                    } else {
                        dengyu += "  " + item.field + ":V8.Form." + item.options + ",\n";
                    }
                    dengyuList.push(item);
                }
            });

            // console.log(22222,dengyu,dengyuList)

            // SearchEqual精准搜索，Search包含的模糊搜索

            txt =
                "V8.Post('" +
                this.https +
                "/api/DiyTable/GetDiyTableRow',{\n TableId:'" +
                this.table +
                "',\n" +
                " _SearchEqual:{\n  " +
                dengyu +
                " }\n" +
                "},function(res){\n if(res.Code==1){\n  V8.Form." +
                this.chooseData.Name +
                " = res.Data[0]." +
                this.linkShow +
                "\n }\n})\n";

            var tips = {
                TableId: this.table,
                SearchEqual: dengyuList,
                show: this.linkShow
            };
            // console.log(11111,tips)
            // console.log(22222,JSON.stringify(tips))

            txt += "\n//#%#" + JSON.stringify(tips) + "#%#\n";
            // console.log(txt)

            this.$emit("update:model", txt);

            this.show = false;

            // V8.Post('/api/DiyTable/GetDiyTableRow',{
            //     TableId:this.table,
            //     _Search:{
            //         this.form.field:this.form.options,
            //     }
            // },function(data){
            //     V8.Form.this.chooseData.Name = res.Data[0].this.linkShow
            // })
        },
        changeTable(e) {
            // console.log(e)

            this.form = [
                {
                    field: "", // 联动表单字段
                    condition: "==", //条件
                    options: "", //当前表单字段
                    conditionList: [
                        {
                            label: "等于",
                            value: "=="
                        }
                    ]
                }
            ];
            this.linkShow = "";

            this.getDiyField(e);
        },
        getDiyField(id) {
            var self = this;
            this.$axios
                .post(
                    self.https + "/api/DiyField/GetDiyField",
                    qs.stringify({
                        TableId: id
                    }),
                    {
                        headers: {
                            authorization: "Bearer " + localStorage.getItem("Microi.Token"),
                            "content-type": "application/x-www-form-urlencoded",
                            did: self.newGuid()
                        }
                    }
                )
                .then(function (res) {
                    if (res.data.Code == 1) {
                        self.fieldList = res.data.Data;
                    }
                })
                .catch(function (error) {
                    console.log(error);
                });
        },
        getTable() {
            let self = this;
            this.$axios
                .post(
                    this.https + "/api/diytable/GetDiyTable",
                    qs.stringify({
                        // _PageSize: 50,
                        // _PageIndex: 1,
                        _Keyword: ""
                    }),
                    {
                        headers: {
                            authorization: "Bearer " + localStorage.getItem("Microi.Token"),
                            "content-type": "application/x-www-form-urlencoded",
                            did: this.newGuid()
                        }
                    }
                )
                .then(function (response) {
                    if (response.data.Code == 1) {
                        self.tableList = response.data.Data;
                    }
                })
                .catch(function (error) {
                    console.log(error);
                });
        },
        newGuid() {
            // Crockford's Base32字母表（无I、L、O、U）
            const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

            // 生成安全的随机字符
            function getRandomChar() {
                // 优先使用crypto API
                if (window.crypto && window.crypto.getRandomValues) {
                    const buffer = new Uint8Array(1);
                    window.crypto.getRandomValues(buffer);
                    return ENCODING[buffer[0] % 32];
                }

                // 后备方案
                const rand = Math.floor(Math.random() * 32);
                return ENCODING[rand];
            }

            // 1. 时间戳部分（10个字符，48位毫秒时间戳）
            let time = Date.now();
            let timePart = "";

            for (let i = 0; i < 10; i++) {
                const mod = time % 32;
                timePart = ENCODING[mod] + timePart;
                time = Math.floor(time / 32);
            }

            // 2. 随机部分（16个字符）
            let randomPart = "";
            for (let i = 0; i < 16; i++) {
                randomPart += getRandomChar();
            }

            return timePart + randomPart; // 26字符的ULID
            var guid = "";
            for (var i = 1; i <= 32; i++) {
                var n = Math.floor(Math.random() * 16.0).toString(16);
                guid += n;
                if (i == 8 || i == 12 || i == 16 || i == 20) guid += "-";
            }
            return guid;
        },
        // 获取系统地址
        getDiyApiBase() {
            if (localStorage.getItem("Microi.ApiBase")) {
                this.https = localStorage.getItem("Microi.ApiBase");
            } else {
                this.https = "https://api-china.itdos.com";
            }
        },
        // 添加条件
        addShowHide() {
            this.form.push({
                field: "", // 字段
                condition: "==", //条件
                options: "", //选项
                conditionList: [
                    {
                        label: "等于",
                        value: "=="
                    }
                ]
            });
        },
        // 删除
        delForm(index) {
            this.form.splice(index, 1);
        },
        // 解析传入的V8代码并赋值
        getV8() {
            if (this.model) {
                var substr = this.model.match(/(\/\/#%#=?)(\S*)(?=#%#)/)[2];
                var data = JSON.parse(substr);
                // console.log(data)
                this.table = data.TableId;
                this.form = data.SearchEqual;
                this.linkShow = data.show;
                this.getDiyField(this.table);
            }
        }
    },
    mounted() {
        this.getDiyApiBase();
        this.getTable();
        this.getV8();
    }
};
</script>

<style lang="scss" scoped>
.head {
    font-size: 16px;
    margin-bottom: 20px;
}
.bottom {
    margin-top: 40px;
}
</style>
