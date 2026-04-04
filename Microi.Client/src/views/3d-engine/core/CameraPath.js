/**
 * 相机路径动画系统 V2
 * 支持每个点位独立的移动速度和停留时间
 */
import * as THREE from 'three';

export class CameraPath {
  constructor(engine) {
    this.engine = engine;
    // waypoint: { position: Vector3, target: Vector3, name, speed: ms, stayDuration: ms }
    this.waypoints = [];
    this.isPlaying = false;
    this.isPaused = false;
    this.currentIndex = 0;
    this.loop = true;
    this._animId = null;
    this._resolve = null;
    this._pauseResolve = null;
    this._callbacks = {};
  }

  // 事件
  on(event, cb) { (this._callbacks[event] || (this._callbacks[event] = [])).push(cb); }
  off(event, cb) { if (this._callbacks[event]) this._callbacks[event] = this._callbacks[event].filter(c => c !== cb); }
  _emit(event, data) { (this._callbacks[event] || []).forEach(cb => cb(data)); }

  /** 添加一个相机点位（可传自定义 position/target 或取当前相机位） */
  addWaypoint(position, target, name, opts = {}) {
    const wp = {
      position: position ? position.clone() : this.engine.camera.position.clone(),
      target: target ? target.clone() : this.engine.orbitControls.target.clone(),
      name: name || `点位 ${this.waypoints.length + 1}`,
      speed: opts.speed || 2000,
      stayDuration: opts.stayDuration || 1500,
    };
    this.waypoints.push(wp);
    this._emit('waypointsChanged', this.waypoints);
    return wp;
  }

  /** 更新点位配置 */
  updateWaypoint(index, updates) {
    const wp = this.waypoints[index];
    if (!wp) return;
    if (updates.speed !== undefined) wp.speed = updates.speed;
    if (updates.stayDuration !== undefined) wp.stayDuration = updates.stayDuration;
    if (updates.name !== undefined) wp.name = updates.name;
    this._emit('waypointsChanged', this.waypoints);
  }

  /** 移除指定索引的点位 */
  removeWaypoint(index) {
    if (index >= 0 && index < this.waypoints.length) {
      this.waypoints.splice(index, 1);
      this._emit('waypointsChanged', this.waypoints);
    }
  }

  /** 跳转到指定点位 */
  goToWaypoint(index) {
    const wp = this.waypoints[index];
    if (!wp) return;
    this.currentIndex = index;
    this.engine._animateCamera(wp.position.clone(), wp.target.clone());
  }

  /** 根据模型包围盒自动生成点位 */
  autoGenerate(count = 6) {
    this.waypoints = [];
    const box = new THREE.Box3();
    this.engine.objects.forEach(obj => box.expandByObject(obj));
    if (box.isEmpty()) {
      // 没有模型时围绕原点生成
      const radius = 8;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const pos = new THREE.Vector3(Math.cos(angle) * radius, 4, Math.sin(angle) * radius);
        this.waypoints.push({ position: pos, target: new THREE.Vector3(0, 0, 0), name: `点位 ${i + 1}`, speed: 2000, stayDuration: 1500 });
      }
      this._emit('waypointsChanged', this.waypoints);
      return;
    }

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const radius = maxDim * 1.8;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const elevation = 0.2 + Math.sin(i * 0.8) * 0.3;
      const pos = new THREE.Vector3(
        center.x + Math.cos(angle) * radius,
        center.y + maxDim * (0.3 + elevation),
        center.z + Math.sin(angle) * radius,
      );
      const lookTarget = new THREE.Vector3(
        center.x + Math.cos(angle + 0.3) * maxDim * 0.1,
        center.y + maxDim * 0.15,
        center.z + Math.sin(angle + 0.3) * maxDim * 0.1,
      );
      this.waypoints.push({
        position: pos,
        target: lookTarget,
        name: `点位 ${i + 1}`,
        speed: 2000,
        stayDuration: 1500,
      });
    }
    this._emit('waypointsChanged', this.waypoints);
  }

  /** 开始播放 */
  async play() {
    if (this.waypoints.length < 2) return;
    if (this.isPaused && this.isPlaying) {
      this.resume();
      return;
    }
    this.isPlaying = true;
    this.isPaused = false;
    this._emit('start', null);
    this._emit('stateChanged', { playing: true, paused: false });

    while (this.isPlaying) {
      // 暂停等待
      if (this.isPaused) {
        await new Promise(r => { this._pauseResolve = r; });
        if (!this.isPlaying) break;
      }

      const wp = this.waypoints[this.currentIndex];
      await this._animateTo(wp.position, wp.target, wp.speed);
      if (!this.isPlaying) break;

      this._emit('waypointReached', this.currentIndex);

      // 停留（每个点位独立停留时间）
      if (this.isPaused) {
        await new Promise(r => { this._pauseResolve = r; });
        if (!this.isPlaying) break;
      }
      await this._wait(wp.stayDuration);
      if (!this.isPlaying) break;

      this.currentIndex = (this.currentIndex + 1) % this.waypoints.length;
      if (!this.loop && this.currentIndex === 0) {
        this.stop();
        break;
      }
    }
  }

  /** 暂停 */
  pause() {
    if (!this.isPlaying) return;
    this.isPaused = true;
    this._emit('stateChanged', { playing: true, paused: true });
  }

  /** 继续播放 */
  resume() {
    if (!this.isPlaying) { this.play(); return; }
    this.isPaused = false;
    this._emit('stateChanged', { playing: true, paused: false });
    if (this._pauseResolve) { this._pauseResolve(); this._pauseResolve = null; }
  }

  /** 停止 */
  stop() {
    this.isPlaying = false;
    this.isPaused = false;
    this.currentIndex = 0;
    if (this._pauseResolve) { this._pauseResolve(); this._pauseResolve = null; }
    if (this._resolve) { this._resolve(); this._resolve = null; }
    this._emit('stop', null);
    this._emit('stateChanged', { playing: false, paused: false });
  }

  _animateTo(position, target, duration) {
    return new Promise(resolve => {
      if (this.engine.isDisposed || !this.isPlaying) { resolve(); return; }
      const startPos = this.engine.camera.position.clone();
      const startTarget = this.engine.orbitControls.target.clone();
      const startTime = performance.now();

      const step = () => {
        if (this.engine.isDisposed || !this.isPlaying) { resolve(); return; }
        if (this.isPaused) {
          // 暂停时停止动画帧，等resume时继续
          this._pauseResolve = () => {
            if (!this.isPlaying) { resolve(); return; }
            this._animId = requestAnimationFrame(step);
            this._pauseResolve = null;
          };
          return;
        }
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        const ease = t * t * (3 - 2 * t);
        this.engine.camera.position.lerpVectors(startPos, position, ease);
        this.engine.orbitControls.target.lerpVectors(startTarget, target, ease);
        this.engine.orbitControls.update();
        if (t < 1) {
          this._animId = requestAnimationFrame(step);
        } else {
          resolve();
        }
      };
      this._animId = requestAnimationFrame(step);
    });
  }

  _wait(ms) {
    return new Promise(resolve => {
      this._resolve = resolve;
      if (!this.isPlaying) { resolve(); return; }
      setTimeout(() => {
        this._resolve = null;
        if (!this.isPlaying) { resolve(); return; }
        if (this.isPaused) {
          this._pauseResolve = () => { resolve(); this._pauseResolve = null; };
          return;
        }
        resolve();
      }, ms);
    });
  }

  dispose() {
    this.stop();
    if (this._animId) cancelAnimationFrame(this._animId);
    this.waypoints = [];
    this._callbacks = {};
    this.engine = null;
  }
}
