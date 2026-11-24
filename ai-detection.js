
/* =========================================
   XIDATA VOICE
   AI DETECTION - VERSION 1
========================================= */

const XidDetection = (() => {

  function analyze(buffer) {

    if (!buffer) {
      throw new Error("Aucun signal audio à analyser.");
    }

    const channel = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    const blockSize = 1024;
    const results = [];

    let sumSquares = 0;
    let peak = 0;
    let clipping = 0;
    let suspiciousClicks = 0;
    let highFrequencyEnergy = 0;
    let totalSamples = 0;

    for (let i = 0; i < channel.length; i++) {

      const sample = channel[i];
      const absolute = Math.abs(sample);

      sumSquares += sample * sample;

      if (absolute > peak) {
        peak = absolute;
      }

      if (absolute >= 0.99) {
        clipping++;
      }

      if (i > 0) {
        const difference = Math.abs(sample - channel[i - 1]);

        if (difference > 0.8) {
          suspiciousClicks++;
        }
      }

      totalSamples++;
    }

    const rms = Math.sqrt(sumSquares / totalSamples);

    const rmsDb = 20 * Math.log10(rms + 0.000001);

    // Analyse par blocs
    for (let start = 0;
         start < channel.length;
         start += blockSize) {

      let localSquares = 0;
      let count = 0;

      const end = Math.min(
        start + blockSize,
        channel.length
      );

      for (let i = start; i < end; i++) {
        localSquares += channel[i] * channel[i];
        count++;
      }

      const localRms = Math.sqrt(localSquares / count);

      if (localRms < 0.003) {
        highFrequencyEnergy++;
      }
    }

    // Résultats généraux
    results.push({
      type: "NIVEAU",
      title: "Niveau sonore",
      value: rmsDb.toFixed(1) + " dB",
      severity: rmsDb < -45 ? "warning" : "info",
      description: "Niveau moyen du signal."
    });

    // Détection de saturation
    const clippingPercent =
      clipping / totalSamples * 100;

    if (clippingPercent > 0.1) {
      results.push({
        type: "SATURATION",
        title: "Saturation possible",
        value: clippingPercent.toFixed(2) + "%",
        severity: "danger",
        description: "Des échantillons atteignent presque le niveau maximal."
      });
    }

    // Détection de variations brutales
    if (suspiciousClicks > 5) {
      results.push({
        type: "CLICS",
        title: "Transitoires suspects",
        value: suspiciousClicks,
        severity: "warning",
        description: "Des changements brusques ont été détectés. Ils peuvent correspondre à des clics ou à des consonnes."
      });
    }

    // Détection de zones silencieuses
    if (highFrequencyEnergy > 0) {
      results.push({
        type: "SILENCE",
        title: "Zones de faible niveau",
        value: highFrequencyEnergy,
        severity: "info",
        description: "Certaines parties de l'enregistrement sont très faibles."
      });
    }

    // Informations complémentaires
    results.push({
      type: "SIGNAL",
      title: "Analyse du signal",
      value: sampleRate + " Hz",
      severity: "info",
      description:
        "Durée : " +
        buffer.duration.toFixed(2) +
        " secondes."
    });

    return {
      results,
      rms,
      rmsDb,
      peak,
      sampleRate,
      duration: buffer.duration
    };
  }

  return {
    analyze
  };

})();
