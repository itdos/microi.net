/**
 * 此组件打包后，会导致microi.net报致命错：
 * microi.net.js?9edc:52 Uncaught ReferenceError: fn is not defined
    at eval (microi.net.js?9edc:52)
	* @title 			弹窗插件【仿微信】wcPop-v1.0 beta (UTF-8)
	* @Timer		2018/03/30 11:30:45 GMT+0800 (中国标准时间)
*/
!function(win){
	var _doc = win.document, _docEle = _doc.documentElement, index = 0,
	util = {
		$: function(id){
			return _doc.getElementById(id);
		},
		touch: function(o, type, fn){
			o.addEventListener(type||'click', function(e){
				fn.call(this, e);
			}, !1);
		},
		//获取插件js路径
		jspath: function(){
			for(var s = _doc.getElementsByTagName("script"), i = s.length; i > 0; i--)
				if(s[i-1].src && s[i-1].src.match(/wcPop[\w\-\.]*\.js/) != null)
					return s[i-1].src.substring(0, s[i-1].src.lastIndexOf("/")+1);
		},
		// object扩展
		extend: function(target, source){
			for(var i in source){
				if(!(i in target)){
					target[i] = source[i];
				}
			}
			return target;
		},
		timer: {},	//定时器
		show: {},	//显示弹窗时回调函数
		end: {},	//销毁弹窗时回调函数
		
		// 方向判断
		direction: function(x1,x2,y1,y2){
			return Math.abs(x1 - x2) >= Math.abs(y1 - y2) ? (x1 - x2 > 0 ? 'left' : 'right') : (y1 - y2 > 0 ? 'up' : 'down')
		},
		// swipe触摸模块
		swipe: function(obj, options){
			util.touch(obj, "touchstart", function(e){
				var eX, eY, curX, curY, velocity;
				eX = Math.floor(e.touches[0].pageX);
				eY = Math.floor(e.touches[0].pageY);
				
				util.touch(obj, "touchmove", function(e){
					e.preventDefault();
					
					curX = e.changedTouches[0].pageX;
					curY = e.changedTouches[0].pageY;
				});
				util.touch(obj, "touchend", function(e){
					if((curX && Math.abs(eX - curX) > 50) || (curY && Math.abs(eY - curY) > 50)){
						velocity = util.direction(eX, curX, eY, curY);
					}
					
					//绑定swipe事件
					for(var i = 0, len = options.swipe.length; i < len; i++){
						if(options.swipe[i].direction == velocity){
							typeof options.swipe[i].fn === "function" && options.swipe[i].fn(e);
						}
					}
					
					//销毁参数
					eX = eY = null;
					obj.removeEventListener("touchmove", this, false);
				});
				
			});
		},
		// 位置检测
		chkPosition: function(ex, ey, oW, oH, winW, winH){
			var _l = (ex + oW) > winW ? (ex - oW) : ex;
			var _t = (ey + oH) > winH ? (ey - oH) : ey;
			return [_l, _t];
		}
	},
	wcPop = function(options){
		var _this = this,
			config = {
				id: 'wcPop',				//弹窗ID标识 (不同ID对应不同弹窗)
				title: '',					//标题
				content: '',				//内容
				style: '',					//自定弹窗样式
				skin: '',					//自定弹窗显示风格 ->目前支持配置  toast(仿微信toast风格)、footer(底部对话框风格)、actionsheet(底部弹出式菜单)、ios|android(仿微信样式)
				icon: '',					//弹窗小图标(success | info | error | loading)
				
				shade: true,				//是否显示遮罩层
				shadeClose: true,			//是否点击遮罩时关闭层
				opacity: '',				//遮罩层透明度
				xclose: false,				//自定义关闭按钮(默认右上角)
				
				anim: 'scaleIn',			//scaleIn：缩放打开(默认)  fadeIn：渐变打开  fadeInUpBig：由上向下打开 fadeInDownBig：由下向上打开  rollIn：左侧翻转打开  shake：震动  footer：底部向上弹出
				position: '',				//弹窗显示位置(top | right | bottom | left)
				follow: null,				//跟随定位（适用于在点击位置定位弹窗）
				time: 0,					//设置弹窗自动关闭秒数1、 2、 3
				zIndex: 9999,				//设置元素层叠
				
				swipe: null,				//触摸函数 参数：[ {direction:'left|right|up|down', fn(){}} ]
				btns: null					//不设置则不显示按钮，btn参数: [{按钮1配置}, {按钮2配置}]
			};
		
		_this.opts = util.extend(options, config);
		_this.init();
	};
	
	wcPop.prototype = {
		init: function(){
			var _this = this, opt = _this.opts, xwbox = null,
			ftBtns = function(){
				if(!opt.btns) return;
				var btnTpl = "";
				for(var i in opt.btns){
					btnTpl += '<span class="btn" data-index="'+i+'" style="'+(opt.btns[i].style ? opt.btns[i].style : '')+'">'+opt.btns[i].text+'</span>';
				}
				return btnTpl;
			}();
			
			util.$(opt.id) ? (xwbox = util.$(opt.id)) : (xwbox = _doc.createElement("div"), xwbox.id = opt.id);
			opt.skin && (xwbox.setAttribute("type", opt.skin));
			xwbox.setAttribute("index", index);
			xwbox.setAttribute("class", "wcPop wcPop"+index);
			xwbox.innerHTML = [
				'<div class="popui__modal-panel">',
					/**遮罩*/
					opt.shade ? ('<div class="popui__modal-mask" style="'+(opt.opacity != null ? 'opacity:'+opt.opacity : '')+'; z-index:'+(_this.maxIndex()+1)+'"></div>') : '',
					/**窗体*/
					'<div class="popui__panel-main" style="z-index:'+(_this.maxIndex()+2)+'">\
						<div class="popui__panel-section">\
							<div class="popui__panel-child '+(opt.anim ? 'anim-'+opt.anim : '')+' '+(opt.skin ? 'popui__'+opt.skin : '')+' '+(opt.position ? opt.position : '')+'" style="'+opt.style+'">',
								opt.title ? ('<div class="popui__panel-tit">'+opt.title+'</div>') : '',
								opt.content ? ('<div class="popui__panel-cnt">'+(opt.skin == "toast" && opt.icon ? ('<div class="popui__toast-icon"><img class="'+(opt.icon == "loading" ? "anim-loading" : '')+'" src="'+util.jspath()+'skin/'+opt.icon+'.png" /></div>') : '') + opt.content +'</div>') : '',
								opt.btns ? '<div class="popui__panel-btn">'+ftBtns+'</div>' : '',
								opt.xclose ? ('<span class="popui__xclose"></span>') : '',
							'</div>\
						</div>\
					</div>\
				</div>'
			].join('');
			//_doc.body.insertBefore(xwbox, _doc.body.childNodes[0]);
			_doc.body.appendChild(xwbox);
			_doc.getElementsByTagName("body")[0].classList.add("popui__overflow");
			opt.show && opt.show.call(this);
			this.index = index++;
			_this.callback();
		},
		callback: function(){
			var _this = this, opt = _this.opts, _obj = util.$(opt.id);
			//自动关闭弹窗
			if(opt.time){
				util.timer[_this.index] = setTimeout(function(){
					exports.close(_this.index);
				}, opt.time * 1000);
			}
			
			//按钮事件
			if(opt.btns){
				for (var o = _obj.getElementsByClassName("popui__panel-btn")[0].children, len = o.length, i = 0; i < len; i++)
					util.touch(o[i], "click", function(e){
						var idx = this.getAttribute("data-index"), btn = opt.btns[idx];
						typeof btn.onTap === "function" && btn.onTap(e);
					});
			}
			//点击遮罩层关闭
			if(opt.shade && opt.shadeClose){
				var c = _obj.getElementsByClassName("popui__modal-mask")[0];
				util.touch(c, "click", function () {
					exports.close(_this.index);
				});
			}
			//点击xclose按钮关闭
			if(opt.xclose){
				var x = _obj.getElementsByClassName("popui__xclose")[0];
				util.touch(x, "click", function () {
					exports.close(_this.index);
				});
			}
			
			// 禁止长按按钮区弹出系统菜单
			var j = _obj.getElementsByClassName("popui__panel-btn")[0];
			var i = _obj.getElementsByClassName("popui__modal-mask")[0];
			j && j.addEventListener("contextmenu", function(e){
				e.preventDefault();
			}, !1);
			i && i.addEventListener("contextmenu", function (e) {
				e.preventDefault();
			}, !1);
			
			// 弹窗位置检测
			if(opt.follow){
				var _kkk = _obj.getElementsByClassName("popui__panel-child")[0];
				var oW, oH, winW, winH;
				oW = _kkk.clientWidth;
				oH = _kkk.clientHeight;
				winW = window.innerWidth;
				winH = window.innerHeight;
				
				console.log('dom宽度：' + oW);
				console.log('dom高度：' + oH);
				console.log('屏幕宽度：' + winW);
				console.log('屏幕高度：' + winH);
				
				var _pos = util.chkPosition(opt.follow[0], opt.follow[1], oW, oH, winW, winH);
				console.log(_pos);
				_kkk.style.left = _pos[0] + 'px';
				_kkk.style.top = _pos[1] + 'px';
			}
			
			var swipeObj = _obj.getElementsByClassName("popui__panel-main")[0];
			opt.swipe && util.swipe(swipeObj, opt);
			
			//销毁弹窗
			opt.end && (util.end[_this.index] = opt.end);
		},
		//获取弹窗最大层级
		maxIndex: function(){
			for(var idx = this.opts.zIndex, elem = _doc.getElementsByTagName("*"), i = 0, len = elem.length; i < len; i++)
				idx = Math.max(idx, elem[i].style.zIndex);
			return idx;
		}
	};
	
	var exports = (function(){
		//实例化弹窗(返回 弹窗索引值)
		fn = function(args){
			var o = new wcPop(args);
			return o.index;
		};
		
		//关闭弹窗
		fn.close = function(index){
			var index = index || '';
			var o = _doc.getElementsByClassName("wcPop"+index)[0];
			
			if(o){
				o.setAttribute("class", "wcPop-close");
				setTimeout(function(){
					_doc.body.removeChild(o);
					clearTimeout(util.timer[index]);
					delete util.timer[index];
					
					//销毁弹窗时回调函数
					typeof util.end[index || 0] == "function" && util.end[index || 0].call(this);
					delete util.end[index || 0];
				}, 200);
				//移除body里的class
				_doc.getElementsByTagName("body")[0].classList.remove("popui__overflow");
			}
		}
		// 关闭所有弹窗
		fn.closeAll = function(){
			for(var o = _doc.getElementsByClassName(["wcPop"]), i = 0, len = o.length; i < len; i++)
				fn.close(0 | o[0].getAttribute("index"));
		}
		
		//加载css
		fn.load = function(path){
			for(var ck = _doc.createElement("link"), lk = _doc.getElementsByTagName("link"), i = lk.length; i > 0; i--)
				if(lk[i-1].href == path) return;
			ck.type="text/css";
			ck.rel = "stylesheet";
			ck.href = util.jspath() + path;
			_doc.getElementsByTagName("head")[0].appendChild(ck);
		};
		
		//更多接口
		fn.moreAPI = function(title, content, time){
			var opts = {
				title: title, content: content, time: time
			}
			fn(opts);
		};
		
		return fn;
	}());
	
	//加载css
	// exports.load("skin/wcPop.css");
	
	win.wcPop = exports;
}(window);