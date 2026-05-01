<template>
    <!-- onLoad="iFrameHeight()" -->
    <!-- 安全处理：默认不再允许摄头/麦克风/地理位置/剪贴板访问，避免任意外部 URL 获取这些敏感能力。 -->
    <!-- 加上 sandbox 限制脚本/表单/同源能力。如业务确需某项能力，在可信白名单下重新开启。 -->
    <iframe
        :src="Url"
        id="iframepage"
        name="mainIFrame"
        frameBorder="0"
        allowtransparency="true"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
        referrerpolicy="no-referrer"
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
            //如果url是guid，就表示是接口引擎
            if (self.isValidGUID(url)) {
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
