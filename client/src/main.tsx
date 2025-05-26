import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Set document title
document.title = "inQuizzes - Document-Based Quiz Generator";

// Add meta description
const metaDescription = document.createElement('meta');
metaDescription.name = 'description';
metaDescription.content = 'Transform your PDF documents into intelligent quizzes with AI. Upload, generate, and test your understanding with personalized questions and explanations.';
document.head.appendChild(metaDescription);

createRoot(document.getElementById("root")!).render(<App />);
