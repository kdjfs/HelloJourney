export interface Location {
  longitude: number
  latitude: number
}

export type VerificationStatus = 'verified' | 'real_route' | 'live_weather' | 'ai_suggested' | 'needs_verification'

export interface VerificationMetadata {
  source?: string
  provider?: string
  verified_at?: string
  verification_status?: VerificationStatus
}

export interface Attraction extends VerificationMetadata {
  name: string
  address: string
  location: Location
  visit_duration: number
  start_time?: string
  end_time?: string
  description: string
  category?: string
  rating?: number
  photos?: string[]
  poi_id?: string
  image_url?: string
  ticket_price?: number
  reservation_required?: boolean
  reservation_tips?: string
}

export interface Meal extends VerificationMetadata {
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | string
  name: string
  address?: string
  location?: Location
  description?: string
  estimated_cost?: number
}

export interface Hotel extends VerificationMetadata {
  name: string
  address: string
  location?: Location
  price_range: string
  rating: string
  distance: string
  type: string
  estimated_cost?: number
  poi_id?: string
}

export interface DayPlan {
  date: string
  day_index: number
  city?: string
  is_transfer_day?: boolean
  transfer_info?: string
  description: string
  transportation: string
  accommodation: string
  hotel?: Hotel
  attractions: Attraction[]
  meals: Meal[]
}

export interface WeatherInfo extends VerificationMetadata {
  date: string
  city?: string
  day_weather: string
  night_weather: string
  day_temp: number | string
  night_temp: number | string
  wind_direction: string
  wind_power: string
}

export interface Budget {
  total_attractions: number
  total_hotels: number
  total_meals: number
  total_transportation: number
  total_inter_city_transport?: number
  total: number
}

export interface TripPlan {
  city: string
  cities?: string[]
  start_date: string
  end_date: string
  days: DayPlan[]
  weather_info: WeatherInfo[]
  overall_suggestions: string
  budget?: Budget
}

export interface GraphNode {
  id: string
  name: string
  category: number
  symbolSize: number
  itemStyle?: { color: string }
  value?: string
}

export interface GraphEdge {
  source: string
  target: string
  label?: string
}

export interface GraphCategory {
  name: string
}

export interface KnowledgeGraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  categories: GraphCategory[]
}

export type ReviewSeverity = 'INFO' | 'WARNING' | 'ERROR'

export interface ReviewIssue {
  path: string
  code: string
  message: string
  severity: ReviewSeverity
}

export interface TripReviewResult {
  pass: boolean
  warnings: ReviewIssue[]
  errors: ReviewIssue[]
  suggestedFixes: string[]
}

export interface TripPlanResponse {
  success: boolean
  message: string
  plan_id?: string
  data?: TripPlan
  graph_data?: KnowledgeGraphData
  review?: TripReviewResult
}

export interface CityStay {
  city: string
  days: number
}

export interface TripFormData {
  city: string
  cities?: CityStay[]
  start_date: string
  end_date: string
  travel_days: number
  transportation: string
  accommodation: string
  preferences: string[]
  free_text_input?: string
  language?: string
  travelers?: number
  budget_limit?: number
}

export type TripTaskStatus = 'processing' | 'completed' | 'failed' | 'cancelled'

export type TripTaskStage =
  | 'submitted'
  | 'initializing'
  | 'attraction_search'
  | 'weather_search'
  | 'hotel_search'
  | 'planning'
  | 'review'
  | 'graph_building'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface TripTaskEvent {
  task_id: string
  plan_id: string
  status: TripTaskStatus
  stage: TripTaskStage
  progress: number
  message: string
  error?: string
  result?: TripPlanResponse
}

export interface TripHistoryItem {
  plan_id: string
  task_id: string
  city: string
  start_date: string
  end_date: string
  travel_days: number
  updated_at: string
  overall_suggestions?: string
}

export interface LlmProviderStatus {
  key: string
  name: string
  model: string
  configured: boolean
  active: boolean
}

export interface BackendRuntimeSettings {
  tencent_maps_configured: boolean
  google_maps_configured: boolean
  xhs_configured: boolean
  llm_active_provider: string
  llm_providers: LlmProviderStatus[]
}

export interface RuntimeSettings extends BackendRuntimeSettings {
  api_base_url: string
}

export interface ChatMessage {
  role: 'user' | 'assistant' | string
  content: string
}

export interface TripChatRequest {
  message: string
  trip_plan: TripPlan | Record<string, unknown>
  history: ChatMessage[]
}

export interface TripChatResponse {
  success: boolean
  reply: string
}

export interface POIInfo {
  id: string
  name: string
  type: string
  address: string
  location: Location
  tel?: string
}

export interface AttractionImageResult {
  imageUrl: string
  provider: string
  matchedName: string
  matchedPoiId: string
  confidence: number
  verified: boolean
}

export interface AttractionPhotoResponse {
  success: boolean
  message: string
  data: AttractionImageResult
}
