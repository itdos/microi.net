<template>
<div class="vChat-winbtn">
    <el-tooltip :content="maxmin ? '向下还原' : '最大化'" placement="bottom">
        <a class="w-max" @click="handleMaxMin"><i class="iconfont" :class="maxmin ? 'icon-win_max' : 'icon-win_min'"></i></a>
    </el-tooltip>
</div>
</template>

<script>
export default {
    data() {
        return {
            maxmin: false, //是否最大化窗口
        }
    },
    mounted() {
        this.checkMaxMin(this.maxmin)
    },
    methods: {
        checkMaxMin(val) {
            if (val) {
                $("body").addClass("maxmin");
            } else {
                $("body").removeClass("maxmin");
            }
        },
        handleMaxMin() {
            this.maxmin = !this.maxmin
        }
    },
    watch: {
        maxmin(val, oldVal) {
            this.checkMaxMin(val)
        }
    }
}
</script>

<style>

</style>
