const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');

require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const HF_TOKEN = process.env.HF_TOKEN;

// Exact endpoint matching your frontend form action
app.post('/api/diagnose', upload.single('plantImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Missing leaf file download attachment form binary data." });
        }

        if (!HF_TOKEN) {
            console.error("HF_TOKEN missing in Environment Variable parameters.");
            return res.status(500).json({ error: "HuggingFace infrastructure key authentication token not configured." });
        }

        // Calling the official Hugging Face Plant Disease Classification model pipeline
        const hfResponse = await fetch(
            "https://api-inference.huggingface.co/models/chb9/plant-disease-classification",
            {
                headers: { 
                    Authorization: `Bearer ${HF_TOKEN}`,
                    "Content-Type": "application/octet-stream"
                },
                method: "POST",
                body: req.file.buffer,
            }
        );

        if (!hfResponse.ok) {
            const errText = await hfResponse.text();
            throw new Error(`HuggingFace API service exception returned: ${errText}`);
        }

        const modelResult = await hfResponse.json();
        
        if (!modelResult || modelResult.length === 0) {
            throw new Error("Empty inference token response array received from machine learning model.");
        }

        // Top match label classification extraction (e.g. "Tomato___Bacterial_spot")
        const highestMatchLabel = modelResult[0].label;
        console.log("Model RAW class string detected:", highestMatchLabel);

        // Splitting into structural variables based on your exact backend model schema logic
        let plantName = "Tomato";
        let diseaseName = "Healthy";

        if (highestMatchLabel.includes("___")) {
            const partitions = highestMatchLabel.split("___");
            plantName = partitions[0].replace(/_/g, ' ');
            diseaseName = partitions[1].replace(/_/g, ' ');
        } else {
            plantName = highestMatchLabel.replace(/_/g, ' ');
        }

        // Log transaction metrics securely directly into your live PostgreSQL database using Prisma Client
        try {
            await prisma.diagnosis.create({
                data: {
                    plantName: plantName,
                    diseaseName: diseaseName
                }
            });
            console.log("Database transaction log saved successfully to PostgreSQL via Prisma.");
        } catch (dbError) {
            console.error("PostgreSQL tracking sync error caught safely:", dbError.message);
            // Non-blocking database catch layout keeps operational flows live even if connection is faulty
        }

        // Send backend data structure back matching frontend parsing engine requirements precisely
        return res.json({
            plantName: plantName,
            diseaseName: diseaseName
        });

    } catch (pipelineException) {
        console.error("Inference processing layer crashed:", pipelineException);
        return res.status(500).json({ error: "Internal processing engine block failure.", details: pipelineException.message });
    }
});

// Primary Server Boot Diagnostic Matrix
app.listen(PORT, () => {
    console.log(`Backend Application Online. Running on deployment port structure: ${PORT}`);
});
