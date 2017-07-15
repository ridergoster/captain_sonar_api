'use strict';

const express = require('express');
const socketIO = require('socket.io');
const path = require('path');

const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, 'index.html');

const server = express()
  .use((req, res) => res.sendFile(INDEX) )
  .listen(PORT, () => console.log(`Listening on ${ PORT }`));

const io = socketIO(server);


var games = {};

io.sockets.on('connection', function (socket) {

  console.log('hello machin !')
  var playerNb = null;
  var opponentNb = null;
  var room = null;

  socket.on('join', function(data) {

    console.log('YOU JOIN');

    room = data.serverID; // init room for party

    if (!(room in games)) { // CREATE SERVER
      playerNb = 'player_1';
      opponentNb = 'player_2';
      games[room] = {
        status: 'waiting',
        player_1: {
          socket: socket.id,
          username: data.username,
          status: 'prepare',
        },
        player_2: null
      }
      socket.join(room);
      socket.emit('create', {username: data.username, serverID: data.serverID});

      console.log('user ' + data.username + ' create room ' + data.serverID );
    }
    else if ((!games[room].player_1 && games[room].player_2) ||  (!games[room].player_2 && games[room].player_1)) { // JOIN SERVER
      playerNb = !games[room].player_1 ? 'player_1' : 'player_2';
      opponentNb = !games[room].player_1 ? 'player_2' : 'player_1';
      games[room][playerNb] = {
        socket: socket.id,
        username: data.username,
        status: 'prepare',
      }
      socket.join(room);
      socket.emit('join-prepare', {username: data.username, serverID: data.serverID, opponent: games[room][opponentNb].username});
      socket.broadcast.to(games[room][opponentNb].socket).emit('join-opponent', {opponent: data.username});

      console.log('user ' + data.username + ' join room ' + data.serverID );
    }
    else { // ERROR
      console.log('error')
      socket.emit('join-error')
    }
  })

  socket.on('ready', function(data) {
    var x = data.x;
    var y = data.y;

    games[room][playerNb].status = 'ready';
    socket.broadcast.to(games[room][opponentNb].socket).emit('ready-opponent', data);
    console.log(games[room][playerNb].username + ' READY FOR POS: ' + x + ' - ' + y);
    if (games[room][opponentNb].status === 'ready') {
      setTimeout(function(){
        io.to(room).emit('start');
      }, 1000);
    }
  })

  socket.on('move', function (data) {
      socket.broadcast.to(games[room][opponentNb].socket).emit('move', data);
  });

  socket.on('mine', function (data) {
    socket.broadcast.to(games[room][opponentNb].socket).emit('mine', data);
  });

  socket.on('radar', function (data) {
    socket.broadcast.to(games[room][opponentNb].socket).emit('radar');
  });

  socket.on('silence', function (data) {
    socket.broadcast.to(games[room][opponentNb].socket).emit('silence');
  });

  socket.on('emerge', function () {
    socket.broadcast.to(games[room][opponentNb].socket).emit('emerge');
  });

  socket.on('dive', function () {
    socket.broadcast.to(games[room][opponentNb].socket).emit('dive');
  });

  socket.on('hit', function (data) {
    socket.broadcast.to(games[room][opponentNb].socket).emit('hit');
  });

  socket.on('die', function (data) {
    socket.broadcast.to(games[room][opponentNb].socket).emit('win');
  });

  socket.on('disconnect', function(socket) {
      console.log('Got disconnect!');
      if (playerNb != null) {
        var username = games[room][playerNb].username;
        games[room][playerNb] = null;
        if (opponentNb != null && games[room][opponentNb] == null) {
          delete games[room];
          console.log('room ' + room + ' delete ! END OF GAME');
        } else {
          io.to(games[room][opponentNb].socket).emit('leave-opponent', {opponent: username});
        }
      }
   });
});

setInterval(() => io.emit('time', new Date().toTimeString()), 1000);
