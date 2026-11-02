(function (root) {
  'use strict';
  const timeline = {
    indexFor(config, currentTime, ended) {
      if (!config?.steps?.length) return -1;
      if (ended) return config.steps.length - 1;
      const time = Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0;
      let index = -1;
      config.steps.forEach((step, i) => { if (time >= step.start) index = i; });
      return index;
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = timeline;
  else root.PTK005Timeline = timeline;
})(typeof window !== 'undefined' ? window : globalThis);
