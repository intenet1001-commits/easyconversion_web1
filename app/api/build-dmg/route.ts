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

        // 2. DMG 빌드 (실시간 출력)
        sendEvent({ type: 'progress', percent: 5, message: '🔨 Next.js 프로덕션 빌드 중... (1/2)' });

        let percent = 5;
        const nextjsStages: [RegExp, number, string][] = [
          [/Creating an optimized production build/, 10, 'Next.js 최적화 빌드 준비 중...'],
          [/Compiling|Compiled/, 25, 'Next.js 컴파일 중...'],
          [/Collecting page data/, 45, '페이지 데이터 수집 중...'],
          [/Generating static pages/, 60, '정적 페이지 생성 중...'],
          [/Collecting build traces/, 75, '빌드 트레이스 수집 중...'],
          [/Finalizing|✓ Compiled|Route \(app\)/, 85, 'Next.js 빌드 완료, 패키징 준비 중...'],
          [/packaging|Packaging/, 88, 'DMG 패키징 중... (2/2)'],
          [/building|Building/, 93, 'DMG 빌드 중...'],
          [/blockmap|Blockmap/, 96, 'DMG 최종 처리 중...'],
        ];

        const isNoisyLine = (line: string) =>
          !line.trim() ||
          /^\s*(at |•|›|info|warn:|ExperimentalWarning|DeprecationWarning|node_modules|\[.*\]\s*$)/.test(line) ||
          line.includes('node_modules') ||
          line.startsWith('  ') && line.includes('/');

        await new Promise<void>((resolve, reject) => {
          const buildProcess = spawn('npm', ['run', 'electron:build:mac'], {
            cwd: process.cwd(),
            shell: true,
          });

          buildProcess.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            for (const line of lines) {
              if (isNoisyLine(line)) continue;
              for (const [pattern, newPercent, label] of nextjsStages) {
                if (pattern.test(line) && newPercent > percent) {
                  percent = newPercent;
                  sendEvent({ type: 'progress', percent, message: label });
                  break;
                }
              }
            }
          });

          buildProcess.stderr.on('data', (data) => {
            const output = data.toString().trim();
            if (output &&
              !output.includes('warning') &&
              !output.includes('deprecated') &&
              !output.includes('ExperimentalWarning') &&
              !isNoisyLine(output)) {
              sendEvent({ type: 'progress', percent, message: `⚠️ ${output.slice(0, 120)}` });
            }
          });

          buildProcess.on('close', (code) => {
            if (code === 0) {
              sendEvent({ type: 'progress', percent: 97, message: '✅ DMG 빌드 완료' });
              resolve();
            } else {
              reject(new Error(`빌드 실패 (종료 코드: ${code})`));
            }
          });

          buildProcess.on('error', (error) => {
            reject(error);
          });
        });

        // 3. Applications 폴더에 복사
        sendEvent({ type: 'progress', percent: 98, message: '📁 Applications 폴더에 설치 중...' });
        const sourcePath = `${process.cwd()}/dist/mac-arm64/EasyConversion.app`;
        const targetPath = '/Applications/EasyConversion.app';

        await execAsync(`rm -rf "${targetPath}"`);
        await execAsync(`cp -R "${sourcePath}" "${targetPath}"`);
        sendEvent({ type: 'progress', percent: 99, message: '✅ Applications 폴더 설치 완료' });

        sendEvent({
          type: 'complete',
          percent: 100,
          message: '🎉 DMG 빌드 및 앱 설치 완료',
          dmgPath: `${process.cwd()}/dist/mac-arm64`,
          appPath: '/Applications/EasyConversion.app',
        });

        controller.close();
      } catch (error: any) {
        const errorMessage = error.message || 'DMG 빌드 실패';
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
