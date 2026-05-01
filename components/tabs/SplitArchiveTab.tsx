'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileUploader } from '@/components/common/FileUploader';
import { ProgressBar } from '@/components/common/ProgressBar';
import { LogViewer } from '@/components/common/LogViewer';
import { useConversionStore } from '@/store/useConversionStore';
import { FileInfo } from '@/types';
import { validateFile } from '@/lib/file-validator';
import { formatFileSize } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { X, Download, FolderOpen, Archive, Eye, EyeOff, Lock } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { uploadWithProgress } from '@/lib/upload-with-progress';

const SPLIT_SIZES = {
  '10MB': 10 * 1024 * 1024,
  '50MB': 50 * 1024 * 1024,
  '100MB': 100 * 1024 * 1024,
  '500MB': 500 * 1024 * 1024,
  '1GB': 1024 * 1024 * 1024,
};

type SplitSize = keyof typeof SPLIT_SIZES;
type ArchiveMode = 'normal' | 'split';

interface SplitResult {
  fileName: string;
  url: string;
  size: number;
  partNumber: number;
}

export function SplitArchiveTab() {
  const { toast } = useToast();
  const { files, addFile, removeFile, clearFiles, sessionId, addLog, progressList, updateProgress, clearProgress } = useConversionStore();
  const [archiveMode, setArchiveMode] = useState<ArchiveMode>('split');
  const [splitSize, setSplitSize] = useState<SplitSize>('100MB');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [splitResults, setSplitResults] = useState<SplitResult[]>([]);

  const handleFilesAccepted = async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const fileInfo: FileInfo = {
        id: uuidv4(),
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        file,
      };
      addFile(fileInfo);
      addLog(`파일 추가됨: ${file.name} (${formatFileSize(file.size)})`);
    }
  };

  const handleArchive = async () => {
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
    setSplitResults([]);

    const modeLabel = archiveMode === 'split' ? `분할 압축 (${splitSize})` : '일반 압축';
    const passwordLabel = password ? ' + 비밀번호' : '';
    addLog(`압축 시작: ${files.length}개 파일, ${modeLabel}${passwordLabel}`);

    try {
      addLog('파일 업로드 중...');
      const formData = new FormData();
      for (const file of files) formData.append('files', file.file);
      formData.append('sessionId', sessionId);
      setUploadProgress(0);

      const uploadRes = await uploadWithProgress({
        url: `/api/upload?sessionId=${encodeURIComponent(sessionId)}`,
        formData,
        onProgress: (progress) => {
          setUploadProgress(progress);
          if (progress % 20 === 0 || progress === 100) addLog(`  업로드 진행: ${progress}%`);
        },
      });

      const uploadText = await uploadRes.text();
      let uploadData;
      try {
        uploadData = JSON.parse(uploadText);
      } catch {
        throw new Error(`업로드 응답 파싱 실패: ${uploadText}`);
      }
      if (!uploadData.success) throw new Error(`업로드 실패: ${uploadData.error}`);

      setUploadProgress(100);
      addLog('업로드 완료');

      const filesForArchive = uploadData.files.map((f: any) => ({
        originalName: f.originalName,
        savedPath: f.path,
        size: f.size,
      }));

      const archiveFormData = new FormData();
      archiveFormData.append('filesData', JSON.stringify(filesForArchive));
      archiveFormData.append('splitSize', SPLIT_SIZES[splitSize].toString());
      archiveFormData.append('sessionId', sessionId);
      archiveFormData.append('enableSplit', (archiveMode === 'split').toString());
      archiveFormData.append('password', password);

      addLog('압축 처리 중...');

      const response = await fetch('/api/archive/split', {
        method: 'POST',
        body: archiveFormData,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('스트림을 읽을 수 없습니다');

      const results: SplitResult[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = JSON.parse(line.slice(6));

          if (data.type === 'progress') {
            updateProgress({
              fileId: 'archive',
              fileName: '압축',
              progress: data.progress,
              status: 'processing',
              message: data.message,
            });
            addLog(`  ${data.message}`);
          } else if (data.type === 'part-complete') {
            results.push({ fileName: data.fileName, url: data.url, size: data.size, partNumber: data.partNumber });
            if (archiveMode === 'split') addLog(`  파트 ${data.partNumber} 완료: ${data.fileName}`);
          } else if (data.type === 'complete') {
            updateProgress({
              fileId: 'archive',
              fileName: '압축',
              progress: 100,
              status: 'completed',
              message: data.totalParts > 1 ? `${data.totalParts}개 파트로 분할 완료` : '압축 완료',
            });
            addLog(data.totalParts > 1 ? `압축 완료: 총 ${data.totalParts}개 파트` : `압축 완료: ${results[0]?.fileName}`);
          } else if (data.type === 'error') {
            throw new Error(data.message);
          }
        }
      }

      setSplitResults(results);
      toast({
        title: '압축 완료',
        description: results.length > 1
          ? `${results.length}개의 분할 파일이 생성되었습니다.`
          : `${results[0]?.fileName} 파일이 생성되었습니다.`,
      });

    } catch (error: any) {
      toast({ title: '압축 실패', description: error.message, variant: 'destructive' });
      addLog(`오류: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setUploadProgress(0);
    }
  };

  const downloadAllParts = async () => {
    for (const result of splitResults) {
      const link = document.createElement('a');
      link.href = result.url;
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    toast({ title: `${splitResults.length}개 파일 다운로드 시작` });
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

  const calculateEstimatedParts = () => {
    if (files.length === 0 || archiveMode !== 'split') return 0;
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    return Math.ceil(totalSize / SPLIT_SIZES[splitSize]);
  };

  const buttonLabel = isProcessing
    ? '압축 중...'
    : archiveMode === 'split' ? '분할 압축 시작' : '압축 시작';

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">
          <Archive className="inline-block mr-2 h-5 w-5" />
          압축
        </h2>

        <div className="space-y-4">
          <FileUploader onFilesAccepted={handleFilesAccepted} multiple />

          {files.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">업로드된 파일 ({files.length})</h3>
              <p className="text-sm text-muted-foreground">
                총 크기: {formatFileSize(files.reduce((sum, f) => sum + f.size, 0))}
                {calculateEstimatedParts() > 1 && (
                  <span className="ml-2">(예상 {calculateEstimatedParts()}개 파트)</span>
                )}
              </p>
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
              <Button variant="outline" size="sm" onClick={clearFiles}>모두 제거</Button>
            </div>
          )}

          {/* 압축 방식 선택 */}
          <div>
            <label className="block text-sm font-medium mb-2">압축 방식</label>
            <div className="flex gap-2">
              <Button
                variant={archiveMode === 'normal' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setArchiveMode('normal')}
                className="flex-1"
              >
                일반 압축
              </Button>
              <Button
                variant={archiveMode === 'split' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setArchiveMode('split')}
                className="flex-1"
              >
                분할 압축
              </Button>
            </div>
          </div>

          {/* 분할 크기 (분할 모드일 때만) */}
          {archiveMode === 'split' && (
            <div>
              <label className="block text-sm font-medium mb-2">분할 크기</label>
              <Select value={splitSize} onValueChange={(v) => setSplitSize(v as SplitSize)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10MB">10MB (소형 파일)</SelectItem>
                  <SelectItem value="50MB">50MB</SelectItem>
                  <SelectItem value="100MB">100MB (권장)</SelectItem>
                  <SelectItem value="500MB">500MB</SelectItem>
                  <SelectItem value="1GB">1GB (대형 파일)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">각 압축 파일의 최대 크기</p>
            </div>
          )}

          {/* 비밀번호 설정 */}
          <div>
            <label className="block text-sm font-medium mb-2">
              <Lock className="inline-block mr-1 h-3.5 w-3.5" />
              비밀번호 (선택사항)
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="비밀번호를 입력하면 암호화됩니다 (AES-256)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {password && (
              <p className="text-xs text-amber-600 mt-1">
                비밀번호가 설정됩니다. 압축 해제 시 동일한 비밀번호가 필요합니다.
              </p>
            )}
          </div>

          <Button
            onClick={handleArchive}
            disabled={isProcessing || files.length === 0}
            className="w-full"
          >
            {buttonLabel}
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
                {p.message && <p className="text-sm text-muted-foreground mt-1">{p.message}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {splitResults.length > 0 && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">
              {splitResults.length > 1 ? `분할된 파일 (${splitResults.length}개)` : '압축 파일'}
            </h3>
            <div className="flex gap-2">
              <Button variant="default" size="sm" onClick={downloadAllParts}>
                <Download className="h-4 w-4 mr-2" />
                {splitResults.length > 1 ? '전체 다운로드' : '다운로드'}
              </Button>
              <Button variant="outline" size="sm" onClick={openDownloadFolder}>
                <FolderOpen className="h-4 w-4 mr-2" />
                폴더 열기
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {splitResults.map((result) => (
              <div key={result.partNumber} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <p className="font-medium">{result.fileName}</p>
                  <p className="text-sm text-muted-foreground">
                    {splitResults.length > 1 && `파트 ${result.partNumber} · `}
                    {formatFileSize(result.size)}
                    {password && <span className="ml-2 text-amber-600">🔒 암호화됨</span>}
                  </p>
                </div>
                <a href={result.url} download={result.fileName} className="inline-flex items-center text-sm text-primary">
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
