
export interface Coordinate {
  lat: number;
  lng: number;
}

export interface KmlSite extends Coordinate {
  id: string;
  name: string;
  rawPoints?: Coordinate[];
}

export interface PersonnelRow {
  id: string;
  role: string;
  numOfficers: number;
  numDays: number;
  dsaRate: number;
}

export interface FormData {
  attention: string;
  workDescription: string;
  personnel: PersonnelRow[];
  station: string;
  manualDistrict: string;
  customDistrictCoords: Coordinate | null;
  kmlFiles: KmlSite[];
  mrcLogo: string | null;
  coaLogo: string | null;
  fuelPrice: number;
  numVehicles: number;
  preparedBy: string;
  preparedTitle: string;
  managerSurvey: string;
  checkedTitle: string;
}

export interface CalcMetrics {
  stationToSiteDist: number;
  nearestDistrict: string | null;
  distToNearestDistrict: number;
  workingRadius: number;
  totalDistance: number;
  furthestSiteName: string;
}

export interface Totals {
  dsaTotal: number;
  fuelTotal: number;
  cumulativeTotal: number;
  contingency: number;
  grandTotal: number;
}
