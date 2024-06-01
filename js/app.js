const io = require('socket.io')(8080, {
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
let rooms = {}; // 房间的集合


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

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]]; // 交换元素
  }
  return array;
}

function advanceTurn(room) {
  rooms[room].currentPlayerIndex = (rooms[room].currentPlayerIndex + 1) % rooms[room].players.length;
}

function promptNextPlayer(room) {
    const nextPlayerId = rooms[room].players[rooms[room].currentPlayerIndex].socketId;
    const nextPlayerSocket = io.sockets.connected[nextPlayerId]; // 获取socket实例

    if (nextPlayerSocket) {
        nextPlayerSocket.emit('yourTurn'); // 直接向该用户发送消息
    } else {
        console.log("Socket not found for player with ID:", nextPlayerId);
    }
}



io.on('connection', socket => {
  console.log('New client connected:', socket.id);

  socket.on('Createroom',(roomname) => {
    if(!rooms[roomname]){
      socket.emit('CreateroomExist', true)
    }else{
      socket.emit('CreateroomExist', false)
    }
  })

  socket.on('Joinroom',(roomname) => {
    if(!rooms[roomname]){
      socket.emit('JoinroomExist', true)
    }else{
      socket.emit('JoinroomExist', false)
    }
  })

  // 加入房間
  socket.on('joinRoom', (room, username, isHost) => {
      socket.join(room);
      if (!rooms[room]) {
        rooms[room] = {
          secretNumber: null,
          players: [],
          currentPlayerIndex: 0,
          height: 0
        };
      }
      rooms[room].players.push({ username: username, socketId: socket.id, isHost: isHost });
      console.log(typeof(isHost), isHost)
      console.log(`Socket ${socket.id} joined room ${room}`);
      console.log(rooms[room])
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

  socket.on('startGamesecret', (room) => {
    // 为每个房间随机设置密码
    rooms[room].secretNumber = Math.floor(Math.random() * 99) + 1;
    console.log('密碼是', rooms[room].secretNumber);
    // 为房间内的玩家随机设置猜测顺序
    rooms[room].players = shuffleArray(rooms[room].players);
    console.log(rooms[room])
    // 通知房间内的所有客户端游戏开始和当前顺序
    io.to(room).emit('gameStartedsecret', { players: rooms[room].players , secret: rooms[room].secretNumber});
    promptNextPlayer(room);
  });

  socket.on('guessNumber', (room, guess, min, max) => {
    if(guess === rooms[room].secretNumber){
      loser = rooms[room].players[rooms[room].currentPlayerIndex].username
      io.to(room).emit('endGamesecret', loser)
      
    }else if(guess < rooms[room].secretNumber){
      min = guess
      io.to(room).emit('updateRange', min, max)
      advanceTurn(room);
      promptNextPlayer(room);
    }else{
      max = guess
      io.to(room).emit('updateRange', min, max)
      advanceTurn(room);
      promptNextPlayer(room);
    }
  });

  socket.on('startGamebeer', (room) => {
    rooms[room].height = 0
    rooms[room].players = shuffleArray(rooms[room].players);
    io.to(room).emit('gameStartedbeer', { players: rooms[room].players , secret: rooms[room].secretNumber})
    promptNextPlayer(room);
  })

  socket.on('pourLiquid', (room) => {
    io.to(room).emit('updateImg')
  })

  socket.on('stopPouring', (room) => {
    io.to(room).emit('stopImg')
  })

  socket.on('updateH', (room, liquidHeight) => {
    if (liquidHeight > rooms[room].height){
      rooms[room].height = liquidHeight
    }
  })

  socket.on('updateImg', (room) => {
    io.to(room).emit('updateHH', rooms[room].height)
  })

  socket.on('nextTurn', (room) => {
    advanceTurn(room);
    promptNextPlayer(room);
  })

  socket.on('endGamebeer', (room) => {
    io.to(room).emit('gameEndedbeer', rooms[room].players[rooms[room].currentPlayerIndex].username)
  })

  socket.on('backtomenu', (data) => {
    io.to(data).emit('back')
  })

  socket.on('disconnect', () => {
      const room = socketRoomMap.get(socket.id);
      console.log('Client disconnected:', socket.id);
      for (let room in rooms) {
        rooms[room].players = rooms[room].players.filter(player => player.socketId !== socket.id);
        if (rooms[room].players.length === 0) {
            delete rooms[room]; // 如果房间内没有玩家，删除该房间数据
            delete roomClicks[room];
        }
      }
      // 移除追蹤
      socketRoomMap.delete(socket.id);
      if (io.sockets.adapter.rooms[room]) {
        const roomCount = io.sockets.adapter.rooms[room].length;
        io.to(room).emit('roomData', {count: roomCount});
      }
  });
  
});
