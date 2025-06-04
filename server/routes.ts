import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertQuizSchema, insertQuizAttemptSchema } from "@shared/schema";
import multer from "multer";
import { z } from "zod";
// Simplified PDF processing - we'll use the existing pdf2json package

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
  // Health check endpoint for Docker
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  });
  // Process PDF files and extract text content
  app.post("/api/process-pdf", upload.single('pdf'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No PDF file uploaded" });
      }

      // Use dynamic import for pdf2json
      const { default: PDFParser } = await import('pdf2json');
      const pdfParser = new PDFParser();
      
      let extractedText = '';
      let pageCount = 0;
      let hasResponded = false;

      pdfParser.on("pdfParser_dataError", (errData: any) => {
        if (!hasResponded) {
          hasResponded = true;
          console.error('PDF parsing error:', errData.parserError);
          res.status(500).json({ 
            message: "Failed to process PDF. Please ensure the file is a valid PDF with readable text content." 
          });
        }
      });

      pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
        if (hasResponded) return;
        
        try {
          // Extract text from all pages
          if (pdfData.Pages) {
            pageCount = pdfData.Pages.length;
            
            pdfData.Pages.forEach((page: any) => {
              if (page.Texts) {
                page.Texts.forEach((textItem: any) => {
                  if (textItem.R) {
                    textItem.R.forEach((textRun: any) => {
                      if (textRun.T) {
                        extractedText += decodeURIComponent(textRun.T) + ' ';
                      }
                    });
                  }
                });
              }
            });
          }

          extractedText = extractedText.trim();
          
          if (!extractedText || extractedText.length < 100) {
            hasResponded = true;
            return res.status(400).json({ 
              message: "PDF appears to be empty or contains very little readable text. Please ensure the PDF contains text content that can be extracted." 
            });
          }

          hasResponded = true;
          res.json({
            content: extractedText,
            pageCount: pageCount || 1,
            fileName: req.file.originalname,
            fileSize: req.file.size,
          });
          
        } catch (processingError) {
          if (!hasResponded) {
            hasResponded = true;
            console.error('Text extraction error:', processingError);
            res.status(500).json({ 
              message: "Failed to extract text from PDF. Please ensure the file contains readable text content." 
            });
          }
        }
      });

      // Parse the PDF buffer
      pdfParser.parseBuffer(req.file.buffer);

    } catch (error) {
      console.error('PDF processing error:', error);
      res.status(500).json({ 
        message: "Failed to process PDF. Please ensure the file is a valid PDF with readable text content." 
      });
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

      // Call OpenRouter API to generate questions
      const openrouterApiKey = process.env.OPENROUTER_API_KEY;
      
      if (!openrouterApiKey) {
        return res.status(500).json({ message: "OpenRouter API key not configured" });
      }

      // Limit content size for very large documents (equivalent to ~200 pages)
      const maxContentLength = 500000; // About 200 pages of text
      let processContent = content;
      if (content.length > maxContentLength) {
        processContent = content.substring(0, maxContentLength);
        console.log(`Content truncated from ${content.length} to ${maxContentLength} characters for processing`);
      }

      // Split content into chunks if it's too long for the API
      const maxChunkSize = 12000; // OpenRouter can handle larger chunks
      const chunks = splitContentIntoChunks(processContent, maxChunkSize);
      
      let allQuestions: any[] = [];
      const questionsPerChunk = Math.ceil(questionCount / chunks.length);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const remainingQuestions = questionCount - allQuestions.length;
        const chunkQuestionCount = Math.min(questionsPerChunk, remainingQuestions);
        
        if (chunkQuestionCount <= 0) break;

        try {
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openrouterApiKey}`,
              'HTTP-Referer': 'https://inquizzes.app',
              'X-Title': 'inQuizzes - Document Quiz Generator',
            },
            body: JSON.stringify({
              model: 'anthropic/claude-3.5-sonnet',
              messages: [
                {
                  role: 'system',
                  content: `You are an expert quiz generator. Create exactly ${chunkQuestionCount} high-quality multiple choice questions based ONLY on the specific facts, concepts, and information presented in the text content.

                  CONTENT FOCUS:
                  - Test understanding of specific facts, concepts, details, or relationships mentioned in the text
                  - Focus on key ideas, processes, definitions, examples, data, procedures, or technical details
                  - Each question must reference specific information that can be found in the text
                  - All 4 answer options should be plausible and related to the topic

                  FORBIDDEN TOPICS:
                  - NEVER ask about document structure, format, purpose, metadata, chapters, or sections
                  - NEVER ask "What is the purpose of this document/PDF/text/chapter?"
                  - NEVER ask about the author, writer, or their intent unless explicitly discussed in the content
                  - NEVER ask about document organization or layout

                  QUESTION VARIETY - Use diverse question formats:
                  - "Which of the following..." (testing specific facts)
                  - "What happens when..." (testing cause-effect relationships)  
                  - "How does..." (testing processes or mechanisms)
                  - "Why is..." (testing reasoning or explanations)
                  - "In what situation would..." (testing application)
                  - "What is the main difference between..." (testing comparisons)
                  - "Which statement is true about..." (testing comprehension)
                  - "What would be the result if..." (testing consequences)

                  EXPLANATION VARIETY - Avoid repetitive phrases:
                  - "The text explains that..."
                  - "This is because..."
                  - "The content describes..."
                  - "As stated in the material..."
                  - "The information shows..."
                  - "This occurs when..."

                  RETURN ONLY VALID JSON:
                  [
                    {
                      "id": "q1",
                      "question": "Which of the following best describes [specific concept]?",
                      "options": ["Option A", "Option B", "Option C", "Option D"],
                      "correctAnswer": 0,
                      "explanation": "The text explains that [specific details without repetitive phrasing]"
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
            console.error(`OpenRouter API error for chunk ${i}:`, response.status, await response.text());
            continue;
          }

          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          
          if (content) {
            try {
              // Try to clean and fix common JSON issues
              let cleanedContent = content.trim();
              
              // Remove any markdown code blocks
              cleanedContent = cleanedContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
              
              // Try to extract JSON array if it's embedded in text
              const jsonMatch = cleanedContent.match(/\[\s*\{[\s\S]*\}\s*\]/);
              if (jsonMatch) {
                cleanedContent = jsonMatch[0];
              }
              
              // Fix common JSON issues - more aggressive cleaning for truncated responses
              cleanedContent = cleanedContent
                .replace(/,\s*\]/g, ']')              // Remove trailing commas in arrays
                .replace(/,\s*\}/g, '}')              // Remove trailing commas in objects
                .replace(/\.\.\./g, '"')              // Replace ellipsis with quote to close strings
                .replace(/"\s*\.\.\./g, '"')          // Remove ellipsis after quotes
                .replace(/\.\.\.\s*$/g, '"')          // Handle ellipsis at end of content
                .replace(/"\s*[^"]*\.\.\.[^"]*$/g, '"') // Clean up any incomplete strings ending with ellipsis
                .replace(/\n/g, ' ')                  // Replace newlines with spaces
                .replace(/\s+/g, ' ')                 // Normalize whitespace
                .replace(/([^"])\s*\n\s*([^"])/g, '$1 $2'); // Join broken lines
              
              // Handle incomplete JSON arrays more robustly
              if (cleanedContent.includes('[') && !cleanedContent.endsWith(']')) {
                // Find the last properly closed object
                let lastValidEnd = -1;
                let braceCount = 0;
                let inString = false;
                let escaped = false;
                
                for (let i = 0; i < cleanedContent.length; i++) {
                  const char = cleanedContent[i];
                  
                  if (escaped) {
                    escaped = false;
                    continue;
                  }
                  
                  if (char === '\\') {
                    escaped = true;
                    continue;
                  }
                  
                  if (char === '"') {
                    inString = !inString;
                    continue;
                  }
                  
                  if (!inString) {
                    if (char === '{') {
                      braceCount++;
                    } else if (char === '}') {
                      braceCount--;
                      if (braceCount === 0) {
                        lastValidEnd = i;
                      }
                    }
                  }
                }
                
                // If we found a complete object, truncate there and close the array
                if (lastValidEnd > -1) {
                  cleanedContent = cleanedContent.substring(0, lastValidEnd + 1) + ']';
                } else {
                  // Fallback: just add closing bracket
                  cleanedContent += ']';
                }
              }
              
              const questions = JSON.parse(cleanedContent);
              if (Array.isArray(questions)) {
                // Validate each question has required fields
                const validQuestions = questions.filter(q => 
                  q && 
                  typeof q.question === 'string' && 
                  Array.isArray(q.options) && 
                  q.options.length === 4 &&
                  typeof q.correctAnswer === 'number' &&
                  q.correctAnswer >= 0 && q.correctAnswer <= 3 &&
                  typeof q.explanation === 'string'
                ).slice(0, chunkQuestionCount);
                
                allQuestions.push(...validQuestions);
                console.log(`Successfully parsed ${validQuestions.length} questions from chunk ${i}`);
              }
            } catch (parseError) {
              console.error(`Failed to parse questions for chunk ${i}:`, parseError);
              console.log(`Problematic content: ${content.substring(0, 200)}...`);
              
              // Retry with a simpler prompt if JSON parsing fails
              try {
                console.log(`Retrying chunk ${i} with simpler prompt...`);
                const retryResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openrouterApiKey}`,
                    'HTTP-Referer': 'https://inquizzes.app',
                    'X-Title': 'inQuizzes - Document Quiz Generator',
                  },
                  body: JSON.stringify({
                    model: 'anthropic/claude-3.5-sonnet',
                    messages: [
                      {
                        role: 'user',
                        content: `Create ${Math.min(chunkQuestionCount, 3)} varied multiple choice questions about specific facts and concepts. 

AVOID: document purpose, structure, chapters, author questions, repetitive "According to the text" phrases.

USE VARIED FORMATS: "Which of the following...", "What happens when...", "How does...", "Why is...", "What would result if..."

Return ONLY valid JSON: [{"id":"q1","question":"Which of the following describes [concept]?","options":["A","B","C","D"],"correctAnswer":0,"explanation":"This occurs because [details]"}]

Text: ${chunk.substring(0, 3000)}`
                      }
                    ],
                    max_tokens: 2000,
                    temperature: 0.5,
                  }),
                });
                
                if (retryResponse.ok) {
                  const retryData = await retryResponse.json();
                  const retryContent = retryData.choices?.[0]?.message?.content;
                  if (retryContent) {
                    const retryQuestions = JSON.parse(retryContent.replace(/```json\s*/g, '').replace(/```\s*/g, ''));
                    if (Array.isArray(retryQuestions)) {
                      const validRetryQuestions = retryQuestions.filter(q => 
                        q && typeof q.question === 'string' && Array.isArray(q.options) && q.options.length === 4
                      ).slice(0, Math.min(chunkQuestionCount, 3));
                      allQuestions.push(...validRetryQuestions);
                      console.log(`Retry successful: ${validRetryQuestions.length} questions from chunk ${i}`);
                    }
                  }
                }
              } catch (retryError) {
                console.error(`Retry also failed for chunk ${i}:`, retryError);
              }
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
        createdAt: new Date().toISOString(),
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
        completedAt: new Date().toISOString(),
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
