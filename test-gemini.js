const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
  const genAI = new GoogleGenerativeAI("AIzaSyB0A6A2pYTsmQd80XIZeeKRMpr4BipHrEs");
  try {
    console.log("Testing gemini-1.5-flash...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Hello");
    console.log("gemini-1.5-flash response:", result.response.text());
  } catch (error) {
    console.error("gemini-1.5-flash failed:", error.message);
  }

  try {
    console.log("Testing gemini-2.0-flash...");
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent("Hello");
    console.log("gemini-2.0-flash response:", result.response.text());
  } catch (error) {
    console.error("gemini-2.0-flash failed:", error.message);
  }
  
  try {
    console.log("Testing gemini-pro...");
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent("Hello");
    console.log("gemini-pro response:", result.response.text());
  } catch (error) {
    console.error("gemini-pro failed:", error.message);
  }
}

listModels();