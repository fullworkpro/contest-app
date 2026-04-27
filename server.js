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
const allQuestions = [];           // 完整题库（100道）

// ============= 初始化100道"正确政绩观"单选题 =============
function initQuestions() {
  const q = [
    { id: 1, q: "习近平总书记强调，树立正确政绩观，要坚持什么标准？", options: ["群众满意", "上级认可", "GDP增长", "个人晋升"], answer: 0 },
    { id: 2, q: "正确政绩观的核心要求是什么？", options: ["为民造福", "追求速度", "扩大规模", "招商引资"], answer: 0 },
    { id: 3, q: "下列哪项不属于正确政绩观的要求？", options: ["求真务实", "久久为功", "急功近利", "以人民为中心"], answer: 2 },
    { id: 4, q: "习近平总书记指出，要处理好\"显功\"和\"潜功\"的关系，什么才是真正的政绩？", options: ["立竿见影的项目", "泽被后世的潜功", "GDP排名提升", "楼堂馆所建设"], answer: 1 },
    { id: 5, q: "正确政绩观要求领导干部树立什么样的发展观？", options: ["唯GDP论", "以人民为中心的发展思想", "片面追求速度", "重显绩轻潜绩"], answer: 1 },
    { id: 6, q: "\"功成不必在我\"体现的是哪种政绩观？", options: ["消极无为", "急功近利", "正确政绩观", "形式主义"], answer: 2 },
    { id: 7, q: "下列做法中，符合正确政绩观的是？", options: ["大搞形象工程", "追求短期效应", "打好基础利长远", "弄虚作假报数据"], answer: 2 },
    { id: 8, q: "正确政绩观要求领导干部坚持以什么为出发点？", options: ["个人名利", "地方利益", "群众利益", "部门利益"], answer: 2 },
    { id: 9, q: "习近平总书记强调，为民造福是最大的什么？", options: ["政绩", "功劳", "成绩", "荣誉"], answer: 0 },
    { id: 10, q: "树立正确政绩观，必须坚决反对什么？", options: ["求真务实", "调查研究", "形式主义、官僚主义", "艰苦奋斗"], answer: 2 },
    { id: 11, q: "正确政绩观要求把什么放在第一位？", options: ["经济效益", "生态效益", "社会效益", "人民利益"], answer: 3 },
    { id: 12, q: "\"绿水青山就是金山银山\"体现的是什么样的政绩观？", options: ["经济优先", "生态优先、绿色发展", "先污染后治理", "重开发轻保护"], answer: 1 },
    { id: 13, q: "领导干部树立正确政绩观，需要什么样的历史观？", options: ["急功近利", "对历史负责", "只顾眼前", "好大喜功"], answer: 1 },
    { id: 14, q: "下列哪种行为体现了正确的政绩观？", options: ["搞政绩工程", "做表面文章", "切实解决群众急难愁盼问题", "报喜不报忧"], answer: 2 },
    { id: 15, q: "正确政绩观要求处理好什么样的关系？", options: ["局部和全局", "当前和长远", "显绩和潜绩", "以上都是"], answer: 3 },
    { id: 16, q: "习近平总书记指出，要树立什么样的政绩观？", options: ["以经济为中心", "以GDP为中心", "以人民为中心", "以考核为中心"], answer: 2 },
    { id: 17, q: "正确政绩观反对\"形象工程\"，倡导什么？", options: ["民生工程", "面子工程", "景观亮化工程", "豪华办公楼"], answer: 0 },
    { id: 18, q: "衡量政绩的根本标准是什么？", options: ["上级评价", "群众满意不满意", "媒体报道", "数据好看"], answer: 1 },
    { id: 19, q: "下列哪项是正确政绩观的应有之义？", options: ["实事求是", "求真务实", "真抓实干", "以上都是"], answer: 3 },
    { id: 20, q: "正确政绩观要求领导干部具有什么样的精神？", options: ["担当精神", "创新精神", "钉钉子精神", "以上都是"], answer: 3 },
    { id: 21, q: "正确政绩观强调要坚决反对什么？", options: ["形式主义", "官僚主义", "享乐主义", "以上都是"], answer: 3 },
    { id: 22, q: "习近平总书记指出，要坚决破除什么思想？", options: ["实事求是", "急功近利", "科学发展", "改革创新"], answer: 1 },
    { id: 23, q: "正确政绩观要求领导干部要有什么样的胸怀？", options: ["自私自利", "急功近利", "功成不必在我", "好大喜功"], answer: 2 },
    { id: 24, q: "下列做法中违背正确政绩观的是？", options: ["打好脱贫攻坚战", "改善生态环境", "搞政绩工程", "解决就业问题"], answer: 2 },
    { id: 25, q: "正确政绩观要求坚持什么样的发展？", options: ["高质量发展", "低水平重复", "粗放型发展", "破坏式发展"], answer: 0 },
    { id: 26, q: "习近平总书记强调，要树立正确政绩观，做到什么？", options: ["功成不必在我", "功成必定有我", "以上都是", "以上都不是"], answer: 2 },
    { id: 27, q: "正确政绩观反对\"新官不理旧账\"，倡导什么？", options: ["一张蓝图绘到底", "另起炉灶", "推倒重来", "标新立异"], answer: 0 },
    { id: 28, q: "什么样的政绩才是党和人民需要的政绩？", options: ["经得起历史检验的政绩", "上级满意的政绩", "媒体宣传的政绩", "数据好看的政绩"], answer: 0 },
    { id: 29, q: "正确政绩观要求领导干部要坚持什么工作方法？", options: ["调查研究", "拍脑袋决策", "脱离实际", "主观臆断"], answer: 0 },
    { id: 30, q: "习近平总书记指出，要完善什么考核评价体系？", options: ["干部考核", "科学发展", "高质量发展", "正确政绩观"], answer: 0 },
    { id: 31, q: "正确政绩观要求什么样的用人导向？", options: ["唯票取人", "唯分取人", "注重实绩、群众公认", "论资排辈"], answer: 2 },
    { id: 32, q: "下列哪项是正确政绩观的重要体现？", options: ["为民办实事", "解难题", "惠民生", "以上都是"], answer: 3 },
    { id: 33, q: "正确政绩观反对什么决策方式？", options: ["科学决策", "民主决策", "依法决策", "拍脑袋决策"], answer: 3 },
    { id: 34, q: "习近平总书记强调，要树立什么样的政绩观，多做打基础、利长远的事？", options: ["科学的", "正确的", "全面的", "系统的"], answer: 1 },
    { id: 35, q: "正确政绩观要求正确处理什么关系？", options: ["政府与市场", "当前与长远", "局部与全局", "以上都是"], answer: 3 },
    { id: 36, q: "什么样的政绩观容易导致形式主义？", options: ["正确的", "错误的", "科学的", "全面的"], answer: 1 },
    { id: 37, q: "正确政绩观要求什么样的事业观？", options: ["为官一任、造福一方", "不求有功但求无过", "混日子", "等靠要"], answer: 0 },
    { id: 38, q: "习近平总书记指出，要树立正确政绩观，防止什么倾向？", options: ["急于求成", "稳中求进", "循序渐进", "实事求是"], answer: 0 },
    { id: 39, q: "正确政绩观的核心内涵是什么？", options: ["以人民为中心的发展思想", "以GDP为中心", "以城市为中心", "以产业为中心"], answer: 0 },
    { id: 40, q: "下列哪个是正确政绩观的实践要求？", options: ["坚持实事求是", "尊重客观规律", "按科学规律办事", "以上都是"], answer: 3 },
    { id: 41, q: "正确政绩观要求什么样的工作作风？", options: ["求真务实", "形式主义", "官僚主义", "享乐主义"], answer: 0 },
    { id: 42, q: "习近平总书记强调，政绩要经得起什么的检验？", options: ["实践", "人民", "历史", "以上都是"], answer: 3 },
    { id: 43, q: "正确政绩观反对\"竭泽而渔\"，倡导什么？", options: ["可持续发展", "短期行为", "掠夺式开发", "过度利用"], answer: 0 },
    { id: 44, q: "树立正确政绩观需要强化什么意识？", options: ["大局意识", "责任意识", "担当意识", "以上都是"], answer: 3 },
    { id: 45, q: "正确政绩观要求什么样的评价导向？", options: ["重显绩轻潜绩", "重当前轻长远", "重实干、重实绩", "重数据轻实效"], answer: 2 },
    { id: 46, q: "习近平总书记指出，要坚决反对搞什么？", options: ["形象工程", "政绩工程", "以上都是", "以上都不是"], answer: 2 },
    { id: 47, q: "正确政绩观要求领导干部要有什么样的境界？", options: ["功成不必在我", "功成必定有我", "淡泊名利", "以上都是"], answer: 3 },
    { id: 48, q: "下列哪种做法符合正确政绩观？", options: ["不顾实际盲目举债", "铺摊子上项目", "扎实做好民生保障", "搞花架子"], answer: 2 },
    { id: 49, q: "正确政绩观对领导干部的考核要求是什么？", options: ["全面、客观、公正", "唯GDP", "唯数字", "唯排名"], answer: 0 },
    { id: 50, q: "习近平总书记强调，要建立健全什么机制来引导正确政绩观？", options: ["考核评价", "监督问责", "激励容错", "以上都是"], answer: 3 },
    { id: 51, q: "正确政绩观要求什么样的群众观？", options: ["一切为了群众", "一切依靠群众", "从群众中来、到群众中去", "以上都是"], answer: 3 },
    { id: 52, q: "下列哪项不是正确政绩观的要求？", options: ["尊重规律", "实事求是", "好大喜功", "量力而行"], answer: 2 },
    { id: 53, q: "正确政绩观强调要坚持什么样的发展理念？", options: ["创新", "协调", "绿色、开放、共享", "以上都是"], answer: 3 },
    { id: 54, q: "习近平总书记指出，要树立正确的政绩观，就要有什么样的精神状态？", options: ["奋发有为", "消极懈怠", "得过且过", "安于现状"], answer: 0 },
    { id: 55, q: "正确政绩观反对什么？", options: ["实事求是", "求真务实", "虚报浮夸", "真抓实干"], answer: 2 },
    { id: 56, q: "什么样的政绩才是真正的好政绩？", options: ["群众得实惠的政绩", "媒体宣传多的政绩", "领导表扬多的政绩", "排名靠前的政绩"], answer: 0 },
    { id: 57, q: "正确政绩观要求什么样的政绩评价标准？", options: ["历史评价", "人民评价", "实践评价", "以上都是"], answer: 3 },
    { id: 58, q: "习近平总书记强调，要防止和克服什么倾向？", options: ["形式主义", "官僚主义", "急功近利", "以上都是"], answer: 3 },
    { id: 59, q: "正确政绩观要求什么样的权力观？", options: ["权为民所用", "权为己所用", "权为私所用", "权为亲所用"], answer: 0 },
    { id: 60, q: "下列哪项体现了\"功成不必在我\"的境界？", options: ["甘做铺垫工作", "甘抓未成之事", "不计个人名利", "以上都是"], answer: 3 },
    { id: 61, q: "正确政绩观要求什么样的发展方式？", options: ["可持续发展", "破坏式发展", "掠夺式发展", "短期行为"], answer: 0 },
    { id: 62, q: "习近平总书记指出，要树立正确政绩观，就要处理好什么关系？", options: ["显绩和潜绩", "当前和长远", "局部和全局", "以上都是"], answer: 3 },
    { id: 63, q: "正确政绩观的核心是什么？", options: ["为民造福", "多出政绩", "快出政绩", "出大政绩"], answer: 0 },
    { id: 64, q: "什么样的政绩观是违背党的宗旨的？", options: ["以人为本", "以民为本", "以官为本", "以群众为本"], answer: 2 },
    { id: 65, q: "正确政绩观要求什么样的价值观？", options: ["为人民服务", "为个人谋利", "为部门争利", "为单位争光"], answer: 0 },
    { id: 66, q: "习近平总书记强调，要树立正确政绩观，着力解决什么问题？", options: ["群众最关心的问题", "群众最直接的问题", "群众最现实的利益问题", "以上都是"], answer: 3 },
    { id: 67, q: "正确政绩观反对什么样的工作方式？", options: ["实事求是", "调查研究", "搞运动式", "脚踏实地"], answer: 2 },
    { id: 68, q: "下列哪项属于正确政绩观的体现？", options: ["久久为功", "一任接着一任干", "持续发力", "以上都是"], answer: 3 },
    { id: 69, q: "正确政绩观要求什么样的考核导向？", options: ["注重实效", "注重过程", "注重形式", "注重宣传"], answer: 0 },
    { id: 70, q: "习近平总书记指出，要树立正确政绩观，就要有什么样的担当？", options: ["历史担当", "责任担当", "使命担当", "以上都是"], answer: 3 },
    { id: 71, q: "正确政绩观要求坚持什么样的工作标准？", options: ["群众满意", "上级满意", "自己满意", "媒体满意"], answer: 0 },
    { id: 72, q: "下列哪种情况属于错误的政绩观？", options: ["注重民生改善", "注重生态保护", "注重数据造假", "注重长远发展"], answer: 2 },
    { id: 73, q: "正确政绩观要求什么样的实干精神？", options: ["求真务实", "狠抓落实", "说到做到", "以上都是"], answer: 3 },
    { id: 74, q: "习近平总书记强调，要坚决纠正什么？", options: ["唯GDP论", "唯增速论", "唯规模论", "以上都是"], answer: 3 },
    { id: 75, q: "正确政绩观要求什么样的政绩追求？", options: ["经得起检验", "经得起核查", "经得起监督", "以上都是"], answer: 3 },
    { id: 76, q: "下列哪项体现了正确的政绩观？", options: ["多做顺民意的事", "多做解民忧的事", "多做强基础的事", "以上都是"], answer: 3 },
    { id: 77, q: "正确政绩观反对什么样的思想作风？", options: ["求真务实", "弄虚作假", "实事求是", "真抓实干"], answer: 1 },
    { id: 78, q: "习近平总书记指出，要树立正确政绩观，就要有什么样的视野？", options: ["全局视野", "战略视野", "长远视野", "以上都是"], answer: 3 },
    { id: 79, q: "正确政绩观要求什么样的工作态度？", options: ["对人民负责", "对历史负责", "对事业负责", "以上都是"], answer: 3 },
    { id: 80, q: "什么样的政绩观会导致决策失误？", options: ["急功近利", "心浮气躁", "脱离实际", "以上都是"], answer: 3 },
    { id: 81, q: "正确政绩观要求什么样的利益观？", options: ["以人民利益为重", "以个人利益为重", "以部门利益为重", "以地方利益为重"], answer: 0 },
    { id: 82, q: "习近平总书记强调，要树立正确政绩观，就要克服什么？", options: ["浮躁情绪", "急躁心态", "急功近利", "以上都是"], answer: 3 },
    { id: 83, q: "正确政绩观强调什么的重要性？", options: ["打基础", "利长远", "惠民生", "以上都是"], answer: 3 },
    { id: 84, q: "下列哪种理念体现了正确政绩观？", options: ["绿水青山就是金山银山", "先污染后治理", "重开发轻保护", "唯GDP主义"], answer: 0 },
    { id: 85, q: "正确政绩观要求什么样的发展思路？", options: ["以人民为中心", "以资本为中心", "以城市为中心", "以产业为中心"], answer: 0 },
    { id: 86, q: "习近平总书记指出，要树立正确政绩观，就要坚持什么？", options: ["实事求是", "一切从实际出发", "尊重客观规律", "以上都是"], answer: 3 },
    { id: 87, q: "正确政绩观反对什么样的工作作风？", options: ["形式主义", "官僚主义", "享乐主义", "以上都是"], answer: 3 },
    { id: 88, q: "什么样的政绩才是经得起历史检验的政绩？", options: ["符合客观规律的政绩", "符合人民利益的政绩", "符合实际情况的政绩", "以上都是"], answer: 3 },
    { id: 89, q: "正确政绩观要求什么样的政绩考核办法？", options: ["综合评价", "分类考核", "差异化考核", "以上都是"], answer: 3 },
    { id: 90, q: "习近平总书记强调，要建立健全正确政绩观的什么机制？", options: ["教育引导", "考核评价", "监督问责", "以上都是"], answer: 3 },
    { id: 91, q: "正确政绩观要求什么样的政绩成果？", options: ["实实在在的成果", "群众认可的成果", "经得起检验的成果", "以上都是"], answer: 3 },
    { id: 92, q: "下列哪种行为违背了正确政绩观？", options: ["大搞形象工程", "追求轰动效应", "做表面文章", "以上都是"], answer: 3 },
    { id: 93, q: "正确政绩观要求什么样的发展路径？", options: ["高质量发展", "可持续发展", "绿色发展", "以上都是"], answer: 3 },
    { id: 94, q: "习近平总书记指出，要树立正确政绩观，就要有什么样的情怀？", options: ["家国情怀", "为民情怀", "历史情怀", "以上都是"], answer: 3 },
    { id: 95, q: "正确政绩观要求什么样的政绩导向？", options: ["实事求是", "真抓实干", "务求实效", "以上都是"], answer: 3 },
    { id: 96, q: "什么样的政绩观有利于党和人民事业发展？", options: ["科学的政绩观", "正确的政绩观", "全面的政绩观", "以上都是"], answer: 3 },
    { id: 97, q: "正确政绩观要求什么样的实践标准？", options: ["实践检验", "人民检验", "历史检验", "以上都是"], answer: 3 },
    { id: 98, q: "习近平总书记强调，要树立正确政绩观，就要坚持什么导向？", options: ["问题导向", "目标导向", "结果导向", "以上都是"], answer: 3 },
    { id: 99, q: "正确政绩观要求领导干部有什么样的作风？", options: ["求真务实", "密切联系群众", "艰苦奋斗", "以上都是"], answer: 3 },
    { id: 100, q: "正确政绩观的根本要求是什么？", options: ["坚持以人民为中心", "坚持实事求是", "坚持科学发展", "坚持改革创新"], answer: 0 }
  ];
  allQuestions.length = 0;
  q.forEach(item => allQuestions.push(item));
}

initQuestions();

// ============= 工具函数：从数组中随机抽取n个 =============
function shufflePick(arr, n) {
  const copy = [...arr];
  // Fisher-Yates 洗牌
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

// ============= 路由API =============

// 创建房间
app.post('/api/room/create', (req, res) => {
  const roomId = uuidv4().substring(0, 8).toUpperCase();
  const token = uuidv4();

  // 从100道题库中随机抽取25题
  const picked = shufflePick(allQuestions, 25);

  rooms.set(roomId, {
    id: roomId,
    status: 'waiting',      // waiting, ready, running, finished
    players: [],
    startTime: null,
    questions: picked.map(q => ({ id: q.id, q: q.q, options: q.options })), // 发给前端，不含answer
    privateQuestions: picked.map(q => ({ id: q.id, q: q.q, options: q.options, answer: q.answer })) // 服务器保留，含answer
  });
  res.json({ success: true, roomId, token });
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
  
  // 计算分数（用 privateQuestions 中的 answer 字段比对）
  let score = 0;
  for (const q of room.privateQuestions) {
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
    // 计算排名：按分数降序，分数相同按完成时间升序
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
