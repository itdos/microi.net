import { defineConfig } from "vitepress";
import { groupIconMdPlugin, groupIconVitePlugin, localIconLoader } from "vitepress-plugin-group-icons";
import mdItCustomAttrs from "markdown-it-custom-attrs";

export const shared = defineConfig({
	title: "Microi吾码",
	lastUpdated: true,
	markdown: {
		theme: "github-dark",
		lineNumbers: true,
		html: true,
		config: (md) => md.use(mdItCustomAttrs, "image", { "data-fancybox": "gallery" }),
	},
	/* prettier-ignore */
	head: [
		["meta", { name: "author", content: "Microi风闲" }],
		["meta", { name: "keywords", content: "Microi吾码,低代码,开源 AI 低代码平台,小吾科技,Microi.net,Microi,iTdos,itdos.com,microios,Dos,Dos.,Dos.ORM,Dos.Common" }],
		["link", { rel: "icon", href: "/icon.png" }],
		["link", { rel: "stylesheet", href: "/assets/fancybox.css" }],
		["script", { src: "/assets/fancybox.umd.js" }],
	],
	themeConfig: {
		logo: "/icon.png",
		socialLinks: [
			{
				icon: {
					svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M11.984 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.016 0zm6.09 5.333c.328 0 .593.266.593.593v1.482a.594.594 0 0 1-.593.593H9.777c-.982 0-1.778.796-1.778 1.778v5.63c0 .327.266.592.593.592h5.63c.982 0 1.778-.796 1.778-1.778v-.296a.593.593 0 0 0-.593-.593h-4.15a.593.593 0 0 1-.593-.593v-1.482a.593.593 0 0 1 .593-.593h6.666c.327 0 .593.265.593.592v3.408a4 4 0 0 1-4 4H5.926a.593.593 0 0 1-.593-.593V9.778a4.444 4.444 0 0 1 4.444-4.444h8.296z" fill="#C71D23"/></svg>',
				},
				link: "https://gitee.com/ITdos/microi.net",
			},
		],

		search: {
			provider: "local",
		},
	},
	vite: {
		plugins: [],
		server: {
			port: 2015,
			strictPort: false,
		},
	},
});
