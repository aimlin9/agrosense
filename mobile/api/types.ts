export interface Farmer {
  id: string;
  phone_number: string | null;
  full_name: string | null;
  email: string | null;
  region: string | null;
  district: string | null;
  primary_crop: string | null;
  preferred_language: string;
  is_sms_user: boolean;
  created_at: string;
  gps_lat: number | null;
  gps_lng: number | null;
  auth_provider: string;
  profile_complete: boolean;
  profile_picture_url: string | null;
}

export interface Crop {
  id: string;
  name: string;
  raw_name: string;
  local_name: string | null;
  condition_count: number;
  supported: boolean;
}

export interface Prediction {
  class_name: string;
  display_name: string | null;
  confidence: number;
}

export interface TreatmentAdvice {
  severity: string;
  summary: string;
  immediate_actions: string[];
  organic_treatment: string | null;
  chemical_treatment: string | null;
  prevention: string | null;
}

export interface DiagnosisDetail {
  id: string;
  crop_name: string;
  image_url: string | null;
  predicted_disease: string;
  confidence: number;
  is_healthy: boolean;
  low_confidence?: boolean;
  crop_supported?: boolean;
  advice_source?: 'ai' | 'curated';
  guide_slug?: string | null;
  top_predictions: Prediction[];
  treatment_advice: TreatmentAdvice | null;
  processing_time_ms: number;
  channel?: string;
  status?: string;
  expert_review?: { is_ai_correct: boolean | null; notes: string | null; reviewed_at: string } | null;
  created_at: string;
  /** Local-only: the photo on the device, used when the server didn't keep one. */
  local_image_uri?: string;
}

export interface DiagnosisListItem {
  id: string;
  crop_name: string;
  predicted_disease: string;
  confidence: number;
  is_healthy: boolean;
  image_url: string | null;
  channel: string;
  status: string;
  created_at: string;
}

export interface DiagnosisStats {
  total: number;
  today: number;
  last_7_days: number;
  healthy: number;
  issues_found: number;
}

export interface LatestPrice {
  crop_id: string;
  crop_name: string;
  market_name: string;
  region: string | null;
  price_per_kg: string;
  price_per_bag: string | null;
  change_pct_7d: number | null;
  trend: 'up' | 'down' | 'stable';
  recorded_at: string;
  source: string | null;
  history: string[];
}

export interface CurrentConditions {
  temperature_c: number | null;
  humidity_pct: number | null;
  precipitation_mm: number | null;
  wind_kph: number | null;
  weather_code: number | null;
}

export interface DailyForecast {
  date: string;
  temp_max_c: number | null;
  temp_min_c: number | null;
  precipitation_mm: number | null;
  precipitation_probability_pct: number | null;
  wind_max_kph: number | null;
  weather_code: number | null;
}

export interface WeatherResponse {
  latitude: number;
  longitude: number;
  timezone: string | null;
  current: CurrentConditions | null;
  daily: DailyForecast[];
  stale?: boolean;
}

export interface AdvisoryResponse {
  headline: string;
  rainfall_outlook: string;
  temperature_outlook: string;
  recommendations: string[];
  warnings: string[];
  crop_name?: string | null;
  source?: 'ai' | 'rules';
}

export interface GuideSummary {
  slug: string;
  crop: string;
  name: string;
  pathogen: string;
  type: string;
  severity: 'low' | 'moderate' | 'high';
  summary: string;
}

export interface GuideEntry extends GuideSummary {
  class_name: string;
  symptoms: string[];
  conditions: string;
  spread: string;
  cultural: string[];
  organic: string;
  chemical: string;
  prevention: string[];
}

export interface FarmPlot {
  id: string;
  farmer_id: string;
  name: string;
  crop_id: string | null;
  crop_name: string | null;
  size_acres: number | null;
  gps_lat: number | null;
  gps_lng: number | null;
  planting_date: string | null;
  expected_harvest_date: string | null;
  soil_type: string | null;
  irrigation_type: string | null;
  notes: string | null;
}
