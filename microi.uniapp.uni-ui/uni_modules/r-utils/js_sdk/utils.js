// 查询节点信息
export const GetRect = (selector, _this, all) => {
  return new Promise((resolve, reject) => {
    uni
      .createSelectorQuery()
      .in(_this)
      [all ? "selectAll" : "select"](selector)
      .boundingClientRect((rect) => {
        if (all && Array.isArray(rect) && rect.length) {
          resolve(rect);
        }
        if (!all && rect) {
          resolve(rect);
        }
        reject(rect);
      })
      .exec();
  });
};

//分割数字值和单位
export const SplitUnitNum = (str) => {
  const num = (str + "").match(/\d+/g).join("");
  const unit =
    (str + "").split(num)[(str + "").split(num).length - 1] != num
      ? (str + "").split(num)[(str + "").split(num).length - 1]
      : "";
  return {
    num,
    unit,
  };
};

// 获取系统信息的同步接口。
export const getSystemInfo = () => {
  try {
    return uni.getSystemInfoSync();
  } catch (error) {
    return {};
  }
};
