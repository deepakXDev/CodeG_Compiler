require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const runController = require('./controllers/runController');
const { errorMiddleware } = require("./middlewares/errorMiddleware"); 
const upload = require('./middlewares/upload');
const processController = require('./controllers/processController');
const {aiFeatureRequest,aiReview} = require('./controllers/AI_support');

const corsOptions = {
  origin: ["http://localhost:5173","https://codeg-backend-yh3x.onrender.com" ],
  methods: ["GET", "POST", "PUT", "DELETE"], 
  credentials: true,
};

// When your backend (Node.js) calls the compiler service via axios or fetch, it’s server-to-server, so CORS rules are ignored.
// CORS is enforced by browsers to protect users, not by servers.

const app = express();
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload()); // for file uploads

// Health check
app.get('/', (req, res) => res.send('Compiler Service Running'));


app.post('/process-submission', processController.processSubmission);

// Run route
app.post('/submission/run-sample',
  upload.fields([
    { name: "sourceCode", maxCount: 1 }, //sourceCode->fieldName in multer (file.filedName)
]), runController.runSampleTest);

app.post("/review", async (req, res) => {
    try {
        const { code , language } = req.body;
        if (!code) {
            return res.status(400).json({
                success: false,
                error: "Missing code",
            });
        }
        const reviewResult = await aiReview(code, language);
        if (reviewResult.success) {
            return res.status(200).json({
                success: true,
                review: reviewResult.review
            });
        } else {
            return res.status(500).json({
                success: false,
                error: "AI Review Failed",
            });
        }
    } catch (error) {
        console.error('Unexpected error in /review:', error);
        return res.status(500).json({
            success: false,
            error: "Internal Server Error",
        });
    }
});

// AI Feature endpoints for landing page
app.post("/ai-feature", async (req, res) => {
    try {
        const { feature, code, language, problemDescription, constraints } = req.body;
        
        if (!feature || !code) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields",
            });
        }

        const aiResult = await aiFeatureRequest(feature, code, language, problemDescription, constraints);
        
        if (aiResult.success) {
            return res.status(200).json({
                success: true,
                result: aiResult.result
            });
        } else {
            return res.status(500).json({
                success: false,
                error: "AI Feature Failed",
            });
        }
    } catch (error) {
        console.error('Unexpected error in /ai-feature:', error);
        return res.status(500).json({
            success: false,
            error: "Internal Server Error",
        });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Compiler Service listening on port ${PORT}`));

app.use(errorMiddleware); 