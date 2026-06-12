const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fetch = require('node-fetch');
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

// ========================================
// ROOT ROUTE
// ========================================

app.get('/', (req, res) => {
    res.send('Plant Disease Backend Running');
});

// ========================================
// DIAGNOSIS ROUTE
// ========================================

app.post('/api/diagnose', upload.single('plantImage'), async (req, res) => {

    try {

        console.log("REQUEST RECEIVED");

        // ========================================
        // CHECK IMAGE
        // ========================================

        if (!req.file) {

            return res.status(400).json({
                error: "No image uploaded"
            });
        }

        // ========================================
        // CHECK TOKEN
        // ========================================

        if (!HF_TOKEN) {

            return res.status(500).json({
                error: "HF_TOKEN missing"
            });
        }

        console.log("Image received successfully");

        // ========================================
        // HUGGINGFACE API CALL
        // ========================================

        console.log("Sending image to HuggingFace...");

        const hfResponse = await fetch(
            "https://router.huggingface.co/hf-inference/models/dima806/plant-disease-image-detection",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${HF_TOKEN}`,
                    "Content-Type": "application/octet-stream"
                },
                body: req.file.buffer
            }
        );

        // ========================================
        // HANDLE HF API FAILURE
        // ========================================

        if (!hfResponse.ok) {

            const errorText = await hfResponse.text();

            console.log("HF API ERROR:");
            console.log(errorText);

            return res.status(500).json({
                error: "HuggingFace API failed",
                details: errorText
            });
        }

        // ========================================
        // GET RESPONSE
        // ========================================

        const modelResult = await hfResponse.json();

        console.log("HF RESPONSE RECEIVED");
        console.log(JSON.stringify(modelResult, null, 2));

        // ========================================
        // VALIDATE RESPONSE
        // ========================================

        if (!Array.isArray(modelResult) || modelResult.length === 0) {

            return res.status(500).json({
                error: "No prediction received"
            });
        }

        // ========================================
        // SORT PREDICTIONS
        // ========================================

        const sortedPredictions = modelResult.sort(
            (a, b) => b.score - a.score
        );

        const bestPrediction = sortedPredictions[0];

        console.log("BEST PREDICTION:");
        console.log(bestPrediction);

        // ========================================
        // CONFIDENCE CHECK
        // ========================================

        if (bestPrediction.score < 0.50) {

            return res.json({
                plantName: "Unknown",
                diseaseName: "Unable to detect confidently",
                confidence: Number(
                    (bestPrediction.score * 100).toFixed(2)
                )
            });
        }

        // ========================================
        // PROCESS LABEL
        // ========================================

        const label = bestPrediction.label;

        let plantName = "Unknown";
        let diseaseName = "Healthy";

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

        // ========================================
        // SAVE TO DATABASE
        // ========================================

        try {

            await prisma.diagnosis.create({
                data: {
                    plantName,
                    diseaseName
                }
            });

            console.log("Saved to PostgreSQL");

        } catch (dbError) {

            console.log("DATABASE ERROR:");
            console.log(dbError.message);
        }

        // ========================================
        // SEND FINAL RESPONSE
        // ========================================

        return res.json({
            plantName,
            diseaseName,
            confidence: Number(
                (bestPrediction.score * 100).toFixed(2)
            ),
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

// ========================================
// START SERVER
// ========================================

app.listen(PORT, () => {

    console.log(`Server running on port ${PORT}`);

});
