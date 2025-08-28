const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const {executeCode} = require('../utils/executeCode');// Your sandboxed execution function
const { compareTestCase } = require("../utils/comparison");
const axios = require('axios');

// Helper to determine a precise verdict from the execution result
const getVerdict = (result, passed) => {
  if (result.stderr && result.stderr.toLowerCase().includes('compilation failed')) {
    return 'Compilation Error';
  }
  if (result.stderr && result.stderr.toLowerCase().includes('time limit exceeded')) {
    return 'Time Limit Exceeded';
  }
  if (result.stderr && result.stderr.toLowerCase().includes('memory limit exceeded')) {
    return 'Memory Limit Exceeded';
  }
  if (result.code !== 0) {
    return 'Runtime Error';
  }
  if (!passed) {
    return 'Wrong Answer';
  }
  return 'Accepted';
};

exports.processSubmission = async (req, res) => {
  const {
    language,
    sourceCode,
    testCases,
    timeLimit = 3000, // Default 3 seconds 
    memoryLimit = 128, // Default 128 MB
    callbackUrl,
    secretToken // For securing the callback
  } = req.body;

  if (!language || !sourceCode || !testCases || !callbackUrl) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // ✅ 1. Acknowledge the job immediately
  res.status(202).json({ message: 'Job accepted for processing.' });

  // ✅ 2. Process the job in the background (after responding)
  let sourceFilePath = null;
  const tempDir = path.resolve(process.cwd(), 'temp');

  try {
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const ext = { cpp: 'cpp', python: 'py', javascript: 'js', java: 'java' }[language] || 'txt';
    sourceFilePath = path.resolve(tempDir, `${uuidv4()}.${ext}`);
    fs.writeFileSync(sourceFilePath, sourceCode);

    const results = [];
    let finalVerdict = 'Accepted'; // Assume success initially

    for (const [index, testCase] of testCases.entries()) {
      const { input, output: expectedOutput } = testCase;
      
      
      // Create temporary input and output files for this specific test case
      const inputFile = path.resolve(tempDir, `${uuidv4()}_input.txt`);
      const outputFile = path.resolve(tempDir, `${uuidv4()}_output.txt`);
      fs.writeFileSync(inputFile, input);
      
      
      const result = await executeCode(language, sourceFilePath, inputFile,outputFile, timeLimit, memoryLimit);
      
      const actualOutput = fs.existsSync(outputFile) ? fs.readFileSync(outputFile, 'utf8') : '';
      
      const passed = compareTestCase(expectedOutput, actualOutput);
      const verdict = getVerdict(result, passed);

      results.push({
        case: index + 1,
        verdict,
        passed,
        // ...result,
        // output: actualOutput,
        // stderr: result.stderr
      });

      // Clean up the temporary files for this iteration
      [inputFile, outputFile].forEach((file) => fs.existsSync(file) && fs.unlinkSync(file));
      

      // ✅ 3. Stop on the first failed test case
      if (!passed) {
        finalVerdict = verdict;
        break;
      }
    }

    // ✅ 4. Send results back to the main backend via callback
    await axios.post(callbackUrl, {
      results,
      verdict: finalVerdict,
      secretToken, // Send back the secret for verification
    });

  } catch (err) {
    // If anything fails, notify the backend
    await axios.post(callbackUrl, {
      results: [],
      verdict: 'System Error',
      errorMessage: err.message,
      secretToken,
    }).catch(cbErr => {
      console.error("Failed to send system error callback:", cbErr.message);
    });
  } finally {
    // Cleanup the source file
    if (sourceFilePath && fs.existsSync(sourceFilePath)) {
      fs.unlinkSync(sourceFilePath);
    }
  }
};















// function compareTestCase(expected, actual) {
//   return expected.trim() === actual.trim();
// }
// const session = await mongoose.startSession();
// session.startTransaction();

// exports.processSubmission = async (req, res) => {
//   try {
//     const { language, sourceCode, testCases, timeLimit = 2, memoryLimit = 128 } = req.body;
//     if (!language || !sourceCode || !testCases) return res.status(400).json({ error: 'Missing fields' });

//     const tempDir = path.resolve(process.cwd(), 'temp');
//     if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

//     // Create source file
//     const ext = language === 'cpp' ? 'cpp' : language === 'python' ? 'py' : 'js';
//     const sourceFilePath = path.resolve(tempDir, `${uuidv4()}.${ext}`);
//     fs.writeFileSync(sourceFilePath, sourceCode);

//     const results = [];
//     let allPassed = true;

//     for (const [index, testCase] of testCases.entries()) {
//       const inputFile = path.resolve(tempDir, `${uuidv4()}_input.txt`);
//       const outputFile = path.resolve(tempDir, `${uuidv4()}_output.txt`);
//       fs.writeFileSync(inputFile, testCase.input);

//       const result = await executeCode(language, sourceFilePath, inputFile, outputFile, timeLimit * 1000, memoryLimit * 1024);
//       const output = fs.existsSync(outputFile) ? fs.readFileSync(outputFile, 'utf8') : '';
//       const passed = compareTestCase(testCase.output, output);

//       results.push({
//         case: index + 1,
//         input: testCase.input,
//         expected: testCase.output,
//         output,
//         passed,
//         ...result
//       });

//       if (!passed) allPassed = false;

//       [inputFile, outputFile].forEach((file) => fs.existsSync(file) && fs.unlinkSync(file));
//     }

//     if (fs.existsSync(sourceFilePath)) fs.unlinkSync(sourceFilePath);

//     return res.status(200).json({
//       results,
//       verdict: allPassed ? 'Accepted' : 'Wrong Answer'
//     });
//   } catch (err) {
//     return res.status(500).json({ error: 'Processing failed', details: err.message });
//   }
// };
