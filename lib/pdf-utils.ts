import { PDFDocument } from 'pdf-lib';
import { readFile, writeFile } from 'fs/promises';

/**
 * 여러 PDF 파일을 하나로 병합
 */
export async function mergePDFs(inputPaths: string[], outputPath: string): Promise<void> {
  const mergedPdf = await PDFDocument.create();

  for (const inputPath of inputPaths) {
    const pdfBytes = await readFile(inputPath);
    const pdf = await PDFDocument.load(pdfBytes);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());

    copiedPages.forEach((page) => {
      mergedPdf.addPage(page);
    });
  }

  const mergedPdfBytes = await mergedPdf.save();
  await writeFile(outputPath, mergedPdfBytes);
}

/**
 * PDF에서 특정 페이지 범위 추출
 */
export async function splitPDF(
  inputPath: string,
  outputPath: string,
  startPage: number, // 1-based
  endPage: number     // 1-based
): Promise<void> {
  const pdfBytes = await readFile(inputPath);
  const pdf = await PDFDocument.load(pdfBytes);

  const totalPages = pdf.getPageCount();

  // 유효성 검사
  if (startPage < 1 || endPage > totalPages || startPage > endPage) {
    throw new Error(`Invalid page range: ${startPage}-${endPage} (Total: ${totalPages})`);
  }

  const newPdf = await PDFDocument.create();
  const pageIndices = Array.from(
    { length: endPage - startPage + 1 },
    (_, i) => startPage - 1 + i
  );

  const copiedPages = await newPdf.copyPages(pdf, pageIndices);
  copiedPages.forEach((page) => {
    newPdf.addPage(page);
  });

  const newPdfBytes = await newPdf.save();
  await writeFile(outputPath, newPdfBytes);
}

/**
 * PDF 페이지 수 가져오기
 */
export async function getPDFPageCount(filePath: string): Promise<number> {
  const pdfBytes = await readFile(filePath);
  const pdf = await PDFDocument.load(pdfBytes);
  return pdf.getPageCount();
}
