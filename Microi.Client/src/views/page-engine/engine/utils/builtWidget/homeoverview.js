export const homeoverview = {
  "type": "homeoverview",
  "label": "智能首页概览",
  "category": 0,
  "show": 1,
  "icon": "TrendCharts",
  "img": "",
  "widgetOption": {
    "height": 440
  },
  "widgetParams": [
    {
      "sort": 0,
      "label": "接口引擎 Key",
      "type": "input",
      "value": "platform-home-overview",
      "typeOptions": {
        "rows": 1,
        "dataJson": {}
      }
    },
    {
      "sort": 1,
      "label": "布局密度",
      "type": "select",
      "value": "standard",
      "typeOptions": {
        "options": [
          {
            "label": "标准",
            "value": "standard"
          },
          {
            "label": "紧凑工作台",
            "value": "compact"
          }
        ]
      }
    }
  ]
}
