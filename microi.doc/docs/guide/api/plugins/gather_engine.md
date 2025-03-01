# 采集引擎

## 介绍

- 本文初步讲一下采集引擎，后续会不断在此文章更新各种采集方式。
- 采集引擎支持采集 `DOM` 渲染前的 `html` ，也支持渲染后的 `html` 。
- 采集引擎支持采集网页的所有资源请求、接口请求。

![采集引擎](/api_plugins/gather01.png)

## 相关开源项目
基于开源低代码平台Microi吾码的图片壁纸、短视频开源项目：https://microi.blog.csdn.net/article/details/144002079

## 采集图片、视频接口引擎代码
实际上以下代码我们也可以写的更通用一点，将 `selectors` 由前端传入，这样可以做到一个接口采集万物，当然也可以每个网站采集对应一个接口引擎。

```js
if(!V8.Param.Url){
  V8.Result = { Code : 0, Msg : '参数错误！' }; return;
}
var url = V8.Param.Url;
var headless = V8.Param.Headless;
var isCloseBrowser = V8.Param.IsCloseBrowser;
var isClosePage = V8.Param.IsClosePage;
var selectors = [];

var urlWebType = 'kuaishou';
//目前仅支持[v.kuaishou.com]  实际上支持所有网站，只要你会写Selector
if(url.indexOf('v.kuaishou.com') > -1){
  urlWebType = 'kuaishou'
}else if(url.indexOf('v.douyin.com') > -1){
  urlWebType = 'douyin'
}else{
	V8.Result = { Code : 0,  Msg : '目前仅支持快手、抖音。' }; return;
}
if(urlWebType == 'kuaishou'){
  if(V8.Param.ContentType == 'ShortVideo'){
    //采集快手视频。后期需改成动态采集规则配置
    selectors = [{
							Key : 'Author',
							Selector : '.short-video-info .short-video-info-container .profile-user-name .profile-user-name-title',
							Script : '(element) => element.innerText',
						},{
							Key : 'Title',
							Selector : '.short-video-info .short-video-info-container .short-video-info-container-detail .video-info-title',
							Script : '(element) => element.innerText',
						},{
							Key : 'FileUrls',
							Selector : '.kwai-player-container-video video',
							Script : '(element) => element.src',
						},{
							Key : 'Cover',
							Selector : '.short-video-detail .short-video-detail-container .short-video-wrapper .video-container-player',
							Script : '(element) => element.getAttribute(\'poster\')',
						}];
  }else{
    //采集快手图片。后期需改成动态采集规则配置
    selectors = [{
							Key : 'Author',
							Selector : '.work-info.section .author .txt-wrapper .txt',
							Script : '(element) => element.innerText',
						},{
							Key : 'Title',
							Selector : '.work-info.section .desc',
							Script : '(element) => element.innerText',
						},{
							Key : 'FileUrls',
							Selector : '.long-image-container img, .swiper-container-item img',
							Script : '(element) => element.src',
						}];
  }
}if(urlWebType == 'douyin'){
  if(V8.Param.ContentType == 'ShortVideo'){
    //采集抖音视频。后期需改成动态采集规则配置
    selectors = [{
							Key : 'Author',
							Selector : '.video-detail .leftContainer img',
							Script : '(element) => element.alt',
						},{
							Key : 'Title',
							Selector : 'title',
							Script : 'el => el.textContent',
						},{
							Key : 'FileUrls',
							Selector : '.xg-video-container video source',
							Script : 'el => el.getAttribute(\'src\')',//'el => el.querySelector(\'source\').getAttribute(\'src\')',
						},{
							Key : 'Cover',
							Selector : 'meta[name=\'lark:url:video_cover_image_url\']',
							Script : 'el => el.content',
						}];
  }else{
    //采集抖音图片。后期需改成动态采集规则配置
    selectors = [{
							Key : 'Author',
							Selector : '.work-info.section .author .txt-wrapper .txt',
							Script : '(element) => element.innerText',
						},{
							Key : 'Title',
							Selector : '.work-info.section .desc',
							Script : '(element) => element.innerText',
						},{
							Key : 'FileUrls',
							Selector : '.long-image-container img, .swiper-container-item img',
							Script : '(element) => element.src',
						}];
  }
}
V8.Result = V8.Spider.GetRenderHtml({
  Headless : headless,
  IsCloseBrowser : isCloseBrowser,
	IsClosePage : isClosePage,
  Url : url,
  Selectors : selectors
  // ExecutablePath : 'D:\\Web\\microi-api\\publish\\Chrome\\Application\\109.0.5414.168',
	// VirtualWindows : true,
  //Selector : '.long-image-container img, .swiper-container-item img',
	//Script : '(element) => element.src',
	// ResponseUrlStart : 'https://m.yxixy.com/rest/wd/photo/info?'
});

```

