'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ProgressBar } from '@/components/common/ProgressBar';
import { LogViewer } from '@/components/common/LogViewer';
import { useConversionStore } from '@/store/useConversionStore';
import { useToast } from '@/hooks/use-toast';
import { Download, Info, Loader2 } from 'lucide-react';

export function YouTubeTab() {
  const { toast } = useToast();
  const { sessionId, addLog } = useConversionStore();
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<'mp4' | 'mp3'>('mp4');
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState<any>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);

  const handleGetInfo = async () => {
    if (!url) {
      toast({ title: 'URL을 입력해주세요', variant: 'destructive' });
      return;
    }

    setIsLoadingInfo(true);
    addLog(`비디오 정보 가져오는 중: ${url}`);

    try {
      const res = await fetch('/api/youtube/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      setVideoInfo(data.info);
      addLog(`제목: ${data.info.title}`);
      toast({ title: '정보 로드 완료', description: data.info.title });
    } catch (error: any) {
      toast({ title: '정보 로드 실패', description: error.message, variant: 'destructive' });
      addLog(`오류: ${error.message}`);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const handleDownload = async () => {
    if (!url) {
      toast({ title: 'URL을 입력해주세요', variant: 'destructive' });
      return;
    }

    setIsDownloading(true);
    setProgress(0);
    setDownloadUrl('');
    addLog(`다운로드 시작: ${url} (${format.toUpperCase()})`);

    try {
      const response = await fetch('/api/youtube/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format, sessionId }),
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
            } else if (data.type === 'complete') {
              setDownloadUrl(data.outputUrl);
              addLog(data.message);
              toast({ title: '다운로드 완료' });
            } else if (data.type === 'error') {
              throw new Error(data.message);
            }

            if (data.message) {
              addLog(data.message);
            }
          }
        }
      }
    } catch (error: any) {
      toast({ title: '다운로드 실패', description: error.message, variant: 'destructive' });
      addLog(`오류: ${error.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
      toast({ title: 'URL 붙여넣기 완료' });
    } catch (error) {
      toast({ title: 'clipboard 접근 실패', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">YouTube 다운로드</h2>

        <div className="space-y-4">
          <div>
            <Label htmlFor="youtube-url">YouTube URL</Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="youtube-url"
                placeholder="https://youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <Button variant="outline" onClick={handlePaste}>
                붙여넣기
              </Button>
              <Button variant="outline" onClick={handleGetInfo} disabled={isLoadingInfo}>
                {isLoadingInfo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Info className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {videoInfo && (
            <Card className="p-4 bg-muted">
              <div className="flex gap-4">
                {videoInfo.thumbnail && (
                  <img src={videoInfo.thumbnail} alt="썸네일" className="w-32 h-auto rounded" />
                )}
                <div>
                  <h3 className="font-semibold">{videoInfo.title}</h3>
                  <p className="text-sm text-muted-foreground">채널: {videoInfo.author}</p>
                  <p className="text-sm text-muted-foreground">
                    길이: {Math.floor(videoInfo.duration / 60)}분 {videoInfo.duration % 60}초
                  </p>
                </div>
              </div>
            </Card>
          )}

          <div>
            <Label>출력 형식</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as 'mp4' | 'mp3')} className="mt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mp4" id="format-mp4" />
                <Label htmlFor="format-mp4">MP4 (비디오)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mp3" id="format-mp3" />
                <Label htmlFor="format-mp3">MP3 (오디오)</Label>
              </div>
            </RadioGroup>
          </div>

          <Button onClick={handleDownload} disabled={isDownloading || !url} className="w-full">
            {isDownloading ? '다운로드 중...' : '다운로드 시작'}
          </Button>
        </div>
      </Card>

      {isDownloading && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">다운로드 진행률</h3>
          <ProgressBar value={progress} label="YouTube 다운로드" />
        </Card>
      )}

      {downloadUrl && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">다운로드 완료</h3>
          <a href={downloadUrl} download className="inline-flex items-center text-primary">
            <Download className="h-4 w-4 mr-2" />
            파일 다운로드
          </a>
        </Card>
      )}

      <LogViewer />
    </div>
  );
}
