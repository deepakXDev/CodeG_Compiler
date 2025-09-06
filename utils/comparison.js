function normalizeText(str) {
  
  if (typeof str !== 'string') {
    return '';
  }
  
  
  return str.trim().split('\n').map(line => line.trim()).join('\n');
}

function compareTestCase (expectedStr, rawOutput) {
  const expected = normalizeText(expectedStr);
  const output = normalizeText(rawOutput);
  
  
  
  return expected === output;
};

module.exports={compareTestCase,};