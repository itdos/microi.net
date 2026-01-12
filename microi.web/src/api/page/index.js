import request from "@/axios/interceptor";

//根据主键获取页面JSON
export function GetPageData(query) {
    return request({
        url: "1848560810520088576/querybyprimarykey/web_page/1848562514464477184",
        method: "get",
        params: query
    });
}

//插入或更新
export function AddorUpdate(data) {
    return request({
        url: "/1848560810520088576/insertorupdateobject/web_page/1848627416541564928",
        method: "post",
        data: data
    });
}

//插入或更新
export function Delete(data) {
    return request({
        url: "1848560810520088576/deleteobject/web_page/1848564118617985024",
        method: "post",
        data: data
    });
}
