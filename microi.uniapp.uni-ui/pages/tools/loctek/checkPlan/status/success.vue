<template>
    <view class="container">
        <view class="bg-wrap">
            <view class="bg">
                <!-- 背景图 -->
                <image src="/static/image/bg.png" class="item-img bg-img"></image>
                <!-- 人物图 -->
                <image src="/static/image/people.png" class="item-img people-img"></image>
            </view>
        </view>
        <view class="text-wrap">
            <view class="text">提交成功!</view>
            <!-- <view class="button" @click="goBack">返回首页</view> -->
        </view>
        <view style="min-height: 280rpx; width: 100%;"></view>
    </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad, onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
const status = ref('待审核')
const isShowStatus = ref(false)

onLoad((options) => {
    if (options.status != 0 && options.status) {
        isShowStatus.value = true
        if (options.status == 1) {
            status.value = '审核中'
        } else if (options.status == 2) {
            status.value = '已处理'
        } else if (options.status == 3) {
            status.value = '进行中'
        }
    }
})

</script>

<style lang="scss" scoped>
.container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background-color: #fff;

    .text-wrap {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin-top: -40px;

        .text {
            font-size: 20px;
            line-height: 40px;
            margin-bottom: 12px;
        }

        .status {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 20px;
            width: 88px;
            height: 36px;
            line-height: 34px;
            text-align: center;
            background-color: #3979f0;
            color: #fff;
            border-radius: 20px;
        }

        .button {
            width: 200px;
            height: 40px;
            line-height: 40px;
            text-align: center;
            background-color: #ffffff;
            border: 1px solid #3979f0;
            color: #3979f0;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
        }
    }

    .bg-wrap {
        .bg {
            position: relative;
            width: 532rpx;
            height: 522rpx;
        }

        /* 背景图片 */
        .bg-img {
            width: 532rpx;
            height: 522rpx;
        }

        /* 人物图片 */
        .people-img {
            position: absolute;
            top: 32px;
            /* 人物图片距离背景顶部32rpx */
            left: 66px;
            /* 人物图片距离背景左边122rpx */
            width: 250rpx;
            height: 348rpx;
        }

    }




}
</style>
