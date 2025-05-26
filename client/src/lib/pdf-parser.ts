import * as pdfjsLib from 'pdfjs-dist';

export interface ParsedPDF {
  content: string;
  pageCount: number;
}

// Configure PDF.js to work without a worker (slower but more reliable)
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

export async function parsePDF(file: File): Promise<ParsedPDF> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Use PDF.js without worker for better compatibility
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;
    
    let fullText = '';
    const pageCount = pdf.numPages;
    
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += pageText + '\n\n';
    }
    
    // Clean up the text
    const cleanedText = fullText
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n\n') // Normalize line breaks
      .trim();
    
    if (!cleanedText || cleanedText.length < 100) {
      throw new Error('PDF appears to be empty or contains very little text. Please ensure the PDF contains readable text content.');
    }
    
    return {
      content: cleanedText,
      pageCount,
    };
  } catch (error) {
    console.error('PDF parsing error:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to parse PDF: ${error.message}`);
    }
    throw new Error('Failed to parse PDF. Please ensure the file is a valid PDF with readable text content.');
  }
}
