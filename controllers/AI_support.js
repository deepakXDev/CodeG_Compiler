const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const aiFeatureRequest = async (feature, code, language, problemDescription = '', constraints = '') => {
  if (!feature || !code) {
    console.error("Error: Missing required fields");
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }
    try {
    let prompt;

    switch (feature) {
      case "Hint":
        prompt = `Provide hints to solve this coding problem without full solution.
Problem: ${problemDescription || 'N/A'}
Constraints: ${constraints || 'N/A'}
Code (${language}):
${code}
Format:
1. Strategic Hints
2. Key Insights
3. Optimization Tips
4. Common Pitfalls`;
        break;

      case "Feedback":
        prompt = `Give constructive feedback on this solution.
Problem: ${problemDescription || 'N/A'}
Constraints: ${constraints || 'N/A'}
Code (${language}):
${code}
Analyze:
1. Correctness
2. Code Quality
3. Efficiency
4. Best Practices
5. Improvements`;
        break;

      default:
        return { success: false, error: "Unknown AI feature requested" };
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt
    });

    return { success: true, result: response.text };

  } catch (error) {
    console.error("Error in AI Feature Request:", error);
    return { success: false, error: error.message };
  }
};


const aiReview = async (code, language) => {
  try {
    const prompt = `Act as a code reviewer for ${language} code:
${code}
Provide review in markdown:
## Overall Assessment
## Strengths
## Issues Found (Critical/Major/Minor)
## Specific Recommendations (with examples)
## Best Practices`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt
    });

    return { success: true, review: response.text };

  } catch (error) {
    console.error("Error in AI Review:", error);
    return { success: false, error: error.message };
  }
};

module.exports = {aiReview,aiFeatureRequest};