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

// ── WebRTC / Peers ────────────────────────────────────────────────────────────

/** Represents a remote participant in the video call */
export interface IPeer {
  socketId:    string;
  userId:      string;
  displayName: string;
  stream:      MediaStream | null;
  isMuted:     boolean;
  isCamOff:    boolean;
  isSpeaking:  boolean;
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
