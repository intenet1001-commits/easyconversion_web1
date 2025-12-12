/**
 * 파일 업로드를 진행률과 함께 수행하는 유틸리티 함수
 */
export interface UploadProgressOptions {
  url: string;
  formData: FormData;
  onProgress?: (progress: number) => void;
}

export async function uploadWithProgress({
  url,
  formData,
  onProgress,
}: UploadProgressOptions): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // 업로드 시작 감지
    xhr.upload.addEventListener('loadstart', () => {
      console.log('[UPLOAD] Upload started');
      if (onProgress) {
        onProgress(0);
      }
    });

    // 업로드 진행률 추적
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        const loadedMB = (event.loaded / (1024 * 1024)).toFixed(2);
        const totalMB = (event.total / (1024 * 1024)).toFixed(2);
        console.log(`[UPLOAD] Progress: ${percentComplete}% (${loadedMB}MB / ${totalMB}MB)`);
        onProgress(percentComplete);
      }
    });

    // 완료 처리
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Response 객체 생성
        const response = new Response(xhr.responseText, {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: new Headers(
            xhr
              .getAllResponseHeaders()
              .split('\r\n')
              .reduce((acc, line) => {
                const parts = line.split(': ');
                if (parts.length === 2) {
                  acc[parts[0]] = parts[1];
                }
                return acc;
              }, {} as Record<string, string>)
          ),
        });
        resolve(response);
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`));
      }
    });

    // 에러 처리
    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'));
    });

    // 요청 시작
    xhr.open('POST', url);
    xhr.send(formData);
  });
}
