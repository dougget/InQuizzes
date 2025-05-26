import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/components/theme-provider";
import { parsePDF } from "@/lib/pdf-parser";
import { generateQuiz, submitQuizAttempt, type QuizGenerationProgress } from "@/lib/deepseek";
import { Brain, Upload, FileText, Sun, Moon, ChevronLeft, ChevronRight, Trophy, RotateCcw, Upload as UploadIcon, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import type { Quiz, QuizQuestion, UserAnswer } from "@shared/schema";

interface QuizState {
  quiz: Quiz | null;
  currentQuestionIndex: number;
  userAnswers: Map<string, number>;
  showResults: boolean;
  results: any;
}

export default function Home() {
  const { theme, setTheme } = useTheme();
  const [file, setFile] = useState<File | null>(null);
  const [questionCount, setQuestionCount] = useState([25]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<QuizGenerationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quizState, setQuizState] = useState<QuizState>({
    quiz: null,
    currentQuestionIndex: 0,
    userAnswers: new Map(),
    showResults: false,
    results: null,
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setError('Please select a PDF file only.');
        return;
      }
      if (selectedFile.size > 15 * 1024 * 1024) {
        setError('File size must be less than 15MB.');
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxSize: 15 * 1024 * 1024,
    multiple: false,
  });

  const handleGenerateQuiz = async () => {
    if (!file) return;

    setIsGenerating(true);
    setError(null);
    setProgress(null);

    try {
      // Parse PDF
      setProgress({
        stage: 'extracting',
        progress: 10,
        message: 'Extracting PDF content...'
      });

      const parsedPDF = await parsePDF(file);

      // Generate quiz
      const quiz = await generateQuiz({
        content: parsedPDF.content,
        fileName: file.name,
        fileSize: file.size,
        questionCount: questionCount[0],
      }, setProgress);

      setQuizState({
        quiz,
        currentQuestionIndex: 0,
        userAnswers: new Map(),
        showResults: false,
        results: null,
      });
    } catch (error) {
      console.error('Error generating quiz:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate quiz. Please try again.');
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  const handleAnswerSelect = (questionId: string, answerIndex: number) => {
    setQuizState(prev => ({
      ...prev,
      userAnswers: new Map(prev.userAnswers.set(questionId, answerIndex)),
    }));
  };

  const handleNextQuestion = () => {
    if (!quizState.quiz) return;

    if (quizState.currentQuestionIndex < quizState.quiz.questions.length - 1) {
      setQuizState(prev => ({
        ...prev,
        currentQuestionIndex: prev.currentQuestionIndex + 1,
      }));
    } else {
      handleFinishQuiz();
    }
  };

  const handlePrevQuestion = () => {
    if (quizState.currentQuestionIndex > 0) {
      setQuizState(prev => ({
        ...prev,
        currentQuestionIndex: prev.currentQuestionIndex - 1,
      }));
    }
  };

  const handleFinishQuiz = async () => {
    if (!quizState.quiz) return;

    try {
      const answers = Array.from(quizState.userAnswers.entries()).map(([questionId, selectedAnswer]) => ({
        questionId,
        selectedAnswer,
      }));

      const results = await submitQuizAttempt(quizState.quiz.id, answers);
      
      setQuizState(prev => ({
        ...prev,
        showResults: true,
        results,
      }));
    } catch (error) {
      console.error('Error submitting quiz:', error);
      setError('Failed to submit quiz. Please try again.');
    }
  };

  const handleRetakeQuiz = () => {
    setQuizState(prev => ({
      ...prev,
      currentQuestionIndex: 0,
      userAnswers: new Map(),
      showResults: false,
      results: null,
    }));
  };

  const handleUploadNewDocument = () => {
    setFile(null);
    setQuizState({
      quiz: null,
      currentQuestionIndex: 0,
      userAnswers: new Map(),
      showResults: false,
      results: null,
    });
    setError(null);
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const currentQuestion = quizState.quiz?.questions[quizState.currentQuestionIndex];
  const isLastQuestion = quizState.quiz && quizState.currentQuestionIndex === quizState.quiz.questions.length - 1;
  const answeredCount = quizState.userAnswers.size;
  const progressPercentage = quizState.quiz ? (answeredCount / quizState.quiz.questions.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center">
              <Brain className="text-primary-foreground text-lg" />
            </div>
            <h1 className="text-2xl font-bold">inQuizzes</h1>
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            className="rounded-lg"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero Section */}
        {!quizState.quiz && !quizState.showResults && (
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">
              Turn Documents into <span className="text-primary">Smart Quizzes</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Upload your PDF documents and generate AI-powered quizzes to test your understanding. Perfect for students, professionals, and lifelong learners.
            </p>
          </div>
        )}

        {/* Upload Section */}
        {!quizState.quiz && !quizState.showResults && (
          <Card className="mb-8">
            <CardContent className="p-8">
              {/* File Upload Zone */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors mb-8 ${
                  isDragActive 
                    ? 'border-primary bg-primary/5' 
                    : file 
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/10' 
                    : 'border-muted-foreground/25 hover:border-primary'
                }`}
              >
                <input {...getInputProps()} />
                
                {file ? (
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                      <CheckCircle className="text-2xl text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-lg font-medium mb-1">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
                      <Button variant="link" className="text-primary hover:text-primary/80 text-sm font-medium mt-2">
                        Change file
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                      <FileText className="text-2xl text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-lg font-medium mb-2">Drop your PDF here</p>
                      <p className="text-muted-foreground">or <span className="text-primary font-medium">browse files</span></p>
                      <p className="text-sm text-muted-foreground mt-2">PDF only • Max 15MB</p>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <Alert className="mb-8 border-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-destructive">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {/* Quiz Settings */}
              <div className="space-y-6 mb-8">
                <div>
                  <Label className="text-sm font-medium mb-3 block">
                    Number of Questions: <span className="text-primary font-semibold">{questionCount[0]}</span>
                  </Label>
                  <div className="space-y-2">
                    <Slider
                      value={questionCount}
                      onValueChange={setQuestionCount}
                      max={50}
                      min={1}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1</span>
                      <span>50</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <Button 
                onClick={handleGenerateQuiz}
                disabled={!file || isGenerating}
                className="w-full py-4 text-lg font-semibold"
                size="lg"
              >
                {isGenerating ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground"></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  "Generate Quiz"
                )}
              </Button>

              {/* Progress Bar */}
              {progress && (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{progress.message}</span>
                    <span>{progress.progress}%</span>
                  </div>
                  <Progress value={progress.progress} />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quiz Section */}
        {quizState.quiz && !quizState.showResults && currentQuestion && (
          <div>
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold">Your Quiz</h3>
              <div className="text-sm text-muted-foreground">
                <span>{quizState.currentQuestionIndex + 1}</span> of <span>{quizState.quiz.questions.length}</span>
              </div>
            </div>

            {/* Quiz Card */}
            <Card className="mb-6">
              <CardContent className="p-8">
                {/* Question Display */}
                <div className="mb-8">
                  <div className="flex items-start space-x-4 mb-6">
                    <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 mt-1">
                      <span>{quizState.currentQuestionIndex + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-lg leading-relaxed">
                        {currentQuestion.question}
                      </p>
                    </div>
                  </div>

                  {/* Answer Options */}
                  <RadioGroup
                    value={quizState.userAnswers.get(currentQuestion.id)?.toString()}
                    onValueChange={(value) => handleAnswerSelect(currentQuestion.id, parseInt(value))}
                    className="space-y-3"
                  >
                    {currentQuestion.options.map((option, index) => (
                      <div key={index} className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value={index.toString()} id={`option-${index}`} className="mt-1" />
                        <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {/* Navigation Buttons */}
                <div className="flex justify-between items-center pt-6 border-t">
                  <Button
                    variant="outline"
                    onClick={handlePrevQuestion}
                    disabled={quizState.currentQuestionIndex === 0}
                    className="flex items-center space-x-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Previous</span>
                  </Button>

                  <Button
                    onClick={handleNextQuestion}
                    disabled={!quizState.userAnswers.has(currentQuestion.id)}
                    className="flex items-center space-x-2"
                  >
                    <span>{isLastQuestion ? 'Finish Quiz' : 'Next'}</span>
                    {isLastQuestion ? <CheckCircle className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quiz Progress */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold">Progress</h4>
                  <span className="text-sm text-muted-foreground">
                    {answeredCount} of {quizState.quiz.questions.length} answered
                  </span>
                </div>
                <Progress value={progressPercentage} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results Section */}
        {quizState.showResults && quizState.results && (
          <div>
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="text-white text-2xl" />
              </div>
              <h3 className="text-3xl font-bold mb-2">Quiz Complete!</h3>
              <p className="text-lg text-muted-foreground">Here's how you performed</p>
            </div>

            {/* Score Card */}
            <Card className="mb-8">
              <CardContent className="p-8">
                <div className="grid md:grid-cols-3 gap-8 text-center">
                  <div>
                    <div className="text-3xl font-bold text-primary mb-2">{quizState.results.score}%</div>
                    <div className="text-muted-foreground">Overall Score</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-green-600 mb-2">{quizState.results.correctCount}</div>
                    <div className="text-muted-foreground">Correct Answers</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-red-600 mb-2">
                      {quizState.results.totalQuestions - quizState.results.correctCount}
                    </div>
                    <div className="text-muted-foreground">Incorrect Answers</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Review Incorrect Answers */}
            {quizState.results.incorrectAnswers && quizState.results.incorrectAnswers.length > 0 && (
              <Card className="mb-8">
                <CardContent className="p-8">
                  <h4 className="text-xl font-bold mb-6">Review Incorrect Answers</h4>
                  
                  <div className="space-y-6">
                    {quizState.results.incorrectAnswers.map((item: any, index: number) => (
                      <div key={index} className="border border-red-200 dark:border-red-800 rounded-lg p-6 bg-red-50 dark:bg-red-900/10">
                        <div className="flex items-start space-x-3 mb-4">
                          <div className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0 mt-1">
                            {quizState.quiz?.questions.findIndex(q => q.id === item.question.id) + 1}
                          </div>
                          <p className="font-medium">{item.question.question}</p>
                        </div>
                        <div className="ml-9 space-y-3">
                          <div className="text-sm">
                            <span className="text-red-600 font-medium">Your answer:</span>
                            <span className="text-muted-foreground ml-2">
                              {item.question.options[item.userAnswer]}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="text-green-600 font-medium">Correct answer:</span>
                            <span className="text-muted-foreground ml-2">
                              {item.question.options[item.correctAnswer]}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground bg-background p-3 rounded border-l-4 border-green-500">
                            <strong>Explanation:</strong> {item.question.explanation}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={handleRetakeQuiz}
                className="flex-1 py-3 text-lg font-semibold"
                size="lg"
              >
                <RotateCcw className="mr-2 h-5 w-5" />
                Retake Quiz
              </Button>
              <Button
                variant="outline"
                onClick={handleUploadNewDocument}
                className="flex-1 py-3 text-lg font-semibold"
                size="lg"
              >
                <UploadIcon className="mr-2 h-5 w-5" />
                Upload New Document
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t bg-muted/50">
        <div className="max-w-4xl mx-auto px-4 py-8 text-center">
          <p className="text-muted-foreground text-sm">
            Powered by AI • Built for learners • © 2024 inQuizzes
          </p>
        </div>
      </footer>
    </div>
  );
}
