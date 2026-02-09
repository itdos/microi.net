let ImgBaseUrl='https://static.nbcmc.cn'
const util = {
	DateFormat: function(time, format)
	  {
		if (!format) {
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
	DateDiff(startTime, endTime, interval) {
		if (!startTime || !endTime || !interval) {
			return 0;
		}
		var _startTime = startTime;
		var _endTime = endTime;
		if (typeof(startTime) == 'string') {
			_startTime = new Date(startTime);
		}
		if (typeof(endTime) == 'string') {
			_endTime = new Date(endTime);
		}
		var d = _startTime;
		var i = {}
		var t = d.getTime()
		var t2 = _endTime.getTime()
		i['y'] = _endTime.getFullYear() - d.getFullYear()
		i['q'] = i['y'] * 4 + Math.floor(_endTime.getMonth() / 4) - Math.floor(d.getMonth() / 4)
		i['M'] = i['y'] * 12 + _endTime.getMonth() - d.getMonth()
		i['ms'] = _endTime.getTime() - d.getTime()
		i['w'] = Math.floor((t2 + 345600000) / (604800000)) - Math.floor((t + 345600000) / (604800000))
		i['d'] = Math.floor(t2 / 86400000) - Math.floor(t / 86400000)
		i['h'] = Math.floor(t2 / 3600000) - Math.floor(t / 3600000)
		i['m'] = Math.floor(t2 / 60000) - Math.floor(t / 60000)
		i['s'] = Math.floor(t2 / 1000) - Math.floor(t / 1000)
		return i[interval]
	},
	// 隐藏手机号码中间 默认4位数
	getTel: (phone, start = 3, hidden = 4) => {
		return phone.substr(0, start) + ''.padStart(hidden, '*') + phone.substr(start + hidden);
	},

	//价格保留几位 默认两位
	getPrice: (price, n = 2) => {
		return Number(price).toFixed(n)
	},


	//数组根据某个属性排序
	getCompare: (property, orderBy = true) => {
		return function(a, b) {
			return orderBy ? a[property] - b[property] : b[property] - a[property];
		}
	},

	// 获取链接上的参数
	getUrlKey: name => {
		return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location
			.href) || ['', ''])[1].replace(/\+/g, '%20')) || null
	},


	//获取性别
	getGender: str => {
		let gender = [{
				name: '未知',
				value: '0'
			},
			{
				name: '女',
				value: '1'
			},
			{
				name: '男',
				value: '2'
			}
		]
		let res = gender.find(item => str == item.name || str == item.value);
		return str == res.name ? res.value : res.name

	},

	//获取状态
	getStatus: (str) => {
		let status = [{
				name: '待付款',
				value: '1'
			},
			{
				name: '待发货',
				value: '2'
			},
			{
				name: '待收货',
				value: '3'
			},
			{
				name: '待评价',
				value: '4'
			},
			{
				name: '交易成功',
				value: '5'
			},
			{
				name: '交易失败',
				value: '6'
			}
		]
		let res = status.find(item => str == item.name || str == item.value);
		return str == res.name ? res.value : res.name
	},

	//获取券的状态
	getCouponStatus: (str) => {
		let status = [{
				name: '进行中',
				value: '0'
			},
			{
				name: '已结束',
				value: '1'
			},
			{
				name: '进行中',
				value: '2'
			},
		]
		let res = status.find(item => str == item.name || str == item.value);
		return str == res.name ? res.value : res.name
	},


	//获取支付方式
	getPayType: (str) => {
		let payList = [{
				name: '微信支付',
				value: '1'
			},
			{
				name: '支付宝',
				value: '2'
			},
			{
				name: '余额支付',
				value: '3'
			}
		]
		let res = payList.find(item => str == item.name || str == item.value);
		return str == res.name ? res.value : res.name
	},

	getPriceFormat: (number, decimals = 2, decPoint, thousandsSep, roundtag) => {
		/*
		 * 参数说明：
		 * number：要格式化的数字
		 * decimals：保留几位小数
		 * dec_point：小数点符号
		 * thousands_sep：千分位符号
		 * roundtag:舍入参数，默认 'ceil' 向上取,'floor'向下取,'round' 四舍五入
		 * */
		number = (number + '').replace(/[^0-9+-Ee.]/g, '')
		roundtag = roundtag || 'ceil' // 'ceil','floor','round'
		let n = !isFinite(+number) ? 0 : +number
		let prec = !isFinite(+decimals) ? 0 : Math.abs(decimals)
		let sep = (typeof thousandsSep === 'undefined') ? ',' : thousandsSep
		let dec = (typeof decPoint === 'undefined') ? '.' : decPoint
		let s = ''
		let toFixedFix = function(n, prec) {
			let k = Math.pow(10, prec)
			console.log()

			return '' + parseFloat(Math[roundtag](parseFloat((n * k).toFixed(prec * 2))).toFixed(prec *
				2)) / k
		}
		s = (prec ? toFixedFix(n, prec) : '' + Math.round(n)).split('.')
		let re = /(-?\d+)(\d{3})/
		while (re.test(s[0])) {
			s[0] = s[0].replace(re, '$1' + sep + '$2')
		}

		if ((s[1] || '').length < prec) {
			s[1] = s[1] || ''
			s[1] += new Array(prec - s[1].length + 1).join('0')
		}
		return s.join(dec)
	},


	// 根据日期计算年龄
	getAge: (strBirthday) => {
		//strBirthday传入格式 2020-04-15
		let returnAge;
		let strBirthdayArr = strBirthday.split('-');
		let birthYear = strBirthdayArr[0];
		let birthMonth = strBirthdayArr[1];
		let birthDay = strBirthdayArr[2];
		//获取当前日期
		let d = new Date();
		let nowYear = d.getFullYear();
		let nowMonth = d.getMonth() + 1;
		let nowDay = d.getDate();
		if (nowYear == birthYear) {
			returnAge = 0; //同年 则为0岁
		} else {
			let ageDiff = nowYear - birthYear; //年之差
			if (ageDiff > 0) {
				if (nowMonth == birthMonth) {
					let dayDiff = nowDay - birthDay; //日之差
					if (dayDiff < 0) {
						returnAge = ageDiff - 1;
					} else {
						returnAge = ageDiff;
					}
				} else {
					let monthDiff = nowMonth - birthMonth; //月之差
					if (monthDiff < 0) {
						returnAge = ageDiff - 1;
					} else {
						returnAge = ageDiff;
					}
				}
			} else {
				returnAge = -1; //返回-1 表示出生日期输入错误 晚于今天
			}
		}
		return returnAge; //返回周岁年龄
	},
	
	// 获取两个时间的时间差（时分秒）
	formatGap:(startTime, endTime)=> {
		let staytimeGap = new Date(endTime.replace(/-/g, '/')).getTime() - new Date(startTime.replace(/-/g, '/')).getTime();
		let stayHour = Math.floor(staytimeGap/(3600*1000));
		let leave1 = staytimeGap%(3600*1000);
		let stayMin = Math.floor(leave1/(60*1000));
		let leave2 = leave1%(60*1000);
		let staySec = Math.floor(leave2/1000);
		return stayHour + "时" + stayMin + "分" + staySec + "秒";
	},
	GetServerPath: (path,noPath="")=> {
		var self = this
		if (!path) {
			return noPath
		}
		if (path.length >= 4 && path.substr(0, 4).toLowerCase() == 'http') {
			return path
		}
		if (path.length >= 1) {
			if (path.substr(0, 1) == '.') {
				return path
				path = path.substr(1, path.length - 1)
			}
			if (path.substr(0, 1) != '/' && path.substr(0, 1) != '\\') {
				path = '/' + path
			}
		}
		// 取文件格式，如果是视频、音频文件，则使用mediaServer
		var format = path.substring(path.lastIndexOf('.'), path.length).toLowerCase()
		if (format === '.mp4' ||
			format === '.avi' ||
			format === '.rmvb' ||
			format === '.wmv' ||
			format === '.mov' ||
			format === '.flv' ||
			format === '.3gp' ||

			format === '.mp3' ||
			format === '.ogg' ||
			format === '.wma' ||
			format === '.flac' ||
			format === '.ape'
		) {
			return ImgBaseUrl + path
		}
		return ImgBaseUrl + path
	},
	IsNull:(str)=> {
		if (str == null || str == undefined || str === '' || str === 'undefined' || str === 'null' || str === '{}'|| str === '[]') {
			return true
		}
		return false
	},
	NewGuid: ()=> {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = Math.random() * 16 | 0
			var v = c == 'x' ? r : (r & 0x3 | 0x8)
			return v.toString(16)
		})
	},
}

export default util
