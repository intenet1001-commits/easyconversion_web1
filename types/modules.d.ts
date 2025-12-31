// Type declarations for modules without types

declare module 'pdf-parse' {
  interface PDFData {
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
  }

  interface PDFOptions {
    pagerender?: (pageData: any) => string;
    max?: number;
    version?: string;
  }

  function pdfParse(buffer: Buffer, options?: PDFOptions): Promise<PDFData>;
  export = pdfParse;
}

declare module 'pdf-img-convert' {
  interface ConvertOptions {
    width?: number;
    height?: number;
    page_numbers?: number[];
    base64?: boolean;
  }

  export function convert(pdf: string | Buffer, options?: ConvertOptions): Promise<Uint8Array[]>;
}

declare module 'html-pdf-node' {
  interface File {
    url?: string;
    content?: string;
  }

  interface Options {
    format?: string;
    path?: string;
    printBackground?: boolean;
    margin?: {
      top?: string;
      right?: string;
      bottom?: string;
      left?: string;
    };
  }

  export function generatePdf(file: File, options?: Options): Promise<Buffer>;
  export function generatePdfs(files: File[], options?: Options): Promise<Buffer[]>;
}
