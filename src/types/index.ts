// TypeScript definitions for Calculator App with Secret Vault

export interface CalculatorState {
  display: string;
  previousValue: number | null;
  operation: string | null;
  waitingForNewValue: boolean;
  memory: number;
  history: CalculationHistory[];
}

export interface CalculationHistory {
  id: string;
  expression: string;
  result: string;
  timestamp: Date;
}

export interface GesturePoint {
  x: number;
  y: number;
  timestamp: number;
}

export interface GesturePattern {
  points: GesturePoint[];
  isValid: boolean;
  confidence: number;
}

export interface VaultFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadDate: Date;
  encryptedData: ArrayBuffer;
  preview?: string;
  category?: string;
}

export interface VaultState {
  isUnlocked: boolean;
  files: VaultFile[];
  currentFile: VaultFile | null;
  searchQuery: string;
  selectedCategory: string;
}

export interface PinConfig {
  hash: string;
  attempts: number;
  lockoutUntil: Date | null;
  isFirstTime: boolean;
}

export interface SecuritySettings {
  maxAttempts: number;
  lockoutDuration: number; // in minutes
  sessionTimeout: number; // in minutes
}

export interface FileUploadProgress {
  fileId: string;
  progress: number;
  status: 'uploading' | 'encrypting' | 'complete' | 'error';
  error?: string;
}

export interface VaultSession {
  id: string;
  startTime: Date;
  lastActivity: Date;
  isActive: boolean;
}

export type CalculatorOperation = 
  | 'add' 
  | 'subtract' 
  | 'multiply' 
  | 'divide' 
  | 'equals' 
  | 'clear' 
  | 'clearEntry'
  | 'sin'
  | 'cos' 
  | 'tan'
  | 'log'
  | 'ln'
  | 'sqrt'
  | 'square'
  | 'power'
  | 'percent'
  | 'negate';

export type MemoryOperation = 'clear' | 'recall' | 'add' | 'subtract' | 'store';

export type VaultAction = 
  | 'upload'
  | 'download' 
  | 'delete'
  | 'preview'
  | 'search'
  | 'category';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface VaultApiEndpoints {
  upload: '/api/vault/files';
  download: '/api/vault/files/[id]';
  delete: '/api/vault/files/[id]';
  list: '/api/vault/files';
  auth: '/api/vault/auth';
}