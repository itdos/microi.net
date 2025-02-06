<template>
        <!-- onLoad="iFrameHeight()" -->
<!--  -->
<iframe :src="Url" id="iframepage" name="mainIFrame" 
        frameBorder=0 allowtransparency="true" 
        style="background-color:transparent;height: calc(100vh - 89px);" 
        scrolling=no width="100%" 
        >
</iframe>
</template>

<script>
export default {
    name: 'iframe',
    data() {
        return {
            Url: '',
        };
    },

    components: {},

    computed: {},
    created() {
        var self = this;
        var url = self.$route.params.Url;
        if (!self.DiyCommon.IsNull(url)) {
            url = url.replace('$|','/')
                            .replace('$|','/')
                            .replace('$|','/')
                            .replace('$|','/')
                            .replace('$|','/')
                            .replace('$@','#')
                            ;
            // url = url.replace(/＆/,'&');
        }else{
            url = decodeURIComponent((new RegExp('[?|&|%3F]'+'src'+'='+'([^&;]+?)(&|;|$)').exec(location.href)||[,""])[1].replace(/\+/g,'%20'))||null;
        }
        if(self.DiyCommon.IsNull(url) && self.$route.fullPath.startsWith('/iframe/')){
            url = decodeURIComponent(self.$route.fullPath.replace('/iframe/', ''));
        }
        if (url) {
            url = url.replace('$V8.CurrentToken$', self.DiyCommon.getToken());
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
      
    }
}
</script>

<style lang='scss' scoped>
</style>
