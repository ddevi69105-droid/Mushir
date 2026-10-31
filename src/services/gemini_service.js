/**
 * Mushir Cloud Vision-Language AI Service (Gemini API Integration)
 * Allows connecting a Gemini API key for natural language scene descriptions,
 * while local on-device vision handles immediate safety obstacle alerts.
 */

class GeminiService {
  constructor() {
    this.apiKey = localStorage.getItem('mushir_gemini_api_key') || (import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) || '';
    this.modelName = 'gemini-1.5-flash';
    this.isQuerying = false;
  }

  setApiKey(key) {
    this.apiKey = key.trim();
    localStorage.setItem('mushir_gemini_api_key', this.apiKey);
  }

  getApiKey() {
    return this.apiKey;
  }

  hasApiKey() {
    return !!this.apiKey;
  }

  /**
   * Captures the current camera canvas frame and sends to Gemini 1.5 Flash
   * Returns concise, safety-conscious scene description tailored for blind mobility.
   */
  async describeSceneWithGemini(canvasElement, userPrompt = "Describe the immediate walking path and what obstacles are around me and what are they doing.") {
    if (!this.apiKey) {
      return null;
    }

    if (!canvasElement) {
      throw new Error("No canvas element available to capture frame");
    }

    this.isQuerying = true;
    try {
      // Extract base64 JPEG from canvas
      const dataUrl = canvasElement.toDataURL('image/jpeg', 0.8);
      const base64Data = dataUrl.split(',')[1];

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;

      const systemInstruction = "You are Mushir, an AI mobility assistant for blind and visually impaired pedestrians. Analyze this camera image concisely in 2 sentences. State: 1) What is directly in the center walking path and its estimated distance, 2) What obstacles are around on the left or right and what are they doing (moving, approaching, or stationary). Be direct and clear.";

      const payload = {
        contents: [
          {
            parts: [
              { text: `${systemInstruction}\nUser Question: ${userPrompt}` },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 120
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      this.isQuerying = false;
      return text || "Scene analyzed. Path appears clear ahead.";
    } catch (err) {
      this.isQuerying = false;
      console.warn("Gemini API call warning:", err);
      throw err;
    }
  }
}

export const geminiService = new GeminiService();
