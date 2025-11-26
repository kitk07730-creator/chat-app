const express = require('express');
const multer  = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

// Папка uploads
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// История сообщений
const HISTORY_FILE = path.join(__dirname, 'history.json');
let history = [];
const MAX_HISTORY = 50;

// Загружаем историю при старте
try {
    if (fs.existsSync(HISTORY_FILE)) {
        history = JSON.parse(fs.readFileSync(HISTORY_FILE));
    }
} catch(e) {
    console.error('Ошибка чтения истории:', e);
}

// Настройка multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, Date.now().toString() + '-' + Math.round(Math.random()*1e9) + ext);
  }
});
const upload = multer({ storage });

// Статические файлы
app.use(express.static(__dirname));
app.use('/uploads', express.static(UPLOAD_DIR));

let users = [];

io.on('connection', socket => {
  console.log('A user connected');

  // отправляем историю при подключении
  if(history.length > 0){
    socket.emit('history', history);
  }

  // установка ника
  socket.on('set username', username => {
    socket.username = username;
    if (!users.includes(username)) users.push(username);
    socket.emit('username accepted');
    io.emit('users list', users);
    io.emit('system , ${username} вошёл в чат');
  });

  // текстовые и мультимедийные сообщения
  socket.on('chat message', msg => {
    let message;
    if(typeof msg === 'string'){
      message = { user: socket.username, text: msg };
    } else {
      message = { user: socket.username, ...msg };
    }

    // сохраняем историю
    history.push(message);
    if(history.length > MAX_HISTORY) history.shift();
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history));

    io.emit('chat message', message);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
    if (socket.username) {
      users = users.filter(u => u !== socket.username);
      io.emit('users list', users);
      io.emit('system, ${socket.username} покинул чат');
    }
  });
});

// загрузка фото
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const url = '/uploads/' + req.file.filename;
  res.json({ url });
});

// загрузка аудио
app.post('/upload-audio', upload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no audio' });
  const url = '/uploads/' + req.file.filename;
  res.json({ url });
});

http.listen(3000, '0.0.0.0', () => {
  console.log('Server running on port 3000');
});