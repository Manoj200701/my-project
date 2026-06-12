const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const app = express();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// HuggingFace Computer Vision Model Integration
const HF_API_URL = "https://api-inference.huggingface.co/models/kero2111/Plant_Disease";
const HF_TOKEN = process.env.HF_TOKEN; 

app.post('/api/diagnose', upload.single('plantImage'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });

    // 1. Call Hugging Face API
    const hfResponse = await axios.post(HF_API_URL, req.file.buffer, {
      headers: { 
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/octet-stream"
      }
    });

    const topPrediction = hfResponse.data[0];
    if (!topPrediction) throw new Error("Model processing failed");

    // Parse the output string format (e.g., "Tomato___Early_blight")
    const rawLabel = topPrediction.label;
    const [plantName, rawDisease] = rawLabel.split('___');
    const diseaseName = rawDisease ? rawDisease.replace(/_/g, ' ') : "Healthy";

    // 2. Reference mappings for precise diagnostic metrics
    const treatmentBook = {
      "Early blight": {
        symptoms: ["Dark spots with concentric rings on older leaves", "Yellowing surrounding leaf spots"],
        treatment: "Apply copper-based fungicides early in the season. Prune lower branches to improve airflow."
      },
      "Healthy": {
        symptoms: ["No visual lesions identified", "Uniform green color, robust leaf structure vigor"],
        treatment: "Maintain structural watering schedules. Keep checking leaves weekly for anomalies."
      }
    };

    const details = treatmentBook[diseaseName] || {
      symptoms: ["Irregular discoloration or spots spotted on sample foliage"],
      treatment: "Isolate the crop. Inspect for pest indicators and consult regional agricultural extension extensions."
    };

    const payload = {
      plantName: plantName.replace(/_/g, ' '),
      disease: diseaseName,
      confidence: Math.round(topPrediction.score * 100),
      symptoms: details.symptoms,
      treatment: details.treatment
    };

    // 3. Log query event history record directly to PostgreSQL database
    await prisma.scanRecord.create({
      data: {
        plant: payload.plantName,
        disease: payload.disease,
        confidence: payload.confidence
      }
    });

    return res.json(payload);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'AI classification runtime failure' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server executing on port ${PORT}`));