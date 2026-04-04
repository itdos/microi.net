/**
 * 模型分解系统
 * - 记录每个 mesh 的原始位置
 * - 按分解系数将 mesh 向外移动
 * - 支持动画过渡
 */
import * as THREE from 'three';

export class ModelExploder {
  constructor() {
    this._targets = []; // { mesh, originalPos, direction }
    this._factor = 0;
    this._animId = null;
    this._center = new THREE.Vector3();
    this._maxDist = 1;
  }

  /** 分析模型，记录每个 mesh 的原始世界位置与爆炸方向 */
  analyze(model) {
    this.reset();
    if (!model) return;

    const box = new THREE.Box3().setFromObject(model);
    this._center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    this._maxDist = Math.max(size.x, size.y, size.z);

    this._targets = [];
    model.traverse(child => {
      if (!child.isMesh) return;
      // 计算 mesh 中心（世界坐标）
      const meshBox = new THREE.Box3().setFromObject(child);
      const meshCenter = meshBox.getCenter(new THREE.Vector3());
      const direction = new THREE.Vector3().subVectors(meshCenter, this._center);
      // 如果方向为零（mesh 在中心），给一个随机方向
      if (direction.lengthSq() < 0.001) {
        direction.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      }
      this._targets.push({
        mesh: child,
        originalWorldPos: child.position.clone(),
        direction: direction.normalize(),
        distance: direction.length() || this._maxDist * 0.3,
      });
    });
  }

  /** 设置分解系数 0~1（0=组装，1=完全分解） */
  setFactor(factor) {
    this._factor = Math.max(0, Math.min(1, factor));
    const explodeDistance = this._maxDist * 1.5 * this._factor;
    this._targets.forEach(t => {
      const offset = t.direction.clone().multiplyScalar(explodeDistance);
      t.mesh.position.copy(t.originalWorldPos).add(offset);
    });
  }

  get factor() { return this._factor; }

  /** 是否已分析模型 */
  get hasTarget() { return this._targets.length > 0; }

  /** 获取零件数量 */
  get partCount() { return this._targets.length; }

  /** 动画过渡到目标系数 */
  animateTo(targetFactor, duration = 600) {
    if (this._animId) cancelAnimationFrame(this._animId);
    const startFactor = this._factor;
    const startTime = performance.now();
    const step = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = t * t * (3 - 2 * t); // smoothstep
      this.setFactor(startFactor + (targetFactor - startFactor) * ease);
      if (t < 1) this._animId = requestAnimationFrame(step);
      else this._animId = null;
    };
    this._animId = requestAnimationFrame(step);
  }

  /** 重置到组装状态 */
  reset() {
    if (this._animId) cancelAnimationFrame(this._animId);
    this._targets.forEach(t => {
      t.mesh.position.copy(t.originalWorldPos);
    });
    this._targets = [];
    this._factor = 0;
  }

  dispose() {
    this.reset();
  }
}
