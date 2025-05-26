export interface ProcessedDocument {
  content: string;
  pageCount: number;
  fileName: string;
  fileSize: number;
}

export async function processPDFFile(file: File): Promise<ProcessedDocument> {
  // Send PDF to backend for processing
  const formData = new FormData();
  formData.append('pdf', file);

  const response = await fetch('/api/process-pdf', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to process PDF' }));
    throw new Error(error.message || 'Failed to process PDF file');
  }

  return await response.json();
}