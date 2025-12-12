// 세션 복구를 위한 유틸리티 함수

export interface SessionData {
  sessionId: string;
  activeTab: string;
  uploadedFiles: Array<{
    id: string;
    name: string;
    size: number;
    type: string;
  }>;
  lastActivity: number;
}

const SESSION_STORAGE_KEY = 'easyconversion_session';
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24시간

/**
 * 현재 세션 상태를 localStorage에 저장
 */
export function saveSession(data: SessionData): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save session:', error);
  }
}

/**
 * localStorage에서 이전 세션 복구
 * 24시간 이내의 세션만 복구
 */
export function restoreSession(): SessionData | null {
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return null;

    const data: SessionData = JSON.parse(stored);
    const now = Date.now();

    // 24시간이 지난 세션은 복구하지 않음
    if (now - data.lastActivity > SESSION_TIMEOUT) {
      clearSession();
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to restore session:', error);
    return null;
  }
}

/**
 * 세션 데이터 업데이트 (부분 업데이트)
 */
export function updateSession(updates: Partial<SessionData>): void {
  try {
    const current = restoreSession();
    if (!current) return;

    const updated: SessionData = {
      ...current,
      ...updates,
      lastActivity: Date.now(),
    };

    saveSession(updated);
  } catch (error) {
    console.error('Failed to update session:', error);
  }
}

/**
 * 세션 데이터 삭제
 */
export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear session:', error);
  }
}

/**
 * 업로드된 파일 목록에 파일 추가
 */
export function addUploadedFile(file: {
  id: string;
  name: string;
  size: number;
  type: string;
}): void {
  const current = restoreSession();
  if (!current) return;

  const uploadedFiles = [...current.uploadedFiles];

  // 중복 체크
  if (!uploadedFiles.find(f => f.id === file.id)) {
    uploadedFiles.push(file);
  }

  updateSession({ uploadedFiles });
}

/**
 * 업로드된 파일 목록에서 파일 제거
 */
export function removeUploadedFile(fileId: string): void {
  const current = restoreSession();
  if (!current) return;

  const uploadedFiles = current.uploadedFiles.filter(f => f.id !== fileId);
  updateSession({ uploadedFiles });
}

/**
 * 활성 탭 변경
 */
export function setActiveTab(tab: string): void {
  updateSession({ activeTab: tab });
}
