
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GEMINI_API_KEY, GEMINI_TEXT_MODEL } from '../constants';
import { GeocodedLocation, Candidate, GroundingMetadata } from '../types'; // Updated Candidate import

let ai: GoogleGenAI | null = null;

const getAiClient = (): GoogleGenAI => {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API Key not found. Please set the API_KEY environment variable.");
  }
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return ai;
};

const parseJsonFromText = <T,>(text: string): T | null => {
  let jsonStr = text.trim();
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s; // Matches ```json ... ``` or ``` ... ```
  const match = jsonStr.match(fenceRegex);
  if (match && match[2]) {
    jsonStr = match[2].trim();
  }
  try {
    return JSON.parse(jsonStr) as T;
  } catch (e) {
    console.error("Failed to parse JSON response from Gemini:", e, "Original text:", text);
    return null;
  }
};


export const getCoordinatesFromText = async (query: string): Promise<GeocodedLocation | null> => {
  try {
    const client = getAiClient();
    const prompt = `You are a geocoding API. Analyze the following location query: "${query}". Respond with a single JSON object containing "latitude", "longitude", and "identified_name". The latitude and longitude should be numbers. If the location cannot be reliably identified, return null for latitude and longitude, and the original query for identified_name.`;
    
    const response: GenerateContentResponse = await client.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      // contents: [{ role: "user", parts: [{text: prompt}] }], // Corrected structure
      contents: prompt, // Simplified for single text prompt
      config: {
        responseMimeType: "application/json",
        temperature: 0.1 // Low temperature for factual geocoding
      }
    });

    const geocodedData = parseJsonFromText<GeocodedLocation>(response.text);
    
    if (geocodedData && typeof geocodedData.latitude === 'number' && typeof geocodedData.longitude === 'number') {
      return {
        latitude: geocodedData.latitude,
        longitude: geocodedData.longitude,
        identified_name: geocodedData.identified_name || query,
      };
    }
    return { latitude: null, longitude: null, identified_name: query }; // Fallback if parsing or data is incomplete

  } catch (error) {
    console.error("Error geocoding with Gemini:", error);
    return null;
  }
};

export const generateTextResponse = async (prompt: string): Promise<string> => {
  try {
    const client = getAiClient();
    const response: GenerateContentResponse = await client.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      // contents: [{ role: "user", parts: [{text: prompt}] }] // Corrected structure
      contents: prompt, // Simplified for single text prompt
    });
    return response.text;
  } catch (error: any) {
    console.error("Error generating text response from Gemini:", error);
    let message = "AI text generation service encountered an issue. Please try again later.";
     if (error && error.message) {
        const errorMessageString = String(error.message).toLowerCase();
        if (errorMessageString.includes("api key not valid") || errorMessageString.includes("api_key_invalid")) {
            message = "AI text generation failed: The API Key is invalid or missing.";
        } else if (errorMessageString.includes("quota")) {
            message = "AI text generation failed: API quota exceeded. Please check your usage.";
        } else if (error.toString().toLowerCase().includes("fetch") || error.toString().toLowerCase().includes("network")) {
            message = "AI text generation failed: A network error occurred. Please check your connection and try again.";
        }
    }
    throw new Error(message);
  }
};

export const analyzeImageWithText = async (prompt: string, imageBase64: string, mimeType: string): Promise<string> => {
  try {
    const client = getAiClient();
    
    const imagePart = { // Defined inline as per SDK guidelines
      inlineData: {
        mimeType: mimeType,
        data: imageBase64,
      },
    };
    const textPart = { text: prompt }; // Defined inline as per SDK guidelines

    const response: GenerateContentResponse = await client.models.generateContent({
      model: GEMINI_TEXT_MODEL, // This model handles multimodal
      contents: { parts: [imagePart, textPart] }, // Correct structure for multi-part content
    });
    
    return response.text;
  } catch (error: any) {
    console.error("Gemini Service Error (analyzeImageWithText):", error);
    let message = "The AI image analysis service encountered an issue. Please try again later.";
    if (error && error.message) {
        const errorMessageString = String(error.message).toLowerCase();
        if (errorMessageString.includes("api key not valid") || errorMessageString.includes("api_key_invalid")) {
            message = "Image analysis failed: The API Key is invalid or missing.";
        } else if (errorMessageString.includes("quota")) {
            message = "Image analysis failed: API quota exceeded. Please check your usage.";
        } else if (error.toString().toLowerCase().includes("fetch") || error.toString().toLowerCase().includes("network") || errorMessageString.includes("rpc failed")) { // Includes "rpc failed" for XHR/gRPC issues
            message = "Image analysis failed: A network error or server issue occurred. Please check your connection and try again.";
        }
    }
    throw new Error(message);
  }
};

export const generateTextResponseWithGoogleSearch = async (
  prompt: string
): Promise<{ text: string; groundingMetadata?: GroundingMetadata }> => { // Used local GroundingMetadata
  try {
    const client = getAiClient();
    const response = await client.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      // contents: [{ role: 'user', parts: [{ text: prompt }] }], // Corrected structure
      contents: prompt, // Simplified for single text prompt
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    // Cast the SDK's groundingMetadata to our local type
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata as GroundingMetadata | undefined;
    return { text: response.text, groundingMetadata };
  } catch (error: any) {
    console.error('Error generating text response with Google Search from Gemini:', error);
    let message = "AI search-grounded text generation encountered an issue. Please try again later.";
     if (error && error.message) {
        const errorMessageString = String(error.message).toLowerCase();
        if (errorMessageString.includes("api key not valid") || errorMessageString.includes("api_key_invalid")) {
            message = "AI search-grounded text generation failed: The API Key is invalid or missing.";
        } else if (errorMessageString.includes("quota")) {
            message = "AI search-grounded text generation failed: API quota exceeded. Please check your usage.";
        } else if (error.toString().toLowerCase().includes("fetch") || error.toString().toLowerCase().includes("network")) {
            message = "AI search-grounded text generation failed: A network error occurred. Please check your connection and try again.";
        }
    }
    throw new Error(message);
  }
};