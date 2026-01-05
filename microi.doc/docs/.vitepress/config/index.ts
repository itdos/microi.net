import { defineConfig } from "vitepress";
import { shared } from "./shared";
import { en } from "./en";
import { zh } from "./zh";
import { ja } from "./ja";

export default defineConfig({
	...shared,
	locales: {
		root: { label: "简体中文", ...zh },
		en: { label: "English", ...en },
		ja: { label: "日本語", ...ja }
	},
});
