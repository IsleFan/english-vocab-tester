import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);


function App() {
    // API base URL - automatically detects if accessing from mobile or desktop
    const API_BASE_URL = window.location.hostname === 'localhost' 
        ? 'http://localhost:3001' 
        : `http://${window.location.hostname}:3001`;

    // State variables
    const [view, setView] = useState('login'); // 'login', 'home', 'test', 'history', 'mistake-book', 'leaderboard'
    const [currentUser, setCurrentUser] = useState(null);
    const [file, setFile] = useState(null);
    const [uploadMessage, setUploadMessage] = useState('');
    const [wordCount, setWordCount] = useState(0);
    const [testOptions, setTestOptions] = useState({ from: 1, to: 1945, count: 10, type: 'mc_eng_to_chi' });
    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState('');
    const [results, setResults] = useState(null);
    const [history, setHistory] = useState([]);
    const [mistakes, setMistakes] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loginUsername, setLoginUsername] = useState('');

    const [audioPlayer, setAudioPlayer] = useState(new Audio());

    // --- Speech Synthesis ---
    const speak = useCallback(async (text, lang = 'en') => { // gTTS uses 'en' for English
        try {
            const response = await axios.get(`${API_BASE_URL}/api/synthesize-speech?text=${encodeURIComponent(text)}&lang=${lang}`, {
                responseType: 'blob' // Important for handling audio
            });
            const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
            const audioUrl = URL.createObjectURL(audioBlob);
            
            audioPlayer.src = audioUrl;
            const playPromise = audioPlayer.play();

            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error("Audio playback failed:", error);
                });
            }
        } catch (error) {
            console.error("Error synthesizing speech:", error);
        }
    }, [audioPlayer, API_BASE_URL]);

    // --- API Calls & Data Fetching ---
    const fetchTestOptions = useCallback(async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/test-options`);
            setWordCount(response.data.wordCount);
            setTestOptions(prev => ({ ...prev, to: response.data.wordCount > 0 ? response.data.wordCount : 100 }));
        } catch (error) { console.error('Error fetching test options:', error); }
    }, [API_BASE_URL]);

    const fetchHistory = useCallback(async () => {
        if (!currentUser) return;
        try {
            const response = await axios.get(`${API_BASE_URL}/api/history?userId=${currentUser.id}`);
            setHistory(response.data);
        } catch (error) { console.error('Error fetching history:', error); }
    }, [API_BASE_URL, currentUser]);

    const fetchMistakes = useCallback(async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/mistakes`);
            setMistakes(response.data);
        } catch (error) { console.error('Error fetching mistakes:', error); }
    }, [API_BASE_URL]);

    const fetchLeaderboard = useCallback(async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/leaderboard`);
            setLeaderboard(response.data);
        } catch (error) { console.error('Error fetching leaderboard:', error); }
    }, [API_BASE_URL]);
    
    useEffect(() => {
        // Always fetch leaderboard for login page
        fetchLeaderboard();
        
        if (currentUser) {
            fetchTestOptions();
            fetchHistory();
            fetchMistakes();
        }
    }, [currentUser, fetchTestOptions, fetchHistory, fetchMistakes, fetchLeaderboard]);

    // --- Event Handlers ---
    const handleLogin = async (username) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/api/login`, { username });
            setCurrentUser(response.data.user);
            setView('home');
        } catch (error) {
            console.error('Login error:', error);
            alert('登入失敗，請稍後再試');
        }
    };

    const handleLogout = () => {
        setCurrentUser(null);
        setView('login');
        setHistory([]);
        setMistakes([]);
        setLeaderboard([]);
    };

    const handleFileChange = (event) => setFile(event.target.files[0]);

    const handleUpload = async () => {
        if (!file) { setUploadMessage('Please select a file first.'); return; }
        if (!currentUser?.isAdmin) { setUploadMessage('管理員權限不足'); return; }
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', currentUser.id);
        
        try {
            const response = await axios.post(`${API_BASE_URL}/api/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            setUploadMessage(response.data);
            fetchTestOptions();
        } catch (error) {
            setUploadMessage(error.response?.data?.error || 'Error uploading file.');
            console.error('Error uploading file:', error);
        }
    };

    const handleStartTest = async (isMistakeTest = false) => {
        try {
            let response;
            if (isMistakeTest) {
                if (mistakes.length === 0) { alert("沒有錯題可以複習！"); return; }
                response = await axios.post(`${API_BASE_URL}/api/start-mistake-test`, { type: testOptions.type });
            } else {
                response = await axios.post(`${API_BASE_URL}/api/start-test`, testOptions);
            }
            setQuestions(response.data);
            setCurrentQuestionIndex(0);
            setResults(null);
            setUserAnswer('');
            setView('test');
        } catch (error) {
            console.error(`Error starting ${isMistakeTest ? 'mistake ' : ''}test:`, error);
            alert(error.response?.data?.error || 'Failed to start test.');
        }
    };

    const handleAnswerSubmit = useCallback((answer) => {
        const currentQuestion = questions[currentQuestionIndex];
        const isCorrect = answer.toLowerCase().trim() === currentQuestion.answer.toLowerCase().trim();
        
        const updatedQuestions = [...questions];
        updatedQuestions[currentQuestionIndex].userAnswer = answer;
        updatedQuestions[currentQuestionIndex].isCorrect = isCorrect;
        setQuestions(updatedQuestions);

        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
            setUserAnswer('');
        } else {
            const correctCount = updatedQuestions.filter(q => q.isCorrect).length;
            const score = Math.round((correctCount / questions.length) * 100);
            const finalResults = { score, questions: updatedQuestions, userId: currentUser.id };
            setResults(finalResults);
            
            axios.post(`${API_BASE_URL}/api/submit-test`, finalResults)
                .then(response => {
                    console.log(response.data.message);
                    fetchHistory();
                    fetchMistakes();
                    fetchLeaderboard();
                })
                .catch(error => console.error('Error saving test results:', error));
        }
    }, [questions, currentQuestionIndex, fetchHistory, fetchMistakes, fetchLeaderboard, currentUser, API_BASE_URL]);

    const handleClearWords = async () => {
        if (!currentUser?.isAdmin) { 
            setUploadMessage('管理員權限不足'); 
            return; 
        }
        
        if (window.confirm('確定要清空整個單字庫嗎？此操作無法復原。')) {
            try {
                const response = await axios.post(`${API_BASE_URL}/api/words/clear`, { userId: currentUser.id });
                setUploadMessage(response.data.message);
                fetchTestOptions();
            } catch (error) {
                setUploadMessage(error.response?.data?.error || '清空單字庫失敗。');
                console.error('Error clearing words:', error);
            }
        }
    };

    // --- Render Methods ---
    const renderLogin = () => {
        const handleSubmit = (e) => {
            e.preventDefault();
            if (loginUsername.trim()) {
                handleLogin(loginUsername.trim());
            }
        };

        return (
            <div className="row justify-content-center">
                <div className="col-md-6">
                    <div className="card">
                        <div className="card-body">
                            <h2 className="card-title text-center mb-4">登入系統</h2>
                            <form onSubmit={handleSubmit}>
                                <div className="mb-3">
                                    <label className="form-label">用戶名稱</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={loginUsername}
                                        onChange={(e) => setLoginUsername(e.target.value)}
                                        placeholder="請輸入您的用戶名稱"
                                        autoFocus
                                        required
                                    />
                                    <div className="form-text">
                                        如果是新用戶，系統會自動為您創建帳號
                                    </div>
                                </div>
                                <button type="submit" className="btn btn-primary w-100">
                                    登入 / 註冊
                                </button>
                            </form>
                        </div>
                    </div>
                    
                    {/* Leaderboard preview */}
                    {leaderboard.length > 0 && (
                        <div className="card mt-4">
                            <div className="card-body">
                                <h5 className="card-title">排行榜</h5>
                                <div className="table-responsive">
                                    <table className="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>排名</th>
                                                <th>用戶</th>
                                                <th>平均分數</th>
                                                <th>最高分數</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {leaderboard.slice(0, 5).map(user => (
                                                <tr key={user.username}>
                                                    <td>{user.rank}</td>
                                                    <td>{user.username}</td>
                                                    <td>{user.avgScore}%</td>
                                                    <td>{user.bestScore}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderNavbar = () => (
        <nav className="navbar navbar-expand-lg navbar-dark bg-primary mb-4">
            <div className="container-fluid">
                <span className="navbar-brand">英文單字考試軟體</span>
                <div className="navbar-nav ms-auto">
                    <span className="navbar-text me-3">
                        歡迎, {currentUser?.username}
                        {currentUser?.isAdmin && <span className="badge bg-warning text-dark ms-2">管理員</span>}
                    </span>
                    <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>
                        登出
                    </button>
                </div>
            </div>
        </nav>
    );

    const renderHome = () => (
        <>
            <div className="d-grid gap-3 mb-4">
                <button className="btn btn-primary btn-lg" onClick={() => handleStartTest(false)}>開始新測驗</button>
                <button className="btn btn-info btn-lg" onClick={() => setView('history')}>查看歷史成績</button>
                <button className="btn btn-warning btn-lg" onClick={() => setView('mistake-book')}>錯題本 ({mistakes.length}題)</button>
                <button className="btn btn-success btn-lg" onClick={() => setView('leaderboard')}>排行榜</button>
            </div>
            {currentUser?.isAdmin && (
                <div className="card mb-4"><div className="card-body">
                    <h5 className="card-title">單字庫管理 <span className="badge bg-warning">管理員專用</span></h5>
                    <p className="card-text">請選擇一個 .txt 檔案。檔案格式為每行一個單字，英文與中文翻譯用逗號分隔，例如: "apple,蘋果"</p>
                    <div className="input-group mb-3">
                        <input type="file" className="form-control" onChange={handleFileChange} accept=".txt" />
                        <button className="btn btn-secondary" onClick={handleUpload}>上傳</button>
                    </div>
                    <button className="btn btn-danger" onClick={handleClearWords}>清空單字庫</button>
                    {uploadMessage && <p className="mt-3">{uploadMessage}</p>}
                </div></div>
            )}
            <div className="card"><div className="card-body">
                <h5 className="card-title">測驗設定</h5>
                <p>目前單字庫總數: {wordCount}</p>
                <div className="row g-3">
                    <div className="col-md-6"><label className="form-label">範圍 (From)</label><input type="number" className="form-control" value={testOptions.from} onChange={e => setTestOptions({...testOptions, from: parseInt(e.target.value)})} /></div>
                    <div className="col-md-6"><label className="form-label">範圍 (To)</label><input type="number" className="form-control" value={testOptions.to} onChange={e => setTestOptions({...testOptions, to: parseInt(e.target.value)})} /></div>
                    <div className="col-md-6"><label className="form-label">題數</label><input type="number" className="form-control" value={testOptions.count} onChange={e => setTestOptions({...testOptions, count: parseInt(e.target.value)})} /></div>
                    <div className="col-md-6"><label className="form-label">題型</label><select className="form-select" value={testOptions.type} onChange={e => setTestOptions({...testOptions, type: e.target.value})}><option value="mc_eng_to_chi">英翻中 (選擇)</option><option value="mc_chi_to_eng">中翻英 (選擇)</option><option value="spelling">拼寫 (填空)</option></select></div>
                </div>
            </div></div>
        </>
    );

    const TestView = ({ question, onAnswer, speak }) => {
        const [inputValue, setInputValue] = useState('');

        useEffect(() => {
            if (question) {
                if (!question.options) { // Spelling question
                    speak(question.answer);
                } else if (question.options) { // Multiple choice question
                    // Check if it's English to Chinese (question contains English word)
                    const questionText = question.question;
                    if (questionText.includes('(') && questionText.includes(')')) {
                        // Extract English word from "word (part_of_speech)" format
                        const englishWord = questionText.split('(')[0].trim();
                        speak(englishWord);
                    }
                }
            }
        }, [question, speak]);

        const handleKeyPress = (event) => {
            if (event.key === 'Enter') {
                onAnswer(inputValue);
            }
        };

        if (!question) return <p>載入題目中...</p>;

        return (
            <div>
                <h4>第 {currentQuestionIndex + 1} / {questions.length} 題</h4>
                <div className="d-flex justify-content-between align-items-center my-4">
                    <h5 className="mb-0">{question.question}</h5>
                    {question.options && question.question.includes('(') && (
                        <button 
                            className="btn btn-outline-secondary btn-sm" 
                            onClick={() => speak(question.question.split('(')[0].trim())}
                        >
                            🔊
                        </button>
                    )}
                </div>
                {question.options ? (
                    <div className="d-grid gap-2">
                        {question.options.map((option, index) => (
                            <button key={index} className="btn btn-outline-primary" onClick={() => onAnswer(option)}>
                                {option}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="input-group">
                        <input
                            type="text"
                            className="form-control"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyPress={handleKeyPress}
                            autoFocus
                        />
                        <button className="btn btn-outline-secondary" onClick={() => speak(question.answer)}>
                            🔊
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const renderTest = () => {
        if (results) {
            return (
                <div>
                    <h2>測驗結束!</h2>
                    <h3>分數: {results.score}%</h3>
                    <ul className="list-group mb-3">
                        {results.questions.map((q, index) => (
                            <li key={index} className={`list-group-item ${q.isCorrect ? 'list-group-item-success' : 'list-group-item-danger'}`}>
                                <strong>{q.question}</strong> - 你的答案: {q.userAnswer} (正確答案: {q.answer})
                            </li>
                        ))}
                    </ul>
                    <button className="btn btn-secondary" onClick={() => { setView('home'); setQuestions([]); }}>返回主畫面</button>
                </div>
            );
        }
        return <TestView question={questions[currentQuestionIndex]} onAnswer={handleAnswerSubmit} speak={speak} />;
    };

    const renderHistory = () => {
        const chartData = {
            labels: history.map(h => new Date(h.test_date).toLocaleDateString()).reverse(),
            datasets: [
                {
                    label: '測驗分數',
                    data: history.map(h => h.score).reverse(),
                    fill: false,
                    backgroundColor: 'rgb(75, 192, 192)',
                    borderColor: 'rgba(75, 192, 192, 0.2)',
                },
            ],
        };

        return (
            <div>
                <h2>歷史成績</h2>
                <div className="mb-4">
                    <Line data={chartData} />
                </div>
                <table className="table table-striped">
                    <thead><tr><th>測驗日期</th><th>分數</th></tr></thead>
                    <tbody>{history.map(test => (<tr key={test.id}><td>{new Date(test.test_date).toLocaleString()}</td><td>{test.score}</td></tr>))}</tbody>
                </table>
                <button className="btn btn-secondary" onClick={() => setView('home')}>返回主畫面</button>
            </div>
        );
    };

    const renderMistakeBook = () => (
        <div>
            <h2>錯題本</h2>
            {mistakes.length > 0 ? (
                <>
                    <button className="btn btn-success w-100 mb-3" onClick={() => handleStartTest(true)}>開始錯題複習</button>
                    <ul className="list-group">
                        {mistakes.map((m, index) => (
                            <li key={m.id} className="list-group-item d-flex justify-content-between align-items-center">
                                <div>
                                    <span className="badge bg-danger me-2">#{index + 1}</span>
                                    <strong>{m.word}</strong> - {m.translation}
                                    <br />
                                    <small className="text-muted">
                                        錯誤率: {((m.error_rate || 0) * 100).toFixed(1)}% 
                                        ({m.mistake_count || 0}/{m.test_count || 0})
                                    </small>
                                </div>
                                <button className="btn btn-sm btn-outline-secondary" onClick={() => speak(m.word)}>🔊</button>
                            </li>
                        ))}
                    </ul>
                </>
            ) : (
                <p>太棒了，目前沒有任何錯題！</p>
            )}
            <button className="btn btn-secondary mt-3" onClick={() => setView('home')}>返回主畫面</button>
        </div>
    );

    const renderLeaderboard = () => (
        <div>
            <h2>排行榜</h2>
            {leaderboard.length > 0 ? (
                <div className="table-responsive">
                    <table className="table table-striped">
                        <thead className="table-dark">
                            <tr>
                                <th>排名</th>
                                <th>用戶名稱</th>
                                <th>測試次數</th>
                                <th>平均分數</th>
                                <th>最高分數</th>
                                <th>總分數</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leaderboard.map(user => (
                                <tr key={user.username} className={user.username === currentUser?.username ? 'table-warning' : ''}>
                                    <td>
                                        <span className={`badge ${user.rank <= 3 ? 'bg-warning' : 'bg-secondary'}`}>
                                            {user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : `#${user.rank}`}
                                        </span>
                                    </td>
                                    <td>
                                        <strong>{user.username}</strong>
                                        {user.username === currentUser?.username && <span className="badge bg-primary ms-2">你</span>}
                                    </td>
                                    <td>{user.totalTests}</td>
                                    <td>{user.avgScore}%</td>
                                    <td>{user.bestScore}%</td>
                                    <td>{user.totalScore}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p>目前還沒有排行榜數據</p>
            )}
            <button className="btn btn-secondary" onClick={() => setView('home')}>返回主畫面</button>
        </div>
    );

    return (
        <div>
            {currentUser && renderNavbar()}
            <div className="container mt-5">
                {!currentUser && <h1 className="mb-4 text-center">英文單字考試軟體</h1>}
                {view === 'login' && renderLogin()}
                {view === 'home' && renderHome()}
                {view === 'test' && renderTest()}
                {view === 'history' && renderHistory()}
                {view === 'mistake-book' && renderMistakeBook()}
                {view === 'leaderboard' && renderLeaderboard()}
            </div>
        </div>
    );
}

export default App;