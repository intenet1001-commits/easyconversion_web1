'use client';

import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export function Header() {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary">
              EasyConversion Web
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              올인원 파일 변환 웹 애플리케이션
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            새로고침
          </Button>
        </div>
      </div>
    </header>
  );
}
