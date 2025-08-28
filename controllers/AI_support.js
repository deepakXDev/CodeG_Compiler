const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();

const genAI = new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});

const generateAIResponse = async (prompt) => {
  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    })
    const text = response.text;
    return { success: true, data: text };
  } catch (error) {
    console.error("Error generating AI response:", error);
    return { success: false, error: error.message || "Failed to get response from AI model." };
  }
};

const featurePrompts = {
  Hint: ({ code, language, problemDescription, constraints }) => `
    You are an expert programming tutor. Your goal is to guide the user to the solution without giving it away.
    Analyze the user's code for the following problem and provide strategic hints.

    **Problem Description:**
    ${problemDescription || 'Not provided.'}

    **Constraints:**
    ${constraints || 'Not provided.'}

    **User's Code (${language}):**
    \`\`\`${language}
    ${code}
    \`\`\`

    **Provide your hints in Markdown format under the following clear headings:**
    - **High-Level Strategy:** (What is the general approach they should be thinking about? e.g., "Consider a two-pointer approach...")
    - **Key Observation:** (Is there a specific insight or trick they might be missing?)
    - **Code-Specific Hint:** (Point to a potential issue in their current code without fixing it. e.g., "Look closely at your loop's termination condition.")
    - **Common Pitfall:** (What's a common mistake for this type of problem?)
  `,

  Feedback: ({ code, language, problemDescription, constraints }) => `
    You are a senior software engineer performing a code review. Be constructive, clear, and professional.
    Provide detailed feedback on the following solution.

    **Problem Description:**
    ${problemDescription || 'Not provided.'}

    **Constraints:**
    ${constraints || 'Not provided.'}

    **User's Code (${language}):**
    \`\`\`${language}
    ${code}
    \`\`\`

    **Provide your feedback in Markdown format under the following headings:**
    - **Correctness:** (Does the code solve the problem? Are there edge cases it fails?)
    - **Code Quality & Readability:** (Is the code clean, well-structured, and easy to understand?)
    - **Efficiency (Time & Space Complexity):** (Analyze the complexity. Is it optimal? Can it be improved?)
    - **Best Practices & Suggestions:** (Provide specific, actionable recommendations with brief code examples where helpful.)
  `,
};

// --- Main AI feature function ---
const aiFeatureRequest = async (feature, code, language, problemDescription = '', constraints = '') => {
  if (!feature || !code) {
    return { success: false, error: "Missing feature or code" };
  }

  // Look up the prompt generator function from our map
  const promptGenerator = featurePrompts[feature];
  if (!promptGenerator) {
    return { success: false, error: "Unknown AI feature requested" };
  }

  const prompt = promptGenerator({ code, language, problemDescription, constraints });
  const aiResult = await generateAIResponse(prompt);

  if (aiResult.success) {
    return { success: true, result: aiResult.data };
  }
  return aiResult; // Pass the error object through
};

// --- Main AI review function ---
const aiReview = async (code, language) => {
  if (!code || !language) {
    return { success: false, error: "Missing code or language" };
  }
  
  const prompt = `
    Act as an expert code reviewer providing a thorough analysis of this ${language} code.
    Your review should be detailed, constructive, and formatted in Markdown.

    **Code to Review:**
    \`\`\`${language}
    ${code}
    \`\`\`

    **Please structure your review with the following sections:**
    - **Overall Assessment:** (A brief, high-level summary of the code's quality.)
    - **Strengths:** (What did the author do well?)
    - **Potential Issues:** (Categorize issues as Critical, Major, or Minor. Explain the impact of each.)
    - **Security Vulnerabilities:** (Are there any potential security risks? e.g., injection, improper error handling.)
    - **Specific Recommendations:** (Provide actionable suggestions for improvement, including corrected code snippets where appropriate.)
  `;

  const aiResult = await generateAIResponse(prompt);
  
  if (aiResult.success) {
    return { success: true, review: aiResult.data };
  }
  return aiResult; // Pass the error object through
};

module.exports = { aiReview, aiFeatureRequest };
















