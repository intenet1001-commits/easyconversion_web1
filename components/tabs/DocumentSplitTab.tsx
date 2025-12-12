'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileUploader } from '@/components/common/FileUploader';
import { ProgressBar } from '@/components/common/ProgressBar';
import { LogViewer } from '@/components/common/LogViewer';
import { useConversionStore } from '@/store/useConversionStore';
import { FileInfo } from '@/types';
import { validateFile, DOCUMENT_FORMATS } from '@/lib/file-validator';
import { formatFileSize } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { X, Download, FolderOpen, Plus, Trash2, CheckSquare, Square } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { uploadWithProgress } from '@/lib/upload-with-progress';

interface SplitRange {
  id: string;
  start: number;
  end: number;
  name: string;
}

export function DocumentSplitTab() {
  const { toast } = useToast();
  const { files, addFile, removeFile, clearFiles, sessionId, addLog } = useConversionStore();
  const [isSplitting, setIsSplitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [outputUrls, setOutputUrls] = useState<string[]>([]);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [ranges, setRanges] = useState<SplitRange[]>([
    { id: uuidv4(), start: 1, end: 1, name: '' }
  ]);
  const [fileNames, setFileNames] = useState<{ [key: number]: string }>({});
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());

  const handleFilesAccepted = async (acceptedFiles: File[]) => {
    // Only allow one file at a time for splitting
    const file = acceptedFiles[0];
    if (!file) return;

    const validation = await validateFile(file, DOCUMENT_FORMATS);
    if (!validation.valid) {
      toast({ title: '파일 검증 실패', description: validation.error, variant: 'destructive' });
      return;
    }

    // PDF만 허용
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast({ title: 'PDF 파일만 분할할 수 있습니다', variant: 'destructive' });
      return;
    }

    // Clear existing files and add new one
    clearFiles();
    const fileInfo: FileInfo = {
      id: uuidv4(),
      name: file.name,
      size: file.size,
      type: file.type,
      file,
    };
    addFile(fileInfo);
    addLog(`파일 추가됨: ${file.name} (${formatFileSize(file.size)})`);

    // Upload and get page count
    await fetchPageCount(file);
  };

  const fetchPageCount = async (file: File) => {
    try {
      addLog('페이지 수 확인 중...');
      const formData = new FormData();
      formData.append('files', file);
      formData.append('sessionId', sessionId);

      const uploadRes = await uploadWithProgress({
        url: '/api/upload',
        formData,
        onProgress: (progress) => setUploadProgress(progress),
      });

      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        throw new Error(`업로드 실패: ${uploadData.error}`);
      }

      // Get page count from uploaded PDF
      const response = await fetch('/api/document/page-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          fileName: uploadData.files[0].savedName,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setPageCount(data.pageCount);
        addLog(`총 ${data.pageCount} 페이지`);

        // Initialize first range
        setRanges([{ id: uuidv4(), start: 1, end: data.pageCount, name: '' }]);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({ title: '페이지 수 확인 실패', description: error.message, variant: 'destructive' });
      addLog(`오류: ${error.message}`);
    } finally {
      setUploadProgress(0);
    }
  };

  const addRange = () => {
    setRanges([...ranges, { id: uuidv4(), start: 1, end: pageCount || 1, name: '' }]);
  };

  const removeRange = (id: string) => {
    if (ranges.length === 1) {
      toast({ title: '최소 1개의 분할 범위가 필요합니다', variant: 'destructive' });
      return;
    }
    setRanges(ranges.filter(r => r.id !== id));
  };

  const updateRange = (id: string, field: keyof SplitRange, value: number | string) => {
    setRanges(ranges.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleSplit = async () => {
    if (files.length === 0) {
      toast({ title: 'PDF 파일을 선택해주세요', variant: 'destructive' });
      return;
    }

    // Validate ranges
    for (const range of ranges) {
      if (range.start < 1 || range.end > (pageCount || 0) || range.start > range.end) {
        toast({
          title: '잘못된 페이지 범위',
          description: `${range.start}-${range.end}는 유효하지 않습니다 (총 ${pageCount} 페이지)`,
          variant: 'destructive',
        });
        return;
      }
    }

    setIsSplitting(true);
    setOutputUrls([]);
    setSelectedFiles(new Set());
    setFileNames({});
    addLog(`PDF 분할 시작: ${ranges.length}개 범위`);

    try {
      const formData = new FormData();
      formData.append('fileData', JSON.stringify(files[0]));
      formData.append('sessionId', sessionId);
      formData.append('ranges', JSON.stringify(ranges.map(r => ({
        start: r.start,
        end: r.end,
        name: r.name || undefined,
      }))));

      const response = await fetch('/api/document/split', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      setOutputUrls(data.outputUrls);
      addLog(`분할 완료: ${data.outputUrls.length}개 파일 생성`);
      toast({ title: '분할 완료', description: data.message });

    } catch (error: any) {
      toast({ title: '분할 실패', description: error.message, variant: 'destructive' });
      addLog(`오류: ${error.message}`);
    } finally {
      setIsSplitting(false);
    }
  };

  const updateFileName = (index: number, name: string) => {
    setFileNames(prev => ({ ...prev, [index]: name }));
  };

  const toggleFileSelection = (index: number) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedFiles(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedFiles.size === outputUrls.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(outputUrls.map((_, i) => i)));
    }
  };

  const downloadSelected = async () => {
    if (selectedFiles.size === 0) {
      toast({ title: '다운로드할 파일을 선택해주세요', variant: 'destructive' });
      return;
    }

    for (const index of Array.from(selectedFiles)) {
      const url = outputUrls[index];
      const link = document.createElement('a');
      link.href = url;

      if (fileNames[index]) {
        link.download = `${fileNames[index]}.pdf`;
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
    for (const [index, url] of outputUrls.entries()) {
      const link = document.createElement('a');
      link.href = url;

      if (fileNames[index]) {
        link.download = `${fileNames[index]}.pdf`;
      }

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    toast({ title: `${outputUrls.length}개 파일 다운로드 시작` });
    addLog(`전체 ${outputUrls.length}개 파일 다운로드 시작`);
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

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">PDF 분할</h2>

        <div className="space-y-4">
          <FileUploader
            onFilesAccepted={handleFilesAccepted}
            acceptedFormats={DOCUMENT_FORMATS}
            multiple={false}
          />

          {files.length > 0 && pageCount && (
            <>
              <div className="p-3 border rounded bg-muted/50">
                <p className="font-medium">{files[0].name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(files[0].size)} · 총 {pageCount} 페이지
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">분할 범위</h3>
                  <Button variant="outline" size="sm" onClick={addRange}>
                    <Plus className="h-4 w-4 mr-2" />
                    범위 추가
                  </Button>
                </div>

                {ranges.map((range, index) => (
                  <div key={range.id} className="flex items-center gap-2 p-3 border rounded">
                    <span className="font-medium text-sm w-8">{index + 1}.</span>
                    <Input
                      type="number"
                      min={1}
                      max={pageCount}
                      value={range.start}
                      onChange={(e) => updateRange(range.id, 'start', parseInt(e.target.value) || 1)}
                      className="w-20"
                      placeholder="시작"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="number"
                      min={1}
                      max={pageCount}
                      value={range.end}
                      onChange={(e) => updateRange(range.id, 'end', parseInt(e.target.value) || 1)}
                      className="w-20"
                      placeholder="끝"
                    />
                    <Input
                      type="text"
                      value={range.name}
                      onChange={(e) => updateRange(range.id, 'name', e.target.value)}
                      placeholder="파일명 (선택사항)"
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRange(range.id)}
                      disabled={ranges.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                onClick={handleSplit}
                disabled={isSplitting}
                className="w-full"
              >
                {isSplitting ? '분할 중...' : 'PDF 분할'}
              </Button>
            </>
          )}

          {files.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              PDF 파일을 업로드하면 페이지 범위를 설정할 수 있습니다
            </p>
          )}
        </div>
      </Card>

      {uploadProgress > 0 && uploadProgress < 100 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">파일 업로드</h3>
          <ProgressBar value={uploadProgress} label="업로드 중" />
        </Card>
      )}

      {outputUrls.length > 0 && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">분할 완료 ({outputUrls.length}개 파일)</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                {selectedFiles.size === outputUrls.length ? (
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
          </div>

          <div className="space-y-2">
            {outputUrls.map((url, index) => (
              <div key={index} className="flex items-center gap-2 p-2 border rounded">
                <button
                  onClick={() => toggleFileSelection(index)}
                  className="flex items-center flex-shrink-0"
                >
                  {selectedFiles.has(index) ? (
                    <CheckSquare className="h-5 w-5 text-primary" />
                  ) : (
                    <Square className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
                <span className="font-medium text-sm w-8">{index + 1}.</span>
                <Input
                  placeholder="파일명 입력 (선택사항)"
                  value={fileNames[index] || ''}
                  onChange={(e) => updateFileName(index, e.target.value)}
                  className="flex-1"
                />
                <a
                  href={url}
                  download={fileNames[index] ? `${fileNames[index]}.pdf` : ''}
                  className="inline-flex items-center text-sm text-primary flex-shrink-0 hover:underline"
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
