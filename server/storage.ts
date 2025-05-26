import { quizzes, quizAttempts, type Quiz, type InsertQuiz, type QuizAttempt, type InsertQuizAttempt, users, type User, type InsertUser } from "@shared/schema";
import { db } from "./db";
import { eq, sql, lt } from "drizzle-orm";

export interface IStorage {
  // Quiz operations
  createQuiz(quiz: InsertQuiz): Promise<Quiz>;
  getQuiz(id: number): Promise<Quiz | undefined>;
  cleanupOldQuizzes(): Promise<void>;
  
  // Quiz attempt operations
  createQuizAttempt(attempt: InsertQuizAttempt): Promise<QuizAttempt>;
  getQuizAttempt(id: number): Promise<QuizAttempt | undefined>;
  
  // User operations (existing)
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createQuiz(insertQuiz: InsertQuiz): Promise<Quiz> {
    // Clean up old quizzes before creating a new one
    await this.cleanupOldQuizzes();
    
    const [quiz] = await db
      .insert(quizzes)
      .values({
        ...insertQuiz,
        createdAt: new Date().toISOString(),
      })
      .returning();
    return quiz;
  }

  async getQuiz(id: number): Promise<Quiz | undefined> {
    const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, id));
    return quiz || undefined;
  }

  async cleanupOldQuizzes(): Promise<void> {
    // Delete quizzes older than 6 hours (6 * 60 * 60 * 1000 = 21600000 ms)
    const sixHoursAgo = new Date(Date.now() - 21600000).toISOString();
    
    // First delete associated quiz attempts
    await db.delete(quizAttempts).where(
      sql`${quizAttempts.quizId} IN (
        SELECT ${quizzes.id} FROM ${quizzes} 
        WHERE ${quizzes.createdAt} < ${sixHoursAgo}
      )`
    );
    
    // Then delete the old quizzes
    await db.delete(quizzes).where(lt(quizzes.createdAt, sixHoursAgo));
  }

  async createQuizAttempt(insertAttempt: InsertQuizAttempt): Promise<QuizAttempt> {
    const [attempt] = await db
      .insert(quizAttempts)
      .values({
        ...insertAttempt,
        completedAt: new Date().toISOString(),
      })
      .returning();
    return attempt;
  }

  async getQuizAttempt(id: number): Promise<QuizAttempt | undefined> {
    const [attempt] = await db.select().from(quizAttempts).where(eq(quizAttempts.id, id));
    return attempt || undefined;
  }
}

export const storage = new DatabaseStorage();
