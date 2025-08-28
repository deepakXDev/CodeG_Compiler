// function normalizeOutput(outputStr) {
//   const cleanStr = outputStr.replace(/\r/g, "").trim();

//   try {
//     return JSON.parse(cleanStr);
//   } catch (err) {
//     const tokens = cleanStr.split(/\s+/).map((token) => {
//       if (!isNaN(token)) return Number(token); // number
//       if (token === "true") return true;
//       if (token === "false") return false;
//       return token; // raw string
//     });
//     return tokens.length === 1 ? tokens[0] : tokens;
//   }
// }

// function deepEqual(a, b) {
//   if (typeof a !== typeof b) return false;

//   if (Array.isArray(a) && Array.isArray(b)) {
//     if (a.length !== b.length) return false;
//     return a.every((val, idx) => deepEqual(val, b[idx]));
//   }

//   if (typeof a === "object" && a && b) {
//     const aKeys = Object.keys(a);
//     const bKeys = Object.keys(b);
//     if (aKeys.length !== bKeys.length) return false;
//     return aKeys.every((key) => deepEqual(a[key], b[key]));
//   }

//   return a === b;
// }

// exports.compareTestCase=(expectedStr, rawOutput)=> {
//   let expected, output;

//   try {
//     expected = normalizeOutput(expectedStr);
//   } catch (e) {
//     console.error("Invalid expected JSON string:", expectedStr);
//     return false;
//   }

//   try {
//     output = normalizeOutput(rawOutput);
//   } catch (e) {
//     console.error("Invalid output format:", rawOutput);
//     return false;
//   }

//   return deepEqual(output, expected);
// }

function normalizeText(str) {
  // Check if the input is a valid string, return empty string otherwise.
  if (typeof str !== 'string') {
    return '';
  }
  // Trim whitespace from the start/end, then split into lines.
  // Trim each line individually, then join them back with a single newline.
  return str.trim().split('\n').map(line => line.trim()).join('\n');
}

exports.compareTestCase = (expectedStr, rawOutput) => {
  const expected = normalizeText(expectedStr);
  const output = normalizeText(rawOutput);
  // console.log(expected);
  // console.log(output);
  // A simple, direct string comparison is now sufficient and reliable.
  return expected === output;
};