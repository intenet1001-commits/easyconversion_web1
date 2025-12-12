// 파일 형식
export type MediaFormat = 'mp4' | 'mp3' | 'mov' | 'wav';
export type DocumentFormat = 'pdf' | 'docx' | 'pptx' | 'md' | 'html';
export type YouTubeFormat = 'mp4' | 'mp3';

// 파일 정보
export interface FileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
}

// 변환 진행 상태
export interface ConversionProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
  outputUrl?: string;
}

// 미디어 분할 모드
export type SplitMode = 'timepoints' | 'segments';

// 문서 분할 모드
export type DocumentSplitMode = 'ranges' | 'equal' | 'pageCount' | 'heading' | 'section';

// API 응답
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 세션 정보
export interface SessionInfo {
  sessionId: string;
  createdAt: number;
  expiresAt: number;
}
