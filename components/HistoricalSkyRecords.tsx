import React from 'react';
import { SkyRecord } from '../types';
import Card from './common/Card';
import LoadingSpinner from './LoadingSpinner';

interface HistoricalSkyRecordsProps {
  records: SkyRecord[];
  isLoading: boolean;
  currentLocationName?: string;
}

const HistoricalSkyRecords: React.FC<HistoricalSkyRecordsProps> = ({ records, isLoading, currentLocationName }) => {
  const cardTitle = currentLocationName 
    ? `Historical Sky View: ${currentLocationName}` 
    : "Historical Sky View";

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-10">
          <LoadingSpinner size="md" />
        </div>
      );
    }

    if (records.length === 0) {
      return (
        <p className="text-slate-500 text-center py-10">
          {currentLocationName 
            ? `No historical sky records found for ${currentLocationName}.`
            : "No historical sky records found."}
          <br />
          Upload an image via Sky Vision to start a visual history.
        </p>
      );
    }

    return (
      <div className="space-y-4">
        {records.map((record) => (
          <div key={record.id} className="p-3 border border-slate-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col sm:flex-row sm:space-x-4">
              <img 
                src={record.imageUrl} 
                alt={`Historical sky view for ${record.locationName} on ${new Date(record.uploadTimestamp).toLocaleDateString()}`}
                className="w-full sm:w-40 h-auto sm:h-32 object-cover rounded-md mb-3 sm:mb-0 flex-shrink-0" 
                onError={(e) => {
                  // Fallback for broken images from mock or actual service in future
                  const target = e.target as HTMLImageElement;
                  target.onerror = null; // Prevent infinite loop
                  target.src = "https://via.placeholder.com/150/CCCCCC/FFFFFF?text=Image+Error";
                }}
              />
              <div className="flex-grow">
                <p className="text-xs text-slate-500">
                  Uploaded: {new Date(record.uploadTimestamp).toLocaleString()}
                </p>
                <p className="text-sm font-semibold text-slate-700">
                  {record.locationName}
                </p>
                <p className={`text-sm font-medium ${
                    record.aqiDataAtUpload.aqiCategoryTheme === 'success' ? 'text-green-600' :
                    record.aqiDataAtUpload.aqiCategoryTheme === 'warning' ? 'text-yellow-600' :
                    record.aqiDataAtUpload.aqiCategoryTheme === 'danger' ? 'text-red-600' :
                    'text-slate-500'
                }`}>
                  AQI at upload: {record.aqiDataAtUpload.overallAqi} ({record.aqiDataAtUpload.aqiCategoryName})
                </p>
                <p className="text-xs text-slate-600">
                  Dominant: {record.aqiDataAtUpload.dominantPollutant}
                </p>
                 <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-blue-600 hover:text-blue-800">View Gemini Analysis</summary>
                  <div 
                    className="mt-1 prose prose-xs max-w-none p-2 bg-slate-50 rounded custom-scrollbar overflow-y-auto max-h-28 text-slate-700" 
                    dangerouslySetInnerHTML={{ __html: record.geminiAnalysis.replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>') }}
                  ></div>
                </details>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card title={cardTitle} className="flex flex-col">
      <div className="flex-grow overflow-y-auto custom-scrollbar max-h-[400px] md:max-h-[500px]"> 
        {renderContent()}
      </div>
    </Card>
  );
};

export default HistoricalSkyRecords;