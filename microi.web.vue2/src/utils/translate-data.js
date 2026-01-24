/**
 * 前端数据翻译工具
 * 用于将接口返回的中文数据翻译成当前选择的语言
 */

import { DiyCommon } from "@/utils/microi.net.import";

/**
 * 翻译单个文本
 * @param {string} text - 要翻译的文本
 * @param {string} currentLang - 当前语言代码（如 'english', 'chinese_simplified'）
 * @returns {string} - 翻译后的文本
 */
/**
 * 初始化实时翻译监听器
 * 启动 translate.listener.start() 来监听DOM变化并自动翻译
 */
export function initRealTimeTranslation() {
    // 检查 window.translate 是否存在
    if (typeof window.translate === 'undefined' || !window.translate) {
        console.warn('⚠️ window.translate 不存在，无法启动实时翻译');
        return false;
    }
    
    // 检查是否已经启动过 listener
    if (window.translate.listener && window.translate.listener.isStart) {
        console.log('✅ 实时翻译监听器已启动（之前已启动）');
        return true;
    }
    
    try {
        // 设置翻译服务（如果需要）
        if (window.translate.service && window.translate.service.use) {
            // 使用 client.edge 服务（免费）
            window.translate.service.use('client.edge');
            console.log('✅ 翻译服务已设置为 client.edge');
        }
        
        // 隐藏默认的语言选择器（因为我们有自己的语言选择组件）
        if (window.translate.selectLanguageTag) {
            window.translate.selectLanguageTag.show = false;
            console.log('✅ 已隐藏默认语言选择器');
        }
        
        // 启动实时翻译监听器
        if (window.translate.listener && window.translate.listener.start) {
            window.translate.listener.start();
            console.log('✅ 实时翻译监听器已启动（listener.start()）');
            // 注意：不在这里设置语言，语言设置由 LangSelect 组件统一管理
            return true;
        } else {
            console.error('❌ window.translate.listener.start 不存在');
            console.log('window.translate 结构:', Object.keys(window.translate || {}));
            if (window.translate.listener) {
                console.log('window.translate.listener 结构:', Object.keys(window.translate.listener || {}));
            }
            return false;
        }
    } catch (e) {
        console.error('❌ 启动实时翻译监听器失败:', e);
        console.error('错误堆栈:', e.stack);
        return false;
    }
}

/**
 * 设置翻译目标语言
 * @param {string} currentLang - 当前语言代码（如 'english', 'chinese_simplified'）
 */
// 防止重复设置的标记
let isSettingLanguage = false;

export function setTranslateLanguage(currentLang) {
    if (!currentLang) {
        currentLang = localStorage.getItem("Microi.Lang") || "chinese_simplified";
    }
    
    // 检查 window.translate 是否存在
    if (typeof window.translate === 'undefined' || !window.translate) {
        console.warn('⚠️ window.translate 不存在，无法设置翻译语言');
        return;
    }
    
    // 防止重复设置
    if (isSettingLanguage) {
        console.log('⚠️ 正在设置语言，跳过重复调用');
        return;
    }
    
    // 检查当前语言是否已经设置，避免重复设置
    if (window.translate.to === currentLang) {
        console.log('✅ 翻译目标语言已经是:', currentLang);
        return;
    }
    
    isSettingLanguage = true;
    
    try {
        // 如果是中文，不需要翻译，设置为中文
        if (currentLang === 'chinese_simplified' || currentLang === 'chinese_traditional') {
            // 中文不需要翻译，但需要确保 translate.to 有值，避免 undefined
            window.translate.to = currentLang;
            if (window.translate.storage && window.translate.storage.set) {
                window.translate.storage.set('to', currentLang);
            }
            console.log('✅ 翻译目标语言已设置为:', currentLang, '(中文，不翻译)');
            isSettingLanguage = false;
            return;
        }
        
        // translate.js 的 changeLanguage 方法会刷新页面，所以我们直接设置 translate.to
        // 直接使用 currentLang，不要转换
        let targetLang = currentLang;
        
        // 直接设置 translate.to，避免使用 changeLanguage() 导致页面刷新
        window.translate.to = targetLang;
        
        // 同时保存到 storage，确保持久化
        if (window.translate.storage && window.translate.storage.set) {
            window.translate.storage.set('to', targetLang);
        }
        
        console.log('✅ 翻译目标语言已设置为:', targetLang);
        
        // 注意：不要调用 translate.execute()，让实时翻译监听器自动处理
        // 如果需要立即翻译当前页面，可以在外部调用 execute()
    } catch (e) {
        console.error('❌ 设置翻译语言失败:', e);
        console.error('错误堆栈:', e.stack);
    } finally {
        // 延迟重置标记，避免快速连续调用时的问题
        setTimeout(() => {
            isSettingLanguage = false;
        }, 100);
    }
}

/**
 * 翻译页面上的动态渲染内容
 * 在数据渲染到页面后调用此方法，会使用 translate.execute() 翻译页面上的文本
 * 如果已启动实时翻译，新渲染的内容会自动被翻译
 * @param {HTMLElement|string} element - 要翻译的元素选择器或元素对象，如果不传则翻译整个页面
 * @param {string} currentLang - 当前语言代码
 */
export function translatePageContent(element = null, currentLang = null) {
    if (!currentLang) {
        currentLang = localStorage.getItem("Microi.Lang") || "chinese_simplified";
    }
    
    // 如果是中文，不需要翻译
    if (currentLang === 'chinese_simplified' || currentLang === 'chinese_traditional') {
        return;
    }
    
    // 检查 window.translate 是否存在
    if (typeof window.translate === 'undefined' || !window.translate || !window.translate.execute) {
        console.warn('window.translate.execute 不存在，无法翻译页面内容');
        return;
    }
    
    // 设置目标语言
    setTranslateLanguage(currentLang);
    
    try {
        // 如果指定了元素，只翻译该元素及其子元素
        if (element) {
            let targetElement = null;
            if (typeof element === 'string') {
                // 如果是选择器字符串
                targetElement = document.querySelector(element);
            } else if (element instanceof HTMLElement) {
                // 如果是元素对象
                targetElement = element;
            } else if (element.$el) {
                // 如果是 Vue 组件实例
                targetElement = element.$el;
            }
            
            if (targetElement) {
                // translate.execute() 可以接受元素数组作为参数
                window.translate.execute([targetElement]);
                console.log('已翻译元素:', element);
            } else {
                console.warn('未找到要翻译的元素:', element);
                // 如果找不到元素，翻译整个页面
                window.translate.execute();
            }
        } else {
            // 翻译整个页面
            window.translate.execute();
            console.log('已翻译整个页面，目标语言:', currentLang);
        }
    } catch (e) {
        console.error('翻译页面内容失败:', e);
    }
}

/**
 * 翻译单个文本（保留此方法以兼容现有代码，但实际翻译需要在页面渲染后调用 translatePageContent）
 * @param {string} text - 要翻译的文本
 * @param {string} currentLang - 当前语言代码（如 'english', 'chinese_simplified'）
 * @returns {string} - 返回原文本（实际翻译由 translatePageContent 完成）
 */
export function translateText(text, currentLang) {
    // translate.js 无法直接翻译文本，需要在页面渲染后调用 execute()
    // 这里只返回原文本，实际翻译会在页面渲染后通过 translatePageContent 完成
    return text;
}

/**
 * 翻译对象中的文本字段
 * @param {Object} obj - 要翻译的对象
 * @param {Array<string>} fields - 需要翻译的字段名数组（如 ['Name', 'Title', 'Label']）
 * @param {string} currentLang - 当前语言代码
 * @returns {Object} - 翻译后的对象
 */
export function translateObject(obj, fields = ['Name', 'Title', 'Label', 'Text', 'Description'], currentLang = null) {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }
    
    if (!currentLang) {
        currentLang = localStorage.getItem("Microi.Lang") || "chinese_simplified";
    }
    
    // 如果是中文，不需要翻译
    if (currentLang === 'chinese_simplified' || currentLang === 'chinese_traditional') {
        return obj;
    }
    
    const translated = { ...obj };
    
    // 翻译指定字段
    fields.forEach(field => {
        if (translated[field] && typeof translated[field] === 'string') {
            // 尝试从翻译映射表或翻译服务获取翻译
            translated[field] = translateText(translated[field], currentLang);
        }
    });
    
    // 递归处理子对象
    Object.keys(translated).forEach(key => {
        if (translated[key] && typeof translated[key] === 'object' && !Array.isArray(translated[key])) {
            translated[key] = translateObject(translated[key], fields, currentLang);
        }
    });
    
    return translated;
}

/**
 * 翻译数组中的对象
 * @param {Array} arr - 要翻译的数组
 * @param {Array<string>} fields - 需要翻译的字段名数组
 * @param {string} currentLang - 当前语言代码
 * @returns {Array} - 翻译后的数组
 */
export function translateArray(arr, fields = ['Name', 'Title', 'Label', 'Text', 'Description'], currentLang = null) {
    if (!Array.isArray(arr)) {
        return arr;
    }
    
    if (!currentLang) {
        currentLang = localStorage.getItem("Microi.Lang") || "chinese_simplified";
    }
    
    // 如果是中文，不需要翻译
    if (currentLang === 'chinese_simplified' || currentLang === 'chinese_traditional') {
        return arr;
    }
    
    return arr.map(item => {
        if (typeof item === 'object' && item !== null) {
            return translateObject(item, fields, currentLang);
        }
        return item;
    });
}

/**
 * 使用 window.translate 进行翻译（如果可用）
 * @param {string} text - 要翻译的文本
 * @param {string} currentLang - 当前语言代码
 * @returns {string} - 翻译后的文本（同步）
 */
export function translateWithService(text, currentLang) {
    if (!text || typeof text !== 'string') {
        return text;
    }
    
    // 如果是中文，不需要翻译
    if (currentLang === 'chinese_simplified' || currentLang === 'chinese_traditional' || !currentLang) {
        return text;
    }
    
    // 如果 window.translate 存在，使用它进行翻译
    if (typeof window.translate !== 'undefined' && window.translate && window.translate.translate) {
        try {
            const translated = window.translate.translate(text, currentLang);
            return translated || text;
        } catch (e) {
            console.warn('翻译失败:', e);
            return text;
        }
    }
    
    return text;
}

/**
 * 批量翻译文本数组
 * @param {Array<string>} texts - 要翻译的文本数组
 * @param {string} currentLang - 当前语言代码
 * @returns {Array<string>} - 翻译后的文本数组
 */
export function translateTexts(texts, currentLang) {
    if (!Array.isArray(texts)) {
        return texts;
    }
    
    if (!currentLang) {
        currentLang = localStorage.getItem("Microi.Lang") || "chinese_simplified";
    }
    
    // 如果是中文，不需要翻译
    if (currentLang === 'chinese_simplified' || currentLang === 'chinese_traditional') {
        return texts;
    }
    
    // 同步翻译所有文本
    return texts.map(text => translateWithService(text, currentLang));
}
