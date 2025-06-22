import React, { useState, useEffect, useCallback } from 'react';
import AQIDisplayCard from './components/AQIDisplayCard';
import LocationInput from './components/LocationInput';
import AIAssistant from './components/AIAssistant';
import SkyVision from './components/SkyVision';
import HistoricalSkyRecords from './components/HistoricalSkyRecords'; // Import new component
import LoadingSpinner from './components/LoadingSpinner';
import { AQIData, IpApiLocation, GeocodedLocation, ChatMessage, MessageSender, SkyRecord } from './types';
import { getLocationFromIp } from './services/locationService';
import { getAqiByCoords, parseWAQIData } from './services/waqiService';
import { getCoordinatesFromText, generateTextResponse, analyzeImageWithText, generateTextResponseWithGoogleSearch } from './services/geminiService';
import { saveSkyRecord as mockSaveSkyRecord, fetchSkyRecordsByLocation as mockFetchSkyRecordsByLocation } from './services/mongoService'; // Mocked
import { DEFAULT_AQI_DATA, GEMINI_API_KEY, WAQI_API_TOKEN, APP_NAME } from './constants';

const App: React.FC = () => {
  const [aqiData, setAqiData] = useState<AQIData | null>(DEFAULT_AQI_DATA);
  const [isLoading, setIsLoading] = useState<boolean>(true); // General loading for AQI fetches primarily
  const [statusMessage, setStatusMessage] = useState<string>("Initializing...");
  const [statusType, setStatusType] = useState<'info' | 'success' | 'warning' | 'danger'>('info');
  const [locationQuery, setLocationQuery] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [apiKeysMissing, setApiKeysMissing] = useState<boolean>(false);

  const [historicalSkyRecords, setHistoricalSkyRecords] = useState<SkyRecord[]>([]);
  const [isFetchingHistoricalRecords, setIsFetchingHistoricalRecords] = useState<boolean>(false);


  useEffect(() => {
    if (!GEMINI_API_KEY || !WAQI_API_TOKEN) {
      setApiKeysMissing(true);
      setStatusMessage("Critical API keys (Gemini or WAQI) are missing. Please configure them.");
      setStatusType("danger");
      setIsLoading(false);
      setAqiData({
        ...DEFAULT_AQI_DATA,
        isValid: false,
        aqiCategoryName: "API Key Error",
        locationName: "Configuration Error"
      });
      setChatHistory([{
        id: Date.now().toString(),
        sender: MessageSender.System,
        text: "Critical API keys are missing. AI Assistant and Sky Vision functionalities are limited or unavailable.",
        timestamp: new Date().toISOString(),
      }]);
      return;
    }
    fetchAqiByIp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const updateStatus = (message: string, type: 'info' | 'success' | 'warning' | 'danger', loading: boolean = false) => {
    setStatusMessage(message);
    setStatusType(type);
    setIsLoading(loading); // This controls the main loading indicator for AQI fetching
  };

  const fetchHistoricalRecordsForLocation = async (locName: string) => {
    if (apiKeysMissing || !locName || locName === 'N/A' || locName === 'Error') {
      setHistoricalSkyRecords([]); // Clear records if location is invalid or keys missing
      return;
    }
    setIsFetchingHistoricalRecords(true);
    try {
      const records = await mockFetchSkyRecordsByLocation(locName);
      setHistoricalSkyRecords(records);
    } catch (error) {
      console.error("Failed to fetch historical sky records (mock):", error);
      setHistoricalSkyRecords([]); // Clear on error
    } finally {
      setIsFetchingHistoricalRecords(false);
    }
  };

  const handleAqiDataError = (title: string, details: string) => {
    setAqiData({
      ...DEFAULT_AQI_DATA,
      isValid: false,
      aqiCategoryName: title,
      locationName: details,
    });
     setChatHistory(prev => [...prev, {
        id: Date.now().toString(),
        sender: MessageSender.System,
        text: `Data Error: ${title}. ${details}. The AI assistant will provide general advice.`,
        timestamp: new Date().toISOString(),
      }]);
    fetchHistoricalRecordsForLocation(details); // Attempt to fetch even if current AQI fails, location might still be valid
  };

  const processAqiFetch = async (lat: number, lon: number, locationDisplayName?: string) => {
    updateStatus(`Fetching AQI near (${lat.toFixed(2)}, ${lon.toFixed(2)})...`, "info", true);
    const rawAqiData = await getAqiByCoords(lat, lon);
    const parsedData = parseWAQIData(rawAqiData);

    if (parsedData.isValid) {
      const finalLocationName = locationDisplayName || parsedData.locationName;
      parsedData.locationName = finalLocationName; 
      setAqiData(parsedData);
      updateStatus("AQI data updated successfully.", "success", false);
      setChatHistory(prev => [{ 
        id: Date.now().toString(),
        sender: MessageSender.System,
        text: `Air quality data updated for ${parsedData.city}. The AQI is ${parsedData.overallAqi} (${parsedData.aqiCategoryName}). Select a prompt below for advice or ask if this info is related to recent news for Google Search grounding.`,
        timestamp: new Date().toISOString(),
      }]);
      fetchHistoricalRecordsForLocation(finalLocationName);
    } else {
      const errorReason = parsedData.aqiCategoryName || "Unknown API error or data parsing issue.";
      const errorLocationName = locationDisplayName || "Error Location";
      handleAqiDataError("AQI Data Error", errorReason);
      updateStatus(`Failed to fetch/parse AQI data for ${errorLocationName}: ${errorReason}`, "danger", false);
      // Still try to fetch historical records if locationDisplayName was provided
      if (locationDisplayName) {
        fetchHistoricalRecordsForLocation(locationDisplayName);
      } else {
        setHistoricalSkyRecords([]); // Clear historical if no valid location name.
      }
    }
  };

  const fetchAqiByIp = useCallback(async () => {
    if(apiKeysMissing) return;
    updateStatus("Detecting your location...", "info", true);
    const ipLocation: IpApiLocation | null = await getLocationFromIp();
    if (ipLocation && ipLocation.latitude && ipLocation.longitude) {
      const determinedLocationName = `${ipLocation.city}, ${ipLocation.country_code}`;
      setLocationQuery(determinedLocationName);
      await processAqiFetch(ipLocation.latitude, ipLocation.longitude, determinedLocationName);
    } else {
      updateStatus("Could not determine location via IP. Please enter manually.", "warning", false);
      handleAqiDataError("Location Error", "Could not detect location via IP.");
      setHistoricalSkyRecords([]);
    }
  }, [apiKeysMissing]); // Added apiKeysMissing dependency


  const fetchAqiByInputQuery = useCallback(async (query: string) => {
    if(apiKeysMissing) return;
    setLocationQuery(query);
    updateStatus(`Processing location: "${query}"...`, "info", true);

    const latLonRegex = /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/;
    if (latLonRegex.test(query)) {
      const [latStr, lonStr] = query.split(',');
      const lat = parseFloat(latStr);
      const lon = parseFloat(lonStr);
      await processAqiFetch(lat, lon, query);
    } else {
      const geocoded: GeocodedLocation | null = await getCoordinatesFromText(query);
      if (geocoded && geocoded.latitude !== null && geocoded.longitude !== null) {
        setLocationQuery(geocoded.identified_name); 
        await processAqiFetch(geocoded.latitude, geocoded.longitude, geocoded.identified_name);
      } else {
        updateStatus(`Could not find location: "${query}". Try coordinates or a different name.`, "danger", false);
        handleAqiDataError("Location Not Found", `Could not identify "${query}".`);
        setHistoricalSkyRecords([]);
      }
    }
  }, [apiKeysMissing]); // Added apiKeysMissing dependency
  
  const handleAskAI = useCallback(async (userQuestion: string, fullPrompt: string) => {
    if(apiKeysMissing) {
        updateStatus("AI Assistant is unavailable due to missing API keys.", "warning");
        return;
    }
    const newUserMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: MessageSender.User,
      text: userQuestion,
      timestamp: new Date().toISOString(),
    };
    setChatHistory(prev => [...prev, newUserMessage]);
    setIsLoading(true); // General loading state for AI response

    let aiResponseText = "";
    let groundingInfoText = "";

    const searchKeywords = ["recent", "news", "current events", "trending", "latest update", "who won", "what happened today"];
    const useSearch = searchKeywords.some(keyword => userQuestion.toLowerCase().includes(keyword));

    try {
      if (useSearch) {
          const { text, groundingMetadata } = await generateTextResponseWithGoogleSearch(fullPrompt);
          aiResponseText = text;
          if (groundingMetadata?.groundingChunks && groundingMetadata.groundingChunks.length > 0) {
              const sources = groundingMetadata.groundingChunks
                  .map(chunk => chunk.web ? `${chunk.web.title} (${chunk.web.uri})` : null)
                  .filter(Boolean);
              if (sources.length > 0) {
                  groundingInfoText = `\n\nGrounding sources: ${sources.join('; ')}`;
              }
          }
      } else {
          aiResponseText = await generateTextResponse(fullPrompt);
      }
    } catch (e) {
      aiResponseText = "AI service encountered an error. Please try again later."
      console.error("AI Error:", e);
    }


    const aiMessage: ChatMessage = {
      id: `ai-${Date.now()}`,
      sender: MessageSender.AI,
      text: aiResponseText + groundingInfoText,
      timestamp: new Date().toISOString(),
    };
    setChatHistory(prev => [...prev, aiMessage]);
    setIsLoading(false); // Clear general loading
  }, [apiKeysMissing]);

  const handleAnalyzeImage = useCallback(async (prompt: string, imageBase64: string, mimeType: string): Promise<string> => {
    if(apiKeysMissing) {
      updateStatus("Sky Vision is unavailable due to missing API keys.", "warning");
      throw new Error("Image analysis unavailable due to missing API keys.");
    }
    // setIsLoading(true) is handled in SkyVision component for this specific action
    const analysis = await analyzeImageWithText(prompt, imageBase64, mimeType);
    return analysis;
  }, [apiKeysMissing]);
  
  const handleSaveRecord = useCallback(async (imageBase64: string, mimeType: string, currentAqiData: AQIData, analysis: string) => {
    if(apiKeysMissing) {
        updateStatus("Cannot save record due to missing API keys.", "warning");
        return;
    }
    if (!currentAqiData.isValid) {
      updateStatus("Cannot save record: Current AQI data is invalid or missing.", "warning");
      return;
    }

    updateStatus("Submitting sky record (mock)...", "info", true); // Use general loader
    try {
      const newRecord = await mockSaveSkyRecord(imageBase64, mimeType, currentAqiData, analysis);
      if (newRecord) {
        // Optimistically add to historical records
        setHistoricalSkyRecords(prev => [newRecord, ...prev].sort((a,b) => new Date(b.uploadTimestamp).getTime() - new Date(a.uploadTimestamp).getTime()));
        updateStatus("Sky record submitted (mock) and added to local view.", "success", false);
      } else {
        updateStatus("Failed to save sky record (mock): No record returned.", "danger", false);
      }
    } catch (error: any) {
      updateStatus(`Failed to save sky record (mock): ${error.message}`, "danger", false);
    }
  }, [apiKeysMissing]);


  return (
    <div className="min-h-screen flex flex-col p-4 md:p-6 bg-slate-100">
      <header className="mb-6">
        <h1 className="text-4xl font-bold text-center text-slate-700">{APP_NAME}</h1>
        <p className="text-center text-slate-500">Intelligent Air Quality & Sky Analysis Platform</p>
      </header>

      <div className={`p-3 mb-4 rounded-md text-sm text-center ${
        statusType === 'info' ? 'bg-blue-100 text-blue-700' :
        statusType === 'success' ? 'bg-green-100 text-green-700' :
        statusType === 'warning' ? 'bg-yellow-100 text-yellow-700' :
        'bg-red-100 text-red-700'
      }`}>
        {isLoading && statusType==='info' && <LoadingSpinner size="sm" color="text-current inline-block mr-2" />}
        {statusMessage}
      </div>
      
      {apiKeysMissing && (
         <div className="bg-red-500 text-white p-4 rounded-md text-center font-bold mb-6">
           CRITICAL ERROR: API key(s) for Gemini and/or WAQI are not configured. Application functionality is severely limited.
         </div>
      )}

      <main className="flex-grow grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <AQIDisplayCard aqiData={aqiData} />
          <LocationInput 
            onFetchByInput={fetchAqiByInputQuery} 
            onFetchByIp={fetchAqiByIp} 
            isLoading={isLoading} // General loading for location/AQI fetching
            initialLocationQuery={locationQuery}
          />
          <AIAssistant 
            aqiData={aqiData} 
            chatHistory={chatHistory}
            onAskAI={handleAskAI} 
            isLoading={isLoading && chatHistory.length > 0 && chatHistory[chatHistory.length -1].sender === MessageSender.User }
          />
           <HistoricalSkyRecords
            records={historicalSkyRecords}
            isLoading={isFetchingHistoricalRecords}
            currentLocationName={aqiData?.isValid ? aqiData.locationName : undefined}
          />
        </div>

        <div className="lg:col-span-3">
          <SkyVision 
            aqiData={aqiData}
            onAnalyzeImage={handleAnalyzeImage}
            onSaveRecord={handleSaveRecord}
            isLoading={isLoading} // SkyVision uses global isLoading to disable its buttons if app is busy
          />
        </div>
      </main>

      <footer className="text-center mt-8 py-4 border-t border-slate-300">
        <p className="text-sm text-slate-500">&copy; {new Date().getFullYear()} {APP_NAME}. Powered by Mongo DB Atlas &amp; Vector Search + Google Cloud.</p>
      </footer>
    </div>
  );
};

export default App;