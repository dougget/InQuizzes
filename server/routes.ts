import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertQuizSchema, insertQuizAttemptSchema } from "@shared/schema";
import multer from "multer";
import { z } from "zod";
import pdfParse from "pdf-parse";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Upload and parse PDF file
  app.post("/api/upload-pdf", upload.single('pdf'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No PDF file uploaded" });
      }

      const pdfData = await pdfParse(req.file.buffer);
      
      if (!pdfData.text || pdfData.text.length < 100) {
        return res.status(400).json({ 
          message: "PDF appears to be empty or contains very little text. Please ensure the PDF contains readable text content." 
        });
      }

      res.json({
        content: pdfData.text.trim(),
        pageCount: pdfData.numpages,
        fileName: req.file.originalname,
        fileSize: req.file.size,
      });
    } catch (error) {
      console.error('PDF parsing error:', error);
      res.status(500).json({ message: "Failed to parse PDF. Please ensure the file is a valid PDF with readable text content." });
    }
  });

  // Generate quiz from PDF content
  app.post("/api/generate-quiz", async (req, res) => {
    try {
      const { content, fileName, fileSize, questionCount } = req.body;
      
      if (!content || !fileName || !fileSize || !questionCount) {
        return res.status(400).json({ 
          message: "Missing required fields: content, fileName, fileSize, questionCount" 
        });
      }

      // Call DeepSeek API to generate questions
      const deepseekApiKey = process.env.DEEPSEEK_API_KEY || 'sk-f1f24f660e174bda83db5f277a62be71';
      
      if (!deepseekApiKey) {
        return res.status(500).json({ message: "DeepSeek API key not configured" });
      }

      // Split content into chunks if it's too long for the API
      const maxChunkSize = 8000; // Conservative token limit
      const chunks = splitContentIntoChunks(content, maxChunkSize);
      
      let allQuestions: any[] = [];
      const questionsPerChunk = Math.ceil(questionCount / chunks.length);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const remainingQuestions = questionCount - allQuestions.length;
        const chunkQuestionCount = Math.min(questionsPerChunk, remainingQuestions);
        
        if (chunkQuestionCount <= 0) break;

        try {
          const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${deepseekApiKey}`,
            },
            body: JSON.stringify({
              model: 'deepseek-chat',
              messages: [
                {
                  role: 'system',
                  content: `You are an expert quiz generator. Create exactly ${chunkQuestionCount} high-quality, content-focused multiple choice questions based on the provided text. Each question should:
                  1. Be elaborate and test deep understanding
                  2. Focus purely on content, not metadata or structure
                  3. Have 4 options with only one correct answer
                  4. Include a brief explanation for the correct answer
                  
                  Return ONLY a JSON array with this exact format:
                  [
                    {
                      "id": "unique_id",
                      "question": "question text",
                      "options": ["option1", "option2", "option3", "option4"],
                      "correctAnswer": 0,
                      "explanation": "explanation text"
                    }
                  ]`
                },
                {
                  role: 'user',
                  content: `Generate ${chunkQuestionCount} multiple choice questions from this content:\n\n${chunk}`
                }
              ],
              max_tokens: 4000,
              temperature: 0.7,
            }),
          });

          if (!response.ok) {
            console.error(`DeepSeek API error for chunk ${i}:`, response.status, await response.text());
            continue;
          }

          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          
          if (content) {
            try {
              const questions = JSON.parse(content);
              if (Array.isArray(questions)) {
                allQuestions.push(...questions.slice(0, chunkQuestionCount));
              }
            } catch (parseError) {
              console.error(`Failed to parse questions for chunk ${i}:`, parseError);
            }
          }
        } catch (error) {
          console.error(`Error processing chunk ${i}:`, error);
        }
      }

      if (allQuestions.length === 0) {
        return res.status(500).json({ message: "Failed to generate any questions from the content" });
      }

      // Ensure we have unique IDs
      allQuestions = allQuestions.map((q, index) => ({
        ...q,
        id: `q_${Date.now()}_${index}`,
      }));

      // Create quiz in storage
      const quiz = await storage.createQuiz({
        fileName,
        fileSize,
        content,
        questionCount: allQuestions.length,
        questions: allQuestions,
      });

      res.json(quiz);
    } catch (error) {
      console.error('Error generating quiz:', error);
      res.status(500).json({ message: "Failed to generate quiz" });
    }
  });

  // Get quiz by ID
  app.get("/api/quiz/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const quiz = await storage.getQuiz(id);
      
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }
      
      res.json(quiz);
    } catch (error) {
      console.error('Error fetching quiz:', error);
      res.status(500).json({ message: "Failed to fetch quiz" });
    }
  });

  // Submit quiz attempt
  app.post("/api/quiz/:id/submit", async (req, res) => {
    try {
      const quizId = parseInt(req.params.id);
      const { answers } = req.body;
      
      if (!Array.isArray(answers)) {
        return res.status(400).json({ message: "Answers must be an array" });
      }

      const quiz = await storage.getQuiz(quizId);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }

      // Calculate score
      let correctCount = 0;
      const processedAnswers = answers.map(answer => {
        const question = quiz.questions.find(q => q.id === answer.questionId);
        const isCorrect = question && answer.selectedAnswer === question.correctAnswer;
        if (isCorrect) correctCount++;
        
        return {
          questionId: answer.questionId,
          selectedAnswer: answer.selectedAnswer,
          isCorrect: !!isCorrect,
        };
      });

      const score = Math.round((correctCount / quiz.questions.length) * 100);

      const attempt = await storage.createQuizAttempt({
        quizId,
        answers: processedAnswers,
        score,
      });

      res.json({
        ...attempt,
        correctCount,
        totalQuestions: quiz.questions.length,
        incorrectAnswers: quiz.questions.filter(q => {
          const userAnswer = processedAnswers.find(a => a.questionId === q.id);
          return userAnswer && !userAnswer.isCorrect;
        }).map(q => {
          const userAnswer = processedAnswers.find(a => a.questionId === q.id);
          return {
            question: q,
            userAnswer: userAnswer?.selectedAnswer,
            correctAnswer: q.correctAnswer,
          };
        }),
      });
    } catch (error) {
      console.error('Error submitting quiz:', error);
      res.status(500).json({ message: "Failed to submit quiz" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function splitContentIntoChunks(content: string, maxChunkSize: number): string[] {
  if (content.length <= maxChunkSize) {
    return [content];
  }

  const chunks: string[] = [];
  const paragraphs = content.split('\n\n');
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length + 2 <= maxChunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = paragraph;
      } else {
        // Paragraph is too long, split by sentences
        const sentences = paragraph.split('. ');
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length + 2 <= maxChunkSize) {
            currentChunk += (currentChunk ? '. ' : '') + sentence;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk);
              currentChunk = sentence;
            } else {
              // Sentence is too long, force split
              chunks.push(sentence.substring(0, maxChunkSize));
              currentChunk = sentence.substring(maxChunkSize);
            }
          }
        }
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}
