
const express = require("express");
const cors = require("cors");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.APP_ORIGIN || false
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024
  }
});

// Vérifier que le serveur fonctionne
app.get("/", (req, res) => {
  res.json({
    app: "XIDATA VOICE",
    status: "Serveur opérationnel"
  });
});

// Envoyer un audio vers Auphonic
app.post("/api/process", upload.single("audio"), async (req, res) => {
  try {
    const apiKey = process.env.AUPHONIC_API_KEY;
    const preset = process.env.AUPHONIC_PRESET;

    if (!apiKey || !preset) {
      return res.status(500).json({
        error: "Configuration Auphonic incomplète."
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "Aucun fichier audio reçu."
      });
    }

    if (!req.file.mimetype.startsWith("audio/")) {
      return res.status(400).json({
        error: "Format audio non accepté."
      });
    }

    const form = new FormData();

    form.append("preset", preset);
    form.append("title", req.file.originalname);
    form.append(
      "input_file",
      new Blob([req.file.buffer], {
        type: req.file.mimetype
      }),
      req.file.originalname
    );
    form.append("action", "start");

    const response = await fetch(
      "https://auphonic.com/api/simple/productions.json",
      {
        method: "POST",
        headers: {
          Authorization: `bearer ${apiKey}`
        },
        body: form
      }
    );

    const result = await response.json();

    if (!response.ok || result.status_code !== 200) {
      console.error("Erreur Auphonic :", result);
      return res.status(502).json({
        error: "Le traitement Auphonic a échoué."
      });
    }

    res.json({
      success: true,
      message: "Traitement lancé.",
      uuid: result.data.uuid
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Erreur interne du serveur."
    });
  }
});

app.listen(PORT, () => {
  console.log(`XIDATA VOICE démarré sur le port ${PORT}`);
});
