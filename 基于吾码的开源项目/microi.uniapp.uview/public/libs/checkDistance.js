function getCoordinateScopeStatusData(
  referenceCoordinate,
  currentCoordinate,
  scopeNum,
  callback
) {
  var scopeNumber = scopeNum || 500;

  var checkInfo = {
    status: false,
  };

  var distanceValue = getDistanceByCoordinate(
    currentCoordinate,
    referenceCoordinate
  );

  checkInfo.status = true;
  checkInfo.scope_status = distanceValue < scopeNumber;
  checkInfo.cur_coordinte = currentCoordinate;

  callback && callback(checkInfo);

  return distanceValue
}

function getDistanceByCoordinate(location_1, location_2) {
  // longitude(经度) and latitude(纬度)
  var lon_1 = location_1.longitude;
  var lat_1 = location_1.latitude;
  var lat_2 = location_2.latitude;
  var lon_2 = location_2.longitude;
  var radEarth = 6378137;

  var radLat1 = (lat_1 * Math.PI) / 180.0;
  var radLat2 = (lat_2 * Math.PI) / 180.0;
  var radLon1 = (lon_1 * Math.PI) / 180.0;
  var radLon2 = (lon_2 * Math.PI) / 180.0;

  var difRadLat = radLat1 - radLat2;
  var difRedLon = radLon1 - radLon2;

  var distance =
    2 *
    Math.asin(
      Math.sqrt(
        Math.pow(Math.sin(difRadLat / 2), 2) +
        Math.cos(radLat1) *
        Math.cos(radLat2) *
        Math.pow(Math.sin(difRedLon / 2), 2)
      )
    );
  distance = distance * radEarth;
  distance = Math.round(distance * 10000) / 10000;
  return distance; // 返回（m)
}

module.exports = getCoordinateScopeStatusData
