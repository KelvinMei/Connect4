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
      io.to(id).emit("start game");
    } else {
      io.sockets.connected[socket.id].emit("no 2 players");
      //must have 2 players in lobby
    }
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
