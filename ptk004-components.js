(() => {
  'use strict';
  const THREE = window.THREE;
  const root = 'assets/PTK-004-assets/';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Trim transparent margins and limit GPU texture dimensions; preserve source files.
  function textureFrom(image, maxEdge) {
    const source = document.createElement('canvas');
    source.width = image.naturalWidth; source.height = image.naturalHeight;
    const ctx = source.getContext('2d'); ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, source.width, source.height).data;
    let x0 = source.width, y0 = source.height, x1 = -1, y1 = -1;
    for (let y = 0; y < source.height; y++) {
      for (let x = 0; x < source.width; x++) {
        if (data[(y * source.width + x) * 4 + 3] > 8) {
          x0 = Math.min(x0, x); y0 = Math.min(y0, y);
          x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
      }
    }
    if (x1 < x0) throw new Error('Empty image: ' + image.src);
    const width = x1 - x0 + 1, height = y1 - y0 + 1;
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext('2d').drawImage(source, x0, y0, width, height, 0, 0, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return { texture, aspect: width / height };
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Unable to load PTK-004 image: ' + file));
      image.src = root + file;
    });
  }

  AFRAME.registerComponent('ptk004-components-story', {
    init() {
      this.disposed = false; this.active = false; this.clock = 0; this.phase = null; this.phaseAt = 0;
      this.resources = []; this.layers = [];
      this.audio = document.getElementById('story-audio');
      this.group = new THREE.Group(); this.group.visible = false;
      this.el.setObject3D('ptk004-story', this.group); this.el.dataset.spriteReady = 'loading';
      this.fit = () => {
        const scale = window.innerWidth > window.innerHeight ? 0.62 : 0.90;
        this.group.scale.setScalar(scale);
      };
      this.fit(); window.addEventListener('resize', this.fit);
      this.show = () => {
        if (this.active) return;
        this.active = true; this.clock = 0; this.phase = null; this.group.visible = true; this.updatePose();
      };
      this.hide = () => { this.active = false; this.group.visible = false; };
      this.el.addEventListener('idle-start', this.show); this.el.addEventListener('character-hide', this.hide);
      this.load();
    },
    makeSprite(image, maxEdge) {
      const { texture, aspect } = textureFrom(image, maxEdge);
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0, alphaTest: 0.006, depthTest: false, depthWrite: false, toneMapped: false });
      const sprite = new THREE.Sprite(material); sprite.frustumCulled = false; sprite.renderOrder = 100;
      this.group.add(sprite); this.resources.push({ texture, material });
      return { sprite, aspect };
    },
    makeLine() {
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
      const material = new THREE.LineBasicMaterial({ color: 0xb18059, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false });
      const line = new THREE.Line(geometry, material); line.renderOrder = 90; line.frustumCulled = false;
      this.group.add(line); this.resources.push({ geometry, material });
      return line;
    },
    async load() {
      try {
        const response = await fetch(root + 'PTK-004-lesson.json');
        if (!response.ok) throw new Error('PTK-004 lesson metadata unavailable');
        this.config = await response.json();
        const image = await loadImage(this.config.master);
        if (this.disposed) return;
        this.master = this.makeSprite(image, 1024);
        this.el.dataset.spriteReady = 'true'; this.updatePose();
        await Promise.all(this.config.layers.map(async (spec) => {
          const image = await loadImage(spec.file);
          if (this.disposed) return;
          const layer = { ...spec, ...this.makeSprite(image, 768), line: this.makeLine() };
          this.layers.push(layer); this.updatePose();
        }));
        if (!this.disposed) this.el.dataset.labelsReady = 'true';
      } catch (error) {
        if (!this.disposed) { this.el.dataset.labelsReady = 'error'; if (!this.master) this.el.dataset.spriteReady = 'error'; console.error(error); }
      }
    },
    phaseForAudio() {
      if (!this.config || !this.audio?.getAttribute('src')?.includes('PTK-004-assets/')) return 'mask';
      if (this.audio.ended) return 'overview';
      const time = Number(this.audio.currentTime) || 0;
      let phase = 'mask';
      for (const cue of this.config.cues) if (time >= cue.start) phase = cue.phase;
      return phase;
    },
    updatePose() {
      if (!this.master) return;
      const next = this.phaseForAudio();
      if (next !== this.phase) { this.phase = next; this.phaseAt = this.clock; }
      const overview = this.phase === 'overview';
      const focused = this.phase !== 'mask' && !overview;
      const reveal = reduced.matches ? 1 : 1 - Math.pow(1 - Math.min(1, this.clock / 0.65), 3);
      const popup = reduced.matches ? 1 : Math.min(1, (this.clock - this.phaseAt) / 0.45);
      const masterX = focused ? -0.32 : 0;
      const masterH = overview ? 0.90 : 1.05;
      this.master.sprite.scale.set(masterH * this.master.aspect, masterH, 1);
      this.master.sprite.position.set(masterX, -(1 - reveal) * 0.04, 0.025);
      this.master.sprite.material.opacity = reveal;
      const visibleLabels = [];
      for (const layer of this.layers) {
        const visible = overview || layer.id === this.phase;
        layer.sprite.visible = visible; layer.line.visible = visible;
        if (!visible) continue;
        visibleLabels.push(layer.id);
        const width = overview ? 0.38 : 0.67;
        const factor = 0.86 + 0.14 * (1 - Math.pow(1 - popup, 3));
        const x = overview ? layer.overview[0] : 0.39;
        const y = overview ? layer.overview[1] : 0;
        layer.sprite.scale.set(width * factor, width / layer.aspect * factor, 1);
        layer.sprite.position.set(x, y - (1 - popup) * 0.025, 0.04);
        layer.sprite.material.opacity = reveal * popup;
        const focusScale = masterH / 1.05;
        const startX = masterX + layer.focus[0] * focusScale, startY = layer.focus[1] * focusScale;
        const edgeX = x + (x > masterX ? -1 : 1) * width * 0.42;
        const positions = layer.line.geometry.attributes.position;
        positions.setXYZ(0, startX, startY, 0.03);
        positions.setXYZ(1, (startX + edgeX) / 2, y, 0.03);
        positions.setXYZ(2, edgeX, y, 0.03); positions.needsUpdate = true;
        layer.line.material.opacity = reveal * popup;
      }
      this.el.dataset.phase = this.phase;
      this.el.dataset.visibleLabels = visibleLabels.sort().join(',');
    },
    tick(time, delta) {
      if (!this.active) return;
      this.clock += Math.min(delta / 1000, 0.15); this.updatePose();
    },
    remove() {
      this.disposed = true; window.removeEventListener('resize', this.fit);
      this.el.removeEventListener('idle-start', this.show); this.el.removeEventListener('character-hide', this.hide);
      this.resources.forEach(({ texture, geometry, material }) => { texture?.dispose(); geometry?.dispose(); material.dispose(); });
      this.el.removeObject3D('ptk004-story');
    },
  });
})();
