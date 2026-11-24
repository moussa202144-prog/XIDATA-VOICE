
/* =========================================
   XIDATA VOICE
   APPLICATION PRINCIPALE - VERSION 2
========================================= */

(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {

    const $ = id => document.getElementById(id);

    // Éléments principaux
    const audioInput = $("audioInput");
    const videoInput = $("videoInput");
    const fileName = $("fileName");
    const audioPlayer = $("audioPlayer");
    const videoPlayer = $("videoPlayer");
    const originalPlayer = $("originalPlayer");
    const processedPlayer = $("processedPlayer");

    const autoMode = $("autoMode");
    const manualMode = $("manualMode");
    const analyzeBtn = $("analyzeBtn");
    const analysisStatus = $("analysisStatus");
    const progressBar = $("progressBar");
    const detectionResults = $("detectionResults");

    const processBtn = $("processBtn");
    const processStatus = $("processStatus");

    const exportAudioBtn = $("exportAudioBtn");
    const exportVideoBtn = $("exportVideoBtn");
    const exportStatus = $("exportStatus");

    let currentFile = null;
    let currentMode = "auto";
    let analysisData = null;
    let originalUrl = null;
    let processedUrl = null;
    let processedBlob = null;
    let processedFileName = "XIDATA-VOICE-resultat.mp3";

    const SERVER_URL = "https://xidata-voice-server.onrender.com";

    // Vérifier les moteurs
    if (typeof XidAudio === "undefined") {
      console.error("Moteur audio introuvable.");
      if (analysisStatus) {
        analysisStatus.textContent =
          "Erreur : audio-engine.js ne se charge pas.";
      }
      return;
    }

    if (typeof XidDetection === "undefined") {
      console.error("Moteur d'analyse introuvable.");
    }

    // Afficher les résultats sans interpréter du HTML
    function showResults(data) {

      if (!detectionResults) return;

      detectionResults.replaceChildren();

      data.results.forEach(result => {

        const item = document.createElement("div");
        item.className = "detection-item";

        const title = document.createElement("h4");
        title.textContent = result.title;

        const value = document.createElement("strong");
        value.textContent = result.value;

        const description = document.createElement("p");
        description.textContent = result.description;

        item.append(title, value, description);

        detectionResults.appendChild(item);
      });
    }

    // Barre de progression
    function setProgress(value) {
      if (!progressBar) return;

      if ("value" in progressBar) {
        progressBar.value = value;
      }

      progressBar.style.width = value + "%";
    }

    // Gestion des modes
    function selectMode(mode) {

      currentMode = mode;

      if (autoMode) {
        autoMode.classList.toggle("active", mode === "auto");
      }

      if (manualMode) {
        manualMode.classList.toggle("active", mode === "manual");
      }

      if (analysisStatus) {
        analysisStatus.textContent =
          mode === "auto"
            ? "Mode automatique sélectionné."
            : "Mode manuel sélectionné.";
      }
    }

    autoMode?.addEventListener("click", () => {
      selectMode("auto");
    });

    manualMode?.addEventListener("click", () => {
      selectMode("manual");
    });

    // Gestion des curseurs
    const sliderNames = [
      "noise",
      "sibilance",
      "click",
      "wind",
      "reverb"
    ];

    sliderNames.forEach(name => {

      const slider = $(name + "Level");
      const output = $(name + "Value");

      if (!slider) return;

      if (output) {
        output.textContent = slider.value + "%";
      }

      slider.addEventListener("input", () => {
        if (output) {
          output.textContent = slider.value + "%";
        }

        if (currentMode === "auto") {
          selectMode("manual");
        }
      });
    });

    // Paramètres de traitement
    function getSettings() {

      if (currentMode === "auto") {
        return {
          noise: 35,
          sibilance: 25,
          click: 15,
          wind: 20,
          reverb: 10
        };
      }

      return {
        noise: Number($("noiseLevel")?.value ?? 50),
        sibilance: Number($("sibilanceLevel")?.value ?? 30),
        click: Number($("clickLevel")?.value ?? 40),
        wind: Number($("windLevel")?.value ?? 40),
        reverb: Number($("reverbLevel")?.value ?? 30)
      };
    }

    // Importation audio
    audioInput?.addEventListener("change", async event => {

      const file = event.target.files?.[0];

      if (!file) return;

      currentFile = file;

      if (fileName) {
        fileName.textContent = file.name;
      }

      if (analysisStatus) {
        analysisStatus.textContent = "Chargement du fichier...";
      }

      try {

        const info = await XidAudio.loadAudio(file);

        if (originalUrl) {
          URL.revokeObjectURL(originalUrl);
        }

        originalUrl = URL.createObjectURL(file);

        if (audioPlayer) {
          audioPlayer.src = originalUrl;
          audioPlayer.hidden = false;
        }

        if (originalPlayer) {
          originalPlayer.src = originalUrl;
          originalPlayer.hidden = false;
        }

        if (processedPlayer) {
          processedPlayer.removeAttribute("src");
        }

        analysisData = null;

        if (detectionResults) {
          detectionResults.textContent =
            "Les résultats apparaîtront ici.";
        }

        setProgress(0);

        if (analysisStatus) {
          analysisStatus.textContent =
            "Fichier importé avec succès : " + file.name +
            " (" + info.duration.toFixed(1) + " secondes)";
        }

        if (processStatus) {
          processStatus.textContent =
            "Fichier prêt pour le traitement.";
        }

      } catch (error) {

        console.error(error);

        if (analysisStatus) {
          analysisStatus.textContent =
            "Erreur de chargement : " + error.message;
        }
      }
    });

    // Importation vidéo : aperçu uniquement
    videoInput?.addEventListener("change", async event => {

      const file = event.target.files?.[0];

      if (!file) return;

      try {

        if (typeof XidVideo === "undefined") {
          throw new Error("Le moteur vidéo est introuvable.");
        }

        const info = await XidVideo.loadVideo(file);

        if (videoPlayer) {
          videoPlayer.src = info.url;
          videoPlayer.hidden = false;
        }

        if (analysisStatus) {
          analysisStatus.textContent =
            "Vidéo importée : " + file.name +
            ". L'aperçu est disponible.";
        }

      } catch (error) {

        console.error(error);

        if (analysisStatus) {
          analysisStatus.textContent =
            "Erreur vidéo : " + error.message;
        }
      }
    });

    // Analyse du son
    analyzeBtn?.addEventListener("click", async () => {

      try {

        const buffer = XidAudio.getOriginalBuffer();

        if (!buffer) {
          throw new Error("Importe d'abord un fichier audio.");
        }

        if (typeof XidDetection === "undefined") {
          throw new Error("Le moteur d'analyse est introuvable.");
        }

        analyzeBtn.disabled = true;

        if (analysisStatus) {
          analysisStatus.textContent =
            "Analyse du signal audio en cours...";
        }

        setProgress(30);

        await new Promise(resolve => setTimeout(resolve, 100));

        analysisData = XidDetection.analyze(buffer);

        setProgress(100);

        showResults(analysisData);

        if (analysisStatus) {
          analysisStatus.textContent =
            "Analyse terminée avec succès.";
        }

      } catch (error) {

        console.error(error);

        if (analysisStatus) {
          analysisStatus.textContent =
            "Erreur d'analyse : " + error.message;
        }

      } finally {
        analyzeBtn.disabled = false;
      }
    });

    // Traitement audio
    processBtn?.addEventListener("click", async () => {

      try {

        if (!XidAudio.getOriginalBuffer()) {
          throw new Error("Importe d'abord un fichier audio.");
        }

        processBtn.disabled = true;

        if (processStatus) {
          processStatus.textContent =
            "Traitement audio en cours...";
        }

        setProgress(20);

        const result = await XidAudio.processAudio(
          getSettings()
        );

        setProgress(100);

        if (processedUrl) {
          URL.revokeObjectURL(processedUrl);
        }

        const blob = XidAudio.exportWav(result.buffer);

        processedUrl = URL.createObjectURL(blob);

        if (processedPlayer) {
          processedPlayer.src = processedUrl;
          processedPlayer.hidden = false;
        }

        if (processStatus) {
          processStatus.textContent =
            "Traitement terminé. Écoute le résultat.";
        }

      } catch (error) {

        console.error(error);

        if (processStatus) {
          processStatus.textContent =
            "Erreur de traitement : " + error.message;
        }

      } finally {
        processBtn.disabled = false;
      }
    });

    // Exportation audio
    exportAudioBtn?.addEventListener("click", () => {

      try {

        const buffer = XidAudio.getProcessedBuffer();

        if (!buffer) {
          throw new Error(
            "Effectue d'abord le traitement audio."
          );
        }

        const blob = XidAudio.exportWav(buffer);
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = "XIDATA-VOICE-resultat.wav";

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 30000);

        if (exportStatus) {
          exportStatus.textContent =
            "Exportation WAV lancée.";
        }

      } catch (error) {

        if (exportStatus) {
          exportStatus.textContent = error.message;
        }
      }
    });

    // Exportation vidéo : fonction à développer
    exportVideoBtn?.addEventListener("click", () => {

      if (exportStatus) {
        exportStatus.textContent =
          "L'exportation vidéo avec audio traité sera ajoutée dans une prochaine étape.";
      }
    });

    selectMode("auto");

    console.log("XIDATA VOICE : application initialisée.");

  });

})();
