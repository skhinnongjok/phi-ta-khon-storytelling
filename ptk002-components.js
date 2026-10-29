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
        this.group.add(mesh); this.resources.push({ texture, geometry, material });
        this.reveal(); finish();
      }, undefined, (error) => { if (this.disposed) return; failed += 1; console.warn("Optional forest layer unavailable", s.file, error); finish(); }));
      this.reveal();
    },
    reveal() {
      const opacity = 1 - Math.pow(1 - this.progress, 3);
      this.el.object3D.position.z = this.origin - (1 - opacity) * 0.06;
      this.el.object3D.traverse((object) => { if (object.material && !Array.isArray(object.material)) object.material.opacity = opacity; });
    },
    tick(time, delta) { if (!this.active) return; this.progress = reduced.matches ? 1 : Math.min(1, this.progress + delta / 850); this.reveal(); },
    remove() {
      this.disposed = true;
      this.el.removeEventListener("stage-show", this.show); this.el.removeEventListener("stage-hide", this.hide);
      this.resources.forEach(({ texture, geometry, material }) => { texture.dispose(); geometry?.dispose(); material.dispose(); });
      this.el.removeObject3D("forest-stage");
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
