export function noop() {}
export const isObject = (val) => val !== null && typeof val === "object";

export const extend = Object.assign;

export const isFunction = (val) => typeof val === "function";

export const isPromise = (val) =>
  isObject(val) && isFunction(val.then) && isFunction(val.catch);

export const isDef = (val) => val !== undefined && val !== null;

export const isNumeric = (val) =>
  typeof val === "number" || /^\d+(\.\d+)?$/.test(val);
