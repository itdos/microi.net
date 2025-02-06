<template>
    <div class="input-group input-group-sm input-group-selects">
        <!-- <div>按钮</div> -->
        <el-dialog>
            <!--这里是你的签字定制实现-->
        </el-dialog>
        <el-select
            class="custom-select"
            placeholder=""
            value-key="Id"
            v-model="Dong"
            :disabled="DiyCommon.IsNull(XiaoquID)"
            @change="SelectDong"
        >
            <el-option
                :value="dong"
                :label="dong.Name"
                v-for="(dong, i) in DongList"
                :key="'Dong_' + i"
            >
            </el-option>
        </el-select>
        <div class="input-group-append">
            <span class="input-group-text">栋</span>
        </div>

        <el-select
            class="custom-select center"
            placeholder=""
            value-key="Id"
            v-model="Danyuan"
            :disabled="DiyCommon.IsNull(Dong)"
            @change="SelectDanYuan"
        >
            <el-option
                :label="item.DanyuanMC"
                :value="item"
                v-for="(item, i) in DanyuanData"
                :key="'dangyuan_' + i"
            >
            </el-option>
        </el-select>
        <div class="input-group-append">
            <span class="input-group-text">单元</span>
        </div>

        <el-select
            class="custom-select center"
            placeholder=""
            value-key="Id"
            v-model="Lou"
            :disabled="DiyCommon.IsNull(Danyuan)"
            @change="SelectLouCeng"
        >
            <el-option
                :label="item.LoucengMC"
                :value="item"
                v-for="(item, i) in LouData"
                :key="'Lou_' + i"
            ></el-option>
        </el-select>
        <div class="input-group-append">
            <span class="input-group-text">楼</span>
        </div>

        <el-select
            class="custom-select center"
            value-key="Id"
            placeholder=""
            v-model="Fanghao"
            :disabled="DiyCommon.IsNull(Lou)"
            @change="SelectFangHao"
        >
            <el-option
                :label="item.Fanghao"
                :value="item"
                v-for="(item, i) in FanghaoData"
                :key="'Fanghao_' + i"
            ></el-option>
        </el-select>
        <div class="input-group-append">
            <span class="input-group-text">室</span>
        </div>
        <div>
            <el-button @click="RefresfTable">测试使用V8刷新表格</el-button>
        </div>
    </div>
</template>

<script>
export default {
    name: "loudong",
    props: {
        /**
         * 固定接收数据的对象，由V8代码传过来
         */
        DataAppend: {
            type: Object,
            default: () => ({
                t: 1,
            }),
        },
    },
    watch: {
        //监听数据变化，切换小区时要重新获取楼栋，其它信息置空
        DataAppend: {
            handler(newVal, oldVal) {
                var self = this;
                //置空已选择的数据
                self.Dong = "";
                self.DongList = [];
                self.Danyuan = "";
                self.DanyuanData = [];
                self.Lou = "";
                self.LouData = [];
                self.Fanghao = "";
                self.FanghaoData = [];
                //---END

                if (!self.DiyCommon.IsNull(newVal)) {
                    if (!self.DiyCommon.IsNull(newVal.HourseDirId)) {
                        //根据楼盘字段Id，重新获取所有楼栋
                        self.GetDong(newVal.HourseDirId);
                    }
                    if (!self.DiyCommon.IsNull(newVal.Dong)) {
                        self.Dong = newVal.Dong;
                    }
                    if (!self.DiyCommon.IsNull(newVal.Danyuan)) {
                        self.Danyuan = newVal.Danyuan;
                    }
                    if (!self.DiyCommon.IsNull(newVal.Louceng)) {
                        self.Lou = newVal.Louceng;
                    }
                    if (!self.DiyCommon.IsNull(newVal.Fanghao)) {
                        self.Fanghao = newVal.Fanghao;
                    }
                }
            },
            deep: true,
        },
    },
    data() {
        return {
            Dong: "",
            DongList: [],
            Danyuan: "",
            DanyuanData: [],
            Lou: "",
            LouData: [],
            Fanghao: "",
            FanghaoData: [],
            XiaoquID: "",
        };
    },
    beforeCreate() {
        // var self = this;
        // console.log("self.DataAppend;1", JSON.stringify(this.DataAppend));
    },
    created() {
        var self = this;
        console.log("self.DataAppend;1", JSON.stringify(self.DataAppend));
    },
    mounted() {
        var self = this;

        console.log("self.DataAppend;2", JSON.stringify(self.DataAppend));

        var self = this;
        console.log(3444);
        var self = this;
        //置空已选择的数据
        self.Dong = "";
        self.DongList = [];
        self.Danyuan = "";
        self.DanyuanData = [];
        self.Lou = "";
        self.LouData = [];
        self.Fanghao = "";
        self.FanghaoData = [];
        //---END
        var newVal = self.DataAppend;
        if (!self.DiyCommon.IsNull(newVal)) {
            if (!self.DiyCommon.IsNull(newVal.HourseDirId)) {
                //根据楼盘字段Id，重新获取所有楼栋
                self.GetDong(newVal.HourseDirId);
            }
            if (!self.DiyCommon.IsNull(newVal.Dong)) {
                self.Dong = newVal.Dong;
            }
            if (!self.DiyCommon.IsNull(newVal.Danyuan)) {
                self.Danyuan = newVal.Danyuan;
            }
            if (!self.DiyCommon.IsNull(newVal.Louceng)) {
                self.Lou = newVal.Louceng;
            }
            if (!self.DiyCommon.IsNull(newVal.Fanghao)) {
                self.Fanghao = newVal.Fanghao;
            }
        }
    },
    methods: {
        RefresfTable() {
            var self = this;
            self.DataAppend.V8.RefreshTable();
            self.DataAppend.V8.CloseThisDialog();
        },
        SelectDong(val) {
            var self = this;
            //重新选择了楼栋后，需要将已选择的单元、楼层、房号信息清空
            self.Danyuan = "";
            self.DanyuanData = [];
            self.Lou = "";
            self.LouData = [];
            self.Fanghao = "";
            self.FanghaoData = [];
            //-----END

            //重新获取该楼栋下的单元信息
            self.GetDanYuan();

            //回写表单字段值
            self.$emit("FormSet", "DongID", val.Id);
            self.$emit("FormSet", "Dong", self.Dong.Name);
        },
        SelectDanYuan(val) {
            var self = this;
            //重新选择了单元后，需要将已选择的楼层、房号信息清空
            self.Lou = "";
            self.LouData = [];
            self.Fanghao = "";
            self.FanghaoData = [];
            //-----END

            //重新获取该单元下的楼层信息
            self.GetLouCeng();

            //回写表单字段值
            self.$emit("FormSet", "DanyuanID", val.Id);
            self.$emit("FormSet", "Danyuan", self.Danyuan.DanyuanMC);
        },
        SelectLouCeng(val) {
            var self = this;
            //重新选择了楼层后，需要将已选择的房号信息清空
            self.Fanghao = "";
            self.FanghaoData = [];
            //-----END

            //重新获取该楼层下的房号信息
            self.GetFangHao();

            //回写表单字段值
            self.$emit("FormSet", "Louceng", val.LoucengMC);
        },
        SelectFangHao(val) {
            var self = this;
            //回写表单字段值
            self.$emit("FormSet", "FanghaoID", val.Id);
            self.$emit("FormSet", "Fanghao", val.Fanghao);
        },
        GetDong(xiaoquId) {
            var self = this;
            self.XiaoquID = xiaoquId;
            //改成模拟数据，不从接口获取
            self.DongList = [
                { Id: "1", Name: "A" },
                { Id: "2", Name: "B" },
            ];
            // self.DiyCommon.GetDiyTableRow({
            //     TableId: 'f3b7f939-1ada-406a-8f05-56b43a618a95',
            //     _SearchEqual: {
            //         XiaoquID: xiaoquId
            //     },
            //     _OrderBy: "Name",
            //     _OrderByType: "asc",
            // }, function (data) {
            //     self.DongList = data;
            // });
        },
        GetDanYuan() {
            var self = this;
            //改成模拟数据，不从接口获取
            self.DanyuanData = [
                { Id: "1", DanyuanMC: "1" },
                { Id: "2", DanyuanMC: "2" },
            ];
            // self.DiyCommon.GetDiyTableRow({
            //     TableId: 'b742e8ba-d8c8-4ca5-8748-3eca6a43c8a4',
            //     _SearchEqual: {
            //         XiaoquID: self.XiaoquID,
            //         LoudongID: self.Dong.Id,
            //     },
            //     _OrderBy: "DanyuanMC",
            //     _OrderByType: "asc",
            // }, function (data) {
            //     self.DanyuanData = data;
            // });
        },
        GetLouCeng() {
            var self = this;
            //改成模拟数据，不从接口获取
            self.LouData = [
                { Id: "1", LoucengMC: "2" },
                { Id: "2", LoucengMC: "1" },
                { Id: "3", LoucengMC: "-1" },
            ];
            // self.DiyCommon.GetDiyTableRow({
            //     TableId: '0cca953e-0611-4806-ab81-a316be53aa91',
            //     _SearchEqual: {
            //         SuoshuXQID: self.XiaoquID,
            //         DanyuanID: self.Danyuan.Id,
            //     },
            //     _OrderBy: 'LoucengMC',
            //     _OrderByType: 'asc',
            // }, function (data) {
            //     self.LouData = data;
            // });
        },
        GetFangHao() {
            var self = this;
            //改成模拟数据，不从接口获取
            self.FanghaoData = [
                { Id: "1", Fanghao: "101" },
                { Id: "2", Fanghao: "102" },
            ];
            // self.DiyCommon.GetDiyTableRow({
            //     TableId: '59656e41-ccbe-4501-bbc3-e6c14acf1414',
            //     _SearchEqual: {
            //         XiaoquID: self.XiaoquID,
            //         DanyuanID: self.Danyuan.Id,
            //         SuoshuLC: self.Lou.LoucengMC
            //     },
            //     _OrderBy: 'Fanghao',
            //     _OrderByType: 'asc',
            // }, function (data) {
            //     self.FanghaoData = data;
            // });
        },
    },
};
</script>

<style lang="scss">
// scoped 也可以使用scoped，然后使用 /deep/
.input-group-selects {
    .first {
        border-top-right-radius: 0px !important;
        border-bottom-right-radius: 0px !important;
    }

    .center {
        border-radius: 0px !important;
        border-left: none !important;
    }

    .custom-select {
        width: 1% !important;
        background-image: none;
        .el-input--suffix {
            position: absolute;
            left: 0;
            top: 0;
            .el-input__inner {
                border: none !important;
            }
        }
    }

    .input-group-sm > .input-group-append > .input-group-text {
        padding: 0 0.5rem;
    }
    .input-group-sm > .custom-select {
        height: 30px;
    }
}
</style>
