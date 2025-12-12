'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download, Trash2, CheckSquare, Square, FolderOpen, RefreshCw } from 'lucide-react';
import { formatFileSize } from '@/lib/utils';

interface FileInfo {
  name: string;
  path: string;
  size: number;
  sessionId: string;
  createdAt: number;
}

interface ProjectFilesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectFilesDialog({ isOpen, onClose }: ProjectFilesDialogProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/project-files/list');
      const data = await response.json();

      if (data.success) {
        setFiles(data.files);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({ title: '파일 목록 조회 실패', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFiles();
      setSelectedFiles(new Set());
    }
  }, [isOpen]);

  const toggleFileSelection = (filePath: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(filePath)) {
      newSelected.delete(filePath);
    } else {
      newSelected.add(filePath);
    }
    setSelectedFiles(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map(f => f.path)));
    }
  };

  const handleDelete = async (deleteAll: boolean = false) => {
    if (!deleteAll && selectedFiles.size === 0) {
      toast({ title: '삭제할 파일을 선택해주세요', variant: 'destructive' });
      return;
    }

    const confirmMessage = deleteAll
      ? '모든 파일을 삭제하시겠습니까?'
      : `선택한 ${selectedFiles.size}개 파일을 삭제하시겠습니까?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch('/api/project-files/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePaths: deleteAll ? undefined : Array.from(selectedFiles),
          deleteAll,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({ title: '삭제 완료', description: data.message });
        setSelectedFiles(new Set());
        await fetchFiles();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({ title: '삭제 실패', description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const downloadSelected = async () => {
    if (selectedFiles.size === 0) {
      toast({ title: '다운로드할 파일을 선택해주세요', variant: 'destructive' });
      return;
    }

    for (const filePath of Array.from(selectedFiles)) {
      const link = document.createElement('a');
      link.href = filePath;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    toast({ title: `${selectedFiles.size}개 파일 다운로드 시작` });
  };

  const openProjectFolder = async () => {
    try {
      const response = await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openProjectDownloads: true }),
      });

      const data = await response.json();
      if (data.success) {
        toast({ title: '프로젝트 다운로드 폴더를 열었습니다' });
      } else {
        toast({ title: '폴더 열기 실패', description: data.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: '폴더 열기 실패', description: error.message, variant: 'destructive' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold">프로젝트 다운로드 폴더 관리</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              저장된 파일이 없습니다
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.path}
                  className="flex items-center gap-3 p-3 border rounded hover:bg-muted/50 transition-colors"
                >
                  <button
                    onClick={() => toggleFileSelection(file.path)}
                    className="flex items-center flex-shrink-0"
                  >
                    {selectedFiles.has(file.path) ? (
                      <CheckSquare className="h-5 w-5 text-primary" />
                    ) : (
                      <Square className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(file.size)} · {new Date(file.createdAt).toLocaleString('ko-KR')}
                    </p>
                  </div>
                  <a
                    href={file.path}
                    download
                    className="inline-flex items-center text-sm text-primary hover:underline flex-shrink-0"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    다운로드
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={toggleSelectAll} disabled={files.length === 0}>
                {selectedFiles.size === files.length ? (
                  <>
                    <CheckSquare className="h-4 w-4 mr-2" />
                    전체 해제
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    전체 선택
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={fetchFiles} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                새로고침
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              총 {files.length}개 파일 ({selectedFiles.size}개 선택)
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadSelected}
                disabled={selectedFiles.size === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                선택 다운로드
              </Button>
              <Button variant="outline" size="sm" onClick={openProjectFolder}>
                <FolderOpen className="h-4 w-4 mr-2" />
                폴더 열기
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(false)}
                disabled={selectedFiles.size === 0 || isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                선택 삭제
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(true)}
                disabled={files.length === 0 || isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                전체 삭제
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
