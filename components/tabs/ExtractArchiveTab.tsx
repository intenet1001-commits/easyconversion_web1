'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileUploader } from '@/components/common/FileUploader';
import { ProgressBar } from '@/components/common/ProgressBar';
import { LogViewer } from '@/components/common/LogViewer';
import { useConversionStore } from '@/store/useConversionStore';
import { FileInfo } from '@/types';
import { formatFileSize } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { X, Download, FolderOpen, FolderArchive, FileArchive } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { uploadWithProgress } from '@/lib/upload-with-progress';

interface ExtractedFile {
  name: string;
  size: number;
  url: string;
}

export function ExtractArchiveTab() {
  const { toast } = useToast();
  const { files, addFile, removeFile, clearFiles, sessionId, addLog, progressList, updateProgress, clearProgress } = useConversionStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extractedFiles, setExtractedFiles] = useState<ExtractedFile[]>([]);
  const [extractDir, setExtractDir] = useState('');

  const handleFilesAccepted = async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      // ZIP 파일 또는 분할 압축 파일인지 확인
      const isZipFile = file.name.toLowerCase().endsWith('.zip');
      const isSplitFile = /\.(zip|z|7z)\.\d{3}$/i.test(file.name);

      if (!isZipFile && !isSplitFile) {
        toast({
          title: '지원하지 않는 파일 형식',
          description: 'ZIP 파일 또는 분할 압축 파일(.zip.001 등)만 지원합니다.',
          variant: 'destructive',
        });
        continue;
      }

      const fileInfo: FileInfo = {
        id: uuidv4(),
        name: file.name,
        size: file.size,
        type: file.type || 'application/zip',
        file,
      };
      addFile(fileInfo);
      addLog(`파일 추가됨: ${file.name} (${formatFileSize(file.size)})`);
    }
  };

  const handleExtractArchive = async () => {
    if (files.length === 0) {
      toast({ title: '파일을 선택해주세요', variant: 'destructive' });
      return;
    }

    if (!sessionId) {
      toast({ title: 'Session ID가 없습니다. 페이지를 새로고침해주세요.', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    clearProgress();
    setExtractedFiles([]);
    setExtractDir('');

    addLog(`압축 해제 시작: ${files.length}개 파일`);
    console.log('[ExtractArchive] sessionId:', sessionId);

    try {
      // 1. 파일 업로드
      addLog(`파일 업로드 중...`);
      const formData = new FormData();

      for (const file of files) {
        formData.append('files', file.file);
      }
      formData.append('sessionId', sessionId);

      setUploadProgress(0);

      const uploadUrl = `/api/upload?sessionId=${encodeURIComponent(sessionId)}`;
      console.log('[ExtractArchive] Upload URL:', uploadUrl);
      addLog(`  세션 ID: ${sessionId}`);

      const uploadRes = await uploadWithProgress({
        url: uploadUrl,
        formData,
        onProgress: (progress) => {
          setUploadProgress(progress);
          if (progress % 10 === 0 || progress === 100) {
            addLog(`  업로드 진행: ${progress}%`);
          }
        },
      });

      const uploadText = await uploadRes.text();
      console.log('[ExtractArchive] Upload response:', uploadText);

      let uploadData;
      try {
        uploadData = JSON.parse(uploadText);
      } catch (e) {
        throw new Error(`업로드 응답 파싱 실패: ${uploadText}`);
      }

      if (!uploadData.success) {
        throw new Error(`업로드 실패: ${uploadData.error}`);
      }

      setUploadProgress(100);
      addLog(`업로드 완료`);

      // 2. 압축 해제 요청 (SSE)
      addLog(`압축 해제 처리 중...`);

      // Upload API 응답을 Extract Archive API 형식으로 변환
      const filesForExtract = uploadData.files.map((f: any) => ({
        originalName: f.originalName,
        savedPath: f.path,
        size: f.size,
      }));

      const archiveFormData = new FormData();
      archiveFormData.append('filesData', JSON.stringify(filesForExtract));
      archiveFormData.append('sessionId', sessionId);

      const response = await fetch('/api/archive/extract', {
        method: 'POST',
        body: archiveFormData,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('스트림을 읽을 수 없습니다');

      const results: ExtractedFile[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'progress') {
                updateProgress({
                  fileId: 'extract-archive',
                  fileName: '압축 해제',
                  progress: data.progress,
                  status: 'processing',
                  message: data.message,
                });
                addLog(`  ${data.message}`);
              } else if (data.type === 'file-extracted') {
                results.push({
                  name: data.fileName,
                  size: data.size,
                  url: data.url,
                });
                addLog(`  파일 추출: ${data.fileName}`);
              } else if (data.type === 'complete') {
                updateProgress({
                  fileId: 'extract-archive',
                  fileName: '압축 해제',
                  progress: 100,
                  status: 'completed',
                  message: `${data.totalFiles}개 파일 추출 완료`,
                });
                addLog(`압축 해제 완료: 총 ${data.totalFiles}개 파일`);
                setExtractDir(data.extractDir);
              } else if (data.type === 'error') {
                throw new Error(data.message);
              }
            } catch (parseError: any) {
              if (parseError.message && !parseError.message.includes('JSON')) {
                throw parseError;
              }
              // JSON 파싱 에러는 무시 (불완전한 청크일 수 있음)
            }
          }
        }
      }

      setExtractedFiles(results);
      toast({
        title: '압축 해제 완료',
        description: `${results.length}개의 파일이 추출되었습니다.`
      });

    } catch (error: any) {
      toast({ title: '압축 해제 실패', description: error.message, variant: 'destructive' });
      addLog(`오류: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setUploadProgress(0);
    }
  };

  const downloadFile = (file: ExtractedFile) => {
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLog(`다운로드: ${file.name}`);
  };

  const downloadAllFiles = async () => {
    for (const file of extractedFiles) {
      downloadFile(file);
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    toast({ title: `${extractedFiles.length}개 파일 다운로드 시작` });
    addLog(`전체 ${extractedFiles.length}개 파일 다운로드 시작`);
  };

  const openExtractFolder = async () => {
    if (!extractDir) {
      toast({ title: '추출된 폴더가 없습니다', variant: 'destructive' });
      return;
    }

    try {
      const response = await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relativePath: extractDir }),
      });

      const data = await response.json();
      if (data.success) {
        toast({ title: '추출 폴더를 열었습니다' });
      } else {
        toast({ title: '폴더 열기 실패', description: data.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: '폴더 열기 실패', description: error.message, variant: 'destructive' });
    }
  };

  const openDownloadFolder = async () => {
    try {
      const response = await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openUserDownloads: true }),
      });

      const data = await response.json();
      if (data.success) {
        toast({ title: '다운로드 폴더를 열었습니다' });
      } else {
        toast({ title: '폴더 열기 실패', description: data.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: '폴더 열기 실패', description: error.message, variant: 'destructive' });
    }
  };

  // 분할 파일 여부 확인
  const isSplitArchive = files.some(f => /\.(zip|z|7z)\.\d{3}$/i.test(f.name));

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">
          <FolderArchive className="inline-block mr-2 h-5 w-5" />
          압축 해제
        </h2>

        <div className="space-y-4">
          <FileUploader
            onFilesAccepted={handleFilesAccepted}
            multiple
          />

          <p className="text-sm text-muted-foreground">
            ZIP 파일 또는 분할 압축 파일(.zip.001, .zip.002 등)을 업로드하세요.
            <br />
            분할 파일의 경우 모든 파트를 함께 업로드해야 합니다.
          </p>

          {files.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">
                업로드된 파일 ({files.length})
                {isSplitArchive && (
                  <span className="ml-2 text-sm text-blue-600 dark:text-blue-400">
                    (분할 압축 파일 감지됨)
                  </span>
                )}
              </h3>
              <p className="text-sm text-muted-foreground">
                총 크기: {formatFileSize(files.reduce((sum, f) => sum + f.size, 0))}
              </p>
              {files.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-2">
                    <FileArchive className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeFile(file.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={clearFiles}>
                모두 제거
              </Button>
            </div>
          )}

          <Button
            onClick={handleExtractArchive}
            disabled={isProcessing || files.length === 0}
            className="w-full"
          >
            {isProcessing ? '압축 해제 중...' : '압축 해제 시작'}
          </Button>
        </div>
      </Card>

      {isProcessing && uploadProgress < 100 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">파일 업로드</h3>
          <ProgressBar value={uploadProgress} label="업로드 중" />
        </Card>
      )}

      {progressList.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">처리 진행률</h3>
          <div className="space-y-4">
            {progressList.map((p) => (
              <div key={p.fileId}>
                <ProgressBar value={p.progress} label={p.fileName} />
                {p.message && (
                  <p className="text-sm text-muted-foreground mt-1">{p.message}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {extractedFiles.length > 0 && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">추출된 파일 ({extractedFiles.length}개)</h3>
            <div className="flex gap-2">
              <Button variant="default" size="sm" onClick={downloadAllFiles}>
                <Download className="h-4 w-4 mr-2" />
                전체 다운로드
              </Button>
              {extractDir && (
                <Button variant="outline" size="sm" onClick={openExtractFolder}>
                  <FolderOpen className="h-4 w-4 mr-2" />
                  추출 폴더 열기
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={openDownloadFolder}>
                <FolderOpen className="h-4 w-4 mr-2" />
                다운로드 폴더 열기
              </Button>
            </div>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {extractedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <p className="font-medium text-sm truncate max-w-md" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <a
                  href={file.url}
                  download={file.name.split('/').pop()}
                  className="inline-flex items-center text-sm text-primary hover:underline"
                >
                  <Download className="h-4 w-4 mr-1" />
                  다운로드
                </a>
              </div>
            ))}
          </div>
        </Card>
      )}

      <LogViewer />
    </div>
  );
}
