// 常用汉字拼音字典
export const pinyinDict = {
  '阿': 'a', '啊': 'a', '哎': 'ai', '唉': 'ai', '安': 'an', '按': 'an', '暗': 'an',
  '把': 'ba', '八': 'ba', '白': 'bai', '百': 'bai', '班': 'ban', '板': 'ban',
  '藏': 'cang', '操': 'cao', '草': 'cao', '测': 'ce', '层': 'ceng',
  '大': 'da', '打': 'da', '待': 'dai', '代': 'dai', '单': 'dan', '但': 'dan',
  '额': 'e', '恩': 'en', '而': 'er',
  '发': 'fa', '法': 'fa', '反': 'fan', '方': 'fang', '放': 'fang',
  '改': 'gai', '干': 'gan', '刚': 'gang', '高': 'gao', '告': 'gao',
  '好': 'hao', '和': 'he', '后': 'hou', '话': 'hua', '坏': 'huai',
  '见': 'jian', '将': 'jiang', '交': 'jiao', '接': 'jie', '进': 'jin',
  '开': 'kai', '看': 'kan', '靠': 'kao', '科': 'ke', '可': 'ke',
  '来': 'lai', '蓝': 'lan', '老': 'lao', '里': 'li', '理': 'li',
  '吗': 'ma', '买': 'mai', '卖': 'mai', '慢': 'man', '忙': 'mang',
  '你': 'ni', '年': 'nian', '念': 'nian', '女': 'nv',
  '哦': 'o',
  '怕': 'pa', '排': 'pai', '跑': 'pao', '配': 'pei', '片': 'pian',
  '七': 'qi', '起': 'qi', '气': 'qi', '千': 'qian', '前': 'qian',
  '让': 'rang', '日': 'ri', '容': 'rong', '如': 'ru', '软': 'ruan',
  '三': 'san', '上': 'shang', '少': 'shao', '谁': 'shei', '深': 'shen',
  '他': 'ta', '她': 'ta', '太': 'tai', '谈': 'tan', '汤': 'tang',
  '为': 'wei', '我': 'wo', '无': 'wu', '五': 'wu', '物': 'wu',
  '西': 'xi', '息': 'xi', '希': 'xi', '下': 'xia', '先': 'xian',
  '样': 'yang', '要': 'yao', '也': 'ye', '一': 'yi', '因': 'yin',
  '在': 'zai', '早': 'zao', '怎': 'zen', '张': 'zhang', '找': 'zhao',
  '中': 'zhong', '主': 'zhu', '住': 'zhu', '最': 'zui', '做': 'zuo'
};

// 获取单个汉字的拼音
export function getCharPinyin(char) {
  return pinyinDict[char] || char;
}

// 获取中文字符串的拼音
export function getStringPinyin(str, separator = '') {
  return str.split('').map(char => getCharPinyin(char)).join(separator);
}

// 获取中文字符串的拼音首字母
export function getFirstLetters(str) {
  return str.split('').map(char => {
    const pinyin = getCharPinyin(char);
    return pinyin ? pinyin.charAt(0) : char;
  }).join('');
}

// 获取中文字符串的拼音,支持自定义格式
// fullPyLen: 前几个字全拼音
// type: 1 驼峰（默认），2全大写，3全小写
export function ChineseToPinyin(chinese, fullPyLen = 2, type = 1) {
  if (!chinese) return '';
  
  const chars = chinese.split('');
  let result = '';
  
  chars.forEach((char, index) => {
    const pinyin = getCharPinyin(char);
    if (index < fullPyLen) {
      // 前fullPyLen个字使用全拼
      result += pinyin.charAt(0).toUpperCase() + pinyin.slice(1).toLowerCase();
    } else {
      // 后面的字只取首字母
      result += pinyin.charAt(0).toUpperCase();
    }
  });

  // 根据type处理大小写
  switch (type) {
    case 1: // 驼峰,保持现状
      return result;
    case 2: // 全大写
      return result.toUpperCase();
    case 3: // 全小写
      return result.toLowerCase();
    default:
      return result;
  }
} 