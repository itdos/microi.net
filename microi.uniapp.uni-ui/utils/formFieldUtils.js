/**
 * 通用的字段设置工具函数
 * @param {string} fieldName - 字段名称
 * @param {string} value - 值的键名，支持点号格式（如：Config.Button.Loading）
 * @param {any} field - 要设置的值
 * @param {Object} V8 - V8对象
 * @param {Array} formFields - 表单字段数组
 * @param {Object} formRules - 表单验证规则对象
 * @returns {Array} - 更新后的表单字段数组
 */
export const setFormField = (fieldName, value, field, V8, formFields, formRules) => {
  // 处理必填验证规则
  if (value === 'NotEmpty') {
    // 获取当前字段信息
    const currentField = formFields.find(item => item.Name === fieldName)
    if (field === 1 || field === true) {
      // 设置为必填时，添加验证规则
      formRules[fieldName] = {
        rules: [{
          required: true,
          // 根据字段类型设置不同的错误提示
          errorMessage: currentField?.Component?.includes('Select') ? 
            `请选择${currentField?.Label || fieldName}` : 
            `请输入${currentField?.Label || fieldName}`,
        }]
      }
      // 同步更新字段的 NotEmpty 属性
      if (currentField) {
        currentField.NotEmpty = 1
      }
    } else {
      // 设置为非必填时，移除验证规则
      delete formRules[fieldName]
      // 同步更新字段的 NotEmpty 属性
      if (currentField) {
        currentField.NotEmpty = 0
      }
    }
  }

  // 处理点号格式的情况（如：Config.Button.Loading）
  if (value.includes('.')) {
    // 将点号分隔的字符串拆分成数组
    const keys = value.split('.');
    // 取出最后一个键名
    const lastKey = keys.pop();
    // 初始化对象结构
    let obj = {};
    let current = obj;
    
    // 构建嵌套对象结构
    keys.forEach((key) => {
      current[key] = {};
      current = current[key];
    });
    // 设置最终值
    current[lastKey] = field;
    
    // 更新 V8.Field，保留原有数据
    if (V8.Field.hasOwnProperty(fieldName)) {
      // 如果字段已存在，递归合并对象
      const mergeObjects = (target, source) => {
        for (let key in source) {
          if (source[key] instanceof Object && !Array.isArray(source[key])) {
            target[key] = target[key] || {};
            mergeObjects(target[key], source[key]);
          } else {
            target[key] = source[key];
          }
        }
      };
      
      const updatedField = { ...V8.Field[fieldName] };
      mergeObjects(updatedField, obj);
      V8.Field[fieldName] = updatedField;
    } else {
      // 如果字段不存在，创建新字段
      V8.Field[fieldName] = {
        Name: fieldName,
        ...obj
      }
    }
  } else {
    // 处理普通格式的情况
    if (V8.Field.hasOwnProperty(fieldName)) {
      V8.Field[fieldName][value] = field;
    } else {
      V8.Field[fieldName] = {
        Name: fieldName,
        [value]: field
      }
    }
  }
  
  // 特殊处理 Data 类型的值
  if (value === 'Data') {
    const currentFieldsConfig = V8.Field[fieldName].Config;
    if (Array.isArray(field) && field.length > 0) {
      field = typeof field[0] === 'object' ? 
        field.map((i) => ({
          selected: false,
          text: i.text || i[currentFieldsConfig?.SelectLabel],
          value: i.value || i[currentFieldsConfig?.SelectSaveField],
          ...i
        })) :
        field.map(item => ({
          selected: false,
          text: item,
          value: item
        }));
    }
  }
  
  // 更新 formFields
  const existingFieldIndex = formFields.findIndex(i => i.Name === fieldName);
  if (existingFieldIndex !== -1) {
    // 字段已存在的情况
    const existingField = { ...formFields[existingFieldIndex] };
    if (value.includes('.')) {
      // 处理点号格式
      const keys = value.split('.');
      let current = existingField;
      
      // 递归创建或更新嵌套对象
      keys.forEach((key, index) => {
        if (index === keys.length - 1) {
          current[key] = field;
        } else {
          current[key] = current[key] || {};
          current = current[key];
        }
      });
    } else {
      // 普通格式直接设置值
      existingField[value] = field;
    }
    // 更新数组中的对象
    const newFormFields = [...formFields];
    newFormFields.splice(existingFieldIndex, 1, existingField);
    return newFormFields;
  } else {
    // 字段不存在的情况
    const newField = { Name: fieldName, Component: 'Text' };
    if (value.includes('.')) {
      // 处理点号格式
      const keys = value.split('.');
      let current = newField;
      
      // 构建嵌套对象
      keys.forEach((key, index) => {
        if (index === keys.length - 1) {
          current[key] = field;
        } else {
          current[key] = {};
          current = current[key];
        }
      });
    } else {
      // 普通格式
      newField[value] = field;
    }
    // 添加新字段
    return [...formFields, newField];
  }
}
