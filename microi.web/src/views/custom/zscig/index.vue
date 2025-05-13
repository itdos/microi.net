<template>
  <div style="newindex">
    <div class="zhuye">
      <!-- logo -->
      <div><img :src="img" alt="" style="width: 250px" /></div>
      <!-- 文字 -->
      <div v-html="content" class="wenzi"></div>
      <!-- 附件 -->
      <div>
        <a v-for="item in annex" :key="item.Id" @click="navigateToPath(item.Path)">
          <div style="cursor: pointer; color: blue; text-decoration: underline">
            {{ item.Name }}
          </div>
          <!-- <a
            href="http://116.148.228.218:1901/public/zscig/file/20231019/舟山交投招聘报名系统操作说明-1697701347.docx"
            >666</a
          > -->
          <!-- <a :href="'http://116.148.228.218:1901/public/' + item.path">1</a> -->
          <!-- http://116.148.228.218:1901/itdos-filerole/zscig/file/ -->
          <!-- http://116.148.228.218:1901/public/zscig/file/ -->
        </a>
      </div>
      <!-- 选项 -->
      <div class="checkData">
        <div style="display: flex; align-items: center">
          <span class="ziti">招聘类型</span>
          <el-select v-model="selectedValue" clearable :disabled="isDisabled" placeholder="请先选择招聘类型" @change="onRadioButtonChange">
            <el-option v-for="(item, index) in radioArray" :key="index" :label="item.label" :value="item.label"> </el-option>
          </el-select>
        </div>
        <div>
          <span class="ziti">单位</span>
          <el-select v-model="bumen" :disabled="isDisabled" clearable placeholder="然后请选择单位" @change="changeBumen">
            <el-option v-for="(item, index) in Organization" :key="index" :label="item.label" :value="item.label"> </el-option>
          </el-select>
        </div>
        <div>
          <span class="ziti">岗位名称</span>
          <el-select v-model="gangwei" clearable placeholder="最后请选择岗位" @change="changeGangwei" :disabled="isDisabled">
            <el-option v-for="item in options" :key="item.value" :label="item.label" :value="`${item.value}+${item.label}`"> </el-option>
          </el-select>
        </div>
      </div>
      <!-- 按钮 -->
      <div class="btn" @click="navigateToWodejianli" v-if="isValid">
        <!-- <router-link to="/wodejianli" class="custom-link" v-if="isValid" @click.prevent="navigateToWodejianli"> -->
        <div class="custom-link">
          <img src="http://zp.zscig.com:1280/static/zp.png" alt="" style="width: 40px" />
          <span>在线报名</span>
        </div>
        <!-- </router-link> -->
      </div>
      <div v-else @click="warning" class="btn">
        <div class="custom-link">
          <img src="http://zp.zscig.com:1280/static/zp.png" alt="" style="width: 40px" />
          <span>在线报名</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  computed: {
    isValid() {
      return this.gangwei && this.bumen && this.selectedValue;
    }
  },
  watch: {
    selectedValue(newValue, oldValue) {
      var self = this;
      if (newValue != "") {
        this.DiyCommon.Post(
          "http://116.148.228.218:1060/api/FormEngine/getTableData",
          {
            FormEngineKey: "sys_dept",
            _Where: [
              {
                Name: "ParentId",
                Value: "32fb51c3-b39a-4547-b566-e1c4d09026f6",
                Type: "="
              },
              {
                Name: "Remark",
                Value: newValue,
                Type: "="
              }
            ]
          },
          function (res) {
            if (res && res !== null) {
              self.Organization = res.Data.map((item) => ({
                value: item.Id,
                label: item.Name
              }));
            } else {
              self.Organization = [];
            }
          }
        );
      } else {
        self.Organization = [];
        self.bumen = ""; // 重置的值
      }
    }, //_Keyword: "舟山交通投资集团有限公司"
    bumen(newValue, oldValue) {
      var self = this;
      if (newValue != "") {
        this.DiyCommon.Post(
          "http://116.148.228.218:1060/api/FormEngine/getTableData",
          {
            FormEngineKey: "diy_year_position",
            _Where: [
              {
                Name: "ZhaopinGS",
                Value: newValue,
                Type: "="
              }
            ]
          },
          function (res) {
            if (res && res !== null) {
              //  console.log(res);
              self.options = res.Data.map((item) => ({
                value: item.Id,
                label: item.ZhaopinGW
              }));
            } else {
              self.options = [];
            }
          }
        );
      } else {
        self.options = [];
        self.gangwei = ""; // 重置的值
      }
    }
  },
  created() {
    this.getRecruit();
  },
  mounted() {
    this.showPictrue();
    this.isDataAlive();
  },
  data() {
    return {
      img: "",
      content: "",
      annex: [],
      radioArray: [],
      selectedValue: "",
      Organization: [],
      bumen: "",
      options: [],
      gangwei: "",
      yingpinDWId: "",
      yingpinGWId: "",
      zhuangtai: "",
      isDisabled: false
    };
  },
  methods: {
    //获取状态是否是已提交
    getId() {
      var self = this;
      this.DiyCommon.Post(
        "http://116.148.228.218:1060/api/FormEngine/getFormData",
        {
          FormEngineKey: "diy_year_position",
          _Where: [
            {
              Name: "Name",
              Value: self.bumen,
              Type: "="
            }
          ]
        },
        function (res) {
          //console.log(res.Data.ZhaopinGSID);
          self.yingpinDWId = res.Data.ZhaopinGSID;
        }
      );
    },
    navigateToWodejianli() {
      var self = this;
      self.DiyCommon.Post(
        "http://116.148.228.218:1060/api/FormEngine/getTableData",
        {
          ModuleEngineKey: "Diy_wodejianli"
        },
        function (res) {
          // console.log(res);
          // 检查响应是否成功并包含有效的链接
          if (res.DataCount == "1" && res.Data && res.Data[0].Zhuangtai == "已提交") {
            self.selectedValue = res.Data[0].ZhaopinLX;
            self.bumen = res.Data[0].YingpinDW;
            self.gangwei = res.Data[0].YingpinGW;
            var hisId = res.Data[0].Id;
            self.$router.push("/wodejianli");
            // self.$router.push(
            //   `/diy/form-page/32b21e66-8fb7-4a7d-a392-e1aeb2b9aa90/${hisId}?FormMode=View&SysMenuId=80b99847-cb0e-4dcc-a959-eac64c4738e4`
            // );
            //
          } else if (res.DataCount == 0) {
            self.DiyCommon.Post(
              "http://116.148.228.218:1060/api/FormEngine/AddFormData",
              {
                FormEngineKey: "diy_zhaopinxx",
                _RowModel: {
                  YingpinDW: self.bumen,
                  YingpinDWID: self.yingpinDWId,
                  YingpinGW: self.gangwei,
                  YingpinGWID: self.yingpinGWId,
                  ZhaopinLX: self.selectedValue
                  // LianxiDH:''
                }
              },
              function (res) {
                // 检查响应是否成功并包含有效的链接
                if (res.Code == 1) {
                  self.DiyCommon.Post(
                    "http://116.148.228.218:1060/api/FormEngine/getTableData",
                    {
                      ModuleEngineKey: "Diy_wodejianli"
                    },
                    function (res) {
                      var hisId = res.Data[0].Id;
                      // self.$router.push(
                      //   `/diy/form-page/32b21e66-8fb7-4a7d-a392-e1aeb2b9aa90/${hisId}?FormMode=View&SysMenuId=80b99847-cb0e-4dcc-a959-eac64c4738e4`
                      // );
                      self.$router.push("/wodejianli");
                    }
                  );
                }
              }
            );
          } else if (res.DataCount == "1" && res.Data && res.Data[0].Zhuangtai != "已提交") {
            var hisId = res.Data[0].Id;
            self.DiyCommon.Post(
              "http://116.148.228.218:1060/api/FormEngine/UptFormData",
              {
                FormEngineKey: "diy_zhaopinxx",
                Id: hisId,
                _RowModel: {
                  YingpinDW: self.bumen,
                  YingpinDWID: self.yingpinDWId,
                  YingpinGW: self.gangwei,
                  YingpinGWID: self.yingpinGWId,
                  ZhaopinLX: self.selectedValue
                  // LianxiDH:''
                }
              },
              function (res) {
                if (res.Code == 1) {
                  // self.$router.push(
                  //   `/diy/form-page/32b21e66-8fb7-4a7d-a392-e1aeb2b9aa90/${hisId}?FormMode=View&SysMenuId=80b99847-cb0e-4dcc-a959-eac64c4738e4`
                  // );
                  self.$router.push("/wodejianli");
                }
              }
            );
          }
        }
      );
    },
    //先去应聘表格里面获取是否存在数据，如果存在，则获取信息，否则显示为空
    isDataAlive() {
      var self = this;
      this.DiyCommon.Post(
        "http://116.148.228.218:1060/api/FormEngine/getTableData",
        {
          ModuleEngineKey: "Diy_wodejianli"
        },
        function (res) {
          //console.log(res);
          // 检查响应是否成功并包含有效的链接
          if (res.DataCount == "1" && res.Data) {
            self.selectedValue = res.Data[0].ZhaopinLX;
            self.bumen = res.Data[0].YingpinDW;
            self.gangwei = res.Data[0].YingpinGW;
            self.zhuangtai = res.Data[0].Zhuangtai;
            if (self.zhuangtai == "已提交") {
              self.isDisabled = true;
            }
          } else {
            self.isDisabled = false;
            console.log("不存在数据");
          }
        }
      );
    },
    warning() {
      this.$alert("请先填写完页面中的信息,然后才能进入填写简历", "请注意", {
        confirmButtonText: "确定",
        callback: (action) => {
          this.$message({
            type: "warning",
            message: "请完善信息"
          });
        }
      });
    },
    changeGangwei(val) {
      var gangweiData = val.split("+");
      this.yingpinGWId = gangweiData[0];
      this.gangwei = gangweiData[1];
      //console.log(this.gangwei);
    },
    changeBumen(val) {
      //console.log(val);
      this.getId();
      // console.log(this.bumen);
    },
    //获取招聘方式
    onRadioButtonChange(val) {
      // console.log(val);
    },
    //获取招聘类型
    getRecruit() {
      var self = this;
      this.DiyCommon.Post(
        "http://116.148.228.218:1060/api/diytable/getDiyTableRowTree",
        {
          ModuleEngineKey: "663bb061-d159-47ce-9cc8-0aa2b13e601b"
        },
        function (res) {
          // 检查响应是否成功并包含有效的链接
          if (res.Code == "1" && res.Data) {
            self.radioArray = res.Data[1]._Child[0]._Child.map((item) => ({
              value: item.Value,
              label: item.Value
            }));
          } else {
            console.error("招聘类型获取失败");
          }
        }
      );
    },
    navigateToPath(path) {
      var self = this;
      // this.DiyCommon.Post(
      //   "http://116.148.228.218:1060/api/HDFS/GetPrivateFileUrl",
      //   {
      //     FilePathName: path,
      //     HDFS: "MinIO",
      //     FormEngineKey: "Diy_Notice",
      //     FormDataId: "90268028-d907-4da0-b567-97263952c740",
      //     FieldId: "8a883732-99f5-4afd-92ff-8820961e9148",
      //   },
      //   function (res) {
      //     try {
      //       // 检查响应是否成功并包含有效的链接
      //       if (res.Code == "1" && res.Data) {
      //         // 使用 window.location.href 跳转到下载链接
      //         console.log(res);
      //         window.location.href = res.Data;
      //       } else {
      //         console.error("无法获取下载链接");
      //         // 在这里添加报错提醒逻辑，例如显示错误信息提示给用户
      //         // 可以使用框架的弹窗组件或者自定义的错误提示样式
      //       }
      //     } catch (error) {
      //       console.error("发生错误:", error);
      //       // 在这里添加报错提醒逻辑，例如显示错误信息提示给用户
      //       // 可以使用框架的弹窗组件或者自定义的错误提示样式
      //     }
      //   }
      // );
      //http://116.148.228.218:1901/public/
      window.location.href = "http://116.148.228.218:1901/public" + path;
    },
    showPictrue() {
      var self = this;
      this.DiyCommon.Post(
        "http://116.148.228.218:1060/api/FormEngine/getTableData",
        {
          ModuleEngineKey: "Diy_Notice"
        },
        function (res) {
          self.content = res.Data[0].Neirong;
          self.img = "http://116.148.228.218:1901/public/" + res.Data[0].TupianYL;

          self.annex = JSON.parse(res.Data[0].Fujian);
        }
      );
    }
  }
};
</script>

<style lang="scss" scoped>
.checkData {
  display: flex;
  align-items: center;
  justify-content: space-evenly;
  width: 100%;
}
.newindex {
  background-color: white;
}
.btn {
  width: 160px;
  padding: 20px 10px;
  box-shadow: rgb(221, 221, 221) 0px 10px 10px;
  margin: 0px auto;
  border-radius: 15px;
  background: rgb(246, 246, 246);
}
.zhuye {
  background-color: white;
  height: 85vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-evenly;
  // padding: 10vw;
}
.wenzi {
  font-size: 16px;
  font-weight: bold;
  width: 50vw;
  text-indent: 4ch;
}
.ziti {
  font-size: 16px;
  margin-right: 10px;
}
</style>
