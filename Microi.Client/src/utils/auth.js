import Cookies from "js-cookie";
import LocalStorageManager from "./localStorage-manager.js";
import { isEmbeddedWebosWindowRuntime } from "./webos-embedded-runtime.js";

const TokenKey = "authorization";

export function getToken() {
    return Cookies.get(TokenKey);
}

export function setToken(token) {
    if (isEmbeddedWebosWindowRuntime()) return token;
    return Cookies.set(TokenKey, token);
}

export function removeToken() {
    if (isEmbeddedWebosWindowRuntime()) return;
    return Cookies.remove(TokenKey);
}

export function getTokenExpires() {
    return LocalStorageManager.get("TokenExpires");
}

export function setTokenExpires(expires) {
    return LocalStorageManager.set("TokenExpires", expires);
}

export function removeTokenExpires() {
    return LocalStorageManager.remove("TokenExpires");
}
