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
      this.originZ = this.el.object3D.position.z;
      const loader = new THREE.TextureLoader();
      // MindAR's target lies in XY; +Z points out of the printed postcard.
      const specs = [
        { file: "stage-base.png", width: 0.9, height: 0.9, y: 0, z: 0.006, order: 10 },
        { file: "character-shadow.png", width: 0.68, height: 0.45, y: -0.08, z: 0.009, order: 20 },
        { file: "stage-backdrop.png", width: 0.94, height: 0.627, y: 0.25, z: 0.012, upright: true, baseline: 0.825, order: 30 },
        { file: "stage-foreground.png", width: 0.9, height: 0.6, y: -0.32, z: 0.014, upright: true, baseline: 0.94, order: 110 },
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
        if (object.material && !Array.isArray(object.material)) object.material.opacity = eased;
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
      this.el.removeObject3D("postcard-stage");
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
