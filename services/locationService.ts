
import { IP_API_URL } from '../constants';
import { IpApiLocation } from '../types';

export const getLocationFromIp = async (): Promise<IpApiLocation | null> => {
  try {
    const response = await fetch(IP_API_URL, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      console.error("Failed to fetch location from IP:", response.statusText);
      return null;
    }
    const data: IpApiLocation = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching location from IP:", error);
    return null;
  }
};
