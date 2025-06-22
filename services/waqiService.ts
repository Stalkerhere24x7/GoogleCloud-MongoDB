
import { WAQI_BASE_URL, WAQI_API_TOKEN, AQI_LEVELS } from '../constants';
import { AQIData, WAQIApiData } from '../types';

export const getAqiByCoords = async (lat: number, lon: number): Promise<WAQIApiData> => {
  if (!WAQI_API_TOKEN) {
    return { status: "error", data: "WAQI API token not provided" };
  }
  const url = `${WAQI_BASE_URL}/geo:${lat};${lon}/?token=${WAQI_API_TOKEN}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      // WAQI API sometimes returns error details in JSON with a 200 OK,
      // but actual HTTP errors should be caught here.
      const errorData = await response.json().catch(() => ({ data: `HTTP error! status: ${response.status}` }));
      return { status: "error", data: errorData.data || `HTTP error! status: ${response.status}`};
    }
    const data: WAQIApiData = await response.json();
    return data;
  } catch (error: any) {
    console.error("Error fetching AQI data:", error);
    return { status: "error", data: error.message || "Network request failed" };
  }
};

const createErrorAqiData = (errorMessage: string): AQIData => {
  return {
    isValid: false,
    overallAqi: 0,
    locationName: 'Error',
    city: 'Error',
    country: '',
    latitude: null,
    longitude: null,
    timestamp: new Date().toISOString(),
    pollutants: {},
    dominantPollutant: 'N/A',
    aqiCategoryName: errorMessage,
    aqiCategoryTheme: 'secondary',
  };
};

export const parseWAQIData = (waqiJson: WAQIApiData): AQIData => {
  try {
    if (waqiJson.status !== "ok") {
      let errorMessage = `API request failed with status: ${waqiJson.status || 'Unknown'}`;
      if (typeof waqiJson.data === 'string') {
        errorMessage = waqiJson.data;
      } else if (waqiJson.data && typeof waqiJson.data === 'object' && 'message' in waqiJson.data && typeof (waqiJson.data as { message?: string }).message === 'string') {
        errorMessage = (waqiJson.data as { message: string }).message;
      }
      return createErrorAqiData(errorMessage);
    }

    // Status is "ok". Now, waqiJson.data can be the success object, an error string, or an error object { message?: string }.
    if (typeof waqiJson.data === 'string') {
      return createErrorAqiData(waqiJson.data); // e.g., "Unknown station"
    }

    if (!waqiJson.data || typeof waqiJson.data !== 'object') {
      return createErrorAqiData("Invalid data format received from API.");
    }

    // At this point, waqiJson.data is an object.
    // It can be { aqi: number; ... } (SuccessData) or { message?: string } (ErrorMessageObject).
    const data = waqiJson.data;

    // Check if it's an ErrorMessageObject (has 'message' but not 'aqi')
    // or if it's an object but not the expected success structure (missing 'aqi').
    if (!('aqi' in data) || typeof (data as any).aqi !== 'number') {
        let errorMessage = "Received malformed or incomplete data from API.";
        if ('message' in data && typeof (data as { message?: string }).message === 'string') {
            errorMessage = (data as { message: string }).message;
        }
        return createErrorAqiData(errorMessage);
    }
    
    // If we've reached here, 'data' must be the success data object type.
    // TypeScript should infer this. For clarity, we can think of `data` as the success structure.
    const successData = data as {
        aqi: number;
        city: { name: string; geo: [number, number]; };
        time: { iso: string; };
        iaqi: { [key: string]: { v: number }; };
        dominentpol: string;
    };

    const overallAqi = successData.aqi;
    const locationName = successData.city?.name || 'N/A';
    const cityParts = locationName.split(',');
    const city = cityParts[0]?.trim() || 'N/A';
    
    let country = 'N/A';
    if (cityParts.length > 1) {
        country = cityParts[cityParts.length - 1].trim();
    }

    const geo = successData.city?.geo;
    const latitude = geo?.[0] || null;
    const longitude = geo?.[1] || null;
    
    const timestamp = successData.time?.iso ? new Date(successData.time.iso).toISOString() : new Date().toISOString();
    
    const pollutants: Record<string, number> = {};
    if (successData.iaqi) {
      for (const param in successData.iaqi) {
        if (successData.iaqi[param] && typeof successData.iaqi[param].v === 'number') {
          pollutants[param] = successData.iaqi[param].v;
        }
      }
    }
    
    const dominantPollutant = (successData.dominentpol || 'N/A').toUpperCase();
    
    let aqiCategoryName: string = "No Data";
    let aqiCategoryTheme: 'success' | 'warning' | 'danger' | 'secondary' = 'secondary';

    for (const name in AQI_LEVELS) {
      const level = AQI_LEVELS[name];
      if (overallAqi >= level.low && overallAqi <= level.high) {
        aqiCategoryName = name;
        aqiCategoryTheme = level.theme;
        break;
      }
    }
    if (overallAqi > AQI_LEVELS['Hazardous'].high) { 
        aqiCategoryName = 'Hazardous';
        aqiCategoryTheme = 'danger';
    }

    return {
      isValid: true,
      overallAqi,
      locationName,
      city,
      country,
      latitude,
      longitude,
      timestamp,
      pollutants,
      dominantPollutant,
      aqiCategoryName,
      aqiCategoryTheme,
    };

  } catch (e: unknown) { // Catch unknown for broader compatibility
    console.error("Error parsing WAQI data:", e);
    let errorMessage = "Could not process API data due to an unexpected error.";
    if (e instanceof Error) {
        errorMessage = `Parsing error: ${e.message}`;
    }
    return createErrorAqiData(errorMessage);
  }
};
