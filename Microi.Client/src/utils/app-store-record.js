function isEmpty(value) {
    return value === null || value === undefined || String(value).trim() === "";
}

function normalizeDateValue(value) {
    if (isEmpty(value)) {
        return "";
    }

    var text = String(value).trim();
    var dotNetDate = text.match(/^\/Date\((\d+)/);
    if (dotNetDate) {
        return String(dotNetDate[1]).padStart(17, "0").slice(-17);
    }

    var calendarDate = text.match(
        /^(\d{4})[-\/]?(\d{1,2})[-\/]?(\d{1,2})(?:[T\s](\d{1,2}):?(\d{1,2})?:?(\d{1,2})?(?:\.(\d{1,3}))?)?/
    );
    if (calendarDate) {
        var milliseconds = String(calendarDate[7] || "").padEnd(3, "0").slice(0, 3);
        var calendarTimestamp = Date.UTC(
            Number(calendarDate[1]),
            Number(calendarDate[2]) - 1,
            Number(calendarDate[3]),
            Number(calendarDate[4] || 0),
            Number(calendarDate[5] || 0),
            Number(calendarDate[6] || 0),
            Number(milliseconds || 0)
        );
        return String(calendarTimestamp).padStart(17, "0").slice(-17);
    }

    var parsed = Date.parse(text);
    return Number.isNaN(parsed) ? "" : String(parsed).padStart(17, "0").slice(-17);
}

export function getAppStoreRecordTimestamp(row) {
    row = row || {};
    var candidates = [
        row.UpdateTime,
        row.InstallTime,
        row.LastCheckTime,
        row.CreateTime
    ];
    for (var index = 0; index < candidates.length; index++) {
        var normalized = normalizeDateValue(candidates[index]);
        if (normalized) {
            return normalized;
        }
    }
    return "";
}

export function buildAppStoreMap(rows) {
    var map = {};
    var addKey = function (prefix, value, row) {
        if (isEmpty(value)) {
            return;
        }
        var key = prefix + ":" + String(value).trim().toLowerCase();
        var existing = map[key];
        if (!existing || getAppStoreRecordTimestamp(row) > getAppStoreRecordTimestamp(existing)) {
            map[key] = row;
        }
    };

    (rows || []).forEach(function (row) {
        if (!row || ["1", "true", "yes"].includes(String(row.IsDeleted || "").trim().toLowerCase())) {
            return;
        }
        addKey("storeid", row.StoreId || row.StoreID, row);
        addKey("appid", row.AppId || row.AppID || row.AppKey, row);
        addKey("appname", row.AppName || row.Name || row.Title, row);
    });
    return map;
}
