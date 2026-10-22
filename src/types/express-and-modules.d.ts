// 1. Extensión oficial del objeto Request de Express para Zero-Trust
declare namespace Express {
  export interface UserPayload {
    idUsuario: string;
    uid: string;
    email?: string;
    rol: string;
  }

  export interface Request {
    user?: UserPayload;
  }
}

// 2. Tipado estricto para pdf-parse en entornos ESM / NodeNext
declare module 'pdf-parse' {
  export interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
    text: string;
    version: string;
  }

  function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>;
  export = pdfParse;
}