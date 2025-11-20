
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { FilmSettings } from "../types";

const apiKey = process.env.API_KEY;

// Helper to strip data URL header
const getBase64 = (dataUrl: string) => {
  return dataUrl.split(',')[1];
};

// Helper to get MimeType
const getMimeType = (dataUrl: string) => {
  return dataUrl.substring(dataUrl.indexOf(':') + 1, dataUrl.indexOf(';'));
};

export const generateSettingsFromPrompt = async (prompt: string): Promise<Partial<FilmSettings>> => {
  if (!apiKey) {
    throw new Error("API Key not found");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
    You are an expert analog photography colorist. 
    Your task is to translate a user's description of a mood, movie style, or film look into specific numeric values for an image processing engine.
    
    Value Ranges:
    - exposure: -100 to 100 (0 is neutral)
    - contrast: -100 to 100 (0 is neutral)
    - saturation: -100 to 100 (0 is neutral, -100 is B&W)
    - warmth: -100 to 100 (-100 is cold/blue, 100 is warm/orange)
    - grain: 0 to 100 (0 is clean, 100 is heavy noise)
    - vignette: 0 to 100 (0 is none, 100 is heavy corners)
    - blur: 0 to 50 (0 is sharp, 50 is very dreamy/soft)

    Analyze the prompt and return a JSON object with these integer values.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            exposure: { type: Type.INTEGER },
            contrast: { type: Type.INTEGER },
            saturation: { type: Type.INTEGER },
            warmth: { type: Type.INTEGER },
            grain: { type: Type.INTEGER },
            vignette: { type: Type.INTEGER },
            blur: { type: Type.INTEGER },
          },
          required: ["exposure", "contrast", "saturation", "warmth", "grain", "vignette"],
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response from AI");

    return JSON.parse(jsonText) as Partial<FilmSettings>;
  } catch (error) {
    console.error("Error generating settings:", error);
    throw error;
  }
};

export const editImageWithNanoBanana = async (imageUrl: string, prompt: string): Promise<string> => {
  if (!apiKey) throw new Error("API Key not found");
  if (!imageUrl) throw new Error("No image provided");

  const ai = new GoogleGenAI({ apiKey });
  const base64Data = getBase64(imageUrl);
  const mimeType = getMimeType(imageUrl);

  // Simplified, direct prompt to reduce confusion for the model
  const systemPrompt = `
    Edit this image exactly as requested: "${prompt}".
    Keep the original aspect ratio.
    Keep it photorealistic.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: systemPrompt,
          },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    // Extract image from response
    const candidates = response.candidates;
    if (candidates && candidates[0]?.content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
        // If the model returns text instead of an image, it might be a refusal or error explanation
        if (part.text) {
            console.warn("Model returned text instead of image:", part.text);
        }
      }
    }
    
    console.error("Full Response Object:", response);
    throw new Error("AI did not generate an image. The prompt might have triggered safety filters.");
  } catch (error) {
    console.error("Error editing image:", error);
    throw error; // Re-throw to be caught by UI
  }
};

export const analyzeImageForSuggestions = async (imageUrl: string): Promise<{ features: string[], atmosphere: string[] }> => {
  if (!apiKey) throw new Error("API Key not found");
  
  const ai = new GoogleGenAI({ apiKey });
  const base64Data = getBase64(imageUrl);
  const mimeType = getMimeType(imageUrl);

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
           parts: [
               { inlineData: { data: base64Data, mimeType: mimeType } },
               { 
                 text: `
                   Analyze this image visually. 
                   DO NOT DESCRIBE THE IMAGE.
                   Instead, act as a creative director and suggest creative EDITS or TRANSFORMATIONS.
                   
                   1. Suggest 6 distinct visual styles/genres to TRANSFORM this photo into (e.g. 'Cyberpunk 2077 Style', '1920s Charcoal Sketch', 'Wes Anderson Movie').
                   2. Suggest 6 specific atmosphere/weather MODIFICATIONS (e.g. 'Add Heavy Rain', 'Change to Golden Hour', 'Add Fog').
                   
                   Return JSON.
                 ` 
               }
           ]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    features: { type: Type.ARRAY, items: { type: Type.STRING } },
                    atmosphere: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
            }
        }
    });

    const jsonText = response.text;
    if(jsonText) return JSON.parse(jsonText);
    return { features: [], atmosphere: [] };
  } catch (e) {
      console.error("Analysis failed", e);
      return { features: [], atmosphere: [] };
  }
}
