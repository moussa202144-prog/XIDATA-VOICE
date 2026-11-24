
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

    
    // Traitement audio avec Auphonic
    processBtn?.addEventListener("click", async () => {
      try {
        if (!currentFile) {
          throw new Error("Importe d'abord un fichier audio.");
        }

        processBtn.disabled = true;
        processedBlob = null;

        if (processStatus) {
          processStatus.textContent = "Connexion au serveur...";
        }

        setProgress(10);

        const formData = new FormData();
        formData.append("audio", currentFile);

        const uploadResponse = await fetch(
          SERVER_URL + "/api/process",
          {
            method: "POST",
            body: formData
          }
        );

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || "Erreur d'envoi.");
        }

        const uploadData = await uploadResponse.json();

        if (!uploadData.uuid) {
          throw new Error("Identifiant de traitement absent.");
        }

        if (processStatus) {
          processStatus.textContent =
            "Auphonic traite ton fichier audio...";
        }

        let completed = false;

        for (let attempt = 0; attempt < 120; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 5000));

          const statusResponse = await fetch(
            SERVER_URL + "/api/status/" +
            encodeURIComponent(uploadData.uuid)
          );

          if (!statusResponse.ok) {
            throw new Error("Impossible de vérifier le traitement.");
          }

          const statusData = await statusResponse.json();

          setProgress(
            Math.min(85, 15 + Math.floor(attempt * 70 / 120))
          );

          if (statusData.error) {
            throw new Error(statusData.error);
          }

          if (statusData.ready) {
            completed = true;
            break;
          }

          if (processStatus) {
            processStatus.textContent =
              "Traitement en cours... " +
              (statusData.statusText || "");
          }
        }

        if (!completed) {
          throw new Error(
            "Le traitement prend trop de temps. Réessaie plus tard."
          );
        }

        if (processStatus) {
          processStatus.textContent =
            "Récupération du fichier nettoyé...";
        }

        const resultResponse = await fetch(
          SERVER_URL + "/api/result/" +
          encodeURIComponent(uploadData.uuid)
        );

        if (!resultResponse.ok) {
          throw new Error("Impossible de récupérer le résultat.");
        }

        processedBlob = await resultResponse.blob();

        const disposition =
          resultResponse.headers.get("Content-Disposition") || "";

        const filenameMatch = disposition.match(/filename="([^"]+)"/);

        processedFileName = filenameMatch
          ? filenameMatch[1]
          : "XIDATA-VOICE-resultat.mp3";

        if (processedUrl) {
          URL.revokeObjectURL(processedUrl);
        }

        processedUrl = URL.createObjectURL(processedBlob);

        if (processedPlayer) {
          processedPlayer.src = processedUrl;
          processedPlayer.hidden = false;
        }

        setProgress(100);

        if (processStatus) {
          processStatus.textContent =
            "Nettoyage terminé ! Écoute le résultat.";
        }

      } catch (error) {
        console.error(error);

        if (processStatus) {
          processStatus.textContent =
            "Erreur : " + error.message;
        }

      } finally {
        processBtn.disabled = false;
      }
    });


    
    // Exportation audio traité par Auphonic
    exportAudioBtn?.addEventListener("click", () => {
      try {
        if (!processedBlob) {
          throw new Error(
            "Effectue d'abord le traitement audio."
          );
        }

        const url = URL.createObjectURL(processedBlob);

        const link = document.createElement("a");
        link.href = url;
        link.download = processedFileName;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 30000);

        if (exportStatus) {
          exportStatus.textContent =
            "Téléchargement du fichier traité lancé.";
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
