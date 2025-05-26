import { apiRequest } from "./queryClient";
import type { Quiz, QuizQuestion } from "@shared/schema";

export interface GenerateQuizRequest {
  content: string;
  fileName: string;
  fileSize: number;
  questionCount: number;
}

export interface QuizGenerationProgress {
  stage: 'extracting' | 'processing' | 'generating' | 'finalizing';
  progress: number;
  message: string;
}

export async function generateQuiz(
  request: GenerateQuizRequest,
  onProgress?: (progress: QuizGenerationProgress) => void
): Promise<Quiz> {
  try {
    // Report extraction progress
    onProgress?.({
      stage: 'extracting',
      progress: 25,
      message: 'Extracting PDF content...'
    });

    await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UX

    // Report processing progress
    onProgress?.({
      stage: 'processing',
      progress: 50,
      message: 'Processing document chunks...'
    });

    await new Promise(resolve => setTimeout(resolve, 1000)); // Brief delay for UX

    // Report generation progress
    onProgress?.({
      stage: 'generating',
      progress: 75,
      message: 'Generating AI questions...'
    });

    const response = await apiRequest('POST', '/api/generate-quiz', request);
    const quiz = await response.json();

    // Report finalization
    onProgress?.({
      stage: 'finalizing',
      progress: 100,
      message: 'Finalizing quiz...'
    });

    await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UX

    return quiz;
  } catch (error) {
    console.error('Quiz generation error:', error);
    throw error;
  }
}

export async function submitQuizAttempt(quizId: number, answers: Array<{
  questionId: string;
  selectedAnswer: number;
}>) {
  const response = await apiRequest('POST', `/api/quiz/${quizId}/submit`, { answers });
  return await response.json();
}

export async function getQuiz(quizId: number): Promise<Quiz> {
  const response = await apiRequest('GET', `/api/quiz/${quizId}`);
  return await response.json();
}
