<template>
    <div class="zhuye">
        <div class="shouye">
            <div class="top-section">
                <!-- 第一块内容 -->
                <el-card class="box-card">
                    <div slot="header" class="clearfix">
                        <span>-基础数据管理-</span>
                    </div>
                    <div class="text item">
                        <!-- <router-link to="/jichushuju" class="custom-link">
                            <div class="changyong">
                                <i class="fas fa-address-book"></i>
                                <span>基础数据</span>
                            </div>
                        </router-link> -->
                        <router-link to="/system/diy-user" class="custom-link">
                            <div class="changyong">
                                <i class="fas fa-address-card"></i>
                                <span>系统账号</span>
                            </div>
                        </router-link>
                        <router-link to="/yuangonggongxubd" class="custom-link">
                            <div class="changyong">
                                <i class="fab fa-github-alt"></i>
                                <span>工序绑定</span>
                            </div>
                        </router-link>
                        <router-link to="/yanseguanli" class="custom-link">
                            <div class="changyong">
                                <i class="fas fa-sun"></i>
                                <span>颜色管理</span>
                            </div>
                        </router-link>
                        <router-link to="/gongxuguanli" class="custom-link">
                            <div class="changyong">
                                <i class="far fa-handshake"></i>
                                <span>工序管理</span>
                            </div>
                        </router-link>
                        <router-link to="/chimaguanli" class="custom-link">
                            <div class="changyong">
                                <i class="fas fa-chalkboard-teacher"></i>
                                <span>尺码管理</span>
                            </div>
                        </router-link>
                    </div>
                </el-card>
            </div>
            <div class="top-section">
                <!-- 第二块内容 -->
                <el-card class="box-card">
                    <div slot="header" class="clearfix">
                        <span>-生产管理-</span>
                    </div>
                    <div class="text item">
                        <router-link to="/kuanshixinxi" class="custom-link">
                            <div class="changyong">
                                <i class="far fa-address-card"></i>
                                <span>款式信息</span>
                            </div>
                        </router-link>
                        <router-link to="/caichuangfenbao" class="custom-link">
                            <div class="changyong">
                                <i class="fab fa-buromobelexperte"></i>
                                <span>裁床分包</span>
                            </div>
                        </router-link>
                        <router-link to="/feipiaodayin" class="custom-link">
                            <div class="changyong">
                                <i class="fas fa-clipboard"></i>
                                <span>菲票打印</span>
                            </div>
                        </router-link>
                        <router-link to="/saomadengji" class="custom-link">
                            <div class="changyong">
                                <i class="fas fa-tasks"></i>
                                <span>扫码登记</span>
                            </div>
                        </router-link>
                    </div>
                </el-card>
            </div>
            <div class="top-section">
                <!-- 第三块内容 -->
                <el-card class="box-card">
                    <div slot="header" class="clearfix">
                        <span>-报表中心-</span>
                    </div>
                    <div class="text item">
                        <router-link to="/xiugaishanchu" class="custom-link">
                            <div class="changyong">
                                <i class="fas fa-bolt"></i>
                                <span>修改删除</span>
                            </div>
                        </router-link>
                        <router-link to="/loubaojifei" class="custom-link">
                            <div class="changyong">
                                <i class="fas fa-tasks"></i>
                                <span>漏包计菲</span>
                            </div>
                        </router-link>
                        <router-link to="/gongzib" class="custom-link">
                            <div class="changyong">
                                <i class="fas fa-comment-dollar"></i>
                                <span>工资表</span>
                            </div>
                        </router-link>
                        <router-link to="/gongjiatiaozheng" class="custom-link">
                            <div class="changyong">
                                <i class="fas fa-money-check-alt"></i>
                                <span>工价调整</span>
                            </div>
                        </router-link>
                        <router-link to="/shengchanjdb" class="custom-link">
                            <div class="changyong">
                                <i class="fas fa-tasks"></i>
                                <span>生产进度</span>
                            </div>

                        </router-link>
                    </div>
                </el-card>
            </div>
            <!-- 下方第四处 -->
            <!-- <div class="buttom-section">
                <video :src="shipin" controls width="640" style="height: 45vh;"></video>
            </div> -->
        </div>
    </div>
</template>
  
<script>
export default {
    // 组件逻辑
    data(){
        return {
            // shipin:'https://www.w3school.com.cn/example/html5/mov_bbb.mp4'
        }
    }
}
</script>
  
<style lang="scss" scoped>
.shouye {
    /* 整体样式 */
    display: flex;
    flex-wrap: wrap;
    //flex-direction: column;
    justify-content: space-between;
}

.top-section {
    /* 上方三块样式 */
    margin-bottom: 20px;
}

.bottom-section {
    /* 下方三块样式 */
}

.item {
    display: flex;
    //justify-content: space-between;
    flex-wrap: wrap;
    align-items: center;
}

.clearfix:before,
.clearfix:after {
    display: table;
    content: "";
}

.clearfix:after {
    clear: both
}

.box-card {
    width: 25vw;
    height: 40vh;
}

.changyong {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 20px;
}

.changyong i {
    font-size: 25px;
    text-align: center;
}

.custom-link {
    text-decoration: none;
    /* 去掉下划线 */
    color: #4169E1;
    width: calc(100%/3);
}

.custom-link:hover {
    color: #F56C6C;
    /* 继承父元素的文字颜色 */
    text-decoration: none;
    /* 去掉悬浮时的下划线 */

}
</style>