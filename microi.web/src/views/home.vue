<template>
    <div class="home">
        <div class="box">
            <div class="title">欢迎使用{{ WebTitle }}</div>
            <div class="cont">
                {{ ClientCompany }}
            </div>
        </div>
        <div class="img">
            <img src="https://static-img.aijuhome.com/static/img/home-img.png" alt="" />
        </div>
    </div>
</template>

<script>
import { computed } from "vue";
import { useDiyStore, useSettingsStore } from "@/stores";
export default {
    setup() {
        const diyStore = useDiyStore();
        const settingsStore = useSettingsStore();

        const CurrentTime = computed(() => diyStore.CurrentTime);
        const DesktopBg = computed(() => diyStore.DesktopBg);
        const LoginCover = computed(() => diyStore.LoginCover);
        const OsClient = computed(() => diyStore.OsClient);
        const Lang = computed(() => diyStore.Lang);
        const title = computed(() => settingsStore.title);
        const WebTitle = computed(() => diyStore.WebTitle);
        const SystemSubTitle = computed(() => diyStore.SystemSubTitle);
        const ClientCompany = computed(() => diyStore.ClientCompany);
        const ClientCompanyUrl = computed(() => diyStore.ClientCompanyUrl);

        return {
            diyStore,
            settingsStore,
            CurrentTime,
            DesktopBg,
            LoginCover,
            OsClient,
            Lang,
            title,
            WebTitle,
            SystemSubTitle,
            ClientCompany,
            ClientCompanyUrl
        };
    },
    data() {
        return {
            // title:'欢迎使用吾码Microi管理系统',
            // cont:'拓路前行，领跑未来，带给你不一样的管理效率'
        };
    },
    computed: {},
    methods: {},
    mounted() {}
};
</script>

<style lang="scss" scoped>
.home {
    width: 100%;
    height: 100vh;
    background: url(https://static-img.aijuhome.com/static/img/home-bg1.png) no-repeat;
    background-size: 100% 100%;
    display: flex;
    justify-content: center;
    align-items: center;
}
.title {
    font-size: 3vw;
    color: #253b99;
    font-weight: bold;
}
.cont {
    width: 100%;
    height: 40px;
    line-height: 40px;
    text-align: center;
    font-size: 22px;
    color: #fff;
    background: url(https://static-img.aijuhome.com/static/img/home-txtbg.png) no-repeat;
    background-size: 100% 100%;
    margin-top: 35px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.box {
    margin-bottom: 220px;
}
.img {
    width: 40%;
    img {
        width: 100%;
    }
}
</style>
