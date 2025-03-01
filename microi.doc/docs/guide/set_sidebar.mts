import path from 'node:path';
import fs from 'node:fs';
// 文件根目录
const DIR_PATH = path.resolve();
// 映射文件路径
const MAPPING_FILE_PATH = path.join(DIR_PATH, "docs/guide", 'mapping.json');
// 白名单,过滤不是文章的文件和文件夹
const WHITE_LIST = ['.vitepress', 'node_modules', '.idea', 'assets'];

// 读取映射文件
let nameMappings = {};

if (fs.existsSync(MAPPING_FILE_PATH)) {
	console.log('映射文件存在:', MAPPING_FILE_PATH);
	try {
		const data = fs.readFileSync(MAPPING_FILE_PATH, 'utf8');
		const jsonData = removeBOM(data);
		nameMappings = JSON.parse(jsonData);
		// console.log('映射文件读取成功:', nameMappings);
	} catch (err) {
		console.error('读取映射文件时发生错误:', err);
	}
}
// 判断是否是文件夹
const isDirectory = (path) => fs.lstatSync(path).isDirectory();

// 取差值
const intersections = (arr1, arr2) =>
	Array.from(new Set(arr1.filter((item) => !new Set(arr2).has(item))));

// 把方法导出直接使用
function getList(params, path1, pathname, ifSort, collapsed, sortOrder) {
	// 存放结果
	let res = [];
	// 如果启用了排序
	if (!ifSort && sortOrder) {
		// 使用 sortOrder 数组来确定文件的顺序
		params.sort((a, b) => sortOrder.indexOf(a) - sortOrder.indexOf(b));
	}
	// 开始遍历params
	for (let file of params) {
		// 获取文件或文件夹的映射名称，如果存在
		const mappedName = nameMappings[file] || file;
		// 拼接目录
		const dir = path.join(path1, file);
		// 判断是否是文件夹
		const isDir = isDirectory(dir);
		if (isDir) {
			// 如果是文件夹,读取之后作为下一次递归参数
			let files = fs.readdirSync(dir);
			if (!ifSort) {
				// 根据 sortOrder 中的顺序过滤和排序目录中的文件
				files = files.filter(file => sortOrder.includes(file)).sort((a, b) => {
					return sortOrder.indexOf(a) - sortOrder.indexOf(b);
				});
			}
			let items = getList(files, dir, `${pathname}/${file}`, ifSort, collapsed, sortOrder);
			if (ifSort) items = items.sort(sortItemsByText);
			// else items = items.reverse();
			res.push({
				text: mappedName,
				collapsible: true,
				collapsed: collapsed,
				items: items,
			});
		} else {
			// 获取名字
			let name = path.basename(file)
			// 排除非 md 文件
			const suffix = path.extname(file);
			if (suffix !== '.md') {
				continue;
			}
			// 去掉后缀
			name = name.replace(suffix, '');
			// 添加到结果
			res.push({
				text: mappedName,
				link: `${pathname}/${name}`,
			});
		}
	}
	console.log(res)
	return res;
}

/*
 * 设置侧边栏
 * @param {string} pathname 路径
 * @param {boolean} ifSort 是否排序
 * @param {boolean} collapsed 是否折叠
 */
export const set_sidebar = (pathname, ifSort = false, collapsed = false) => {
	// 获取pathname的路径
	const dirPath = path.join(DIR_PATH, "docs", pathname);
	// 读取pathname下的所有文件或者文件夹
	const files = fs.readdirSync(dirPath);
	// 过滤掉
	const items = intersections(files, WHITE_LIST);
	// 根据mapping.json文件中定义的顺序对files排序
	const sortOrder = Object.keys(nameMappings);
	// getList
	const sidebars = getList(items, dirPath, pathname, ifSort, collapsed, sortOrder);
	//输出sidebars 转为json数组字符串格式
	// console.log(JSON.stringify(sidebars, null, 2));
	return sidebars;
};

/*
 * 从字符串中删除 BOM
 */
function removeBOM(content) {
	if (content.charCodeAt(0) === 0xFEFF) {
		return content.slice(1);
	}
	return content;
}

/*
 * 按照文本排序
 */
function sortItemsByText(a, b) {
	// 分隔字符串，获取第一部分，例如 “2. 页面导航” 将会得到 “2.”
	let aFirstPart = a.text.split(' ')[0];
	let bFirstPart = b.text.split(' ')[0];

	// 去除末尾的非数字字符，例如 “2.” 将会变成 “2”
	aFirstPart = aFirstPart.replace(/\D*$/, '');
	bFirstPart = bFirstPart.replace(/\D*$/, '');
	// 如果aFirstPart和bFirstPart都包含数字，则比较数字大小
	if (aFirstPart && bFirstPart) {
		return compareNumbers(aFirstPart, bFirstPart);
	}
	// 如果任意一方或双方不包含数字，按照它们原始索引位置排序
	return 0;
}

/*
 * 比较版本号
 */
function compareVersionNumbers(a, b) {
	const aParts = a.split('.');
	const bParts = b.split('.');
	for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
		const aPart = parseInt(aParts[i] || 0, 10);
		const bPart = parseInt(bParts[i] || 0, 10);
		if (aPart !== bPart) {
			return aPart - bPart;
		}
	}

	// 如果所有部分都相同，那么版本号相同
	return 0;
}
