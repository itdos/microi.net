<template>
    <el-dialog :visible.sync="dialogShow" width="50%" :before-close="handleClose" append-to-body>
        <div slot="title" style="display: flex; align-items: center">
            <el-input style="width: 200px" v-model="searchIcon" placeholder="请输入内容" @input="changeSearchIcon">
                <!-- @click="handleIconClick" -->
                <i class="el-icon-search el-input__icon" slot="suffix"></i>
            </el-input>
            <div v-if="showIcon" style="margin-left: 20px">
                <span>当前选择：</span>
                <i :class="className"></i>
            </div>
        </div>
        <el-row v-show="!searchIcon" class="list-box">
            <template v-for="item in iconList">
                <el-col v-if="item" :key="item.className" :xs="12" :sm="8" :md="6" :lg="4" :xl="3" class="w-icon" @click.native="chooseIcon(item)" :class="className == item.className ? 'active' : ''">
                    <div class="icon-box">
                        <i :class="item.className" style="font-size: 48px"></i>
                    </div>
                    <span class="text">{{ item.name }}</span>
                    <!-- <span class="text">{{item}}</span> -->
                </el-col>
            </template>
        </el-row>

        <el-row v-if="searchIcon" class="list-box">
            <template v-for="item in searchList">
                <el-col
                    v-if="item"
                    :key="item.className + 'search'"
                    :xs="12"
                    :sm="8"
                    :md="6"
                    :lg="4"
                    :xl="3"
                    class="w-icon"
                    @click.native="chooseIcon(item)"
                    :class="className == item.className ? 'active' : ''"
                >
                    <div class="icon-box">
                        <i :class="item.className" style="font-size: 48px"></i>
                    </div>
                    <span class="text">{{ item.name }}</span>
                </el-col>
            </template>
        </el-row>
        <el-pagination
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
            :current-page.sync="currentPage"
            :page-size="pageSize"
            layout="total, prev, pager, next"
            :total="total"
        ></el-pagination>
        <span slot="footer" class="dialog-footer">
            <el-button @click="close">取 消</el-button>
            <el-button type="primary" @click="confirm">确 定</el-button>
        </span>
    </el-dialog>
</template>

<script>
import { fontawesomeList, fuzzyQuery, listPage } from "./data.js";
import "@fortawesome/fontawesome-free/css/all.css";
import "@fortawesome/fontawesome-free/js/all.js";

export default {
    name: "fontawesome",
    data() {
        return {
            currentPage: 1,
            pageSize: 48,
            total: fontawesomeList.length,
            dialogShow: false,
            searchIcon: "",
            className: "",
            arr: [],
            showIcon: false
        };
    },
    computed: {
        iconList() {
            return listPage(fontawesomeList, this.currentPage, this.pageSize);
        },
        searchList() {
            return listPage(this.arr, this.currentPage, this.pageSize);
        }
    },
    props: {
        model: {
            type: String,
            defalut: ""
        }
    },
    methods: {
        show() {
            this.dialogShow = true;
            this.className = this.model;
            this.showIcon = this.model ? true : false;
        },
        changeSearchIcon() {
            this.currentPage = 1;
            if (this.searchIcon) {
                this.arr = fuzzyQuery(fontawesomeList, this.searchIcon);
                this.total = this.arr.length;
            } else {
                this.arr = [];
                this.total = fontawesomeList.length;
            }
        },
        // handleIconClick(ev) {
        //   this.changeSearchIcon();
        //   console.log(ev);
        // },
        handleClose(done) {
            done();
            // this.$confirm("确认关闭？")
            //   .then((_) => {
            //     done();
            //   })
            //   .catch((_) => {});
        },
        chooseIcon(item) {
            console.log(item);
            this.showIcon = false;
            this.className = JSON.parse(JSON.stringify(item.className));
            this.$nextTick(() => {
                this.showIcon = true;
            });
        },
        confirm() {
            this.$emit("update:model", this.className);
            // 使用 $nextTick 确保 DOM 更新后再关闭
            this.$nextTick(() => {
                this.close();
            });
        },
        initData() {
            (this.currentPage = 1), (this.pageSize = 48), (this.total = fontawesomeList.length), (this.searchIcon = ""), (this.className = ""), (this.arr = []), (this.showIcon = false);
        },
        close() {
            this.initData();
            this.dialogShow = false;
        },
        handleSizeChange(val) {
            this.pageSize = val;
        },
        handleCurrentChange(val) {
            this.currentPage = val;
        }
    }
};
</script>

<style lang="scss">
.list-box {
    // display: flex;
    // flex-wrap: wrap;
    height: 610px;
    overflow: auto;
}
.w-icon {
    height: 100px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-bottom: 10px;
    overflow: hidden;
    &.active {
        box-shadow: 0px 1px 1px 0px rgba(0, 0, 0, 0.5);
        color: #fff !important;
        .icon-box {
            background-color: #409eff;
        }
    }
    .icon-box {
        width: 100%;
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 8px 0;
        cursor: pointer;
        &:hover {
            background-color: #409eff;
            color: #fff;
        }
    }
    &:hover {
        box-shadow: 0px 1px 1px 0px rgba(0, 0, 0, 0.5);
    }
    span {
        font-size: 12px;
        color: #999;
        padding: 4px 8px;
        text-overflow: -o-ellipsis-lastline;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
    }
}
</style>
