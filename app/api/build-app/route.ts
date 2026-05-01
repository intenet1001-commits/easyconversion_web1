import { spawn } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // SSE 헬퍼 함수
        const sendEvent = (data: any) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        };

        sendEvent({ type: 'progress', message: '🔄 빌드 프로세스 시작...' });

        // 1. 실행 중인 앱 프로세스 종료 (node 서버 제외)
        sendEvent({ type: 'progress', message: '⏹️  실행 중인 프로세스 종료 중...' });
        try {
          await execAsync('pkill -f "EasyConversion" 2>/dev/null || true');
          await execAsync('pkill -9 -f "electron.*easyconversion" 2>/dev/null || true');
          sendEvent({ type: 'progress', message: '✅ 프로세스 종료 완료' });
        } catch (error) {
          sendEvent({ type: 'progress', message: '⚠️  프로세스 종료 중 에러 (무시)' });
        }

        // 2. 앱 빌드 (실시간 출력)
        sendEvent({ type: 'progress', message: '🔨 앱 빌드 시작...' });

        await new Promise<void>((resolve, reject) => {
          const buildProcess = spawn('npm', ['run', 'electron:build:mac:app'], {
            cwd: process.cwd(),
            shell: true,
          });

          buildProcess.stdout.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
              // 모든 출력 표시 (더 상세한 진행 상황)
              const lines = output.split('\n');
              lines.forEach((line: string) => {
                if (line.trim()) {
                  sendEvent({ type: 'progress', message: `📦 ${line}` });
                }
              });
            }
          });

          buildProcess.stderr.on('data', (data) => {
            const output = data.toString().trim();
            if (output && !output.includes('warning') && !output.includes('deprecated')) {
              sendEvent({ type: 'progress', message: `⚠️  ${output}` });
            }
          });

          buildProcess.on('close', (code) => {
            if (code === 0) {
              sendEvent({ type: 'progress', message: '✅ 앱 빌드 완료' });
              resolve();
            } else {
              reject(new Error(`빌드 프로세스 종료 코드: ${code}`));
            }
          });

          buildProcess.on('error', (error) => {
            reject(error);
          });
        });

        // 3. Applications 폴더에 복사
        sendEvent({ type: 'progress', message: '📁 Applications 폴더에 설치 중...' });
        const sourcePath = `${process.cwd()}/dist/mac-arm64/EasyConversion.app`;
        const targetPath = '/Applications/EasyConversion.app';

        await execAsync(`rm -rf "${targetPath}"`);
        await execAsync(`cp -R "${sourcePath}" "${targetPath}"`);
        sendEvent({ type: 'progress', message: '✅ Applications 폴더 설치 완료' });

        sendEvent({
          type: 'complete',
          message: '🎉 앱 빌드 및 설치 완료',
          path: '/Applications/EasyConversion.app',
        });

        controller.close();
      } catch (error: any) {
        const errorMessage = error.message || '앱 빌드 실패';
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'error',
              error: errorMessage,
            })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
