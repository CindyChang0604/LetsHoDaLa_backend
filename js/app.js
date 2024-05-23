
const io = require('socket.io')(3000, {
  cors: {
    origin: "*",  // 这里可以更精确地指定来源，例如 http://localhost:8080
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true
  }
});

// 用來追蹤每個socket連接的房間
const socketRoomMap = new Map();
const roomHostMap = new Map();  // 创建一个新的Map来追踪每个房间的房长

// 追踪每个房间内的用户点击数
const roomClicks = {};

function updateRoomClicks(room, username, clicks) {
  if (!roomClicks[room]) {
      roomClicks[room] = {};
  }
  roomClicks[room][username] = clicks;
}

function sendGameOverData(room) {
  const leaderboard = Object.entries(roomClicks[room])
      .map(([username, clicks]) => ({ username, clicks }))
      .sort((a, b) => b.clicks - a.clicks); // Sort from highest to lowest clicks

  const leastClicksUser = leaderboard[leaderboard.length - 1]; // User with the least clicks
  io.to(room).emit('gameOver', { leaderboard: leaderboard, loser: leastClicksUser });
}

io.on('connection', socket => {
  console.log('New client connected:', socket.id);

  // 加入房間
  socket.on('joinRoom', (room, username, isHost) => {
      socket.join(room);
      console.log(typeof(isHost), isHost)
      console.log(`Socket ${socket.id} joined room ${room}`);
      socket.to(room).emit('message', `A new user has joined the room: ${room}`);
      if (isHost) {
        roomHostMap.set(room, username);  // 如果用户是房长，则记录下来
      }
      // 在地圖中記錄socket所在的房間
      socketRoomMap.set(socket.id, room);
      // 獲取房間人數
      const roomCount = io.sockets.adapter.rooms[room].length;
      console.log(roomHostMap)  
      // 向房間內所有客戶端廣播房間人數
      io.to(room).emit('roomData', {count: roomCount});
  });

  // 提供一个方法来发送房间的房长信息
  socket.on('getRoomHost', (room) => {
    const hostId = roomHostMap.get(room);
    socket.emit('roomHostInfo', { room: room, hostId: hostId });
  });

  // 離開房間
  socket.on('leaveRoom', (room) => {
      socket.leave(room);
      console.log(`Socket ${socket.id} left room ${room}`);
      socket.to(room).emit('message', `A user has left the room: ${room}`);
  });

  // 廣播訊息到房間
  socket.on('sendMessage', (room, message) => {
      io.to(room).emit('message', message);
  });

  socket.on('requestNavigate', (data) => {
    io.to(data.room).emit('navigate', data.target);
  });

  socket.on('startGame', (data) => {
    io.to(data.room).emit('gameStarted', data.duration);
  });

  // 接收游戏结束数据并更新 roomClicks
  socket.on('endGame', (data) => {
    const { room, username, clicks } = data;
    updateRoomClicks(room, username, clicks);
    sendGameOverData(room);
  });

  socket.on('Playagain', (data) => {
    io.to(data.room).emit('playagain', data.time);
  });

  socket.on('backtomenu', (data) => {
    io.to(data).emit('back')
  })

  socket.on('disconnect', () => {
      const room = socketRoomMap.get(socket.id);
      console.log('Client disconnected:', socket.id);

      // 移除追蹤
      socketRoomMap.delete(socket.id);
      if (io.sockets.adapter.rooms[room]) {
        const roomCount = io.sockets.adapter.rooms[room].length;
        io.to(room).emit('roomData', {count: roomCount});
      }
  });
  
});
