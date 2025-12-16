/**
 * Microi吾码 低代码平台 前端uni-app开发包 支持vue2、vue3
 * v1.8.7
  【初始化】：
 * 1、【非H5发行无需此步】 在index.html <head> 中添加全局变量，用于docker环境变量替换
	注意每行格式需要要一模一样，【var ApiBase = '';】不能去掉空格写成【var ApiBase='';】
  	<script type="text/javascript">
		var ApiBase = '';
		var OsClient = '';
		var FileServer = '';
	</script>
 * 2、在main.js引用：import { Microi, MicroiStore } from "./common/microi.uniapp.js"
  	vue2全局Microi对象赋值：Vue.prototype.Microi = Microi;
						  Vue.prototype.$MicroiStore = MicroiStore;//vue3暂不支持
							const app = new Vue({
							  store,
							  MicroiStore,//添加此行
							  ...App
							})
  	vue3全局Microi对象赋值：app.config.globalProperties.Microi = Microi
 * 3、vue2在App.vue onLaunch中执行：self.Microi.Init({
				TokenCallback : function(){
					console.log('self.$MicroiStore:', self.$MicroiStore)
					try{
						self.$MicroiStore.commit('SetIsLogin', self.Microi.IsLogin());
						self.$MicroiStore.commit('SetCurrentUser', self.Microi.GetCurrentUser());
					}catch(e){
						console.error(e)
					}
				}
			});//集成了获取系统设置、自动登录、Token定时以旧换新 等等

  【常用】：
 * 接口请求（Get请求同理）：
  	异步：self.Microi.Post('/api/ApiEngine/sysuser_reg', { Account : 'test' }, function(result){ ... })
  	同步：var result = await self.Microi.Post('/api/ApiEngine/sysuser_reg', { Account : 'test' })

 * 表单引擎 FormEngine（AddFormData、UptFormData等等同理，完整用法见平台文档[FormEngine用法]，前/后端、PC/移动端用法均保持一致）：
  	异步：self.Microi.FormEngine.GetFormData('FormEngineKey值', { Id : '' }, function(result){ ... })
  	同步：var result = await self.Microi.FormEngine.GetFormData('FormEngineKey'， { Id : '' })

 * 接口引擎 ApiEngine（ModuleEngine同理）：
  	异步：self.Microi.ApiEngine.Run('sysuser_reg', { Account : 'test' }, function(result){ ... })
  	同步：var result = await self.Microi.ApiEngine.Run('sysuser_reg', { Account : 'test' })
 */

/**
 * 是否显示常用的console.log信息
 */
var ConsoleLog = true;

/**
 * 修复非H5发行全局变量访问报错
 */
// #ifndef H5
try{
	if(ApiBase){}
}catch(e){
	var ApiBase = ''; var OsClient = ''; var FileServer = '';
}
// #endif

/**
 * 包引用
 */
import { mapState } from 'vuex'
// import { microiStore : MicroiStore } from '@/common/microi.uniapp.js'
import Qs from 'qs'
import { ChineseToPinyin as ChineseToPinyinFunc } from './pinyin-dict.js'
/**
 * 全局Microi对象
 */
export var Microi = {
	ApiBase: ApiBase || uni.getStorageSync('ApiBase') || 'https://api-china.itdos.com', //接口前缀，前端写死
	OsClient: OsClient || uni.getStorageSync('OsClient') || 'iTdos', //OsClient值，前端写死
	FileServer : FileServer || 'https://static-ali-img.itdos.com', //自动从SysConfig系统设置中获取
	H5Url:'',
	AppLogo: '',///jinhai/img/20240203/jinhai-logo.jpeg
	AppKey: '',
	SysConfig : {},
	DateTimeNow : new Date(),//将会被替换为服务器时间
	ConsoleLog : ConsoleLog, //是否显示常用的console.log信息
	ClientType:'',//APP、WeChat、H5
	ClientSystem:'',//Android、IOS
	SpiderApiBase : 'https://api-microios-win.itdos.com',
	PageUrlLogin : '/pages/mine/login/login',
	Api: {
		GetSysConfig : '/api/DiyTable/getSysConfig',//获取系统设置，此接口后端会走缓存
		GetSysUser : '/api/SysUser/GetSysUser', //联系人
		Login : '/api/SysUser/login',//用户登录
		AddFormData : '/api/FormEngine/addFormData',//添加一条数据
		AddFormDataBatch : '/api/FormEngine/addFormDataBatch', //批量添加数据，后端带事务
		DelFormData : '/api/FormEngine/delFormData',//删除一条数据
		DelFormDataBatch : '/api/FormEngine/delFormDataBatch',//批量删除数据，后端带事务
		DelFormDataByWhere : '/api/FormEngine/delFormDataByWhere',//根据条件批量删除数据，慎用
		UptFormData : '/api/FormEngine/uptFormData',//修改一条数据
		UptFormDataBatch : '/api/FormEngine/uptFormDataBatch',//批量修改数据，后端带事务
		UptFormDataByWhere : '/api/FormEngine/uptFormDataByWhere',//根据条件批量修改数据，慎用
		GetFormData : '/api/FormEngine/getFormData',//获取一条数据
		GetFormDataAnonymous : '/api/FormEngine/getFormDataAnonymous',//获取一条数据
		GetTableData : '/api/FormEngine/getTableData',//获取列表数据
		GetTableDataAnonymous : '/api/FormEngine/GetTableDataAnonymous',//获取列表数据
		ApiEngineRun : '/api/ApiEngine/run',//执行接口引擎
		ModuleEngineRun : '/api/ModuleEngineRun/run',//执行模块引擎
		RefreshToken : '/api/SysUser/refreshToken',//token以旧换新
		RefreshLoginUser : '/api/SysUser/refreshLoginUser',//更新当前登录用户身份信息
		Upload : '/api/HDFS/upload',//上传文件、图片
		UploadAnonymous : '/api/HDFS/uploadAnonymous',//上传文件、图片
		UniappUpload : '/api/HDFS/uniappUpload',//上传文件、图片
		UniappUploadAnonymous : '/api/HDFS/uniappUploadAnonymous',//上传文件、图片
		GetCurrentUser : '/api/SysUser/getCurrentUser',//获取当前登录身份信息
		GetDateTimeNow : '/api/os/getDateTimeNow',//获取服务器当前时间
		AddSysLog : '/api/SysLog/addSysLog',//添加日志
		GetOsClientByDomain : '/api/Os/GetOsClientByDomain',//根据域名获取OsClient值
		GetCaptcha : '/api/Captcha/getCaptcha',
		GetPrivateFileUrl : '/api/HDFS/GetPrivateFileUrl',//获取私有文件url
		GetSysUserPublicInfo : '/api/SysUser/getSysUserPublicInfo', // 获取用户信息
		/**
		 * ApiEngine地址替换
		 */
		ApiEngine:{
			// get_content_list : '/apiengine/get-content-list',
			// get_content_detail : '/apiengine/get-content-detail',
			// get_index_shortcut : '/apiengine/get-index-shortcut',
			// get_slideshow : '/apiengine/get-slideshow',
			// get_fenlei : '/apiengine/get-fenlei',
			// get_vip_level_list : '/apiengine/get-vip-level-list',
			// get_short_video : '/apiengine/get-short-video',
		}
	},
	// 修改服务器配置更新
	InitApi: function(){
		Microi.ApiBase = uni.getStorageSync('ApiBase') || 'https://api.nbweixin.cn', //接口前缀，前端写死
		Microi.OsClient = uni.getStorageSync('OsClient') || 'wuma' //OsClient值，前端写死
		// Microi.Init()
	},
	/**
	 * 平台初始化
	 * ）根据域名获取OsClient值
	 * ）获取SysConfig系统设置信息
	 * ）自动登录、定时token以旧换新
	 * ）定时获取登录身份信息
	 * ）获取服务器时间
	 */
	Init: async function(param){
		try {
			Microi.ClientType = Microi.GetClientType();
			Microi.ClientSystem = Microi.GetClientSystem();
			
			//根据域名获取OsClient值
			// await Microi.GetOsClientByDomain();
			
			//强制获取系统设置
			await Microi.GetSysConfig(true);
			
			//自动登录（token以旧换新）
			await Microi.RefreshToken(param && param.TokenCallback);
			
			//从后端获取当前登录用户身份信息
			Microi.GetCurrentUser(true, param && param.TokenCallback);
			
			//每1分钟前端检查一次token是否快到期
			setInterval(function(){
				Microi.RefreshToken(param && param.TokenCallback);
			}, 1000 * 60)
			
			//每5分钟从后端获取当前登录用户身份信息
			setInterval(function(){
				Microi.GetCurrentUser(true, param && param.TokenCallback)
			}, 1000 * 60 * 5)
			
			//获取服务器时间
			Microi.InitDateTimeNow();
		} catch (e) {
		  Microi.Tips('系统初始化失败：' + (e.message || e.Msg), false)
		  !ConsoleLog || console.log('Microi：系统初始化失败：' + (e.message || e.Msg))
		}
	},
	GetOsClientByDomain: async function(getCache){
		try{
			if(getCache){
				var osClient = uni.getStorageSync("OsClient");
				if(osClient){
					Microi.OsClient = osClient;
					return;
				}
			}
			var getOsClientResult = await Microi.Post(Microi.ApiBase + Microi.Api.GetOsClientByDomain, {
				Domain : location.host.toLocaleLowerCase()
			}, null, {
				DataType : 'form'
			});
			if(getOsClientResult.Code == 1){
				Microi.OsClient = getOsClientResult.Data.OsClient;
				uni.setStorageSync("OsClient", getOsClientResult.Data.OsClient);
			}
		}catch(e){
		}
	},
	/**
	 * 异步获取系统设置信息，需使用await
	 * @param {Object} refresh 是否强制重新从服务器获取并刷新缓存
	 */
	GetSysConfig: async function(refresh){
		if(!refresh){
			var sysConfigStr = uni.getStorageSync("SysConfig");
			if(sysConfigStr){
				return JSON.parse(sysConfigStr);
			}
		}
		var getSysConfigResult = await Microi.Post(Microi.ApiBase + Microi.Api.GetSysConfig, {
			OsClient : Microi.OsClient,
			_SearchEqual : {
				IsEnable : 1
			}
		}, null, {
			DataType : 'form'
		});
		if(!getSysConfigResult.Code){
			Microi.Tips('获取系统设置失败：' + getSysConfigResult.Msg);
			!ConsoleLog || console.log('Microi：获取系统设置失败：', getSysConfigResult.Msg);
			return null;
		}
		var getSysConfig = getSysConfigResult.Data;
		
		if(getSysConfig.FileServer){
			Microi.FileServer = getSysConfig.FileServer;
		}
		if(getSysConfig.AppLogo){
			Microi.AppLogo = getSysConfig.AppLogo;
		}
		if(getSysConfig.H5Url){
			Microi.H5Url = getSysConfig.H5Url;
		}
		
		Microi.SysConfig = getSysConfig;
		//!ConsoleLog || console.log('Microi：获取系统设置信息成功：', getSysConfig);
		uni.setStorageSync('SysConfig', JSON.stringify(getSysConfig));
		return getSysConfig;
	},
	/**
	 * 同步获取系统设置信息
	 */
	GetSysConfigSync: function(){
		var sysConfigStr = uni.getStorageSync("SysConfig");
		if(sysConfigStr){
			return JSON.parse(sysConfigStr);
		}
		return null;
	},
	InitDateTimeTimer : null,
	InitDateTimeNow: function(){
		Microi.Post(Microi.ApiBase + Microi.Api.GetDateTimeNow, {}, function(result){
			if(result.Code){
				Microi.DateTimeNow = new Date(result.Data);
				try{
					clearInterval(Microi.InitDateTimeTimer)
				}catch(e){}
				Microi.InitDateTimeTimer = setInterval(function(){
					Microi.DateTimeNow = Microi.DateTimeNow.AddTime('s', 1);
				}, 1000)
			}
		});
		
	},
	
	RefreshLoginUser: async function(){
		var result = await Microi.Post(Microi.ApiBase + Microi.Api.RefreshLoginUser);
		// if(Microi.CheckResult(result)){
		if(result.Code){
			Microi.SetCurrentUser(result.Data);
		}
		return result;
	},
	/**
	 * token以旧换新
	 */
	RefreshToken: async function(callback){
		//获取token 或身份信息，判断登录自动
		var token = Microi.GetToken();
		var currentUser = Microi.GetCurrentUser();
		//如果存在token，判断是否已过期
		if (token) {
			var expires = uni.getStorageSync("TokenExpires");
			//如果已过期，或不存在登录身份信息，则使用token以旧换新
			if(!expires || !currentUser || !currentUser.Id || new Date() >= new Date(expires)){
				var result = await Microi.Post(Microi.ApiBase + Microi.Api.RefreshToken, {
					authorization : token
				});
				if(result.Code){
					Microi.SetCurrentUser(result.Data);
					if(callback){
						callback()
					}
				}else{
					//如果已经超过18分钟，将身份信息置空
					if(!expires || new Date().DiffTime('m', new Date(expires)) < 2){
						Microi.SetCurrentUser({});
						if(callback){
							callback()
						}
					}
					!ConsoleLog || console.log('Microi：Token以旧换新失败：' + result.Msg)
					return { Code : 0, Msg : 'Token以旧换新失败：' + result.Msg };
				}
			}
		}else{
			!ConsoleLog || console.log('Microi：Token以旧换新失败：不存在旧的token！')
			return { Code : 0, Msg : 'Token以旧换新失败：不存在旧的token！' };
		}
	},
	/**
	 * 获取图形验证码，返回CaptchaSrc、CaptchaId
	 */
	async GetCaptcha(){
		var result = await Microi.Get(Microi.ApiBase + Microi.Api.GetCaptcha, {}, null, {
			ResponseType : 'arraybuffer',
		})
		var returnResult = {};
		if(result && result.header && result.header.captchaid){
			returnResult.CaptchaId = result.header.captchaid;//一定要将返回的captchaid存储起来
		}
		var src = 'data:image/png;base64,' + uni.arrayBufferToBase64(result.data);
		// + btoa(
		//         new Uint8Array(result.data)
		//         .reduce((data, byte) => data + String.fromCharCode(byte), '')
		//     );
		returnResult.CaptchaSrc = src;
		return returnResult;
	},
	/**
	 * 表单引擎
	 */
	FormEngine : {
		/**
		 * 新增简洁用法：Microi.AddFormData('sys_user', { Name : '', Account : '' }, function(){ ... })
		 */
		AddFormData : async function(paramOrFormEngineKey, formDataOrCallback, callback){
			var realParam = {
				FormEngineKey : '',
				Id : '',
				_RowModel : {},
			};
			var realCallback;
			if(typeof(paramOrFormEngineKey) == 'string'){
				realParam.FormEngineKey = paramOrFormEngineKey;
				if(!formDataOrCallback){
					formDataOrCallback = {};
				}
				for(let key in formDataOrCallback){
					if(key == 'Id'){
						realParam.Id = formDataOrCallback[key]
					}else{
						realParam._RowModel[key] = formDataOrCallback[key];
					}
				}
				realCallback = callback;
			}else{
				realParam = paramOrFormEngineKey;
				realCallback = formDataOrCallback;
			}
			var result = await Microi.Post(Microi.Api.AddFormData, realParam, realCallback);
			return result;
		},
		AddFormDataBatch : async function(param, callback){
			var result = await Microi.Post(Microi.Api.AddFormDataBatch, param, callback);
			return result;
		},
		DelFormData : async function(param, callback){
			var result = await Microi.Post(Microi.Api.DelFormData, param, callback);
			return result;
		},
		DelFormDataBatch : async function(param, callback){
			var result = await Microi.Post(Microi.Api.DelFormDataBatch, param, callback);
			return result;
		},
		DelFormDataByWhere : async function(param, callback){
			var result = await Microi.Post(Microi.Api.DelFormDataByWhere, param, callback);
			return result;
		},
		UptFormData : async function(paramOrFormEngineKey, formDataOrCallback, callback){
			var realParam = {
				FormEngineKey : '',
				Id : '',
				_RowModel : {},
			};
			var realCallback;
			if(typeof(paramOrFormEngineKey) == 'string'){
				realParam.FormEngineKey = paramOrFormEngineKey;
				if(!formDataOrCallback){
					formDataOrCallback = {};
				}
				for(let key in formDataOrCallback){
					if(key == 'Id'){
						realParam.Id = formDataOrCallback[key]
					}else{
						realParam._RowModel[key] = formDataOrCallback[key];
					}
				}
				realCallback = callback;
			}else{
				realParam = paramOrFormEngineKey;
				realCallback = formDataOrCallback;
			}
			var result = await Microi.Post(Microi.Api.UptFormData, realParam, realCallback);
			return result;
		},
		UptFormDataByWhere : async function(param, callback){
			var result = await Microi.Post(Microi.Api.UptFormDataByWhere, param, callback);
			return result;
		},
		UptFormDataBatch : async function(param, callback){
			var result = await Microi.Post(Microi.Api.UptFormDataBatch, param, callback);
			return result;
		},
		GetFormData : async function(paramOrFormEngineKey, formDataOrCallback, callback){
			var realParam = {
				FormEngineKey : '',
				Id : '',
			};
			var realCallback;
			if(typeof(paramOrFormEngineKey) == 'string'){
				realParam.FormEngineKey = paramOrFormEngineKey;
				if(!formDataOrCallback){
					formDataOrCallback = {};
				}
				for(let key in formDataOrCallback){
					if(key == 'Id'){
						realParam.Id = formDataOrCallback[key]
					}
					else{
						realParam[key] = formDataOrCallback[key]
					}
				}
				realCallback = callback;
			}else{
				realParam = paramOrFormEngineKey;
				realCallback = formDataOrCallback;
			}
			//此处也可以不用给url拼接【'-' + realParam.FormEngineKey】
			//拼接的目的是让开发者能方便的在network中看出来是取哪张表的数据。
			var result = await Microi.Post(Microi.Api.GetFormData + '-' + realParam.FormEngineKey, realParam, realCallback);
			return result;
		},
		GetFormDataAnonymous : async function(paramOrFormEngineKey, formDataOrCallback, callback){
			var realParam = {
				FormEngineKey : '',
				Id : '',
			};
			var realCallback;
			if(typeof(paramOrFormEngineKey) == 'string'){
				realParam.FormEngineKey = paramOrFormEngineKey;
				if(!formDataOrCallback){
					formDataOrCallback = {};
				}
				for(let key in formDataOrCallback){
					if(key == 'Id'){
						realParam.Id = formDataOrCallback[key]
					}
					// else{
					// 	realParam._RowModel[key] = formDataOrCallback[key];
					// }
				}
				realCallback = callback;
			}else{
				realParam = paramOrFormEngineKey;
				realCallback = formDataOrCallback;
			}
			var result = await Microi.Post(Microi.Api.GetFormDataAnonymous, realParam, realCallback);
			return result;
		},
		GetTableData : async function(param, callback){
			var result = await Microi.Post(Microi.Api.GetTableData, param, callback);
			return result;
		},
		GetTableDataAnonymous : async function(param, callback){
			var result = await Microi.Post(Microi.Api.GetTableDataAnonymous, param, callback);
			return result;
		},
	},
	/**
	 * 接口引擎
	 */
    ApiEngine : {
		/**
		 * @param {Object} urlOrOption url 或 option
		 * @param {Object} dataOrCallback data 或 callback回调函数
		 * @param {Object} callback callback回调函数
		 */
    	Run : async function(urlOrOption, dataOrCallback, callback){
			var url = '/api/ApiEngine/run';
    		if(typeof(urlOrOption) == 'string'){
				//如果是这种模式：.Run('ApiEngineKey', {}, function(){})
				var apiKey = urlOrOption.toString();
				var param = {};
				param.ApiEngineKey = apiKey;
				for (let key in dataOrCallback) {
					param[key] = dataOrCallback[key];
				}
				//此处也可以不用替换掉url，替换的目的是让开发者方便的在network中看到请求哪个接口引擎地址
				if(Microi.Api.ApiEngine[param.ApiEngineKey]){
					url = Microi.Api.ApiEngine[param.ApiEngineKey];
				}
				var result = await Microi.Post(url, param, callback, { IsApiEngine : true });
				return result;
			}else{
				//如果是这种模式：.Run({}, function(){})
				var result = await Microi.Post(url, dataOrCallback);
				return result;
			}
    	},
    },
	/**
	 * 模块引擎
	 */
	ModuleEngine : {
		/**
		 * @param {Object} urlOrOption url 或 option
		 * @param {Object} dataOrCallback data 或 callback回调函数
		 * @param {Object} callback callback回调函数
		 */
		Run : async function(urlOrOption, dataOrCallback, callback){
			if(typeof(urlOrOption) == 'string'){
				//如果是这种模式：.Run('ModuleEngineKey', {}, function(){})
				var apiKey = urlOrOption.toString();
				var param = {};
				param.ModuleEngineKey = apiKey;
				for (let key in dataOrCallback) {
					param[key] = dataOrCallback[key];
				}
				var result = await Microi.Post('/api/ModuleEngine/run', param, callback);
				return result;
			}else{
				//如果是这种模式：.Run({}, function(){})
				var result = await Microi.Post('/api/ModuleEngine/run', dataOrCallback);
				return result;
			}
		},
	},
    /**
	 * 同步获取当前用户登录身份信息
     */
	GetCurrentUser: function(refresh, callback){
		if(refresh){
			Microi.Post(Microi.ApiBase + Microi.Api.GetCurrentUser, {}, function(result){
				if(result.Code){
					Microi.SetCurrentUser(result.Data);
				}
				if(callback){
					callback(result);
				}
			});
		}
		var currentUserStr = uni.getStorageSync("CurrentUser");
		if(currentUserStr){
			var result = JSON.parse(currentUserStr);
			return result || {};
		}
		return {};
	},
	/**
	 * 同步设置当前登录身份信息
	 */
	SetCurrentUser: function(currentUser){
		if(typeof(currentUser) == 'string'){
			uni.setStorageSync("CurrentUser", currentUser);
		}else{
			uni.setStorageSync("CurrentUser", JSON.stringify(currentUser));
		}
	},
	/**
	 * 同步获取当前token值
	 */
	GetToken: function(){
		return uni.getStorageSync("Token");
	},
	/**
	 * 同步设置当前token值，同时设置过期时间为15分钟后（服务器为20分钟，最后5分钟会以旧换新）
	 * @param {Object} token
	 */
	SetToken: function(token){
		uni.setStorageSync("Token", token);
		if(!token){
			uni.setStorageSync("TokenExpires", '');
		}else{
			uni.setStorageSync("TokenExpires", new Date().AddTime('m', 15).Format('yyyy-MM-dd HH:mm:ss'));
		}
	},
	/**
	 * 用户登录。传入Account、Pwd、
	 * @param {Object} param
	 */
	Login: async function(param){
		var result = await Microi.Post(Microi.Api.Login, param, null, {
			DataType : 'form'
		});
		if(result.Code){
			Microi.SetCurrentUser(result.Data);
		}else{
			Microi.Tips('登录失败：' + result.Msg, false);
		}
		return result;
	},
	/**
	 * 用户退出登陆
	 * 此函数并未调用服务器端接口，防止用户多端同时登陆时，被一起踢下线
	 * 后期服务器端会实现多端同时登陆时使用不同token
	 */
	Logout: function(){
		Microi.SetToken('');
		Microi.SetCurrentUser('');
		uni.removeStorageSync("CurrentUser");
		uni.removeStorageSync("Token");
		uni.removeStorageSync("TokenExpires");
	},
	/**
	 * 提示
	 * @param {Object} text 提示内容
	 * @param {Object} isSuccess 是否成功，默认true
	 * @param {Object} time 持续时间，单位毫秒，默认1000，isSuccess为false时默认2000
	 */
	Tips: function(text, isSuccess, timeOrOption) {
		if(isSuccess == undefined || isSuccess == null){
			isSuccess = true;
		}
		
		var timeOrOptionReal = null;
		if(typeof(timeOrOption) != 'object'){
			timeOrOptionReal = {
				Time : timeOrOption
			}
		}else{
			timeOrOptionReal = {...timeOrOption};
		}
		
		var title = text.toString();
		//由于小程序uni.showToast只能最多7个字，超过7个字时使用uni.showModal
		//https://uniapp.dcloud.net.cn/api/ui/prompt.html#showtoast
		//MustTips：强制使用uni.showToast
		let { Icon, Time, CssClass, MustTips, OKText } = timeOrOptionReal;
		if(MustTips //强制 showToast
			// || (!Icon && isSuccess) //
			|| Icon == 'none' //没有图标时，可以显示很多字，所以使用 showToast
			|| Microi.GetStrLength(title) <= 14 //文字小于7个汉字，即使有图标也使用 showToast
			|| Microi.ClientType == 'H5'//H5不需要转uni.showModal
			){
			uni.showToast({
				title: title,
				icon: Icon || (isSuccess ? 'success' : 'error'),//error(有效)、fail(无效)、exception(无效)
				duration: Time || (isSuccess ? 1500 : 6000),
				// iconClass: 'microi-toast',//无效
				// cssClass: 'microi-toast',//无效
				class: CssClass || 'microi-toast',//有效
				position : 'center',//（仅App生效）、top、bottom
			})
		}else{
			Microi.ConfirmTips(title, null, {
				ShowCancel : false,
				OKText : OKText || '知道了'
			})
		}
	},
	GetStrLength: function (str) {
	  const pattern = /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/g;
	  const chineseChars = str.match(pattern);
	  const chineseLength = chineseChars ? chineseChars.length * 2 : 0;
	  const otherLength = str.length - (chineseLength / 2);
	  return chineseLength + otherLength;
	},

	/**
	 * 可选参数：Title、ShowCancel、OKColor、OKText
	 * @param {Object} content
	 * @param {Object} callback
	 * @param {Object} option
	 */
	ConfirmTips: function(content, callback, option) {
		if(!option){
			option = {};
		}
		let  { Title, ShowCancel, OKColor, OKText, CancelCallback} = option;
		uni.showModal({
			title: Title || '提示',
			content: content,
			showCancel: (ShowCancel === false ? false : true),
			cancelColor: "#555",
			confirmColor: OKColor || "#5677fc",
			confirmText: OKText || "确定",
			success(res) {
				if(callback && res.confirm){
					callback();
				}else if(CancelCallback && !res.confirm){
					CancelCallback();
				}
			}
		})
	},
	/**
	 * 
	 */
	IsAndroid: function() {
		const res = uni.getSystemInfoSync();
		return res.platform.toLocaleLowerCase() == "android"
	},
	/**
	 * 
	 */
	IsPhoneX: function() {
		const res = uni.getSystemInfoSync();
		let iphonex = false;
		let models = ['iphonex', 'iphonexr', 'iphonexsmax', 'iphone11', 'iphone11pro', 'iphone11promax']
		const model = res.model.replace(/\s/g, "").toLowerCase()
		if (models.includes(model)) {
			iphonex = true;
		}
		return iphonex;
	},
	/**
	 * 
	 */
	Loading: function(title, mask = true) {
		uni.showLoading({
			mask: mask,
			title: title || '请稍候...'
		})
	},
	ShowLoading: function(title, mask = true) {
		Microi.Loading(title, mask);
	},
	HideLoading: function() {
		uni.hideLoading()
	},
	/**
	 * Post请求
	 * @param {Object} url
	 * @param {Object} data
	 * @param {Object} callback
	 * @param {Object} option
	 */
	Post: async function(url, data, callback, option){
		var fullUrl = url.startsWith('http') || url.startsWith('wxfile://') ? url : Microi.ApiBase + url;
		var result = await Microi.request({
			...option,
			Url : url,
			Data : data,
		});
		if(callback){
			callback(result);
		}
		return result;
	},
	/**
	 * Get请求
	 * @param {Object} url
	 * @param {Object} data
	 * @param {Object} callback
	 * @param {Object} option
	 */
	Get: async function(url, data, callback, option){
		var fullUrl = url.startsWith('http') || url.startsWith('wxfile://') ? url : Microi.ApiBase + url;
		var result = await Microi.request({
			...option,
			Url : url,
			Data : data,
			Method : 'GET'
		});
		if(callback){
			callback(result);
		}
		return result;
	},
	/**
	 * MP-ALIPAY、MP-BAIDU、MP-TOUTIAO、MP-QQ、MP-360、APP-PLUS-NVUE
	 */
	GetClientType(){
		var clientType = '';//H5、WeChat、Android、IOS
		
		// #ifdef H5
		clientType = 'H5'
		// #endif
		
		// #ifdef APP-PLUS
		clientType = 'APP'//老版本返回的是：Android'
		// #endif
		
		// #ifdef MP-WEIXIN
		clientType = 'WeChat'//微信小程序
		// #endif
		
		return clientType;
	},
	GetClientSystem(){
		var clientSystem = '';
		try{
			var systemInfo = uni.getSystemInfoSync();
			if (systemInfo.platform === 'android') {
				clientSystem = 'Android'
			} else if (systemInfo.platform === 'ios') {
				clientSystem = 'IOS'
			}else{
				clientSystem = systemInfo.platform;
			}
		}catch(e){
			//TODO handle the exception
		}
		return clientSystem;
	},
	/**
	 * 接口请求
	 * Url：接口地址
	 * Method：默认post，可选get
	 * Data：参数
	 * DataType：默认json，可选form
	 * IsApiEngine：是否接口引擎接口，默认false
	 * Header：
	 */
	request: async function(param) {
		var { Url, Method, Data, DataType, IsApiEngine, Header, ResponseType } = param;
		if(!DataType){
			DataType = 'json';
		}
		if(!Data){
			Data = {};
		}
		Data._ClientType = Microi.ClientType;
		Data._ClientSystem = Microi.ClientSystem;
		Data.OsClient = Microi.OsClient;
		Data.AppKey = Microi.AppKey || Data.AppKey;
		var fullUrl = Url.startsWith('http') || Url.startsWith('wxfile://') ? Url : Microi.ApiBase + Url;
		var header = {
					'content-type': DataType.toLowerCase() != 'form' ? 'application/json' : 'application/x-www-form-urlencoded',
					authorization: 'Bearer ' + Microi.GetToken(),
					osclient: Microi.OsClient,
					clienttype : Data._ClientType,
					clientsystem : Data._ClientSystem,
					apiengine : IsApiEngine || 0,
				};
		if(Header){
			for (let key in Header) {
				header[key] = Header[key];
			}
		}
		var requestOptions = {
			url: fullUrl,
			data: DataType == 'form' ? Qs.stringify(Data) : Data,
			header: header,
			method: Method || 'POST',
			dataType: DataType || 'json',
		};
		if(ResponseType){
			requestOptions.responseType = ResponseType;
		}
		return new Promise((resolve, reject) => {
			uni.request({
				...requestOptions,
				timeout: 10000, // 设置超时时间为10000毫秒（10秒）
				success: (res) => {
					let token = res.header.Authorization || res.header.authorization
					if(token){
						Microi.SetToken(token)
					}
					var result = res.data;
					try{
						//如果是arraybuffer，不能JSON.parse
						if(ResponseType == 'arraybuffer'){
							resolve(res)
						}else{
							var resultObj = JSON.parse(result);
							if(resultObj.Code == 1001 && !Microi.IsLogin()){
														// 获取当前页面路径
						const pages = getCurrentPages();
						const currentPage = pages[pages.length - 1];
						// 检查当前是否已经在登录页面，安全访问route属性
						if (currentPage && currentPage.route && typeof currentPage.route === 'string' && currentPage.route !== 'pages/mine/login/login') {
							Microi.RouterPush(Microi.PageUrlLogin)
							console.warn('Microi：当前用户已退出，请重新登录！')
						}
							}
							// if(resultObj.Code != 1 && resultObj.Code != 1001
							// 	&& fullUrl != Microi.ApiBase + Microi.Api.AddSysLog
							// 	&& fullUrl != Microi.ApiBase + Microi.Api.GetCurrentUser
							// 	){
							// 	Microi.AddSysLog({
							// 		Type :'前端错误',
							// 		Title:'前端错误',
							// 		Api : Url,
							// 		Param : JSON.stringify(param),
							// 		Content: `${result.Msg}`
							// 	})
							// }
							resolve(resultObj)
						}
					}catch(e){
						if(result.Code == 1001 && !Microi.IsLogin()){
							// 获取当前页面路径
							const pages = getCurrentPages();
							const currentPage = pages[pages.length - 1];
							// 检查当前是否已经在登录页面，安全访问route属性
							if (currentPage && currentPage.route && typeof currentPage.route === 'string' && currentPage.route !== 'pages/mine/login/login') {
								Microi.RouterPush(Microi.PageUrlLogin)
								console.warn('Microi：当前用户已退出，请重新登录！')
							}
						}
						// if(result.Code != 1 && result.Code != 1001
						// 	&& fullUrl != Microi.ApiBase + Microi.Api.AddSysLog
						// 	&& fullUrl != Microi.ApiBase + Microi.Api.GetCurrentUser
						// 	){
						// 	Microi.AddSysLog({
						// 		Type :'前端错误',
						// 		Title:'前端错误',
						// 		Api : Url,
						// 		Param : JSON.stringify(param),
						// 		Content: `${result.Msg}`
						// 	})
						// }
						resolve(result)
					}
				},
				fail: (res) => {
					Microi.Tips(`网络出现问题，请重试：${res.errMsg}`, false, {
						MustTips : true,
						Icon : 'none'
					})
					!ConsoleLog || console.log('Microi：request fail 网络出现问题，请重试：', res)
					if(fullUrl != Microi.ApiBase + Microi.Api.AddSysLog
						&& fullUrl != Microi.ApiBase + Microi.Api.GetCurrentUser
						){
						Microi.AddSysLog({
							Type :'前端异常',
							Title:'前端异常',
							Api : Url,
							Param : JSON.stringify(param),
							Content: `${res.errMsg}`
						})
					}
					reject({
						Code : 0, 
						Data: res,
						Msg : `网络出现问题，请重试：${res.errMsg}`
					})
				}
			})
		})
	},
	/**
	 * 添加系统日志
	 * @param {Object} param
	 */
	AddSysLog(param){
		Microi.Post(Microi.ApiBase + Microi.Api.AddSysLog, param, function(){
			
		}, {
			DataType : 'Form'
		})
	},
	/**
	 * 检查接口返回结果，若有错误则做出提示
	 * @param {Object} result
	 */
	CheckResult: function(result){
		if(!result || typeof(result) != 'object'){
			return false;
		}else if(result.Code != 1){
			Microi.Tips(result.Msg, false, 3000)//'操作失败：' + 
			return false;
		}
		return true;
	},
	//判断是否登录
	IsLogin: function() {
		var currentUser = Microi.GetCurrentUser().Id ? true : false
		var token = Microi.GetToken() ? true : false
		if(!currentUser || !token){
			return false;
		}
		return true;
	},
	/**
	 * 跳转页面，可判断是否登录
	 * @param {Object} url
	 * @param {Object} isVerify 校验登录状态
	 */
	NavigateTo(url, isVerify) {
		if (isVerify && !Microi.IsLogin()) {
			uni.navigateTo({
				url: Microi.PageUrlLogin,//'/pages/login/login'
			})
		} else {
			uni.navigateTo({
				url: url
			});
		}
	},
	/**
	 * 跳转页面，可判断是否登录
	 * @param {Object} url
	 * @param {Object} isVerify 校验登录状态
	 */
	RouterPush(url, isVerify) {
		Microi.NavigateTo(url, isVerify);
	},
	
	/**
	 * 上传文件、图片
	 * Path：文件路径前缀，如：/img、/file
	 * Limit：是否上传到私有存储桶，默认false。值得注意的是：uni-app需要传入字段串的'true'后端才能接收到值，不能像PC前端一样传入bool类型的true。
	 * Preview：是否压缩图片，默认false
	 * File：前端图片地址，格式如：blob:http://localhost:5173/bf13a4fc-ea0d-4994-83b3-f07393878e14
	 * _UseUniappUpload：默认false
	 * _Anonymous：默认false
	 */
	Upload: async function(param, callback) {
		if(!param || !param.File){
			Microi.Tips('前端参数错误！', false);
			return { Code : 0, Msg : '前端参数错误！' };
		}
		param._ClientType = Microi.ClientType;
		param._ClientSystem = Microi.ClientSystem;
		param.OsClient = Microi.OsClient;
		var header = {
					// 'content-type': DataType.toLowerCase() != 'form' ? 'application/json' : 'application/x-www-form-urlencoded',
					authorization: 'Bearer ' + Microi.GetToken(),
					osclient: Microi.OsClient,
					clienttype : param._ClientType,
					clientsystem : param._ClientSystem,
					// apiengine : IsApiEngine || 0,
				};
		var uploadUrl = Microi.ApiBase + Microi.Api.Upload;
		if(param._UseUniappUpload){
			if(!param._Anonymous){
				uploadUrl = Microi.ApiBase + Microi.Api.UniappUpload;
			}else{
				uploadUrl = Microi.ApiBase + Microi.Api.UniappUploadAnonymous;
			}
		}else if(param._Anonymous){
			uploadUrl = Microi.ApiBase + Microi.Api.UploadAnonymous;
		}
		var file = param.File.toString();
		if(file.startsWith('data:')){
			//第一种方式：
			// file = Microi.ImgBase64ToFile(file, 'temp.png')
			//第二种方式（使用uni.request）：
			// 构建FormData对象并添加base64图片数据
			// var formData = new FormData();
			// formData.append('user', 'temp');
			// formData.append('file', Microi.ImgBase63ToBlob(file), 'temp.png');
			//第三种方式（使用uni.uploadFile）：
			// file = Microi.ImgBase63ToBlob(file);
			//第四种方式：
			// file = uni.base64ToArrayBuffer(file);
		}
		Microi.Loading('上传中...')
		return new Promise((resolve, reject) => {
			const uploadTask = uni.uploadFile({
				url: uploadUrl,
				filePath: file,
				name: 'file',//imageFile',
				header: {
					...header
				},
				formData: {
					...param,
					// sizeArrayText:""
				},
				success: function(res) {
					Microi.HideLoading()
					var result = res.data;
					try{
						result = JSON.parse(res.data);
					}catch(e){}
					if(callback){
						callback(result);
					}
					resolve(result)
				},
				fail: function(res) {
					Microi.HideLoading()
					if(callback){
						callback({ Code : 0 , Data : res, Msg : res.errMsg });
					}
					reject({ Code : 0 , Data : res, Msg : res.errMsg })
					// that.toast(res.msg);
				}
			})
		})
	},
	UploadAnonymous: async function(param, callback) {
		param._Anonymous = true;
		return await Microi.Upload(param, callback);
	},
	Download: async function(url, option, callback) {
		if(!url){
			Microi.Tips('前端参数错误！', false);
			return { Code : 0, Msg : '前端参数错误！' };
		}
		Microi.Loading('下载中...')
		return new Promise((resolve, reject) => {
			const uploadTask = uni.downloadFile({
				url: url,
				success: function(res) {
					Microi.HideLoading()
					var result = {
						Code : res.statusCode === 200 ? 1 : 0,
						Data : res,
						Msg : res.errMsg
					};
					if(callback){
						callback(result);
					}
					resolve(result)
				},
				fail: function(res) {
					Microi.HideLoading()
					if(callback){
						callback({ Code : 0 , Data : res, Msg : res.errMsg });
					}
					reject({ Code : 0 , Data : res, Msg : res.errMsg })
				}
			})
		})
	},
	/**
	 * 图片base64转文件
	 * 使用方法：var file = ImgBase64ToFile('data:image/png;base64,xxxxxx', 'temp.png');
	 */
	ImgBase64ToFile: function(dataurl, filename) {
	    var arr = dataurl.split(','), 
	        mime = arr[0].match(/:(.*?);/)[1],
	        bstr = atob(arr[1]), 
	        n = bstr.length, 
	        u8arr = new Uint8Array(n);
	    while(n--){
	        u8arr[n] = bstr.charCodeAt(n);
	    }
	    return new File([u8arr], filename, {type:mime});
	},
	// 将base64字符串转换为Blob对象
	ImgBase63ToBlob: function(dataURI) {
	    var byteString = atob(dataURI.split(',')[1]);
	    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
	    var ab = new ArrayBuffer(byteString.length);
	    var ia = new Uint8Array(ab);
	    for (var i = 0; i < byteString.length; i++) {
	        ia[i] = byteString.charCodeAt(i);
	    }
	    return new Blob([ab], { type: mimeString });
	},
	HidePhone: function(phone){
		if(!phone){
			return phone;
		}
		if(phone.length == 11){
			return phone.substring(0,3) 
					+ "****" 
					+ phone.substring(7, phone.length);
		}
		var len = Math.floor(phone.length / 3);
		var none = '';
		for(var i = 0; i < phone.substring(len, phone.length - len).length; i++){
			none += '*';
		}
		return phone.substring(0, len) 
				+ none
				+ phone.substring(phone.length - len, phone.length)
	},
	ImgExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],
	IsImg: function(link){
		var realLink = link.split('?')[0];
		const fileExtension = realLink.substring(realLink.lastIndexOf('.')).toLowerCase();
		return Microi.ImgExtensions.includes(fileExtension);
	},
	/**
	 * 跳转到新的小程序
	 * @param {Object} appId 要跳转的小程序的 AppID
	 * @param {Object} path 要跳转的小程序页面路径
	 * @param {Object} param 额外的数据，可在目标小程序的 `onLaunch`、`onShow`、`onLoad` 方法中获取
	 * @param {Object} callback 回调函数
	 */
	NavigateToMiniProgram: function(appId, path, param, callback){
		uni.navigateToMiniProgram({
		  appId: appId,
		  path: path,
		  extraData: param,
		  success(res) {
		    if(callback){
				callback({ Code : 1, Data : res });
			}
		  },
		  fail(err) {
			if(callback){
				callback({ Code : 1, Data : err, Msg : err.errMsg });
			}
		  }
		})
	},
	GetUrlQuery(self, property){
		return (self.$mp && self.$mp.query && self.$mp.query[property]) 
				|| (self.$options && self.$options.pageQuery && self.$options.pageQuery[property])
				|| (self.$scope && self.$scope.options && self.$scope.options[property])
				|| (self.$page && self.$page.options && self.$page.options[property])
	},
	GetCountStr(count){
		if(!count){
			return 0;
		}
		else if(count < 10000){
			return count;
		}else if(count < 100000){
			return (count / 10000).toFixed(2) + '万';
		}else{
			return (count / 10000).toFixed(1) + '万';
		}
	}
}
import { tsc } from "@/utils/ble/tsc.js"
function prepareSend(buff){
	// console.log(buff);
	let that = this
	let time = that.oneTimeData
	let looptime = parseInt(buff.length / time);
	let lastData = parseInt(buff.length % time);
	// console.log(looptime + "---" + lastData)
	this.looptime = looptime + 1;
	this.lastData = lastData;
	this.currentTime = 1;
	that.Send(buff)
}
export var V8 = {
	/**
	 * 初始化，必须执行！
	**/
	Init : function(formData, fieldList, FormMode){
		V8.Print = {
			createNew : tsc.jpPrinter.createNew,
			prepareSend : prepareSend,
			
		};
		
		V8.OldForm = JSON.parse(JSON.stringify(formData)); // 旧表单数据
		V8.Form = formData;
		var fields = {};
		fieldList.forEach(item => {
			fields[item.Name] = item;
		});
		V8.Field = fields;
		V8.FormMode = FormMode; // 表单模式，edit编辑，view查看 2024-08-06
		// 表单提交类型（Insert/Update/Delete），可在“表单提交前V8引擎代码”中赋值V8.Result = false;以阻止表单提交。
		V8.FormSubmitAction = FormMode == 'Add' ? 'Insert' : FormMode == 'Edit' ? 'Update' : 'Delete'; // 表单提交动作，Insert新增，Update更新，Delete删除
		// 获取离开表单的类型，可用于离开表单、提交表单后V8引擎代码中做为判断，可能的值：Update/Insert/Close/Delete
		V8.FormOutAction = FormMode == 'Add' ? 'Insert' : FormMode == 'Edit' ? 'Update' : 'Close'; // 表单外部动作，Insert新增，Update更新，Close关闭，Delete删除
		V8.Result = true; // 表单提交结果，true成功，false失败
		V8.WF.ApprovalType = ''; // 审批类型
		V8.InitSyncMicroi()
		return V8;
	},
	// 初始化v8同步microi方法
	InitSyncMicroi : function(){
		V8.FormEngine = Microi.FormEngine; // 2024-08-06 表单引擎
		V8.ApiEngine = Microi.ApiEngine; // 2024-08-06 接口引擎
		V8.CurrentUser = Microi.GetCurrentUser(); // 用户信息 2024-08-07
		V8.Tips = Microi.Tips // 提示信息 2024-08-07
		V8.ConfirmTips = Microi.ConfirmTips // 确认提示信息 2024-08-07
		V8.SysConfig = Microi.SysConfig // 系统配置 2024-08-21
		V8.ClientType = Microi.ClientType // 客户端类型 2025-06-04
	},
	/*
	* 初始化ParentV8
	*/
	InitParentV8 : function(formData, fieldList){
		V8.ParentForm = formData;
		var fields = {};
		fieldList.forEach(item => {
			fields[item.Name] = item;
		});
		V8.ParentField = fields;
		return V8;
	},
	/**
	 * 用户信息 2024-08-07
	**/
	CurrentUser : {},
	/**
	 * 表单数据，引用类型
	**/
	Form : {},
	/**
	 * 父表单数据，引用类型 2024-08-13
	**/
	ParentForm : {}, 
	/**
	 * 字段列表数据对象
	**/
	Field : {},
	/**
	 * 父字段列表数据对象 2024-08-13
	**/
	ParentField : {},
	Extend : {
		/**
		 * 获取当前日期时间 2024-08-07
		**/
		GetDateTimeNow: function(format){
			var time = new Date();
				if (!format) {
					var year = time.getFullYear();
					var month = time.getMonth() + 1;
					var day = time.getDate();
					var hh = time.getHours();
					var mm = time.getMinutes();
					var ss = time.getSeconds();
					return year + '-' 
									+ (month > 9 ? month : '0' + month) + '-' 
									+ (day > 9 ? day : '0' + day) + ' ' 
									+ (hh > 9 ? hh : '0' + hh) + ':' 
									+ (mm > 9 ? mm : '0' + mm) + ':' 
									+ (ss > 9 ? ss : '0' + ss);
				}
				var o = {
					'M+': time.getMonth() + 1, // month
					'd+': time.getDate(), // day
					'h+': time.getHours(), // hour
					'H+': time.getHours(), // hour
					'm+': time.getMinutes(), // minute
					's+': time.getSeconds(), // second
					'q+': Math.floor((time.getMonth() + 3) / 3), // quarter
					'S': time.getMilliseconds() // millisecond
				}
				if (/(y+)/.test(format)) {
					format = format.replace(RegExp.$1,
						(time.getFullYear() + '').substr(4 - RegExp.$1.length))
				}
				for (var k in o) {
					if (new RegExp('(' + k + ')').test(format)) {
						format = format.replace(RegExp.$1,
							RegExp.$1.length == 1 ? o[k]
								: ('00' + o[k]).substr(('' + o[k]).length))
					}
				}
				return format
		},
		GetWeekOfYear : function(date){
		// 确保传入的是一个有效的日期对象
			if (!(date instanceof Date) || isNaN(date.getTime())) {
					throw new Error('Invalid date');
			}
			// 创建一个日期对象，指向当前年份的1月1日
			const startOfYear = new Date(date.getFullYear(), 0, 1);
			// 计算从1月1日到给定日期的天数差
			const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000)) + 1;
	
			// 计算周数，ISO 8601标准下，第一周包含4天
			const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
	
			return weekNumber;
	 	},
		/**
		 * 金额转大写
		 */ 
		convertCurrency : function (money) {  
				//汉字的数字  
				var cnNums = new Array('零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖');  
				//基本单位  
				var cnIntRadice = new Array('', '拾', '佰', '仟');  
				//对应整数部分扩展单位  
				var cnIntUnits = new Array('', '万', '亿', '兆');  
				//对应小数部分单位（去除毫和厘）  
				var cnDecUnits = new Array('角', '分'); // 仅保留角和分  
				//整数金额时后面跟的字符  
				var cnInteger = '整';  
				//整型完以后的单位  
				var cnIntLast = '元';  
				//最大处理的数字  
				var maxNum = 999999999999999.99; // 修改为处理到小数点后两位的最大值  
				//金额整数部分  
				var integerNum;  
				//金额小数部分  
				var decimalNum;  
				//输出的中文金额字符串  
				var chineseStr = '';  
				//分离金额后用的数组，预定义  
				var parts;  
			
				money = parseFloat(money);  
				if (money >= maxNum) {  
						return '';  
				}  
				// 传入的参数为0情况   
				if (money == 0) {  
						return '零元整';  
				}  
				// 转为字符串  
				money = money.toString();  
				// indexOf 检测某字符在字符串中首次出现的位置 返回索引值（从0 开始） -1 代表无  
				if (money.indexOf('.') == -1) {  
						integerNum = money;  
						decimalNum = '';  
				} else {  
						parts = money.split('.');  
						integerNum = parts[0];  
						// 只取小数点后两位  
						decimalNum = parts[1].substr(0, 2);  
				}  
				//转换整数部分  
		if (parseInt(integerNum, 10) > 0) {
				let zeroCount = 0;
				let IntLen = integerNum.length;
				for (let i = 0; i < IntLen; i++) {
						let n = integerNum.substr(i, 1);
						let p = IntLen - i - 1;
						let q = Math.floor(p / 4);
						let m = p % 4;
						if (n == '0') {
								zeroCount++;
						} else {
								if (zeroCount > 0 && m > 0) {
										chineseStr += cnNums[0];
								}
								zeroCount = 0;
								chineseStr += cnNums[parseInt(n)] + (m > 0 ? cnIntRadice[m] : '');
						}
						if (m == 0 && zeroCount < 4) {
								chineseStr += cnIntUnits[q];
						}
				}
				chineseStr += cnIntLast;
		}  
				// 转换小数部分  
				if (decimalNum != '') {  
						let decLen = decimalNum.length;  
						for (let i = 0; i < decLen; i++) {  
								let n = decimalNum.substr(i, 1);  
								if (n != '0') {  
										chineseStr += cnNums[Number(n)] + cnDecUnits[i];  
								}  
						}  
				}  
				if (chineseStr == '') {  
						chineseStr += cnNums[0] + cnIntLast + cnInteger;  
				} else if (decimalNum == '' || decimalNum == '00') { // 如果小数部分为00或空，则添加“整”  
						chineseStr += cnInteger;  
				}  
			
				return chineseStr;  
		}
	},
	ThisValue : {}, // 2024-08-06
	/**
	 * 子表数据
	**/
	CurrentTableData : [],
	Window : {
		Open: function(url){
			window.open(url);
		},
		/**
		 * 加载关联表单（待实现）
		 */
		LoadJoinForm: function(name, value){
			console.log('LoadJoinForm',name, value)
		}
	},
	/**
	 * 刷新关联表单（待实现）
	 */
	ReloadJoinForm: function(name, value){
		console.log('ReloadJoinForm',name, value)
	},
	/*
	* 生成一个前端Guid值
	*/
	NewGuid: function () {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
			var r = Math.random() * 16 | 0
			var v = c == 'x' ? r : (r & 0x3 | 0x8)
			return v.toString(16)
		})
	},
	/*
	* 生成一个服务端Guid值
	*/
	async NewServerGuid () {
		return (await Microi.Post('/api/diytable/NewGuid')).Data;
	},
	/**
	 * 发起流程
	**/
	WF: {

	},
	FormWF: {
		FlowDesignId: '',
		IsWF: false,
		WorkType: ''
	},
	/**
	 * 内置大量函数
	**/
	Method : {
		/**
		 * 日期格式化
		**/
		DateTimeFormat: function(time, format){
			if (!time || !format) {
			  return time
			}
			var o = {
			  'M+': time.getMonth() + 1, // month
			  'd+': time.getDate(), // day
			  'h+': time.getHours(), // hour
			  'H+': time.getHours(), // hour
			  'm+': time.getMinutes(), // minute
			  's+': time.getSeconds(), // second
			  'q+': Math.floor((time.getMonth() + 3) / 3), // quarter
			  'S': time.getMilliseconds() // millisecond
			}
			if (/(y+)/.test(format)) {
			  format = format.replace(RegExp.$1,
				(time.getFullYear() + '').substr(4 - RegExp.$1.length))
			}
			for (var k in o) {
			  if (new RegExp('(' + k + ')').test(format)) {
				format = format.replace(RegExp.$1,
				  RegExp.$1.length == 1 ? o[k]
					: ('00' + o[k]).substr(('' + o[k]).length))
			  }
			}
			return format
		},
		DateDiff : function(time, interval, objDate2) {
		  var d = time
		  var i = {}
		  var t = d.getTime()
		  var t2 = objDate2.getTime()
		  i['y'] = objDate2.getFullYear() - d.getFullYear()
		  i['q'] = i['y'] * 4 + Math.floor(objDate2.getMonth() / 4) - Math.floor(d.getMonth() / 4)
		  i['m'] = i['y'] * 12 + objDate2.getMonth() - d.getMonth()
		  i['ms'] = objDate2.getTime() - d.getTime()
		  i['w'] = Math.floor((t2 + 345600000) / (604800000)) - Math.floor((t + 345600000) / (604800000))
		  i['d'] = Math.floor(t2 / 86400000) - Math.floor(t / 86400000)
		  i['h'] = Math.floor(t2 / 3600000) - Math.floor(t / 3600000)
		  i['n'] = Math.floor(t2 / 60000) - Math.floor(t / 60000)
		  i['s'] = Math.floor(t2 / 1000) - Math.floor(t / 1000)
		  return i[interval]
		},
		/**
		 * 补齐0，如传入(7, 3)，返回'007'
		**/
		Add0 : function(value, length) {
			if (!value || !length) {
				return value
			}
			var count0 = length - value.toString().length
			for (let index = 0; index < count0; index++) {
				value = '0' + value
			}
			return value
		},
	},
	/**
	 * 判断是否为空，如果是undefined、null字符串也返回true。
	 * 如果是数组，则判断数组长度是否为0，如果为0也返回true。
	**/
	IsNull: function(str) {
    if (str == null || str == undefined || str === '' || str === 'undefined' || str === 'null' || (Array.isArray(str) && str.length === 0)) {
        return true
    }
		return false
	},
	/**
	 * 给表单某个字段赋值
	**/
	FormSet : function(fieldName, value, field){
		// 判断fieldName是否存在
		if (V8.Form.hasOwnProperty(fieldName)) {
			V8.Form[fieldName] = value;
		} else {
			V8.Form = {
			 ...V8.Form,
				[fieldName]: value
			}
		}
	},
	/**
	 * 给当前表单字段属性赋值 2024-08-06
	**/
	FieldSet : function(fieldName, value, field){
		// 判断fieldName是否存在
		if (V8.Field.hasOwnProperty(fieldName)) {
			V8.Field[fieldName][value] = field;
		} else {
			V8.Field = {
			 ...V8.Field,
				[fieldName]: {
					[value]: field
				}
			}
		}
	},
	/**
	 * 父表单字段属性赋值 2024-08-13
	**/
	ParentV8 : {
		
	},
	HideFormTab : function(value) {
		console.log('HideFormTab',value)
	},
	LoadMode : function() {
		
	},
	ShowTableChildHideField : function(){
		
	},
	/*
	*访问下拉框选择后的值对象 2024-08-06
	*/
	ThisValueSet : function(obj){
		// for(var key in obj){ //遍历对象
		// 	console.log(key,obj[key],111)
		// 	V8.ThisValue[key] = obj[key]; //将对象属性值赋给obj
		// }
		V8.ThisValue = obj; 
	},
	/**
	 * 打开表单  2024-08-06
	**/
	OpenForm : function(formData, type){
		//console.log('OpenForm111',formData,type)
	},
	/**
	 * 打开任意表单
	**/
	OpenAnyForm : function(params){
		//console.log('OpenAnyForm',params)
	},
	DataAppend : {
	},
	/**
	 * 表单引擎 2024-08-06
	 */
	FormEngine : {

	},
	/**
	 * 接口引擎 2024-08-06
	 */
	ApiEngine : {

	},
	/**
	 * 刷新表单 2024-08-16
	**/
	ReloadForm : function(formData, value){
		//console.log('ReloadForm',formData,value)
	},
	/**
	 * 刷新表格 2024-08-16
	 */
	RefreshTable : function(data){
		//console.log('RefreshTable',data)
	},
	/**
	 * 关闭表单
	 */
	FormClose : function(){
		Microi.ConfirmTips('确认关闭？', function(){
			uni.navigateBack()
		})
	},
	/**
	 * 刷新表格 2024-09-05
	 * @param {Object} formData 父表单中子表数据
	 * @param {Object} obj 刷新对象
	 */
  TableRefresh : function(formData, obj){
		//console.log('TableRefresh',formData,obj)
	},

	/**
	 * 打开表单工作流 2024-08-16
	 * @param {Object} formData 表单数据
	 * @param {Object} type 表单类型
	 * @param {Object} value 表单值
	 */
	OpenFormWF : function(formData, type, value){
		//console.log('OpenFormWF',formData,type,value)
	},
	/*
	中文转拼音
	fullPyLen: 2(默认)，前几个字全拼音；type : 1 驼峰（默认），2全大写，3全小写
	*/
	ChineseToPinyin : function(chinese, fullPyLen = 2, type = 1){
		return ChineseToPinyinFunc(chinese, fullPyLen, type);
	},
	/**
	 * 隐藏编辑/删除按钮 待实现！
	*/
	HideFormBtn : function(value) {
		console.log('HideFormBtn',value)
	},
	/**
	 * 提交表单
	 *  CloseForm：是否关闭Form表单；
	 *  SavedType：保存表单后的操作Insert/Update/View 
	 * 	Callback：回调函数
	**/
	FormSubmit : function (CloseForm, SavedType, Callback) {
		Microi.Tips('待实现！');
	},
	/**
	 * Post请求，同时支持异步、await同步
	**/
	Post : function(){
		alert('待实现！');
	},

	/**
	 * 
	**/
	Run : async function(v8Code){
		try{
			// eval(v8Code);
			if (!eval) {
				// await V8.RunFunction(v8Code)
				await new Function("(async () => {\n " + v8Code + " \n})()")();
			} else {
				await eval("(async () => {\n " + v8Code + " \n})()");
			}
		}catch(e){
			Microi.Tips('执行前端V8代码出现异常：' + (e || e.errMsg || e.message), false, 3000)
			!ConsoleLog || console.log('执行前端V8代码出现异常：' + (e || e.errMsg || e.message));
			console.log(v8Code)
		}
	},
};
/**
 * 日期格式化
 * 用法：new Date().Format('yyyy-MM-dd HH:mm:ss')
 * @param {Object} format
 */
Date.prototype.Format = function(format) {
  if (!format) {
    return this
  }
  var o = {
    'M+': this.getMonth() + 1, // month
    'd+': this.getDate(), // day
    'h+': this.getHours(), // hour
    'H+': this.getHours(), // hour
    'm+': this.getMinutes(), // minute
    's+': this.getSeconds(), // second
    'q+': Math.floor((this.getMonth() + 3) / 3), // quarter
    'S': this.getMilliseconds() // millisecond
  }
  if (/(y+)/.test(format)) {
    format = format.replace(RegExp.$1,
      (this.getFullYear() + '').substr(4 - RegExp.$1.length))
  }
  for (var k in o) {
    if (new RegExp('(' + k + ')').test(format)) {
      format = format.replace(RegExp.$1,
        RegExp.$1.length == 1 ? o[k]
          : ('00' + o[k]).substr(('' + o[k]).length))
    }
  }
  return format
}

/**
 * 日期增加
 * 用法：new Date().AddTime('m', 15) //增加15分钟
 * @param {Object} unit 单位：s（秒）、m（分）、h（时）、d（天）、w（周）、q（季）、M（月）、y（年）
 * @param {Object} number 时长
 */
Date.prototype.AddTime = function(unit, number) {
  var dtTmp = this
  switch (unit) {
    //秒
    case 's':
      return new Date(Date.parse(dtTmp) + (1000 * number))
    //分
    case 'n':
      return new Date(Date.parse(dtTmp) + (60000 * number))
    //分
    case 'm':
      return new Date(Date.parse(dtTmp) + (60000 * number))
    //小时
    case 'h':
      return new Date(Date.parse(dtTmp) + (3600000 * number))
    //小时
    case 'H':
      return new Date(Date.parse(dtTmp) + (3600000 * number))
    //天
    case 'd':
      return new Date(Date.parse(dtTmp) + (86400000 * number))
    //周
    case 'w':
      return new Date(Date.parse(dtTmp) + ((86400000 * 7) * number))
    //季
    case 'q':
      return new Date(dtTmp.getFullYear(), (dtTmp.getMonth()) + number * 3, dtTmp.getDate(), dtTmp.getHours(), dtTmp.getMinutes(), dtTmp.getSeconds())
    //月
    case 'M':
      return new Date(dtTmp.getFullYear(), (dtTmp.getMonth()) + number, dtTmp.getDate(), dtTmp.getHours(), dtTmp.getMinutes(), dtTmp.getSeconds())
    //年
    case 'y':
      return new Date((dtTmp.getFullYear() + number), dtTmp.getMonth(), dtTmp.getDate(), dtTmp.getHours(), dtTmp.getMinutes(), dtTmp.getSeconds())
  }
  return null
}

/**
 * 计算时间差。time2大于前者时，返回正数，反之返回负数。
 * @param {Object} unit 单位：s（秒）、m（分）、h（时）、d（天）、w（周）、q（季）、M（月）、y（年）
 * @param {Object} time2 time2大于前者时，返回正数，反之返回负数。
 */
Date.prototype.DiffTime = function(unit, time2) {
  var d = this
  var i = {}
  var t = d.getTime()
  var t2 = time2.getTime()
  i['y'] = time2.getFullYear() - d.getFullYear()
  i['q'] = i['y'] * 4 + Math.floor(time2.getMonth() / 4) - Math.floor(d.getMonth() / 4)
  i['M'] = i['y'] * 12 + time2.getMonth() - d.getMonth()
  i['ms'] = time2.getTime() - d.getTime()
  i['w'] = Math.floor((t2 + 345600000) / (604800000)) - Math.floor((t + 345600000) / (604800000))
  i['d'] = Math.floor(t2 / 86400000) - Math.floor(t / 86400000)
  i['h'] = Math.floor(t2 / 3600000) - Math.floor(t / 3600000)
  i['H'] = Math.floor(t2 / 3600000) - Math.floor(t / 3600000)
  i['m'] = Math.floor(t2 / 60000) - Math.floor(t / 60000)
  i['s'] = Math.floor(t2 / 1000) - Math.floor(t / 1000)
  return i[unit]
}
// export default Microi

/**
 * MicroiStore 状态管理
 * 获取CurrentUser：
  	import { mapState } from 'vuex'
  	computed: {
		...mapState({
			CurrentUser: function(){
				return this.$MicroiStore.state.CurrentUser;
			},
		}),
	}
 * 设置CurrentUser：
   this.$MicroiStore.commit('SetCurrentUser', { ... });
 */

// #ifndef VUE3
import Vue from 'vue'
import Vuex from 'vuex'
Vue.use(Vuex)

export var MicroiStore = new Vuex.Store({
// #endif
// #ifdef VUE3
import {
	createStore
} from 'vuex'
export var MicroiStore = createStore({
// #endif
	state: {
		SysConfig : Microi.GetSysConfigSync(),
		CurrentUser: Microi.GetCurrentUser(),
		IsLogin: Microi.IsLogin(),
	},
	mutations: {
		SetCurrentUser(state, obj) {
			state.CurrentUser = obj
		},
		SetIsLogin(state, value) {
			state.IsLogin = value
		},
		SysConfig(state, obj) {
			state.SysConfig = obj
		},
	},
	actions: {
		
	}
})
