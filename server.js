/**
 * 多人实时竞赛服务器 v2
 * 支持：管理后台、题库管理、三种题型、实时竞赛
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
const players = new Map();         // 玩家信息
const questionBanks = new Map();   // 题库 { id, name, enabled, questions: Map, createdAt, updatedAt }
let adminToken = null;             // 管理员登录token

// ============= 初始化示例题库 =============
function initDemoBanks() {
  const bank = {
    id: uuidv4(),
    name: '正确政绩观',
    enabled: false,
    questions: new Map(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const demoQuestions = [
    { id: uuidv4(), type: 'single', q: '习近平总书记强调，树立正确政绩观，要坚持什么标准？', options: ['群众满意', '上级认可', 'GDP增长', '个人晋升'], answer: 0 },
    { id: uuidv4(), type: 'single', q: '正确政绩观的核心要求是什么？', options: ['为民造福', '追求速度', '扩大规模', '招商引资'], answer: 0 },
    { id: uuidv4(), type: 'single', q: '下列哪项不属于正确政绩观的要求？', options: ['求真务实', '久久为功', '急功近利', '以人民为中心'], answer: 2 },
    { id: uuidv4(), type: 'single', q: '习近平总书记指出，要处理好"显功"和"潜功"的关系，什么才是真正的政绩？', options: ['立竿见影的项目', '泽被后世的潜功', 'GDP排名提升', '楼堂馆所建设'], answer: 1 },
    { id: uuidv4(), type: 'single', q: '"功成不必在我"体现的是哪种政绩观？', options: ['消极无为', '急功近利', '正确政绩观', '形式主义'], answer: 2 },
    { id: uuidv4(), type: 'multi', q: '正确政绩观要求领导干部树立哪些意识？', options: ['大局意识', '责任意识', '担当意识', '享乐意识'], answer: [0, 1, 2] },
    { id: uuidv4(), type: 'judge', q: '"绿水青山就是金山银山"体现了生态优先、绿色发展', options: ['对', '错'], answer: 0 },
    { id: uuidv4(), type: 'judge', q: '唯GDP论是正确政绩观的体现', options: ['对', '错'], answer: 1 },
    { id: uuidv4(), type: 'single', q: '正确政绩观要求领导干部坚持什么样的发展理念？', options: ['创新', '协调', '绿色', '以上都是'], answer: 3 },
    { id: uuidv4(), type: 'multi', q: '下列哪些符合正确政绩观的要求？', options: ['坚持实事求是', '尊重客观规律', '弄虚作假', '按科学规律办事'], answer: [0, 1, 3] },
    { id: uuidv4(), type: 'single', q: '习近平总书记指出，要树立正确政绩观，做到什么？', options: ['功成不必在我', '功成必定有我', '以上都是', '以上都不是'], answer: 2 },
    { id: uuidv4(), type: 'single', q: '正确政绩观反对"新官不理旧账"，倡导什么？', options: ['一张蓝图绘到底', '另起炉灶', '推倒重来', '标新立异'], answer: 0 },
    { id: uuidv4(), type: 'judge', q: '形象工程是正确政绩观的典型体现', options: ['对', '错'], answer: 1 },
    { id: uuidv4(), type: 'judge', q: '为民造福是最大的政绩', options: ['对', '错'], answer: 0 },
    { id: uuidv4(), type: 'single', q: '正确政绩观把什么放在第一位？', options: ['经济效益', '生态效益', '社会效益', '人民利益'], answer: 3 },
    { id: uuidv4(), type: 'multi', q: '错误政绩观的表现形式包括', options: ['形式主义', '官僚主义', '享乐主义', '求真务实'], answer: [0, 1, 2] },
    { id: uuidv4(), type: 'single', q: '正确政绩观反对什么决策方式？', options: ['科学决策', '民主决策', '依法决策', '拍脑袋决策'], answer: 3 },
    { id: uuidv4(), type: 'judge', q: '领导干部应追求"功成不必在我"的境界', options: ['对', '错'], answer: 0 },
    { id: uuidv4(), type: 'single', q: '正确政绩观要求处理好什么关系？', options: ['局部和全局', '当前和长远', '显绩和潜绩', '以上都是'], answer: 3 },
    { id: uuidv4(), type: 'single', q: '衡量政绩的根本标准是什么？', options: ['上级评价', '群众满意不满意', '媒体报道', '数据好看'], answer: 1 },
    { id: uuidv4(), type: 'multi', q: '树立正确政绩观需要强化哪些意识？', options: ['大局意识', '责任意识', '担当意识', '享乐意识'], answer: [0, 1, 2] },
    { id: uuidv4(), type: 'judge', q: '政绩工程是受群众欢迎的', options: ['对', '错'], answer: 1 },
    { id: uuidv4(), type: 'single', q: '正确政绩观要求什么样的工作作风？', options: ['求真务实', '形式主义', '官僚主义', '享乐主义'], answer: 0 },
    { id: uuidv4(), type: 'single', q: '习近平总书记强调，要树立正确政绩观，就要有什么样的精神状态？', options: ['奋发有为', '消极懈怠', '得过且过', '安于现状'], answer: 0 },
    { id: uuidv4(), type: 'judge', q: '错误政绩观会导致决策失误', options: ['对', '错'], answer: 0 },
  ];

  demoQuestions.forEach(q => {
    const id = q.id;
    const { id: _, ...qData } = q;
    bank.questions.set(id, { ...qData, id, createdAt: Date.now() });
  });

  questionBanks.set(bank.id, bank);
}
initDemoBanks();

// ============= 工具函数 =============
function shufflePick(arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function checkAnswer(q, userAnswer) {
  if (q.type === 'single' || q.type === 'judge') {
    return userAnswer === q.answer;
  }
  if (q.type === 'multi') {
    if (!Array.isArray(userAnswer)) return false;
    if (userAnswer.length !== q.answer.length) return false;
    const sorted = [...userAnswer].sort();
    const correct = [...q.answer].sort();
    return sorted.length === correct.length && sorted.every((v, i) => v === correct[i]);
  }
  return false;
}

// ============= 管理员认证 =============
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'Zsjs@2026';

function requireAdmin(req, res, next) {
  const token = req.query.token || req.body?.token;
  if (!token || token !== adminToken) {
    return res.json({ success: false, error: '未授权' });
  }
  next();
}

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    adminToken = uuidv4();
    res.json({ success: true, token: adminToken });
  } else {
    res.json({ success: false, error: '用户名或密码错误' });
  }
});

app.get('/api/admin/check', (req, res) => {
  const token = req.query.token;
  res.json({ success: true, valid: token === adminToken });
});

// ============= 题库 CRUD =============

// 获取所有题库列表
app.get('/api/admin/banks', requireAdmin, (req, res) => {
  const list = [];
  for (const bank of questionBanks.values()) {
    list.push({
      id: bank.id,
      name: bank.name,
      enabled: bank.enabled,
      questionCount: bank.questions.size,
      createdAt: bank.createdAt,
      updatedAt: bank.updatedAt
    });
  }
  res.json({ success: true, banks: list });
});

// 创建题库
app.post('/api/admin/banks', requireAdmin, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.json({ success: false, error: '请输入题库名称' });
  }
  const bank = {
    id: uuidv4(),
    name: name.trim(),
    enabled: false,
    questions: new Map(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  questionBanks.set(bank.id, bank);
  res.json({ success: true, bank: { id: bank.id, name: bank.name, enabled: bank.enabled, questionCount: 0 } });
});

// 获取单个题库详情
app.get('/api/admin/banks/:id', requireAdmin, (req, res) => {
  const bank = questionBanks.get(req.params.id);
  if (!bank) return res.json({ success: false, error: '题库不存在' });
  
  const questions = [];
  for (const q of bank.questions.values()) {
    questions.push({ id: q.id, type: q.type, q: q.q, options: q.options, answer: q.answer });
  }
  
  res.json({
    success: true,
    bank: {
      id: bank.id,
      name: bank.name,
      enabled: bank.enabled,
      questions,
      createdAt: bank.createdAt,
      updatedAt: bank.updatedAt
    }
  });
});

// 更新题库
app.put('/api/admin/banks/:id', requireAdmin, (req, res) => {
  const bank = questionBanks.get(req.params.id);
  if (!bank) return res.json({ success: false, error: '题库不存在' });
  
  const { name, enabled } = req.body;
  
  if (name !== undefined) {
    bank.name = name.trim() || bank.name;
  }
  
  if (enabled !== undefined) {
    if (enabled === true) {
      // 先禁用其他所有题库
      for (const b of questionBanks.values()) {
        if (b.id !== bank.id) b.enabled = false;
      }
    }
    bank.enabled = enabled;
  }
  
  bank.updatedAt = Date.now();
  res.json({ success: true, bank: { id: bank.id, name: bank.name, enabled: bank.enabled, questionCount: bank.questions.size } });
});

// 删除题库
app.delete('/api/admin/banks/:id', requireAdmin, (req, res) => {
  const bank = questionBanks.get(req.params.id);
  if (!bank) return res.json({ success: false, error: '题库不存在' });
  questionBanks.delete(req.params.id);
  res.json({ success: true });
});

// 获取启用题库
app.get('/api/admin/enabled-bank', requireAdmin, (req, res) => {
  let enabledBank = null;
  for (const bank of questionBanks.values()) {
    if (bank.enabled) {
      enabledBank = bank;
      break;
    }
  }
  res.json({
    success: true,
    bank: enabledBank ? { id: enabledBank.id, name: enabledBank.name } : null
  });
});

// ============= 题目 CRUD =============

// 获取题库的所有题目
app.get('/api/admin/banks/:bankId/questions', requireAdmin, (req, res) => {
  const bank = questionBanks.get(req.params.bankId);
  if (!bank) return res.json({ success: false, error: '题库不存在' });
  
  const questions = [];
  let index = 0;
  for (const q of bank.questions.values()) {
    questions.push({ id: q.id, type: q.type, q: q.q, options: q.options, index: index++ });
  }
  res.json({ success: true, questions });
});

// 添加题目
app.post('/api/admin/banks/:bankId/questions', requireAdmin, (req, res) => {
  const bank = questionBanks.get(req.params.bankId);
  if (!bank) return res.json({ success: false, error: '题库不存在' });
  
  const { type, q, options, answer } = req.body;
  if (!type || !q || !options) {
    return res.json({ success: false, error: '缺少题目信息' });
  }
  
  if (!['single', 'multi', 'judge'].includes(type)) {
    return res.json({ success: false, error: '题型无效，支持: single/multi/judge' });
  }
  
  if (type === 'judge') {
    // 判断题固定选项
    options.length = 0;
    options.push('对', '错');
  }
  
  const questionId = uuidv4();
  const question = {
    id: questionId,
    type,
    q,
    options: [...options],
    answer,
    createdAt: Date.now()
  };
  
  bank.questions.set(questionId, question);
  bank.updatedAt = Date.now();
  
  res.json({ success: true, question: { id: questionId, type, q, options: question.options } });
});

// 修改题目
app.put('/api/admin/questions/:questionId', requireAdmin, (req, res) => {
  let foundQ = null;
  let foundBank = null;
  
  for (const bank of questionBanks.values()) {
    if (bank.questions.has(req.params.questionId)) {
      foundQ = bank.questions.get(req.params.questionId);
      foundBank = bank;
      break;
    }
  }
  
  if (!foundQ) return res.json({ success: false, error: '题目不存在' });
  
  const { type, q, options, answer } = req.body;
  if (type !== undefined) foundQ.type = type;
  if (q !== undefined) foundQ.q = q;
  if (options !== undefined) {
    if (foundQ.type === 'judge') {
      foundQ.options = ['对', '错'];
    } else {
      foundQ.options = [...options];
    }
  }
  if (answer !== undefined) foundQ.answer = answer;
  foundBank.updatedAt = Date.now();
  
  res.json({ success: true, question: { id: foundQ.id, type: foundQ.type, q: foundQ.q, options: foundQ.options } });
});

// 删除题目
app.delete('/api/admin/questions/:questionId', requireAdmin, (req, res) => {
  for (const bank of questionBanks.values()) {
    if (bank.questions.has(req.params.questionId)) {
      bank.questions.delete(req.params.questionId);
      bank.updatedAt = Date.now();
      return res.json({ success: true });
    }
  }
  res.json({ success: false, error: '题目不存在' });
});

// ============= 竞赛 API =============

// 创建房间
app.post('/api/room/create', (req, res) => {
  // 找到启用的题库
  let enabledBank = null;
  for (const bank of questionBanks.values()) {
    if (bank.enabled) {
      enabledBank = bank;
      break;
    }
  }
  
  if (!enabledBank) {
    return res.json({ success: false, error: '请先在管理后台启用一个题库' });
  }
  
  const allQ = [];
  for (const q of enabledBank.questions.values()) {
    allQ.push(q);
  }
  
  if (allQ.length === 0) {
    return res.json({ success: false, error: '当前题库为空，请先添加题目' });
  }
  
  const pickCount = Math.min(25, allQ.length);
  const picked = shufflePick(allQ, pickCount);
  
  const roomId = uuidv4().substring(0, 8).toUpperCase();
  const token = uuidv4();
  
  rooms.set(roomId, {
    id: roomId,
    bankName: enabledBank.name,
    status: 'waiting',
    players: [],
    startTime: null,
    questions: picked.map(q => ({ id: q.id, type: q.type, q: q.q, options: q.options })),
    privateQuestions: picked.map(q => ({ id: q.id, type: q.type, q: q.q, options: q.options, answer: q.answer }))
  });
  
  res.json({ success: true, roomId, token });
});

// 加入房间
app.post('/api/room/join', (req, res) => {
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
  
  let playerToken = token || uuidv4();
  const playerKey = 'http_' + playerToken;
  let player = null;
  
  if (players.has(playerKey)) {
    player = players.get(playerKey);
  } else {
    player = {
      roomId: roomId.toUpperCase(),
      token: playerToken,
      nickname: nickname || `玩家${Math.floor(Math.random() * 1000)}`,
      answers: null, // 改为object存所有答案
      answersMap: {},
      score: 0,
      startTime: null,
      finished: false,
      finishTime: null
    };
    players.set(playerKey, player);
  }
  
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
      startTime: room.startTime,
      bankName: room.bankName
    }
  });
});

// 获取房间状态
app.get('/api/room/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId.toUpperCase());
  if (!room) return res.json({ success: false, error: '房间不存在' });
  
  res.json({
    success: true,
    room: {
      id: room.id,
      bankName: room.bankName,
      status: room.status,
      players: room.players,
      startTime: room.startTime,
      questions: room.questions.length
    }
  });
});

// 获取题目（含type字段）
app.get('/api/room/:roomId/questions', (req, res) => {
  const room = rooms.get(req.params.roomId.toUpperCase());
  if (!room) return res.json({ success: false, error: '房间不存在' });
  
  res.json({
    success: true,
    questions: room.questions.map(q => ({
      id: q.id,
      type: q.type,
      q: q.q,
      options: q.options
    }))
  });
});

// 提交单个答案
app.post('/api/answer', (req, res) => {
  const { token, roomId, questionId, answer } = req.body;
  
  const playerKey = 'http_' + token;
  let player = players.get(playerKey);
  if (!player) return res.json({ success: false, error: '玩家不存在' });
  
  const room = rooms.get(roomId);
  if (!room) return res.json({ success: false, error: '房间不存在' });
  if (room.status !== 'running') return res.json({ success: false, error: '比赛未进行' });
  
  player.answersMap[questionId] = answer;
  
  // 计算分数
  let score = 0;
  const totalQ = room.privateQuestions.length;
  const answeredCount = Object.keys(player.answersMap).length;
  for (const q of room.privateQuestions) {
    if (player.answersMap[q.id] !== undefined && checkAnswer(q, player.answersMap[q.id])) {
      score += 4;
    }
  }
  player.score = score;
  
  const pInfo = room.players.find(p => p.token === token);
  if (pInfo) pInfo.score = score;
  
  res.json({ success: true, score, answered: answeredCount, total: totalQ });
});

// 批量提交答案（交卷）
app.post('/api/submit-all', (req, res) => {
  const { token, roomId, answers } = req.body;
  
  const playerKey = 'http_' + token;
  let player = players.get(playerKey);
  if (!player) return res.json({ success: false, error: '玩家不存在' });
  
  // 注意：v1前端用的是"answers"字段，兼容处理
  if (answers && typeof answers === 'object') {
    for (const [qId, ans] of Object.entries(answers)) {
      player.answersMap[qId] = ans;
    }
  }
  
  // 计算分数
  let score = 0;
  for (const q of room.privateQuestions) {
    if (player.answersMap[q.id] !== undefined && checkAnswer(q, player.answersMap[q.id])) {
      score += 4;
    }
  }
  player.score = score;
  
  const pInfo = room.players.find(p => p.token === token);
  if (pInfo) pInfo.score = score;
  
  res.json({ success: true, score, total: room.privateQuestions.length });
});

// 标记完成
app.post('/api/finish', (req, res) => {
  const { token, roomId } = req.body;
  
  const playerKey = 'http_' + token;
  let player = players.get(playerKey);
  if (!player) return res.json({ success: false, error: '玩家不存在' });
  
  player.finished = true;
  player.finishTime = Date.now();
  
  const room = rooms.get(roomId);
  if (room) {
    const pInfo = room.players.find(p => p.token === token);
    if (pInfo) {
      pInfo.finished = true;
      pInfo.finishTime = player.finishTime;
    }
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
  
  if (!room) return res.json({ success: false, error: '房间不存在' });
  
  const pInfo = room.players.find(p => p.token === token);
  if (!pInfo) return res.json({ success: false, error: '未找到成绩' });
  
  let timeUsed = 0;
  if (room.startTime && pInfo.finishTime) {
    timeUsed = Math.floor((pInfo.finishTime - room.startTime) / 1000);
  }
  
  let rank = 0;
  if (room.status === 'finished') {
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

// 确认客户端就绪
app.post('/api/ready', (req, res) => {
  const { token, roomId } = req.body;
  
  const playerKey = 'http_' + token;
  let player = players.get(playerKey);
  
  if (!player) {
    player = {
      roomId: roomId.toUpperCase(),
      token: token,
      nickname: `玩家${Math.floor(Math.random() * 1000)}`,
      answersMap: {},
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
    if (pInfo) pInfo.ready = true;
  }
  
  res.json({ success: true });
});

// ============= Socket.io 处理 =============

io.on('connection', (socket) => {
  console.log('客户端连接:', socket.id);
  
  socket.on('join-room', ({ roomId, token, nickname }) => {
    const room = rooms.get(roomId.toUpperCase());
    if (!room) return;
    
    const roomIdUpper = roomId.toUpperCase();
    socket.join(roomIdUpper);
    
    players.set(socket.id, {
      roomId: roomIdUpper,
      token: token || uuidv4(),
      nickname: nickname || `玩家${Math.floor(Math.random() * 1000)}`,
      answersMap: {},
      score: 0,
      startTime: null,
      finished: false,
      finishTime: null
    });
    
    io.to(roomIdUpper).emit('player-joined', { players: room.players });
  });
  
  socket.on('start-game', ({ roomId }) => {
    const room = rooms.get(roomId.toUpperCase());
    if (!room || room.status !== 'waiting') return;
    
    room.status = 'running';
    room.startTime = Date.now();
    
    for (const [sid, p] of players) {
      if (p.roomId === roomId.toUpperCase()) {
        p.startTime = room.startTime;
      }
    }
    
    io.to(roomId.toUpperCase()).emit('game-started', { startTime: room.startTime });
  });
  
  socket.on('update-progress', ({ roomId, token, progress }) => {
    const room = rooms.get(roomId.toUpperCase());
    if (!room) return;
    const pInfo = room.players.find(p => p.token === token);
    if (pInfo) pInfo.progress = progress;
    socket.to(roomId.toUpperCase()).emit('player-progress', { token, progress });
  });
  
  socket.on('disconnect', () => {
    const player = players.get(socket.id);
    if (player) {
      const room = rooms.get(player.roomId);
      if (room) {
        const idx = room.players.findIndex(p => p.token === player.token);
        if (idx !== -1) {
          io.to(player.roomId).emit('player-left', { token: player.token, players: room.players });
        }
      }
      players.delete(socket.id);
    }
  });
});

// ============= 启动服务器 =============

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`竞赛服务器 v2 已启动: http://localhost:${PORT}`);
  console.log(`创建房间: POST /api/room/create`);
  console.log(`加入房间: POST /api/room/join`);
  console.log(`管理后台: http://localhost:${PORT}/admin.html`);
});
