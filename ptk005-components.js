(() => {
  'use strict';
  const THREE = window.THREE;
  const timeline = window.PTK005Timeline;
  const root = 'assets/PTK-005-assets/';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  AFRAME.registerComponent('ptk005-making-story', {
    init() {
      this.disposed = false; this.active = false; this.clock = 0; this.transition = 1;
      this.config = null; this.displayed = null; this.previousIndex = null; this.requested = null;
      this.cache = new Map(); this.inflight = new Map();
      this.audio = document.getElementById('story-audio');
      this.group = new THREE.Group(); this.group.visible = false;
      this.el.setObject3D('ptk005-story', this.group);
      this.material = () => new THREE.SpriteMaterial({ transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false });
      this.picture = new THREE.Sprite(this.material()); this.picture.renderOrder = 100; this.picture.frustumCulled = false;
      this.previous = new THREE.Sprite(this.material()); this.previous.renderOrder = 99; this.previous.visible = false; this.previous.frustumCulled = false;
      this.group.add(this.previous, this.picture);
      this.titleCanvas = document.createElement('canvas'); this.titleCanvas.width = 1536; this.titleCanvas.height = 180;
      this.railCanvas = document.createElement('canvas'); this.railCanvas.width = 900; this.railCanvas.height = 80;
      this.titleTexture = this.canvasTexture(this.titleCanvas); this.railTexture = this.canvasTexture(this.railCanvas);
      this.title = new THREE.Sprite(this.material()); this.title.material.map = this.titleTexture; this.title.position.set(0, 0.56, 0.03); this.title.scale.set(1.42, 1.42 * 180 / 1536, 1); this.title.renderOrder = 110;
      this.rail = new THREE.Sprite(this.material()); this.rail.material.map = this.railTexture; this.rail.position.set(0, -0.57, 0.03); this.rail.scale.set(1.12, 1.12 * 80 / 900, 1); this.rail.renderOrder = 110;
      this.group.add(this.title, this.rail);
      this.fit = () => this.group.scale.setScalar(window.innerWidth > window.innerHeight ? 0.52 : 0.70);
      this.fit(); window.addEventListener('resize', this.fit);
      this.show = () => { if (this.active) return; this.active = true; this.clock = 0; this.requested = null; this.group.visible = true; this.updateFrame(); };
      this.hide = () => { this.active = false; this.group.visible = false; };
      this.el.addEventListener('idle-start', this.show); this.el.addEventListener('character-hide', this.hide);
      this.el.dataset.spriteReady = 'loading';
      this.load();
    },
    prepareTexture(texture) {
      texture.colorSpace = THREE.SRGBColorSpace; texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false;
      return texture;
    },
    canvasTexture(canvas) { return this.prepareTexture(new THREE.CanvasTexture(canvas)); },
    async load() {
      try {
        const response = await fetch(root + 'PTK-005-lesson.json');
        if (!response.ok) throw new Error('PTK-005 lesson metadata unavailable');
        this.config = await response.json();
        if (this.disposed) return;
        await this.loadFrame(-1);
        if (this.disposed) return;
        this.el.dataset.spriteReady = 'true';
        if (this.active) this.updateFrame();
        if (document.fonts) document.fonts.load('600 48px Mali').then(() => { if (!this.disposed && this.displayed !== null) this.drawCaption(this.displayed); }).catch(() => {});
      } catch (error) { if (!this.disposed) { this.el.dataset.spriteReady = 'error'; console.error(error); } }
    },
    loadFrame(index) {
      if (this.cache.has(index)) {
        const resource = this.cache.get(index); this.cache.delete(index); this.cache.set(index, resource);
        return Promise.resolve(resource);
      }
      if (this.inflight.has(index)) return this.inflight.get(index);
      const file = index < 0 ? this.config.cover : this.config.steps[index].image;
      const promise = new THREE.TextureLoader().loadAsync(root + file).then((texture) => {
        if (this.disposed) { texture.dispose(); return null; }
        this.prepareTexture(texture);
        const resource = { texture, aspect: texture.image.width / texture.image.height };
        this.cache.set(index, resource); this.trimCache(); return resource;
      }).finally(() => this.inflight.delete(index));
      this.inflight.set(index, promise);
      return promise;
    },
    trimCache() {
      const protectedKeys = new Set([-1, this.displayed, this.previousIndex, this.requested, this.displayed === null ? -1 : this.displayed + 1]);
      let count = [...this.cache.keys()].filter(i => i >= 0).length;
      for (const [index, resource] of this.cache) {
        if (count <= 3) break;
        if (protectedKeys.has(index)) continue;
        resource.texture.dispose(); this.cache.delete(index); count--;
      }
      this.el.dataset.cachedSteps = String([...this.cache.keys()].filter(i => i >= 0).length);
    },
    updateFrame() {
      if (!this.active || !this.config) return;
      const ownsAudio = this.audio?.getAttribute('src')?.includes('PTK-005-assets/');
      const index = ownsAudio ? timeline.indexFor(this.config, this.audio.currentTime, this.audio.ended) : -1;
      if (index === this.requested) return;
      this.requested = index; this.el.dataset.requestedStep = index < 0 ? 'cover' : String(index + 1);
      this.loadFrame(index).then((resource) => {
        if (!resource || this.disposed || !this.active || this.requested !== index) return;
        this.previous.material.map = this.picture.material.map; this.previous.material.needsUpdate = true;
        this.previous.scale.copy(this.picture.scale); this.previous.position.copy(this.picture.position);
        this.previous.visible = !!this.previous.material.map;
        this.previousIndex = this.displayed;
        this.picture.material.map = resource.texture; this.picture.material.needsUpdate = true;
        let width = 1.35, height = width / resource.aspect;
        if (height > 0.90) { height = 0.90; width = height * resource.aspect; }
        this.picture.scale.set(width, height, 1);
        this.picture.position.set(0, -0.02, 0.025);
        this.displayed = index; this.transition = reduced.matches ? 1 : 0;
        this.drawCaption(index);
        this.el.dataset.step = index < 0 ? 'cover' : String(index + 1); this.el.dataset.frameReady = 'true';
        this.trimCache();
        const next = index + 1;
        if (next < this.config.steps.length) this.loadFrame(next).then(() => { if (!this.disposed) this.trimCache(); }).catch(error => { if (!this.disposed) console.warn('PTK-005 optional prefetch failed', error); });
      }).catch(error => {
        if (!this.disposed && this.requested === index) { this.el.dataset.frameReady = 'error'; console.error(error); }
      });
    },
    drawCaption(index) {
      const ctx = this.titleCanvas.getContext('2d'); ctx.clearRect(0, 0, 1536, 180); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = '#fff7e1'; ctx.fillStyle = '#593722';
      const title = index < 0 ? this.config.title : this.config.steps[index].title;
      ctx.font = '600 62px Mali, sans-serif'; ctx.strokeText(title, 768, 63, 1440); ctx.fillText(title, 768, 63, 1440);
      ctx.font = '600 39px Mali, sans-serif'; const caption = index < 0 ? 'กดฟังเรื่องเล่า เพื่อชมขั้นตอนการทำ' : `ขั้นที่ ${index + 1} / ${this.config.steps.length}`;
      ctx.strokeText(caption, 768, 133, 1420); ctx.fillText(caption, 768, 133, 1420); this.titleTexture.needsUpdate = true;
      const rail = this.railCanvas.getContext('2d'); rail.clearRect(0, 0, 900, 80); rail.textAlign = 'center'; rail.textBaseline = 'middle'; rail.font = '600 35px Mali, sans-serif';
      this.config.steps.forEach((step, i) => {
        rail.fillStyle = i === index ? '#f2bd48' : i < index ? '#6d8a78' : '#fff7e1'; rail.fillRect(10 + i * 99, 8, 84, 64);
        rail.fillStyle = '#342e27'; rail.fillText(String(i + 1), 52 + i * 99, 40);
      });
      this.railTexture.needsUpdate = true;
    },
    tick(time, delta) {
      if (!this.active) return;
      const seconds = Math.min(delta / 1000, 0.15); this.clock += seconds; this.updateFrame();
      this.transition = reduced.matches ? 1 : Math.min(1, this.transition + seconds / 0.4);
      const fade = reduced.matches ? 1 : 1 - Math.pow(1 - Math.min(1, this.clock / 0.55), 3);
      const blend = 1 - Math.pow(1 - this.transition, 3);
      this.picture.material.opacity = fade * blend; this.picture.position.y = -0.02 - (reduced.matches ? 0 : (1 - blend) * 0.025);
      this.previous.material.opacity = fade * (1 - blend); this.title.material.opacity = fade; this.rail.material.opacity = fade;
      if (this.transition === 1 && this.previous.visible) { this.previous.visible = false; this.previous.material.map = null; this.previousIndex = null; this.trimCache(); }
    },
    remove() {
      this.disposed = true; window.removeEventListener('resize', this.fit);
      this.el.removeEventListener('idle-start', this.show); this.el.removeEventListener('character-hide', this.hide);
      for (const resource of this.cache.values()) resource.texture.dispose(); this.cache.clear();
      this.titleTexture.dispose(); this.railTexture.dispose();
      [this.picture, this.previous, this.title, this.rail].forEach(sprite => sprite.material.dispose());
      this.el.removeObject3D('ptk005-story');
    },
  });
})();
