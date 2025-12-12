'use client';

import { useConversionStore } from '@/store/useConversionStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function LogViewer() {
  const { logs, clearLogs } = useConversionStore();
  const { toast } = useToast();

  const copyAllLogs = async () => {
    if (logs.length === 0) {
      toast({
        title: '복사할 로그가 없습니다',
        variant: 'destructive'
      });
      return;
    }

    const logsText = logs.join('\n');
    try {
      await navigator.clipboard.writeText(logsText);
      toast({
        title: '로그 복사 완료',
        description: `${logs.length}개의 로그가 복사되었습니다.`
      });
    } catch (error) {
      toast({
        title: '복사 실패',
        description: '클립보드에 접근할 수 없습니다.',
        variant: 'destructive'
      });
    }
  };

  return (
    <Card className="p-4 mt-6">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold">로그</h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={copyAllLogs}>
            <Copy className="h-4 w-4 mr-2" />
            복사
          </Button>
          <Button variant="ghost" size="sm" onClick={clearLogs}>
            <Trash2 className="h-4 w-4 mr-2" />
            지우기
          </Button>
        </div>
      </div>
      <ScrollArea className="h-48 w-full rounded border p-4 bg-muted/50">
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">로그가 없습니다.</p>
        ) : (
          <div className="space-y-1">
            {logs.map((log, index) => (
              <p key={index} className="text-xs font-mono">
                {log}
              </p>
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}
