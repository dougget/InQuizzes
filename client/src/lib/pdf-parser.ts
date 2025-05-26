export interface ParsedPDF {
  content: string;
  pageCount: number;
}

export async function parsePDF(file: File): Promise<ParsedPDF> {
  // This is not used in the new simplified version
  // Text input is handled directly in the UI
  throw new Error('PDF parsing not implemented in this version. Please use text input instead.');
}
