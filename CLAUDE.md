# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is an English vocabulary testing application with a full-stack architecture:

- **Frontend**: React application (Create React App) in `/frontend/` directory
- **Backend**: Node.js/Express server in `/backend/` directory with SQLite database
- **Speech Synthesis**: Python script using gTTS (Google Text-to-Speech) for audio playback

The application allows users to upload word lists, take vocabulary tests in multiple formats (multiple choice English-to-Chinese, Chinese-to-English, or spelling), track performance history, and review mistakes.

## Development Commands

### Frontend (React)
```bash
cd frontend
npm start          # Run development server (localhost:3000)
npm test           # Run tests
npm run build      # Build for production
```

### Backend (Node.js/Express)
```bash
cd backend
node server.js     # Start backend server (localhost:3001)
```

### Python Dependencies
```bash
cd backend
pip install -r requirements.txt    # Install Python dependencies (gTTS)
```

## Key Technical Details

### Database Schema
SQLite database (`backend/database.db`) with three main tables:
- `words`: Stores vocabulary with word, part_of_speech, translation, and test_count
- `tests`: Stores test results with scores and timestamps
- `mistakes`: Tracks incorrect answers linked to words and tests

### File Upload Format
Word lists should be uploaded as .txt files with format: `word part_of_speech translation` (space-separated)
Example: `apple n. 蘋果`

### API Endpoints
- Backend runs on port 3001
- Key endpoints include `/api/upload`, `/api/start-test`, `/api/submit-test`, `/api/history`, `/api/mistakes`
- Speech synthesis via `/api/synthesize-speech` using Python gTTS script

### Test Types
- Multiple choice English-to-Chinese (`mc_eng_to_chi`)
- Multiple choice Chinese-to-English (`mc_chi_to_eng`) 
- Spelling tests (`spelling`) with audio pronunciation

The application uses Bootstrap for styling and Chart.js for displaying performance history graphs.