import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/components/theme-provider";
import { processPDFFile, type ProcessedDocument } from "@/lib/pdf-processor";
import { generateQuiz, submitQuizAttempt, type QuizGenerationProgress } from "@/lib/deepseek";
import { Brain, Sun, Moon, Upload, FileText, ChevronLeft, ChevronRight, Trophy, RotateCcw, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import type { Quiz } from "@shared/schema";

interface QuizState {
  quiz: Quiz | null;
  currentQuestionIndex: number;
  userAnswers: Map<string, number>;
  showResults: boolean;
  results: any;
}

export default function Home() {
  const { theme, setTheme } = useTheme();
  const [document, setDocument] = useState<ProcessedDocument | null>(null);
  const [questionCount, setQuestionCount] = useState([25]);
  const [isProcessing, setIsProcessing] = useState(false);
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

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file only.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError('File size must be less than 15MB.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const processedDoc = await processPDFFile(file);
      setDocument(processedDoc);
    } catch (error) {
      console.error('PDF processing error:', error);
      setError(error instanceof Error ? error.message : 'Failed to process PDF file.');
    } finally {
      setIsProcessing(false);
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
    if (!document) return;

    setIsGenerating(true);
    setError(null);
    setProgress(null);

    try {
      const quiz = await generateQuiz({
        content: document.content,
        fileName: document.fileName,
        fileSize: document.fileSize,
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
      console.error('Quiz generation error:', error);
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
      console.error('Quiz submission error:', error);
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
    setDocument(null);
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
        {!document && !quizState.quiz && !quizState.showResults && (
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
        {!document && !quizState.quiz && !quizState.showResults && (
          <Card className="mb-8">
            <CardContent className="p-8">
              {/* File Upload Zone */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors mb-8 ${
                  isDragActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted-foreground/25 hover:border-primary'
                }`}
              >
                <input {...getInputProps()} />
                
                <div className="space-y-4">
                  <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                    {isProcessing ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    ) : (
                      <Upload className="text-2xl text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    {isProcessing ? (
                      <p className="text-lg font-medium mb-2">Processing PDF...</p>
                    ) : (
                      <>
                        <p className="text-lg font-medium mb-2">
                          {isDragActive ? "Drop your PDF here" : "Drop your PDF here"}
                        </p>
                        <p className="text-muted-foreground">
                          or <span className="text-primary font-medium">browse files</span>
                        </p>
                      </>
                    )}
                    <p className="text-sm text-muted-foreground mt-2">PDF only • Max 15MB</p>
                  </div>
                </div>
              </div>

              {error && (
                <Alert className="mb-8 border-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-destructive">
                    {error}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Document Processed Section */}
        {document && !quizState.quiz && !quizState.showResults && (
          <Card className="mb-8">
            <CardContent className="p-8">
              {/* Document Info */}
              <div className="flex items-center space-x-4 mb-8">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <FileText className="text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{document.fileName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {(document.fileSize / (1024 * 1024)).toFixed(1)} MB • {document.pageCount} pages
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleUploadNewDocument}
                  className="flex items-center space-x-2"
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload New</span>
                </Button>
              </div>

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
                disabled={isGenerating}
                className="w-full py-4 text-lg font-semibold"
                size="lg"
              >
                {isGenerating ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground"></div>
                    <span>Generating Quiz...</span>
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

              {error && (
                <Alert className="mt-4 border-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-destructive">
                    {error}
                  </AlertDescription>
                </Alert>
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
              <CardContent className="p-8 text-center">
                <div className="text-6xl font-bold text-primary mb-4">
                  {quizState.results.score}%
                </div>
                <p className="text-xl mb-4">
                  {quizState.results.correctCount} out of {quizState.results.totalQuestions} correct
                </p>
                <div className="flex justify-center space-x-4">
                  <Button onClick={handleRetakeQuiz} className="flex items-center space-x-2">
                    <RotateCcw className="h-4 w-4" />
                    <span>Retake Quiz</span>
                  </Button>
                  <Button onClick={handleUploadNewDocument} variant="outline" className="flex items-center space-x-2">
                    <Upload className="h-4 w-4" />
                    <span>New Document</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Incorrect Answers Review */}
            {quizState.results.incorrectAnswers && quizState.results.incorrectAnswers.length > 0 && (
              <Card>
                <CardContent className="p-8">
                  <h4 className="text-xl font-semibold mb-6">Review Incorrect Answers</h4>
                  <div className="space-y-6">
                    {quizState.results.incorrectAnswers.map((item: any, index: number) => (
                      <div key={index} className="border rounded-lg p-6">
                        <p className="font-medium mb-4">{item.question.question}</p>
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center space-x-2">
                            <XCircle className="h-4 w-4 text-destructive" />
                            <span className="text-sm">Your answer: {item.question.options[item.userAnswer]}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-sm">Correct answer: {item.question.options[item.correctAnswer]}</span>
                          </div>
                        </div>
                        <div className="bg-muted p-4 rounded-lg">
                          <p className="text-sm text-muted-foreground mb-1">Explanation:</p>
                          <p className="text-sm">{item.question.explanation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}