export default {
	data() {
		return {
			loadEnd: false
		}
	},

	methods: {

		//将路由name转为path
		getPath(name) {
			return this.$Router.options.routes.find(item => item.name == name).path;
		},
	}
}
