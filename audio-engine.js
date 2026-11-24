
/* =========================================
   XIDATA VOICE
   MOTEUR AUDIO - VERSION 2
   Nettoyage vocal adaptatif
========================================= */

const XidAudio = (() => {

  let audioContext = null;
  let originalBuffer = null;
  let processedBuffer = null;

  // Création du contexte audio
  function createContext() {

    if (!audioContext) {

      const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContextClass) {
        throw new Error("Web Audio API non disponible.");
      }

      audioContext = new AudioContextClass();
    }

    return audioContext;
  }

  // Importation audio
  async function loadAudio(file) {

    const context = createContext();
    const arrayBuffer = await file.arrayBuffer();

    originalBuffer =
      await context.decodeAudioData(arrayBuffer);

    processedBuffer = null;

    return {
      duration: originalBuffer.duration,
      sampleRate: originalBuffer.sampleRate,
      channels: originalBuffer.numberOfChannels
    };
  }

  // Copie du buffer
  function cloneBuffer(buffer) {

    const context = createContext();

    const copy = context.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    for (let channel = 0;
         channel < buffer.numberOfChannels;
         channel++) {

      copy.copyToChannel(
        buffer.getChannelData(channel),
        channel
      );
    }

    return copy;
  }

  // Estimation prudente du niveau de bruit
  function estimateNoiseFloor(data, sampleRate) {

    const windowSize = Math.max(
      256,
      Math.floor(sampleRate * 0.02)
    );

    const levels = [];

    for (let start = 0;
         start < data.length;
         start += windowSize) {

      const end = Math.min(
        start + windowSize,
        data.length
      );

      let sum = 0;

      for (let i = start; i < end; i++) {
        sum += data[i] * data[i];
      }

      const count = end - start;

      if (count > 0) {
        levels.push(Math.sqrt(sum / count));
      }
    }

    if (!levels.length) return 0.001;

    levels.sort((a, b) => a - b);

    const index = Math.floor(
      (levels.length - 1) * 0.15
    );

    return levels[index];
  }

  // Atténuation adaptative des passages faibles
  // Ce traitement est un noise gate doux,
  // pas une suppression spectrale complète.
  function applyAdaptiveGate(data, sampleRate, amount) {

    if (amount <= 0) return;

    const noiseFloor =
      estimateNoiseFloor(data, sampleRate);

    const threshold = Math.max(
      0.002,
      Math.min(0.035, noiseFloor * 2.5)
    );

    const attenuation = amount * 0.65;

    const attack = Math.exp(
      -1 / (sampleRate * 0.008)
    );

    const release = Math.exp(
      -1 / (sampleRate * 0.075)
    );

    const envelopeAttack = Math.exp(
      -1 / (sampleRate * 0.005)
    );

    const envelopeRelease = Math.exp(
      -1 / (sampleRate * 0.08)
    );

    let envelope = 0;
    let gain = 1;

    for (let i = 0; i < data.length; i++) {

      const input = Math.abs(data[i]);

      const envelopeCoefficient =
        input > envelope
          ? envelopeAttack
          : envelopeRelease;

      envelope =
        envelopeCoefficient * envelope +
        (1 - envelopeCoefficient) * input;

      let targetGain = 1;

      if (envelope < threshold) {
        targetGain = 1 - attenuation;
      }

      const coefficient =
        targetGain < gain ? attack : release;

      gain =
        coefficient * gain +
        (1 - coefficient) * targetGain;

      data[i] *= gain;
    }
  }

  // Réparation prudente des clics isolés
  function repairClicks(data, amount) {

    if (amount <= 0) return 0;

    const threshold = 0.92 - amount * 0.18;
    const tolerance = 0.06;
    let repaired = 0;

    for (let i = 1; i < data.length - 1; i++) {

      const previous = data[i - 1];
      const current = data[i];
      const next = data[i + 1];

      const expected = (previous + next) / 2;

      const difference = Math.abs(
        current - expected
      );

      const neighborsDifference = Math.abs(
        previous - next
      );

      if (
        difference > threshold &&
        neighborsDifference < tolerance
      ) {

        data[i] = expected;
        repaired++;
      }
    }

    return repaired;
  }

  // Préparation du signal
  function prepareBuffer(buffer, settings) {

    const copy = cloneBuffer(buffer);

    const noise = settings.noise / 100;
    const click = settings.click / 100;

    let repairedClicks = 0;

    for (let channel = 0;
         channel < copy.numberOfChannels;
         channel++) {

      const data = copy.getChannelData(channel);

      repairedClicks +=
        repairClicks(data, click);

      applyAdaptiveGate(
        data,
        copy.sampleRate,
        noise
      );
    }

    return {
      buffer: copy,
      repairedClicks
    };
  }

  // Traitement audio principal
  async function processAudio(settings = {}) {

    if (!originalBuffer) {
      throw new Error("Aucun fichier audio chargé.");
    }

    const noise = Math.max(
      0,
      Math.min(100, Number(settings.noise ?? 30))
    );

    const sibilance = Math.max(
      0,
      Math.min(100, Number(settings.sibilance ?? 25))
    );

    const click = Math.max(
      0,
      Math.min(100, Number(settings.click ?? 20))
    );

    const wind = Math.max(
      0,
      Math.min(100, Number(settings.wind ?? 20))
    );

    const reverb = Math.max(
      0,
      Math.min(100, Number(settings.reverb ?? 0))
    );

    const prepared = prepareBuffer(
      originalBuffer,
      { noise, click }
    );

    const OfflineContext =
      window.OfflineAudioContext ||
      window.webkitOfflineAudioContext;

    if (!OfflineContext) {
      throw new Error(
        "Le traitement audio hors ligne n'est pas disponible."
      );
    }

    const offline = new OfflineContext(
      prepared.buffer.numberOfChannels,
      prepared.buffer.length,
      prepared.buffer.sampleRate
    );

    const source = offline.createBufferSource();
    source.buffer = prepared.buffer;

    // Filtre passe-haut
    const highPass = offline.createBiquadFilter();

    highPass.type = "highpass";

    highPass.frequency.value =
      45 + wind * 0.9 + noise * 0.15;

    highPass.Q.value = 0.707;

    // Atténuation des sifflantes
    const deEsser = offline.createBiquadFilter();

    deEsser.type = "peaking";
    deEsser.frequency.value = 6500;
    deEsser.Q.value = 1.2;

    deEsser.gain.value =
      -(sibilance / 100) * 4.5;

    // Présence vocale
    const presence = offline.createBiquadFilter();

    presence.type = "peaking";
    presence.frequency.value = 3200;
    presence.Q.value = 0.8;
    presence.gain.value = 1.2;

    // Compression douce
    const compressor =
      offline.createDynamicsCompressor();

    compressor.threshold.value = -20;
    compressor.knee.value = 24;
    compressor.ratio.value = 2.5;
    compressor.attack.value = 0.008;
    compressor.release.value = 0.18;

    // Protection du niveau de sortie
    const gain = offline.createGain();
    gain.gain.value = 1;

    source.connect(highPass);
    highPass.connect(deEsser);
    deEsser.connect(presence);
    presence.connect(compressor);
    compressor.connect(gain);
    gain.connect(offline.destination);

    source.start(0);

    processedBuffer =
      await offline.startRendering();

    return {
      buffer: processedBuffer,
      duration: processedBuffer.duration,
      noiseReduction: noise,
      sibilanceReduction: sibilance,
      clickReduction: click,
      windReduction: wind,

      // Réverbération : non traitée dans cette version
      reverbReduction: 0,

      repairedClicks: prepared.repairedClicks,
      message:
        "Nettoyage adaptatif et traitement vocal terminés."
    };
  }

  // Lecture du résultat
  function playBuffer(buffer) {

    const context = createContext();

    if (context.state === "suspended") {
      context.resume();
    }

    const source = context.createBufferSource();

    source.buffer = buffer;
    source.connect(context.destination);
    source.start(0);

    return source;
  }

  // Exportation WAV
  function exportWav(buffer) {

    const channels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const frames = buffer.length;

    const bytesPerSample = 2;
    const dataSize =
      frames * channels * bytesPerSample;

    const arrayBuffer =
      new ArrayBuffer(44 + dataSize);

    const view = new DataView(arrayBuffer);

    function writeString(offset, string) {

      for (let i = 0; i < string.length; i++) {
        view.setUint8(
          offset + i,
          string.charCodeAt(i)
        );
      }
    }

    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");

    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);

    view.setUint32(
      28,
      sampleRate * channels * bytesPerSample,
      true
    );

    view.setUint16(32, channels * bytesPerSample, true);
    view.setUint16(34, 16, true);

    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    let offset = 44;

    for (let i = 0; i < frames; i++) {

      for (let channel = 0;
           channel < channels;
           channel++) {

        let sample =
          buffer.getChannelData(channel)[i];

        sample = Math.max(-1, Math.min(1, sample));

        const value = sample < 0
          ? sample * 32768
          : sample * 32767;

        view.setInt16(offset, value, true);

        offset += 2;
      }
    }

    return new Blob([arrayBuffer], {
      type: "audio/wav"
    });
  }

  function getOriginalBuffer() {
    return originalBuffer;
  }

  function getProcessedBuffer() {
    return processedBuffer;
  }

  return {
    loadAudio,
    processAudio,
    playBuffer,
    exportWav,
    getOriginalBuffer,
    getProcessedBuffer
  };

})();
