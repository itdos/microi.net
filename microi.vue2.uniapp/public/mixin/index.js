import Vue from 'vue'

const modulesFiles = require.context('./modules', true, /.js$/)
const modules = modulesFiles.keys().reduce((module, modulePath) => {
	const moduleName = modulePath.replace(/.\/|\.js/g, '')
	module[moduleName] = modulesFiles(modulePath).default
	return module
}, {})

for (let key in modules) {
	Vue.mixin(modules[key])
}
