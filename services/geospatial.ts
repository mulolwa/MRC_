
import { Coordinate } from '../types';

/**
 * Calculates the Haversine distance between two points in kilometers.
 */
export const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Parses basic KML string to extract coordinates.
 */
export const parseKML = (xmlString: string) => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");
  const coordStrings = Array.from(xmlDoc.getElementsByTagName("coordinates")).map(c => c.textContent?.trim());
  
  let allPoints: Coordinate[] = [];
  coordStrings.forEach(s => {
    if (!s) return;
    const parts = s.split(/\s+/);
    parts.forEach(p => {
      const coords = p.split(',').map(Number);
      if (!isNaN(coords[1]) && !isNaN(coords[0])) {
        allPoints.push({ lat: coords[1], lng: coords[0] });
      }
    });
  });

  if (allPoints.length === 0) return null;

  const avgLat = allPoints.reduce((s, p) => s + p.lat, 0) / allPoints.length;
  const avgLng = allPoints.reduce((s, p) => s + p.lng, 0) / allPoints.length;

  return { lat: avgLat, lng: avgLng, rawPoints: allPoints };
};

/**
 * Fetch image and convert to Base64 for PDF generation.
 */
export const fetchImageAsBase64 = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
};
