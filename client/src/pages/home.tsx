import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTheme } from "@/components/theme-provider";
import { generateQuiz, submitQuizAttempt, type QuizGenerationProgress } from "@/lib/deepseek";
import { Brain, Sun, Moon, ChevronLeft, ChevronRight, Trophy, RotateCcw, CheckCircle, XCircle, AlertCircle, FileText } from "lucide-react";
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
  const [textContent, setTextContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
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

  const handleGenerateQuiz = async () => {
    if (!textContent.trim() || textContent.length < 100) {
      setError('Please provide at least 100 characters of text content.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress(null);

    try {
      const quiz = await generateQuiz({
        content: textContent.trim(),
        fileName: fileName || 'Text Content',
        fileSize: textContent.length,
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

  const handleStartOver = () => {
    setTextContent('');
    setFileName('');
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
              Turn Text Content into <span className="text-primary">Smart Quizzes</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Paste your study material and generate AI-powered quizzes to test your understanding. Perfect for students, professionals, and lifelong learners.
            </p>
          </div>
        )}

        {/* Content Input Section */}
        {!quizState.quiz && !quizState.showResults && (
          <Card className="mb-8">
            <CardContent className="p-8">
              {/* Document Name Input */}
              <div className="mb-6">
                <Label htmlFor="fileName" className="text-sm font-medium mb-2 block">
                  Document Name (Optional)
                </Label>
                <Input
                  id="fileName"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="e.g., Chapter 5: Photosynthesis"
                  className="w-full"
                />
              </div>

              {/* Text Content Input */}
              <div className="mb-8">
                <Label htmlFor="textContent" className="text-sm font-medium mb-2 block">
                  Text Content <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="textContent"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Paste your study material here (minimum 100 characters)..."
                  className="min-h-[200px] w-full resize-y"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Characters: {textContent.length} / 100 minimum
                </p>
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
                disabled={!textContent.trim() || textContent.length < 100 || isGenerating}
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
                  <Button onClick={handleStartOver} variant="outline" className="flex items-center space-x-2">
                    <FileText className="h-4 w-4" />
                    <span>New Quiz</span>
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