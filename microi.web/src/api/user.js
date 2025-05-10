//此处为mock测试
import request from "@/utils/request";

export function login(data) {
  return request({
    url: "/microi.net.vue/user/login",
    method: "post",
    data
  });
}

export function getInfo(token) {
  return request({
    url: "/microi.net.vue/user/info",
    method: "get",
    params: { token }
  });
}

export function logout() {
  return request({
    url: "/api/SysUser/Logout",
    method: "post"
  });
}
