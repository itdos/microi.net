<template>
    <div class="qrcode-container">
        <!-- <el-button type="primary" @click="handleButtonClick('generate', dataAppend)">生成二维码</el-button> -->
        <el-button type="success" @click="handleButtonClick('download', dataAppend)" :disabled="!imageBase64">下载二维码</el-button>
        <!-- <div v-if="dataAppend && Array.isArray(dataAppend.fields) && dataAppend.Code">
      <img v-if="imageBase64" :src="imageBase64" alt="二维码" class="pic">
    </div> -->
        <div ref="capture" class="qrcode-content" v-if="dataAppend && Array.isArray(dataAppend.fields) && dataAppend.Code">
            <div class="title">{{ dataAppend.title }}:{{ dataAppend.titleValue }}</div>
            <div class="qrcode-box">
                <div ref="qrcode" class="qrcode-image"></div>
                <div v-for="(item, index) in dataAppend.fields" :key="index">
                    <div class="text">{{ item.Label }}{{ item.Value }}</div>
                </div>
            </div>
            <div class="title"></div>
        </div>
    </div>
</template>

<script>
import QRCode from "qrcodejs2";
import html2canvas from "html2canvas";
import FileSaver from "file-saver"; // 用于文件下载

export default {
    name: "QrCodeGenerator",
    props: {
        dataAppend: {},
        ModelProps: {},
        field: {
            type: Object,
            default() {
                return {};
            }
        },
        DiyTableModel: {
            type: Object,
            default() {
                return {};
            }
        },
        FormDiyTableModel: {
            type: Object,
            default() {
                return {};
            }
        },
        //表单模式Add、Edit、View
        FormMode: {
            type: String,
            default: "" //View
        },
        // ['FieldName1','FieldName2']
        ReadonlyFields: {
            type: Array,
            default: () => []
        },
        FieldReadonly: {
            type: Boolean,
            default: null
        },
        TableInEdit: {
            type: Boolean,
            default: false
        },
        TableId: {
            type: String,
            default: "" //View
        }
    },
    watch: {
        dataAppend: {
            handler() {
                this.$nextTick(() => {
                    setTimeout(() => {
                        this.generateQRCode();
                        this.captureScreen();
                    }, 300);
                });
            },
            deep: true,
            immediate: true
        }
    },
    data() {
        return {
            imageBase64: ""
        };
    },
    methods: {
        handleButtonClick(type, value) {
            // if (type == 'generate') {
            //   this.generateQRCode();
            // }
            if (type == "download") {
                this.downloadQRCode();
            }
        },
        updateValue(newValue) {
            this.$emit("input", newValue);
        },
        generateQRCode() {
            console.log("进入2333");
            if (!this.dataAppend.Code) return;
            // 清空已有二维码，防止坍塌
            if (this.$refs.qrcode) {
                this.$refs.qrcode.innerHTML = "";
            }
            this.$nextTick(() => {
                new QRCode(this.$refs.qrcode, {
                    text: this.dataAppend.Code,
                    width: 260,
                    height: 260,
                    colorDark: this.dataAppend.Color,
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
            });
            // 自动更新 v-model 绑定的值
            this.$emit("input", this.imageBase64);
        },

        downloadQRCode() {
            if (!this.imageBase64) return;
            const fileName = `${this.dataAppend.fileName || "qrcode"}${this.dataAppend.createTime ? "-" + Date.now() : ""}.png`;
            FileSaver.saveAs(this.imageBase64, fileName);
        },

        captureScreen() {
            if (!this.dataAppend.Code && this.FormMode !== "Add") {
                this.$message.error("请先配置二维码信息");
                return;
            }
            this.$nextTick(() => {
                setTimeout(() => {
                    html2canvas(this.$refs.capture).then((canvas) => {
                        this.imageBase64 = canvas.toDataURL("image/png");
                        this.$emit("send-data", this.imageBase64);
                        this.updateValue(this.imageBase64); // 更新 v-model
                    });
                }, 300);
            });
        },
        //必须
        // Init() {
        //   var self = this;
        //   self.ModelValue = self.GetFieldValue(self.field, self.FormDiyTableModel);
        //   self.LastModelValue = self.GetFieldValue(self.field, self.FormDiyTableModel);
        // },
        // GetFieldValue(field, form) {
        //   var self = this;
        //   if (!self.DiyCommon.IsNull(field.AsName)) {
        //     return form[field.AsName];
        //   }
        //   return form[field.Name];
        // },
        // //必须
        // ModelChangeMethods() {
        //   var self = this;
        //   self.$emit("ModelChange", self.ModelValue);
        // },
        // IconClick() {
        //   var self = this;
        //   self.SelectField(self.field);
        //   if (self.GetFieldReadOnly(self.field) || self.FormMode == 'View') {
        //     return;
        //   }
        //   self.$refs['control_' + self.field.Name].show()
        // },
        GetFieldReadOnly(field) {
            var self = this;
            if (self.FieldReadonly == true) {
                return true;
            }
            //如果按钮设置了预览可点击
            //并且按钮Readonly属性不为true，
            //并且ReadonlyFields不包含此字段
            //则返回false(不禁用)
            // if(field.Component == 'Button'
            //     // && field.Config.Button.PreviewCanClick === true
            //     && !field.Readonly
            //     && !(self.ReadonlyFields.indexOf(field.Name) > -1)){
            //     return false;
            // }

            if (self.FormMode == "View") {
                return true;
            }
            if (self.ReadonlyFields.indexOf(field.Name) > -1) {
                return true;
            }
            return field.Readonly ? true : false;
        }
        // SelectField(field) {
        //   var self = this
        //   self.$emit('CallbackSelectField', field)
        // },
    }
};
</script>

<style scoped>
.qrcode-container {
    /* height: 530px; */
}

.qrcode-content {
    width: 400px;
    /* height: 545px; */
    /* position: absolute;
  left: 0; */
    margin-top: 20px;
    z-index: 1;
    /* margin-left: -1000px; */
}

.title {
    text-align: center;
    font-size: 24px;
    color: #fff;
    background-color: #3161a6;
    padding: 16px 0;
}

.qrcode-box {
    padding: 25px 70px;
    border: 1px solid #3161a6;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}

.qrcode-image {
    width: 260px;
    /* height: 260px; */
    min-height: 260px;
    /* 防止截图时高度塌陷 */
    display: flex;
    align-items: center;
    justify-content: center;
}

.text {
    font-size: 20px;
    padding: 5px 0;
}

.pic {
    margin-top: 20px;
}
</style>
