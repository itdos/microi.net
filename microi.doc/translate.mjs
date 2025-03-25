import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import alimt20181012 from "@alicloud/alimt20181012";
import OpenApi from "@alicloud/openapi-client";
import { marked } from 'marked';

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const config = {
  aliyun: {
    accessKeyId: "LTAI5tCAyqZTYn1k8WDwmYDr",
    accessKeySecret: "27DG8hS4A90i2r11HAI6MruRQHdvjf",
    endpoint: "mt.aliyuncs.com"
  },
  sourceDir: path.join(__dirname, 'docs'),
  translateDirs: ['apiengine', 'case', 'contact', 'doc', 'faq', 'guide', 'pubix'],
  excludeFiles: ['index.md'],
  languages: [
    { code: 'en', name: '英文', target: 'en' },
    { code: 'ja', name: '日语', target: 'ja' }
  ]
};

// 初始化翻译客户端
const client = new alimt20181012.default(
  new OpenApi.Config(config.aliyun)
);

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
    await new Promise(resolve => setTimeout(resolve, 6000));
    return text; // 返回原文避免中断
  }
}

/**
 * 处理Markdown内容（跳过代码块）
 */
async function processMarkdown(content, lang) {
  const tokens = marked.lexer(content);
  let output = '';
  
  for (const token of tokens) {
    if (token.type === 'code' || token.type === 'html') {
      // 保留代码块和HTML原样
      output += `${token.raw}\n`;
    } else if (token.type === 'table') {
      // 表格需要单独处理每个单元格
      let tableText = '';
      for (const row of token.rows) {
        tableText += `| ${(await Promise.all(
          row.map(cell => translateText(cell.text, lang.target))
        )).join(' | ')} |\n`;
      }
      output += tableText;
    } else if (token.text) {
      // 翻译普通文本
      output += await translateText(token.text, lang.target);
    } else {
      // 保留其他标记原样
      output += token.raw || '';
    }
  }
  
  return output;
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
    console.log(`[${lang.name}] 正在处理: ${relativePath}`);
    
    const content = fs.readFileSync(sourcePath, 'utf8');
    const translatedContent = await processMarkdown(content, lang);
    
    const targetPath = path.join(config.sourceDir, lang.target, relativePath);
    ensureDir(path.dirname(targetPath));
    
    fs.writeFileSync(targetPath, translatedContent);
    console.log(`[${lang.name}] 生成: ${path.relative(config.sourceDir, targetPath)}`);
  } catch (err) {
    console.error(`[${lang.name}] 处理失败: ${relativePath}`, err);
  }
}

/**
 * 主流程
 */
async function main() {
  console.log('开始文档翻译（跳过代码块）...');
  
  // 初始化输出目录
  config.languages.forEach(lang => {
    ensureDir(path.join(config.sourceDir, lang.target));
  });

  // 处理每个目录
  for (const dir of config.translateDirs) {
    const processDir = async (currentDir, relativePath = '') => {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const newRelativePath = path.join(relativePath, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          await processDir(fullPath, newRelativePath);
        } else if (
          item.endsWith('.md') && 
          !config.excludeFiles.includes(item)
        ) {
          for (const lang of config.languages) {
            await processMarkdownFile(fullPath, newRelativePath, lang);
            await new Promise(resolve => setTimeout(resolve, 1000)); // 防止API限流
          }
        }
      }
    };
    
    const sourcePath = path.join(config.sourceDir, dir);
    if (fs.existsSync(sourcePath)) {
      console.log(`\n处理目录: ${dir}`);
      await processDir(sourcePath, dir);
    }
  }

  console.log('\n翻译完成！');
}

main().catch(console.error);