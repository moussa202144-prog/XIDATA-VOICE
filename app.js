
const XidVideo = (() => {
  "use strict";

  let currentVideoUrl = null;
  let currentVideoFile = null;

  function loadVideo(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("video/")) {
        reject(new Error("Veuillez sélectionner une vidéo valide."));
        return;
      }

      if (currentVideoUrl) {
        URL.revokeObjectURL(currentVideoUrl);
      }

      currentVideoFile = file;
      currentVideoUrl = URL.createObjectURL(file);

      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = currentVideoUrl;

      video.onloadedmetadata = () => {
        resolve({
          name: file.name,
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          url: currentVideoUrl
        });
      };

      video.onerror = () => {
        reject(new Error("Impossible de lire cette vidéo."));
      };
    });
  }

  async function extractAudio(file) {
    if (!file) {
      throw new Error("Aucune vidéo sélectionnée.");
    }

    const audioContext = new (
      window.AudioContext || window.webkitAudioContext
    )();

    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      return audioBuffer;
    } catch (error) {
      throw new Error(
        "Extraction audio impossible avec ce format vidéo. " +
        "Un décodeur vidéo supplémentaire sera nécessaire."
      );
    } finally {
      await audioContext.close();
    }
  }

  function getCurrentVideo() {
    return currentVideoFile;
  }

  function getVideoUrl() {
    return currentVideoUrl;
  }

  return {
    loadVideo,
    extractAudio,
    getCurrentVideo,
    getVideoUrl
  };
})();
