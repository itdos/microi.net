import { defineConfig, type DefaultTheme } from "vitepress";
import { set_sidebar } from "../../guide/set_sidebar.mjs";

export const zh = defineConfig({
	base: "/",
	title: "Microi吾码",
	lang: "zh-CN",
	description: "Microi吾码官方文档，开源低代码平台，开源 AI 低代码平台-Microi吾码，基于.NET9+Vue3+Element-Plus，始于2014年（基于Avalon.js），2018年使用Vue重构，于2024年11月开源。",
	head: [
		["meta", { name: "author", content: "Microi风闲" }],
		[
			"meta",
			{
				name: "keywords",
				content: "Microi吾码,低代码,开源低代码平台,开源 AI 低代码平台,小吾科技,Microi.net,Microi,iTdos,itdos.com,microios,Dos,Dos.,Dos.ORM,Dos.Common",
			},
		],
		// Open Graph（微信/微博/钉钉分享卡片 & 搜索引擎理解页面）
		["meta", { property: "og:type", content: "website" }],
		["meta", { property: "og:site_name", content: "Microi吾码" }],
		["meta", { property: "og:title", content: "Microi吾码 - 开源 AI 低代码平台" }],
		["meta", { property: "og:description", content: "开源低代码平台，基于 .NET + Vue3 + Element-Plus，支持 AI 引擎、API 接口引擎、表单引擎、工作流引擎等，始于2014年，2024年开源。" }],
		["meta", { property: "og:image", content: "https://www.microi.net/home2.jpg" }],
		["meta", { property: "og:url", content: "https://www.microi.net/" }],
		["meta", { property: "og:locale", content: "zh_CN" }],
		// 百度爬虫专项
		["meta", { name: "baidu-site-verification", content: "codeva-2a7cV8xUpf" }], // 填入百度站长平台验证码
		["meta", { name: "robots", content: "index, follow" }],
		["link", { rel: "icon", href: "/icon.png" }],
		["link", { rel: "stylesheet", href: "/assets/fancybox.css" }],
		["script", { src: "/assets/fancybox.umd.js" }],
	],
	appearance: "dark", // 启用主题切换
	markdown: {
		theme: {
			light: "github-dark", // 浅色模式也使用深色代码主题
			dark: "github-dark"
		},
		lineNumbers: true,
		config: (md) => md.use(mdItCustomAttrs, "image", { "data-fancybox": "gallery" }),
	},
	lastUpdated: true,
	themeConfig: {
		logo: "/icon.png",
		search: {
			provider: "local",
		},
		outline: {
			level: [2, 4], // 显示2-4级标题
			label: "当前页大纲", // 文字显示
		},
		editLink: {
			text: "为此页提供修改建议",
			pattern: "https://gitee.com/ITdos/microi.net/issues",
		},
		socialLinks: [
			{
				icon: {
					svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M11.984 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.016 0zm6.09 5.333c.328 0 .593.266.593.593v1.482a.594.594 0 0 1-.593.593H9.777c-.982 0-1.778.796-1.778 1.778v5.63c0 .327.266.592.593.592h5.63c.982 0 1.778-.796 1.778-1.778v-.296a.593.593 0 0 0-.593-.593h-4.15a.593.593 0 0 1-.593-.593v-1.482a.593.593 0 0 1 .593-.593h6.666c.327 0 .593.265.593.592v3.408a4 4 0 0 1-4 4H5.926a.593.593 0 0 1-.593-.593V9.778a4.444 4.444 0 0 1 4.444-4.444h8.296z" fill="#C71D23"/></svg>',
				},
				link: "https://gitee.com/ITdos/microi.net",
			},
		],
		footer: {
			message: "MIT License.",
			copyright: "Copyright © 2009-2026 浙ICP备15032701号-1 ",
		},
		nav: nav(),
		sidebar: {
			"/doc/": set_sidebar("/doc", false),
			"/case/": set_sidebar("/case", false),
		},
	},
	vite: {
		plugins: [],
	},
});

function nav(): DefaultTheme.NavItem[] {
	return [
		{ text: "首页", link: "/" },
		{ text: "文档 🪧", link: "/doc/index" },
		{ text: "成功案例", link: "/case/case-index" },
		{
			text: "相关链接 🔗",
			items: [
				{
					text: "Gitee 仓库",
					link: "https://gitee.com/ITdos/microi.net",
				},
				{
					text: "WebOS 试用",
					link: "https://webos.microi.net/",
				},
				{
					text: "传统界面试用",
					link: "https://web.microi.net/",
				},
				{
					text: "CSDN 官方博客",
					link: "https://microi.blog.csdn.net/?type=blog",
				},
				{
					text: "CSDN 技术博客",
					link: "https://lisaisai.blog.csdn.net/?type=blog",
				},
				{
					text: "技术支持大牛 - 毛总",
					link: "https://gitee.com/mao_js ",
				},
				{
					text: "Nuget iTdos 官方账号",
					link: "https://www.nuget.org/profiles/ITdos",
				},
			],
		},
		{ text: "联系我们", link: "/contact/index" },
	];
}
