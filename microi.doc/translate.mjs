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
	// 阿里云翻译API配置
	aliyun: {
		accessKeyId: "LTAI5tCAyqZTYn1k8WDwmYDr", // 替换为你的AK
		accessKeySecret: "27DG8hS4A90i2r11HAI6MruRQHdvjf", // 替换为你的SK
		endpoint: "mt.aliyuncs.com",
	},
	// 源文档目录（相对于脚本位置）
	sourceDir: path.join(__dirname, "docs"),
	// 要翻译的子目录（相对docs的路径）
	translateDirs: ["apiengine", "case", "contact", "doc", "faq", "guide"],
	// 排除文件
	excludeFiles: ["index.md"],
	// 输出语言配置
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
		await new Promise((resolve) => setTimeout(resolve, 6000)); // 6秒延迟
		return text;
	}
}

/**
 * 智能处理Markdown单行内容
 */
async function processMarkdownLine(line, lang) {
	// 空行保留
	if (!line.trim()) return line;

	// 标题行处理 (如 # 标题)
	if (line.startsWith("#")) {
		const [headerPrefix, ...titleParts] = line.split(" ");
		const title = titleParts.join(" ");
		const translatedTitle = await translateText(title, lang.target);
		return `${headerPrefix} ${translatedTitle}`;
	}

	// 列表项处理 (如 >* 内容)
	if (line.startsWith(">* ")) {
		const bullet = line.slice(0, 3); // 保留 ">* "
		let content = line.slice(3);

		// 处理带链接的列表项 (如 [text](url))
		if (content.includes("](")) {
			const [textPart, urlPart] = content.split(/\]\(/);
			const linkText = textPart.replace(/^\[/, "");
			const translatedText = await translateText(linkText, lang.target);
			return `${bullet}[${translatedText}](${urlPart}`;
		}

		// 普通列表项
		const translatedContent = await translateText(content, lang.target);
		return `${bullet}${translatedContent}`;
	}

	// 纯链接行保留 (如 https://example.com)
	if (line.match(/^https?:\/\/\S+$/)) return line;

	// 代码块标记保留 (```)
	if (line.startsWith("```")) return line;

	// 默认情况：翻译整行
	return await translateText(line, lang.target);
}

/**
 * 完整Markdown文档翻译
 */
async function translateMarkdown(content, lang) {
	const lines = content.split("\n");
	let inCodeBlock = false;
	const results = [];

	for (const line of lines) {
		// 代码块开始/结束标记
		if (line.startsWith("```")) {
			inCodeBlock = !inCodeBlock;
			results.push(line);
			continue;
		}

		// 代码块内内容原样保留
		if (inCodeBlock) {
			results.push(line);
			continue;
		}

		// 处理普通行
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
 * 处理单个Markdown文件
 */
async function processMarkdownFile(sourcePath, relativePath, lang) {
	try {
		console.log(`[${lang.name}] 处理: ${relativePath}`);

		// 读取+翻译+写入
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
	console.log("开始文档翻译（保留格式）...");
	console.log(`源目录: ${config.sourceDir}`);

	// 初始化输出目录
	config.languages.forEach((lang) => {
		const outputDir = path.join(config.sourceDir, lang.target);
		ensureDir(outputDir);
		console.log(`输出目录 [${lang.name}]: ${outputDir}`);
	});

	// 处理每个子目录
	for (const dir of config.translateDirs) {
		const sourcePath = path.join(config.sourceDir, dir);
		if (!fs.existsSync(sourcePath)) {
			console.warn(`警告: 目录不存在 - ${sourcePath}`);
			continue;
		}

		console.log(`\n处理目录: ${dir}`);
		const items = fs.readdirSync(sourcePath);

		for (const item of items) {
			if (item.endsWith(".md") && !config.excludeFiles.includes(item)) {
				const fullPath = path.join(sourcePath, item);
				for (const lang of config.languages) {
					await processMarkdownFile(fullPath, path.join(dir, item), lang);
					await new Promise((resolve) => setTimeout(resolve, 1000)); // 防止API限流
				}
			}
		}
	}

	console.log("\n翻译完成！");
}

// 启动
main().catch((err) => {
	console.error("运行失败:", err);
	process.exit(1);
});
