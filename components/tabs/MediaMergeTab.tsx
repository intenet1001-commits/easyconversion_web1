'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FileUploader } from '@/components/common/FileUploader';
import { ProgressBar } from '@/components/common/ProgressBar';
import { LogViewer } from '@/components/common/LogViewer';
import { useConversionStore } from '@/store/useConversionStore';
import { FileInfo, MediaFormat } from '@/types';
import { validateFile, MEDIA_FORMATS } from '@/lib/file-validator';
import { formatFileSize } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { X, Download, GripVertical } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
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
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: file.id,
  });

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
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
          <p className="font-medium">{file.name}</p>
        </div>
        <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={() => onRemove(file.id)}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function MediaMergeTab() {
  const { toast } = useToast();
  const { sessionId, addLog } = useConversionStore();
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [outputFormat, setOutputFormat] = useState<MediaFormat>('mp4');
  const [reencode, setReencode] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outputUrl, setOutputUrl] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

      setFiles((prev) => [...prev, fileInfo]);
      addLog(`파일 추가됨: ${file.name} (${formatFileSize(file.size)})`);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setFiles((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
      addLog('파일 순서 변경됨');
    }
  };

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      toast({ title: '최소 2개 이상의 파일이 필요합니다', variant: 'destructive' });
      return;
    }

    setIsMerging(true);
    setProgress(0);
    setOutputUrl('');
    addLog(`병합 시작: ${files.length}개 파일 → ${outputFormat.toUpperCase()}`);

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

      // 2. 병합 실행 (SSE)
      const mergeFormData = new FormData();
      mergeFormData.append('filesData', JSON.stringify(uploadData.files));
      mergeFormData.append('sessionId', sessionId);
      mergeFormData.append('outputFormat', outputFormat);
      mergeFormData.append('reencode', reencode.toString());

      const response = await fetch('/api/media/merge', {
        method: 'POST',
        body: mergeFormData,
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
              setProgress(data.progress);
              addLog(data.message);
            } else if (data.type === 'complete') {
              setOutputUrl(data.outputUrl);
              addLog(data.message);
              toast({ title: '병합 완료' });
            } else if (data.type === 'error') {
              throw new Error(data.message);
            } else if (data.type === 'info' || data.type === 'start') {
              addLog(data.message);
            }
          }
        }
      }
    } catch (error: any) {
      toast({ title: '병합 실패', description: error.message, variant: 'destructive' });
      addLog(`오류: ${error.message}`);
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">미디어 병합</h2>

        <div className="space-y-4">
          <FileUploader
            onFilesAccepted={handleFilesAccepted}
            acceptedFormats={MEDIA_FORMATS}
            multiple
          />

          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">파일 목록 ({files.length}개)</h3>
                <Button variant="outline" size="sm" onClick={() => setFiles([])}>
                  모두 제거
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                드래그하여 병합 순서를 변경할 수 있습니다
              </p>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={files} strategy={verticalListSortingStrategy}>
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

          <div>
            <Label>출력 형식</Label>
            <Select value={outputFormat} onValueChange={(v) => setOutputFormat(v as MediaFormat)}>
              <SelectTrigger className="mt-2">
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

          <div className="flex items-center space-x-2">
            <Checkbox
              id="reencode"
              checked={reencode}
              onCheckedChange={(checked) => setReencode(checked as boolean)}
            />
            <Label htmlFor="reencode" className="text-sm">
              재인코딩 (코덱이 다른 파일 병합 시 필요, 느림)
            </Label>
          </div>

          <Button onClick={handleMerge} disabled={isMerging || files.length < 2} className="w-full">
            {isMerging ? '병합 중...' : '병합 시작'}
          </Button>
        </div>
      </Card>

      {isMerging && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">병합 진행률</h3>
          <ProgressBar value={progress} label="미디어 병합" />
        </Card>
      )}

      {outputUrl && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">병합 완료</h3>
          <a href={outputUrl} download className="inline-flex items-center text-primary">
            <Download className="h-4 w-4 mr-2" />
            파일 다운로드
          </a>
        </Card>
      )}

      <LogViewer />
    </div>
  );
}
