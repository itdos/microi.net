/**
 * 获取地址栏参数
 */
export const getQueryParams = () => {
    const params = {};
    // Check if window is defined (for non-browser environments)
    if (typeof window === "undefined" || !window.location) {
        console.log("window or window.location is not defined");
        return params;
    }

    // 获取#号之前的查询字符串部分
    const queryStringBeforeHash = window.location.search.substring(1);
    const varsBeforeHash = queryStringBeforeHash.split("&");
    varsBeforeHash.forEach((pair) => {
        const [key, value] = pair.split("=");
        if (key) {
            params[key] = decodeURIComponent(value);
        }
    });

    // 获取#号之后的哈希部分
    const hash = window.location.hash.substring(1); // 移除开头的井号
    const questionMarkIndex = hash.indexOf("?");
    if (questionMarkIndex !== -1) {
        // 获取?号之后的查询字符串部分
        const queryStringAfterHash = hash.substring(questionMarkIndex + 1);
        const varsAfterHash = queryStringAfterHash.split("&");
        varsAfterHash.forEach((pair) => {
            const [key, value] = pair.split("=");
            if (key) {
                params[key] = decodeURIComponent(value);
            }
        });
    }
    return params;
};
