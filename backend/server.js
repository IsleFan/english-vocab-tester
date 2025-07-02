const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const port = 3001;

const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

// Serve static files from the React build
app.use(express.static(path.join(__dirname, '../frontend/build')));

// --- Database Initialization ---
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the SQLite database.');
});

// Utility function to shuffle an array
const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

db.serialize(() => {
    // Create words table
    db.run(`CREATE TABLE IF NOT EXISTS words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT NOT NULL UNIQUE,
        part_of_speech TEXT,
        translation TEXT,
        test_count INTEGER DEFAULT 0,
        mistake_count INTEGER DEFAULT 0
    )`, (err) => {
        if (err) {
            console.error("Error creating words table:", err);
        } else {
            // Check if columns exist, if not, add them
            db.all("PRAGMA table_info(words)", (err, columns) => {
                if (err) {
                    console.error("Error getting table info:", err);
                    return;
                }
                
                const hasPartOfSpeech = columns.some(col => col.name === 'part_of_speech');
                const hasTranslation = columns.some(col => col.name === 'translation');
                const hasMistakeCount = columns.some(col => col.name === 'mistake_count');
                
                if (!hasPartOfSpeech) {
                    db.run('ALTER TABLE words ADD COLUMN part_of_speech TEXT', (alterErr) => {
                        if (alterErr) console.error("Error adding part_of_speech column:", alterErr);
                        else console.log("Added part_of_speech column to words table");
                    });
                }
                
                if (!hasTranslation) {
                    db.run('ALTER TABLE words ADD COLUMN translation TEXT', (alterErr) => {
                        if (alterErr) console.error("Error adding translation column:", alterErr);
                        else console.log("Added translation column to words table");
                    });
                }
                
                if (!hasMistakeCount) {
                    db.run('ALTER TABLE words ADD COLUMN mistake_count INTEGER DEFAULT 0', (alterErr) => {
                        if (alterErr) console.error("Error adding mistake_count column:", alterErr);
                        else console.log("Added mistake_count column to words table");
                    });
                }
            });
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error("Error creating users table:", err);
        } else {
            // Check if role column exists, if not, add it
            db.all("PRAGMA table_info(users)", (err, columns) => {
                if (err) {
                    console.error("Error getting users table info:", err);
                    return;
                }
                
                const hasRole = columns.some(col => col.name === 'role');
                
                if (!hasRole) {
                    db.run('ALTER TABLE users ADD COLUMN role TEXT DEFAULT "user"', (alterErr) => {
                        if (alterErr) console.error("Error adding role column:", alterErr);
                        else {
                            console.log("Added role column to users table");
                            // Set admin role for admin user if exists
                            db.run('UPDATE users SET role = "admin" WHERE username = "admin"', (updateErr) => {
                                if (updateErr) console.error("Error setting admin role:", updateErr);
                                else console.log("Set admin role for admin user");
                            });
                        }
                    });
                }
            });
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS tests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        test_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        score INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`, (err) => {
        if (err) {
            console.error("Error creating tests table:", err);
        } else {
            // Check if user_id column exists, if not, add it
            db.all("PRAGMA table_info(tests)", (err, columns) => {
                if (err) {
                    console.error("Error getting tests table info:", err);
                    return;
                }
                
                const hasUserId = columns.some(col => col.name === 'user_id');
                
                if (!hasUserId) {
                    db.run('ALTER TABLE tests ADD COLUMN user_id INTEGER', (alterErr) => {
                        if (alterErr) console.error("Error adding user_id column:", alterErr);
                        else console.log("Added user_id column to tests table");
                    });
                }
            });
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS mistakes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word_id INTEGER,
        test_id INTEGER,
        FOREIGN KEY (word_id) REFERENCES words (id),
        FOREIGN KEY (test_id) REFERENCES tests (id)
    )`);
});


// --- API Endpoints ---

// Admin permission check middleware
const checkAdmin = (req, res, next) => {
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(401).json({ error: 'User ID is required' });
    }
    
    db.get("SELECT role FROM users WHERE id = ?", [userId], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        next();
    });
};

// Upload word list with translations (Admin only)
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    
    // Check admin permission
    const { userId } = req.body;
    if (!userId) {
        return res.status(401).json({ error: 'User ID is required' });
    }
    
    db.get("SELECT role FROM users WHERE id = ?", [userId], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        // Continue with upload if admin
        const filePath = req.file.path;
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                return res.status(500).send('Error reading file.');
            }

            const lines = data.split(/\r?\n/).filter(line => line.length > 0);
            const stmt = db.prepare("INSERT OR IGNORE INTO words (word, part_of_speech, translation) VALUES (?, ?, ?)");
            let count = 0;

            lines.forEach(line => {
                const parts = line.split(' '); // Split by space
                if (parts.length >= 3) {
                    const word = parts[0].trim();
                    const part_of_speech = parts[1].trim();
                    const translation = parts.slice(2).join(' ').trim();
                    if (word && part_of_speech && translation) {
                        stmt.run(word, part_of_speech, translation);
                        count++;
                    }
                }
            });

            stmt.finalize((err) => {
                fs.unlinkSync(filePath); // Clean up uploaded file
                if (err) {
                    return res.status(500).send('Error saving words to database.');
                }
                res.send(`${count} words uploaded successfully.`);
            });
        });
    });
});

// Start a new test with smart word selection
app.post('/api/start-test', (req, res) => {
    const { from, to, type, count } = req.body;

    if (!from || !to || !type || !count || from > to || count <= 0) {
        return res.status(400).json({ error: 'Invalid test parameters.' });
    }

    // Check total available words in range first
    const countQuery = `SELECT COUNT(*) as total FROM words WHERE id BETWEEN ? AND ? AND translation IS NOT NULL`;
    db.get(countQuery, [from, to], (err, countResult) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const availableWords = countResult.total;
        if (availableWords < count) {
            return res.status(400).json({ 
                error: `Not enough words in the selected range (${from}-${to}). Only found ${availableWords} words, need ${count}.` 
            });
        }

        // Calculate how many mistake words (up to 20%) and new words to select
        const idealMistakeWordsCount = Math.floor(count * 0.2);
        
        // First, get available mistake words (ordered by error rate, highest first)
        const mistakeQuery = `
            SELECT id, word, part_of_speech, translation, mistake_count, test_count,
                   CASE WHEN test_count > 0 THEN CAST(mistake_count AS REAL) / test_count ELSE 0 END as error_rate
            FROM words 
            WHERE id BETWEEN ? AND ? AND mistake_count > 0 AND translation IS NOT NULL
            ORDER BY error_rate DESC, mistake_count DESC, RANDOM()
            LIMIT ?`;
        
        db.all(mistakeQuery, [from, to, idealMistakeWordsCount], (err, mistakeWords) => {
            if (err) return res.status(500).json({ error: err.message });
            
            const actualMistakeWordsCount = mistakeWords.length;
            const newWordsCount = count - actualMistakeWordsCount;
            
            const selectedIds = mistakeWords.map(w => w.id);
            const excludeIds = selectedIds.length > 0 ? `AND id NOT IN (${selectedIds.join(',')})` : '';
            
            // Then get remaining words (prioritize less tested words)
            const newWordsQuery = `
                SELECT id, word, part_of_speech, translation, mistake_count, test_count
                FROM words 
                WHERE id BETWEEN ? AND ? AND translation IS NOT NULL ${excludeIds}
                ORDER BY test_count ASC, RANDOM()
                LIMIT ?`;
            
            db.all(newWordsQuery, [from, to, newWordsCount], (err, newWords) => {
                if (err) return res.status(500).json({ error: err.message });
                
                const allWords = [...mistakeWords, ...newWords];
                if (allWords.length < count) {
                    return res.status(400).json({ 
                        error: `Not enough words available. Only found ${allWords.length} words, need ${count}.` 
                    });
                }
            
            // Shuffle the final word list
            const shuffledWords = shuffleArray(allWords);

            if (type === 'mc_eng_to_chi' || type === 'mc_chi_to_eng') {
                db.all("SELECT word, translation FROM words", [], (err, allWordsForOptions) => {
                    if (err) return res.status(500).json({ error: err.message });

                    const questions = shuffledWords.map(w => {
                        let questionText, correctAnswer, options;
                        
                        if (type === 'mc_eng_to_chi') {
                            questionText = `${w.word} (${w.part_of_speech})`;
                            correctAnswer = w.translation;
                            options = allWordsForOptions
                                .filter(opt => opt.translation !== correctAnswer)
                                .map(opt => opt.translation);
                        } else { // mc_chi_to_eng
                            questionText = w.translation;
                            correctAnswer = w.word;
                            options = allWordsForOptions
                                .filter(opt => opt.word !== correctAnswer)
                                .map(opt => opt.word);
                        }
                        
                        const wrongOptions = shuffleArray(options).slice(0, 3);
                        const finalOptions = shuffleArray([...wrongOptions, correctAnswer]);

                        return {
                            word_id: w.id,
                            question: questionText,
                            options: finalOptions,
                            answer: correctAnswer
                        };
                    });
                    res.json(questions);
                });
            } else { // spelling
                const questions = shuffledWords.map(w => ({
                    word_id: w.id,
                    question: w.translation, // Question is the Chinese meaning
                    answer: w.word
                }));
                res.json(questions);
            }
        });
    });
    });
});

// Submit test results
app.post('/api/submit-test', (req, res) => {
    const { score, questions, userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    
    db.run("INSERT INTO tests (score, user_id) VALUES (?, ?)", [score, userId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        const testId = this.lastID;
        const mistakes = questions.filter(q => !q.isCorrect);
        
        const mistakeStmt = db.prepare("INSERT INTO mistakes (word_id, test_id) VALUES (?, ?)");
        mistakes.forEach(m => mistakeStmt.run(m.word_id, testId));
        mistakeStmt.finalize();

        const updateCountStmt = db.prepare("UPDATE words SET test_count = test_count + 1 WHERE id = ?");
        questions.forEach(q => updateCountStmt.run(q.word_id));
        updateCountStmt.finalize();

        const updateMistakeStmt = db.prepare("UPDATE words SET mistake_count = mistake_count + 1 WHERE id = ?");
        mistakes.forEach(m => updateMistakeStmt.run(m.word_id));
        updateMistakeStmt.finalize();

        res.json({ message: 'Test results saved successfully.', testId: testId });
    });
});

// User login/register
app.post('/api/login', (req, res) => {
    const { username } = req.body;
    
    if (!username || username.trim() === '') {
        return res.status(400).json({ error: 'Username is required' });
    }
    
    const trimmedUsername = username.trim();
    
    // Check if user exists, if not create new user
    db.get("SELECT * FROM users WHERE username = ?", [trimmedUsername], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (user) {
            // User exists, return user info
            res.json({ 
                message: 'Login successful', 
                user: { 
                    id: user.id, 
                    username: user.username, 
                    role: user.role || 'user',
                    isAdmin: user.role === 'admin' 
                }
            });
        } else {
            // Create new user
            const role = trimmedUsername === 'admin' ? 'admin' : 'user';
            db.run("INSERT INTO users (username, role) VALUES (?, ?)", [trimmedUsername, role], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                
                res.json({ 
                    message: 'User created and logged in', 
                    user: { 
                        id: this.lastID, 
                        username: trimmedUsername, 
                        role: role,
                        isAdmin: role === 'admin'
                    }
                });
            });
        }
    });
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
    const query = `
        SELECT u.username, 
               COUNT(t.id) as total_tests,
               AVG(t.score) as avg_score,
               MAX(t.score) as best_score,
               SUM(t.score) as total_score
        FROM users u
        LEFT JOIN tests t ON u.id = t.user_id
        GROUP BY u.id, u.username
        HAVING COUNT(t.id) > 0
        ORDER BY avg_score DESC, best_score DESC, total_tests DESC
        LIMIT 20
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const leaderboard = rows.map((row, index) => ({
            rank: index + 1,
            username: row.username,
            totalTests: row.total_tests,
            avgScore: Math.round(row.avg_score),
            bestScore: row.best_score,
            totalScore: row.total_score
        }));
        
        res.json(leaderboard);
    });
});

// Clear the word library (Admin only)
app.post('/api/words/clear', (req, res) => {
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(401).json({ error: 'User ID is required' });
    }
    
    db.get("SELECT role FROM users WHERE id = ?", [userId], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        // Continue with clearing if admin
        db.serialize(() => {
            db.run("DELETE FROM words", (err) => {
                if (err) return res.status(500).json({ error: err.message });
            });
            db.run("DELETE FROM sqlite_sequence WHERE name='words'", (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Word library cleared successfully.' });
            });
        });
    });
});

// Get test history for current user
app.get('/api/history', (req, res) => {
    const userId = req.query.userId;
    
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    
    db.all("SELECT * FROM tests WHERE user_id = ? ORDER BY test_date DESC", [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get test options (word count)
app.get('/api/test-options', (req, res) => {
    db.get("SELECT COUNT(*) as wordCount FROM words", [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ wordCount: row.wordCount });
    });
});

// Get mistakes ordered by error rate (top 100)
app.get('/api/mistakes', (req, res) => {
    const query = `
        SELECT w.id, w.word, w.translation, w.mistake_count, w.test_count,
               CASE WHEN w.test_count > 0 THEN CAST(w.mistake_count AS REAL) / w.test_count ELSE 0 END as error_rate
        FROM words w
        WHERE w.mistake_count > 0
        ORDER BY error_rate DESC, mistake_count DESC, word ASC
        LIMIT 100
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Start a test with all mistakes
app.post('/api/start-mistake-test', (req, res) => {
    const { type } = req.body; // Only need the type

    const mistakeQuery = `SELECT DISTINCT word_id FROM mistakes`;
    db.all(mistakeQuery, [], (err, mistakeRows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (mistakeRows.length === 0) return res.status(400).json({ error: 'No mistakes to test!' });

        const wordIds = mistakeRows.map(r => r.word_id);
        const query = `SELECT id, word, part_of_speech, translation FROM words WHERE id IN (${wordIds.join(',')})`;

        db.all(query, [], (err, words) => {
            if (err) return res.status(500).json({ error: err.message });
            
            // The rest of the logic is similar to the regular test
            if (type === 'mc_eng_to_chi' || type === 'mc_chi_to_eng') {
                db.all("SELECT word, translation FROM words", [], (err, allWords) => {
                    if (err) return res.status(500).json({ error: err.message });

                    const questions = words.map(w => {
                        let questionText, correctAnswer, options;
                        
                        if (type === 'mc_eng_to_chi') {
                            questionText = `${w.word} (${w.part_of_speech})`;
                            correctAnswer = w.translation;
                            options = allWords.filter(opt => opt.translation !== correctAnswer).map(opt => opt.translation);
                        } else {
                            questionText = w.translation;
                            correctAnswer = w.word;
                            options = allWords.filter(opt => opt.word !== correctAnswer).map(opt => opt.word);
                        }
                        
                        const wrongOptions = shuffleArray(options).slice(0, 3);
                        const finalOptions = shuffleArray([...wrongOptions, correctAnswer]);

                        return { word_id: w.id, question: questionText, options: finalOptions, answer: correctAnswer };
                    });
                    res.json(shuffleArray(questions));
                });
            } else { // spelling
                const questions = words.map(w => ({
                    word_id: w.id,
                    question: w.translation,
                    answer: w.word
                }));
                res.json(shuffleArray(questions));
            }
        });
    });
});


// Speech synthesis endpoint
app.get('/api/synthesize-speech', (req, res) => {
    const { text, lang } = req.query;

    console.log(`[Backend] Received speech synthesis request: text="${text}", lang="${lang}"`);

    if (!text || !lang) {
        console.error('[Backend] Missing text or language for speech synthesis.');
        return res.status(400).json({ error: 'Text and language are required.' });
    }

    const pythonProcess = spawn('python3', ['gtts_synthesize.py', text, lang], { cwd: __dirname });
    let tempFilePath = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
        tempFilePath += data.toString().trim();
    });

    pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
    });

    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`gTTS script exited with code ${code}: ${errorOutput}`);
            return res.status(500).json({ error: 'Failed to synthesize speech.', details: errorOutput });
        }

        if (!tempFilePath || !fs.existsSync(tempFilePath)) {
            console.error('gTTS script did not return a valid file path or file does not exist:', tempFilePath);
            return res.status(500).json({ error: 'Failed to synthesize speech: no audio file generated.' });
        }

        res.set({'Content-Type': 'audio/mpeg'});
        const readStream = fs.createReadStream(tempFilePath);
        readStream.pipe(res);

        readStream.on('end', () => {
            fs.unlink(tempFilePath, (err) => {
                if (err) console.error('Error deleting temporary audio file:', err);
            });
        });

        readStream.on('error', (err) => {
            console.error('Error streaming audio file:', err);
            res.status(500).json({ error: 'Error streaming audio file.' });
            fs.unlink(tempFilePath, (err) => {
                if (err) console.error('Error deleting temporary audio file after stream error:', err);
            });
        });
    });

    pythonProcess.on('error', (err) => {
        console.error('Failed to start gTTS python process:', err);
        res.status(500).json({ error: 'Failed to start speech synthesis process.' });
    });
});

// Serve React app for all non-API routes (must be after all API routes)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

// --- Server Start ---
app.listen(port, '0.0.0.0', () => {
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    
    console.log(`Backend server listening at http://0.0.0.0:${port}`);
    console.log(`Local access: http://localhost:${port}`);
    
    // Find and display all network IP addresses
    Object.keys(networkInterfaces).forEach(interfaceName => {
        networkInterfaces[interfaceName].forEach(iface => {
            if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`Network access: http://${iface.address}:${port}`);
            }
        });
    });
});