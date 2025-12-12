import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { folderPath, openUserDownloads, openProjectDownloads, openDistFolder } = await request.json();

    // OS에 따라 다른 명령어 실행
    const platform = process.platform;
    let command: string;
    let targetPath: string;

    if (openDistFolder) {
      // dist 폴더 열기 (Electron 빌드 결과)
      targetPath = path.join(process.cwd(), 'dist');

      // dist 폴더가 없으면 생성 (또는 안내 메시지)
      if (!existsSync(targetPath)) {
        return NextResponse.json(
          { success: false, error: 'dist 폴더가 없습니다. 먼저 DMG를 빌드하세요.' },
          { status: 404 }
        );
      }

      if (platform === 'darwin') {
        command = `open "${targetPath}"`;
      } else if (platform === 'win32') {
        command = `explorer "${targetPath}"`;
      } else {
        command = `xdg-open "${targetPath}"`;
      }
    } else if (openProjectDownloads) {
      // 프로젝트 다운로드 폴더 열기
      targetPath = path.join(process.cwd(), 'public', 'downloads');

      if (platform === 'darwin') {
        command = `open "${targetPath}"`;
      } else if (platform === 'win32') {
        command = `explorer "${targetPath}"`;
      } else {
        command = `xdg-open "${targetPath}"`;
      }
    } else if (openUserDownloads) {
      // 사용자 Downloads 폴더 열기 (다운로드 파일 저장 위치)
      const homeDir = os.homedir();
      targetPath = path.join(homeDir, 'Downloads');

      if (platform === 'darwin') {
        // macOS
        command = `open "${targetPath}"`;
      } else if (platform === 'win32') {
        // Windows
        command = `explorer "${targetPath}"`;
      } else {
        // Linux
        command = `xdg-open "${targetPath}"`;
      }
    } else {
      // 지정된 폴더 열기
      if (!folderPath) {
        return NextResponse.json(
          { success: false, error: 'Folder path is required' },
          { status: 400 }
        );
      }

      // 폴더 존재 확인
      if (!existsSync(folderPath)) {
        return NextResponse.json(
          { success: false, error: 'Folder does not exist' },
          { status: 404 }
        );
      }

      targetPath = folderPath;

      if (platform === 'darwin') {
        // macOS
        command = `open "${targetPath}"`;
      } else if (platform === 'win32') {
        // Windows
        command = `explorer "${targetPath}"`;
      } else {
        // Linux
        command = `xdg-open "${targetPath}"`;
      }
    }

    console.log(`[OPEN-FOLDER] Opening: ${targetPath}`);
    await execAsync(command);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error opening folder:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to open folder' },
      { status: 500 }
    );
  }
}
