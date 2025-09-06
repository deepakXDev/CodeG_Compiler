const fs = require('fs');
const axios=require('axios');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const {executeCode} = require('../utils/executeCode');
const ErrorHandler = require("../middlewares/errorMiddleware");
const {compareTestCase}=require("../utils/comparison");


const TEMP_DIR = path.resolve(process.cwd(), "temp");
const TIMEOUT = 1000; // 1 seconds
const MEMORY_LIMIT = 128; // 128 MB


const sanitizeError = (stderr, sourceFilePath) => {
  if (!stderr) return "";

  let sanitized = stderr;

  if (sourceFilePath) {
    // Replace the exact source file path with a generic name
    const fileName = path.basename(sourceFilePath);
    sanitized = sanitized.replaceAll(sourceFilePath, "your_code");
  }

  // Fallback: remove any absolute temp paths, replace with 'your_code'
  sanitized = sanitized.replace(/([A-Z]:)?[\/\\].*?[\/\\]temp[\/\\][^:\s]*/gi, "your_code");

  return sanitized;
};


const ensureTempDir = () => {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
};

const createSourceFile = (req) => {
  const { language, sourceCode } = req.body;
  
  if (req.files?.["sourceCode"]?.[0]) {
    return req.files["sourceCode"][0].path;
  }

  if (sourceCode) {
    const fileName = `${uuidv4()}.${language}`;
    const filePath = path.resolve(TEMP_DIR, fileName);
    fs.writeFileSync(filePath, sourceCode);
    return filePath;
  }

  throw new ErrorHandler("No source code provided", 400);
};


const runSingleExecution = async (language, sourceFilePath, input) => {
  const uniqueId = uuidv4();
  const inputFile = path.resolve(TEMP_DIR, `${uniqueId}_input.txt`);
  const outputFile = path.resolve(TEMP_DIR, `${uniqueId}_output.txt`);
  let output = "";
  

  try {
    fs.writeFileSync(inputFile, input);

    const result = await executeCode(
      language,
      sourceFilePath,
      inputFile,
      outputFile,
      TIMEOUT,
      MEMORY_LIMIT
    );

    if (fs.existsSync(outputFile)) {
      output = fs.readFileSync(outputFile, "utf8");
    }
    
    return { output, ...result };
  } finally {
    // Ensure input and output files are cleaned up
    [inputFile, outputFile].forEach(
      (file) => fs.existsSync(file) && fs.unlinkSync(file)
    );
  }
};

exports.runCode = async (req, res, next) => {
  
  ensureTempDir();
  let sourceFilePath = null;

  try {
    const { language, customInput, problemId } = req.body;
    sourceFilePath = createSourceFile(req);

    // --- Flow 1: Run against Custom Input ---
    if (customInput !== undefined && customInput !== null) {
      const result = await runSingleExecution(
        language,
        sourceFilePath,
        customInput
      );

       if (result.stderr) {
        result.stderr = sanitizeError(result.stderr,sourceFilePath);
      }

      return res.status(200).json({
        message: "Custom input run completed",
        ...result,
      });
    }

    // --- Flow 2: Run against Sample Test Cases ---
    // if (problemId) {
      // const problem = await Problem.findById(problemId);
     if (problemId) {
      // ✅ CHANGE: Instead of a DB call, make an API call to the backend
      let problemData;
      try {
        const backendUrl = `${process.env.BACKEND_URL}/problems/id/${problemId}`;
        const response = await axios.get(backendUrl);
        problemData = response.data.data; // Note the nested .data structure
      } catch (apiError) {
        // Handle cases where the backend is down or the problem doesn't exist
        const statusCode = apiError.response ? apiError.response.status : 500;
        const message = apiError.response ? apiError.response.data.message : "Cannot connect to backend service";
        return next(new ErrorHandler(message, statusCode));
      }

      const sampleCases = problemData.testCases.filter((tc) => tc.isSample);
      if (sampleCases.length === 0) {
        return res.status(200).json({
          message: "No sample test cases found for this problem.",
          testResults: [],
        });
      }

      const results = [];
      for (const [index, testCase] of sampleCases.entries()) {
        const result = await runSingleExecution(
          language,
          sourceFilePath,
          testCase.input
        );
        const passed = compareTestCase(testCase.output, result.output);

         if (result.stderr) {
        result.stderr = sanitizeError(result.stderr, sourceFilePath);
      }


        results.push({
          case: index + 1,
          input: testCase.input,
          expected: testCase.output,
          passed,
          ...result,
        });

        // Stop execution if a sample case fails
        if (!passed) break;
      }

      return res.status(200).json({
        message: "Sample test cases executed",
        testResults: results,
      });
    }

    // --- If neither flow is triggered ---
    return next(
      new ErrorHandler(
        "Request must contain either custom input or a problem ID.",
        400
      )
    );
  } catch (err) {
    console.error('[DEBUG] CRITICAL ERROR CAUGHT:', err);
    return next(err); // Pass error to the global error handler middleware
  } finally {
    // --- Universal Cleanup ---
    // Always delete the source code file after execution
    if (sourceFilePath && fs.existsSync(sourceFilePath)) {
      fs.unlinkSync(sourceFilePath);
    }
  }
};

