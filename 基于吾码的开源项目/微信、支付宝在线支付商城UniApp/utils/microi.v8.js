/**
 * V8.V8开发包
 * v3.0.0
 初始化
 1、【非H5发行无需此步】 在index.html <head> 中添加全局变量，用于docker环境变量替换
	注意每行格式需要要一模一样，【var ApiBase = '';】不能去掉空格写成【var ApiBase='';】
  	<script type="text/javascript">
		var ApiBase = '';
		var OsClient = '';
		var FileServer = '';
	</script>
	
 2、main.js：
 import { V8 } from '@/utils/microi.js';
 vue2：Vue.prototype.V8 = V8
 vue3：app.config.globalProperties.V8 = V8
 
 3、vue2在App.vue onLaunch中执行：V8.Init({
				TokenCallback : function(){
					console.log('self.$MicroiStore:', self.$MicroiStore)
					try{
						self.$MicroiStore.commit('SetIsLogin', V8.IsLogin());
						self.$MicroiStore.commit('SetCurrentUser', V8.GetCurrentUser());
					}catch(e){
						console.error(e)
					}
				}
			});//集成了获取系统设置、自动登录、Token定时以旧换新 等等
 */

//------- PCVue3引用，UniApp需注释 START -------
// import axios from 'axios'
// import { microiStore } from "@/pinia/modules/microi";
// import { ElNotification, ElMessageBox } from 'element-plus'
//------- PCVue3引用，UniApp需注释 END -------

/**
 * 是否显示常用的console.log信息
 */
var ConsoleLog = true;
/**
 * 包引用
 */
import { MicroiConfig } from './microi.config.js'

var osClientRegExp = new RegExp('(^|&)' + 'OsClient' + '=([^&]*)(&|$)')
var regexpResult = window.location.search.substr(1).match(osClientRegExp)
var urlOsClient = regexpResult != null ? regexpResult[2] : null;

/**
 * 全局Microi对象
 */
export var V8 = {
	Store : null,
	IDE: window.IDE || MicroiConfig.IDE, //开发环境：UniApp、PCVue3、
	ApiBase: window.ApiBase || MicroiConfig.ApiBase, //接口前缀，前端写死
	OsClient: urlOsClient || window.OsClient || MicroiConfig.OsClient, //OsClient值，前端写死
	FileServer : window.FileServer || MicroiConfig.FileServer, //自动从SysConfig系统设置中获取
	H5Url:'',
	AppLogo: MicroiConfig.AppLogo,///jinhai/img/20240203/jinhai-logo.jpeg
	AppKey: '',
	DateTimeNow : new Date(),//将会被替换为服务器时间
	ConsoleLog : ConsoleLog, //是否显示常用的console.log信息
	ClientType:'',//APP、WeChat、H5
	ClientSystem:'',//Android、IOS
	SpiderApiBase : MicroiConfig.SpiderApiBase,
	PageUrlLogin :  MicroiConfig.PageUrlLogin,
	PageSizes: MicroiConfig.PageSizes,///jinhai/img/20240203/jinhai-logo.jpeg
	SysConfig : {},
	Api: {
		MicroiInit : '/apiengine/microi-init',//获取系统设置，此接口后端会走缓存
		GetSysConfig : '/api/DiyTable/getSysConfig',//获取系统设置，此接口后端会走缓存
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
		GetTableDataTree : '/api/FormEngine/getTableDataTree',//获取树形列表数据
		GetTableDataTreeAnonymous : '/api/FormEngine/getTableDataTreeAnonymous',//获取树形列表数据
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
		GetOsClientByDomain : '/api/Os/getOsClientByDomain',//根据域名获取OsClient值
		GetCaptcha : '/api/Captcha/getCaptcha',
		GetDiyField: '/api/diyfield/getDiyField',
		GetDiyFieldByDiyTables: '/api/diyfield/getDiyFieldByDiyTables',
		GetFieldsData: '/api/diytable/getFieldsData',
		GetDiyFieldSqlData: '/api/diytable/getDiyFieldSqlData',
		GetSysMenuStep: '/api/SysMenu/GetSysMenuStep',
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
		},
		GetSysUser: '/api/SysUser/getSysUser',
		UptSysUser: '/api/SysUser/uptSysUser',
		AddSysUser: '/api/SysUser/addSysUser',
		DelSysUser: '/api/SysUser/delSysUser',
		GetSysRole: '/api/sysrole/getSysRole',
		GetSysRoleModel: '/api/sysrole/getSysRoleModel',
		DiyLogin: '/api/SysUser/diylogin',
		Login: '/api/SysUser/login',
		TokenLogin: '/api/SysUser/tokenlogin',
		GetSysBaseData: '/api/SysBaseData/getSysBaseData',
		GetBizWechat: '/api/BizWechat/GetBizWechat',
		Logout: '/api/SysUser/Logout',
		UploadPreview: '/api/HDFS/Upload',
		Upload: '/api/HDFS/Upload',
		AddSysMenu: '/api/SysMenu/addSysMenu',
		DelSysMenu: '/api/SysMenu/delSysMenu',
		UptSysMenu: '/api/SysMenu/uptSysMenu',
		GetSysMenu: '/api/SysMenu/getSysMenu',
		GetSysMenuStep: '/api/SysMenu/getSysMenuStep',
		GetSysMenuModel: '/api/SysMenu/getSysMenuModel',
		GetWxEditorTpl: '/api/os/GetWxEditorTpl',
		DelSysRole: '/api/SysRole/delSysRole',
		UptSysRole: '/api/SysRole/UptSysRole',
		AddSysRole: '/api/SysRole/AddSysRole',
		AddSysBaseData: '/api/SysBaseData/addSysBaseData',
		DelSysBaseData: '/api/SysBaseData/delSysBaseData',
		UptSysBaseData: '/api/SysBaseData/uptSysBaseData',
		GetSysBaseDataStep:'/api/SysBaseData/getSysBaseDataStep',
		AddSysRichText: '/api/SysRichText/AddSysRichText',
		DelSysRichText: '/api/SysRichText/DelSysRichText',
		UptSysRichText: '/api/SysRichText/UptSysRichText',
		GetSysRichText: '/api/SysRichText/GetSysRichText',
		GetSysRichTextStep: '/api/SysRichText/GetSysRichTextStep',
		GetSysDept: '/api/SysDept/getSysDept',
		GetSysDeptStep: '/api/SysDept/getSysDeptStep',
		AddSysDept: '/api/SysDept/addSysDept',
		UptSysDept: '/api/SysDept/uptSysDept',
		DelSysDept: '/api/SysDept/delSysDept',
		LoadNotDiyTable: '/api/diytable/loadNotDiyTable',
		GetNotDiyTable: '/api/diytable/getNotDiyTable',
		GetDiyTable: '/api/diytable/getDiyTable',
		AddDiyTable: '/api/diytable/addDiyTable',
		DelDiyTable: '/api/diytable/delDiyTable',
		UptDiyTable: '/api/diytable/uptDiyTable',
		GetDiyTableModel: '/api/diytable/getDiyTableModel',
		AddDiyTableRow: '/api/FormEngine/addFormData',
		AddDiyTableRowBatch: '/api/diytable/addDiyTableRowBatch',
		DelDiyTableRowBatch: '/api/diytable/delDiyTableRowBatch',
		DelDiyDataListByWhere: '/api/diytable/delDiyDataListByWhere',
		UptDiyTableRowBatch: '/api/diytable/uptDiyTableRowBatch',
		GetDiyTableRow: '/api/FormEngine/getTableData',
		GetDiyTableRowTree: '/api/diytable/getDiyTableRowTree',
		GetDiyTableRowModel: '/api/FormEngine/getFormData',
		DelDiyTableRow: '/api/FormEngine/delFormData',
		UptDiyTableRow: '/api/FormEngine/uptFormData',
		UptDiyDataListByWhere: '/api/diytable/uptDiyDataListByWhere',
		GetDiyFieldSqlData: '/api/diytable/getDiyFieldSqlData',
		GetFieldsData: '/api/diytable/getFieldsData',
		RunSqlGetList: '/api/diytable/runSqlGetList',
		RunSqlGetModel: '/api/diytable/runSqlGetModel',
		GetImportDiyTableRowStep: '/api/diytable/getImportDiyTableRowStep',
		GetDiyField: '/api/diyfield/getDiyField',
		GetDiyFieldByDiyTables: '/api/diyfield/getDiyFieldByDiyTables',
		AddDiyField: '/api/diyfield/addDiyField',
		DelDiyField: '/api/diyfield/delDiyField',
		UptDiyField: '/api/diyfield/uptDiyField',
		GetDiyFieldModel: '/api/diyfield/getDiyFieldModel',
		UptDiyFieldList: '/api/diyfield/uptDiyFieldList',
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
			console.log('Microi： V8.Init() START');
			
			V8.Store = microiStore();
			V8.Store.LoadState();

			var desktopType = 'macos';
			var initResult = await V8.Post(V8.ApiBase + V8.Api.MicroiInit, {
				Domain : location.host.toLocaleLowerCase(),
				Token : V8.GetToken(),
				OsClient : V8.OsClient,
				DesktopType : desktopType,
				UserSelfLogout : V8.Store.UserSelfLogout
			}, null, {
				Headers : {
					'osclient': V8.OsClient //这一步必须，否则在切换saas后初始化时可能从缓存中获取错误的OsClient值
				}
			});

			console.log('Microi： V8.Init api');

			if(initResult.Code == 1){
				V8.Store.SetState('MicroiInitDone', true);
				
				V8.Store.SetState('OsClient', initResult.Data.OsClient);
				V8.OsClient = initResult.Data.OsClient;

				V8.Store.SetState('SysConfig', initResult.Data.SysConfig);
				V8.SysConfig = initResult.Data.SysConfig;

				V8.Store.SetState('CurrentUser', initResult.Data.CurrentUser);

				V8.Store.SetState('ModuleList', initResult.Data.ModuleList);
				document.title = initResult.Data.SysConfig.SysTitle;

				V8.Store.SetState('DesktopDockMenu', initResult.Data.DesktopDockMenu);
			}
			
			//每分钟检查token是否快过期，若快过期则刷新token
			setInterval(function(){
				V8.RefreshToken(param && param.TokenCallback);
			}, 1000 * 60)

			V8.IsPhoneView = window.innerWidth <= 768;
			V8.Store.SetState('IsPhoneView', V8.IsPhoneView);
			
			console.log('Microi： V8.Init() END');

			//首次进入操作系统进度提升50%
			LoadRate(50);
		} catch (e) {
		  V8.Tips('系统初始化失败：' + (e.message || e.Msg), false)
		  !ConsoleLog || console.log('Microi：系统初始化失败：' + (e.message || e.Msg))
		  console.log('Microi： V8.Init() ERROR', e);
		}
	},
	/**
	 * 初始化，必须执行！
	**/
	// Init : function(formData, fieldList){
	// 	V8.Form = formData;
		
	// 	var fields = {};
	// 	fieldList.forEach(item => {
	// 		fields[item.Name] = item;
	// 	});
	// 	V8.Field = fields;
		
	// 	return V8;
	// },
	/**
	 * 表单数据，引用类型
	**/
	Form : {},
	/**
	 * 字段列表数据对象
	**/
	Field : {},
	Extend : {},
	Window : {
		Open: function(url){
			window.open(url);
		}
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
	**/
	IsNull : function(str){
		if (str == null || str == undefined || str === '' || str === 'undefined' || str === 'null') {
			return true
		}
		return false
	},
	/**
	 * 给表单某个字段赋值
	**/
	FormSet : function(fieldName, value, field){
		V8.Form[fieldName] = value;
	},
	/**
	 * Post请求，同时支持异步、await同步
	**/
	// Post : function(){
	// 	alert('待实现！');
	// },
	/**
	 * 
	**/
	Run : async function(v8Code){// 
		try{
			// eval(v8Code);
			await eval("(async () => {\n " + v8Code + " \n})()");
		}catch(e){
			V8.Tips('执行前端V8代码出现异常：' + e.message)
			!ConsoleLog || console.log('执行前端V8代码出现异常：' + e.message);
		}
	},
	GetFileServerUrl(url){
		if(!url){
			return url;
		}
		return V8.FileServer + url;
	},
	GetStorageSync(key){
		return localStorage.getItem(key);
	},
	SetStorageSync(key, value){
		return localStorage.setItem(key, value);
	},
	GetOsClientByDomain: async function(getCache){
		try{
			if(getCache){
				var osClient = V8.GetStorageSync("OsClient");
				if(osClient){
					V8.OsClient = osClient;
					return;
				}
			}
			var getOsClientResult = await V8.Post(V8.ApiBase + V8.Api.GetOsClientByDomain, {
				Domain : location.host.toLocaleLowerCase()
			}, null, {
				DataType : 'form'
			});
			console.log('Microi： V8.Init() GetOsClientByDomain()');
			if(getOsClientResult.Code == 1){
				V8.OsClient = getOsClientResult.Data.OsClient;
				// V8.SetStorageSync("OsClient", getOsClientResult.Data.OsClient);
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
			var sysConfigStr = V8.GetStorageSync("SysConfig");
			if(sysConfigStr){
				return JSON.parse(sysConfigStr);
			}
		}
		var getSysConfigResult = await V8.Post(V8.ApiBase + V8.Api.GetSysConfig, {
			OsClient : V8.OsClient,
			_SearchEqual : {
				IsEnable : 1
			}
		}, null, {
			DataType : 'form'
		});

		console.log('Microi： V8.Init() GetSysConfig()');

		if(!getSysConfigResult.Code){
			V8.Tips('获取系统设置失败：' + getSysConfigResult.Msg);
			!ConsoleLog || console.log('Microi：获取系统设置失败：', getSysConfigResult.Msg);
			return null;
		}
		var getSysConfig = getSysConfigResult.Data;
		
		if(getSysConfig.FileServer){
			V8.FileServer = getSysConfig.FileServer;
		}
		if(getSysConfig.AppLogo){
			V8.AppLogo = getSysConfig.AppLogo;
		}
		if(getSysConfig.H5Url){
			V8.H5Url = getSysConfig.H5Url;
		}
		
		V8.SysConfig = getSysConfig;
		!ConsoleLog || console.log('Microi：获取系统设置信息成功：', getSysConfig);
		// V8.SetStorageSync('SysConfig', JSON.stringify(getSysConfig));
		return getSysConfig;
	},
	/**
	 * 同步获取系统设置信息
	 */
	GetSysConfigSync: function(){
		var sysConfigStr = V8.GetStorageSync("SysConfig");
		if(sysConfigStr){
			return JSON.parse(sysConfigStr);
		}
		return null;
	},
	SetSysConfig: function(sysConfig){
		if(typeof(sysConfig) == 'string'){
			V8.SetStorageSync("SysConfig", sysConfig);
		}else{
			V8.SetStorageSync("SysConfig", JSON.stringify(sysConfig));
		}
	},
	InitDateTimeTimer : null,
	InitDateTimeNow: function(){
		V8.Post(V8.ApiBase + V8.Api.GetDateTimeNow, {}, function(result){
			if(result.Code){
				V8.DateTimeNow = new Date(result.Data);
				try{
					clearInterval(V8.InitDateTimeTimer)
				}catch(e){}
				V8.InitDateTimeTimer = setInterval(function(){
					V8.DateTimeNow = V8.DateTimeNow.AddTime('s', 1);
				}, 1000)
			}
		});
	},
	
	RefreshLoginUser: async function(){
		var result = await V8.Post(V8.ApiBase + V8.Api.RefreshLoginUser);
		// if(V8.CheckResult(result)){
		if(result.Code){
			V8.SetCurrentUser(result.Data);
		}
		return result;
	},
	/**
	 * token以旧换新
	 */
	RefreshToken: async function(callback){
		//获取token 或身份信息，判断登录自动
		var token = V8.GetToken();
		var currentUser = V8.GetCurrentUser();
		//如果存在token，判断是否已过期
		if (token) {
			var expires = V8.Store.GetState("TokenExpires");
			//如果已过期，或不存在登录身份信息，则使用token以旧换新
			if(!expires || !currentUser || !currentUser.Id || new Date() >= new Date(expires)){
				var result = await V8.Post(V8.ApiBase + V8.Api.RefreshToken, {
					authorization : token
				});

				console.log('Microi： V8.Init() RefreshToken()');

				if(result.Code){
					V8.SetCurrentUser(result.Data);
					if(callback){
						callback()
					}
				}else{
					//如果已经超过18分钟，将身份信息置空
					if(!expires || new Date().DiffTime('m', new Date(expires)) < 2){
						V8.SetCurrentUser({});
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
	ArrayBufferToBase64(arrayBuffer) {
		// 将 ArrayBuffer 转换为 Uint8Array
		const uint8Array = new Uint8Array(arrayBuffer);
	
		// 将 Uint8Array 转换为二进制字符串
		let binary = '';
		uint8Array.forEach((byte) => {
			binary += String.fromCharCode(byte);
		});
	
		// 使用 btoa 方法将二进制字符串转换为 Base64
		return btoa(binary);
	},
	/**
	 * 表单引擎
	 */
	FormEngine : {
		/**
		 * 新增简洁用法：V8.AddFormData('sys_user', { Name : '', Account : '' }, function(){ ... })
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
			var result = await V8.Post(V8.Api.AddFormData, realParam, realCallback);
			return result;
		},
		AddFormDataBatch : async function(param, callback){
			var result = await V8.Post(V8.Api.AddFormDataBatch, param, callback);
			return result;
		},
		DelFormData : async function(param, callback){
			var result = await V8.Post(V8.Api.DelFormData, param, callback);
			return result;
		},
		DelFormDataBatch : async function(param, callback){
			var result = await V8.Post(V8.Api.DelFormDataBatch, param, callback);
			return result;
		},
		DelFormDataByWhere : async function(param, callback){
			var result = await V8.Post(V8.Api.DelFormDataByWhere, param, callback);
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
			var result = await V8.Post(V8.Api.UptFormData, realParam, realCallback);
			return result;
		},
		UptFormDataByWhere : async function(param, callback){
			var result = await V8.Post(V8.Api.UptFormDataByWhere, param, callback);
			return result;
		},
		UptFormDataBatch : async function(param, callback){
			var result = await V8.Post(V8.Api.UptFormDataBatch, param, callback);
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
			var result = await V8.Post(V8.Api.GetFormData + '-' + realParam.FormEngineKey, realParam, realCallback);
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
			var result = await V8.Post(V8.Api.GetFormDataAnonymous, realParam, realCallback);
			return result;
		},
		GetTableData : async function(paramOrFormEngineKey, paramOrCallback, callback){
			var realParam = {
				FormEngineKey : '',
			};
			var realCallback;
			if(typeof(paramOrFormEngineKey) == 'string'){
				realParam.FormEngineKey = paramOrFormEngineKey;
				if(!paramOrCallback){
					paramOrCallback = {};
				}
				for(let key in paramOrCallback){
					realParam[key] = paramOrCallback[key]
				}
				realCallback = callback;
			}else{
				realParam = paramOrFormEngineKey;
				realCallback = paramOrCallback;
			}
			var result = await V8.Post(V8.Api.GetTableData, realParam, realCallback);
			return result;
		},
		/**
		 * 匿名获取表列表数据，需要在表单属性中开启【允许匿名读取】
		 * 用法1：V8.FormEngine.GetTableDataAnonymous('sys_user', {
					_Where : [{}]
				 }, function(result){
					 
				 });
		 * 用法2：V8.FormEngine.GetTableDataAnonymous({
					FormEngineKey : 'sys_user',
					_Where : [{}],
				 }, function(result){
					 
				 });
		 */
		GetTableDataAnonymous : async function(paramOrFormEngineKey, paramOrCallback, callback){
			var realParam = {
				FormEngineKey : '',
			};
			var realCallback;
			if(typeof(paramOrFormEngineKey) == 'string'){
				realParam.FormEngineKey = paramOrFormEngineKey;
				if(!paramOrCallback){
					paramOrCallback = {};
				}
				for(let key in paramOrCallback){
					realParam[key] = paramOrCallback[key]
				}
				realCallback = callback;
			}else{
				realParam = paramOrFormEngineKey;
				realCallback = paramOrCallback;
			}
			var result = await V8.Post(V8.Api.GetTableDataAnonymous, realParam, realCallback);
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
				if(V8.Api.ApiEngine[param.ApiEngineKey]){
					url = V8.Api.ApiEngine[param.ApiEngineKey];
				}
				var result = await V8.Post(url, param, callback, { IsApiEngine : true });
				return result;
			}else{
				//如果是这种模式：.Run({}, function(){})
				var result = await V8.Post(url, dataOrCallback);
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
				var result = await V8.Post('/api/ModuleEngine/run', param, callback);
				return result;
			}else{
				//如果是这种模式：.Run({}, function(){})
				var result = await V8.Post('/api/ModuleEngine/run', dataOrCallback);
				return result;
			}
		},
	},
    /**
	 * 同步获取当前用户登录身份信息
     */
	GetCurrentUser: function(refresh, callback){
		if(refresh){
			V8.Post(V8.ApiBase + V8.Api.GetCurrentUser, {}, function(result){
				if(result.Code){
					V8.SetCurrentUser(result.Data);
				}
				if(callback){
					callback(result);
				}
			});
		}
		if(V8.IDE == 'UniApp'){
			var currentUserStr = uni.getStorageSync("CurrentUser");
			if(currentUserStr){
				var result = JSON.parse(currentUserStr);
				return result || {};
			}else{
				return {};
			}
		}else{
			var currentUser = V8.Store.GetState("CurrentUser");
			return currentUser || {};
		}
	},
	/**
	 * 同步设置当前登录身份信息
	 */
	SetCurrentUser: function(currentUser){
		V8.Store.SetState("CurrentUser", currentUser);
	},
	/**
	 * 同步获取当前token值
	 */
	GetToken: function(){
		if(V8.IDE == "UniApp"){
			return uni.getStorageSync("Token");
		}else{
			return V8.Store.GetState("authorization");
		}
	},
	/**
	 * 同步设置当前token值，同时设置过期时间为15分钟后（服务器为20分钟，最后5分钟会以旧换新）
	 * @param {Object} token
	 */
	SetToken: function(token){
		V8.Store.SetState('authorization', token);
		if(!token){
			V8.Store.SetState("TokenExpires", '');
			V8.SetCurrentUser({});
			V8.Store.SetState('ModuleList', []);
			V8.Store.SetState('DesktopDockMenu', []);
		}else{
			V8.Store.SetState("TokenExpires", new Date().AddTime('m', 15).Format('yyyy-MM-dd HH:mm:ss'));
		}
	},
	/**
	 * 用户登录。传入Account、Pwd、
	 * @param {Object} param
	 */
	Login: async function(param){
		var result = await V8.Post(V8.Api.Login, param, null, {
			DataType : 'form'
		});
		if(result.Code){
			V8.SetCurrentUser(result.Data);
		}else{
			V8.Tips('登录失败：' + result.Msg, false);
		}
		return result;
	},
	/**
	 * 用户退出登陆
	 * 此函数并未调用服务器端接口，防止用户多端同时登陆时，被一起踢下线
	 * 后期服务器端会实现多端同时登陆时使用不同token
	 */
	Logout: function(){
		V8.SetToken('');
		V8.Store.SetState('UserSelfLogout', true);
		// this.authorization = ''
		// this.TokenExpires = ''
		// this.CurrentUser = {}
	},
	/**
	 * 提示
	 * @param {Object} text 提示内容
	 * @param {Object} isSuccess 是否成功，默认true
	 * @param {Object} time 持续时间，单位毫秒，默认1000，isSuccess为false时默认2000
	 */
	Tips: function(text, isSuccess, timeOrOption) {
        if (isSuccess == undefined) {
            isSuccess = true
        }
		if(V8.IDE == 'UniApp'){
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
				|| V8.GetStrLength(title) <= 14 //文字小于7个汉字，即使有图标也使用 showToast
				|| V8.ClientType == 'H5'//H5不需要转uni.showModal
				){
				uni.showToast({
					title: title,
					icon: Icon || (isSuccess ? 'success' : 'error'),//error(有效)、fail(无效)、exception(无效)
					duration: Time || (isSuccess ? 1000 : 2000),
					// iconClass: 'microi-toast',//无效
					// cssClass: 'microi-toast',//无效
					class: CssClass || 'microi-toast',//有效
					position : 'center',//（仅App生效）、top、bottom
				})
			}else{
				V8.ConfirmTips(title, null, {
					ShowCancel : false,
					OKText : OKText || '知道了'
				})
			}
		}else{
			timeOrOption = isSuccess ? 1000 : 5000
			// element-ui提示   success, warning, info, error
			var nParam = {
			    title: '提示',//i18n.messages[i18n.locale].Msg.Tips,
			    message: text,
			    type: isSuccess === false ? 'error' : 'success',
			    position: 'bottom-right',
			    offset: 40,
			    dangerouslyUseHTMLString: true,
				duration : timeOrOption,
			}
			ElNotification(nParam)
			
			if (isSuccess === false) {
			    //播放声音
			}
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
		if(V8.IDE == 'PCVue3'){
			if (!option.Title) {
				option.Title = '提示';//i18n.messages[i18n.locale].Msg.Tips
			}
			if (!option.Icon) {
				option.Icon = 'warning'
			}
			if (!option.OkText) {
				option.OkText = '确认';//i18n.messages[i18n.locale].Msg.Ok
			}
			if (!option.CancelText) {
				option.CancelText = '取消';//i18n.messages[i18n.locale].Msg.Cancel
			}
			if (!option.ShowClose) {
				option.ShowClose = true;
			}
			if (!option.ShowCancelButton) {
				option.ShowCancelButton = true;
			}
			ElMessageBox.confirm(content, option.Title, {
				confirmButtonText: option.OkText,
				cancelButtonText: option.CancelText,
				type: option.Icon,
				roundButton: false,
				dangerouslyUseHTMLString: true,
				cancelButtonClass: 'dialog-cancel',
				closeOnClickModal: false,
				closeOnPressEscape: false,
				closeOnHashChange: false,
				showClose: option.ShowClose,
				showCancelButton: option.ShowCancelButton,
			}).then(() => {
				callback()
			}).catch(() => {
				if (CancelCallback) {
					CancelCallback()
				}
			})
		}
		else{
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
		}
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
		V8.Loading(title, mask);
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
		if(!url){
			var errorResult = {
				Code : false,
				Msg : 'url不能为空！'
			}
			if(callback){
				callback(errorResult);
			}
			return errorResult;
		}
		var fullUrl = url.startsWith('http') || url.startsWith('wxfile://') ? url : V8.ApiBase + url;
		var result = await V8.request({
			...option,
			Url : url,
			Data : data,
		});
		if(callback){
			callback(result.data, result.headers);
		}
		if(result.data == null || typeof(result.data) != 'object'){
			return result.data;
		}
		return {...result.data, Headers : result.headers};
	},

	/**
	 * Post并发请求
	 * @param {Object} allParams
	 * @param {Object} callback
	 */
	PostAll: async function(allParams, callback){
		var requestOptionsArr = [];
		allParams.forEach(param => {
			var { Url, Method, Data, Param, DataType, IsApiEngine, Header, ResponseType } = param;
			if(!DataType){
				DataType = 'json';
			}
			if(!Data && Param){
				Data = Param;
			}
			if(!Data){
				Data = {};
			}
			// Data.OsClient = V8.Store.OsClient;
			var fullUrl = Url.startsWith('http') || Url.startsWith('wxfile://') ? Url : V8.ApiBase + Url;
			var header = {
						'content-type': DataType.toLowerCase() != 'form' ? 'application/json' : 'application/x-www-form-urlencoded',
						osclient: V8.OsClient,
						clienttype : Data._ClientType,
						clientsystem : Data._ClientSystem,
						apiengine : IsApiEngine || 0,
						// did : DiyCommon.GetDid(),
						mac : localStorage.getItem('mac'),
						lang : localStorage.getItem('lang')
					};
			var getToken = V8.GetToken();
			if(getToken){
				header.authorization = 'Bearer ' + getToken;
			}
			if(Header){
				for (let key in Header) {
					header[key] = Header[key];
				}
			}
			var requestOptions = {
				url: fullUrl,
				data: Data,
				headers: header,
				method: Method || 'POST',
				dataType: DataType || 'json',
				changeOrigin: true,
				responseType: 'json',
			};
			if(requestOptions.method.toLowerCase() == 'get'){
				requestOptions.params = Data;
			}
			if(ResponseType){
				requestOptions.responseType = ResponseType;
			}
			requestOptionsArr.push(axios(requestOptions));
		});
		return await new Promise((resolve, reject) => {
			axios.all(requestOptionsArr).then(function (results) {
				var resultArr = [];
				results.forEach(item => {
					// 拿到token，存起来
					var token = item.headers.authorization
					if (token) {
						V8.SetToken(token);
					}
					if(item.data && item.data.Code == 1001){
						V8.SetToken('');
					}
					resultArr.push({...item.data, Headers : item.headers});
				});
				if(callback){
					callback(resultArr);
				}
			}).catch(function (error) {
				var errResult = [{
					Code : 0, 
					Data: error,
					Msg : `网络出现问题，请重试：${error.message}`
				}];
				if(callback){
					callback(errResult);
				}
				resolve(errResult);
			})
		})
	},
	
	/**
	 * Get请求
	 * @param {Object} url
	 * @param {Object} data
	 * @param {Object} callback
	 * @param {Object} option
	 */
	Get: async function(url, data, callback, option){
		var fullUrl = url.startsWith('http') || url.startsWith('wxfile://') ? url : V8.ApiBase + url;
		var result = await V8.request({
			...option,
			Url : url,
			Data : data,
			Method : 'GET'
		});
		if(callback){
			callback(result.data, result.headers);
		}
		if(option.ResponseType == 'arraybuffer'){
			var tempResult = { Code : 1, Data : result.data };
			tempResult.Headers = result.headers;
			return tempResult;
		}else{
			return {...result.data, Headers : result.headers};
		}
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
		var { Url, Method, Data, Param, DataType, IsApiEngine, Header, Headers, ResponseType, Timeout } = param;
		if(!DataType){
			DataType = 'json';
		}
		if(!Data && Param){
			Data = Param;
		}
		if(!Data){
			Data = {};
		}
		// Data.OsClient = V8.Store.OsClient;
		var fullUrl = Url.startsWith('http') || Url.startsWith('wxfile://') ? Url : V8.ApiBase + Url;
		var header = {
					'content-type': DataType.toLowerCase() != 'form' ? 'application/json' : 'application/x-www-form-urlencoded',
					osclient: V8.OsClient,
					clienttype : Data._ClientType,
					clientsystem : Data._ClientSystem,
					apiengine : IsApiEngine || 0,
					// did : DiyCommon.GetDid(),
					mac : localStorage.getItem('mac'),
					lang : localStorage.getItem('lang')
				};
		var getToken = V8.GetToken();
		if(getToken){
			header.authorization = 'Bearer ' + getToken;
		}
		if(Header){
			for (let key in Header) {
				header[key] = Header[key];
			}
		}
		if(Headers){
			for (let key in Headers) {
				header[key] = Headers[key];
			}
		}
		var requestOptions = {
			url: fullUrl,
			data: Data,
			timeout: Timeout || 10 * 1000,
			// headers: header,
			method: Method || 'POST',
			dataType: DataType || 'json',
			changeOrigin: true,
			responseType: 'json',
		};
		if(V8.IDE == 'UniApp'){
			requestOptions.header = header;
		}else{
			requestOptions.headers = header;
		}
		if(requestOptions.method.toLowerCase() == 'get'){
			requestOptions.params = Data;
		}
		if(ResponseType){
			requestOptions.responseType = ResponseType;
		}
		if(V8.IDE == "UniApp"){
			return new Promise((resolve, reject) => {
				uni.request({
					...requestOptions,
					success: (res) => {
						let token = res.header.Authorization || res.header.authorization
						if(token){
							V8.SetToken(token)
						}
						resolve(res);
					},
					fail: (res) => {
						V8.Tips(`网络出现问题，请重试：${res.errMsg}`, false, {
							MustTips : true,
							Icon : 'none'
						})
						!ConsoleLog || console.log('Microi：request fail 网络出现问题，请重试：', res)
						resolve({
							Code : 0, 
							Data: res,
							Msg : `网络出现问题，请重试：${res.errMsg}`
						})
					}
				})
			})
		}else{
			return await new Promise((resolve, reject) => {
				axios(requestOptions).then(function (req, b, c) {
					// 拿到token，存起来
					var token = req.headers.authorization
					if (token) {
						V8.SetToken(token);
					}
					if(req.data && req.data.Code == 1001){
						V8.SetToken('');
					}
					resolve(req);
				}).catch(function (error) {
					resolve({ data : {
						Code : 0, 
						Data: error,
						Msg : `网络出现问题，请重试：${error.message}`
					} });
				})
			})
		}
	},
	/**
	 * 添加系统日志
	 * @param {Object} param
	 */
	AddSysLog(param){
		V8.Post(V8.ApiBase + V8.Api.AddSysLog, param, function(){
			
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
			V8.Tips(result.Msg, false, 3000)//'操作失败：' + 
			return false;
		}
		return true;
	},
	//判断是否登录
	IsLogin: function() {
		var currentUser = V8.GetCurrentUser().Id ? true : false
		var token = V8.GetToken() ? true : false
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
		if (isVerify && !V8.IsLogin()) {
			uni.navigateTo({
				url: '/pages/login/login'
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
		V8.NavigateTo(url, isVerify);
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
			V8.Tips('前端参数错误！', false);
			return { Code : 0, Msg : '前端参数错误！' };
		}
		param.OsClient = V8.OsClient;
		var header = {
					// 'content-type': DataType.toLowerCase() != 'form' ? 'application/json' : 'application/x-www-form-urlencoded',
					osclient: V8.OsClient,
					clienttype : param._ClientType,
					clientsystem : param._ClientSystem,
					// apiengine : IsApiEngine || 0,
					// did : DiyCommon.GetDid(),
					mac : localStorage.getItem('mac'),
					lang : localStorage.getItem('lang')
				};
		var getToken = V8.GetToken();
		if(getToken){
			header.authorization = 'Bearer ' + getToken;
		}
		var uploadUrl = V8.ApiBase + V8.Api.Upload;
		if(param._UseUniappUpload){
			if(!param._Anonymous){
				uploadUrl = V8.ApiBase + V8.Api.UniappUpload;
			}else{
				uploadUrl = V8.ApiBase + V8.Api.UniappUploadAnonymous;
			}
		}else if(param._Anonymous){
			uploadUrl = V8.ApiBase + V8.Api.UploadAnonymous;
		}
		var file = param.File.toString();
		if(file.startsWith('data:')){
			//第一种方式：
			// file = V8.ImgBase64ToFile(file, 'temp.png')
			//第二种方式（使用uni.request）：
			// 构建FormData对象并添加base64图片数据
			// var formData = new FormData();
			// formData.append('user', 'temp');
			// formData.append('file', V8.ImgBase63ToBlob(file), 'temp.png');
			//第三种方式（使用uni.uploadFile）：
			// file = V8.ImgBase63ToBlob(file);
			//第四种方式：
			// file = uni.base64ToArrayBuffer(file);
		}
		V8.Loading('上传中...')
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
					V8.HideLoading()
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
					V8.HideLoading()
					if(callback){
						callback({ Code : 0 , Data : res, Msg : res.errMsg });
					}
					resolve({ Code : 0 , Data : res, Msg : res.errMsg })
					// that.toast(res.msg);
				}
			})
		})
	},
	UploadAnonymous: async function(param, callback) {
		param._Anonymous = true;
		return await V8.Upload(param, callback);
	},
	Download: async function(url, option, callback) {
		if(!url){
			V8.Tips('前端参数错误！', false);
			return { Code : 0, Msg : '前端参数错误！' };
		}
		V8.Loading('下载中...')
		return new Promise((resolve, reject) => {
			const uploadTask = uni.downloadFile({
				url: url,
				success: function(res) {
					V8.HideLoading()
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
					V8.HideLoading()
					if(callback){
						callback({ Code : 0 , Data : res, Msg : res.errMsg });
					}
					resolve({ Code : 0 , Data : res, Msg : res.errMsg })
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
		return V8.ImgExtensions.includes(fileExtension);
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
	GetUrlQuery(property, self){
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

/**
 * 1. 在调用的时候必须写v-
 * 2. 在使用的组件上或者div的位置必须是绝对的，在需要拖拽的最外层样式上加上 position: absolute;
 * 3. 在所需要的样式上使用 v-drag
 * 4. 激活之后的样式名为 v-drag-active 没有激活的样式名为 v-drag-inactive
 *
 * @author iTdos
 * @type {DirectiveOptions}
 */
// export const drag = Vue.directive('drag', {
//     // 指令绑定到元素上回立刻执行bind函数，只执行一次
//     bind: function (el) {

//     },
//     //inserted表示一个元素，插入到DOM中会执行inserted函数，只触发一次
//     inserted: function (el) {
//         let wMax = document.documentElement.clientWidth - el.offsetWidth;
//         let hMax = document.documentElement.clientHeight - el.offsetHeight;
//         if ("ontouchstart" in window) { // 移动端
//             el.ontouchstart = function (e) {
//                 let time1 = new Date().getTime();
//                 let x = e.touches[0].pageX - el.offsetLeft;
//                 let y = e.touches[0].pageY - el.offsetTop;
//                 // 抑制浏览器端默认拖拽行为，移动端是拖拽屏幕，pc端无
//                 // e.preventDefault(); 开启后点击 子集点击事件事件会无效
//                 document.ontouchmove = function (e) {
//                     let time2 = new Date().getTime();
//                     if (time2 - time1 > 300) {
//                         el.classList.remove('v-drag-inactive')
//                         el.classList.add('v-drag-active')
//                     }
//                     let left = e.touches[0].pageX - x;
//                     let top = e.touches[0].pageY - y;

//                     if (left < 0) left = 0;
//                     else if (left > wMax) left = wMax;

//                     if (top < 0) top = 0;
//                     else if (top > hMax) top = hMax;

//                     el.style.left = left + 'px';
//                     el.style.top = top + 'px';
//                 }
//                 document.ontouchend = function () {
//                     let time2 = new Date().getTime();
//                     if (time2 - time1 > 300) {
//                         el.classList.remove('v-drag-active')
//                         el.classList.add('v-drag-inactive')
//                     }

//                     document.ontouchmove = document.ontouchend = null;
//                 }
//             }
//         } else { // pc端
//             el.onmousedown = function (e) {
//                 let time1 = new Date().getTime();
//                 let x = e.pageX - el.offsetLeft;
//                 let y = e.pageY - el.offsetTop;
//                 document.onmousemove = function (e) {
//                     let time2 = new Date().getTime();
//                     if (time2 - time1 > 300) {
//                         el.classList.remove('v-drag-inactive')
//                         el.classList.add('v-drag-active')
//                     }
//                     el.style.left = e.pageX - x + 'px';
//                     el.style.top = e.pageY - y + 'px';
//                 }
//                 document.onmouseup = function () {
//                     let time2 = new Date().getTime();
//                     if (time2 - time1 > 300) {
//                         el.classList.remove('v-drag-active')
//                         el.classList.add('v-drag-inactive')
//                     }
//                     document.onmousemove = document.onmouseup = null;
//                 }
//             }
//         }
//     },
//     updated: function (el) {
//     }
// })
