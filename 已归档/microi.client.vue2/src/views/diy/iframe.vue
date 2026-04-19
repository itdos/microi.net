<template>
    <!-- onLoad="iFrameHeight()" -->
    <!--  -->
    <iframe
        :src="Url"
        id="iframepage"
        name="mainIFrame"
        frameBorder="0"
        allowtransparency="true"
        style="background-color: transparent; height: calc(100vh - 100px); overflow: auto"
        scrolling="yes"
        width="100%"
        :height="'calc(100vh - 100px)'"
    >
    </iframe>
</template>

<script>
export default {
    name: "iframe",
    data() {
        return {
            Url: ""
        };
    },

    components: {},

    computed: {},
    async created() {
        var self = this;
        var url = self.$route.params.Url;
        var menuId = self.$route && self.$route.meta && self.$route.meta.Id;
        if (!self.DiyCommon.IsNull(url)) {
            url = url.replace("$|", "/").replace("$|", "/").replace("$|", "/").replace("$|", "/").replace("$|", "/").replace("$@", "#");
            // url = url.replace(/＆/,'&');
        } else {
            url = decodeURIComponent((new RegExp("[?|&|%3F]" + "src" + "=" + "([^&;]+?)(&|;|$)").exec(location.href) || [, ""])[1].replace(/\+/g, "%20")) || null;
        }
        if (self.DiyCommon.IsNull(url) && self.$route.fullPath.startsWith("/iframe/")) {
            url = decodeURIComponent(self.$route.fullPath.replace("/iframe/", ""));
        }
        if (url) {
            //如果url是guid或ulid，就表示是接口引擎
            if (self.isValidGUID(url) || self.isValidULID(url)) {
                var apiEngineResult = await self.DiyCommon.ApiEngine.Run(url, {
                    MenuId: menuId
                });
                if (apiEngineResult.Code == 1) {
                    url = apiEngineResult.Data;
                } else {
                    self.DiyCommon.Tips(apiEngineResult.Msg, false);
                }
            }
            url = url.replace("$V8.CurrentToken$", self.DiyCommon.getToken());
        }
        self.Url = url;
    },
    mounted() {
        function iFrameHeight() {
            // var ifm = document.getElementById("iframepagevr");
            // var subWeb = document.frames ? document.frames["iframepagevr"].document
            //         : ifm.contentDocument;
            // if (ifm != null && subWeb != null) {
            //     ifm.height = subWeb.body.scrollHeight - 200;
        }
    },

    methods: {
        isValidULID(ulid) {
            // ULID 正则表达式模式
            // 格式: 26位 Crockford Base32 字符（0-9, A-Z 排除 I, L, O, U）
            // 第一个字符限制为 0-7（时间戳高位限制）
            const ulidPattern = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i;
            return ulidPattern.test(ulid);
        },
        isValidGUID(guid) {
            // GUID 正则表达式模式
            // 支持以下格式：
            // 1. 带有连字符: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
            // 2. 不带连字符: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
            // 3. 带有大括号: {XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}
            // 4. 带有括号: (XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX)
            const guidPattern =
                /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[0-9a-fA-F]{32}|\{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}|\([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\))$/;

            return guidPattern.test(guid);
        }
    }
};
</script>

<style lang="scss" scoped></style>
