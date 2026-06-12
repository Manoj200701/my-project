const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');

require('dotenv').config();

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

const upload = multer({
    storage: multer.memoryStorage()
});

const PORT = process.env.PORT || 10000;
const HF_TOKEN = process.env.HF_TOKEN;

// ===============================
// API ROUTE
// ===============================

app.post('/api/diagnose', upload.single('plantImage'), async (req, res) => {

    try {

        // Check image exists
        if (!req.file) {
            return res.status(400).json({
                error: "No image uploaded"
            });
        }

        // Check HF token
        if (!HF_TOKEN) {
            return res.status(500).json({
                error: "HF_TOKEN missing in environment variables"
            });
        }

        console.log("Image received successfully");

        // ===============================
        // HUGGING FACE API CALL
        // ===============================

        const hfResponse = await fetch(
            "https://api-inference.huggingface.co/models/linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${HF_TOKEN}`,
                    "Content-Type": "application/octet-stream"
                },
                body: req.file.buffer
            }
        );

        // Handle API errors
        if (!hfResponse.ok) {

            const errorText = await hfResponse.text();

            console.log("HF API ERROR:", errorText);

            return res.status(500).json({
                error: "HuggingFace API failed",
                details: errorText
            });
        }

        // Parse predictions
        const modelResult = await hfResponse.json();

        console.log("FULL MODEL RESULT:");
        console.log(JSON.stringify(modelResult, null, 2));

        // Validate response
        if (!Array.isArray(modelResult) || modelResult.length === 0) {
            return res.status(500).json({
                error: "No prediction returned from model"
            });
        }

        // ===============================
        // SORT PREDICTIONS
        // ===============================

        const sortedPredictions = modelResult.sort(
            (a, b) => b.score - a.score
        );

        const bestPrediction = sortedPredictions[0];

        console.log("BEST PREDICTION:", bestPrediction);

        // Confidence check
        if (bestPrediction.score < 0.60) {

            return res.json({
                plantName: "Unknown",
                diseaseName: "Unable to detect confidently",
                confidence: bestPrediction.score
            });
        }

        // ===============================
        // PROCESS LABEL
        // ===============================

        const label = bestPrediction.label;

        let plantName = "Unknown";
        let diseaseName = "Healthy";

        // Different models return different formats
        if (label.includes("___")) {

            const splitData = label.split("___");

            plantName = splitData[0].replace(/_/g, ' ');
            diseaseName = splitData[1].replace(/_/g, ' ');

        } else if (label.includes("__")) {

            const splitData = label.split("__");

            plantName = splitData[0].replace(/_/g, ' ');
            diseaseName = splitData[1].replace(/_/g, ' ');

        } else {

            diseaseName = label.replace(/_/g, ' ');
        }

        // ===============================
        // SAVE TO DATABASE
        // ===============================

        try {

            await prisma.diagnosis.create({
                data: {
                    plantName,
                    diseaseName
                }
            });

            console.log("Saved to PostgreSQL");

        } catch (dbError) {

            console.log("Database save failed:");
            console.log(dbError.message);
        }

        // ===============================
        // SEND RESPONSE
        // ===============================

        return res.json({
            plantName,
            diseaseName,
            confidence: Number((bestPrediction.score * 100).toFixed(2)),
            predictions: sortedPredictions.slice(0, 3)
        });

    } catch (error) {

        console.log("SERVER ERROR:");
        console.log(error);

        return res.status(500).json({
            error: "Internal server error",
            details: error.message
        });
    }
});

// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {

    console.log(`Server running on port ${PORT}`);

});
