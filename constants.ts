
export const GEMINI_API_KEY = process.env.API_KEY || ""; // Set by build process or environment
export const WAQI_API_TOKEN = process.env.REACT_APP_WAQI_API_TOKEN || "d18591b3ced53b3432f8ae5a337476f1aa61e2cd"; // Default from user prompt, replace with env var

export const WAQI_BASE_URL = "https://api.waqi.info/feed";
export const IP_API_URL = "https://ipapi.co/json/";

export const GEMINI_TEXT_MODEL = "gemini-2.5-flash-preview-04-17"; // For text and multimodal analysis
export const GEMINI_IMAGE_GENERATION_MODEL = "imagen-3.0-generate-002"; // If image generation was needed

export const AI_ASSISTANT_PROMPTS = [
  { buttonText: "Health Risks?", promptText: "Explain the primary health risks at the current AQI level." },
  { buttonText: "Outdoor Activity?", promptText: "Is it safe for outdoor exercise? What precautions should I take?" },
  { buttonText: "Improve Indoor Air?", promptText: "Suggest three simple ways to improve my indoor air quality right now." },
  { buttonText: "Dominant Pollutant?", promptText: "What is the dominant pollutant shown and why is it a concern?" },
  { buttonText: "Sensitive Groups?", promptText: "How does this air quality affect sensitive groups like children, the elderly, or people with asthma?" },
  { buttonText: "Should I Wear a Mask?", promptText: "Based on this data, should I wear a mask outside? If so, what kind?" }
];

export const AQI_LEVELS: Record<string, { low: number, high: number, theme: 'success' | 'warning' | 'danger' | 'secondary' }> = {
  'Good': { low: 0, high: 50, theme: 'success' },
  'Moderate': { low: 51, high: 100, theme: 'warning' },
  'Unhealthy for Sensitive': { low: 101, high: 150, theme: 'warning' },
  'Unhealthy': { low: 151, high: 200, theme: 'danger' },
  'Very Unhealthy': { low: 201, high: 300, theme: 'danger' },
  'Hazardous': { low: 301, high: 5000, theme: 'danger' }
};

export const DEFAULT_AQI_DATA: import('./types').AQIData = {
  isValid: false,
  overallAqi: 0,
  locationName: 'N/A',
  city: 'N/A',
  country: 'N/A',
  latitude: null,
  longitude: null,
  timestamp: new Date().toISOString(),
  pollutants: {},
  dominantPollutant: 'N/A',
  aqiCategoryName: 'No Data',
  aqiCategoryTheme: 'secondary',
};

export const APP_NAME = "AirSense AI";
