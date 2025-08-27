const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const executeCode = require('../utils/executeCode');
const ErrorHandler = require("../middlewares/errorMiddleware");

// function compareTestCase(expected, actual) {
//   return expected.trim() === actual.trim();
// }

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

exports.runSampleTest = async (req, res, next) => {

  try {
    const { language, customInput, sourceCode } = req.body;

    let sourceFilePath = null;
    const tempDir = path.resolve(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    if (req.files?.["sourceCode"]?.[0]) {
      sourceFilePath = req.files["sourceCode"][0].path;
    } else if (sourceCode) {
      const fileName = `${uuidv4()}.${language}`; //directly using language..as way to create sourceCode_type**
      sourceFilePath = path.resolve(tempDir, fileName);
      fs.writeFileSync(sourceFilePath, sourceCode);
    } else {
      return next(new ErrorHandler("No code submitted", 400));
    }

    if (customInput) {
      const uniqueId = uuidv4();
      const inputFile = path.resolve(tempDir, `${uniqueId}_input.txt`);
      const outputFile = path.resolve(tempDir, `${uniqueId}_output.txt`);
      fs.writeFileSync(inputFile, customInput);

      const result = await executeCode(
        language,
        sourceFilePath,
        inputFile,
        outputFile,
        3000,
        128
      );
      const output = fs.existsSync(outputFile)
        ? fs.readFileSync(outputFile, "utf8")
        : "";

      [sourceFilePath, inputFile, outputFile].forEach(
        (file) => fs.existsSync(file) && fs.unlinkSync(file)
      );

      return res.status(200).json({
        message: "Custom input run completed",
        output,
        ...result,
      });
    }

    const sampleCases = problem.testCases.filter((tc) => tc.isSample);

    const results = [];

    for (const [index, testCase] of sampleCases.entries()) {
      const uniqueId = uuidv4();
      const inputFile = path.resolve(tempDir, `${uniqueId}_input.txt`);
      const outputFile = path.resolve(tempDir, `${uniqueId}_output.txt`);
      fs.writeFileSync(inputFile, testCase.input);

      const result = await executeCode(
        language,
        sourceFilePath,
        inputFile,
        outputFile,
        3000,
        128
      );
      const output = fs.existsSync(outputFile)
        ? fs.readFileSync(outputFile, "utf8")
        : "";
      const expected = testCase.output;

      [inputFile, outputFile].forEach(
        (file) => fs.existsSync(file) && fs.unlinkSync(file)
      );

      const passed = compareTestCase(expected, output);

      results.push({
        case: index + 1,
        input: testCase.input,
        expected,
        output,
        passed,
        ...result,
      });

      if (!passed) break;
    }

    if (fs.existsSync(sourceFilePath)) fs.unlinkSync(sourceFilePath);

    res.status(200).json({
      message: "Sample test cases executed",
      testResults: results,
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Sample execution failed", details: err.message });
  }
};