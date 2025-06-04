# inQuizzes - AI-Powered Document Quiz Generator

An intelligent web application that transforms PDF documents into comprehensive quizzes using advanced AI technology.

## Features

- **PDF Upload & Processing**: Upload documents up to 15MB with automatic text extraction
- **AI-Powered Quiz Generation**: Creates intelligent multiple-choice questions using Claude 3.5 Sonnet
- **Interactive Quiz Interface**: Clean, responsive design with real-time scoring
- **Automatic Cleanup**: Files automatically deleted after 6 hours
- **Dark/Light Theme**: Toggle between themes for optimal user experience
- **Database Persistence**: PostgreSQL storage for quizzes and results

## Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Radix UI
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI Processing**: OpenRouter API with Claude 3.5 Sonnet
- **PDF Processing**: pdf2json library
- **Containerization**: Docker & Docker Compose

## Quick Start with Docker

### Prerequisites

- Docker and Docker Compose installed
- OpenRouter API key

### 1. Clone and Setup

```bash
git clone <repository-url>
cd inquizzes
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
DATABASE_URL=postgresql://inquizzes:password@db:5432/inquizzes
```

### 3. Deploy with Docker Compose

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The application will be available at `http://localhost:5000`

### 4. Database Setup

The database will be automatically initialized. If you need to run migrations:

```bash
docker-compose exec app npm run db:push
```

## Manual Docker Build

### Build the Image

```bash
docker build -t inquizzes .
```

### Run with External Database

```bash
docker run -d \
  --name inquizzes-app \
  -p 5000:5000 \
  -e DATABASE_URL="your_postgres_connection_string" \
  -e OPENROUTER_API_KEY="your_api_key" \
  inquizzes
```

## Development Setup

### Prerequisites

- Node.js 20+
- PostgreSQL database
- OpenRouter API key

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npm run db:push

# Start development server
npm run dev
```

## API Endpoints

- `GET /api/health` - Health check endpoint
- `POST /api/process-pdf` - Upload and process PDF files
- `POST /api/generate-quiz` - Generate quiz from processed content
- `GET /api/quiz/:id` - Retrieve quiz by ID
- `POST /api/quiz/:id/submit` - Submit quiz answers

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI processing | Yes |
| `NODE_ENV` | Environment mode (development/production) | No |
| `PORT` | Server port (default: 5000) | No |

## Production Deployment

### Docker Compose (Recommended)

1. Update the `docker-compose.yml` file with your production settings
2. Use a proper PostgreSQL password and database configuration
3. Configure reverse proxy (nginx/traefik) for HTTPS
4. Set up persistent volumes for database data

### Security Considerations

- Change default database passwords
- Use environment-specific API keys
- Configure firewall rules
- Enable HTTPS with SSL certificates
- Set up monitoring and logging

## File Structure

```
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Application pages
│   │   └── lib/         # Utility functions
├── server/              # Express backend
│   ├── index.ts         # Server entry point
│   ├── routes.ts        # API routes
│   ├── storage.ts       # Database layer
│   └── db.ts            # Database connection
├── shared/              # Shared types and schemas
├── Dockerfile           # Container configuration
├── docker-compose.yml   # Multi-service setup
└── package.json         # Dependencies and scripts
```

## Troubleshooting

### Common Issues

1. **PDF Upload Fails**: Check file size (max 15MB) and format (PDF only)
2. **Quiz Generation Errors**: Verify OpenRouter API key is valid
3. **Database Connection**: Ensure PostgreSQL is running and credentials are correct
4. **Port Conflicts**: Change port in docker-compose.yml if 5000 is in use

### Logs

```bash
# View application logs
docker-compose logs app

# View database logs
docker-compose logs db

# Follow logs in real-time
docker-compose logs -f
```

## License

MIT License - see LICENSE file for details