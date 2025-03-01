# 表单引擎

## 前言

在实际的表单开发中，往往低代码平台的组件库并不能满足所有需求
因此Microi吾码提供了两种方式来解决这个问题：一种是通过【定制组件】、另一种是通过【扩展组件库】
先看示例：

## 示例一（定制组件）

客户提出需求：需要在客户详情顶部显示数据统计、并且点击每个统计后页面自动往下滚动到对应子表位置

![定制组件](/api_plugins/form01.png)

## 示例二（定制组件）

房源信息有两个特殊的组件：1、要选择几室几厅几位
2、选择了小区后需要获取小区的所有楼栋、选择楼栋后下面的所有单元、选择单元后下面的所有房号

![定制组件](/api_plugins/form02.png)

## 实现步骤

1. 到 `Microi吾码` 框架源码中创建一个定制 `vue` 组件
如：/src/views/custom/xjy/components/kehu-childtable-class.vue

```html
<template>
    <div class="xjy-kehu-childtable-class">
        <div class="item" style="
                color: rgb(255, 163, 96);
                background: rgba(255, 163, 96, 0.2);
                border-top: 2px solid rgb(255, 163, 96);
            " @click="scrollIntoView('.field_LianxiRLine')">
            <i class="el-icon-s-custom"></i>
            <div class="info">
                <p>
                    <strong>{{ ReportData.LianxirenCount }}</strong>
                </p>
                <p>联系人</p>
            </div>
        </div>
        <div class="item" style="
                color: rgb(65, 181, 132);
                background: rgba(65, 181, 132, 0.2);
                border-top: 2px solid rgb(65, 181, 132);
            " @click="scrollIntoView('.field_GenjinJLLine')">
            <i class="el-icon-refresh"></i>
            <div class="info">
                <p>
                    <strong>{{ ReportData.GenjinCount }}</strong>
                </p>
                <p>跟进</p>
            </div>
        </div>
        <div class="item" style="
                color: rgb(113, 166, 255);
                background: rgba(113, 166, 255, 0.2);
                border-top: 2px solid rgb(113, 166, 255);
            " @click="scrollIntoView('.field_ShangjiLine')">
            <i class="el-icon-data-line"></i>
            <div class="info">
                <p>
                    <strong>{{ ReportData.ShangjiCount }}</strong>
                </p>
                <p>商机</p>
            </div>
        </div>
        <div class="item" style="
                color: rgb(255, 113, 113);
                background: rgba(255, 113, 113, 0.2);
                border-top: 2px solid rgb(255, 113, 113);
            " @click="scrollIntoView('.field_DingdanLB')">
            <i class="el-icon-message-solid"></i>
            <div class="info">
                <p>
                    <strong>{{ ReportData.DingdanCount }}</strong>
                </p>
                <p>订单</p>
            </div>
        </div>
        <div class="item" style="
                color: rgb(96, 130, 255);
                background: rgba(96, 130, 255, 0.2);
                border-top: 2px solid rgb(96, 130, 255);
            " @click="scrollIntoView('.field_Shebei')">
            <i class="el-icon-s-help"></i>
            <div class="info">
                <p>
                    <strong>{{ ReportData.ShebeiCount }}</strong>
                </p>
                <p>设备</p>
            </div>
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
            default: () => { },
        },
    },
    watch: {
        //监听数据变化，切换小区时要重新获取楼栋，其它信息置空
        DataAppend: function (newVal, oldVal) {
            var self = this;
            self.KehuClassReport();
        },
    },
    data() {
        return {
            ReportData: {
                LianxirenCount: "...",
                GenjinCount: "...",
                ShangjiCount: "...",
                ShebeiCount: "...",
                DingdanCount: "...",
            },
        };
    },
    mounted() {
        var self = this;
        self.KehuClassReport();
    },
    methods: {
        KehuClassReport() {
            var self = this;
            if (self.DataAppend.KehuID) {
                self.Microi.DataSourceEngine.Run(
                    "kehu_childtable_report",
                    {
                        Id: self.DataAppend.KehuID,
                    },
                    function (result) {
                        if (self.Microi.CheckResult(result)) {
                            self.ReportData = result.Data;
                        }
                    }
                );
            }
        },
        scrollIntoView(traget) {
            const tragetElem = document.querySelector(traget);
            const tragetElemPostition = tragetElem.offsetTop;
            // 判断是否支持新特性
            if (
                typeof window.getComputedStyle(document.body).scrollBehavior ==
                "undefined"
            ) {
                // 当前滚动高度
                let scrollTop =
                    document.documentElement.scrollTop ||
                    document.body.scrollTop;
                // 滚动step方法
                const step = function () {
                    // 距离目标滚动距离
                    let distance = tragetElemPostition - scrollTop;

                    // 目标需要滚动的距离，也就是只走全部距离的五分之一
                    scrollTop = scrollTop + distance / 5;
                    if (Math.abs(distance) < 1) {
                        window.scrollTo(0, tragetElemPostition);
                    } else {
                        window.scrollTo(0, scrollTop);
                        setTimeout(step, 20);
                    }
                };
                step();
            } else {
                tragetElem.scrollIntoView({
                    behavior: "smooth",
                    inline: "nearest",
                });
            }
        },
    },
};
</script>
<style lang="scss">
</style>

```
2. 表单设计拖入一个【定制组件】并填写组件路径

![定制组件](/api_plugins/form03.png)


3. 发布前端项目即可