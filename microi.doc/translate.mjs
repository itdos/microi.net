import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import alimt20181012 from "@alicloud/alimt20181012";
import OpenApi from "@alicloud/openapi-client";

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const config = {
	aliyun: {
		accessKeyId: "LTAI5tCAyqZTYn1k8WDwmYDr",
		accessKeySecret: "27DG8hS4A90i2r11HAI6MruRQHdvjf",
		endpoint: "mt.aliyuncs.com",
	},
	sourceDir: path.join(__dirname, "docs"),
	translateDirs: ["apiengine", "case", "contact", "doc", "faq", "guide"],
	excludeFiles: [],
	// excludeFiles: ["index.md"],
	languages: [
		{ code: "en", name: "英文", target: "en" },
		{ code: "ja", name: "日语", target: "ja" },
	],
};

// 初始化翻译客户端
const client = new alimt20181012.default(new OpenApi.Config(config.aliyun));

/**
 * 翻译文本内容（带重试机制）
 */
async function translateText(text, to = "en") {
	if (!text.trim()) return text;

	try {
		const request = new alimt20181012.TranslateGeneralRequest({
			formatType: "text",
			sourceLanguage: "zh",
			targetLanguage: to,
			scene: "general",
			sourceText: text,
		});

		const response = await client.translateGeneralWithOptions(request, {});
		return response.body?.data?.translated || text;
	} catch (err) {
		console.error(`[${to}] 翻译失败:`, err.message);
		await new Promise((resolve) => setTimeout(resolve, 6000));
		return text;
	}
}

/**
 * 智能处理Markdown单行内容
 */
async function processMarkdownLine(line, lang) {
	if (!line.trim()) return line;

	// 2. 优先处理加粗段落
	if (line.startsWith("> **")) {
		return await processFormattedParagraph(line, lang);
	}

	// 标题行处理
	if (line.startsWith("#")) {
		const [headerPrefix, ...titleParts] = line.split(" ");
		const title = titleParts.join(" ");
		const translatedTitle = await translateText(title, lang.target);
		return `${headerPrefix} ${translatedTitle}`;
	}

	// 列表项处理
	if (line.startsWith(">* ")) {
		const bullet = line.slice(0, 3);
		let content = line.slice(3);

		// 处理带链接的列表项
		if (content.includes("](")) {
			const [textPart, urlPart] = content.split(/\]\(/);
			const linkText = textPart.replace(/^\[/, "");
			const translatedText = await translateText(linkText, lang.target);
			return `${bullet}[${translatedText}](${urlPart}`;
		}

		const translatedContent = await translateText(content, lang.target);
		return `${bullet}${translatedContent}`;
	}

	// 保留纯链接和代码块标记
	if (line.match(/^https?:\/\/\S+$/) || line.startsWith("```")) {
		return line;
	}

	return await translateText(line, lang.target);
}

/**
 * 增强版格式段落处理器
 */
async function processFormattedParagraph(line, lang) {
	console.log("line: ", line);
	// 情况1：匹配 > **标题**：内容（中文冒号）
	const case1Regex = /^(>\s*\*\*([^*]+)\*\*\s*：\s*)(.+)/;

	// 情况2：匹配 > **标题**: 内容（英文冒号）
	const case2Regex = /^(>\s*\*\*([^*]+)\*\*\s*:\s*)(.+)/;

	// 情况3：匹配 > **纯内容**
	const case3Regex = /^(>\s*\*\*([^*]+)\*\*\s*)$/;

	// 尝试匹配情况1（中文冒号）
	let match = line.match(case1Regex);
	if (match) {
		const [_, prefix, title, content] = match;
		const translatedTitle = await translateText(title.trim(), lang.target);
		const translatedContent = await translateText(content.trim(), lang.target);
		console.log("translatedTitle1: ", translatedTitle);
		console.log("translatedContent1: ", translatedContent);

		return `${prefix.replace(title, translatedTitle)}${translatedContent}`;
	}

	// 尝试匹配情况2（英文冒号）
	match = line.match(case2Regex);
	if (match) {
		const [_, prefix, title, content] = match;
		const translatedTitle = await translateText(title.trim(), lang.target);
		const translatedContent = await translateText(content.trim(), lang.target);
		return `${prefix.replace(title, translatedTitle)}${translatedContent}`;
	}

	// 尝试匹配情况3（纯内容）
	match = line.match(case3Regex);
	if (match) {
		const [_, prefix, content] = match;
		const translatedContent = await translateText(content.trim(), lang.target);
		return `${prefix.replace(content, translatedContent)}`;
	}

	return line;
}
/**
 * 完整Markdown文档翻译
 */
async function translateMarkdown(content, lang) {
	const lines = content.split("\n");
	let inCodeBlock = false;
	const results = [];

	for (const line of lines) {
		if (line.startsWith("```")) {
			inCodeBlock = !inCodeBlock;
			results.push(line);
			continue;
		}

		if (inCodeBlock) {
			results.push(line);
			continue;
		}

		results.push(await processMarkdownLine(line, lang));
	}

	return results.join("\n");
}

/**
 * 确保目录存在
 */
function ensureDir(dirPath) {
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
	}
}

/**
 * 递归处理目录中的所有Markdown文件
 */
async function processDirectory(currentDir, relativePath, lang) {
	const items = fs.readdirSync(currentDir);

	for (const item of items) {
		const fullPath = path.join(currentDir, item);
		const newRelativePath = path.join(relativePath, item);
		const stat = fs.statSync(fullPath);

		if (stat.isDirectory()) {
			// 递归处理子目录
			await processDirectory(fullPath, newRelativePath, lang);
		} else if (item.endsWith(".md") && !config.excludeFiles.includes(item)) {
			// 处理Markdown文件
			await processMarkdownFile(fullPath, newRelativePath, lang);
			await new Promise((resolve) => setTimeout(resolve, 1000)); // 防止API限流
		}
	}
}

/**
 * 处理单个Markdown文件
 */
async function processMarkdownFile(sourcePath, relativePath, lang) {
	try {
		// 文件名是index.md才能翻译
		// if (path.basename(sourcePath) !== "index.md") {
		// 	return;
		// }
		console.log(`[${lang.name}] 处理: ${relativePath}`);

		const content = fs.readFileSync(sourcePath, "utf8");
		const translatedContent = await translateMarkdown(content, lang);
		const targetPath = path.join(config.sourceDir, lang.target, relativePath);

		ensureDir(path.dirname(targetPath));
		fs.writeFileSync(targetPath, translatedContent);

		console.log(`[${lang.name}] 生成: ${path.relative(config.sourceDir, targetPath)}`);
	} catch (err) {
		console.error(`[${lang.name}] 处理失败:`, err);
	}
}

/**
 * 主函数
 */
async function main() {
	console.log("开始文档翻译（递归处理子目录）...");

	// 初始化输出目录
	config.languages.forEach((lang) => {
		ensureDir(path.join(config.sourceDir, lang.target));
		console.log(`输出目录 [${lang.name}]: docs/${lang.target}/`);
	});

	// 处理每个配置的目录
	for (const dir of config.translateDirs) {
		const sourcePath = path.join(config.sourceDir, dir);
		if (!fs.existsSync(sourcePath)) {
			console.warn(`警告: 目录不存在 - ${sourcePath}`);
			continue;
		}

		console.log(`\n处理目录: ${dir}`);
		for (const lang of config.languages) {
			await processDirectory(sourcePath, dir, lang);
		}
	}

	console.log("\n翻译完成！");
}

// 启动
main().catch((err) => {
	console.error("运行失败:", err);
	process.exit(1);
});
