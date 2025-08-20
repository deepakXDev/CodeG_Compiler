const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const executeCode = require('../utils/executeCode');

// function compareTestCase(expected, actual) {
//   return expected.trim() === actual.trim();
// }

// const session = await mongoose.startSession();
// session.startTransaction();

exports.processSubmission = async (req, res) => {
  try {
    const { language, sourceCode, testCases, timeLimit = 2, memoryLimit = 128 } = req.body;
    if (!language || !sourceCode || !testCases) return res.status(400).json({ error: 'Missing fields' });

    const tempDir = path.resolve(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    // Create source file
    const ext = language === 'cpp' ? 'cpp' : language === 'python' ? 'py' : 'js';
    const sourceFilePath = path.resolve(tempDir, `${uuidv4()}.${ext}`);
    fs.writeFileSync(sourceFilePath, sourceCode);

    const results = [];
    let allPassed = true;

    for (const [index, testCase] of testCases.entries()) {
      const inputFile = path.resolve(tempDir, `${uuidv4()}_input.txt`);
      const outputFile = path.resolve(tempDir, `${uuidv4()}_output.txt`);
      fs.writeFileSync(inputFile, testCase.input);

      const result = await executeCode(language, sourceFilePath, inputFile, outputFile, timeLimit * 1000, memoryLimit * 1024);
      const output = fs.existsSync(outputFile) ? fs.readFileSync(outputFile, 'utf8') : '';
      const passed = compareTestCase(testCase.output, output);

      results.push({
        case: index + 1,
        input: testCase.input,
        expected: testCase.output,
        output,
        passed,
        ...result
      });

      if (!passed) allPassed = false;

      [inputFile, outputFile].forEach((file) => fs.existsSync(file) && fs.unlinkSync(file));
    }

    if (fs.existsSync(sourceFilePath)) fs.unlinkSync(sourceFilePath);

    return res.status(200).json({
      results,
      verdict: allPassed ? 'Accepted' : 'Wrong Answer'
    });
  } catch (err) {
    return res.status(500).json({ error: 'Processing failed', details: err.message });
  }
};


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

function deepEqual(a, b) {
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => deepEqual(val, b[idx]));
  }

  if (typeof a === "object" && a && b) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => deepEqual(a[key], b[key]));
  }

  return a === b;
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