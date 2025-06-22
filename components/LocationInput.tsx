
import React, { useState } from 'react';
import Card from './common/Card';
import Button from './common/Button';

interface LocationInputProps {
  onFetchByInput: (query: string) => void;
  onFetchByIp: () => void;
  isLoading: boolean;
  initialLocationQuery?: string;
}

const LocationInput: React.FC<LocationInputProps> = ({ 
    onFetchByInput, 
    onFetchByIp, 
    isLoading,
    initialLocationQuery = "Enter city, or lat,lon" 
}) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onFetchByInput(query.trim());
    }
  };

  return (
    <Card title="Location" className="mb-6">
      <form onSubmit={handleSubmit} className="space-y-3 md:space-y-0 md:flex md:space-x-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={initialLocationQuery}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
          disabled={isLoading}
        />
        <Button type="submit" variant="primary" isLoading={isLoading} disabled={isLoading || !query.trim()} className="w-full md:w-auto">
          Fetch AQI
        </Button>
        <Button type="button" variant="info" onClick={onFetchByIp} isLoading={isLoading} disabled={isLoading} className="w-full md:w-auto">
          My Location
        </Button>
      </form>
    </Card>
  );
};

export default LocationInput;
