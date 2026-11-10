(() => {
  "use strict";

  const COLS = 3;
  const ROWS = 2;

  const prepareSpriteSheet = (source) => {
    const canvas = document.createElement("canvas");
    canvas.width = source.naturalWidth;
    canvas.height = source.naturalHeight;
    const context = canvas.getContext("2d");
    context.drawImage(source, 0, 0);
    return canvas;
  };

  AFRAME.registerComponent("ar-guide-sprite", {
    schema: { src: { type: "string" } },

    init() {
      this.active = false;
      this.frame = -1;
      this.audio = document.getElementById("guide-audio");
      this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.overlay = document.createElement("canvas");
      this.overlay.width = 512;
      this.overlay.height = 512;
      this.overlay.className = "guide-sprite-overlay";
      this.overlay.hidden = true;
      document.querySelector(".ar-stage").appendChild(this.overlay);
      this.overlayContext = this.overlay.getContext("2d");
      this.material = new THREE.MeshBasicMaterial({
        transparent: true,
        alphaTest: 0.03,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
      });
      this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 1.22), this.material);
      this.mesh.renderOrder = 1000;
      this.el.setObject3D("guide-mesh", this.mesh);
      this.el.object3D.visible = false;
      this.loadTexture();
      this.el.addEventListener("guide-show", () => {
        this.active = true;
        this.overlay.hidden = false;
        this.el.setAttribute("visible", true);
        this.el.object3D.visible = true;
        this.setFrame(0);
      });
      this.el.addEventListener("guide-hide", () => {
        this.active = false;
        this.overlay.hidden = true;
        this.el.setAttribute("visible", false);
        this.el.object3D.visible = false;
      });
    },

    loadTexture() {
      const image = new Image();
      image.onload = () => {
        const cleanCanvas = prepareSpriteSheet(image);
        this.cleanCanvas = cleanCanvas;
        this.texture = new THREE.CanvasTexture(cleanCanvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.texture.wrapS = THREE.ClampToEdgeWrapping;
        this.texture.wrapT = THREE.ClampToEdgeWrapping;
        this.texture.repeat.set(1 / COLS, 1 / ROWS);
        this.material.map = this.texture;
        this.material.needsUpdate = true;
        this.el.dataset.spriteReady = "true";
        this.setFrame(0);
      };
      image.onerror = () => { this.el.dataset.spriteReady = "error"; };
      image.src = this.data.src;
    },

    setFrame(next) {
      if (!this.texture || next === this.frame) return;
      this.frame = next;
      const column = next % COLS;
      const row = Math.floor(next / COLS);
      const cellWidth = this.cleanCanvas.width / COLS;
      const cellHeight = this.cleanCanvas.height / ROWS;
      this.overlayContext.clearRect(0, 0, this.overlay.width, this.overlay.height);
      this.overlayContext.drawImage(
        this.cleanCanvas,
        column * cellWidth,
        row * cellHeight,
        cellWidth,
        cellHeight,
        0,
        0,
        this.overlay.width,
        this.overlay.height,
      );
      this.texture.offset.set(column / COLS, 1 - ((row + 1) / ROWS));
      this.texture.needsUpdate = true;
      this.el.dataset.guideFrame = String(next);
    },

    tick(time) {
      if (!this.active || !this.texture || !this.audio) return;
      const current = this.audio.currentTime || 0;
      let next = 0;
      if (current < 4.5) next = this.reducedMotion ? 0 : Math.floor(time / 900) % 2;
      else if (current < 27) next = this.reducedMotion ? 3 : 2 + (Math.floor(time / 720) % 3);
      else next = this.reducedMotion ? 5 : (Math.floor(time / 620) % 2 ? 5 : 4);
      this.setFrame(next);
      if (!this.reducedMotion) {
        this.el.object3D.position.y = -0.18 + Math.sin(time / 720) * 0.012;
      }
    },

    remove() {
      this.texture?.dispose();
      this.mesh?.geometry.dispose();
      this.material?.dispose();
      this.overlay?.remove();
      this.el.removeObject3D("guide-mesh");
    },
  });
})();
