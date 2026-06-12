const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();

app.use(cors());
app.use(express.json());

const upload = multer({
    storage: multer.memoryStorage()
});

const PORT = process.env.PORT || 10000;

// =======================================
// ROOT ROUTE
// =======================================

app.get('/', (req, res) => {
    res.send("Plant Disease Backend Running");
});

// =======================================
// FAKE AI DATABASE
// =======================================

const diseases = [

    {
        plantName: "Tomato",
        diseaseName: "Bacterial Spot",
        confidence: 94.2
    },

    {
        plantName: "Potato",
        diseaseName: "Early Blight",
        confidence: 91.5
    },

    {
        plantName: "Tomato",
        diseaseName: "Late Blight",
        confidence: 96.8
    },

    {
        plantName: "Apple",
        diseaseName: "Apple Scab",
        confidence: 93.1
    },

    {
        plantName: "Corn",
        diseaseName: "Common Rust",
        confidence: 92.7
    },

    {
        plantName: "Grape",
        diseaseName: "Black Rot",
        confidence: 95.4
    },

    {
        plantName: "Pepper",
        diseaseName: "Leaf Spot",
        confidence: 90.6
    },

    {
        plantName: "Strawberry",
        diseaseName: "Leaf Scorch",
        confidence: 94.9
    },

    {
        plantName: "Soybean",
        diseaseName: "Healthy",
        confidence: 98.1
    }

];

// =======================================
// DIAGNOSIS ROUTE
// =======================================

app.post('/api/diagnose', upload.single('plantImage'), async (req, res) => {

    try {

        console.log("REQUEST RECEIVED");

        if (!req.file) {

            return res.status(400).json({
                error: "No image uploaded"
            });
        }

        // =======================================
        // RANDOM DISEASE GENERATOR
        // =======================================

        const randomIndex = Math.floor(
            Math.random() * diseases.length
        );

        const randomDisease = diseases[randomIndex];

        console.log("Generated Result:");
        console.log(randomDisease);

        // Fake delay for realism
        await new Promise(resolve =>
            setTimeout(resolve, 2000)
        );

        return res.json({
            plantName: randomDisease.plantName,
            diseaseName: randomDisease.diseaseName,
            confidence: randomDisease.confidence
        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            error: "Internal server error"
        });
    }
});

// =======================================
// START SERVER
// =======================================

app.listen(PORT, () => {

    console.log(`Server running on port ${PORT}`);

});
