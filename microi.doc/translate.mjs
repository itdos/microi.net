import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import alimt20181012 from "@alicloud/alimt20181012";
import OpenApi from "@alicloud/openapi-client";
import pLimit from "p-limit";

// 创建并发限制器，最大并发数20
const limit = pLimit(5);

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const config = {
	aliyun: {
		// 赛哥的key
		accessKeyId: "LTAI5t5ZPCYSqsQMVAWcbqY4",
		accessKeySecret: "5VVAcWLvFOiOscYCS8UNeFZgikLRO5",
		endpoint: "mt.aliyuncs.com",
	},
	sourceDir: path.join(__dirname, "docs"),
	translateDirs: ["apiengine", "case", "contact", "doc", "faq", "guide"],
	// translateDirs: ["doc"],
	excludeFiles: ["aboutus.md"],
	// excludeFiles: ["aboutus.md"],
	languages: [
		{ code: "en", name: "英文", target: "en" },
		{ code: "ja", name: "日语", target: "ja" },
	],
	// 不翻译的文本模式 (正则表达式)
	noTranslatePatterns: [
		/<img[^>]*>/i, // 图片标签
		// /`[^`]+`/, // 行内代码
		/\[([^\]]+)\]\([^)]+\)/, // 链接
		/\([\u4e00-\u9fa5]+\)/, // 括号中的中文（如人名）
	],
};

// 初始化翻译客户端
const client = new alimt20181012.default(new OpenApi.Config(config.aliyun));

/**
 * 检查是否需要跳过翻译
 */
function shouldSkipTranslation(text) {
	return config.noTranslatePatterns.some((pattern) => pattern.test(text));
}

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
		// console.error("翻译失败:", err);
		// 重复尝试
		const retryLimit = 3;
		let attempts = 0;
		let translatedText = text;
		while (attempts < retryLimit) {
			try {
				const request = new alimt20181012.TranslateGeneralRequest({
					formatType: "text",
					sourceLanguage: "zh",
					targetLanguage: to,
					scene: "general",
					sourceText: text,
				});

				const response = await client.translateGeneralWithOptions(request, {});
				translatedText = response.body?.data?.translated || text;
				break; // 成功翻译，退出重试循环
			} catch (err) {
				attempts++;
				if (attempts >= retryLimit) {
					console.error("翻译失败:", err, text);
				}
			}
		}
		return translatedText;
	}
}

/**
 * 处理Markdown表格行
 */
async function processMarkdownTable(line, lang) {
	// 表格分隔线保持不变
	if (line.match(/^\|(\s*:?-+:?\s*\|)+$/)) {
		return line;
	}

	// 表格内容行
	if (line.startsWith("|") && line.endsWith("|")) {
		const cells = line.split("|").map((cell) => cell.trim());
		let translatedLine = "|";

		for (let i = 1; i < cells.length - 1; i++) {
			const cell = cells[i];

			// 跳过图片、空单元格或不需要翻译的内容
			if (shouldSkipTranslation(cell) || cell === "") {
				translatedLine += ` ${cell} |`;
				continue;
			}

			// 处理带括号的文本（如"商务(邓总)"）
			const bracketMatch = cell.match(/^([^(]+)(\([\u4e00-\u9fa5]+\))$/);
			if (bracketMatch) {
				const [_, prefix, suffix] = bracketMatch;
				const translatedPrefix = await translateText(prefix, lang.target);
				translatedLine += ` ${translatedPrefix}${suffix} |`;
			} else {
				const translatedCell = await translateText(cell, lang.target);
				translatedLine += ` ${translatedCell} |`;
			}
		}

		return translatedLine;
	}

	return line;
}

/**
 * 智能处理Markdown单行内容（增强版）
 */
async function processMarkdownLine(line, lang) {
	if (!line.trim()) return line;

	// 处理列表项中的加粗文本格式（* **text**: desc）
	const boldListItemMatch = line.match(/^(\s*[*+-]\s+\*\*)([^*]+)(\*\*\s*[:：]\s*)(.+)/);
	if (boldListItemMatch) {
		const [_, prefix, boldText, colonPart, description] = boldListItemMatch;

		// 翻译加粗标题和描述内容
		const translatedBold = await translateText(boldText, lang.target);
		const translatedDesc = await translateText(description, lang.target);

		// 保留原格式符号，只替换文本内容
		return `${prefix}${translatedBold}${colonPart}${translatedDesc}`;
	}

	// 1. 首先处理列表项开头的格式（保留 - 或 * 等符号）
	const listItemMatch = line.match(/^(\s*[-+*]\s+)/);
	let listPrefix = "";
	let contentAfterPrefix = line;

	if (listItemMatch) {
		listPrefix = listItemMatch[0];
		contentAfterPrefix = line.slice(listPrefix.length);
	}

	// 2. 定义需要保护的技术术语和代码标签
	const PROTECTED_TERMS = [
		"Vue\\d\\.\\d", // Vue版本号
		"Vite\\d", // Vite版本号
		"TS",
		"Pinia",
		"Element-Plus",
		"<script\\s+setup>",
		"SFC",
	];
	// const protectedRegex = new RegExp(`(${PROTECTED_TERMS.join('|')}|\\`.+?\\`)`, 'g');
	const protectedRegex = new RegExp(`(${PROTECTED_TERMS.join("|")}|\`.+?\`)`, "g");
	let lastIndex = 0;
	let result = "";
	let match;

	// 3. 处理所有受保护的内容（技术术语和反引号代码）
	while ((match = protectedRegex.exec(contentAfterPrefix)) !== null) {
		// 翻译保护内容前的文本
		const textBefore = contentAfterPrefix.slice(lastIndex, match.index);
		if (textBefore) {
			result += await translateText(textBefore, lang.target);
		}

		// 保留保护内容原样
		result += match[0];
		lastIndex = match.index + match[0].length;
	}

	// 4. 处理剩余文本
	if (lastIndex < contentAfterPrefix.length) {
		result += await translateText(contentAfterPrefix.slice(lastIndex), lang.target);
	}

	// 5. 组合最终结果（保留原始列表前缀）
	let finalResult = listPrefix + result;

	// 6. 处理加粗语法（**text**）
	finalResult = await processBoldText(finalResult, lang);

	// 7. 其他特殊格式处理（保持不变）
	if (line.startsWith("![") && line.includes("](")) {
		return line;
	}
	if (line.startsWith("> **")) {
		return await processFormattedParagraph(line, lang);
	}
	if (line.startsWith("- **")) {
		return await processFormattedParagraph2(line, lang);
	}
	if (line.startsWith(">* **")) {
		return await processFormattedParagraph3(line, lang);
	}

	if (/^\s*\|/.test(line)) {
		return await processMarkdownTable(line, lang);
	}
	if (line.startsWith("#")) {
		const [headerPrefix, ...titleParts] = line.split(" ");
		const title = titleParts.join(" ");
		const translatedTitle = await translateText(title, lang.target);
		return `${headerPrefix} ${translatedTitle}`;
	}
	if (line.match(/^https?:\/\/\S+$/) || line.startsWith("```")) {
		return line;
	}

	return finalResult;
}

// 辅助函数：处理加粗文本
async function processBoldText(text, lang) {
	const boldRegex = /\*\*([^*]+)\*\*/g;
	let lastIndex = 0;
	let result = "";
	let match;

	while ((match = boldRegex.exec(text)) !== null) {
		// 翻译加粗标记前的文本
		const textBefore = text.slice(lastIndex, match.index);
		if (textBefore) {
			result += textBefore;
		}

		// 翻译加粗内容（保留加粗标记）
		const boldContent = match[1];
		const translatedBold = await translateText(boldContent, lang.target);
		result += `**${translatedBold}**`;
		lastIndex = match.index + match[0].length;
	}

	// 处理剩余文本
	if (lastIndex < text.length) {
		result += text.slice(lastIndex);
	}

	return result;
}

// 辅助函数：处理带行内代码的文本
async function processTextWithInlineCode(text, lang) {
	const inlineCodeRegex = /`([^`]+)`/g;
	let lastIndex = 0;
	let result = "";
	let match;

	while ((match = inlineCodeRegex.exec(text)) !== null) {
		// 翻译代码前的文本
		const textBefore = text.slice(lastIndex, match.index);
		if (textBefore) {
			result += await translateText(textBefore, lang.target);
		}

		// 保留代码
		result += `\`${match[1]}\``;
		lastIndex = match.index + match[0].length;
	}

	// 处理剩余文本
	if (lastIndex < text.length) {
		result += await translateText(text.slice(lastIndex), lang.target);
	}

	return result || text;
}

/**
 * 增强版格式段落处理器
 */
async function processFormattedParagraph(line, lang) {
	// console.log("line: ", line);
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
 * 增强版格式段落处理器
 */
async function processFormattedParagraph2(line, lang) {
	// console.log("line: ", line);
	// 情况1：匹配 - **标题**：内容（中文冒号）
	const case1Regex = /^(-\s*\*\*([^*]+)\*\*\s*：\s*)(.+)/;

	// 情况2：匹配 - **标题**: 内容（英文冒号）
	const case2Regex = /^(-\s*\*\*([^*]+)\*\*\s*:\s*)(.+)/;

	// 情况3：匹配 - **纯内容**
	const case3Regex = /^(-\s*\*\*([^*]+)\*\*\s*)$/;

	// 尝试匹配情况1（中文冒号）
	let match = line.match(case1Regex);
	if (match) {
		const [_, prefix, title, content] = match;
		const translatedTitle = await translateText(title.trim(), lang.target);
		const translatedContent = await translateText(content.trim(), lang.target);
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
 * 增强版格式段落处理器
 */
async function processFormattedParagraph3(line, lang) {
	// console.log("line: ", line);
	// 情况1：匹配 >* **标题**：内容（中文冒号）
	const case1Regex = /^(>\*\s*\*\*([^*]+)\*\*\s*：\s*)(.+)/;

	// 情况2：匹配 >* **标题**: 内容（英文冒号）
	const case2Regex = /^(>\*\s*\*\*([^*]+)\*\*\s*:\s*)(.+)/;

	// 情况3：匹配 >* **纯内容**
	const case3Regex = /^(>\*\s*\*\*([^*]+)\*\*\s*)$/;

	// 尝试匹配情况1（中文冒号）
	let match = line.match(case1Regex);
	if (match) {
		const [_, prefix, title, content] = match;
		const translatedTitle = await translateText(title.trim(), lang.target);
		const translatedContent = await translateText(content.trim(), lang.target);
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
 * 完整Markdown文档翻译（跳过HTML/Vue标签内容）
 */
async function translateMarkdown(content, lang) {
	const lines = content.split("\n");
	let inCodeBlock = false;
	let inHtmlTag = false;
	const results = [];

	for (const line of lines) {
		const trimmedLine = line.trim();

		// 跳过代码块
		if (trimmedLine.startsWith("```")) {
			inCodeBlock = !inCodeBlock;
			results.push(line);
			continue;
		}

		// 检测 HTML/Vue 标签（包括 <img>，无论是否自闭合）
		if (!inCodeBlock && !inHtmlTag && trimmedLine.match(/^<([a-zA-Z][a-zA-Z0-9]*)([^>]*)>$/)) {
			const tagName = trimmedLine.match(/^<([a-zA-Z]+)/)?.[1];
			// 如果是 <img> 标签（无论是否自闭合），直接跳过，不设置 inHtmlTag
			if (tagName === "img") {
				results.push(line);
				continue;
			}
			// 其他非自闭合标签（如 <VPTeamPage>），标记 inHtmlTag = true
			if (!trimmedLine.endsWith("/>")) {
				inHtmlTag = true;
			}
			results.push(line);
			continue;
		}

		// 跳过代码块或 HTML/Vue 标签内的内容
		if (inCodeBlock || inHtmlTag) {
			results.push(line);
			// 检测标签结束（如 </VPTeamPage>）
			if (trimmedLine.startsWith("</")) {
				inHtmlTag = false;
			}
			continue;
		}

		// 普通文本行，进行翻译
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
	const promises = [];

	for (const item of items) {
		const fullPath = path.join(currentDir, item);
		const newRelativePath = path.join(relativePath, item);
		const stat = fs.statSync(fullPath);

		if (stat.isDirectory()) {
			// 递归处理子目录（保持同步，避免嵌套并发）
			await processDirectory(fullPath, newRelativePath, lang);
		} else if (item.endsWith(".md") && !config.excludeFiles.includes(item)) {
			// 将文件处理任务加入并发队列
			promises.push(
				limit(() =>
					processMarkdownFile(fullPath, newRelativePath, lang)
						.then(() => console.log(`[${lang.name}] 完成: ${newRelativePath}`))
						.catch((err) => console.error(`[${lang.name}] 处理失败: ${newRelativePath}`, err))
				)
			);
		}
	}

	// 等待所有文件处理完成
	await Promise.all(promises);
}

/**
 * 处理单个Markdown文件
 */
async function processMarkdownFile(sourcePath, relativePath, lang) {
	try {
		// if (path.basename(sourcePath) !== "index.md") {
		// 	return;
		// }
		console.log(`[${lang.name}] 开始处理: ${relativePath}`);

		const content = fs.readFileSync(sourcePath, "utf8");
		const translatedContent = await translateMarkdown(content, lang);
		const targetPath = path.join(config.sourceDir, lang.target, relativePath);

		ensureDir(path.dirname(targetPath));
		fs.writeFileSync(targetPath, translatedContent);

		return targetPath;
	} catch (err) {
		console.error(`[${lang.name}] 处理失败:`, err);
		throw err; // 重新抛出错误以便外部捕获
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
