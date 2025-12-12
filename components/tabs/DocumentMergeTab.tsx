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
import { X, Download, FolderOpen, GripVertical } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { uploadWithProgress } from '@/lib/upload-with-progress';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableFileItemProps {
  file: FileInfo;
  index: number;
  onRemove: (id: string) => void;
}

function SortableFileItem({ file, index, onRemove }: SortableFileItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: file.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 border rounded bg-background"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{index + 1}. {file.name}</p>
        <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={() => onRemove(file.id)}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function DocumentMergeTab() {
  const { toast } = useToast();
  const { files, addFile, removeFile, clearFiles, sessionId, addLog } = useConversionStore();
  const [isMerging, setIsMerging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleFilesAccepted = async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const validation = await validateFile(file, DOCUMENT_FORMATS);
      if (!validation.valid) {
        toast({ title: '파일 검증 실패', description: validation.error, variant: 'destructive' });
        continue;
      }

      // PDF만 허용
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        toast({ title: 'PDF 파일만 병합할 수 있습니다', variant: 'destructive' });
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = files.findIndex(f => f.id === active.id);
      const newIndex = files.findIndex(f => f.id === over.id);

      // Reorder files
      const reorderedFiles = arrayMove(files, oldIndex, newIndex);
      clearFiles();
      reorderedFiles.forEach(f => addFile(f));

      addLog(`파일 순서 변경: ${oldIndex + 1}번 → ${newIndex + 1}번`);
    }
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      toast({ title: '최소 2개 이상의 PDF 파일이 필요합니다', variant: 'destructive' });
      return;
    }

    setIsMerging(true);
    setOutputUrl(null);
    addLog(`PDF 병합 시작: ${files.length}개 파일`);

    try {
      // 1. 모든 파일 업로드
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file.file);
      });
      formData.append('sessionId', sessionId);

      addLog('파일 업로드 중...');
      setUploadProgress(0);

      const uploadRes = await uploadWithProgress({
        url: '/api/upload',
        formData,
        onProgress: (progress) => {
          setUploadProgress(progress);
        },
      });

      const uploadData = await uploadRes.json();

      if (!uploadData.success) {
        throw new Error(`업로드 실패: ${uploadData.error}`);
      }

      setUploadProgress(100);
      addLog('업로드 완료');

      // 2. PDF 병합
      addLog('PDF 병합 중...');
      const mergeFormData = new FormData();
      mergeFormData.append('filesData', JSON.stringify(uploadData.files));
      mergeFormData.append('sessionId', sessionId);

      const mergeRes = await fetch('/api/document/merge', {
        method: 'POST',
        body: mergeFormData,
      });

      const mergeData = await mergeRes.json();

      if (!mergeData.success) {
        throw new Error(`병합 실패: ${mergeData.error}`);
      }

      setOutputUrl(mergeData.outputUrl);
      addLog('병합 완료!');
      toast({ title: '병합 완료', description: mergeData.message });

    } catch (error: any) {
      toast({ title: '병합 실패', description: error.message, variant: 'destructive' });
      addLog(`오류: ${error.message}`);
    } finally {
      setIsMerging(false);
      setUploadProgress(0);
    }
  };

  const downloadFile = () => {
    if (!outputUrl) return;

    const link = document.createElement('a');
    link.href = outputUrl;

    if (fileName) {
      link.download = `${fileName}.pdf`;
    }

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: '다운로드 시작' });
    addLog('파일 다운로드 시작');
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
        <h2 className="text-xl font-semibold mb-4">PDF 병합</h2>

        <div className="space-y-4">
          <FileUploader
            onFilesAccepted={handleFilesAccepted}
            acceptedFormats={DOCUMENT_FORMATS}
            multiple
          />

          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">병합할 파일 ({files.length})</h3>
                <Button variant="outline" size="sm" onClick={clearFiles}>
                  모두 제거
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                드래그하여 순서를 변경할 수 있습니다
              </p>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={files.map(f => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {files.map((file, index) => (
                      <SortableFileItem
                        key={file.id}
                        file={file}
                        index={index}
                        onRemove={removeFile}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

          <Button
            onClick={handleMerge}
            disabled={isMerging || files.length < 2}
            className="w-full"
          >
            {isMerging ? '병합 중...' : 'PDF 병합'}
          </Button>
        </div>
      </Card>

      {isMerging && uploadProgress < 100 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">파일 업로드</h3>
          <ProgressBar value={uploadProgress} label="업로드 중" />
        </Card>
      )}

      {outputUrl && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">병합 완료</h3>
          <div className="space-y-3">
            <Input
              placeholder="파일명 입력 (선택사항)"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={downloadFile} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                다운로드
              </Button>
              <Button variant="outline" onClick={openDownloadFolder}>
                <FolderOpen className="h-4 w-4 mr-2" />
                다운로드 폴더 열기
              </Button>
            </div>
          </div>
        </Card>
      )}

      <LogViewer />
    </div>
  );
}
