'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FileUploader } from '@/components/common/FileUploader';
import { ProgressBar } from '@/components/common/ProgressBar';
import { LogViewer } from '@/components/common/LogViewer';
import { TimeInput } from '@/components/common/TimeInput';
import { useConversionStore } from '@/store/useConversionStore';
import { FileInfo } from '@/types';
import { validateFile, MEDIA_FORMATS } from '@/lib/file-validator';
import { formatFileSize } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { X, Download, Plus, Trash2, List, FolderOpen, CheckSquare, Square } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Textarea } from '@/components/ui/textarea';
import { uploadWithProgress } from '@/lib/upload-with-progress';

type SplitMode = 'timepoints' | 'segments';

export function MediaSplitTab() {
  const { toast } = useToast();
  const { sessionId, addLog } = useConversionStore();
  const [file, setFile] = useState<FileInfo | null>(null);
  const [mode, setMode] = useState<SplitMode>('segments');
  const [segmentCount, setSegmentCount] = useState(3);
  const [timepoints, setTimepoints] = useState<string[]>(['00:01:00']);
  const [isSplitting, setIsSplitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progress, setProgress] = useState<{ [key: number]: number }>({});
  const [outputUrls, setOutputUrls] = useState<string[]>([]);
  const [showBulkInput, setShowBulkInput] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [downloadFolder, setDownloadFolder] = useState<string>('');
  const [fileNames, setFileNames] = useState<{ [key: number]: string }>({});

  const handleFilesAccepted = async (acceptedFiles: File[]) => {
    const uploadFile = acceptedFiles[0];
    if (!uploadFile) return;

    const validation = await validateFile(uploadFile, MEDIA_FORMATS);
    if (!validation.valid) {
      toast({ title: '파일 검증 실패', description: validation.error, variant: 'destructive' });
      return;
    }

    const fileInfo: FileInfo = {
      id: uuidv4(),
      name: uploadFile.name,
      size: uploadFile.size,
      type: uploadFile.type,
      file: uploadFile,
    };

    setFile(fileInfo);
    addLog(`파일 추가됨: ${uploadFile.name} (${formatFileSize(uploadFile.size)})`);
  };

  const addTimepoint = () => {
    setTimepoints([...timepoints, '00:00:00']);
  };

  const removeTimepoint = (index: number) => {
    setTimepoints(timepoints.filter((_, i) => i !== index));
  };

  const updateTimepoint = (index: number, value: string) => {
    const newTimepoints = [...timepoints];
    newTimepoints[index] = value;
    setTimepoints(newTimepoints);
  };

  // 여러 줄 시간 입력 처리
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

  const updateFileName = (index: number, name: string) => {
    setFileNames(prev => ({ ...prev, [index]: name }));
  };

  const downloadSelected = async () => {
    if (selectedFiles.size === 0) {
      toast({ title: '다운로드할 파일을 선택해주세요', variant: 'destructive' });
      return;
    }

    const indices = Array.from(selectedFiles);
    for (const index of indices) {
      const url = outputUrls[index];
      const link = document.createElement('a');
      link.href = url;

      // 사용자 지정 파일명이 있으면 사용
      if (fileNames[index]) {
        const ext = url.substring(url.lastIndexOf('.'));
        link.download = `${fileNames[index]}${ext}`;
      } else {
        link.download = '';
      }

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      await new Promise(resolve => setTimeout(resolve, 300)); // 다운로드 간 딜레이
    }

    toast({ title: `${selectedFiles.size}개 파일 다운로드 시작` });
    addLog(`${selectedFiles.size}개 파일 다운로드 시작`);
  };

  const downloadAll = async () => {
    for (let i = 0; i < outputUrls.length; i++) {
      const url = outputUrls[i];
      const link = document.createElement('a');
      link.href = url;

      // 사용자 지정 파일명이 있으면 사용
      if (fileNames[i]) {
        const ext = url.substring(url.lastIndexOf('.'));
        link.download = `${fileNames[i]}${ext}`;
      } else {
        link.download = '';
      }

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      await new Promise(resolve => setTimeout(resolve, 300)); // 다운로드 간 딜레이
    }

    toast({ title: `${outputUrls.length}개 파일 다운로드 시작` });
    addLog(`전체 ${outputUrls.length}개 파일 다운로드 시작`);
  };

  const openDownloadFolder = async () => {
    try {
      const response = await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: '', // 빈 문자열이면 사용자 다운로드 폴더 열기
          openUserDownloads: true
        }),
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

  const handleBulkTimeInput = () => {
    const lines = bulkInput.trim().split('\n');
    const parsedTimes: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 숫자만 추출
      const numbers = trimmed.replace(/\D/g, '');

      if (numbers.length === 0) continue;

      // 6자리로 패딩
      const padded = numbers.padStart(6, '0').slice(0, 6);

      // HH:MM:SS 형식으로 변환
      const formatted = `${padded.slice(0, 2)}:${padded.slice(2, 4)}:${padded.slice(4, 6)}`;
      parsedTimes.push(formatted);
    }

    if (parsedTimes.length === 0) {
      toast({ title: '유효한 시간을 입력해주세요', variant: 'destructive' });
      return;
    }

    setTimepoints(parsedTimes);
    setBulkInput('');
    setShowBulkInput(false);
    toast({
      title: '시간 입력 완료',
      description: `${parsedTimes.length}개의 구간 지점이 추가되었습니다.`
    });
    addLog(`${parsedTimes.length}개의 구간 지점 설정됨`);
  };

  const handleSplit = async () => {
    if (!file) {
      toast({ title: '파일을 선택해주세요', variant: 'destructive' });
      return;
    }

    if (mode === 'timepoints' && timepoints.length === 0) {
      toast({ title: '최소 1개의 구간 지점을 입력해주세요', variant: 'destructive' });
      return;
    }

    setIsSplitting(true);
    setUploadProgress(0);
    setProgress({});
    setOutputUrls([]);
    setSelectedFiles(new Set());
    setDownloadFolder('');
    setFileNames({});
    addLog(`분할 시작: ${file.name}`);

    try {
      // 1. 파일 업로드 (진행률 표시)
      const formData = new FormData();
      formData.append('files', file.file);
      formData.append('sessionId', sessionId);

      addLog('파일 업로드 중...');
      const uploadRes = await uploadWithProgress({
        url: '/api/upload',
        formData,
        onProgress: (progress) => {
          setUploadProgress(progress);
          if (progress % 10 === 0 || progress === 100) {
            addLog(`업로드 진행률: ${progress}%`);
          }
        },
      });

      const uploadData = await uploadRes.json();

      if (!uploadData.success) {
        throw new Error(uploadData.error);
      }

      setUploadProgress(100);
      addLog('파일 업로드 완료');

      // 2. 분할 실행 (SSE)
      const splitFormData = new FormData();
      splitFormData.append('fileData', JSON.stringify(uploadData.files[0]));
      splitFormData.append('sessionId', sessionId);
      splitFormData.append('mode', mode);

      if (mode === 'timepoints') {
        splitFormData.append('timepoints', JSON.stringify(timepoints));
      } else {
        splitFormData.append('segmentCount', segmentCount.toString());
      }

      const response = await fetch('/api/media/split', {
        method: 'POST',
        body: splitFormData,
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
              setProgress((prev) => ({
                ...prev,
                [data.segmentIndex]: data.progress,
              }));
              addLog(data.message);
            } else if (data.type === 'complete') {
              setOutputUrls(data.outputUrls);
              setDownloadFolder(data.downloadFolder || '');
              addLog(data.message);
              toast({ title: '분할 완료' });
            } else if (data.type === 'error') {
              throw new Error(data.message);
            } else if (data.type === 'info' || data.type === 'start') {
              addLog(data.message);
            }
          }
        }
      }
    } catch (error: any) {
      toast({ title: '분할 실패', description: error.message, variant: 'destructive' });
      addLog(`오류: ${error.message}`);
    } finally {
      setIsSplitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">미디어 분할</h2>

        <div className="space-y-4">
          <FileUploader
            onFilesAccepted={handleFilesAccepted}
            acceptedFormats={MEDIA_FORMATS}
            multiple={false}
          />

          {file && (
            <div className="flex items-center justify-between p-3 border rounded">
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div>
            <Label>분할 방식</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as SplitMode)} className="mt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="segments" id="mode-segments" />
                <Label htmlFor="mode-segments">동일한 구간으로 분할</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="timepoints" id="mode-timepoints" />
                <Label htmlFor="mode-timepoints">시간 지점으로 분할</Label>
              </div>
            </RadioGroup>
          </div>

          {mode === 'segments' && (
            <div>
              <Label htmlFor="segment-count">구간 개수</Label>
              <Input
                id="segment-count"
                type="number"
                min={2}
                max={20}
                value={segmentCount}
                onChange={(e) => setSegmentCount(parseInt(e.target.value) || 2)}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1">
                영상을 {segmentCount}개의 동일한 길이로 분할합니다
              </p>
            </div>
          )}

          {mode === 'timepoints' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>구간 지점 (HH:MM:SS)</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkInput(!showBulkInput)}
                >
                  <List className="h-4 w-4 mr-2" />
                  {showBulkInput ? '개별 입력' : '일괄 입력'}
                </Button>
              </div>

              {showBulkInput ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    여러 줄로 시간을 입력하세요. 각 줄에 하나씩 입력 (예: 02 45 16)
                  </p>
                  <Textarea
                    placeholder={'02 45 16\n05 22 51\n07 06 55\n09 43 00'}
                    value={bulkInput}
                    onChange={(e) => setBulkInput(e.target.value)}
                    rows={6}
                    className="font-mono whitespace-pre"
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleBulkTimeInput} className="flex-1">
                      적용
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setBulkInput('');
                        setShowBulkInput(false);
                      }}
                    >
                      취소
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-2">
                    숫자만 입력하거나 "HH MM SS" 형식으로 붙여넣으세요. 콜론(:)은 자동으로 추가됩니다.
                  </p>
                  <div className="space-y-2">
                    {timepoints.map((time, index) => (
                      <div key={index} className="flex gap-2">
                        <TimeInput
                          placeholder="00:01:30"
                          value={time}
                          onChange={(value) => updateTimepoint(index, value)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeTimepoint(index)}
                          disabled={timepoints.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addTimepoint}>
                      <Plus className="h-4 w-4 mr-2" />
                      구간 추가
                    </Button>
                  </div>
                </>
              )}

              <p className="text-sm text-muted-foreground mt-2">
                {timepoints.length + 1}개 구간으로 분할됩니다
              </p>
            </div>
          )}

          <Button onClick={handleSplit} disabled={isSplitting || !file} className="w-full">
            {isSplitting ? '분할 중...' : '분할 시작'}
          </Button>
        </div>
      </Card>

      {isSplitting && uploadProgress < 100 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">파일 업로드</h3>
          <ProgressBar value={uploadProgress} label="업로드 중" />
        </Card>
      )}

      {isSplitting && uploadProgress === 100 && Object.keys(progress).length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">분할 진행률</h3>
          <div className="space-y-4">
            {Object.entries(progress).map(([segmentIndex, progressValue]) => (
              <ProgressBar
                key={segmentIndex}
                value={progressValue}
                label={`구간 ${parseInt(segmentIndex) + 1}`}
              />
            ))}
          </div>
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
              <div
                key={index}
                className="flex items-center gap-2 p-3 border rounded hover:bg-muted/50"
              >
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
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-16">구간 {index + 1}</span>
                  <Input
                    placeholder={`파일명 입력 (선택사항)`}
                    value={fileNames[index] || ''}
                    onChange={(e) => updateFileName(index, e.target.value)}
                    className="flex-1"
                  />
                </div>
                <a
                  href={url}
                  download={fileNames[index] ? `${fileNames[index]}${url.substring(url.lastIndexOf('.'))}` : ''}
                  className="flex items-center text-primary hover:underline flex-shrink-0"
                >
                  <Download className="h-4 w-4 mr-2" />
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
