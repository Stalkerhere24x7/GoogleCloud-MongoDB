
import { AQIData, SkyRecord } from '../types';
import { DEFAULT_AQI_DATA } from '../constants'; // For mock data

// This is a MOCK service. In a real application, you would make API calls to your backend,
// which would then interact with MongoDB Atlas. Direct frontend to MongoDB connection is insecure.

export const saveSkyRecord = async (
  imageBase64: string, // Or perhaps a reference like an upload URL if backend handles direct upload
  mimeType: string,
  aqiData: AQIData,
  analysis: string
): Promise<SkyRecord | null> => {
  console.log("Attempting to save SkyRecord (MOCK):");
  console.log("AQI Data:", aqiData);
  console.log("Analysis:", analysis);
  console.log("Mime Type:", mimeType);
  // console.log("Image Base64 (first 100 chars):", imageBase64.substring(0, 100)); // Be careful logging large strings

  // Simulate an API call
  await new Promise(resolve => setTimeout(resolve, 500)); // Reduced delay

  // In a real scenario, the backend would return the saved record, possibly with a generated ID.
  const mockRecord: SkyRecord = {
    id: `mockRecord_${Date.now()}_${Math.random().toString(36).substring(2,9)}`, // More unique ID
    imageUrl: `data:${mimeType};base64,${imageBase64}`, // Use actual uploaded image for optimistic update preview
    uploadTimestamp: new Date().toISOString(),
    aqiDataAtUpload: aqiData,
    geminiAnalysis: analysis,
    locationName: aqiData.locationName, // Useful for vector search
  };
  
  console.log("Mock SkyRecord created:", mockRecord);
  // Alert moved to App.tsx for better status management
  
  return mockRecord;
};

// Example function for fetching records (also mocked)
export const fetchSkyRecordsByLocation = async (locationName: string): Promise<SkyRecord[]> => {
    console.log(`(MOCK) Fetching sky records for location: ${locationName}`);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    // Return mock data. In a real app, this would come from a backend performing a vector search.
    // Create a few more diverse mock records
    const mockResults: SkyRecord[] = [
        { 
          id: "mock1_paris_cloudy", 
          imageUrl: `https://placekitten.com/300/200?image=${Math.floor(Math.random()*16)}`, // Random kitten placeholder
          uploadTimestamp: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
          aqiDataAtUpload: { 
            ...DEFAULT_AQI_DATA, 
            isValid: true,
            locationName: locationName, 
            overallAqi: 65, 
            city: locationName.split(',')[0]?.trim() || locationName,
            aqiCategoryName: 'Moderate',
            aqiCategoryTheme: 'warning',
            dominantPollutant: 'PM2.5'
          },
          geminiAnalysis: "Mock Analysis: Sky appears hazy with some cloud cover. AQI suggests moderate pollution, potentially correlating with visual haze. Advise sensitive groups to limit prolonged outdoor exertion.",
          locationName: locationName
        },
        { 
          id: "mock2_london_clear", 
          imageUrl: `https://placekitten.com/301/201?image=${Math.floor(Math.random()*16)}`,
          uploadTimestamp: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days ago
          aqiDataAtUpload: { 
            ...DEFAULT_AQI_DATA, 
            isValid: true,
            locationName: locationName, 
            overallAqi: 30, 
            city: locationName.split(',')[0]?.trim() || locationName,
            aqiCategoryName: 'Good',
            aqiCategoryTheme: 'success',
            dominantPollutant: 'O3'
          },
          geminiAnalysis: "Mock Analysis: Clear blue skies visible. Low AQI indicates good air quality, consistent with the clear view. Excellent day for outdoor activities.",
          locationName: locationName
        },
    ];

    // If the location matches a common one, add more specific mocks, otherwise return generic ones.
    if (locationName.toLowerCase().includes("error")) { // If current AQI data has an error
        return [];
    }

    console.log("(MOCK) Fetched records for " + locationName + ":", mockResults);
    return mockResults;
};