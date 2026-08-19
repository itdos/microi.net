export function cloneWhereItem(item) {
    if (!item) return item;
    if (Array.isArray(item)) {
        var clonedArray = item.slice();
        Object.keys(item).forEach(function(key) {
            if (!/^\d+$/.test(key)) {
                clonedArray[key] = item[key];
            }
        });
        return clonedArray;
    }
    if (typeof item === "object") {
        return Object.assign({}, item);
    }
    return item;
}

export function cloneWhereList(whereList) {
    if (!Array.isArray(whereList) || whereList.length === 0) {
        return [];
    }
    return whereList.map(function(item) {
        return cloneWhereItem(item);
    }).filter(function(item) {
        return !!item;
    });
}

export function mergeWhereList(baseWhere, appendWhere) {
    var result = cloneWhereList(baseWhere);
    if (!Array.isArray(appendWhere) || appendWhere.length === 0) {
        return result;
    }
    appendWhere.forEach(function(item) {
        if (!item) return;
        if (Array.isArray(item)) {
            result.push(cloneWhereItem(item));
            return;
        }
        var index = result.findIndex(function(current) {
            return current && !Array.isArray(current) && current.Name == item.Name;
        });
        if (index === -1) {
            result.push(cloneWhereItem(item));
        } else {
            result[index] = Object.assign({}, result[index], item);
        }
    });
    return result;
}

export function appendWhereList(baseWhere, appendWhere) {
    return cloneWhereList(baseWhere).concat(cloneWhereList(appendWhere));
}

export function hasSearchFilterValue(value) {
    if (value === undefined || value === null) {
        return false;
    }
    if (typeof value === "string") {
        return value.trim() !== "";
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    return true;
}

export function buildSearchWhere(searchEqual, searchCheckbox) {
    var result = [];
    Object.keys(searchEqual || {}).forEach(function(fieldName) {
        var value = searchEqual[fieldName];
        if (!hasSearchFilterValue(value)) return;
        result.push({ Name: fieldName, Value: value, Type: "=" });
    });
    Object.keys(searchCheckbox || {}).forEach(function(fieldName) {
        var value = searchCheckbox[fieldName];
        if (!Array.isArray(value) || value.length === 0) return;
        result.push({ Name: fieldName, Value: value.slice(), Type: "In" });
    });
    return result;
}

export function whereListHasField(whereList, fieldName) {
    if (!fieldName || !Array.isArray(whereList)) return false;
    return whereList.some(function(item) {
        if (Array.isArray(item)) {
            var normalized = arrayWhereToLegacy(item);
            return normalized && normalized.Name === fieldName;
        }
        return item && item.Name === fieldName;
    });
}

export function arrayWhereToLegacy(item) {
    if (!Array.isArray(item) || item.length < 3) {
        return cloneWhereItem(item);
    }
    var cursor = 0;
    var result = {};
    var first = item[cursor];
    if (typeof first === "string" && ["AND", "OR"].includes(first.toUpperCase())) {
        result.AndOr = first;
        cursor += 1;
    }
    if (item[cursor] === "(") {
        result.GroupStart = true;
        cursor += 1;
    }
    result.Name = item[cursor];
    result.Type = item[cursor + 1];
    result.Value = item[cursor + 2];
    if (item[item.length - 1] === ")") {
        result.GroupEnd = true;
    }
    Object.keys(item).forEach(function(key) {
        if (!/^\d+$/.test(key)) {
            result[key] = item[key];
        }
    });
    return result;
}

export function normalizeMixedWhereList(whereList) {
    var result = cloneWhereList(whereList);
    var hasArrayWhere = result.some(function(item) {
        return Array.isArray(item);
    });
    var hasLegacyWhere = result.some(function(item) {
        return item && typeof item === "object" && !Array.isArray(item);
    });
    if (!hasArrayWhere || !hasLegacyWhere) {
        return result;
    }
    return result.map(function(item) {
        return Array.isArray(item) ? arrayWhereToLegacy(item) : item;
    });
}

export function composeTableWhere(requestWhere, runtimeWhere, fixedWhere) {
    // 页面搜索/高级筛选允许沿用原有同字段覆盖逻辑；
    // OpenTableSetWhere 属于弹窗固定范围，最后追加，避免被页面筛选覆盖。
    // 服务端不能可靠解析新旧 _Where 混合数组，因此混合时统一为兼容旧格式。
    return normalizeMixedWhereList(
        appendWhereList(mergeWhereList(requestWhere, runtimeWhere), fixedWhere)
    );
}
