const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const executeCode = require('../utils/executeCode');
const ErrorHandler = require("../middlewares/errorMiddleware");
// const Problem = require("../models/Problem");

// function compareTestCase(expected, actual) {
//   return expected.trim() === actual.trim();
// }

const TEMP_DIR = path.resolve(process.cwd(), "temp");
const TIMEOUT = 3000; // 3 seconds
const MEMORY_LIMIT = 128; // 128 MB


function normalizeOutput(outputStr) {
  const cleanStr = outputStr.replace(/\r/g, "").trim();

  try {
    return JSON.parse(cleanStr);
  } catch (err) {
    const tokens = cleanStr.split(/\s+/).map((token) => {
      if (!isNaN(token)) return Number(token); // number
      if (token === "true") return true;
      if (token === "false") return false;
      return token; // raw string
    });
    return tokens.length === 1 ? tokens[0] : tokens;
  }
}

function compareTestCase(expectedStr, rawOutput) {
  let expected, output;

  try {
    expected = normalizeOutput(expectedStr);
  } catch (e) {
    console.error("Invalid expected JSON string:", expectedStr);
    return false;
  }

  try {
    output = normalizeOutput(rawOutput);
  } catch (e) {
    console.error("Invalid output format:", rawOutput);
    return false;
  }

  return deepEqual(output, expected);
}

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
      return res.status(200).json({
        message: "Custom input run completed",
        ...result,
      });
    }

    // --- Flow 2: Run against Sample Test Cases ---
    if (problemId) {
      const problem = await Problem.findById(problemId);
      if (!problem) {
        return next(new ErrorHandler("Problem not found", 404));
      }

      const sampleCases = problem.testCases.filter((tc) => tc.isSample);
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
    return next(err); // Pass error to the global error handler middleware
  } finally {
    // --- Universal Cleanup ---
    // Always delete the source code file after execution
    if (sourceFilePath && fs.existsSync(sourceFilePath)) {
      fs.unlinkSync(sourceFilePath);
    }
  }
};


// exports.runSampleTest = async (req, res, next) => {

//   try {
//     const { language, customInput, sourceCode } = req.body;

//     let sourceFilePath = null;
//     const tempDir = path.resolve(process.cwd(), "temp");
//     if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

//     if (req.files?.["sourceCode"]?.[0]) {
//       sourceFilePath = req.files["sourceCode"][0].path;
//     } else if (sourceCode) {
//       const fileName = `${uuidv4()}.${language}`; //directly using language..as way to create sourceCode_type**
//       sourceFilePath = path.resolve(tempDir, fileName);
//       fs.writeFileSync(sourceFilePath, sourceCode);
//     } else {
//       return next(new ErrorHandler("No code submitted", 400));
//     }

//     if (customInput) {
//       const uniqueId = uuidv4();
//       const inputFile = path.resolve(tempDir, `${uniqueId}_input.txt`);
//       const outputFile = path.resolve(tempDir, `${uniqueId}_output.txt`);
//       fs.writeFileSync(inputFile, customInput);

//       const result = await executeCode(
//         language,
//         sourceFilePath,
//         inputFile,
//         outputFile,
//         3000,
//         128
//       );
//       const output = fs.existsSync(outputFile)
//         ? fs.readFileSync(outputFile, "utf8")
//         : "";

//       [sourceFilePath, inputFile, outputFile].forEach(
//         (file) => fs.existsSync(file) && fs.unlinkSync(file)
//       );

//       return res.status(200).json({
//         message: "Custom input run completed",
//         output,
//         ...result,
//       });
//     }

//     const sampleCases = problem.testCases.filter((tc) => tc.isSample);

//     const results = [];

//     for (const [index, testCase] of sampleCases.entries()) {
//       const uniqueId = uuidv4();
//       const inputFile = path.resolve(tempDir, `${uniqueId}_input.txt`);
//       const outputFile = path.resolve(tempDir, `${uniqueId}_output.txt`);
//       fs.writeFileSync(inputFile, testCase.input);

//       const result = await executeCode(
//         language,
//         sourceFilePath,
//         inputFile,
//         outputFile,
//         3000,
//         128
//       );
//       const output = fs.existsSync(outputFile)
//         ? fs.readFileSync(outputFile, "utf8")
//         : "";
//       const expected = testCase.output;

//       [inputFile, outputFile].forEach(
//         (file) => fs.existsSync(file) && fs.unlinkSync(file)
//       );

//       const passed = compareTestCase(expected, output);

//       results.push({
//         case: index + 1,
//         input: testCase.input,
//         expected,
//         output,
//         passed,
//         ...result,
//       });

//       if (!passed) break;
//     }

//     if (fs.existsSync(sourceFilePath)) fs.unlinkSync(sourceFilePath);

//     res.status(200).json({
//       message: "Sample test cases executed",
//       testResults: results,
//     });
//   } catch (err) {
//     res
//       .status(500)
//       .json({ error: "Sample execution failed", details: err.message });
//   }
// };