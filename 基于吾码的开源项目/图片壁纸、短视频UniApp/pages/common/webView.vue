<template>
	<web-view  :src="webViewUrl"></web-view>
</template>

<script>
	export default {
			data() {
				return {
					webViewUrl:''
				}
			},
			mounted() {
				var url = this.Microi.GetUrlQuery(this, 'url');
				this.webViewUrl = url;//'https://beian.miit.gov.cn'
			},
			onLoad() {
			
			}
			
		}
</script>

<style>
</style>