import { createRequire } from "module";
import { defineConfig, type DefaultTheme } from "vitepress";
import { set_sidebar } from "../../en/guide/set_sidebar.mts";

const require = createRequire(import.meta.url);
const pkg = require("vitepress/package.json");

export const en = defineConfig({
	base: "/en",
	title: "Microi吾码",
	lang: "en_US",
	description: "Microi吾码 官方文档",
	head: [
		["meta", { name: "author", content: "Microi风闲,Anderson. ᴹⁱᶜʳᵒⁱ" }],
		[
			"meta",
			{
				name: "keywords",
				content:
					"Microi吾码,低代码,开源低代码平台,小吾科技,Microi.net,Microi,iTdos,itdos.com,microios,Dos,Dos.,Dos.ORM,Dos.Common",
			},
		],
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
			level: [2, 4], // Display headings from level 2 to 4
			label: "Current Page Outline", // Display text
		},
		editLink: {
			text: "Suggestions for Improving This Page",
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
		nav: nav(),
		sidebar: {
			"/en/guide/introduce/": set_sidebar("/en/guide/introduce", false),
			"/en/guide/web/": set_sidebar("/en/guide/web", false),
			"/en/guide/api/": set_sidebar("/en/guide/api", false),
			"/en/guide/build/": set_sidebar("/en/guide/build", false),
			"/en/guide/issues/": set_sidebar("/en/guide/issues", false),
			"/en/doc/": set_sidebar("/en/doc", false),
			"/en/case/": set_sidebar("/en/case", false),
			"/en/apiengine/": set_sidebar("/en/apiengine", false),
			"/en/faq/": set_sidebar("/en/faq", false),
		},
	},
	vite: {
		plugins: [],
	},
});

function nav(): DefaultTheme.NavItem[] {
	return [
		{ text: "Documentation 🪧", link: "/en/doc/index" },
		{ text: "Success Stories", link: "/en/case/case-index" },
		{ text: "API Engine Practical Guide", link: "/en/apiengine/apiengine-index" },
		{ text: "FAQ", link: "/en/faq/faq-index" },
		{
			text: "More", //📋
			items: [
				{
					text: "🪧 Guide",
					link: "/en/guide/introduce/introduce/introduce",
					activeMatch: "/en/guide/introduce/",
				},
				{
					text: "📖 Frontend Docs",
					link: "/en/guide/web/start_web/intro_web",
					activeMatch: "/en/guide/web/",
				},
				{
					text: "📘 Backend Docs",
					link: "/en/guide/api/start_api/intro_api",
					activeMatch: "/en/guide/api/",
				},
				{
					text: "📝 Microi Classroom",
					link: "/en/guide/issues/issues_project/issues_project_records",
					activeMatch: "/en/guide/issues/",
				},
			],
		},
		{
			text: "Related Links", // 🔗
			items: [
				{
					text: "Gitee Repository",
					link: "https://gitee.com/ITdos/microi.net",
				},
				{
					text: "WebOS Trial",
					link: "https://webos.microi.net/",
				},
				{
					text: "Traditional UI Trial",
					link: "https://demo.microi.net/",
				},
				{
					text: "CSDN Official Blog",
					link: "https://microi.blog.csdn.net/?type=blog",
				},
				{
					text: "CSDN Tech Blog",
					link: "https://lisaisai.blog.csdn.net/?type=blog",
				},
			],
		},
		{ text: "Contact Us", link: "/en/contact/index" },
	];
}
