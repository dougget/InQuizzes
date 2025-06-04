# inQuizzes

Upload your PDF documents and let AI generate a quiz for you!

**inQuizzes is designed to help students test their knowledge based on their own documents.**

---

## Screenshot

![inQuizzes Screenshot](./attached_assets/Screenshot.png)

---

## Features
- Upload PDF documents (up to 15MB)
- AI generates intelligent multiple-choice questions
- Adjustable number of questions (1-50)
- Interactive quiz interface with scoring and explanations
- Dark/light theme support
- Automatic file cleanup.

---

## Getting Started

### Prerequisites
- [Docker](https://www.docker.com/) installed on your machine
- [OpenRouter API Key](https://openrouter.ai/)

### Running with Docker
1. Clone this repository:
   ```bash
   git clone <repo-url>
   cd inquizzes
   ```
2. Create a `.env` file with your OpenRouter API key:
   ```bash
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   ```   
3. Start the application:
   ```bash
   docker-compose up -d
   ```
4. Open your browser and go to [http://localhost:5000](http://localhost:5000)

### Manual Docker Build
```bash
docker build -t inquizzes .
docker run -p 5000:5000 -e OPENROUTER_API_KEY=your_key inquizzes
```

---

## Technical Details
- Built with React, TypeScript, Node.js, and PostgreSQL
- PDF processing with pdf2json library
- AI-powered quiz generation via OpenRouter API
- Supports PDF files up to 15MB

---

## Contributing
Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

---

## License
[MIT](./LICENSE)