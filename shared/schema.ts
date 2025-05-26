import { pgTable, text, serial, integer, boolean, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

export const quizzes = pgTable("quizzes", {
  id: serial("id").primaryKey(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  content: text("content").notNull(),
  questionCount: integer("question_count").notNull(),
  questions: json("questions").$type<QuizQuestion[]>().notNull(),
  createdAt: text("created_at").notNull(),
});

export const quizAttempts = pgTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull(),
  answers: json("answers").$type<UserAnswer[]>().notNull(),
  score: integer("score").notNull(),
  completedAt: text("completed_at").notNull(),
});

// Define relations
export const quizzesRelations = relations(quizzes, ({ many }) => ({
  attempts: many(quizAttempts),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [quizAttempts.quizId],
    references: [quizzes.id],
  }),
}));

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface UserAnswer {
  questionId: string;
  selectedAnswer: number;
  isCorrect: boolean;
}

export const insertQuizSchema = createInsertSchema(quizzes).omit({
  id: true,
});

export const insertQuizAttemptSchema = createInsertSchema(quizAttempts).omit({
  id: true,
});

export type InsertQuiz = z.infer<typeof insertQuizSchema>;
export type Quiz = typeof quizzes.$inferSelect;
export type InsertQuizAttempt = z.infer<typeof insertQuizAttemptSchema>;
export type QuizAttempt = typeof quizAttempts.$inferSelect;

// Users table (keeping existing schema)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
