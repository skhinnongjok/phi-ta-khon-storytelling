(() => {
  "use strict";
  const THREE = window.THREE;
  const assetRoot = "assets/PTK-002-assets/";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const textureReady = (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return texture;
  };

  AFRAME.registerComponent("ptk002-forest-stage", {
    init() {
      this.disposed = false; this.active = false; this.progress = 0; this.resources = [];
      this.el.setAttribute("ptk002-story-inserts", "");
      this.origin = this.el.object3D.position.z;
      this.group = new THREE.Group(); this.el.setObject3D("forest-stage", this.group);
      this.show = () => { if (this.active) return; this.active = true; this.progress = reduced.matches ? 1 : 0; this.el.dataset.stageVisible = "true"; this.reveal(); };
      this.hide = () => { this.active = false; this.progress = 0; this.el.dataset.stageVisible = "false"; this.reveal(); };
      this.el.addEventListener("stage-show", this.show); this.el.addEventListener("stage-hide", this.hide);
      const specs = [
        { file: "forest-stage.png", w: 1.06, h: 1.06, y: 0, z: 0.007, order: 10 },
        { file: "character-shadow.png", w: 0.72, h: 0.46, y: -0.13, z: 0.010, order: 20 },
        { file: "forest-backdrop.png", w: 1.30, h: 0.867, y: 0.27, z: 0.014, order: 30, billboard: true },
      ];
      this.el.dataset.stageReady = "loading";
      let settled = 0, failed = 0;
      const finish = () => { if (++settled === specs.length) this.el.dataset.stageReady = failed ? "partial" : "true"; };
      const loader = new THREE.TextureLoader();
      specs.forEach((s) => loader.load(assetRoot + s.file, (texture) => {
        if (this.disposed) { texture.dispose(); return; }
        textureReady(texture);
        const geometry = s.billboard ? null : new THREE.PlaneGeometry(s.w, s.h);
        const options = { map: texture, transparent: true, opacity: 0, alphaTest: 0.005, depthWrite: false, toneMapped: false };
        const material = s.billboard ? new THREE.SpriteMaterial({ ...options, depthTest: false }) : new THREE.MeshBasicMaterial({ ...options, side: THREE.DoubleSide });
        material.forceSinglePass = true;
        const mesh = s.billboard ? new THREE.Sprite(material) : new THREE.Mesh(geometry, material);
        if (s.billboard) { mesh.center.set(0.5, 0.11); mesh.scale.set(s.w, s.h, 1); }
        mesh.name = s.file; mesh.position.set(0, s.y, s.z); mesh.renderOrder = s.order;
        if (s.file === "forest-backdrop.png") this.backdrop = mesh;
        this.group.add(mesh); this.resources.push({ texture, geometry, material });
        this.reveal(); finish();
      }, undefined, (error) => { if (this.disposed) return; failed += 1; console.warn("Optional forest layer unavailable", s.file, error); finish(); }));
      this.reveal();
    },
    reveal() {
      const opacity = 1 - Math.pow(1 - this.progress, 3);
      this.el.object3D.position.z = this.origin - (1 - opacity) * 0.06;
      if (this.backdrop) this.backdrop.visible = !this.el.components["ptk002-story-inserts"]?.current;
      this.el.object3D.traverse((object) => { if (object.material && !object.userData.ptk002Insert && !Array.isArray(object.material)) object.material.opacity = opacity; });
    },
    tick(time, delta) { if (!this.active) return; this.progress = reduced.matches ? 1 : Math.min(1, this.progress + delta / 850); this.reveal(); },
    remove() {
      this.disposed = true;
      this.el.removeEventListener("stage-show", this.show); this.el.removeEventListener("stage-hide", this.hide);
      this.resources.forEach(({ texture, geometry, material }) => { texture.dispose(); geometry?.dispose(); material.dispose(); });
      this.el.removeAttribute("ptk002-story-inserts");
      this.el.removeObject3D("forest-stage");
    },
  });

  // The shared audio clock is authoritative: pause, seek and replay need no timers.
  AFRAME.registerComponent("ptk002-story-inserts", {
    cueAt(seconds) {
      return seconds >= 48 ? 5 : seconds >= 36 ? 2 : seconds >= 28 ? 1 : seconds >= 9 ? 3 : 0;
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
      this.el.setObject3D("ptk002-story-inserts", this.group);
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
      [3, 1, 2, 5].forEach((id) => {
        loader.load(`assets/PTK-002-assets/PTK-002-insert${id}.jpg`, (texture) => {
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
          textureReady(texture);
          texture.needsUpdate = true;
          const material = new THREE.SpriteMaterial({
            map: texture, transparent: true, opacity: 0,
            depthTest: false, depthWrite: false, toneMapped: false,
          });
          const sprite = new THREE.Sprite(material);
          sprite.userData.ptk002Insert = true;
          sprite.name = `PTK-002-insert${id}`;
          sprite.scale.set(Math.min(1.3, 0.86 * ratio), Math.min(0.86, 1.3 / ratio), 1);
          sprite.position.set(0, 0.90, 0.014);
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
          console.warn("Unable to load PTK-002 insert", id, error);
        });
      });
    },
    sync(delta) {
      const src = this.audio?.getAttribute("src") || "";
      const ownsAudio = src.includes("PTK-002-assets/");
      const next = this.active && ownsAudio ? this.cueAt(this.audio.currentTime) : 0;
      if (next !== this.current) { this.current = next; this.fade = 0; }
      this.fade = reduced.matches ? 1 : Math.min(1, this.fade + delta / 280);
      const progress = this.el.components["ptk002-forest-stage"]?.progress || 0;
      const reveal = 1 - Math.pow(1 - progress, 3);
      this.group.visible = Boolean(next);
      const backdrop = this.el.components["ptk002-forest-stage"]?.backdrop;
      if (backdrop) backdrop.visible = !next;
      this.el.dataset.backdropVisible = String(this.active && !next);
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
      this.el.removeObject3D("ptk002-story-inserts");
    },
  });


  AFRAME.registerComponent("ptk002-wave", {
    init() {
      this.disposed = false; this.active = false; this.clock = 0; this.lastFrame = -1;
      this.texture = null; this.clip = null; this.fallback = false;
      this.material = new THREE.SpriteMaterial({transparent:true,opacity:0,alphaTest:0.005,depthTest:false,depthWrite:false,toneMapped:false});
      this.sprite = new THREE.Sprite(this.material); this.sprite.renderOrder=100;this.sprite.frustumCulled=false;this.sprite.center.set(.5,0);
      this.el.setObject3D("ptk002-wave",this.sprite);this.el.dataset.spriteReady="loading";
      this.show=()=>{this.active=true;this.clock=0;this.lastFrame=-1;this.el.dataset.clip="wave";this.paint();};
      this.hide=()=>{this.active=false;this.clock=0;};
      this.el.addEventListener("idle-start",this.show);this.el.addEventListener("character-hide",this.hide);
      this.load();
    },
    async load() {
      const loader=new THREE.TextureLoader();
      try {
        const response=await fetch(assetRoot+"animation.json");if(!response.ok)throw new Error("Animation metadata unavailable");
        const config=await response.json();this.clip=config.animations.wave;
        const texture=await loader.loadAsync(assetRoot+this.clip.sprite);
        if(this.disposed){texture.dispose();return;}
        if(texture.image.width!==this.clip.imageSize[0]||texture.image.height!==this.clip.imageSize[1]){texture.dispose();throw new Error("Sprite size mismatch");}
        this.texture=textureReady(texture);this.material.map=this.texture;this.material.needsUpdate=true;
        this.el.dataset.spriteReady="true";this.paint();
      } catch(error) {
        if(this.disposed)return;
        console.warn("PTK-002 wave unavailable; showing original master",error);
        try {
          const texture=await loader.loadAsync(assetRoot+"PTK-002-character-master.png");
          if(this.disposed){texture.dispose();return;}
          this.texture=textureReady(texture);this.material.map=this.texture;this.material.needsUpdate=true;this.fallback=true;
          this.sprite.center.set(.5,.02);this.sprite.scale.set(.633,.95,1);this.el.dataset.spriteReady="fallback";
        }catch(e){if(!this.disposed){this.el.dataset.spriteReady="error";console.error(e);}}
      }
    },
    paint() {
      if(!this.texture||!this.clip||this.fallback)return;
      const sequenceIndex=reduced.matches?3:Math.floor((this.clock+1e-9)*this.clip.fps)%this.clip.sequence.length;
      const index=this.clip.sequence[sequenceIndex];if(index===this.lastFrame)return;this.lastFrame=index;
      const frame=this.clip.frames[index];const[x,y,w,h]=frame.rect;const[width,height]=this.clip.imageSize;
      this.texture.repeat.set(w/width,h/height);this.texture.offset.set(x/width,1-(y+h)/height);
      this.sprite.center.set(frame.pivot[0],1-frame.pivot[1]);this.sprite.scale.set(.95*w/h,.95,1);
      this.el.dataset.frame=String(index);
    },
    tick(time,delta){if(!this.active)return;if(!reduced.matches)this.clock+=Math.min(delta/1000,.15);this.paint();},
    remove(){this.disposed=true;this.el.removeEventListener("idle-start",this.show);this.el.removeEventListener("character-hide",this.hide);this.material.dispose();this.texture?.dispose();this.el.removeObject3D("ptk002-wave");},
  });
})();
