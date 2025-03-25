# カスタムコンポーネント
## 前書き
>* 実際のフォーム開発では、多くの場合、低コードプラットフォームのコンポーネントライブラリはすべてのニーズを満たすことができない
>* そのため、Microi吾コードはこの問題を解決する2つの方法を提供しています。1つは【 ** カスタムコンポーネント ** 】、もう1つは【 ** 拡張コンポーネントライブラリ】 **
>* まず例を見てみましょう
## 例1 (カスタムコンポーネント)
> お客様のニーズ: お客様の詳細の一番上にデータ統計を表示し、各統計をクリックすると、ページが自動的に対応するサブテーブルの位置までスクロールします

![ここに画像の説明を挿入します](https://static.itdos.com/upload/img/csdn/a1db402363594f9bb04a65a196aa9fd4.png#pic_center)
## 例2 (カスタムコンポーネント)
> 房源情報には二つの特殊なコンポーネントがある: 1、何室何庁何人かを選ぶ
> 2、セルを選択すると、セルのすべての建物、建物を選択すると下のすべてのユニット、ユニットを選択すると下のすべての部屋番号を取得する必要があります

![ここに画像の説明を挿入します](https://static.itdos.com/upload/img/csdn/16f0262046f24b529b681eae924c8c53.png#pic_center)

## 実現手順
## 1.Microi吾コードフレームワークソースにカスタムvueコンポーネントを作成する
> 例:/src/views/custom/xjy/components/kehu-childtable-class.vue
```javascript
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
## 2.フォームデザインを「カスタムコンポーネント」にドラッグし、コンポーネントパスを入力します
![ここに画像の説明を挿入します](https://static.itdos.com/upload/img/csdn/8e853444d60145ae8a182324320c8cb5.png#pic_center)
## 3、フロントエンド項目を発表すればいいです。
