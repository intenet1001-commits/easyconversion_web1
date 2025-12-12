import { PDFDocument } from 'pdf-lib';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';
import { marked } from 'marked';

export interface ConvertDocumentOptions {
  inputPath: string;
  outputPath: string;
  inputFormat: string;
  outputFormat: string;
  onProgress?: (progress: number) => void;
}

/**
 * 문서 변환 메인 함수
 */
export async function convertDocument({
  inputPath,
  outputPath,
  inputFormat,
  outputFormat,
  onProgress,
}: ConvertDocumentOptions): Promise<void> {
  onProgress?.(10);

  // 변환 매트릭스에 따라 적절한 함수 호출
  const conversionKey = `${inputFormat}_to_${outputFormat}`;

  switch (conversionKey) {
    // PDF 변환
    case 'pdf_to_html':
      await pdfToHtml(inputPath, outputPath, onProgress);
      break;
    case 'pdf_to_md':
      await pdfToMarkdown(inputPath, outputPath, onProgress);
      break;

    // DOCX 변환
    case 'docx_to_pdf':
      await docxToPdf(inputPath, outputPath, onProgress);
      break;
    case 'docx_to_html':
      await docxToHtml(inputPath, outputPath, onProgress);
      break;
    case 'docx_to_md':
      await docxToMarkdown(inputPath, outputPath, onProgress);
      break;

    // HTML 변환
    case 'html_to_pdf':
      await htmlToPdf(inputPath, outputPath, onProgress);
      break;
    case 'html_to_docx':
      await htmlToDocx(inputPath, outputPath, onProgress);
      break;
    case 'html_to_md':
      await htmlToMarkdown(inputPath, outputPath, onProgress);
      break;

    // Markdown 변환
    case 'md_to_pdf':
      await markdownToPdf(inputPath, outputPath, onProgress);
      break;
    case 'md_to_html':
      await markdownToHtml(inputPath, outputPath, onProgress);
      break;
    case 'md_to_docx':
      await markdownToDocx(inputPath, outputPath, onProgress);
      break;

    default:
      throw new Error(`지원되지 않는 변환: ${inputFormat} → ${outputFormat}`);
  }

  onProgress?.(100);
}

// ============= PDF 변환 함수들 =============

async function pdfToHtml(inputPath: string, outputPath: string, onProgress?: (progress: number) => void): Promise<void> {
  onProgress?.(30);

  const pdfBytes = await fs.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pageCount = pdfDoc.getPageCount();

  onProgress?.(50);

  let html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Converted from PDF</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .page { page-break-after: always; margin-bottom: 40px; }
  </style>
</head>
<body>
  <h1>PDF Document (${pageCount} pages)</h1>
  <p>This PDF has been converted to HTML. Full text extraction requires additional libraries.</p>
`;

  for (let i = 0; i < pageCount; i++) {
    html += `  <div class="page">
    <h2>Page ${i + 1}</h2>
    <p>Content from page ${i + 1}</p>
  </div>\n`;
  }

  html += `</body>
</html>`;

  onProgress?.(80);
  await fs.writeFile(outputPath, html, 'utf-8');
}

async function pdfToMarkdown(inputPath: string, outputPath: string, onProgress?: (progress: number) => void): Promise<void> {
  onProgress?.(30);

  const pdfBytes = await fs.readFile(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pageCount = pdfDoc.getPageCount();

  onProgress?.(50);

  let markdown = `# PDF Document\n\n`;
  markdown += `Total pages: ${pageCount}\n\n`;

  for (let i = 0; i < pageCount; i++) {
    markdown += `## Page ${i + 1}\n\n`;
    markdown += `Content from page ${i + 1}\n\n`;
    markdown += `---\n\n`;
  }

  onProgress?.(80);
  await fs.writeFile(outputPath, markdown, 'utf-8');
}

// ============= DOCX 변환 함수들 =============

async function docxToPdf(inputPath: string, outputPath: string, onProgress?: (progress: number) => void): Promise<void> {
  // DOCX를 먼저 HTML로 변환한 후 PDF로 변환
  onProgress?.(30);

  const result = await mammoth.convertToHtml({ path: inputPath });
  const html = result.value;

  onProgress?.(60);

  // HTML을 임시 파일로 저장
  const tempHtmlPath = outputPath.replace('.pdf', '.temp.html');
  await fs.writeFile(tempHtmlPath, html, 'utf-8');

  // HTML을 PDF로 변환
  await htmlToPdf(tempHtmlPath, outputPath, (p) => onProgress?.(60 + p * 0.4));

  // 임시 파일 삭제
  await fs.unlink(tempHtmlPath).catch(() => {});
}

async function docxToHtml(inputPath: string, outputPath: string, onProgress?: (progress: number) => void): Promise<void> {
  onProgress?.(30);

  const result = await mammoth.convertToHtml({ path: inputPath });
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Converted from DOCX</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
  </style>
</head>
<body>
${result.value}
</body>
</html>`;

  onProgress?.(80);
  await fs.writeFile(outputPath, html, 'utf-8');
}

async function docxToMarkdown(inputPath: string, outputPath: string, onProgress?: (progress: number) => void): Promise<void> {
  onProgress?.(30);

  // mammoth은 HTML로만 변환 가능, HTML을 마크다운으로 변환
  const result = await mammoth.convertToHtml({ path: inputPath });

  onProgress?.(60);

  // 간단한 HTML to Markdown 변환 (기본적인 태그만)
  let markdown = result.value
    .replace(/<h1>(.*?)<\/h1>/g, '# $1\n')
    .replace(/<h2>(.*?)<\/h2>/g, '## $1\n')
    .replace(/<h3>(.*?)<\/h3>/g, '### $1\n')
    .replace(/<h4>(.*?)<\/h4>/g, '#### $1\n')
    .replace(/<h5>(.*?)<\/h5>/g, '##### $1\n')
    .replace(/<h6>(.*?)<\/h6>/g, '###### $1\n')
    .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
    .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
    .replace(/<em>(.*?)<\/em>/g, '*$1*')
    .replace(/<ul>/g, '\n')
    .replace(/<\/ul>/g, '\n')
    .replace(/<ol>/g, '\n')
    .replace(/<\/ol>/g, '\n')
    .replace(/<li>(.*?)<\/li>/g, '- $1\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, ''); // 나머지 HTML 태그 제거

  onProgress?.(80);
  await fs.writeFile(outputPath, markdown, 'utf-8');
}

// ============= HTML 변환 함수들 =============

async function htmlToPdf(inputPath: string, outputPath: string, onProgress?: (progress: number) => void): Promise<void> {
  onProgress?.(30);

  const htmlContent = await fs.readFile(inputPath, 'utf-8');

  onProgress?.(50);

  // html-pdf-node를 사용한 PDF 생성
  const htmlPdf = require('html-pdf-node');

  const file = { content: htmlContent };
  const options = {
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
  };

  onProgress?.(70);

  const pdfBuffer = await htmlPdf.generatePdf(file, options);

  onProgress?.(90);
  await fs.writeFile(outputPath, pdfBuffer);
}

async function htmlToDocx(inputPath: string, outputPath: string, onProgress?: (progress: number) => void): Promise<void> {
  onProgress?.(30);

  const htmlContent = await fs.readFile(inputPath, 'utf-8');

  // HTML 태그 제거 (간단한 변환)
  const textContent = htmlContent
    .replace(/<[^>]*>/g, '\n')
    .replace(/\n+/g, '\n')
    .trim();

  onProgress?.(60);

  const doc = new Document({
    sections: [{
      properties: {},
      children: textContent.split('\n').map(line =>
        new Paragraph({
          children: [new TextRun(line)],
        })
      ),
    }],
  });

  onProgress?.(80);
  const buffer = await Packer.toBuffer(doc);
  await fs.writeFile(outputPath, buffer);
}

async function htmlToMarkdown(inputPath: string, outputPath: string, onProgress?: (progress: number) => void): Promise<void> {
  onProgress?.(30);

  const htmlContent = await fs.readFile(inputPath, 'utf-8');

  // 간단한 HTML to Markdown 변환
  let markdown = htmlContent
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n');

  onProgress?.(80);
  await fs.writeFile(outputPath, markdown, 'utf-8');
}

// ============= Markdown 변환 함수들 =============

async function markdownToHtml(inputPath: string, outputPath: string, onProgress?: (progress: number) => void): Promise<void> {
  onProgress?.(30);

  const mdContent = await fs.readFile(inputPath, 'utf-8');

  onProgress?.(50);

  const htmlBody = marked(mdContent);

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Converted from Markdown</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      line-height: 1.6;
      color: #333;
    }
    h1, h2, h3 { margin-top: 24px; margin-bottom: 16px; }
    code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
    }
    pre {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
    }
    blockquote {
      border-left: 4px solid #ddd;
      padding-left: 16px;
      margin-left: 0;
      color: #666;
    }
  </style>
</head>
<body>
${htmlBody}
</body>
</html>`;

  onProgress?.(80);
  await fs.writeFile(outputPath, html, 'utf-8');
}

async function markdownToPdf(inputPath: string, outputPath: string, onProgress?: (progress: number) => void): Promise<void> {
  // Markdown을 먼저 HTML로 변환한 후 PDF로 변환
  onProgress?.(30);

  const tempHtmlPath = outputPath.replace('.pdf', '.temp.html');
  await markdownToHtml(inputPath, tempHtmlPath, (p) => onProgress?.(30 + p * 0.3));

  onProgress?.(60);

  await htmlToPdf(tempHtmlPath, outputPath, (p) => onProgress?.(60 + p * 0.4));

  // 임시 파일 삭제
  await fs.unlink(tempHtmlPath).catch(() => {});
}

async function markdownToDocx(inputPath: string, outputPath: string, onProgress?: (progress: number) => void): Promise<void> {
  onProgress?.(30);

  const mdContent = await fs.readFile(inputPath, 'utf-8');

  // 간단한 Markdown 파싱 및 DOCX 변환
  const lines = mdContent.split('\n');
  const paragraphs = lines.map(line => {
    // 제목 처리
    if (line.startsWith('# ')) {
      return new Paragraph({
        text: line.substring(2),
        heading: 'Heading1' as any,
      });
    } else if (line.startsWith('## ')) {
      return new Paragraph({
        text: line.substring(3),
        heading: 'Heading2' as any,
      });
    } else if (line.startsWith('### ')) {
      return new Paragraph({
        text: line.substring(4),
        heading: 'Heading3' as any,
      });
    } else {
      return new Paragraph({
        children: [new TextRun(line)],
      });
    }
  });

  onProgress?.(70);

  const doc = new Document({
    sections: [{
      properties: {},
      children: paragraphs,
    }],
  });

  onProgress?.(85);
  const buffer = await Packer.toBuffer(doc);
  await fs.writeFile(outputPath, buffer);
}

/**
 * 지원되는 변환 목록 확인
 */
export function isSupportedConversion(inputFormat: string, outputFormat: string): boolean {
  const supportedConversions = [
    'pdf_to_html', 'pdf_to_md',
    'docx_to_pdf', 'docx_to_html', 'docx_to_md',
    'html_to_pdf', 'html_to_docx', 'html_to_md',
    'md_to_pdf', 'md_to_html', 'md_to_docx',
  ];

  return supportedConversions.includes(`${inputFormat}_to_${outputFormat}`);
}
