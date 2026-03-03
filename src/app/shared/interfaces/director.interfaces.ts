// === Event & Score Models ===
export interface EventScore {
  interestingness: number;
  urgency: number;
  conversational_value: number;
  emotional_intensity: number;
  topic_relevance: number;
}

export interface ScoredEvent {
  score: number;
  scores: EventScore;
  timestamp: number;
  text: string;
  source: string;
  id: string;
}

// === Directive Models ===
export interface Directive {
  objective: string;
  tone: string;
  constraints: string[];
  topic_focus: string;
  suggested_action: string;
  reasoning: string;
}

// === User Profile Models ===
export interface UserFact {
  content: string;
  timestamp: number;
  category: string;
  usage_count: number;
  last_used: number;
}

export interface UserRelationship {
  tier: string;
  affinity: number;
  vibe: string;
}

export interface UserProfile {
  username: string;
  nickname: string;
  role: string;
  is_adult: boolean;
  created_at: number;
  last_seen: number;
  relationship: UserRelationship;
  facts: UserFact[];
  nami_opinions: string[];
}

// === Memory Models ===
export interface Memory {
  source: string;
  text: string;
  score: number;
  type: string;
}

// === Adaptive Controller Models ===
export interface SocialBattery {
  current: number;
  max: number;
  percent: number;
}

export interface AdaptiveState {
  threshold: number;
  state: string;
  chat_velocity: number;
  energy: number;
  social_battery: SocialBattery;
  current_goal: string;
  current_scene: string;
}

// === Main Director State ===
export interface DirectorState {
  summary: string;
  raw_context: string;
  prediction: string;
  mood: string;
  conversation_state: string;
  flow: string;
  intent: string;
  active_user: UserProfile | null;
  memories: Memory[];
  directive: Directive | null;
  adaptive: AdaptiveState;
  manual_context: string;
  current_streamer: string;
  streamer_locked: boolean;
  context_locked: boolean;
}

// === Socket Event Payloads ===
export interface VisionContext { context: string; }
export interface SpokenWordContext { context: string; }
export interface AudioContext {
  context: string;
  is_partial: boolean;
  session_id?: string;
}

export interface TwitchMessage {
  username: string;
  message: string;
}

export interface BotReply {
  reply: string;
  prompt: string;
  is_censored: boolean;
  censorship_reason: string | null;
  filtered_area: string | null;
}

export interface AiContextSuggestion {
  streamer: string | null;
  context: string | null;
  streamer_locked: boolean;
  context_locked: boolean;
}

// === Streamer Config ===
export interface Streamer {
  id: string;
  display_name: string;
}

export interface StreamersConfig {
  streamers: Streamer[];
}

// === Service Monitor ===
export interface ServiceStatus {
  id: string;
  label: string;
  port: number;
  managed: boolean;
  status: 'online' | 'offline' | 'starting' | 'stopping' | 'unhealthy' | 'unknown';
}

// === UI / Dashboard Specific Models ===
export interface ChatMessage {
  username: string;
  message: string;
  isNami?: boolean;
  isMention?: boolean;
  timestamp?: number;
}

export interface AudioLogEntry {
  text: string;
  sessionId?: string;
  isPartial?: boolean;
  timestamp?: number;
}

export interface ScoreEntry {
  score: number;
  source: string;
  text: string;
  timestamp?: number;
}

/** Per-entry sense data included in classified_event.context.vision/audio/mic */
export interface SenseContextEntry {
  text:    string;
  iso_ts:  string;   // ISO 8601 wall-clock from source service
  unix_ts: number;   // Unix float from source service
  source:  string;   // "vision" | "audio" | "mic"
  age_s:   number;   // Age in seconds at classify time
}

/** Freshest entry age per sense at classify time (seconds). */
export interface SenseAges {
  vision?: number;
  audio?:  number;
  mic?:    number;
}


export interface ClassifiedEvent {
  event:          string;
  confidence:     number;
  summary:        string;
  timestamp:      string;
  sense_ages:     SenseAges;
  context: {
    vision: SenseContextEntry[];
    audio:  SenseContextEntry[];
    mic:    SenseContextEntry[];
  };
  player_speaking: boolean;
  has_vision:      boolean;
  has_audio:       boolean;
}

/**
 * Human-readable context string from event_interpreter_service.
 * Hub event: ai_context
 */
export interface AiContextPacket {
  context:   string;
  event:     string;
  timestamp: string;
}

// Backwards-compat alias
export type SenseContextLine = SenseContextEntry;