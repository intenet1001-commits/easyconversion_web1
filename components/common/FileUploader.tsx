'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card } from '@/components/ui/card';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  onFilesAccepted: (files: File[]) => void;
  acceptedFormats?: string[];
  multiple?: boolean;
  maxSize?: number;
}

export function FileUploader({
  onFilesAccepted,
  acceptedFormats,
  multiple = true,
  maxSize = 53687091200, // 50GB
}: FileUploaderProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      onFilesAccepted(acceptedFiles);
    },
    [onFilesAccepted]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple,
    maxSize,
    accept: acceptedFormats
      ? acceptedFormats.reduce((acc, format) => {
          // 미디어 파일 MIME 타입 매핑
          const mimeTypes: Record<string, string[]> = {
            mp4: ['video/mp4'],
            mp3: ['audio/mpeg', 'audio/mp3'],
            mov: ['video/quicktime'],
            wav: ['audio/wav', 'audio/x-wav'],
            avi: ['video/x-msvideo'],
            mkv: ['video/x-matroska'],
            pdf: ['application/pdf'],
            docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
            html: ['text/html'],
            md: ['text/markdown', 'text/plain'],
          };

          const types = mimeTypes[format] || [`application/${format}`, `video/${format}`, `audio/${format}`];
          types.forEach((type) => {
            acc[type] = [`.${format}`];
          });
          return acc;
        }, {} as Record<string, string[]>)
      : undefined,
  });

  return (
    <Card
      {...getRootProps()}
      className={cn(
        'border-2 border-dashed p-12 text-center cursor-pointer transition-colors',
        isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
      )}
    >
      <input {...getInputProps()} />
      <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
      {isDragActive ? (
        <p className="text-lg">파일을 드롭하세요...</p>
      ) : (
        <div>
          <p className="text-lg mb-2">파일을 드래그하거나 클릭하여 업로드</p>
          <p className="text-sm text-muted-foreground">
            {acceptedFormats ? `허용 형식: ${acceptedFormats.join(', ')}` : ''}
          </p>
        </div>
      )}
    </Card>
  );
}
