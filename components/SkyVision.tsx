
import React, { useState, useRef, useCallback } from 'react';
import { AQIData } from '../types';
import Card from './common/Card';
import Button from './common/Button';
import LoadingSpinner from './LoadingSpinner';

interface SkyVisionProps {
  aqiData: AQIData | null;
  onAnalyzeImage: (prompt: string, imageBase64: string, mimeType: string) => Promise<string>;
  onSaveRecord: (imageBase64: string, mimeType: string, aqiData: AQIData, analysis: string) => void;
  isLoading: boolean; // This is the global loading state from App.tsx
}

const SkyVision: React.FC<SkyVisionProps> = ({ 
    aqiData, 
    onAnalyzeImage, 
    onSaveRecord,
    isLoading // Global loading from App.tsx
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isAnalyzingImage, setIsAnalyzingImage] = useState<boolean>(false); // Internal loading state for analysis
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setError('Unsupported image format. Please upload JPG, PNG, or WEBP.');
        setAnalysisResult('');
        setImagePreview(null);
        setImageBase64(null);
        setMimeType(null);
        return;
      }
      setError('');
      setAnalysisResult('');
      setMimeType(file.type);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setImageBase64(base64String);
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleAnalyzeImage = useCallback(async () => {
    if (!imageBase64 || !mimeType || !aqiData || !aqiData.isValid) {
      setError("Please upload an image and ensure valid AQI data is loaded before analysis.");
      return;
    }
    setIsAnalyzingImage(true);
    setError('');
    setAnalysisResult('');

    const context = `Image taken near ${aqiData.city}, where AQI is ${aqiData.overallAqi} (${aqiData.aqiCategoryName}) with dominant pollutant ${aqiData.dominantPollutant}.`;
    const prompt = `You are an environmental analyst. **Context:** ${context}\n\n**Your Task:** Provide a concise, 3-part markdown analysis of the image:\n\n1.  **Visual Sky Assessment:** Describe sky color, visibility, and haze.\n2.  **Corroboration:** Compare visuals with the sensor data. Explain correlations or discrepancies.\n3.  **Advisory:** Provide a brief health advisory based on all available information (visuals and sensor data).`;

    try {
      const analysisText = await onAnalyzeImage(prompt, imageBase64, mimeType);
      setAnalysisResult(analysisText);
      // Automatically call save record after successful analysis
      onSaveRecord(imageBase64, mimeType, aqiData, analysisText);
    } catch (e: any) {
      console.error("SkyVision: Image analysis failed. Original error:", e.cause || e);
      const userFriendlyMessage = e.message || "Image analysis failed unexpectedly. Please try again later.";
      setError(userFriendlyMessage); 
      setAnalysisResult(`Analysis Error: ${userFriendlyMessage}`);
    } finally {
      setIsAnalyzingImage(false);
    }
  }, [imageBase64, mimeType, aqiData, onAnalyzeImage, onSaveRecord]);

  const canAnalyze = imagePreview && aqiData && aqiData.isValid;

  return (
    <Card title="Sky Vision AI Analysis" className="flex flex-col h-full">
      <div className="flex space-x-2 mb-4">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleImageUpload}
          ref={fileInputRef}
          className="hidden"
        />
        <Button 
          onClick={triggerFileUpload} 
          variant="success" 
          disabled={isLoading || isAnalyzingImage} 
          className="flex-1"
        >
          Upload Sky Image
        </Button>
        <Button 
          onClick={handleAnalyzeImage} 
          disabled={!canAnalyze || isLoading || isAnalyzingImage} 
          isLoading={isAnalyzingImage} 
          className="flex-1"
        >
          Analyze with Gemini
        </Button>
      </div>

      {error && <p className="text-red-500 text-sm mb-2 text-center p-2 bg-red-50 rounded-md">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow min-h-[300px] md:min-h-[400px]">
        <div className="border border-slate-200 rounded-lg p-2 flex items-center justify-center bg-slate-50 min-h-[200px] md:min-h-0">
          {imagePreview ? (
            <img src={imagePreview} alt="Sky preview" className="max-h-full max-w-full object-contain rounded" />
          ) : (
            <p className="text-slate-400">Upload an image to see a preview.</p>
          )}
        </div>
        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 overflow-y-auto custom-scrollbar min-h-[200px] md:min-h-0">
          <h3 className="font-semibold text-slate-700 mb-2">Gemini AI Analysis:</h3>
          {isAnalyzingImage && <div className="flex justify-center items-center h-full"><LoadingSpinner /></div>}
          {!isAnalyzingImage && analysisResult ? (
            analysisResult.startsWith("Analysis Error:") ? 
            <p className="text-red-600">{analysisResult}</p> :
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: analysisResult.replace(/\n/g, '<br/>') }}></div>
          ) : (
            !isAnalyzingImage && !analysisResult && <p className="text-slate-400">Analysis results will appear here.</p>
          )}
        </div>
      </div>
    </Card>
  );
};

export default SkyVision;
