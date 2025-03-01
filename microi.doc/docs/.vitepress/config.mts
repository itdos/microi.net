import mdItCustomAttrs from "markdown-it-custom-attrs";
import { defineConfig } from "vitepress";
import { set_sidebar } from "../guide/set_sidebar.mjs";

export default defineConfig({
	base: "/",
	title: "Microi吾码",
	lang: "zh-CN",
	description: "Microi吾码 官方文档",
	head: [
		["meta", { name: "author", content: "Microi风闲" }],
		["meta", { name: "keywords", content: "Microi吾码,低代码,开源低代码,小吾科技" }],
		["link", { rel: "icon", href: "/icon.png" }],
		["link", { rel: "stylesheet", href: "/assets/fancybox.css" }],
		["script", { src: "/assets/fancybox.umd.js" }],
	],
	appearance: "dark",
	markdown: {
		theme: "github-dark",
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
			copyright: "Copyright © 2009-2025 浙ICP备15032701号-1 ",
		},
		nav: [
			{ text: "指引🪧", link: "/guide/introduce/introduce/introduce", activeMatch: "/guide/introduce/" },
			{
				text: "文档📋",
				items: [
					{
						text: "📖 前端文档",
						link: "/guide/web/start_web/intro_web",
						activeMatch: "/guide/web/",
					},
					{
						text: "📘 后端文档",
						link: "/guide/api/start_api/intro_api",
						activeMatch: "/guide/api/",
					},
					{
						text: "🛠️ 构建部署",
						link: "/guide/build/cloud/quick_build",
						activeMatch: "/guide/build/",
					},
					{
						text: "📝 吾码课堂",
						link: "/guide/issues/issues_project/issues_project_records",
						activeMatch: "/guide/issues/",
					},
					{
						text: "📤 更新升级",
						link: "/guide/logs/logs_version/logs_version",
						activeMatch: "/guide/logs/",
					},
				],
			},
			{
				text: "相关链接🔗",
				items: [
					{
						text: "Gitee 仓库",
						link: "https://gitee.com/ITdos/microi.net",
					},
					{
						text: "GitCode 仓库",
						link: "https://gitcode.com/microi-net/microi.net",
					},
					{
						text: "预览地址",
						link: "https://microi.net/",
					},
					{
						text: "CSDN 官方博客",
						link: "https://microi.blog.csdn.net/?type=blog",
					},
					{
						text: "CSDN 技术专区",
						link: "https://lisaisai.blog.csdn.net/?type=blog",
					},
				],
			},
			{ text: "联系我们", link: "/sponsor/index" },
		],

		sidebar: {
			"/guide/introduce/": set_sidebar("/guide/introduce", false),
			"/guide/web/": set_sidebar("/guide/web", false),
			"/guide/api/": set_sidebar("/guide/api", false),
			"/guide/build/": set_sidebar("/guide/build", false),
			"/guide/issues/": set_sidebar("/guide/issues", false),
			"/guide/logs/": set_sidebar("/guide/logs", false),
		},
	},
	vite: {
		plugins: [],
	},
});
