
export interface AQIData {
  isValid: boolean;
  overallAqi: number;
  locationName: string;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  timestamp: string; // ISO string
  pollutants: Record<string, number>; // e.g., { "pm25": 55, "o3": 30 }
  dominantPollutant: string;
  aqiCategoryName: string;
  aqiCategoryTheme: 'success' | 'warning' | 'danger' | 'secondary';
}

export interface WAQIApiData {
  status: string;
  data: {
    aqi: number;
    city: {
      name: string;
      geo: [number, number];
    };
    time: {
      iso: string;
    };
    iaqi: {
      [key: string]: { v: number };
    };
    dominentpol: string;
  } | string | { message?: string }; // 'data' can be error string or object
}


export interface IpApiLocation {
  ip: string;
  city: string;
  region: string;
  country_code: string;
  latitude: number;
  longitude: number;
  [key: string]: any; 
}

export interface GeocodedLocation {
  latitude: number | null;
  longitude: number | null;
  identified_name: string;
}

export enum MessageSender {
  User = "user",
  AI = "ai",
  System = "system",
}

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  text: string;
  timestamp: string;
}

export interface SkyRecord {
  id: string; // Unique identifier for the record
  imageUrl: string; // URL to the (potentially downsized) image
  uploadTimestamp: string; // ISO string
  aqiDataAtUpload: AQIData;
  geminiAnalysis: string;
  locationName: string; // To associate with a location for vector search
}

export interface GroundingChunkWeb {
  uri?: string; // Made optional to align with SDK
  title?: string; // Made optional to align with SDK
}

export interface GroundingChunk {
  web?: GroundingChunkWeb;
  // Other types of chunks if applicable
}

export interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
  // Other grounding metadata fields
}

export interface Candidate {
  groundingMetadata?: GroundingMetadata;
  // Other candidate fields
}