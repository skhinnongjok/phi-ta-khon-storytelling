(() => {
  "use strict";

  const state = {
    arStarted: false,
    sceneReady: false,
    targetFound: false,
    audioEnded: false,
    entered: false,
    cameraPromise: null,
    activeCard: null,
    audioCard: "PTK-001",
  };

  const elements = {};
  const cards = [];
  const byId = (id) => document.getElementById(id);

  const waitForEvent = (target, eventName) => new Promise((resolve) => {
    target.addEventListener(eventName, resolve, { once: true });
  });

  const setTrackingStatus = (message, mode = "searching") => {
    elements.trackingStatus.textContent = message;
    elements.trackingDot.classList.toggle("is-found", mode === "found");
    elements.trackingDot.classList.toggle("is-error", mode === "error");
  };

  const setAudioButton = (mode) => {
    const settings = {
      ready: { icon: "▶", label: "ฟังเรื่องเล่า", aria: "ฟังเรื่องเล่า" },
      playing: { icon: "Ⅱ", label: "หยุดชั่วคราว", aria: "หยุดเสียงชั่วคราว" },
      paused: { icon: "▶", label: "เล่นต่อ", aria: "เล่นเรื่องเล่าต่อ" },
      ended: { icon: "↻", label: "เล่นใหม่", aria: "เล่นเรื่องเล่าใหม่ตั้งแต่ต้น" },
    };
    const next = settings[mode];
    elements.audioIcon.textContent = next.icon;
    elements.audioLabel.textContent = next.label;
    elements.audioButton.setAttribute("aria-label", next.aria);
    elements.audioButton.classList.toggle("is-playing", mode === "playing");
  };

  const waitForScene = async () => {
    if (elements.scene.hasLoaded) {
      state.sceneReady = true;
      return;
    }
    await waitForEvent(elements.scene, "loaded");
    state.sceneReady = true;
  };

  const cameraErrorText = (error) => {
    const name = error?.name || "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return "โปรดอนุญาตให้เว็บไซต์นี้ใช้กล้อง แล้วลองอีกครั้ง";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "ไม่พบกล้องที่ใช้งานได้บนอุปกรณ์นี้";
    }
    if (!window.isSecureContext) {
      return "กล้องต้องเปิดผ่าน HTTPS หรือ localhost เท่านั้น";
    }
    return "โปรดตรวจสอบว่ามีแอปอื่นกำลังใช้กล้องอยู่หรือไม่ แล้วลองอีกครั้ง";
  };

  const prepareCamera = () => {
    if (state.arStarted) return Promise.resolve();
    if (state.cameraPromise) return state.cameraPromise;

    elements.audioButton.hidden = true;
    elements.cameraError.hidden = true;
    elements.loadingLayer.hidden = false;
    setTrackingStatus("กำลังเปิดกล้อง");

    state.cameraPromise = (async () => {
      try {
        await waitForScene();
        const arSystem = elements.scene.systems["mindar-image-system"];
        if (!arSystem) throw new Error("ไม่พบระบบ MindAR");
        await arSystem.start();
        state.arStarted = true;
        elements.loadingLayer.hidden = true;
        elements.welcome.hidden = state.entered;
        setTrackingStatus("กำลังค้นหาโปสการ์ด");
      } catch (error) {
        state.arStarted = false;
        elements.loadingLayer.hidden = true;
        elements.welcome.hidden = true;
        elements.cameraError.hidden = false;
        elements.cameraErrorMessage.textContent = cameraErrorText(error);
        setTrackingStatus("เปิดกล้องไม่สำเร็จ", "error");
        console.error(error);
      } finally {
        state.cameraPromise = null;
      }
    })();

    return state.cameraPromise;
  };

  const hideCard = (card) => {
    card.anchor.setAttribute("visible", false);
    card.stage.emit("stage-hide", null, false);
    card.character.emit("character-hide", null, false);
  };

  const audioCharacter = () => cards.find((card) => card.id === state.audioCard)?.character;

  const selectAudio = (card) => {
    const nextId = card.hasAudio ? card.id : null;
    if (state.audioCard === nextId) return;
    const previous = audioCharacter();
    elements.storyAudio.pause();
    previous?.emit("story-pause", null, false);
    state.audioCard = nextId;
    state.audioEnded = false;
    elements.storyAudio.currentTime = 0;
    setAudioButton("ready");
    if (card.hasAudio) elements.storyAudio.src = card.audio;
  };

  const showDetectedTarget = () => {
    const card = cards.find((item) => item.id === state.activeCard && item.found);
    if (!card) return;
    cards.filter((item) => item !== card).forEach(hideCard);
    selectAudio(card);
    elements.experience.classList.add("target-found");
    elements.audioButton.hidden = !card.hasAudio;
    setTrackingStatus("เจอแล้ว", "found");
    card.anchor.setAttribute("visible", true);
    card.stage.emit("stage-show", null, false);
    card.character.emit("idle-start", null, false);
  };

  const hideStage = () => cards.forEach(hideCard);

  const enterExperience = async () => {
    state.entered = true;
    document.body.classList.add("is-scanning");
    elements.welcome.hidden = true;
    await prepareCamera();
    if (state.targetFound) {
      showDetectedTarget();
    }
  };

  const stopAR = async () => {
    if (state.arStarted && elements.scene.systems["mindar-image-system"]) {
      await elements.scene.systems["mindar-image-system"].stop();
    }
    state.arStarted = false;
    state.targetFound = false;
    state.activeCard = null;
    cards.forEach((card) => { card.found = false; });
    hideStage();
    elements.experience.classList.remove("target-found");
  };

  const returnHome = async () => {
    elements.storyAudio.pause();
    elements.storyAudio.currentTime = 0;
    state.audioEnded = false;
    state.entered = false;
    setAudioButton("ready");
    document.body.classList.remove("is-scanning");
    elements.experience.classList.remove("target-found");
    elements.targetAnchor.setAttribute("visible", false);
    hideStage();
    elements.audioButton.hidden = true;
    elements.welcome.hidden = false;
  };

  const onTargetFound = (card) => {
    card.found = true;
    state.targetFound = true;
    state.activeCard = card.id;
    if (!state.entered) { hideCard(card); return; }
    showDetectedTarget();
  };

  const onTargetLost = (card) => {
    card.found = false;
    hideCard(card);
    state.targetFound = cards.some((item) => item.found);
    // A late lost event from another target must not hide the current card.
    if (state.activeCard !== card.id) return;
    const remaining = cards.find((item) => item.found);
    state.activeCard = remaining?.id || null;
    if (remaining && state.entered) { showDetectedTarget(); return; }
    elements.experience.classList.remove("target-found");
    elements.audioButton.hidden = true;
    if (state.entered) setTrackingStatus("กำลังค้นหาโปสการ์ด");
  };

  const toggleStory = async () => {
    const card = cards.find((item) => item.id === state.activeCard && item.found);
    if (!card?.hasAudio || state.audioCard !== card.id) return;
    if (!elements.storyAudio.paused) {
      elements.storyAudio.pause();
      return;
    }

    if (state.audioEnded) {
      elements.storyAudio.currentTime = 0;
      state.audioEnded = false;
    }

    try {
      await elements.storyAudio.play();
    } catch (error) {
      if (state.activeCard === card.id && state.audioCard === card.id) setTrackingStatus("แตะปุ่มเสียงอีกครั้ง", "error");
    }
  };

  const cacheElements = () => {
    Object.assign(elements, {
      welcome: byId("welcome-screen"),
      experience: byId("experience"),
      scene: byId("ar-scene"),
      targetAnchor: byId("target-anchor"),
      postcardStage: byId("postcard-stage"),
      characterWrapper: byId("character-wrapper"),
      arCharacter: byId("ar-character"),
      trackingStatus: byId("tracking-status"),
      trackingDot: byId("tracking-dot"),
      loadingLayer: byId("loading-layer"),
      cameraError: byId("camera-error"),
      cameraErrorMessage: byId("camera-error-message"),
      storyAudio: byId("story-audio"),
      audioButton: byId("audio-button"),
      audioIcon: byId("audio-icon"),
      audioLabel: byId("audio-label"),
    });
    cards.push(
      { id: "PTK-001", anchor: elements.targetAnchor, stage: elements.postcardStage, character: elements.arCharacter, hasAudio: true, audio: "assets/PTK-001-assets/PTK-001-รู้จักผีตาโขน.mp3", found: false },
      { id: "PTK-002", anchor: byId("ptk002-anchor"), stage: byId("ptk002-stage"), character: byId("ptk002-character"), hasAudio: true, audio: "assets/PTK-002-assets/PTK-002-เรื่องเล่า ความเชื่อ.mp3", found: false },
      { id: "PTK-003", anchor: byId("ptk003-anchor"), stage: byId("ptk003-content"), character: byId("ptk003-character"), hasAudio: true, audio: "assets/PTK-003-assets/PTK-003-ผีตาโขนใหญ่.mp3", found: false },
      { id: "PTK-004", anchor: byId("ptk004-anchor"), stage: byId("ptk004-content"), character: byId("ptk004-character"), hasAudio: true, audio: "assets/PTK-004-assets/PTK-004-องค์ประกอบหน้ากากผีตาโขน.mp3", found: false },
      { id: "PTK-005", anchor: byId("ptk005-anchor"), stage: byId("ptk005-content"), character: byId("ptk005-character"), hasAudio: true, audio: "assets/PTK-005-assets/PTK-005-ขั้นตอนการทำหน้ากาก.mp3", found: false },
    );
  };

  const bindEvents = () => {
    byId("start-ar-button").addEventListener("click", enterExperience);
    byId("retry-button").addEventListener("click", prepareCamera);
    byId("stop-button").addEventListener("click", returnHome);
    cards.forEach((card) => {
      card.anchor.addEventListener("targetFound", () => onTargetFound(card));
      card.anchor.addEventListener("targetLost", () => onTargetLost(card));
    });
    elements.audioButton.addEventListener("click", toggleStory);

    elements.storyAudio.addEventListener("play", () => {
      setAudioButton("playing");
      audioCharacter()?.emit("story-play", null, false);
    });
    elements.storyAudio.addEventListener("pause", () => {
      if (!state.audioEnded) {
        setAudioButton(elements.storyAudio.currentTime > 0 ? "paused" : "ready");
      }
      audioCharacter()?.emit("story-pause", null, false);
    });
    elements.storyAudio.addEventListener("ended", () => {
      // A queued ended event from a replaced source must not mark the new story ended.
      if (elements.storyAudio.ended === false) return;
      state.audioEnded = true;
      setAudioButton("ended");
      audioCharacter()?.emit("story-pause", null, false);
    });
    elements.storyAudio.addEventListener("error", () => {
      setTrackingStatus("โหลดเสียงไม่สำเร็จ", "error");
    });

    window.addEventListener("pagehide", () => {
      elements.storyAudio.pause();
      stopAR();
    });
  };

  const init = () => {
    cacheElements();
    bindEvents();
    setAudioButton("ready");
    hideStage();
    prepareCamera();
  };

  document.addEventListener("DOMContentLoaded", init);
})();
