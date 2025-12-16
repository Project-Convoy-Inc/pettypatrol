export enum ViewState {
  ONBOARDING = 'ONBOARDING',
  HOME = 'HOME',
  CAPTURE = 'CAPTURE',
  ANALYZING = 'ANALYZING',
  MANUAL_ENTRY = 'MANUAL_ENTRY',
  LOCATION_PICKER = 'LOCATION_PICKER',
  BEHAVIOR_PICKER = 'BEHAVIOR_PICKER',
  CELEBRATION = 'CELEBRATION',
  PREVIOUS_REPORTS = 'PREVIOUS_REPORTS',
  DEALS = 'DEALS',
  LIVE = 'LIVE',
  BADGES = 'BADGES',
  SETTINGS = 'SETTINGS',
  EDITOR = 'EDITOR',
  FEEDBACK = 'FEEDBACK'
}

export interface Behavior {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  icon: string;
  requiredBehaviorId?: string; // If null, it's special (e.g., Legendary)
}

export interface LicensePlateReport {
  id: string;
  plateText: string;
  behaviors: string[]; // array of Behavior IDs
  customNote?: string;
  timestamp: number;
  location?: string;
  coordinates?: { lat: number; lng: number };
}

export interface Deal {
  id: string;
  partnerName: string;
  offer: string;
  description: string;
  qrCodeId: string;
  claimed: boolean;
  color: string;
  location: string;
}

export enum AnalysisType {
  LICENSE_PLATE = 'LICENSE_PLATE',
  QR_CODE = 'QR_CODE',
  INVALID = 'INVALID'
}

export interface AnalysisResult {
  type: AnalysisType;
  value: string; // Plate text or QR content
  confidence: number;
}