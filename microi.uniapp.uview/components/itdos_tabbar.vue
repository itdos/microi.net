<template>
	<!-- 与包裹页面所有内容的元素u-page同级，且在它的下方 -->
	<u-tabbar v-model="pageCurrent" :list="list" height="60px" inactive-color="#3F3F3F"
	 active-color="var(--itdos-color)" @change="change"></u-tabbar>
</template>

<script>
	import {
		mapState
	} from 'vuex'
	export default {
		name:"itdos_tabbar",
		computed: {
			...mapState(['pageCurrent','allmsg']),
			list(){
				return  [{
						iconPath: "/static/img/tabber/home.png",
						selectedIconPath: "/static/img/tabber/home-select.png",
						text: '首页',
						isDot: false,
						customIcon: false,
						pagePath: '/pages/index/index'
					},
					{
						iconPath: "/static/img/tabber/oa.png",
						selectedIconPath: "/static/img/tabber/oa-select.png",
						text: '工作台',
						customIcon: false,
						pagePath: '/pages/work/work'
					},
					{
						iconPath: "/static/img/tabber/address.png",
						selectedIconPath: "/static/img/tabber/address-select.png",
						text: '通讯录',
						customIcon: false,
						pagePath: '/pages/address/address'
					},
					{
						iconPath: "/static/img/tabber/my.png",
						selectedIconPath: "/static/img/tabber/my-select.png",
						text: '我的',
						isDot: false,
						customIcon: false,
						pagePath: '/pages/my/my'
					},
				]
			}
		},
		data() {
			return {
				
			};
		},
		methods:{
			change(index){
				
			}
		}
	}
</script>

<style>

</style>
