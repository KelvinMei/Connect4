var app = require("express")();
var http = require("http").Server(app);
var io = require("socket.io")(http);
var port = process.env.PORT || 3000;

var connections = [];
var users = [];
var rooms = [];

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html");
});

io.on("connection", function (socket) {
  connections.push(socket.id);
  //connections
  console.log("number of connections: " + connections.length);

  //join lobby
  do {
    var roomId = Math.floor(Math.random() * 100);
  } while (rooms.includes(roomId));

  socket.join(roomId);
  rooms.push(roomId);
  console.log(rooms);
  io.to(roomId).emit("roomId", roomId);

  //disconnect
  socket.on("disconnect", function (data) {
    users.splice(users.indexOf(socket.username), 1);
    rooms.splice(rooms.indexOf(roomId), 1);
    connections.splice(connections.indexOf(socket.id), 1);

    console.log("number of connections: " + connections.length);
  });

  //new user
  socket.on("new users", function () {
    do {
      socket.username = randomUsername();
    } while (users.includes(socket.username));

    users.push(socket.username);
    io.sockets.connected[socket.id].emit("username", socket.username);
  });

  socket.on("existing users", function (name) {
    socket.username = name;

    while (users.includes(socket.username)) {
      //username taken
      oldname = socket.username;
      socket.username = randomUsername();
    }

    users.push(socket.username);
    io.sockets.connected[socket.id].emit("username", socket.username);
  });

  socket.on("change username", function (data) {
    if (users.includes(data.new)) {
      //name taken
      //reject name, not play
      usernameTaken(data.old, data.new);
    } else {
      //change name
      if (users.includes(data.old)) {
        users.splice(users.indexOf(data.old), 1);
      }

      socket.username = data.new;
      users.push(socket.username);
      io.sockets.connected[socket.id].emit("username", socket.username);
    }
  });

  socket.on("code lobby", function (id) {
    if (io.sockets.adapter.rooms[id] != undefined && id != roomId) {
      //code lobby
      console.log("code lobby");
      socket.leave(roomId);
      rooms.splice(rooms.indexOf(roomId), 1);
      socket.join(id);
      playerLimit(id);
    } else if (id == -1 && rooms.length > 1) {
      //random lobby
      console.log("random lobby");
      socket.leave(roomId);
      rooms.splice(rooms.indexOf(roomId), 1);
      socket.join(rooms[0]);
      playerLimit(rooms[0]);
    } else {
      io.sockets.connected[socket.id].emit("no players");
    }
  });

  function playerLimit(id) {
    if (io.sockets.adapter.rooms[id].length == 2) {
      rooms.splice(rooms.indexOf(id), 1);

      io.in(id).clients((error, clients) => {
        if (error) throw error;

        var first = clients[Math.floor(Math.random() * clients.length)];
        var second = clients.filter((client) => client != first);

        io.sockets.connected[first].gameboard = new Array(6);
        io.sockets.connected[second[0]].gameboard = new Array(6);
        for (i = 0; i < 6; i++) {
          io.sockets.connected[first].gameboard[i] = new Array(7);
          io.sockets.connected[second[0]].gameboard[i] = new Array(7);
        }

        io.to(id).emit("start game");

        io.sockets.connected[first].emit("my turn", {
          name: io.sockets.connected[first].username,
          color: "rgb(255, 0, 0)",
        });
        io.sockets.connected[second[0]].emit(
          "wait for turn",
          io.sockets.connected[first].username
        );
      });
    } else {
      io.sockets.connected[socket.id].emit("no 2 players");
      //must have 2 players in lobby
    }
  }

  socket.on("place", function (data) {
    let rooms = Object.keys(socket.rooms).filter(function (item) {
      return item !== socket.id;
    });

    io.in(rooms[0]).clients((error, clients) => {
      if (error) throw error;
      var now = clients.filter((client) => client == socket.id);
      var next = clients.filter((client) => client != socket.id);

      for (i = 0; i < 6; i++) {
        if (
          io.sockets.connected[now[0]].gameboard[i][data.column] == undefined &&
          io.sockets.connected[next[0]].gameboard[i][data.column] == undefined
        ) {
          socket.gameboard[i][data.column] = data.color;
          io.sockets.connected[next[0]].gameboard[i][data.column] = data.color;
          break;
        }
      }

      var nextColor =
        data.color == "rgb(255, 0, 0)" ? "rgb(255, 255, 0)" : "rgb(255, 0, 0)";

      io.to(rooms[0]).emit("populateGameBoard", {
        array: socket.gameboard,
        color: data.color,
      });

      if (checkWin(socket.gameboard) == true) {
        //win
        io.to(rooms[0]).emit("win game", socket.username);
      } else if (
        !socket.gameboard.some((element) => element.includes(undefined))
      ) {
        io.to(rooms[0]).emit("tie game");
      } else {
        //keep playing
        io.sockets.connected[next[0]].emit("my turn", {
          name: io.sockets.connected[next[0]].username,
          color: nextColor,
        });

        io.sockets.connected[now[0]].emit(
          "wait for turn",
          io.sockets.connected[next[0]].username
        );
      }
    });
  });

  function checkWin(board) {
    for (i = 0; i < 6; i++) {
      for (j = 0; j < 7; j++) {
        if (board[i][j] == undefined) {
          continue;
        }

        if (checkPiece(board, i, j) == true) {
          return true;
        }
      }
    }
  }

  function checkPiece(board, up, right) {
    var color = board[up][right];
    var count = 0;
    var i = 0;
    //horizontal
    for (i = 0; i < 4; i++) {
      if (right + i > 6 || board[up][right + i] == undefined) {
        break;
      }

      if (board[up][right + i] == color) {
        count++;
        if (count == 4) {
          return true;
        }
      } else {
        break;
      }
    }

    count = 0;
    i = 0;
    //vertical
    for (i = 0; i < 4; i++) {
      if (up + i > 5 || board[up + i][right] == undefined) {
        break;
      }

      if (board[up + i][right] == color) {
        count++;
        if (count == 4) {
          return true;
        }
      } else {
        break;
      }
    }

    count = 0;
    i = 0;
    //diagonal up right
    for (i = 0; i < 4; i++) {
      if (
        up + i > 5 ||
        right + i > 6 ||
        board[up + i][right + i] == undefined
      ) {
        break;
      }

      if (board[up + i][right + i] == color) {
        count++;
        if (count == 4) {
          return true;
        }
      } else {
        break;
      }
    }

    count = 0;
    i = 0;
    //diagonal up left
    for (i = 0; i < 4; i++) {
      if (
        up + i > 5 ||
        right - i < 0 ||
        board[up + i][right - i] == undefined
      ) {
        break;
      }
      if (board[up + i][right - i] == color) {
        count++;
        if (count == 4) {
          return true;
        }
      } else {
        break;
      }
    }
    return false;
  }

  function randomUsername() {
    let parts = [];
    parts.push(["Small", "Big", "Medium", "Miniscule"]);
    parts.push(["Red", "Blue", "Bad", "Good", "Round"]);
    parts.push(["Bear", "Dog", "Potato", "Orangutan", "Klingon"]);

    username = "";
    for (part of parts) {
      username += part[Math.floor(Math.random() * part.length)];
    }
    return username;
  }

  function usernameTaken(oldname, newname) {
    io.sockets.connected[socket.id].emit("name taken", {
      old: oldname,
      new: newname,
    });
  }
});

http.listen(port, function () {
  console.log("listening on *:" + port);
});
