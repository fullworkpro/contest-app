/**
 * 多人实时竞赛服务器
 * 支持：房间管理、实时同步、答题计时、排名计算
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Railway 环境需要配置 Socket.io CORS
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============= 数据存储 =============
const rooms = new Map();           // 房间信息
const players = new Map();         // 玩家信息 (socketId -> {roomId, token, nickname, answers, score, startTime, finished})
const questions = [];              // 竞赛题目

// ============= 初始化25道竞赛题目 =============
function initQuestions() {
  // 这里使用示例题目，实际可以从文件或数据库加载
  // 25题，每题4分，满分100分
  const q = [
    { id: 1, q: "Python中，如何定义一个函数？", options: ["def func():", "function func()", "define func()", "void func()"], answer: 0 },
    { id: 2, q: "以下哪个是JavaScript的数据类型？", options: ["Integer", "String", "Double", "Long"], answer: 1 },
    { id: 3, q: "HTML中用于链接的标签是？", options: ["<link>", "<a>", "<href>", "<url>"], answer: 1 },
    { id: 4, q: "CSS选择器中，ID选择器的符号是？", options: [".", "#", "$", "@"], answer: 1 },
    { id: 5, q: "JavaScript中判断相等应该用？", options: ["=", "==", "===", "==="], answer: 2 },
    { id: 6, q: "Python中列表的索引从几开始？", options: ["0", "1", "-1", "任意"], answer: 0 },
    { id: 7, q: "哪个HTTP方法通常用于更新资源？", options: ["GET", "POST", "PUT", "DELETE"], answer: 2 },
    { id: 8, q: "CSS中设置背景颜色的属性是？", options: ["bg-color", "background-color", "color-bg", "background"], answer: 1 },
    { id: 9, q: "JavaScript中获取数组长度的属性是？", options: ["length", "size", "count", "len"], answer: 0 },
    { id: 10, q: "Python中如何创建一个字典？", options: ["{}", "[]", "()", "<>"], answer: 0 },
    { id: 11, q: "用于循环遍历的Python关键字是？", options: ["loop", "iterate", "for", "while"], answer: 2 },
    { id: 12, q: "HTML5的语义化标签是？", options: ["<div>", "<span>", "<article>", "<font>"], answer: 2 },
    { id: 13, q: "CSS中弹性盒子的主轴方向属性是？", options: ["flex-direction", "flex-wrap", "justify-content", "align-items"], answer: 0 },
    { id: 14, q: "JavaScript中typeof null的结果是？", options: ["null", "undefined", "object", "boolean"], answer: 2 },
    { id: 15, q: "Python中pass语句的作用是？", options: ["跳过", "什么都不做", "退出函数", "继续执行"], answer: 1 },
    { id: 16, q: "哪个标签用于嵌入JavaScript？", options: ["<js>", "<script>", "<code>", "<javascript>"], answer: 1 },
    { id: 17, q: "CSS中相对定位的属性值是？", options: ["absolute", "relative", "fixed", "static"], answer: 1 },
    { id: 18, q: "JavaScript中NaN的类型是？", options: ["Number", "NaN", "undefined", "String"], answer: 0 },
    { id: 19, q: "Python中range(5)生成几个数？", options: ["4", "5", "6", "无限"], answer: 1 },
    { id: 20, q: "HTTP状态码404表示？", options: ["成功", "重定向", "未找到", "服务器错误"], answer: 2 },
    { id: 21, q: "CSS中设置圆角的属性是？", options: ["border-shape", "border-radius", "corner", "round"], answer: 1 },
    { id: 22, q: "JavaScript中this指向？", options: ["函数定义", "函数调用", "全局对象", "不确定"], answer: 3 },
    { id: 23, q: "Python中strip()的作用是？", options: ["转换大写", "去除首尾空白", "分割字符串", "替换"], answer: 1 },
    { id: 24, q: "哪个是HTML5新增的输入类型？", options: ["text", "password", "email", "hidden"], answer: 2 },
    { id: 25, q: "CSS中z-index用于控制？", options: ["透明度", "层级", "宽度", "动画"], answer: 1 }
  ];
  questions.length = 0;
  q.forEach(item => questions.push(item));
}

initQuestions();

// ============= 路由API =============

// 创建房间
app.post('/api/room/create', (req, res) => {
  const roomId = uuidv4().substring(0, 8).toUpperCase();
  rooms.set(roomId, {
    id: roomId,
    status: 'waiting',      // waiting, ready, running, finished
    players: [],
    startTime: null,
    questions: questions.map(q => ({ id: q.id, q: q.q, options: q.options }))
  });
  res.json({ success: true, roomId });
});

// 加入房间
app.post('/api/room/join', (req, res) => {
  // 支持query参数或body参数
  const roomId = (req.body.roomId || req.query.roomId || '').toUpperCase();
  const nickname = req.body.nickname || req.query.nickname || '匿名用户';
  const token = req.body.token || req.query.token || uuidv4();
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.json({ success: false, error: '房间不存在' });
  }
  
  if (room.status !== 'waiting' && room.status !== 'ready') {
    return res.json({ success: false, error: '比赛已开始或已结束' });
  }
  
  // 生成或验证token
  let playerToken = token || uuidv4();
  let player = null;
  
  // 从rooms的players中查找
  const existingInfo = room.players.find(p => p.token === playerToken);
  
  // 在players Map中查找或创建
  const playerKey = 'http_' + playerToken;
  if (players.has(playerKey)) {
    player = players.get(playerKey);
  } else {
    player = {
      roomId: roomId.toUpperCase(),
      token: playerToken,
      nickname: nickname || `玩家${Math.floor(Math.random() * 1000)}`,
      answers: {},
      score: 0,
      startTime: null,
      finished: false,
      finishTime: null
    };
    players.set(playerKey, player);
  }
  
  // 更新房间中的玩家列表
  if (!room.players.find(p => p.token === playerToken)) {
    room.players.push({
      token: playerToken,
      nickname: player.nickname,
      ready: player.finished && room.status === 'running',
      score: player.score,
      finishTime: player.finishTime
    });
  }
  
  res.json({ 
    success: true, 
    token: playerToken,
    room: {
      id: room.id,
      status: room.status,
      players: room.players,
      startTime: room.startTime
    }
  });
});

// 获取房间状态
app.get('/api/room/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId.toUpperCase());
  if (!room) {
    return res.json({ success: false, error: '房间不存在' });
  }
  
  // 返回脱敏的房间信息
  res.json({
    success: true,
    room: {
      id: room.id,
      status: room.status,
      players: room.players,
      startTime: room.startTime,
      questions: room.questions.length
    }
  });
});

// 获取题目
app.get('/api/room/:roomId/questions', (req, res) => {
  const room = rooms.get(req.params.roomId.toUpperCase());
  if (!room) {
    return res.json({ success: false, error: '房间不存在' });
  }
  
  // 返回题目（不含答案）
  res.json({
    success: true,
    questions: room.questions.map(q => ({
      id: q.id,
      q: q.q,
      options: q.options
    }))
  });
});

// 提交答案
app.post('/api/answer', (req, res) => {
  const { token, roomId, questionId, answer } = req.body;
  
  // 查找玩家
  const playerKey = 'http_' + token;
  let player = players.get(playerKey);
  
  if (!player) {
    return res.json({ success: false, error: '玩家不存在' });
  }
  
  const room = rooms.get(roomId);
  if (!room) {
    return res.json({ success: false, error: '房间不存在' });
  }
  
  // 检查比赛是否进行中
  if (room.status !== 'running') {
    return res.json({ success: false, error: '比赛未进行' });
  }
  
  // 记录答案
  player.answers[questionId] = answer;
  
  // 计算分数
  let score = 0;
  for (const q of room.questions) {
    if (player.answers[q.id] !== undefined && player.answers[q.id] === q.answer) {
      score += 4;
    }
  }
  player.score = score;
  
  // 更新房间中的玩家信息
  const pInfo = room.players.find(p => p.token === token);
  if (pInfo) {
    pInfo.score = score;
  }
  
  // 检查是否全部完成
  const allFinished = room.players.every(p => p.finished);
  if (allFinished) {
    room.status = 'finished';
  }
  
  res.json({ success: true, score });
});

// 标记完成
app.post('/api/finish', (req, res) => {
  const { token, roomId } = req.body;
  
  // 查找玩家
  const playerKey = 'http_' + token;
  let player = players.get(playerKey);
  
  if (!player) {
    return res.json({ success: false, error: '玩家不存在' });
  }
  
  player.finished = true;
  player.finishTime = Date.now();
  
  const room = rooms.get(roomId);
  if (room) {
    const pInfo = room.players.find(p => p.token === token);
    if (pInfo) {
      pInfo.finished = true;
      pInfo.finishTime = player.finishTime;
    }
    
    // 检查是否全部完成
    if (room.players.every(p => p.finished)) {
      room.status = 'finished';
    }
  }
  
  res.json({ success: true });
});

// 获取个人成绩
app.get('/api/result/:roomId/:token', (req, res) => {
  const { roomId, token } = req.params;
  const room = rooms.get(roomId.toUpperCase());
  
  if (!room) {
    return res.json({ success: false, error: '房间不存在' });
  }
  
  const pInfo = room.players.find(p => p.token === token);
  if (!pInfo) {
    return res.json({ success: false, error: '未找到成绩' });
  }
  
  // 计算用时
  let timeUsed = 0;
  if (room.startTime && pInfo.finishTime) {
    timeUsed = Math.floor((pInfo.finishTime - room.startTime) / 1000);
  }
  
  let rank = 0;
  if (room.status === 'finished') {
    // 计算排名
    const sorted = [...room.players].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.finishTime || 0) - (b.finishTime || 0);
    });
    rank = sorted.findIndex(p => p.token === token) + 1;
  }
  
  res.json({
    success: true,
    result: {
      nickname: pInfo.nickname,
      score: pInfo.score,
      totalScore: room.questions.length * 4,
      timeUsed,
      rank,
      totalPlayers: room.players.length,
      finished: pInfo.finished
    }
  });
});

// 确认客户端就绪（防止中途退出后不能继续）
app.post('/api/ready', (req, res) => {
  const { token, roomId } = req.body;
  
  // 查找或创建玩家
  const playerKey = 'http_' + token;
  let player = players.get(playerKey);
  
  if (!player) {
    player = {
      roomId: roomId.toUpperCase(),
      token: token,
      nickname: `玩家${Math.floor(Math.random() * 1000)}`,
      answers: {},
      score: 0,
      startTime: null,
      finished: false,
      finishTime: null
    };
    players.set(playerKey, player);
  }
  
  const room = rooms.get(roomId.toUpperCase());
  if (room) {
    const pInfo = room.players.find(p => p.token === token);
    if (pInfo) {
      pInfo.ready = true;
    }
  }
  
  res.json({ success: true });
});

// ============= Socket.io 处理 =============

io.on('connection', (socket) => {
  console.log('客户端连接:', socket.id);
  
  // 玩家进入房间
  socket.on('join-room', ({ roomId, token, nickname }) => {
    const room = rooms.get(roomId.toUpperCase());
    if (!room) return;
    
    const roomIdUpper = roomId.toUpperCase();
    socket.join(roomIdUpper);
    
    // 保存玩家信息
    players.set(socket.id, {
      roomId: roomIdUpper,
      token: token || uuidv4(),
      nickname: nickname || `玩家${Math.floor(Math.random() * 1000)}`,
      answers: {},
      score: 0,
      startTime: null,
      finished: false,
      finishTime: null
    });
    
    // 通知房间内所有人
    io.to(roomIdUpper).emit('player-joined', {
      players: room.players
    });
  });
  
  // 管理员开始比赛
  socket.on('start-game', ({ roomId }) => {
    const room = rooms.get(roomId.toUpperCase());
    if (!room || room.status !== 'waiting') return;
    
    room.status = 'running';
    room.startTime = Date.now();
    
    // 更新所有玩家开始时间
    for (const [sid, p] of players) {
      if (p.roomId === roomId.toUpperCase()) {
        p.startTime = room.startTime;
      }
    }
    
    io.to(roomId.toUpperCase()).emit('game-started', {
      startTime: room.startTime
    });
  });
  
  // 实时更新玩家状态
  socket.on('update-progress', ({ roomId, token, progress }) => {
    const room = rooms.get(roomId.toUpperCase());
    if (!room) return;
    
    const pInfo = room.players.find(p => p.token === token);
    if (pInfo) {
      pInfo.progress = progress;
    }
    
    socket.to(roomId.toUpperCase()).emit('player-progress', {
      token,
      progress
    });
  });
  
  // 断开连接
  socket.on('disconnect', () => {
    const player = players.get(socket.id);
    if (player) {
      const room = rooms.get(player.roomId);
      if (room) {
        const idx = room.players.findIndex(p => p.token === player.token);
        if (idx !== -1) {
          io.to(player.roomId).emit('player-left', {
            token: player.token,
            players: room.players
          });
        }
      }
      players.delete(socket.id);
    }
  });
});

// ============= 启动服务器 =============

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`竞赛服务器已启动: http://localhost:${PORT}`);
  console.log(`创建房间: POST /api/room/create`);
  console.log(`加入房间: POST /api/room/join`);
});