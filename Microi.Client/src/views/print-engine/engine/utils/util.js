//自动生成编号
export const generateId = function () {
  return Math.floor(Math.random() * 100000 + Math.random() * 20000 + Math.random() * 5000);
};

//深拷贝
export const deepClone = function (origin) {
  if (origin === undefined) {
    return undefined
  }
  return JSON.parse(JSON.stringify(origin))
}

//构建默认页面数据
export function buildDefaultRemoteData() {
  let defaultPageJson = {
    Id: '', //打印模板ID
    Title: '', //模板标题
    Number: '', //模板编号
    Desc: '', //模板描述
    DataApi: '', //数据接口
    PageObj: {
      //页面Json
      panels: [
        {
          index: 0,
          name: '默认面板名称',
          paperType: 'A4',
          height: 297,
          width: 210,
          paperHeader: 0,
          paperFooter: 841.8897637795277,
          printElements: [],
          paperNumberContinue: true,
          watermarkOptions: {},
          panelLayoutOptions: {},
        },
      ],
    },
    //数据json
    PrintObj: {},
  }

  let newId = generateId()
  defaultPageJson.Id = newId //创建一个页面主键
  defaultPageJson.Number = newId
  return defaultPageJson
}

// 判断对象或者数组
export const isObjectOrArray = function (value) {
  if (Array.isArray(value)) {
    return 'array';
  } else if (typeof value === 'object' && value !== null) {
    return 'object';
  } else {
    return 'other';
  }
}