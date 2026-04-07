/**
 * glTF / GLB 模型加载器
 * 支持 Draco 压缩和进度回调
 */
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';

export class ModelLoader {
  constructor() {
    this.gltfLoader = new GLTFLoader();
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    this.dracoLoader.setDecoderConfig({ type: 'js' });
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
  }

  /** 从 URL 加载模型 */
  loadFromUrl(url) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          const model = gltf.scene;
          model.userData.url = url;
          model.userData.animations = gltf.animations || [];
          resolve(model);
        },
        undefined,
        (error) => reject(new Error(`模型加载失败: ${error.message || error}`))
      );
    });
  }

  /** 从 File 对象加载模型 */
  loadFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const arrayBuffer = event.target.result;
        const blob = new Blob([arrayBuffer]);
        const url = URL.createObjectURL(blob);

        this.gltfLoader.load(
          url,
          (gltf) => {
            URL.revokeObjectURL(url);
            const model = gltf.scene;
            model.userData.fileName = file.name;
            model.userData.animations = gltf.animations || [];
            resolve(model);
          },
          undefined,
          (error) => {
            URL.revokeObjectURL(url);
            reject(new Error(`模型加载失败: ${error.message || error}`));
          }
        );
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsArrayBuffer(file);
    });
  }

  dispose() {
    this.dracoLoader.dispose();
  }
}
