(() => {
  'use strict';
  const THREE = window.THREE;
  const root = 'assets/PTK-003-assets/';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Remove only edge-connected white from the supplied paper background.
  // Enclosed white areas of the faces remain white. Source PNGs are never modified.
  function clearPaper(canvas, allWhite, openings = []) {
    const ctx = canvas.getContext('2d');
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = pixels.data, width = canvas.width, height = canvas.height;
    const white = (i) => data[i * 4 + 3] > 0 && data[i * 4] >= 245 && data[i * 4 + 1] >= 245 && data[i * 4 + 2] >= 245;
    if (allWhite) {
      for (let i = 0; i < width * height; i++) if (white(i)) data[i * 4 + 3] = 0;
    } else {
      const queue = new Int32Array(width * height);
      let head = 0, tail = 0;
      const add = (i) => { if (white(i)) { data[i * 4 + 3] = 0; queue[tail++] = i; } };
      for (let x = 0; x < width; x++) { add(x); add((height - 1) * width + x); }
      for (let y = 0; y < height; y++) { add(y * width); add(y * width + width - 1); }
      // Seed the open spaces within the loop-shaped sleeves, if white.
      for (const [x, y] of openings) add(y * width + x);
      while (head < tail) {
        const i = queue[head++], x = i % width;
        if (x > 0) add(i - 1);
        if (x < width - 1) add(i + 1);
        if (i >= width) add(i - width);
        if (i < width * (height - 1)) add(i + width);
      }
    }
    ctx.putImageData(pixels, 0, 0);
    return canvas;
  }

  function textureFrom(image, x, width, allWhite, openings) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = image.naturalHeight;
    canvas.getContext('2d').drawImage(image, x, 0, width, image.naturalHeight, 0, 0, width, image.naturalHeight);
    clearPaper(canvas, allWhite, openings);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return texture;
  }
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('Unable to load ' + src)); image.src = src;
    });
  }

  AFRAME.registerComponent('ptk003-pair', {
    init() {
      this.disposed = false; this.active = false; this.clock = 0;
      this.resources = []; this.actors = [];
      this.group = new THREE.Group(); this.group.visible = false;
      this.el.setObject3D('ptk003-pair', this.group);
      this.fit = () => {
        const scale = window.innerWidth > window.innerHeight ? 0.60 : 0.95;
        this.group.scale.setScalar(scale);
        this.group.position.y = -0.18 * scale;
      };
      this.fit(); window.addEventListener('resize', this.fit);
      this.el.dataset.spriteReady = 'loading';
      this.show = () => {
        if (this.active) return;
        this.active = true; this.clock = 0; this.group.visible = true;
        this.updatePose();
      };
      this.hide = () => { this.active = false; this.clock = 0; this.group.visible = false; };
      this.el.addEventListener('idle-start', this.show);
      this.el.addEventListener('character-hide', this.hide);
      this.load();
    },
    makeSprite(texture) {
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0, alphaTest: 0.008, depthTest: false, depthWrite: false, toneMapped: false });
      const sprite = new THREE.Sprite(material); sprite.frustumCulled = false;
      this.group.add(sprite); this.resources.push({ texture, material });
      return sprite;
    },
    async load() {
      try {
        const image = await loadImage(root + 'PTK-003-character-master.png');
        if (this.disposed) return;
        const width = image.naturalWidth / 2;
        for (let i = 0; i < 2; i++) {
          const openings = i === 0 ? [[259, 610], [736, 586]] : [[232, 568], [703, 607]];
          const sprite = this.makeSprite(textureFrom(image, i * width, width, false, openings));
          sprite.center.set(0.5, 0.07); sprite.scale.set(0.66 * width / image.naturalHeight, 0.66, 1);
          sprite.renderOrder = 100 + i;
          this.actors.push(sprite);
        }
        this.el.dataset.spriteReady = 'true';
        this.updatePose();
        try {
          const title = await loadImage(root + 'PTK-003-title.png');
          if (this.disposed) return;
          this.title = this.makeSprite(textureFrom(title, 0, title.naturalWidth, true));
          this.title.position.set(0, 0.52, 0.02); this.title.renderOrder = 110;
          this.el.dataset.titleReady = 'true';
          this.updatePose();
        } catch (error) { if (!this.disposed) { this.el.dataset.titleReady = 'error'; console.warn(error); } }
      } catch (error) {
        if (!this.disposed) { this.el.dataset.spriteReady = 'error'; console.error(error); }
      }
    },
    updatePose() {
      const progress = reduced.matches ? 1 : Math.min(1, this.clock / 0.6);
      const opacity = 1 - Math.pow(1 - progress, 3);
      const frame = reduced.matches ? 0 : Math.floor(this.clock * 6) % 12;
      this.actors.forEach((sprite, i) => {
        const phase = frame / 12 * Math.PI * 2 + i * Math.PI;
        sprite.position.set((i === 0 ? -0.25 : 0.25) + Math.sin(phase) * 0.004, -0.30 + (1 - Math.cos(phase * 2)) * 0.003 - (1 - opacity) * 0.045, 0.025);
        sprite.material.rotation = reduced.matches ? 0 : Math.sin(phase) * 2.3 * Math.PI / 180;
        sprite.material.opacity = opacity;
      });
      if (this.title) {
        const t = reduced.matches ? 1 : Math.max(0, Math.min(1, (this.clock - 0.18) / 1.1));
        let scale;
        if (t < 0.52) scale = 0.62 + 0.435 * (1 - Math.pow(1 - t / 0.52, 3));
        else if (t < 0.74) scale = 1.055 - 0.075 * (t - 0.52) / 0.22;
        else scale = 0.98 + 0.02 * (t - 0.74) / 0.26;
        this.title.scale.set(1.08 * scale, 1.08 * 414 / 1370 * scale, 1);
        this.title.position.y = 0.52 - (1 - t) * 0.045;
        this.title.material.opacity = t === 0 ? 0 : opacity;
      }
      this.el.dataset.frame = String(frame);
    },
    tick(time, delta) {
      if (!this.active) return;
      this.clock += Math.min(delta / 1000, 0.15); this.updatePose();
    },
    remove() {
      this.disposed = true;
      window.removeEventListener('resize', this.fit);
      this.el.removeEventListener('idle-start', this.show); this.el.removeEventListener('character-hide', this.hide);
      this.resources.forEach(({ texture, material }) => { texture.dispose(); material.dispose(); });
      this.el.removeObject3D('ptk003-pair');
    },
  });
})();
