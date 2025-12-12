'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileUploader } from '@/components/common/FileUploader';
import { ProgressBar } from '@/components/common/ProgressBar';
import { LogViewer } from '@/components/common/LogViewer';
import { useConversionStore } from '@/store/useConversionStore';
import { DocumentFormat, FileInfo, ConversionProgress } from '@/types';
import { validateFile, DOCUMENT_FORMATS } from '@/lib/file-validator';
import { formatFileSize } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { X, Download, CheckCircle2, XCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// 지원되는 변환 매트릭스
const CONVERSION_MATRIX: Record<string, string[]> = {
  pdf: ['html', 'md'],
  docx: ['pdf', 'html', 'md'],
  html: ['pdf', 'docx', 'md'],
  md: ['pdf', 'html', 'docx'],
  pptx: [], // Phase 5에서는 지원하지 않음
};

export function DocumentConvertTab() {
  const { toast } = useToast();
  const { files, addFile, removeFile, clearFiles, sessionId, addLog, progressList, updateProgress, clearProgress } = useConversionStore();
  const [outputFormat, setOutputFormat] = useState<DocumentFormat>('pdf');
  const [isConverting, setIsConverting] = useState(false);

  const handleFilesAccepted = async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const validation = await validateFile(file, DOCUMENT_FORMATS);
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

    // 변환 가능한 파일 확인
    const invalidFiles = files.filter((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const supportedOutputs = CONVERSION_MATRIX[ext] || [];
      return !supportedOutputs.includes(outputFormat);
    });

    if (invalidFiles.length > 0) {
      toast({
        title: '변환 불가능한 파일',
        description: `${invalidFiles[0].name}은(는) ${outputFormat.toUpperCase()}로 변환할 수 없습니다.`,
        variant: 'destructive',
      });
      return;
    }

    setIsConverting(true);
    clearProgress();
    addLog(`변환 시작: ${files.length}개 파일 → ${outputFormat.toUpperCase()}`);

    try {
      // 1. 파일 업로드
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f.file));
      formData.append('sessionId', sessionId);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadData.success) {
        throw new Error(uploadData.error);
      }

      addLog('파일 업로드 완료');

      // 2. 변환 실행 (SSE)
      const convertFormData = new FormData();
      convertFormData.append('filesData', JSON.stringify(uploadData.files));
      convertFormData.append('outputFormat', outputFormat);
      convertFormData.append('sessionId', sessionId);

      const response = await fetch('/api/document/convert', {
        method: 'POST',
        body: convertFormData,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('스트림을 읽을 수 없습니다');

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
                fileId: files[data.fileIndex].id,
                fileName: data.fileName,
                progress: data.progress,
                status: 'processing',
                message: data.message,
              });
              addLog(data.message);
            } else if (data.type === 'complete') {
              updateProgress({
                fileId: files[data.fileIndex].id,
                fileName: data.fileName,
                progress: 100,
                status: 'completed',
                outputUrl: data.outputUrl,
              });
              addLog(data.message);
            } else if (data.type === 'error') {
              if (data.fileIndex !== undefined) {
                updateProgress({
                  fileId: files[data.fileIndex].id,
                  fileName: data.fileName,
                  progress: 0,
                  status: 'error',
                  message: data.message,
                });
              }
              addLog(`오류: ${data.message}`);
            } else if (data.type === 'done') {
              addLog('모든 변환 완료!');
              toast({ title: '변환 완료', description: '모든 파일이 성공적으로 변환되었습니다.' });
            } else if (data.type === 'info' || data.type === 'start') {
              addLog(data.message);
            }
          }
        }
      }
    } catch (error: any) {
      toast({ title: '변환 실패', description: error.message, variant: 'destructive' });
      addLog(`오류: ${error.message}`);
    } finally {
      setIsConverting(false);
    }
  };

  // 현재 선택된 파일들에 대해 가능한 출력 형식 계산
  const getAvailableOutputFormats = (): DocumentFormat[] => {
    if (files.length === 0) {
      return ['pdf', 'docx', 'html', 'md'];
    }

    // 모든 파일에서 공통으로 지원하는 형식만 표시
    const commonFormats = files.reduce<string[]>((acc, file) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const supportedOutputs = CONVERSION_MATRIX[ext] || [];

      if (acc.length === 0) {
        return supportedOutputs;
      }

      return acc.filter((format) => supportedOutputs.includes(format));
    }, []);

    return commonFormats as DocumentFormat[];
  };

  const availableFormats = getAvailableOutputFormats();

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">문서 변환</h2>

        <div className="space-y-4">
          {/* 변환 매트릭스 안내 */}
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">지원되는 변환</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div>
                <strong>PDF →</strong> HTML, Markdown
              </div>
              <div>
                <strong>DOCX →</strong> PDF, HTML, Markdown
              </div>
              <div>
                <strong>HTML →</strong> PDF, DOCX, Markdown
              </div>
              <div>
                <strong>Markdown →</strong> PDF, HTML, DOCX
              </div>
            </div>
          </div>

          <FileUploader
            onFilesAccepted={handleFilesAccepted}
            acceptedFormats={DOCUMENT_FORMATS}
            multiple
          />

          {files.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">업로드된 파일 ({files.length})</h3>
              {files.map((file) => {
                const ext = file.name.split('.').pop()?.toLowerCase() || '';
                const canConvert = CONVERSION_MATRIX[ext]?.includes(outputFormat) ?? false;

                return (
                  <div key={file.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-2">
                      {canConvert ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeFile(file.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              <Button variant="outline" size="sm" onClick={clearFiles}>
                모두 제거
              </Button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">출력 형식</label>
            <Select
              value={outputFormat}
              onValueChange={(v) => setOutputFormat(v as DocumentFormat)}
              disabled={availableFormats.length === 0}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf" disabled={!availableFormats.includes('pdf')}>
                  PDF
                </SelectItem>
                <SelectItem value="docx" disabled={!availableFormats.includes('docx')}>
                  DOCX (Word)
                </SelectItem>
                <SelectItem value="html" disabled={!availableFormats.includes('html')}>
                  HTML
                </SelectItem>
                <SelectItem value="md" disabled={!availableFormats.includes('md')}>
                  Markdown
                </SelectItem>
              </SelectContent>
            </Select>
            {files.length > 0 && availableFormats.length === 0 && (
              <p className="text-sm text-red-500 mt-1">
                선택한 파일들로는 어떤 형식으로도 변환할 수 없습니다.
              </p>
            )}
          </div>

          <Button onClick={handleConvert} disabled={isConverting || files.length === 0} className="w-full">
            {isConverting ? '변환 중...' : '변환 시작'}
          </Button>
        </div>
      </Card>

      {progressList.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">변환 진행률</h3>
          <div className="space-y-4">
            {progressList.map((p) => (
              <div key={p.fileId}>
                <ProgressBar value={p.progress} label={p.fileName} />
                {p.status === 'completed' && p.outputUrl && (
                  <a href={p.outputUrl} download className="inline-flex items-center text-sm text-primary mt-2">
                    <Download className="h-4 w-4 mr-1" />
                    다운로드
                  </a>
                )}
                {p.status === 'error' && (
                  <p className="text-sm text-red-500 mt-1">{p.message}</p>
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
