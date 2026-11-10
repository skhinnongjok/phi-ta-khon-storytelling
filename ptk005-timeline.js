(function (root) {
  'use strict';
  const timeline = {
    // -1 = greeting narrator, -2 = closing narrator, 0..8 = making steps.
    indexFor(config, currentTime, ended) {
      if (!config?.steps?.length) return -1;
      const time = Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0;
      if (Number.isFinite(config.outroStart) && (ended || time >= config.outroStart)) return -2;
      if (ended) return config.steps.length - 1;
      let index = -1;
      config.steps.forEach((step, i) => { if (time >= step.start) index = i; });
      return index;
    },
    narratorFrame(clip, seconds, fps, playing, reducedMotion) {
      if (!playing || reducedMotion || !clip?.sequence?.length) return 0;
      const time = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
      return clip.sequence[Math.floor((time + 1e-9) * fps) % clip.sequence.length];
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = timeline;
  else root.PTK005Timeline = timeline;
})(typeof window !== 'undefined' ? window : globalThis);
