
import React from 'react';

export const DEFAULT_MRC_LOGO = "https://placehold.co/400x400/065f46/ffffff?text=MRC+LOGO";
export const DEFAULT_COA_LOGO = "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Coat_of_arms_of_Zambia.svg/200px-Coat_of_arms_of_Zambia.svg.png";

export const STATION_COORDS: Record<string, { lat: number; lng: number }> = {
  "Lusaka": { lat: -15.4167, lng: 28.2833 },
  "Kitwe": { lat: -12.8167, lng: 28.2000 },
  "Solwezi": { lat: -12.1833, lng: 26.4000 },
  "Mansa": { lat: -11.2000, lng: 28.8833 },
  "Chipata": { lat: -13.6333, lng: 32.6500 },
  "Mkushi": { lat: -13.6167, lng: 29.3833 },
  "Choma": { lat: -16.8167, lng: 26.9833 }
};

export const DISTRICTS = [
  { name: "Lusaka", lat: -15.4167, lng: 28.2833 },
  { name: "Kitwe", lat: -12.8167, lng: 28.2 },
  { name: "Ndola", lat: -12.9667, lng: 28.6333 },
  { name: "Solwezi", lat: -12.1833, lng: 26.4 },
  { name: "Mansa", lat: -11.2, lng: 28.8833 },
  { name: "Chipata", lat: -13.6333, lng: 32.65 },
  { name: "Kabwe", lat: -14.4333, lng: 28.45 },
  { name: "Livingstone", lat: -17.85, lng: 25.85 },
  { name: "Choma", lat: -16.8167, lng: 26.9833 },
  { name: "Mazabuka", lat: -15.85, lng: 27.75 },
  { name: "Mkushi", lat: -13.6167, lng: 29.3833 },
  { name: "Mongu", lat: -15.2667, lng: 23.1333 },
  { name: "Kasama", lat: -10.2129, lng: 31.1808 },
  { name: "Mpika", lat: -11.8343, lng: 31.4529 },
  { name: "Petauke", lat: -14.2426, lng: 31.3253 },
  { name: "Serenje", lat: -13.2325, lng: 30.2352 },
  { name: "Chinsali", lat: -10.5414, lng: 32.0816 },
  { name: "Chingola", lat: -12.5286, lng: 27.8481 },
  { name: "Mufulira", lat: -12.55, lng: 28.2333 },
  { name: "Luanshya", lat: -13.1333, lng: 28.4167 },
  { name: "Kalulushi", lat: -12.8333, lng: 28.1167 },
  { name: "Chililabombwe", lat: -12.3667, lng: 27.8333 },
  { name: "Nakonde", lat: -9.3167, lng: 32.75 },
  { name: "Mwinilunga", lat: -11.7333, lng: 24.4167 },
  { name: "Monze", lat: -16.2833, lng: 27.4833 },
  { name: "Lundazi", lat: -12.2833, lng: 33.1667 }
];

export const RATE_GROUPS = {
  groupA: ["Lusaka", "Livingstone", "Solwezi"],
  groupB: ["Chipata", "Mongu", "Kasama", "Kitwe", "Mansa", "Kabwe", "Chingola", "Ndola", "Choma", "Chinsali"]
};

export const ROLES = [
  { label: 'Manager Survey', division: 'I' },
  { label: 'Senior Mine Surveyor', division: 'I' },
  { label: 'Mine Surveyor', division: 'I' },
  { label: 'Assistant Mine Surveyor', division: 'II' },
  { label: 'Driver', division: 'III' }
];

export const BANK_DETAILS = {
  accountName: "MAP PRODUCTION FUNDS",
  bankName: "ZAMBIA NATIONAL COMMERCIAL BANK",
  branch: "CIVIC CENTRE",
  accountNumber: "0020756300173",
  swiftCode: "ZNCOZMLU"
};
