export interface ParsedPDF {
  content: string;
  pageCount: number;
}

export async function parsePDF(file: File): Promise<ParsedPDF> {
  try {
    const formData = new FormData();
    formData.append('pdf', file);

    const response = await fetch('/api/upload-pdf', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to parse PDF');
    }

    const data = await response.json();
    return {
      content: data.content,
      pageCount: data.pageCount,
    };
  } catch (error) {
    console.error('PDF parsing error:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to parse PDF: ${error.message}`);
    }
    throw new Error('Failed to parse PDF. Please ensure the file is a valid PDF with readable text content.');
  }
}
