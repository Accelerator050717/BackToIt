export type Language = 'zh-CN' | 'en';
export type TaskStatus = 'active' | 'paused' | 'completed' | 'archived';
export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  progress: string;
  blocker: string;
  nextStep: string;
  primaryResourceId: string | null;
  createdAt: number;
  updatedAt: number;
  revision: number;
  isExample: boolean;
}
export interface Resource {
  id: string;
  taskId: string;
  title: string;
  url: string | null;
  excerpts: string[];
  note: string;
  source: 'page' | 'selection' | 'manual';
  savedAt: number;
  revision: number;
}
export interface Checkpoint {
  id: string;
  taskId: string;
  progress: string;
  blocker: string;
  nextStep: string;
  resourceIds: string[];
  createdAt: number;
}
export interface ParkingItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
  updatedAt: number;
}
export interface AppSnapshot {
  tasks: Task[];
  resources: Resource[];
  checkpoints: Checkpoint[];
  parking: ParkingItem[];
  currentTaskId: string | null;
}
export interface ResourceInput {
  title: string;
  url: string | null;
  excerpt?: string;
  note?: string;
  source: Resource['source'];
}
export interface TaskFields {
  progress: string;
  blocker: string;
  nextStep: string;
}
export interface CaptureDraft {
  title: string;
  url: string;
  excerpt?: string;
  source: Resource['source'];
  truncated?: boolean;
  error?: string;
}
export interface OllamaConfig {
  enabled: boolean;
  endpoint: 'http://localhost:11434' | 'http://127.0.0.1:11434';
  model: string;
}
export interface Settings {
  language: Language;
  appearance: 'light' | 'system';
  ollama: OllamaConfig;
}
export interface Backup {
  schemaVersion: 1;
  exportedAt: number;
  tasks: Task[];
  resources: Resource[];
  checkpoints: Checkpoint[];
  parking: ParkingItem[];
}
