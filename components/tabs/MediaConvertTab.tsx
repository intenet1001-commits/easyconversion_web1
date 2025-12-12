'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileUploader } from '@/components/common/FileUploader';
import { ProgressBar } from '@/components/common/ProgressBar';
import { LogViewer } from '@/components/common/LogViewer';
import { useConversionStore } from '@/store/useConversionStore';
import { MediaFormat, FileInfo, ConversionProgress } from '@/types';
import { validateFile, MEDIA_FORMATS } from '@/lib/file-validator';
import { formatFileSize } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { X, Download, FolderOpen, CheckSquare, Square } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Input } from '@/components/ui/input';
import { uploadWithProgress } from '@/lib/upload-with-progress';

export function MediaConvertTab() {
  const { toast } = useToast();
  const { files, addFile, removeFile, clearFiles, sessionId, addLog, progressList, updateProgress, clearProgress } = useConversionStore();
  const [outputFormat, setOutputFormat] = useState<MediaFormat>('mp4');
  const [isConverting, setIsConverting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileNames, setFileNames] = useState<{ [key: string]: string }>({});
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const updateFileName = (fileId: string, name: string) => {
    setFileNames(prev => ({ ...prev, [fileId]: name }));
  };

  const toggleFileSelection = (fileId: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };

  const toggleSelectAll = () => {
    const completedFiles = progressList.filter(p => p.status === 'completed' && p.outputUrl);
    if (selectedFiles.size === completedFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(completedFiles.map(p => p.fileId)));
    }
  };

  const downloadSelected = async () => {
    if (selectedFiles.size === 0) {
      toast({ title: '다운로드할 파일을 선택해주세요', variant: 'destructive' });
      return;
    }

    for (const fileId of Array.from(selectedFiles)) {
      const progress = progressList.find(p => p.fileId === fileId);
      if (!progress?.outputUrl) continue;

      const link = document.createElement('a');
      link.href = progress.outputUrl;

      if (fileNames[fileId]) {
        const ext = progress.outputUrl.substring(progress.outputUrl.lastIndexOf('.'));
        link.download = `${fileNames[fileId]}${ext}`;
      } else {
        link.download = '';
      }

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    toast({ title: `${selectedFiles.size}개 파일 다운로드 시작` });
    addLog(`${selectedFiles.size}개 파일 다운로드 시작`);
  };

  const downloadAll = async () => {
    const completedFiles = progressList.filter(p => p.status === 'completed' && p.outputUrl);

    for (const progress of completedFiles) {
      const link = document.createElement('a');
      link.href = progress.outputUrl!;

      if (fileNames[progress.fileId]) {
        const ext = progress.outputUrl!.substring(progress.outputUrl!.lastIndexOf('.'));
        link.download = `${fileNames[progress.fileId]}${ext}`;
      } else {
        link.download = '';
      }

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    toast({ title: `${completedFiles.length}개 파일 다운로드 시작` });
    addLog(`전체 ${completedFiles.length}개 파일 다운로드 시작`);
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

  const handleFilesAccepted = async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const validation = await validateFile(file, MEDIA_FORMATS);
      if (!validation.valid) {
        toast({ title: '파일 검증 실패', description: validation.error, variant: 'destructive' });
        continue;
      }

      const fileInfo: FileInfo = {
        id: uuidv4(),
        name: file.name,
        size: file.size,
        type: file.type,
        file,
      };
      addFile(fileInfo);
      addLog(`파일 추가됨: ${file.name} (${formatFileSize(file.size)})`);
    }
  };

  const handleConvert = async () => {
    if (files.length === 0) {
      toast({ title: '파일을 선택해주세요', variant: 'destructive' });
      return;
    }

    setIsConverting(true);
    clearProgress();
    addLog(`변환 시작: ${files.length}개 파일 → ${outputFormat.toUpperCase()}`);

    try {
      // 각 파일을 순차적으로 처리 (업로드 → 변환)
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        addLog(`[${i + 1}/${files.length}] ${file.name} 처리 중...`);
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        addLog(`  파일 크기: ${fileSizeMB}MB`);

        // 1. 개별 파일 업로드
        addLog(`  업로드 준비 중... (대용량 파일의 경우 시간이 걸릴 수 있습니다)`);
        const formData = new FormData();
        formData.append('files', file.file);
        formData.append('sessionId', sessionId);

        addLog(`  업로드 시작...`);
        setUploadProgress(0);

        const uploadRes = await uploadWithProgress({
          url: '/api/upload',
          formData,
          onProgress: (progress) => {
            setUploadProgress(progress);
            // 5% 단위로만 로그 출력 (로그 과다 방지)
            if (progress % 5 === 0 || progress === 100) {
              addLog(`  업로드 진행: ${progress}%`);
            }
          },
        });

        const uploadData = await uploadRes.json();

        if (!uploadData.success) {
          throw new Error(`${file.name} 업로드 실패: ${uploadData.error}`);
        }

        setUploadProgress(100);
        addLog(`  업로드 완료`);

        // 2. 개별 파일 변환 (SSE)
        addLog(`  변환 중...`);
        const convertFormData = new FormData();
        convertFormData.append('filesData', JSON.stringify(uploadData.files));
        convertFormData.append('outputFormat', outputFormat);
        convertFormData.append('sessionId', sessionId);

        const response = await fetch('/api/media/convert', {
          method: 'POST',
          body: convertFormData,
        });

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) throw new Error('스트림을 읽을 수 없습니다');

        let fileCompleted = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'progress') {
                updateProgress({
                  fileId: file.id,
                  fileName: data.fileName,
                  progress: data.progress,
                  status: 'processing',
                  message: data.message,
                });
              } else if (data.type === 'complete') {
                updateProgress({
                  fileId: file.id,
                  fileName: data.fileName,
                  progress: 100,
                  status: 'completed',
                  outputUrl: data.outputUrl,
                });
                addLog(`  변환 완료`);
                fileCompleted = true;
              } else if (data.type === 'done') {
                // 모든 변환 완료 신호
                fileCompleted = true;
              } else if (data.type === 'file-error') {
                // 개별 파일 에러는 경고만 표시하고 계속 진행
                addLog(`  경고: ${data.message}`);
                updateProgress({
                  fileId: file.id,
                  fileName: data.fileName,
                  progress: 0,
                  status: 'error',
                  message: data.message,
                });
                fileCompleted = true; // 에러여도 다음 파일 진행
              } else if (data.type === 'error') {
                throw new Error(`${file.name} 변환 실패: ${data.message}`);
              }
            }
          }
        }

        if (!fileCompleted) {
          throw new Error(`${file.name} 변환이 완료되지 않았습니다`);
        }

        addLog(`[${i + 1}/${files.length}] ${file.name} 완료 ✓`);
      }

      addLog('모든 변환 완료!');
      toast({ title: '변환 완료', description: `${files.length}개 파일이 성공적으로 변환되었습니다.` });

    } catch (error: any) {
      toast({ title: '변환 실패', description: error.message, variant: 'destructive' });
      addLog(`오류: ${error.message}`);
    } finally {
      setIsConverting(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">미디어 변환</h2>

        <div className="space-y-4">
          <FileUploader
            onFilesAccepted={handleFilesAccepted}
            acceptedFormats={MEDIA_FORMATS}
            multiple
          />

          {files.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">업로드된 파일 ({files.length})</h3>
              {files.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
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

          <div>
            <label className="block text-sm font-medium mb-2">출력 형식</label>
            <Select value={outputFormat} onValueChange={(v) => setOutputFormat(v as MediaFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mp4">MP4 (비디오)</SelectItem>
                <SelectItem value="mov">MOV (비디오)</SelectItem>
                <SelectItem value="mp3">MP3 (오디오)</SelectItem>
                <SelectItem value="wav">WAV (오디오)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleConvert} disabled={isConverting || files.length === 0} className="w-full">
            {isConverting ? '변환 중...' : '변환 시작'}
          </Button>
        </div>
      </Card>

      {isConverting && uploadProgress < 100 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">파일 업로드</h3>
          <ProgressBar value={uploadProgress} label="업로드 중" />
        </Card>
      )}

      {progressList.length > 0 && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">변환 진행률</h3>
            {progressList.some(p => p.status === 'completed') && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                  {selectedFiles.size === progressList.filter(p => p.status === 'completed').length ? (
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadSelected}
                  disabled={selectedFiles.size === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  선택 다운로드 ({selectedFiles.size})
                </Button>
                <Button variant="default" size="sm" onClick={downloadAll}>
                  <Download className="h-4 w-4 mr-2" />
                  전체 다운로드
                </Button>
                <Button variant="outline" size="sm" onClick={openDownloadFolder}>
                  <FolderOpen className="h-4 w-4 mr-2" />
                  다운로드 폴더 열기
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-4">
            {progressList.map((p) => (
              <div key={p.fileId}>
                <ProgressBar value={p.progress} label={p.fileName} />
                {p.status === 'completed' && p.outputUrl && (
                  <div className="flex items-center gap-2 mt-2 p-2 border rounded">
                    <button
                      onClick={() => toggleFileSelection(p.fileId)}
                      className="flex items-center flex-shrink-0"
                    >
                      {selectedFiles.has(p.fileId) ? (
                        <CheckSquare className="h-5 w-5 text-primary" />
                      ) : (
                        <Square className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                    <Input
                      placeholder="파일명 입력 (선택사항)"
                      value={fileNames[p.fileId] || ''}
                      onChange={(e) => updateFileName(p.fileId, e.target.value)}
                      className="flex-1"
                    />
                    <a
                      href={p.outputUrl}
                      download={fileNames[p.fileId] ? `${fileNames[p.fileId]}${p.outputUrl.substring(p.outputUrl.lastIndexOf('.'))}` : ''}
                      className="inline-flex items-center text-sm text-primary flex-shrink-0"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      다운로드
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <LogViewer />
    </div>
  );
}
