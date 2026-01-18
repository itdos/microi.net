import { defineConfig, type DefaultTheme } from "vitepress";
import { set_sidebar } from "../../ja/guide/set_sidebar.mts";

export const ja = defineConfig({
	base: "/",
	title: "Microiコード",
	lang: "ja-JP",
	description: "Microiコードの公式ドキュメント",
	head: [
		["meta", { name: "author", content: "Microi風閑，Anderson. ᴹⁱᶜʳᵒⁱ" }],
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
			level: [2, 4], // 显示2-4级标题
			label: "現在のページのアウトライン", // 文字显示
		},
		editLink: {
			text: "このページへの改善提案",
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
			// "/guide/introduce/": set_sidebar("/zh/guide/introduce", false),
			// "/guide/web/": set_sidebar("/zh/guide/web", false),
			// "/guide/api/": set_sidebar("/zh/guide/api", false),
			// "/guide/build/": set_sidebar("/zh/guide/build", false),
			// "/guide/issues/": set_sidebar("/zh/guide/issues", false),
			// "/doc/": set_sidebar("/zh/doc/", false),
			// "/case/": set_sidebar("/zh/case", false),
			// "/apiengine/": set_sidebar("/zh/apiengine", false),
			// "/faq/": set_sidebar("/zh/faq", false),
			// 用来兼容旧版
			"/ja/guide/introduce/": set_sidebar("/ja/guide/introduce", false),
			"/ja/guide/web/": set_sidebar("/ja/guide/web", false),
			"/ja/guide/api/": set_sidebar("/ja/guide/api", false),
			"/ja/guide/build/": set_sidebar("/ja/guide/build", false),
			"/ja/guide/issues/": set_sidebar("/ja/guide/issues", false),
			"/ja/doc/": set_sidebar("/ja/doc", false),
			"/ja/case/": set_sidebar("/ja/case", false),
			"/ja/apiengine/": set_sidebar("/ja/apiengine", false),
			"/ja/faq/": set_sidebar("/ja/faq", false),
		},
	},
	vite: {
		plugins: [],
	},
});

function nav(): DefaultTheme.NavItem[] {
	return [
		{ text: "ドキュメント 🪧", link: "/ja/doc/index" },
		{ text: "成功事例", link: "/ja/case/case-index" },
		{ text: "インタフェースエンジンの実戦", link: "/ja/apiengine/apiengine-index" },
		// { text: "FAQ", link: "/ja/faq/faq-index" },
		// {
		// 	text: "詳細", //📋
		// 	items: [
		// 		{
		// 			text: "🪧 ガイド人",
		// 			link: "/ja/guide/introduce/introduce/introduce",
		// 			activeMatch: "/ja/guide/introduce/",
		// 		}, //
		// 		{
		// 			text: "📖 フロントエンド・ドキュメント",
		// 			link: "/ja/guide/web/start_web/intro_web",
		// 			activeMatch: "/ja/guide/web/",
		// 		},
		// 		{
		// 			text: "📘 バックエンド・ドキュメント",
		// 			link: "/ja/guide/api/start_api/intro_api",
		// 			activeMatch: "/ja/guide/api/",
		// 		},
		// 		// {
		// 		// 	text: "🛠️ 构建部署",
		// 		// 	link: "/guide/build/cloud/quick_build",
		// 		// 	activeMatch: "/guide/build/",
		// 		// },
		// 		{
		// 			text: "📝 コード教室",
		// 			link: "/ja/guide/issues/issues_project/issues_project_records",
		// 			activeMatch: "/ja/guide/issues/",
		// 		},
		// 		// {
		// 		// 	text: "📤 更新升级",
		// 		// 	link: "/guide/logs/logs_version/logs_version",
		// 		// 	activeMatch: "/guide/logs/",
		// 		// },
		// 	],
		// },
		{
			text: "関連リンク", // 🔗
			items: [
				{
					text: "Gitee 倉庫",
					link: "https://gitee.com/ITdos/microi.net",
				},
				// {
				// 	text: "GitCode 仓库",
				// 	link: "https://gitcode.com/microi-net/microi.net",
				// },
				{
					text: "WebOS 試用",
					link: "https://webos.microi.net/",
				},
				{
					text: "従来のインタフェースの試用",
					link: "https://demo.microi.net/",
				},
				{
					text: "CSDN 公式ブログ",
					link: "https://microi.blog.csdn.net/?type=blog",
				},
				{
					text: "CSDN テクニカルブログ",
					link: "https://lisaisai.blog.csdn.net/?type=blog",
				},
			],
		},
		{ text: "連絡先", link: "/ja/contact/index" },
	];
}
