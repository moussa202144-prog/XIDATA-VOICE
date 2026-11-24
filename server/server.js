
const express = require("express");
const cors = require("cors");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);

app.use(cors({
  origin: process.env.APP_ORIGIN || true
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024
  }
});

// Limitation simple des demandes par adresse IP
const requests = new Map();

function limitRequests(max, windowMs) {
  return (req, res, next) => {
    const ip = req.ip || "unknown";
    const now = Date.now();
    let entry = requests.get(ip);

    if (!entry || now - entry.start > windowMs) {
      entry = { start: now, count: 0 };
    }

    entry.count++;
    requests.set(ip, entry);

    if (entry.count > max) {
      return res.status(429).json({
        error: "Trop de demandes. Réessaie plus tard."
      });
    }

    next();
  };
}

function getConfig() {
  const apiKey = process.env.AUPHONIC_API_KEY;
  const preset = process.env.AUPHONIC_PRESET;

  if (!apiKey || !preset) {
    throw new Error("Configuration Auphonic incomplète.");
  }

  return { apiKey, preset };
}

async function getProduction(uuid) {
  const { apiKey } = getConfig();

  if (!/^[a-zA-Z0-9]{22}$/.test(uuid)) {
    throw new Error("Identifiant de traitement invalide.");
  }

  const response = await fetch(
    `https://auphonic.com/api/production/${uuid}.json`,
    {
      headers: {
        Authorization: `bearer ${apiKey}`
      }
    }
  );

  const result = await response.json();

  if (!response.ok || result.status_code !== 200 || !result.data) {
    throw new Error("Impossible de récupérer le traitement Auphonic.");
  }

  return result.data;
}

// Vérifier le serveur
app.get("/", (req, res) => {
  res.json({
    app: "XIDATA VOICE",
    status: "Serveur opérationnel"
  });
});

// Envoyer un audio vers Auphonic
app.post(
  "/api/process",
  limitRequests(3, 60 * 60 * 1000),
  upload.single("audio"),
  async (req, res) => {
    try {
      const { apiKey, preset } = getConfig();

      if (!req.file) {
        return res.status(400).json({
          error: "Aucun fichier audio reçu."
        });
      }

      const isAudio = req.file.mimetype.startsWith("audio/");
      const isOgg = req.file.mimetype === "application/ogg";

      if (!isAudio && !isOgg) {
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
        error: error.message || "Erreur interne du serveur."
      });
    }
  }
);

// Vérifier l'avancement du traitement
app.get(
  "/api/status/:uuid",
  limitRequests(40, 10 * 60 * 1000),
  async (req, res) => {
    try {
      const data = await getProduction(req.params.uuid);

      res.json({
        success: true,
        uuid: data.uuid,
        status: data.status,
        statusText: data.status_string,
        ready: data.status === 3,
        error: data.error_message || null
      });

    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

// Télécharger le résultat audio
app.get(
  "/api/result/:uuid",
  limitRequests(10, 10 * 60 * 1000),
  async (req, res) => {
    try {
      const { apiKey } = getConfig();
      const data = await getProduction(req.params.uuid);

      if (data.status !== 3) {
        return res.status(409).json({
          error: "Le traitement audio n'est pas encore terminé."
        });
      }

      const files = data.output_files || [];

      const audioFile =
        files.find(file => file.format === "mp3" && file.download_url) ||
        files.find(file => file.format !== "video" && file.download_url);

      if (!audioFile) {
        return res.status(404).json({
          error: "Aucun fichier audio final disponible."
        });
      }

      const downloadUrl = new URL(audioFile.download_url);

      if (downloadUrl.hostname !== "auphonic.com") {
        return res.status(400).json({
          error: "Adresse de téléchargement non autorisée."
        });
      }

      const response = await fetch(downloadUrl, {
        headers: {
          Authorization: `bearer ${apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error("Impossible de télécharger le fichier final.");
      }

      const safeName = String(audioFile.filename || "xidata-voice.mp3")
        .replace(/[^a-zA-Z0-9._-]/g, "_");

      res.setHeader(
        "Content-Type",
        response.headers.get("content-type") || "application/octet-stream"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeName}"`
      );

      const fileBuffer = Buffer.from(await response.arrayBuffer());
      res.send(fileBuffer);

    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: error.message || "Erreur de téléchargement."
      });
    }
  }
);

app.listen(PORT, () => {
  console.log(`XIDATA VOICE démarré sur le port ${PORT}`);
});
