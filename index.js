var app = require("express")();
var http = require("http").Server(app);
var io = require("socket.io")(http);
var port = process.env.PORT || 3000;

var connections = [];
var users = [];

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html");
});

io.on("connection", function (socket) {
  connections.push(socket.id);
  //connections
  console.log("number of connections: " + connections.length);

  //disconnect
  socket.on("disconnect", function (data) {
    users.splice(users.indexOf(socket.username), 1);

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
