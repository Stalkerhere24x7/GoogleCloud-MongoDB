
import React from 'react';
import { AQIData } from '../types';
import Card from './common/Card';

interface AQIDisplayCardProps {
  aqiData: AQIData | null;
}

const AQIDisplayCard: React.FC<AQIDisplayCardProps> = ({ aqiData }) => {
  if (!aqiData) {
    return (
      <Card title="Current Air Quality">
        <p className="text-slate-500">Awaiting data...</p>
      </Card>
    );
  }

  const getThemeColorClasses = (theme: AQIData['aqiCategoryTheme']): string => {
    switch (theme) {
      case 'success': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'danger': return 'text-red-600';
      default: return 'text-slate-500';
    }
  };

  const aqiColorClass = getThemeColorClasses(aqiData.aqiCategoryTheme);

  const pollutantEntries = Object.entries(aqiData.pollutants)
    .filter(([_, value]) => typeof value === 'number' && !isNaN(value)) // Ensure value is a valid number
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));


  return (
    <Card title="Current Air Quality" className="min-h-[250px]">
      <div className="flex items-center mb-4">
        <div className={`text-7xl font-bold mr-4 ${aqiColorClass}`}>
          {aqiData.isValid ? aqiData.overallAqi : '--'}
        </div>
        <div>
          <div className={`text-2xl font-semibold ${aqiColorClass}`}>
            {aqiData.aqiCategoryName}
          </div>
          <div className={`text-sm ${aqiColorClass}`}>US AQI</div>
        </div>
      </div>
      <div className="text-sm text-slate-700 leading-relaxed custom-scrollbar overflow-y-auto max-h-32">
        <p className="font-semibold">{aqiData.locationName}</p>
        {aqiData.isValid && (
          <>
            <p>Updated: {new Date(aqiData.timestamp).toLocaleString()}</p>
            <p>Dominant Pollutant: <span className="font-semibold">{aqiData.dominantPollutant}</span></p>
            {pollutantEntries.length > 0 && (
              <div>
                <p className="mt-1 font-medium">Pollutants:</p>
                <ul className="list-disc list-inside ml-1 text-xs">
                  {pollutantEntries.map(([key, value]) => (
                    <li key={key}>{key.toUpperCase()}: {value.toFixed(1)}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        {!aqiData.isValid && aqiData.aqiCategoryName !== 'No Data' && (
             <p className="text-red-500 mt-2">{aqiData.aqiCategoryName}</p>
        )}
      </div>
    </Card>
  );
};

export default AQIDisplayCard;
