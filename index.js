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
  origin: ["http://localhost:5173","https://codeg-backend-yh3x.onrender.com","https://code-g-frontend-nine.vercel.app" ],
  methods: ["GET", "POST", "PUT", "DELETE"], 
  credentials: true,
};
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
]), runController.runCode);

const catchAsyncErrors = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const handleAiRequest = (aiFunction, responseKey) => catchAsyncErrors(async (req, res, next) => {
  const result = await aiFunction(req.body);

  if (result.success) {
    return res.status(200).json({
      success: true,
      [responseKey]: result[responseKey] // Use dynamic key 'review' or 'result'
    });
  } else {
    // Send a client-friendly error, the details are already logged in the helper
    return res.status(500).json({
      success: false,
      error: result.error || "AI feature failed"
    });
  }
});

app.post(
  "/review",
  handleAiRequest((body) => aiReview(body.code, body.language), 'review')
);

app.post(
  "/ai-feature",
  handleAiRequest((body) => aiFeatureRequest(
    body.feature, body.code, body.language, body.problemDescription, body.constraints
  ), 'result')
);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Compiler Service listening on port ${PORT}`));

app.use(errorMiddleware); 