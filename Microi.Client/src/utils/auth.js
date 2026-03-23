import Cookies from "js-cookie";
import LocalStorageManager from "./localStorage-manager.js";

const TokenKey = "authorization";

export function getToken() {
    return Cookies.get(TokenKey);
}

export function setToken(token) {
    return Cookies.set(TokenKey, token);
}

export function removeToken() {
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
