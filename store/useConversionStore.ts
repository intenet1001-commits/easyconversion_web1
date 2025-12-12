import { create } from 'zustand';
import { FileInfo, ConversionProgress } from '@/types';
import { saveSession, updateSession } from '@/lib/sessionRestore';

interface ConversionStore {
  // 업로드된 파일
  files: FileInfo[];
  addFile: (file: FileInfo) => void;
  removeFile: (fileId: string) => void;
  clearFiles: () => void;
  reorderFiles: (startIndex: number, endIndex: number) => void;

  // 변환 진행 상태
  progressList: ConversionProgress[];
  updateProgress: (progress: ConversionProgress) => void;
  clearProgress: () => void;

  // 로그
  logs: string[];
  addLog: (log: string) => void;
  clearLogs: () => void;

  // 현재 탭
  activeTab: string;
  setActiveTab: (tab: string) => void;

  // 세션 ID
  sessionId: string;
  setSessionId: (id: string) => void;

  // 세션 저장
  saveCurrentSession: () => void;
}

export const useConversionStore = create<ConversionStore>((set, get) => ({
  files: [],
  addFile: (file) => {
    set((state) => ({ files: [...state.files, file] }));
    get().saveCurrentSession();
  },
  removeFile: (fileId) => {
    set((state) => ({ files: state.files.filter((f) => f.id !== fileId) }));
    get().saveCurrentSession();
  },
  clearFiles: () => set({ files: [] }),
  reorderFiles: (startIndex, endIndex) => {
    set((state) => {
      const result = Array.from(state.files);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return { files: result };
    });
    get().saveCurrentSession();
  },

  progressList: [],
  updateProgress: (progress) =>
    set((state) => {
      const index = state.progressList.findIndex((p) => p.fileId === progress.fileId);
      if (index >= 0) {
        const newList = [...state.progressList];
        newList[index] = progress;
        return { progressList: newList };
      }
      return { progressList: [...state.progressList, progress] };
    }),
  clearProgress: () => set({ progressList: [] }),

  logs: [],
  addLog: (log) =>
    set((state) => ({
      logs: [...state.logs, `[${new Date().toLocaleTimeString()}] ${log}`],
    })),
  clearLogs: () => set({ logs: [] }),

  activeTab: 'youtube',
  setActiveTab: (tab) => {
    set({ activeTab: tab });
    get().saveCurrentSession();
  },

  sessionId: '',
  setSessionId: (id) => set({ sessionId: id }),

  saveCurrentSession: () => {
    const state = get();
    if (typeof window !== 'undefined' && state.sessionId) {
      saveSession({
        sessionId: state.sessionId,
        activeTab: state.activeTab,
        uploadedFiles: state.files.map(f => ({
          id: f.id,
          name: f.name,
          size: f.size,
          type: f.type,
        })),
        lastActivity: Date.now(),
      });
    }
  },
}));
