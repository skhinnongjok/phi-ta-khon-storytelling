(() => {
  "use strict";

  if (!window.AFRAME || !window.THREE) {
    throw new Error("A-Frame must load before ar-components.js");
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const assetRoot = "assets/PTK-001-assets/2.5d-v1/";
  const prepareTexture = (texture) => {
    if ("colorSpace" in texture && THREE.SRGBColorSpace) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    texture.needsUpdate = true;
    return texture;
  };

  AFRAME.registerComponent("postcard-stage", {
    init() {
      this.disposed = false;
      this.active = false;
      this.progress = 0;
      this.layers = [];
      this.group = new THREE.Group();
      this.el.setObject3D("postcard-stage", this.group);
      this.el.setAttribute("ptk001-story-inserts", "");
      this.originZ = this.el.object3D.position.z;
      const loader = new THREE.TextureLoader();
      // MindAR's target lies in XY; +Z points out of the printed postcard.
      const specs = [
        { file: "stage-base.png", width: 0.9, height: 0.9, y: 0, z: 0.006, order: 10 },
        { file: "character-shadow.png", width: 0.68, height: 0.45, y: -0.08, z: 0.009, order: 20 },
      ];
      this.el.dataset.stageReady = "loading";
      let settled = 0;
      let failed = false;
      const finish = () => {
        settled += 1;
        if (settled === specs.length) {
          this.el.dataset.stageReady = failed ? "partial" : "true";
          this.el.emit("stage-ready", { partial: failed }, false);
        }
      };
      specs.forEach((spec) => loader.load(assetRoot + spec.file, (texture) => {
        if (this.disposed) { texture.dispose(); return; }
        prepareTexture(texture);
        const geometry = new THREE.PlaneGeometry(spec.width, spec.height);
        if (spec.upright) geometry.translate(0, spec.height * (spec.baseline - 0.5), 0);
        const material = new THREE.MeshBasicMaterial({
          map: texture, transparent: true, opacity: this.progress,
          alphaTest: 0.002, depthWrite: false, side: THREE.DoubleSide,
          toneMapped: false,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = spec.file;
        mesh.position.set(0, spec.y, spec.z);
        if (spec.upright) mesh.rotation.x = Math.PI / 2;
        mesh.renderOrder = spec.order;
        this.group.add(mesh);
        this.layers.push({ mesh, texture });
        finish();
      }, undefined, (error) => {
        if (this.disposed) return;
        failed = true;
        console.warn("Unable to load optional stage layer", spec.file, error);
        finish();
      }));
      this.show = () => {
        if (this.active) return;
        this.active = true;
        this.progress = reducedMotion.matches ? 1 : 0;
        this.el.dataset.stageVisible = "true";
        this.applyReveal();
      };
      this.hide = () => {
        this.active = false;
        this.progress = 0;
        this.el.dataset.stageVisible = "false";
        this.applyReveal();
      };
      this.el.addEventListener("stage-show", this.show);
      this.el.addEventListener("stage-hide", this.hide);
      this.applyReveal();
    },

    applyReveal() {
      const eased = 1 - Math.pow(1 - this.progress, 3);
      this.el.object3D.position.z = this.originZ - (1 - eased) * 0.07;
      this.el.object3D.traverse((object) => {
        if (object.material && !object.userData.ptk001Insert && !Array.isArray(object.material)) object.material.opacity = eased;
      });
    },

    tick(time, delta) {
      if (!this.active) return;
      this.progress = reducedMotion.matches ? 1 : Math.min(1, this.progress + delta / 850);
      // Also applies the current opacity to textures that finished loading this frame.
      this.applyReveal();
    },

    remove() {
      this.disposed = true;
      this.el.removeEventListener("stage-show", this.show);
      this.el.removeEventListener("stage-hide", this.hide);
      this.layers.forEach(({ mesh, texture }) => {
        mesh.geometry.dispose(); mesh.material.dispose(); texture.dispose();
      });
      this.el.removeAttribute("ptk001-story-inserts");
      this.el.removeObject3D("postcard-stage");
    },
  });


  // The shared audio clock is authoritative: pause, seek and replay need no timers.
  AFRAME.registerComponent("ptk001-story-inserts", {
    cueAt(seconds) {
      return seconds >= 51 ? 1 : seconds >= 38 ? 2 : seconds >= 28 ? 4 : seconds >= 15 ? 3 : 0;
    },
    init() {
      this.disposed = false;
      this.active = false;
      this.current = 0;
      this.fade = 0;
      this.images = new Map();
      this.audio = document.getElementById("story-audio");
      this.group = new THREE.Group();
      this.group.visible = false;
      this.el.setObject3D("ptk001-story-inserts", this.group);
      this.show = () => { this.active = true; this.sync(0); };
      this.hide = () => { this.active = false; this.sync(0); };
      this.el.addEventListener("stage-show", this.show);
      this.el.addEventListener("stage-hide", this.hide);
      this.el.dataset.insertReady = "loading";
      let settled = 0;
      let failed = false;
      const done = () => {
        if (++settled === 4) this.el.dataset.insertReady = failed ? "partial" : "true";
      };
      const loader = new THREE.TextureLoader();
      [1, 2, 3, 4].forEach((id) => {
        loader.load(`assets/PTK-001-assets/PTK-001-insert${id}.jpg`, (texture) => {
          if (this.disposed) { texture.dispose(); return; }
          const source = texture.image;
          const ratio = source.width / source.height;
          // Cap decoded GPU textures on mobile; preserve the user's original JPEGs.
          if (Math.max(source.width, source.height) > 1024) {
            const canvas = document.createElement("canvas");
            const scale = 1024 / Math.max(source.width, source.height);
            canvas.width = Math.round(source.width * scale);
            canvas.height = Math.round(source.height * scale);
            canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
            texture.image = canvas;
          }
          prepareTexture(texture);
          const material = new THREE.SpriteMaterial({
            map: texture, transparent: true, opacity: 0,
            depthTest: false, depthWrite: false, toneMapped: false,
          });
          const sprite = new THREE.Sprite(material);
          sprite.userData.ptk001Insert = true;
          sprite.name = `PTK-001-insert${id}`;
          sprite.scale.set(Math.min(1.3, 0.86 * ratio), Math.min(0.86, 1.3 / ratio), 1);
          sprite.position.set(0, 1.25, 0.014);
          sprite.renderOrder = 30; // Base/shadow < photo < character (100).
          sprite.frustumCulled = false;
          sprite.visible = false;
          this.group.add(sprite);
          this.images.set(id, sprite);
          this.sync(0);
          done();
        }, undefined, (error) => {
          if (this.disposed) return;
          failed = true;
          done();
          console.warn("Unable to load PTK-001 insert", id, error);
        });
      });
    },
    sync(delta) {
      const src = this.audio?.getAttribute("src") || "";
      const ownsAudio = src.includes("PTK-001-assets/");
      const next = this.active && ownsAudio ? this.cueAt(this.audio.currentTime) : 0;
      if (next !== this.current) { this.current = next; this.fade = 0; }
      this.fade = reducedMotion.matches ? 1 : Math.min(1, this.fade + delta / 280);
      const progress = this.el.components["postcard-stage"]?.progress || 0;
      const reveal = 1 - Math.pow(1 - progress, 3);
      this.group.visible = Boolean(next);
      this.images.forEach((sprite, id) => {
        sprite.visible = id === next;
        sprite.material.opacity = reveal * this.fade;
      });
      this.el.dataset.insert = String(next);
    },
    tick(time, delta) { this.sync(delta); },
    remove() {
      this.disposed = true;
      this.el.removeEventListener("stage-show", this.show);
      this.el.removeEventListener("stage-hide", this.hide);
      this.images.forEach((sprite) => { sprite.material.map.dispose(); sprite.material.dispose(); });
      this.images.clear();
      this.el.removeObject3D("ptk001-story-inserts");
    },
  });

  AFRAME.registerComponent("storyteller-sprite", {
    schema: {
      src: { type: "string" },
      wave: { type: "string" },
      talk: { type: "string" },
      width: { type: "number", default: 0.62 },
      height: { type: "number", default: 0.93 },
    },

    init() {
      this.disposed = false;
      this.textures = {};
      this.pose = "idle";
      this.greetingRemaining = 0;
      this.elapsed = 0;
      this.playing = false;
      this.active = false;
      this.material = null;
      this.sprite = null;
      this.el.dataset.spriteReady = "loading";
      this.el.dataset.poseAssets = "loading";
      const loader = new THREE.TextureLoader();
      let settled = 0;
      const entries = Object.entries({ idle: this.data.src, wave: this.data.wave, talk: this.data.talk }).filter(([, src]) => src);
      entries.forEach(([pose, src]) => loader.load(src, (texture) => {
        if (this.disposed) { texture.dispose(); return; }
        this.textures[pose] = prepareTexture(texture);
        if (!this.sprite) {
          this.material = new THREE.SpriteMaterial({
            map: texture, color: 0xffffff, transparent: true, opacity: 0,
            alphaTest: 0.001, depthTest: false, depthWrite: false,
            sizeAttenuation: true, toneMapped: false,
          });
          this.sprite = new THREE.Sprite(this.material);
          this.sprite.name = "PTK-001 storyteller sprite";
          // Ground the PNG by its feet instead of its canvas center.
          this.sprite.center.set(0.5, 0.02);
          this.sprite.scale.set(this.data.width, this.data.height, 1);
          this.sprite.renderOrder = 100;
          this.sprite.frustumCulled = false;
          this.el.setObject3D("storyteller-sprite", this.sprite);
          this.el.dataset.spriteReady = "true";
          this.el.emit("sprite-ready", null, false);
        }
        this.setPose(this.pose);
        settled += 1;
        if (settled === entries.length) this.el.dataset.poseAssets = "settled";
      }, undefined, (error) => {
        if (this.disposed) return;
        settled += 1;
        if (settled === entries.length) {
          this.el.dataset.poseAssets = "settled";
          if (!this.sprite) this.el.dataset.spriteReady = "error";
        }
        console.warn("Unable to load storyteller pose; using available pose", pose, error);
      }));
      this.greet = () => {
        this.active = true;
        this.elapsed = 0;
        this.greetingRemaining = reducedMotion.matches || this.playing ? 0 : 1800;
        this.setPose(this.playing ? "talk" : this.greetingRemaining ? "wave" : "idle");
      };
      this.playStory = () => {
        this.playing = true;
        this.greetingRemaining = 0;
        this.setPose("talk");
      };
      this.pauseStory = () => {
        this.playing = false;
        this.greetingRemaining = 0;
        this.setPose("idle");
      };
      this.hide = () => {
        this.active = false;
        this.greetingRemaining = 0;
        if (this.sprite) this.sprite.scale.set(this.data.width, this.data.height, 1);
      };
      this.el.addEventListener("idle-start", this.greet);
      this.el.addEventListener("story-play", this.playStory);
      this.el.addEventListener("story-pause", this.pauseStory);
      this.el.addEventListener("character-hide", this.hide);
    },

    setPose(pose) {
      this.pose = pose;
      const actualPose = this.textures[pose] ? pose : this.textures.idle ? "idle" : Object.keys(this.textures)[0];
      if (!this.sprite || !actualPose) return;
      this.material.map = this.textures[actualPose];
      this.material.needsUpdate = true;
      // Small registration correction: generated front shoe ends at y=1509 vs 1516 in wave.
      this.sprite.center.set(0.5, actualPose === "talk" ? 0.025 : 0.02);
      this.el.dataset.pose = actualPose;
    },

    tick(time, delta) {
      if (!this.active || !this.sprite) return;
      this.elapsed += delta;
      if (this.greetingRemaining > 0) {
        this.greetingRemaining -= delta;
        if (this.greetingRemaining <= 0) this.setPose("idle");
      }
      // Pulse around the grounded feet. No rotations: THREE.Sprite faces the camera.
      const pulse = !reducedMotion.matches && this.playing ? 1 + Math.sin(this.elapsed / 280) * 0.012 : 1;
      this.sprite.scale.set(this.data.width * pulse, this.data.height * pulse, 1);
    },

    remove() {
      this.disposed = true;
      this.el.removeEventListener("idle-start", this.greet);
      this.el.removeEventListener("story-play", this.playStory);
      this.el.removeEventListener("story-pause", this.pauseStory);
      this.el.removeEventListener("character-hide", this.hide);
      this.el.removeObject3D("storyteller-sprite");
      this.material?.dispose();
      Object.values(this.textures).forEach((texture) => texture.dispose());
    },
  });
})();
