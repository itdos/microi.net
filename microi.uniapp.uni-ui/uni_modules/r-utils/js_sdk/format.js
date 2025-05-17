/*
 * @Description: 
 * @Author: iRainna
 * @Date: 2023-08-15 15:22:51
 * @LastEditTime: 2023-08-24 09:59:18
 * @FilePath: \i-r-ui\uni_modules\iR-ui\libs\utils\format.js
 */
function trimExtraChar(value, char, regExp) {
  const index = value.indexOf(char);

  if (index === -1) {
    return value;
  }

  if (char === "-" && index !== 0) {
    return value.slice(0, index);
  }

  return value.slice(0, index + 1) + value.slice(index).replace(regExp, "");
}
export function formatNumber(value, allowDot = true, allowMinus = true) {
  if (allowDot) {
    value = trimExtraChar(value, ".", /\./g);
  } else {
    value = value.split(".")[0];
  }

  if (allowMinus) {
    value = trimExtraChar(value, "-", /-/g);
  } else {
    value = value.replace(/-/, "");
  }

  const regExp = allowDot ? /[^-0-9.]/g : /[^-0-9]/g;

  return value.replace(regExp, "");
}

export function addNumber(num1, num2) {
  const cardinal = 10 ** 10;
  return Math.round((num1 + num2) * cardinal) / cardinal;
}

export const clamp = (num, min, max) => Math.min(Math.max(num, min), max);
