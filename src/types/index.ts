/**
 * @file types/index.ts
 * @description Shared TypeScript interfaces and types used across the
 *              ThirdEye client application. These mirror the MongoDB document
 *              shapes returned by the server API.
 */

// ── User ──────────────────────────────────────────────────────────────────────

export type RoleType = 'admin' | 'instructor' | 'student';

export interface IUser {
  _id:         string;
  name:        string;
  email:       string;
  role:        RoleType;
  avatarColor: string;
  createdAt?:  string;
}

// ── Session ───────────────────────────────────────────────────────────────────

export type SessionStatusType = 'scheduled' | 'active' | 'completed' | 'expired';

export interface ISession {
  _id:              string;
  title:            string;
  description:      string;
  instructor:       IUser;
  enrolledStudents: IUser[];
  startTime:        string;
  durationMinutes:  number;
  endTime:          string | null;
  status:           SessionStatusType;
  roomCode:         string | null;
  createdAt:        string;
}

// ── Room ──────────────────────────────────────────────────────────────────────

export interface IRoom {
  _id:       string;
  session:   string;
  roomCode:  string;
  isLocked:  boolean;
  createdAt: string;
  endedAt:   string | null;
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export interface IChatMessage {
  _id:        string;
  senderId:   string;
  senderName: string;
  content:    string;
  timestamp:  string;
}

// ── Engagement ────────────────────────────────────────────────────────────────

export type EngagementLevelType = 'very_low' | 'low' | 'high' | 'very_high';

/** Shorthand alias used throughout Phase 2 UI components */
export type EngagementLabel = EngagementLevelType;

/** Shape returned by the client-side MediaPipe inference engine */
export interface IEngagementResult {
  label:       EngagementLabel;
  confidence:  number;   // 0.0 – 1.0
  score:       number;   // raw weighted score 0.0 – 1.0
  faceStats: {
    faceDetected:  boolean;
    eyesDetected:  number; // 0, 1, or 2
    faceCentered:  boolean;
    earAvg:        number;
  };
}

/** Socket.IO event payload — student broadcasts their label to the room every 3s */
export interface IPeerEngagementEvent {
  socketId:        string;
  engagementLevel: EngagementLabel;
}

/** One time-stamped engagement data point for the instructor sparkline chart */
export interface IEngagementDataPoint {
  timestamp:    number;          // Unix ms — Date.now()
  label:        EngagementLabel;
  score:        number;          // 0.0 – 1.0 numeric aggregate of all peers
  counts: {
    very_high: number;
    high:      number;
    low:       number;
    very_low:  number;
  };
}

// ── WebRTC / Peers ────────────────────────────────────────────────────────────

/** Represents a remote participant in the video call */
export interface IPeer {
  socketId:     string;
  userId:       string;
  displayName:  string;
  stream:       MediaStream | null;
  screenStream: MediaStream | null;
  isMuted:      boolean;
  isCamOff:     boolean;
  isSpeaking:   boolean;
}

// ── API Response wrappers ─────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data:    T;
}

export interface ApiError {
  success: false;
  message: string;
}
