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
      this.cache = new Map(); this.inflight = new Map(); this.narratorClips = new Map();
      this.animation = null; this.lastNarratorKey = null;
      this.audio = document.getElementById('story-audio');
      this.group = new THREE.Group(); this.group.visible = false;
      this.el.setObject3D('ptk005-story', this.group);
      this.material = () => new THREE.SpriteMaterial({ transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false, alphaTest: 0.008 });
      this.picture = new THREE.Sprite(this.material()); this.picture.renderOrder = 100; this.picture.frustumCulled = false;
      this.previous = new THREE.Sprite(this.material()); this.previous.renderOrder = 99; this.previous.visible = false; this.previous.frustumCulled = false;
      this.narrator = new THREE.Sprite(this.material()); this.narrator.renderOrder = 100; this.narrator.visible = false; this.narrator.frustumCulled = false;
      this.narrator.position.set(0, -0.50, 0.025);
      this.group.add(this.previous, this.picture, this.narrator);
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
      this.el.dataset.spriteReady = 'loading'; this.el.dataset.narratorReady = 'loading';
      this.load();
    },
    prepareTexture(texture) {
      texture.colorSpace = THREE.SRGBColorSpace; texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false;
      return texture;
    },
    canvasTexture(canvas) { return this.prepareTexture(new THREE.CanvasTexture(canvas)); },
    async load() {
      try {
        const response = await fetch(root + 'PTK-005-lesson.json?v=2');
        if (!response.ok) throw new Error('PTK-005 lesson metadata unavailable');
        this.config = await response.json(); if (this.disposed) return;
        const file = this.config.narrator.animation;
        const manifest = await fetch(root + file);
        if (!manifest.ok) throw new Error('PTK-005 narrator metadata unavailable');
        this.animation = await manifest.json(); if (this.disposed) return;
        const folder = file.slice(0, file.lastIndexOf('/') + 1);
        await Promise.all(Object.entries(this.animation.clips).map(async ([name, clip]) => {
          const texture = await new THREE.TextureLoader().loadAsync(root + folder + clip.sprite);
          if (this.disposed) { texture.dispose(); return; }
          if (texture.image.width !== clip.imageSize[0] || texture.image.height !== clip.imageSize[1]) { texture.dispose(); throw new Error('Narrator sheet size mismatch'); }
          this.narratorClips.set(name, { ...clip, texture: this.prepareTexture(texture) });
        }));
        if (this.disposed) return;
        this.el.dataset.narratorReady = 'true'; this.el.dataset.spriteReady = 'true';
        this.loadFrame(0).catch(error => { if (!this.disposed) console.warn('PTK-005 first step prefetch failed', error); });
        if (this.active) this.updateFrame();
        if (document.fonts) document.fonts.load('600 48px Mali').then(() => { if (!this.disposed && this.displayed !== null) this.drawCaption(this.displayed); }).catch(() => {});
      } catch (error) { if (!this.disposed) { this.el.dataset.spriteReady = 'error'; this.el.dataset.narratorReady = 'error'; console.error(error); } }
    },
    loadFrame(index) {
      if (this.cache.has(index)) {
        const resource = this.cache.get(index); this.cache.delete(index); this.cache.set(index, resource);
        return Promise.resolve(resource);
      }
      if (this.inflight.has(index)) return this.inflight.get(index);
      const file = this.config.steps[index].image;
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
      const protectedKeys = new Set([-1, this.displayed, this.previousIndex, this.requested, this.displayed === null ? 0 : this.displayed + 1]);
      let count = [...this.cache.keys()].filter(i => i >= 0).length;
      for (const [index, resource] of this.cache) {
        if (count <= 3) break;
        if (protectedKeys.has(index)) continue;
        resource.texture.dispose(); this.cache.delete(index); count--;
      }
      this.el.dataset.cachedSteps = String([...this.cache.keys()].filter(i => i >= 0).length);
    },
    paintNarrator() {
      if (!this.animation || this.displayed >= 0 || this.displayed === null) return;
      const name = this.displayed === -2 ? this.config.narrator.outroClip : this.config.narrator.introClip;
      const clip = this.narratorClips.get(name); if (!clip) return;
      const ownsAudio = this.audio?.getAttribute('src')?.includes('PTK-005-assets/');
      const playing = ownsAudio && !this.audio.paused && !this.audio.ended;
      const seconds = ownsAudio ? this.audio.currentTime - (this.displayed === -2 ? this.config.outroStart : 0) : 0;
      const index = timeline.narratorFrame(clip, seconds, this.animation.fps, playing, reduced.matches);
      const key = name + ':' + index; if (key === this.lastNarratorKey) return;
      this.lastNarratorKey = key;
      const frame = clip.frames[index], [x, y, width, height] = frame.rect, [atlasWidth, atlasHeight] = clip.imageSize;
      clip.texture.repeat.set(width / atlasWidth, height / atlasHeight); clip.texture.offset.set(x / atlasWidth, 1 - (y + height) / atlasHeight);
      this.narrator.material.map = clip.texture; this.narrator.material.needsUpdate = true;
      this.narrator.center.set(frame.pivot[0], 1 - frame.pivot[1]); this.narrator.scale.set(1.10 * width / height, 1.10, 1);
      this.el.dataset.narratorClip = name; this.el.dataset.narratorFrame = String(index);
    },
    updateFrame() {
      if (!this.active || !this.config || !this.animation || !this.narratorClips.size) return;
      const ownsAudio = this.audio?.getAttribute('src')?.includes('PTK-005-assets/');
      const index = ownsAudio ? timeline.indexFor(this.config, this.audio.currentTime, this.audio.ended) : -1;
      if (index === this.requested) return;
      this.requested = index;
      const label = index === -1 ? 'intro' : index === -2 ? 'outro' : String(index + 1);
      this.el.dataset.requestedStep = label; this.el.dataset.mode = index < 0 ? label : 'step';
      // Narrator and making-step pictures are mutually exclusive, including transitions.
      this.narrator.visible = index < 0; this.el.dataset.narratorVisible = String(index < 0);
      this.rail.visible = index >= 0; this.title.position.y = index < 0 ? 0.73 : 0.56;
      if (index < 0) {
        this.picture.visible = false; this.picture.material.map = null;
        this.previous.visible = false; this.previous.material.map = null; this.previousIndex = null;
        this.displayed = index; this.transition = 1; this.drawCaption(index); this.paintNarrator();
        this.el.dataset.step = label; this.el.dataset.pictureVisible = 'false'; this.el.dataset.frameReady = 'true';
        this.trimCache(); return;
      }
      this.picture.visible = this.displayed >= 0 && !!this.picture.material.map;
      this.el.dataset.pictureVisible = String(this.picture.visible);
      this.loadFrame(index).then((resource) => {
        if (!resource || this.disposed || !this.active || this.requested !== index) return;
        const previousMap = this.displayed >= 0 ? this.picture.material.map : null;
        this.previous.material.map = previousMap; this.previous.material.needsUpdate = true;
        this.previous.scale.copy(this.picture.scale); this.previous.position.copy(this.picture.position);
        this.previous.visible = !!previousMap; this.previousIndex = this.displayed >= 0 ? this.displayed : null;
        this.picture.material.map = resource.texture; this.picture.material.needsUpdate = true;
        let width = 1.35, height = width / resource.aspect;
        if (height > 0.90) { height = 0.90; width = height * resource.aspect; }
        this.picture.scale.set(width, height, 1); this.picture.position.set(0, -0.02, 0.025); this.picture.visible = true;
        this.displayed = index; this.transition = reduced.matches ? 1 : 0; this.drawCaption(index);
        this.el.dataset.step = label; this.el.dataset.pictureVisible = 'true'; this.el.dataset.frameReady = 'true';
        this.trimCache();
        const next = index + 1;
        if (next < this.config.steps.length) this.loadFrame(next).then(() => { if (!this.disposed) this.trimCache(); }).catch(error => { if (!this.disposed) console.warn('PTK-005 optional prefetch failed', error); });
      }).catch(error => { if (!this.disposed && this.requested === index) { this.el.dataset.frameReady = 'error'; console.error(error); } });
    },
    drawCaption(index) {
      const ctx = this.titleCanvas.getContext('2d'); ctx.clearRect(0, 0, 1536, 180); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = '#fff7e1'; ctx.fillStyle = '#593722';
      const title = index < 0 ? this.config.title : this.config.steps[index].title;
      ctx.font = '600 62px Mali, sans-serif'; ctx.strokeText(title, 768, 63, 1440); ctx.fillText(title, 768, 63, 1440);
      ctx.font = '600 39px Mali, sans-serif';
      const caption = index === -2 ? 'ภูมิปัญญาที่สืบทอดจากรุ่นสู่รุ่น' : index === -1 ? 'เรื่องเล่าจากช่างทำหน้ากาก' : `ขั้นที่ ${index + 1} / ${this.config.steps.length}`;
      ctx.strokeText(caption, 768, 133, 1420); ctx.fillText(caption, 768, 133, 1420); this.titleTexture.needsUpdate = true;
      const rail = this.railCanvas.getContext('2d'); rail.clearRect(0, 0, 900, 80); rail.textAlign = 'center'; rail.textBaseline = 'middle'; rail.font = '600 35px Mali, sans-serif';
      this.config.steps.forEach((step, i) => { rail.fillStyle = i === index ? '#f2bd48' : i < index ? '#6d8a78' : '#fff7e1'; rail.fillRect(10 + i * 99, 8, 84, 64); rail.fillStyle = '#342e27'; rail.fillText(String(i + 1), 52 + i * 99, 40); });
      this.railTexture.needsUpdate = true;
    },
    tick(time, delta) {
      if (!this.active) return;
      const seconds = Math.min(delta / 1000, 0.15); this.clock += seconds; this.updateFrame();
      this.transition = reduced.matches ? 1 : Math.min(1, this.transition + seconds / 0.4);
      const fade = reduced.matches ? 1 : 1 - Math.pow(1 - Math.min(1, this.clock / 0.55), 3);
      const blend = 1 - Math.pow(1 - this.transition, 3);
      this.picture.material.opacity = fade * blend; this.picture.position.y = -0.02 - (reduced.matches ? 0 : (1 - blend) * 0.025);
      this.previous.material.opacity = fade * (1 - blend); this.narrator.material.opacity = fade;
      this.title.material.opacity = fade; this.rail.material.opacity = fade;
      this.paintNarrator();
      if (this.transition === 1 && this.previous.visible) { this.previous.visible = false; this.previous.material.map = null; this.previousIndex = null; this.trimCache(); }
    },
    remove() {
      this.disposed = true; window.removeEventListener('resize', this.fit);
      this.el.removeEventListener('idle-start', this.show); this.el.removeEventListener('character-hide', this.hide);
      for (const resource of this.cache.values()) resource.texture.dispose(); this.cache.clear();
      for (const clip of this.narratorClips.values()) clip.texture.dispose(); this.narratorClips.clear();
      this.titleTexture.dispose(); this.railTexture.dispose();
      [this.picture, this.previous, this.narrator, this.title, this.rail].forEach(sprite => sprite.material.dispose());
      this.el.removeObject3D('ptk005-story');
    },
  });
})();
