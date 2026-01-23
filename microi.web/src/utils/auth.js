import Cookies from "js-cookie";

const TokenKey = "authorization";
const TokenExpiresKey = "Microi.Token.Expires";

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
    return localStorage.getItem(TokenExpiresKey);
}

export function setTokenExpires(expires) {
    return localStorage.setItem(TokenExpiresKey, expires);
}

export function removeTokenExpires() {
    return localStorage.removeItem(TokenExpiresKey);
}
