# 재사용 가능한 프롬프트 모음

이 문서는 EasyConversion Web 프로젝트 개발 과정에서 유용했던 프롬프트를 상황별로 정리한 것입니다.
각 프롬프트는 복사해서 바로 사용할 수 있도록 코드 블록으로 작성되어 있습니다.

---

## 1. 대용량 파일 업로드 문제 해결

### 상황: 파일 업로드 시 500 에러 발생

```
8.85GB 파일을 업로드했는데 100% 업로드 후 500 에러가 발생합니다.
로그를 확인해보니 [UPLOAD] Starting file upload process 이후 아무 로그도 없습니다.
request.formData()를 사용하고 있는데, 이것이 문제일까요?
대용량 파일을 메모리에 로드하지 않고 스트리밍 방식으로 업로드하려면 어떻게 해야 하나요?
```

### 후속 조치 프롬프트

```
formidable 라이브러리를 사용하여 Next.js Request를 Node.js Readable Stream으로 변환하는 방법을 알려주세요.
/api/upload/route.ts 파일을 전체적으로 수정해주세요.
```

---

## 2. 업로드 진행률 표시

### 상황: fetch API로는 업로드 진행률을 추적할 수 없음

```
fetch API를 사용해서 파일을 업로드하고 있는데, 업로드 진행률을 표시하고 싶습니다.
XMLHttpRequest를 Promise로 래핑하여 사용하고 싶은데,
upload.addEventListener('progress') 이벤트를 활용하는 방법을 알려주세요.
lib/upload-with-progress.ts 파일을 만들어주세요.
```

---

## 3. SSE (Server-Sent Events) 실시간 진행률

### 상황: 긴 작업의 진행률을 실시간으로 표시하고 싶음

```
FFmpeg 작업이 오래 걸리는데, 실시간으로 진행률을 보여주고 싶습니다.
Server-Sent Events (SSE)를 사용하여 구현하고 싶은데,
Next.js API Route에서 ReadableStream + TextEncoder로 이벤트를 전송하고,
클라이언트에서 response.body.getReader()로 수신하는 방법을 알려주세요.
```

### 클라이언트 SSE 수신 코드 요청

```
SSE로 전송되는 진행률 데이터를 받아서 화면에 표시하고 싶습니다.
response.body.getReader()를 사용하여 다음 형식의 데이터를 파싱하는 코드를 작성해주세요:
- data: {"type":"progress","progress":45,"message":"처리 중..."}
- data: {"type":"complete","outputUrl":"/downloads/file.mp4"}
```

---

## 4. 순차 처리 vs 배치 처리

### 상황: 여러 대용량 파일을 효율적으로 처리하고 싶음

```
미디어 변환에서 여러 파일을 처리할 때,
모든 파일을 한 번에 업로드하면 메모리가 부족합니다.
파일을 순차적으로 처리하도록 변경하고 싶습니다:
1. 파일 1개 업로드 → 변환 → 완료
2. 파일 2개 업로드 → 변환 → 완료
...
이런 방식으로 구현해주세요.
```

---

## 5. 드래그 앤 드롭 순서 조정

### 상황: PDF 병합 시 파일 순서를 조정하고 싶음

```
@dnd-kit 라이브러리를 사용하여 파일 목록의 순서를 드래그 앤 드롭으로 변경하고 싶습니다.
SortableContext와 useSortable 훅을 사용하여 구현해주세요.
arrayMove 함수로 배열 순서를 변경하는 방법도 포함해주세요.
```

---

## 6. 시간 입력 자동 포맷팅

### 상황: 시간 입력 시 사용자 편의성을 높이고 싶음

```
사용자가 "024516"을 입력하면 자동으로 "02:45:16"으로 포맷팅되는
TimeInput 컴포넌트를 만들어주세요.
숫자만 추출하고, 2자리마다 콜론을 자동으로 삽입하는 방식으로 구현해주세요.
```

### 일괄 시간 입력 파싱

```
사용자가 Textarea에 여러 줄로 시간을 입력할 수 있게 하고 싶습니다:
예시 입력:
02 45 16
1:30:00
024516

이런 다양한 형식을 모두 "HH:MM:SS" 형식의 배열로 변환하는 파싱 함수를 만들어주세요.
```

---

## 7. 세션 기반 파일 관리

### 상황: 브라우저 닫을 때 자동으로 파일 정리

```
사용자가 브라우저를 닫거나 새로고침할 때,
해당 세션의 업로드/다운로드 파일을 자동으로 삭제하고 싶습니다.
navigator.sendBeacon()과 beforeunload/pagehide 이벤트를 사용하여
/api/cleanup을 호출하는 방법을 알려주세요.
```

---

## 8. 파일 검증

### 상황: 업로드된 파일의 유효성을 검증하고 싶음

```
파일 업로드 시 다음 조건을 검증하고 싶습니다:
1. 파일 크기 제한 (50GB)
2. 허용된 MIME 타입만 업로드 가능
3. 파일 확장자 검증

lib/file-validator.ts에 validateFile 함수를 만들어주세요.
```

---

## 9. PDF 조작 (병합/분할)

### PDF 병합

```
pdf-lib 라이브러리를 사용하여 여러 PDF 파일을 하나로 병합하는 함수를 만들어주세요.
각 PDF의 모든 페이지를 순서대로 복사하여 새로운 PDF를 생성하는 방식으로 구현해주세요.
lib/pdf-utils.ts에 mergePDFs 함수를 추가해주세요.
```

### PDF 분할

```
pdf-lib를 사용하여 PDF에서 특정 페이지 범위를 추출하는 함수를 만들어주세요.
시작 페이지와 끝 페이지를 받아서 해당 범위의 페이지만 포함된 새 PDF를 생성해주세요.
1-based 인덱스를 사용하고, 유효성 검증도 포함해주세요.
```

### PDF 페이지 수 조회

```
PDF 파일의 전체 페이지 수를 반환하는 함수를 만들어주세요.
pdf-lib의 getPageCount() 메서드를 사용하면 됩니다.
```

---

## 10. 체크박스 선택 관리

### 상황: 여러 파일 중 일부만 선택하여 처리하고 싶음

```
파일 목록에서 체크박스로 파일을 선택하고,
선택된 파일들만 다운로드하는 기능을 구현하고 싶습니다.
Set<string>을 사용하여 선택 상태를 관리하고,
전체 선택/해제 기능도 포함해주세요.
```

---

## 11. OS별 폴더 열기

### 상황: 플랫폼에 맞는 명령어로 폴더 열기

```
macOS, Windows, Linux에서 각각 Finder/Explorer/파일관리자로
특정 폴더를 여는 API 엔드포인트를 만들어주세요.
child_process의 exec를 사용하여 구현해주세요:
- macOS: open "path"
- Windows: explorer "path"
- Linux: xdg-open "path"
```

---

## 12. 프로젝트 파일 관리 팝업

### 상황: 서버에 저장된 파일들을 관리하고 싶음

```
public/downloads/ 폴더의 모든 파일을 조회하고,
선택하여 다운로드하거나 삭제할 수 있는 팝업 컴포넌트를 만들어주세요.
다음 기능이 필요합니다:
1. 파일 목록 조회 (파일명, 크기, 생성일시)
2. 체크박스로 선택
3. 전체 선택/해제
4. 선택 다운로드
5. 선택 삭제
6. 전체 삭제
7. 새로고침
```

---

## 13. Next.js 클라이언트/서버 분리

### 상황: Node.js 전용 라이브러리 번들링 에러

```
fluent-ffmpeg를 사용하는데 클라이언트 번들에 포함되어 에러가 발생합니다.
서버 전용 함수를 별도 파일로 분리하고 싶습니다.
lib/ffmpeg-utils.ts 파일을 만들어서 FFmpeg 관련 함수를 분리해주세요.
클라이언트/서버 공용 유틸리티는 lib/utils.ts에 유지해주세요.
```

---

## 14. Zustand 상태 관리

### 상황: 전역 상태 관리가 필요함

```
Zustand를 사용하여 다음 상태를 관리하는 store를 만들어주세요:
1. 현재 활성화된 탭
2. 업로드된 파일 목록
3. 세션 ID
4. 로그 배열
5. 진행률 정보

store/useConversionStore.ts 파일을 만들어주세요.
```

---

## 15. shadcn/ui 컴포넌트 추가

### Dialog 컴포넌트 추가

```
shadcn/ui의 Dialog 컴포넌트를 프로젝트에 추가하고 싶습니다.
다음 명령어를 실행해주세요:
npx shadcn-ui@latest add dialog

그리고 사용 예시도 보여주세요.
```

### 다른 컴포넌트 추가

```
shadcn/ui의 [컴포넌트명] 컴포넌트를 추가하고 싶습니다.
npx shadcn-ui@latest add [component-name]
```

---

## 16. 로그 뷰어 기능

### 로그 복사 기능 추가

```
LogViewer 컴포넌트에 모든 로그를 한 번에 복사하는 기능을 추가하고 싶습니다.
navigator.clipboard.writeText()를 사용하여 구현해주세요.
로그 배열을 줄바꿈으로 연결하여 복사하면 됩니다.
```

---

## 17. 파일명 커스터마이징

### 상황: 각 결과 파일의 이름을 사용자가 지정하고 싶음

```
분할/변환된 각 파일에 대해 사용자가 파일명을 입력할 수 있게 하고 싶습니다.
Input 컴포넌트를 사용하여 각 파일별로 이름을 입력받고,
다운로드 시 해당 이름을 사용하도록 구현해주세요.
상태는 { [fileId]: customName } 형식의 객체로 관리해주세요.
```

---

## 18. 다중 범위 입력

### PDF 분할 범위 설정

```
PDF 분할 시 여러 개의 페이지 범위를 설정할 수 있게 하고 싶습니다.
각 범위는 { start, end, name } 형식이고,
"범위 추가" 버튼으로 동적으로 범위를 추가할 수 있어야 합니다.
각 범위별로 시작/끝 페이지와 파일명을 입력받는 UI를 만들어주세요.
```

---

## 19. 에러 핸들링

### Try-Catch 패턴

```
API 호출 시 일관된 에러 핸들링을 적용하고 싶습니다.
다음 패턴으로 코드를 작성해주세요:
1. try-catch 블록 사용
2. 에러 발생 시 toast로 사용자에게 알림
3. 로그에 에러 메시지 추가
4. finally에서 로딩 상태 해제
```

---

## 20. 일괄 업데이트

### 모든 탭에 공통 기능 추가

```
다른 탭에도 비디오 분할 탭처럼 다음 기능들을 공통으로 적용시켜주세요:
1. 업로드 진행률 표시
2. 파일명 커스터마이징
3. 선택/전체 다운로드
4. 다운로드 폴더 열기

MediaConvertTab, MediaMergeTab, DocumentConvertTab에 적용해주세요.
```

---

## 21. 프로젝트 문서 업데이트

### PROJECT.md 업데이트

```
.claude/PROJECT.md 파일을 최신 상태로 업데이트해주세요.
다음 내용을 포함해야 합니다:
1. 새로 추가된 기능
2. 주요 기술 결정 사항
3. 해결한 이슈들
4. API 엔드포인트 변경사항
```

---

## 22. 순차 처리 패턴 구현

### 파일별 순차 처리

```
미디어 변환 기능을 순차 처리 방식으로 변경하고 싶습니다.
여러 파일을 선택했을 때:
1. 첫 번째 파일 업로드
2. 첫 번째 파일 변환
3. 두 번째 파일 업로드
4. 두 번째 파일 변환
...
이런 식으로 순차적으로 처리되도록 for 루프를 사용해서 구현해주세요.
각 파일의 진행 상황을 로그로 표시하고,
전체 진행률도 보여주세요 (예: [2/5] 파일명 처리 중...).
```

---

## 23. formidable 스트리밍 업로드 구현

### Next.js Request를 Node.js Stream으로 변환

```
Next.js 15의 Request 객체를 Node.js Readable Stream으로 변환하여
formidable에서 사용할 수 있도록 만들고 싶습니다.

다음 단계로 구현해주세요:
1. request.body.getReader()로 ReadableStream 가져오기
2. Readable stream 생성
3. reader.read()로 청크 읽기
4. 헤더 정보도 포함하기

toNodeRequest 헬퍼 함수를 만들어주세요.
```

---

## 24. 타입스크립트 타입 정의

### 공통 타입 정의

```
types/index.ts 파일에 다음 타입들을 정의해주세요:
1. FileInfo: 업로드된 파일 정보
2. ConversionProgress: 변환 진행 상태
3. SplitRange: PDF 분할 범위
4. MediaFormat: 미디어 포맷 타입

각 타입에 필요한 필드들을 모두 포함해주세요.
```

---

## 25. 환경 설정

### next.config.js 설정

```
Next.js 설정 파일에 다음 설정을 추가하고 싶습니다:
1. 50GB 파일 업로드 허용 (bodySizeLimit)
2. 외부 이미지 도메인 허용 (images.domains)
3. 실험적 기능 활성화 (serverActions)

next.config.js 파일을 전체적으로 작성해주세요.
```

---

## 26. Next.js 개발 서버 manifest 파일 누락 문제 ⭐ NEW

### 상황: 개발 서버 시작 시 ENOENT 에러 발생

```
9005 포트가 열리지 않고, 다음과 같은 에러가 발생합니다:
ENOENT: no such file or directory, open '.next/server/middleware-manifest.json'
ENOENT: no such file or directory, open '.next/server/pages-manifest.json'
HTTP 500 또는 404 에러가 발생합니다.

프로그램을 점검해주세요.
```

### 해결 프롬프트

```
다음 단계로 문제를 해결해주세요:
1. 포트 9005에서 실행 중인 프로세스 종료
2. .next 디렉토리 삭제
3. .next/server 디렉토리와 필수 manifest 파일들 생성
   - middleware-manifest.json
   - pages-manifest.json
   - app-paths-manifest.json
   - next-font-manifest.json
4. 개발 서버 재시작
5. 서버가 정상 작동하는지 확인
```

---

## 27. TypeScript 타입 에러 수정 ⭐ NEW

### 상황: 빌드 시 타입 에러 발생

```
npm run build 실행 시 다음과 같은 타입 에러가 발생합니다:
- app/page.tsx:53 - Cannot find name 'newSessionId'
- app/page.tsx:142 - 'path' does not exist in type 'FileInfo'
- lib/ffmpeg.ts:86 - Parameter implicitly has an 'any' type

이러한 타입 에러들을 수정해주세요.
```

### 해결 프롬프트

```
다음 타입 에러들을 수정해주세요:
1. app/page.tsx의 sessionId 변수 참조 오류 수정
2. FileInfo 인터페이스에 file 속성 추가 또는 세션 복구 시 더미 File 객체 생성
3. lib/ffmpeg.ts의 이벤트 핸들러 파라미터에 타입 추가

각 파일을 수정한 후 npm run build로 확인해주세요.
```

---

## 28. 개발 서버 재시작 및 문제 해결 ⭐ NEW

### 포트 문제 해결 자동화 스크립트

```
포트 9005가 열리지 않는 문제를 자동으로 해결하는 스크립트를 만들어주세요.
다음 작업을 순서대로 수행해야 합니다:
1. 기존 프로세스 종료 (lsof -ti:9005 | xargs kill -9)
2. .next 디렉토리 삭제
3. .next/server 디렉토리 및 manifest 파일들 생성
4. npm run dev 실행
5. 서버가 정상 작동하는지 확인

실행.command 스크립트나 package.json 스크립트로 만들어주세요.
```

---

## 29. 포트 충돌 문제 해결 ⭐ NEW

### 상황: EADDRINUSE 에러 발생

```
실행 시 다음 에러가 발생합니다:
Error: listen EADDRINUSE: address already in use :::9005

포트 9005를 사용 중인 프로세스를 찾아서 종료하고
서버를 재시작해주세요.
```

### 해결 프롬프트

```
다음 순서로 문제를 해결해주세요:
1. lsof 명령어로 포트 9005를 사용하는 프로세스 찾기
2. kill 명령어로 해당 프로세스 종료
3. npm run dev로 서버 재시작
4. curl이나 브라우저로 서버 정상 작동 확인

모든 과정을 자동으로 수행해주세요.
```

### 빠른 해결 명령어

```
포트 9005 충돌 문제를 한 번에 해결하는 명령어를 실행해주세요:
lsof -i :9005 | grep LISTEN | awk '{print $2}' | xargs kill -9 && npm run dev
```

---

## 16. Electron 앱 흰 화면 문제 해결

### 상황: 빌드한 Electron 앱이 흰 화면만 표시됨

```
npm run electron:build:mac:app로 앱을 빌드하고 실행했는데 흰 화면만 표시됩니다.
터미널에서 앱을 실행하면 다음 에러가 나옵니다:
- "Could not find a production build in the '.next' directory"
- "Cannot find module 'react'"
- "Cannot find module 'react-dom'"

electron-builder.yml 설정을 수정하여 .next 디렉토리와 필요한 모듈들이
앱에 포함되도록 해주세요.
```

### 후속 조치 프롬프트

```
electron-builder.yml의 files와 asarUnpack 섹션을 수정했는데,
빌드 후 다음을 확인하고 싶습니다:
1. .next 디렉토리가 포함되었는지
2. react, react-dom이 app.asar.unpacked에 있는지

확인 명령어와 테스트 방법을 알려주세요.
```

---

## 17. 앱 빌드 자동화

### 상황: UI 버튼으로 Electron 앱 빌드하고 싶음

```
웹 UI에서 "앱 빌드 및 설치" 버튼을 클릭하면
다음 작업이 자동으로 수행되도록 하고 싶습니다:
1. 실행 중인 EasyConversion과 node 프로세스 종료
2. npm run electron:build:mac:app 실행
3. dist/mac-arm64/EasyConversion.app을 /Applications/로 복사

app/api/build-app/route.ts API를 만들고
app/page.tsx에서 호출하도록 구현해주세요.
```

---

## 18. 임시 파일 정리 시스템

### 상황: tmp/uploads 폴더가 68GB로 커짐

```
tmp/uploads/ 폴더가 계속 커지고 있습니다.
다음 두 가지 정리 방법을 구현하고 싶습니다:

1. 24시간 이상 지난 세션 자동 정리 (안전)
2. tmp/uploads 전체 삭제 (위험, 이중 확인 필요)

app/api/cleanup/auto/route.ts와
app/api/cleanup/uploads/route.ts를 만들고
UI 버튼도 추가해주세요.
```

---

## 사용 팁

1. **프롬프트 커스터마이징**: 위 프롬프트를 프로젝트에 맞게 수정하여 사용하세요.
2. **컨텍스트 제공**: 에러 메시지나 현재 코드를 함께 제공하면 더 정확한 답변을 받을 수 있습니다.
3. **단계별 요청**: 복잡한 기능은 여러 단계로 나누어 요청하세요.
4. **코드 참조**: "X 파일의 Y 함수처럼 구현해주세요"와 같이 기존 코드를 참조하면 일관성이 유지됩니다.

## 작성일

2025-12-06 (최초 작성)
2025-12-09 (최종 업데이트)
