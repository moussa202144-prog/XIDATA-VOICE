
/* =====================================
   XIDATA VOICE
   MOTEUR AUDIO - VERSION 1
===================================== */

const XidAudio = (() => {

  let audioContext = null;
  let originalBuffer = null;
  let processedBuffer = null;

  function createContext() {
    if (!audioContext) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      audioContext = new AudioContextClass();
    }

    return audioContext;
  }

  // Importer et décoder un fichier audio
  async function loadAudio(file) {
    const context = createContext();

    const arrayBuffer = await file.arrayBuffer();

    originalBuffer = await context.decodeAudioData(arrayBuffer);

    processedBuffer = null;

    return {
      duration: originalBuffer.duration,
      sampleRate: originalBuffer.sampleRate,
      channels: originalBuffer.numberOfChannels
    };
  }

  // Copier un AudioBuffer
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

  // Traitement audio
  async function processAudio(settings = {}) {

    if (!originalBuffer) {
      throw new Error("Aucun fichier audio chargé.");
    }

    const context = createContext();

    const noise = (settings.noise ?? 50) / 100;
    const sibilance = (settings.sibilance ?? 30) / 100;
    const click = (settings.click ?? 40) / 100;
    const wind = (settings.wind ?? 40) / 100;
    const reverb = (settings.reverb ?? 30) / 100;

    const offline = new OfflineAudioContext(
      originalBuffer.numberOfChannels,
      originalBuffer.length,
      originalBuffer.sampleRate
    );

    const source = offline.createBufferSource();
    source.buffer = originalBuffer;

    // Filtre passe-haut
    const highPass = offline.createBiquadFilter();
    highPass.type = "highpass";
    highPass.frequency.value =
      20 + (wind * 130) + (noise * 40);

    highPass.Q.value = 0.707;

    // Réduction douce des fréquences sifflantes
    const deEsser = offline.createBiquadFilter();
    deEsser.type = "peaking";
    deEsser.frequency.value = 6500;
    deEsser.Q.value = 1.2;
    deEsser.gain.value = -sibilance * 5;

    // Égalisation de présence
    const presence = offline.createBiquadFilter();
    presence.type = "peaking";
    presence.frequency.value = 2800;
    presence.Q.value = 0.8;
    presence.gain.value = 1.5;

    // Compression
    const compressor = offline.createDynamicsCompressor();

    compressor.threshold.value = -18;
    compressor.knee.value = 24;
    compressor.ratio.value = 2.5;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.15;

    // Réglage de sortie
    const gain = offline.createGain();
    gain.gain.value = 1;

    source.connect(highPass);
    highPass.connect(deEsser);
    deEsser.connect(presence);
    presence.connect(compressor);
    compressor.connect(gain);
    gain.connect(offline.destination);

    source.start(0);

    processedBuffer = await offline.startRendering();

    return {
      buffer: processedBuffer,
      duration: processedBuffer.duration,
      noiseReduction: noise,
      sibilanceReduction: sibilance,
      clickReduction: click,
      windReduction: wind,
      reverbReduction: reverb
    };
  }

  // Lecture d'un AudioBuffer
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

  // Conversion en WAV
  function exportWav(buffer) {

    const channels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const frames = buffer.length;

    const bytesPerSample = 2;
    const dataSize = frames * channels * bytesPerSample;

    const arrayBuffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(arrayBuffer);

    function writeString(offset, string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
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

      for (let channel = 0; channel < channels; channel++) {

        let sample = buffer.getChannelData(channel)[i];

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
