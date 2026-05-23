export interface Location {
  longitude: number
  latitude: number
}

export interface Attraction {
  name: string
  address: string
  location: Location | null
  visit_duration: number
  description: string
  category: string
  rating: number | null
  photos: string[]
  poi_id: string
  image_url: string | null
  ticket_price: number
  reservation_required: boolean
  reservation_tips: string
}

export interface Hotel {
  name: string
  address: string
  location: Location | null
  price_range: string
  rating: string
  distance: string
  type: string
  estimated_cost: number
}

export interface Meal {
  type: string
  name: string
  address: string
  location: Location | null
  description: string
  estimated_cost: number
}

export interface DayPlan {
  date: string
  day_index: number
  city: string
  is_transfer_day: boolean
  transfer_info: string
  description: string
  transportation: string
  accommodation: string
  hotel: Hotel | null
  attractions: Attraction[]
  meals: Meal[]
}

export interface WeatherInfo {
  date: string
  city: string
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
  total_inter_city_transport: number
  total: number
}

export interface TripPlan {
  city: string
  cities: string[]
  start_date: string
  end_date: string
  days: DayPlan[]
  weather_info: WeatherInfo[]
  overall_suggestions: string
  budget: Budget
}

export interface GraphNode {
  id: string
  name: string
  category: number
  symbolSize: number
  itemStyle: Record<string, any> | null
  value: string
}

export interface GraphEdge {
  source: string
  target: string
  label: string
}

export interface GraphCategory {
  name: string
}

export interface KnowledgeGraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  categories: GraphCategory[]
}

export interface TripPlanResponse {
  success: boolean
  message: string
  plan_id: string
  data: TripPlan
  graph_data: KnowledgeGraphData
}

export interface CityStay {
  city: string
  days: number
}

export interface TripRequest {
  city: string
  cities: CityStay[]
  start_date: string
  end_date: string
  travel_days: number
  transportation: string
  accommodation: string
  preferences: string[]
  free_text_input: string
  language: string
}

export interface ChatMessage {
  role: string
  content: string
}

export interface TripChatRequest {
  message: string
  trip_plan: Record<string, any>
  history: ChatMessage[]
}

export interface TripChatResponse {
  success: boolean
  message: string
  reply: string
}

export interface TripTaskEvent {
  task_id: string
  plan_id: string
  status: string
  stage: string
  progress: number
  message: string
  error?: string
  result?: TripPlanResponse
}

export interface TripHistoryItem {
  plan_id: string
  task_id: string
  city: string
  cities: string[]
  start_date: string
  end_date: string
  updated_at: string
  overall_suggestions: string
}

export interface RuntimeSettings {
  tencent_maps_key: string
  google_maps_api_key: string
  xhs_cookie: string
  llm_active_provider: string
  llm_providers: Record<string, any>[]
}

export interface RuntimeSettingsPayload {
  tencent_maps_key?: string
  google_maps_api_key?: string
  xhs_cookie?: string
  llm_active_provider?: string
  llm_providers?: Record<string, any>[]
}

export interface LlmProviderInfo {
  key: string
  name: string
  api_key: string
  base_url: string
  model: string
  available: boolean
}
