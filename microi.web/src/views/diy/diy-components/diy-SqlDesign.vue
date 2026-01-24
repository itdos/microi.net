<template>
    <div>
        <el-button style="margin-bottom: 10px" type="primary" @click="linkForm">SQL设计器</el-button>

        <el-dialog v-model="showForm" width="60%" :destroy-on-close="true" :modal-append-to-body="false" append-to-body :close-on-click-modal="false">
            <template #title>
                <span class="headTitle">SQL设计器</span>
            </template>

            <el-form :model="form" :rules="rules" ref="ruleForm" label-width="100px" class="demo-ruleForm">
                <el-form-item label="选择表单" prop="table">
                    <el-select v-model="form.table" filterable placeholder="请选择" style="width: 100%" @change="changeTable">
                        <el-option v-for="item in tableList" :key="item.Name" :label="item.Description" :value="item.Name"> </el-option>
                    </el-select>
                </el-form-item>
                <el-form-item label="选择字段" prop="ziduan">
                    <el-select v-model="form.ziduan" multiple filterable placeholder="请选择" style="width: 100%">
                        <el-option v-for="item in fieldList" :key="item.Name" :label="item.Label" :value="item.Name"> </el-option>
                    </el-select>
                </el-form-item>
                <el-form-item label="是否已删除" prop="isDelete">
                    <el-select v-model="form.isDelete" filterable placeholder="请选择" style="width: 100%">
                        <el-option label="未删除" value="0"></el-option>
                        <el-option label="已删除" value="1"></el-option>
                        <el-option label="全显示" value="2"></el-option>
                    </el-select>
                </el-form-item>
                <el-form-item label="" prop="">
                    <el-button type="primary" @click="save">生成sql</el-button>
                    <el-button style="margin-left: 40px" @click="reset">重置选择</el-button>
                </el-form-item>
                <el-form-item label="生成结果" prop="">
                    <div class="CodeMirror-code">
                        <codemirror ref="cmObj" v-model="SQLcode" :options="cmOptions" />
                    </div>
                </el-form-item>
            </el-form>

            <template #footer>
                <el-button @click="showForm = false">取 消</el-button>
                <el-button type="primary" @click="submit">确 定</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script>
import qs from "qs";
// vue-codemirror 暂不支持 Vue 3
// import "codemirror/lib/codemirror.css";
// import { codemirror } from "vue-codemirror";
// require("codemirror/mode/javascript/javascript.js");
export default {
    name: "DiySqlDesign",
    components: {
        // codemirror  // 已禁用
    },
    props: {
        model: {
            type: String,
            defalut: ""
        }
    },
    watch: {
        model: function (newVal, oldVal) {
            if (oldVal != newVal) {
                this.SQLcode = newVal;
            }
        }
    },
    data() {
        return {
            SQLcode: this.model,
            showForm: false,
            tableList: [],
            fieldList: [],
            form: {
                table: "",
                ziduan: "",
                isDelete: ""
            },
            https: "",
            cmOptions: {
                // 所有参数配置见：https://codemirror.net/doc/manual.html#config
                tabSize: 4,
                styleActiveLine: true,
                lineNumbers: true,
                line: true,
                foldGutter: true,
                styleSelectedText: true,
                mode: "text/x-sparksql",
                // keyMap: "sublime",
                matchBrackets: true,
                showCursorWhenSelecting: true,
                // theme: 'base16-dark',
                extraKeys: {
                    Ctrl: "autocomplete"
                },
                hintOptions: {
                    completeSingle: false
                },
                lineWrapping: true // 自动换行
            },
            rules: {}
        };
    },
    methods: {
        reset() {
            this.$refs["ruleForm"].resetFields();
            this.fieldList = [];
        },
        linkForm() {
            this.showForm = true;
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
        changeTable(e) {
            // console.log(e)
            this.fieldList = [];
            this.form.ziduan = "";
            var self = this;

            var aa = "";
            this.tableList.map((item) => {
                if (item.Name == e) {
                    aa = item.Id;
                }
            });

            this.$axios
                .post(
                    self.https + "/api/DiyField/GetDiyField",
                    qs.stringify({
                        TableId: aa
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
        // 生成sql
        save() {
            // console.log(3333333,this.form)

            var txt = "",
                aa = "";
            if (this.form.isDelete == "0") {
                aa = "IsDeleted=0";
            } else if (this.form.isDelete == "1") {
                aa = "IsDeleted=1";
            } else {
                aa = "";
            }

            txt = "SELECT " + this.form.ziduan + " FROM " + this.form.table + (aa == "" ? "" : " WHERE " + aa);

            this.SQLcode = txt;
        },
        // 最后确认提交
        submit() {
            this.$refs["ruleForm"].validate((valid) => {
                if (valid) {
                    // console.log(1111111,'提交')
                    this.$emit("update:model", this.SQLcode);
                    this.showForm = false;
                }
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
        }
    },
    mounted() {
        this.getDiyApiBase();
        this.getTable();
    }
};
</script>

<style lang="scss" scoped>
.headTitle {
    color: #1f2d3d;
    margin-right: 20px;
}
.subTitle {
    font-size: 14px;
    color: #91a1b7;
}
.head {
    font-size: 16px;
}
</style>
