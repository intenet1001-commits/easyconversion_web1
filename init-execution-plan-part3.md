# EasyConversion Web - Execution Plan (Part 3)

> Phase 6-7 상세 실행 계획

## Phase 6: 문서 병합/분할

**목표**: 문서 병합 및 분할 기능 구현 (PDF, DOCX, PPTX, MD, HTML)
**기간**: 4일
**독립 테스트 가능**: ✅ 각 문서 형식별 병합/분할 테스트

### 6.1 문서 병합 구현

#### `lib/document-merge.ts` 생성
```typescript
import { PDFDocument } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import pptxgen from 'pptxgenjs';
import fs from 'fs/promises';
import path from 'path';

export interface MergeOptions {
  inputPaths: string[];
  outputPath: string;
  format: 'pdf' | 'docx' | 'pptx' | 'md' | 'html';
  options?: {
    addSeparator?: boolean;
    generateTOC?: boolean;
    renumberPages?: boolean;
  };
}

// PDF 병합
export async function mergePDFs(
  inputPaths: string[],
  outputPath: string,
  options: { addSeparator?: boolean } = {}
): Promise<void> {
  const mergedPdf = await PDFDocument.create();

  for (const inputPath of inputPaths) {
    const pdfBytes = await fs.readFile(inputPath);
    const pdf = await PDFDocument.load(pdfBytes);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));

    // 구분선 추가 (빈 페이지)
    if (options.addSeparator && inputPath !== inputPaths[inputPaths.length - 1]) {
      mergedPdf.addPage();
    }
  }

  const mergedPdfBytes = await mergedPdf.save();
  await fs.writeFile(outputPath, mergedPdfBytes);
}

// DOCX 병합
export async function mergeDOCX(
  inputPaths: string[],
  outputPath: string,
  options: { addSeparator?: boolean; generateTOC?: boolean } = {}
): Promise<void> {
  const mammoth = require('mammoth');
  const HTMLtoDOCX = require('html-to-docx');

  let combinedHtml = '';

  for (let i = 0; i < inputPaths.length; i++) {
    const inputPath = inputPaths[i];
    const result = await mammoth.convertToHtml({ path: inputPath });

    // 목차용 파일명 추가
    if (options.generateTOC) {
      const fileName = path.basename(inputPath, '.docx');
      combinedHtml += `<h1>${fileName}</h1>\n`;
    }

    combinedHtml += result.value;

    // 구분선 추가
    if (options.addSeparator && i < inputPaths.length - 1) {
      combinedHtml += '<hr />\n<div style="page-break-after: always;"></div>\n';
    }
  }

  const docxBuffer = await HTMLtoDOCX(combinedHtml);
  await fs.writeFile(outputPath, docxBuffer);
}

// PPTX 병합
export async function mergePPTX(
  inputPaths: string[],
  outputPath: string
): Promise<void> {
  // pptxgenjs로 병합 (복잡한 구현)
  const pptx = new pptxgen();

  // 각 PPTX의 슬라이드를 추출하여 추가
  // 현재 pptxgenjs는 기존 PPTX 로드를 지원하지 않으므로
  // 대안: officegen 또는 python-pptx 사용 권장

  throw new Error('PPTX 병합은 현재 지원하지 않습니다');
}

// Markdown 병합
export async function mergeMarkdown(
  inputPaths: string[],
  outputPath: string,
  options: { addSeparator?: boolean; generateTOC?: boolean } = {}
): Promise<void> {
  let combinedMarkdown = '';

  // 목차 생성
  if (options.generateTOC) {
    combinedMarkdown += '# 목차\n\n';
    for (const inputPath of inputPaths) {
      const fileName = path.basename(inputPath, '.md');
      combinedMarkdown += `- [${fileName}](#${fileName.toLowerCase().replace(/\s/g, '-')})\n`;
    }
    combinedMarkdown += '\n---\n\n';
  }

  for (let i = 0; i < inputPaths.length; i++) {
    const inputPath = inputPaths[i];
    const content = await fs.readFile(inputPath, 'utf-8');

    // 파일명 헤더 추가
    if (options.generateTOC) {
      const fileName = path.basename(inputPath, '.md');
      combinedMarkdown += `# ${fileName}\n\n`;
    }

    combinedMarkdown += content;

    // 구분선 추가
    if (options.addSeparator && i < inputPaths.length - 1) {
      combinedMarkdown += '\n\n---\n\n';
    }
  }

  await fs.writeFile(outputPath, combinedMarkdown);
}

// HTML 병합
export async function mergeHTML(
  inputPaths: string[],
  outputPath: string,
  options: { addSeparator?: boolean; generateTOC?: boolean } = {}
): Promise<void> {
  const cheerio = require('cheerio');

  let tocHtml = '';
  let bodyHtml = '';

  for (let i = 0; i < inputPaths.length; i++) {
    const inputPath = inputPaths[i];
    const content = await fs.readFile(inputPath, 'utf-8');
    const $ = cheerio.load(content);
    const fileName = path.basename(inputPath, '.html');

    // 목차 항목 추가
    if (options.generateTOC) {
      tocHtml += `<li><a href="#section-${i}">${fileName}</a></li>\n`;
    }

    // 섹션으로 래핑
    bodyHtml += `<section id="section-${i}">\n`;
    bodyHtml += `<h1>${fileName}</h1>\n`;
    bodyHtml += $('body').html() || content;
    bodyHtml += `</section>\n`;

    // 구분선 추가
    if (options.addSeparator && i < inputPaths.length - 1) {
      bodyHtml += '<hr />\n';
    }
  }

  const finalHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Merged Document</title>
</head>
<body>
${options.generateTOC ? `<nav><h2>목차</h2><ul>${tocHtml}</ul></nav><hr />` : ''}
${bodyHtml}
</body>
</html>`;

  await fs.writeFile(outputPath, finalHtml);
}

// 병합 라우터
export async function mergeDocuments({
  inputPaths,
  outputPath,
  format,
  options,
}: MergeOptions): Promise<void> {
  switch (format) {
    case 'pdf':
      await mergePDFs(inputPaths, outputPath, options);
      break;
    case 'docx':
      await mergeDOCX(inputPaths, outputPath, options);
      break;
    case 'pptx':
      await mergePPTX(inputPaths, outputPath);
      break;
    case 'md':
      await mergeMarkdown(inputPaths, outputPath, options);
      break;
    case 'html':
      await mergeHTML(inputPaths, outputPath, options);
      break;
    default:
      throw new Error(`지원되지 않는 형식: ${format}`);
  }
}
```

### 6.2 문서 분할 구현

#### `lib/document-split.ts` 생성
```typescript
import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

export interface SplitOptions {
  inputPath: string;
  outputDir: string;
  prefix: string;
  format: 'pdf' | 'docx' | 'pptx' | 'md' | 'html';
}

export interface PDFSplitOptions extends SplitOptions {
  mode: 'ranges' | 'equal' | 'pageCount';
  ranges?: string[]; // ["1-10", "11-20"]
  parts?: number; // 균등 분할 개수
  pageCount?: number; // 페이지 수 기준
}

export interface MarkdownSplitOptions extends SplitOptions {
  mode: 'heading' | 'separator';
  headingLevel?: 1 | 2; // H1 or H2
}

export interface HTMLSplitOptions extends SplitOptions {
  mode: 'section' | 'heading';
  headingLevel?: 1 | 2;
}

// PDF 범위 분할
export async function splitPDFByRanges(
  inputPath: string,
  outputDir: string,
  prefix: string,
  ranges: string[]
): Promise<string[]> {
  const pdfBytes = await fs.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const outputPaths: string[] = [];

  for (let i = 0; i < ranges.length; i++) {
    const [start, end] = ranges[i].split('-').map(Number);
    const newPdf = await PDFDocument.create();

    for (let pageNum = start - 1; pageNum < end; pageNum++) {
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageNum]);
      newPdf.addPage(copiedPage);
    }

    const outputPath = path.join(outputDir, `${prefix}${i + 1}.pdf`);
    const newPdfBytes = await newPdf.save();
    await fs.writeFile(outputPath, newPdfBytes);
    outputPaths.push(outputPath);
  }

  return outputPaths;
}

// PDF 균등 분할
export async function splitPDFEqually(
  inputPath: string,
  outputDir: string,
  prefix: string,
  parts: number
): Promise<string[]> {
  const pdfBytes = await fs.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();
  const pagesPerPart = Math.ceil(totalPages / parts);
  const outputPaths: string[] = [];

  for (let i = 0; i < parts; i++) {
    const startPage = i * pagesPerPart;
    const endPage = Math.min((i + 1) * pagesPerPart, totalPages);

    const newPdf = await PDFDocument.create();
    for (let pageNum = startPage; pageNum < endPage; pageNum++) {
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageNum]);
      newPdf.addPage(copiedPage);
    }

    const outputPath = path.join(outputDir, `${prefix}${i + 1}.pdf`);
    const newPdfBytes = await newPdf.save();
    await fs.writeFile(outputPath, newPdfBytes);
    outputPaths.push(outputPath);
  }

  return outputPaths;
}

// PDF 페이지 수 기준 분할
export async function splitPDFByPageCount(
  inputPath: string,
  outputDir: string,
  prefix: string,
  pageCount: number
): Promise<string[]> {
  const pdfBytes = await fs.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();
  const numParts = Math.ceil(totalPages / pageCount);
  const outputPaths: string[] = [];

  for (let i = 0; i < numParts; i++) {
    const startPage = i * pageCount;
    const endPage = Math.min((i + 1) * pageCount, totalPages);

    const newPdf = await PDFDocument.create();
    for (let pageNum = startPage; pageNum < endPage; pageNum++) {
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageNum]);
      newPdf.addPage(copiedPage);
    }

    const outputPath = path.join(outputDir, `${prefix}${i + 1}.pdf`);
    const newPdfBytes = await newPdf.save();
    await fs.writeFile(outputPath, newPdfBytes);
    outputPaths.push(outputPath);
  }

  return outputPaths;
}

// Markdown 헤딩 기준 분할
export async function splitMarkdownByHeading(
  inputPath: string,
  outputDir: string,
  prefix: string,
  headingLevel: 1 | 2
): Promise<string[]> {
  const content = await fs.readFile(inputPath, 'utf-8');
  const headingRegex = headingLevel === 1 ? /^# (.+)$/gm : /^## (.+)$/gm;
  const lines = content.split('\n');
  const outputPaths: string[] = [];

  let currentContent: string[] = [];
  let partIndex = 0;

  for (const line of lines) {
    if (headingRegex.test(line)) {
      // 이전 섹션 저장
      if (currentContent.length > 0) {
        const outputPath = path.join(outputDir, `${prefix}${partIndex + 1}.md`);
        await fs.writeFile(outputPath, currentContent.join('\n'));
        outputPaths.push(outputPath);
        partIndex++;
        currentContent = [];
      }
    }
    currentContent.push(line);
  }

  // 마지막 섹션 저장
  if (currentContent.length > 0) {
    const outputPath = path.join(outputDir, `${prefix}${partIndex + 1}.md`);
    await fs.writeFile(outputPath, currentContent.join('\n'));
    outputPaths.push(outputPath);
  }

  return outputPaths;
}

// Markdown 구분선 기준 분할
export async function splitMarkdownBySeparator(
  inputPath: string,
  outputDir: string,
  prefix: string
): Promise<string[]> {
  const content = await fs.readFile(inputPath, 'utf-8');
  const sections = content.split(/\n---\n/);
  const outputPaths: string[] = [];

  for (let i = 0; i < sections.length; i++) {
    const outputPath = path.join(outputDir, `${prefix}${i + 1}.md`);
    await fs.writeFile(outputPath, sections[i].trim());
    outputPaths.push(outputPath);
  }

  return outputPaths;
}

// HTML 섹션 기준 분할
export async function splitHTMLBySection(
  inputPath: string,
  outputDir: string,
  prefix: string
): Promise<string[]> {
  const cheerio = require('cheerio');
  const content = await fs.readFile(inputPath, 'utf-8');
  const $ = cheerio.load(content);
  const sections = $('section, article');
  const outputPaths: string[] = [];

  sections.each((i: number, elem: any) => {
    const sectionHtml = $.html(elem);
    const outputPath = path.join(outputDir, `${prefix}${i + 1}.html`);

    const fullHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Part ${i + 1}</title></head>
<body>
${sectionHtml}
</body>
</html>`;

    fs.writeFile(outputPath, fullHtml);
    outputPaths.push(outputPath);
  });

  return outputPaths;
}

// HTML 헤딩 기준 분할
export async function splitHTMLByHeading(
  inputPath: string,
  outputDir: string,
  prefix: string,
  headingLevel: 1 | 2
): Promise<string[]> {
  const cheerio = require('cheerio');
  const content = await fs.readFile(inputPath, 'utf-8');
  const $ = cheerio.load(content);
  const headingTag = headingLevel === 1 ? 'h1' : 'h2';
  const outputPaths: string[] = [];

  let currentSection: any[] = [];
  let partIndex = 0;

  $('body')
    .children()
    .each((i: number, elem: any) => {
      if ($(elem).is(headingTag)) {
        // 이전 섹션 저장
        if (currentSection.length > 0) {
          const sectionHtml = currentSection.map((e) => $.html(e)).join('\n');
          const outputPath = path.join(outputDir, `${prefix}${partIndex + 1}.html`);

          const fullHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Part ${partIndex + 1}</title></head>
<body>
${sectionHtml}
</body>
</html>`;

          fs.writeFile(outputPath, fullHtml);
          outputPaths.push(outputPath);
          partIndex++;
          currentSection = [];
        }
      }
      currentSection.push(elem);
    });

  // 마지막 섹션 저장
  if (currentSection.length > 0) {
    const sectionHtml = currentSection.map((e) => $.html(e)).join('\n');
    const outputPath = path.join(outputDir, `${prefix}${partIndex + 1}.html`);

    const fullHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Part ${partIndex + 1}</title></head>
<body>
${sectionHtml}
</body>
</html>`;

    fs.writeFile(outputPath, fullHtml);
    outputPaths.push(outputPath);
  }

  return outputPaths;
}
```

### 6.3 문서 병합/분할 API

#### `app/api/document/merge/route.ts` 생성
```typescript
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { mergeDocuments } from '@/lib/document-merge';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const inputFormat = formData.get('inputFormat') as string;
    const sessionId = formData.get('sessionId') as string;
    const addSeparator = formData.get('addSeparator') === 'true';
    const generateTOC = formData.get('generateTOC') === 'true';
    const renumberPages = formData.get('renumberPages') === 'true';

    // 파일 저장
    const uploadDir = path.join(process.cwd(), 'tmp', 'uploads', sessionId);
    await mkdir(uploadDir, { recursive: true });

    const inputPaths: string[] = [];
    for (const file of files) {
      const fileId = uuidv4();
      const fileName = `${fileId}_${file.name}`;
      const filePath = path.join(uploadDir, fileName);
      const bytes = await file.arrayBuffer();
      await writeFile(filePath, Buffer.from(bytes));
      inputPaths.push(filePath);
    }

    // 출력 설정
    const outputDir = path.join(process.cwd(), 'public', 'downloads', sessionId);
    await mkdir(outputDir, { recursive: true });

    const outputFileName = `merged_${Date.now()}.${inputFormat}`;
    const outputPath = path.join(outputDir, outputFileName);

    // 병합 실행
    await mergeDocuments({
      inputPaths,
      outputPath,
      format: inputFormat as any,
      options: { addSeparator, generateTOC, renumberPages },
    });

    return NextResponse.json({
      success: true,
      outputUrl: `/downloads/${sessionId}/${outputFileName}`,
      filename: outputFileName,
    });
  } catch (error: any) {
    console.error('Merge error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

#### `app/api/document/split/route.ts` 생성
```typescript
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import {
  splitPDFByRanges,
  splitPDFEqually,
  splitPDFByPageCount,
  splitMarkdownByHeading,
  splitMarkdownBySeparator,
  splitHTMLBySection,
  splitHTMLByHeading,
} from '@/lib/document-split';
import { v4 as uuidv4 } from 'uuid';
import { getFileExtension } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const mode = formData.get('mode') as string;
    const sessionId = formData.get('sessionId') as string;
    const prefix = (formData.get('prefix') as string) || 'part';

    // 파일 저장
    const uploadDir = path.join(process.cwd(), 'tmp', 'uploads', sessionId);
    await mkdir(uploadDir, { recursive: true });

    const fileId = uuidv4();
    const fileName = `${fileId}_${file.name}`;
    const inputPath = path.join(uploadDir, fileName);
    const bytes = await file.arrayBuffer();
    await writeFile(inputPath, Buffer.from(bytes));

    // 출력 디렉토리
    const outputDir = path.join(process.cwd(), 'public', 'downloads', sessionId);
    await mkdir(outputDir, { recursive: true });

    const format = getFileExtension(file.name);
    let outputPaths: string[] = [];

    // PDF 분할
    if (format === 'pdf') {
      if (mode === 'ranges') {
        const ranges = JSON.parse(formData.get('ranges') as string);
        outputPaths = await splitPDFByRanges(inputPath, outputDir, prefix, ranges);
      } else if (mode === 'equal') {
        const parts = parseInt(formData.get('parts') as string);
        outputPaths = await splitPDFEqually(inputPath, outputDir, prefix, parts);
      } else if (mode === 'pageCount') {
        const pageCount = parseInt(formData.get('pageCount') as string);
        outputPaths = await splitPDFByPageCount(inputPath, outputDir, prefix, pageCount);
      }
    }
    // Markdown 분할
    else if (format === 'md') {
      if (mode === 'heading') {
        const headingLevel = parseInt(formData.get('headingLevel') as string) as 1 | 2;
        outputPaths = await splitMarkdownByHeading(inputPath, outputDir, prefix, headingLevel);
      } else if (mode === 'separator') {
        outputPaths = await splitMarkdownBySeparator(inputPath, outputDir, prefix);
      }
    }
    // HTML 분할
    else if (format === 'html') {
      if (mode === 'section') {
        outputPaths = await splitHTMLBySection(inputPath, outputDir, prefix);
      } else if (mode === 'heading') {
        const headingLevel = parseInt(formData.get('headingLevel') as string) as 1 | 2;
        outputPaths = await splitHTMLByHeading(inputPath, outputDir, prefix, headingLevel);
      }
    }

    // 다운로드 URL 생성
    const files = outputPaths.map((p) => {
      const fileName = path.basename(p);
      return {
        filename: fileName,
        url: `/downloads/${sessionId}/${fileName}`,
      };
    });

    return NextResponse.json({
      success: true,
      files,
    });
  } catch (error: any) {
    console.error('Split error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

### 6.4 문서 병합/분할 탭 UI 구현

#### `components/tabs/DocumentMergeTab.tsx` 구현
```typescript
'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FileUploader } from '@/components/common/FileUploader';
import { LogViewer } from '@/components/common/LogViewer';
import { useConversionStore } from '@/store/useConversionStore';
import { useToast } from '@/hooks/use-toast';
import { formatFileSize } from '@/lib/utils';
import { X, Download, ChevronUp, ChevronDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface FileItem {
  id: string;
  file: File;
}

export function DocumentMergeTab() {
  const { toast } = useToast();
  const { sessionId, addLog } = useConversionStore();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [inputFormat, setInputFormat] = useState('pdf');
  const [addSeparator, setAddSeparator] = useState(false);
  const [generateTOC, setGenerateTOC] = useState(false);
  const [renumberPages, setRenumberPages] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [outputUrl, setOutputUrl] = useState('');

  const handleFilesAccepted = (acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((f) => ({ id: uuidv4(), file: f }));
    setFiles([...files, ...newFiles]);
    addLog(`${acceptedFiles.length}개 파일 추가됨`);
  };

  const removeFile = (id: string) => {
    setFiles(files.filter((f) => f.id !== id));
  };

  const moveUp = (index: number) => {
    if (index > 0) {
      const newFiles = [...files];
      [newFiles[index - 1], newFiles[index]] = [newFiles[index], newFiles[index - 1]];
      setFiles(newFiles);
    }
  };

  const moveDown = (index: number) => {
    if (index < files.length - 1) {
      const newFiles = [...files];
      [newFiles[index], newFiles[index + 1]] = [newFiles[index + 1], newFiles[index]];
      setFiles(newFiles);
    }
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      toast({ title: '최소 2개 이상의 파일이 필요합니다', variant: 'destructive' });
      return;
    }

    setIsMerging(true);
    setOutputUrl('');
    addLog(`문서 병합 시작: ${files.length}개 ${inputFormat.toUpperCase()} 파일`);

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f.file));
      formData.append('inputFormat', inputFormat);
      formData.append('sessionId', sessionId);
      formData.append('addSeparator', addSeparator.toString());
      formData.append('generateTOC', generateTOC.toString());
      formData.append('renumberPages', renumberPages.toString());

      const response = await fetch('/api/document/merge', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      setOutputUrl(data.outputUrl);
      addLog(`병합 완료: ${data.filename}`);
      toast({ title: '병합 완료' });
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
        <h2 className="text-xl font-semibold mb-4">문서 병합</h2>

        <div className="space-y-4">
          <div>
            <Label>문서 형식 선택</Label>
            <Select value={inputFormat} onValueChange={setInputFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="docx">DOCX (Word)</SelectItem>
                <SelectItem value="pptx">PPTX (PowerPoint)</SelectItem>
                <SelectItem value="md">Markdown</SelectItem>
                <SelectItem value="html">HTML</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <FileUploader
            onFilesAccepted={handleFilesAccepted}
            acceptedFormats={[inputFormat]}
            multiple
          />

          {files.length > 0 && (
            <div className="space-y-2">
              <Label>병합할 문서 ({files.length}개)</Label>
              {files.map((item, index) => (
                <div key={item.id} className="flex items-center gap-2 p-3 border rounded">
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveDown(index)}
                      disabled={index === files.length - 1}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      {index + 1}. {item.file.name}
                    </p>
                    <p className="text-sm text-muted-foreground">{formatFileSize(item.file.size)}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeFile(item.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label>옵션</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="separator"
                checked={addSeparator}
                onCheckedChange={(checked) => setAddSeparator(checked as boolean)}
              />
              <Label htmlFor="separator" className="text-sm">
                구분선 추가
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="toc"
                checked={generateTOC}
                onCheckedChange={(checked) => setGenerateTOC(checked as boolean)}
              />
              <Label htmlFor="toc" className="text-sm">
                목차 자동 생성
              </Label>
            </div>
            {inputFormat === 'pdf' && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="renumber"
                  checked={renumberPages}
                  onCheckedChange={(checked) => setRenumberPages(checked as boolean)}
                />
                <Label htmlFor="renumber" className="text-sm">
                  페이지 번호 재정렬
                </Label>
              </div>
            )}
          </div>

          <Button onClick={handleMerge} disabled={isMerging || files.length < 2} className="w-full">
            {isMerging ? '병합 중...' : '병합 시작'}
          </Button>
        </div>
      </Card>

      {outputUrl && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">다운로드</h3>
          <a href={outputUrl} download className="inline-flex items-center text-primary">
            <Download className="h-4 w-4 mr-2" />
            병합된 문서 다운로드
          </a>
        </Card>
      )}

      <LogViewer />
    </div>
  );
}
```

#### `components/tabs/DocumentSplitTab.tsx` - PDF 분할 예시 (간략화)
```typescript
'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { FileUploader } from '@/components/common/FileUploader';
import { LogViewer } from '@/components/common/LogViewer';
import { useConversionStore } from '@/store/useConversionStore';
import { useToast } from '@/hooks/use-toast';
import { Download } from 'lucide-react';

export function DocumentSplitTab() {
  const { toast } = useToast();
  const { sessionId, addLog } = useConversionStore();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'ranges' | 'equal' | 'pageCount'>('ranges');
  const [ranges, setRanges] = useState<string[]>(['1-10']);
  const [parts, setParts] = useState(3);
  const [pageCount, setPageCount] = useState(5);
  const [prefix, setPrefix] = useState('part');
  const [isSplitting, setIsSplitting] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleFileAccepted = (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      addLog(`파일 선택: ${files[0].name}`);
    }
  };

  const handleSplit = async () => {
    if (!file) {
      toast({ title: '파일을 선택해주세요', variant: 'destructive' });
      return;
    }

    setIsSplitting(true);
    setResults([]);
    addLog(`문서 분할 시작: ${mode} 모드`);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', mode);
      formData.append('sessionId', sessionId);
      formData.append('prefix', prefix);

      if (mode === 'ranges') {
        formData.append('ranges', JSON.stringify(ranges));
      } else if (mode === 'equal') {
        formData.append('parts', parts.toString());
      } else if (mode === 'pageCount') {
        formData.append('pageCount', pageCount.toString());
      }

      const response = await fetch('/api/document/split', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      setResults(data.files);
      addLog(`분할 완료: ${data.files.length}개 파일`);
      toast({ title: '분할 완료' });
    } catch (error: any) {
      toast({ title: '분할 실패', description: error.message, variant: 'destructive' });
      addLog(`오류: ${error.message}`);
    } finally {
      setIsSplitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">문서 분할</h2>

        <div className="space-y-4">
          <FileUploader onFilesAccepted={handleFileAccepted} acceptedFormats={['pdf', 'md', 'html']} multiple={false} />

          {file && (
            <div className="p-3 border rounded bg-muted/50">
              <p className="font-medium">{file.name}</p>
            </div>
          )}

          <div>
            <Label>분할 모드</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="mt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ranges" id="mode-ranges" />
                <Label htmlFor="mode-ranges">페이지 범위 지정</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="equal" id="mode-equal" />
                <Label htmlFor="mode-equal">균등 분할</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pageCount" id="mode-pageCount" />
                <Label htmlFor="mode-pageCount">페이지 수 기준</Label>
              </div>
            </RadioGroup>
          </div>

          {mode === 'ranges' && (
            <div>
              <Label>페이지 범위 (예: 1-10, 11-20)</Label>
              <Input
                value={ranges.join(', ')}
                onChange={(e) => setRanges(e.target.value.split(',').map((r) => r.trim()))}
                placeholder="1-10, 11-20"
              />
            </div>
          )}

          {mode === 'equal' && (
            <div>
              <Label>분할 개수</Label>
              <Input type="number" min={2} value={parts} onChange={(e) => setParts(parseInt(e.target.value))} />
            </div>
          )}

          {mode === 'pageCount' && (
            <div>
              <Label>페이지 수</Label>
              <Input type="number" min={1} value={pageCount} onChange={(e) => setPageCount(parseInt(e.target.value))} />
            </div>
          )}

          <div>
            <Label>출력 파일명 접두사</Label>
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} />
          </div>

          <Button onClick={handleSplit} disabled={isSplitting || !file} className="w-full">
            {isSplitting ? '분할 중...' : '분할 시작'}
          </Button>
        </div>
      </Card>

      {results.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">다운로드</h3>
          <div className="space-y-2">
            {results.map((result, index) => (
              <a key={index} href={result.url} download className="flex items-center text-primary">
                <Download className="h-4 w-4 mr-2" />
                {result.filename}
              </a>
            ))}
          </div>
        </Card>
      )}

      <LogViewer />
    </div>
  );
}
```

### 6.5 Phase 6 테스트

#### 병합 테스트
- [ ] PDF 병합 (3개 파일)
- [ ] DOCX 병합 + 목차 생성
- [ ] Markdown 병합 + 구분선
- [ ] HTML 병합

#### 분할 테스트
- [ ] PDF 범위 분할
- [ ] PDF 균등 분할
- [ ] Markdown H1 기준 분할
- [ ] HTML 섹션 기준 분할

---

## Phase 7: 테스트 & 최적화

**목표**: 통합 테스트, 성능 최적화, 버그 수정
**기간**: 3일
**독립 테스트 가능**: ✅ 전체 시스템 검증

### 7.1 통합 테스트 계획

#### 테스트 파일 준비
```bash
# 테스트 파일 디렉토리 생성
mkdir -p test-files/{media,documents}

# 미디어 파일 (샘플)
# - video.mp4 (100MB)
# - audio.mp3 (10MB)
# - clip1.mp4, clip2.mp4, clip3.mp4

# 문서 파일 (샘플)
# - sample.pdf (10 pages)
# - sample.docx
# - sample.md
# - sample.html
```

#### 테스트 시나리오

**1. 전체 플로우 테스트**
```
사용자 스토리: 유튜브 다운로드 → 미디어 변환 → 분할 → 병합
1. YouTube 비디오 다운로드 (MP4)
2. MP4 → MP3 변환
3. MP3 파일 3개 구간으로 분할
4. 분할된 3개 파일 병합
5. 최종 파일 재생 확인
```

**2. 문서 변환 체인**
```
사용자 스토리: MD → DOCX → PDF → 분할 → 병합
1. Markdown 파일 → DOCX 변환
2. DOCX → PDF 변환
3. PDF 3개 파일로 분할
4. 분할된 PDF 병합 (목차 생성)
5. 최종 PDF 확인
```

**3. 성능 테스트**
```
- 대용량 파일 (500MB) 업로드
- 10개 파일 동시 변환
- 진행률 업데이트 지연 측정
- 메모리 사용량 모니터링
```

### 7.2 성능 최적화

#### 파일 업로드 최적화
```typescript
// lib/upload-optimizer.ts
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

// 스트림 기반 업로드
export async function streamUpload(
  source: ReadableStream,
  destination: string
): Promise<void> {
  const reader = source.getReader();
  const writer = createWriteStream(destination);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      writer.write(Buffer.from(value));
    }
  } finally {
    writer.close();
  }
}
```

#### 병렬 처리 최적화
```typescript
// lib/parallel-processor.ts
import pLimit from 'p-limit';

const limit = pLimit(4); // 최대 4개 동시 처리

export async function processFilesInParallel<T>(
  files: T[],
  processor: (file: T) => Promise<any>
): Promise<any[]> {
  const tasks = files.map((file) => limit(() => processor(file)));
  return Promise.all(tasks);
}
```

#### 메모리 정리
```typescript
// lib/cleanup.ts
import cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';

// 1시간마다 임시 파일 정리
export function startCleanupJob() {
  cron.schedule('0 * * * *', async () => {
    console.log('Cleaning up old files...');

    const uploadDir = path.join(process.cwd(), 'tmp', 'uploads');
    const downloadDir = path.join(process.cwd(), 'public', 'downloads');

    const now = Date.now();
    const maxAge = 3600000; // 1시간

    for (const dir of [uploadDir, downloadDir]) {
      const sessions = await fs.readdir(dir);

      for (const session of sessions) {
        const sessionPath = path.join(dir, session);
        const stat = await fs.stat(sessionPath);

        if (now - stat.mtimeMs > maxAge) {
          await fs.rm(sessionPath, { recursive: true });
          console.log(`Deleted: ${sessionPath}`);
        }
      }
    }
  });
}

// app/api 또는 server.ts에서 호출
// startCleanupJob();
```

### 7.3 에러 처리 개선

#### 전역 에러 핸들러
```typescript
// lib/error-handler.ts
export class ConversionError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ConversionError';
  }
}

export function handleConversionError(error: any): {
  message: string;
  code: string;
  userMessage: string;
} {
  if (error instanceof ConversionError) {
    return {
      message: error.message,
      code: error.code,
      userMessage: error.message,
    };
  }

  // FFmpeg 에러
  if (error.message?.includes('ffmpeg')) {
    return {
      message: error.message,
      code: 'FFMPEG_ERROR',
      userMessage: '미디어 처리 중 오류가 발생했습니다. 파일이 손상되었을 수 있습니다.',
    };
  }

  // 파일 시스템 에러
  if (error.code === 'ENOSPC') {
    return {
      message: error.message,
      code: 'NO_SPACE',
      userMessage: '디스크 공간이 부족합니다.',
    };
  }

  // 기본 에러
  return {
    message: error.message || 'Unknown error',
    code: 'UNKNOWN_ERROR',
    userMessage: '알 수 없는 오류가 발생했습니다.',
  };
}
```

### 7.4 최종 체크리스트

#### 기능 완성도
- [ ] 모든 7개 탭 기능 구현
- [ ] 15개 문서 변환 조합 동작
- [ ] 문서 병합/분할 5가지 형식 지원
- [ ] YouTube 다운로드 동작
- [ ] 미디어 분할/병합 동작

#### 성능
- [ ] 100MB 파일 변환 시간 < 30초
- [ ] 진행률 실시간 업데이트 (< 1초 지연)
- [ ] 병렬 처리 동작 확인
- [ ] 메모리 누수 없음

#### 사용성
- [ ] 모든 에러 메시지 명확함
- [ ] 로그에 충분한 정보 기록
- [ ] Toast 알림 정상 동작
- [ ] 파일 다운로드 정상 동작

#### 코드 품질
- [ ] TypeScript 타입 에러 없음
- [ ] Console 에러/경고 없음
- [ ] ESLint/Prettier 적용
- [ ] 주석 추가 (복잡한 로직)

### 7.5 배포 전 준비 (선택사항)

#### 환경 변수 검증
```bash
# .env.production 생성
cp .env.local .env.production

# 필수 변수 확인
- FFMPEG_PATH
- FFPROBE_PATH
- MAX_FILE_SIZE
- SESSION_CLEANUP_INTERVAL
```

#### 빌드 테스트
```bash
npm run build
npm run start

# http://localhost:3000 접속 확인
```

---

## 개발 완료 후 문서화

### README.md 작성
```markdown
# EasyConversion Web

올인원 파일 변환 웹 애플리케이션

## 기능
- YouTube 다운로드 (MP4/MP3)
- 미디어 변환/분할/병합
- 문서 변환/병합/분할

## 설치
\`\`\`bash
npm install
brew install ffmpeg
\`\`\`

## 실행
\`\`\`bash
npm run dev
\`\`\`

## 기술 스택
- Next.js 14
- shadcn/ui
- FFmpeg
- pdf-lib, docx, pptxgenjs
\`\`\`

---

**Phase 7 완료 시 전체 프로젝트 완성!**
