var app = require("express")();
var http = require("http").Server(app);
var io = require("socket.io")(http);
var port = process.env.PORT || 3000;

var connections = [];
var users = [];
var listOfMessages = [];

app.get("/", function(req, res) {
  res.sendFile(__dirname + "/index.html");
});

io.on("connection", function(socket) {
  connections.push(socket.id);
  //connections
  console.log("number of connections: " + connections.length);

  //disconnect
  socket.on("disconnect", function(data) {
    users.splice(users.indexOf(socket.username), 1);
    updateUsernames();

    connections.splice(connections.indexOf(socket.id), 1);

    console.log("number of connections: " + connections.length);

    var object = {
      name: socket.username,
      message: " has left the chat.",
      time: "",
      color: socket.color,
      strong: false
    };

    listOfMessages.push(object);
    io.emit("new message", object);
  });

  //send message
  socket.on("send message", function(msg) {
    if (msg.startsWith("/nick ")) {
      if (users.includes(msg.substring(6, msg.length))) {
        //cannot change names
        usernameTaken(msg.substring(6, msg.length), socket.username);
      } else {
        //change of name
        users.splice(users.indexOf(socket.username), 1);
        var object = {
          name: socket.username,
          message: " has changed their name to " + msg.substring(6, msg.length),
          time: "",
          color: socket.color,
          strong: false
        };
        socket.username = msg.substring(6, msg.length);
        users.push(socket.username);
        updateUsername(socket.username);
        updateUsernames();

        listOfMessages.push(object);
        socket.broadcast.emit("new message", object);

        object.strong = true;
        io.sockets.connected[socket.id].emit("new message", object);
      }

      //change of color
    } else if (msg.startsWith("/nickcolor ")) {
      if (/^[A-Fa-f0-9]{6}$/i.test(msg.substring(11, msg.length))) {
        socket.color = msg.substring(11, msg.length);

        var object = {
          name: socket.username,
          message: " has changed their color to " + socket.color,
          time: "",
          color: socket.color,
          strong: false
        };

        listOfMessages.push(object);
        socket.broadcast.emit("new message", object);

        object.strong = true;
        io.sockets.connected[socket.id].emit("new message", object);
      } else {
        invalidcolor(msg.substring(11, msg.length));
      }
    } else if (msg.startsWith("/")) {
      invalidcommand(msg);
    } else {
      const date = new Date();
      var hr = date.getHours();
      var min = date.getMinutes();
      if (min < 10) {
        min = "0" + min;
      }
      var time = hr + ":" + min + " ";

      var object = {
        name: socket.username,
        message: ": " + msg,
        time: time,
        color: socket.color,
        strong: false
      };

      listOfMessages.push(object);
      socket.broadcast.emit("new message", object);

      object.strong = true;
      io.sockets.connected[socket.id].emit("new message", object);
    }
  });

  //new user
  socket.on("new users", function() {
    do {
      socket.username = "User" + Math.floor(Math.random() * 10);
    } while (users.includes(socket.username));

    socket.color = "000000";

    users.push(socket.username);
    updateUsername(socket.username);
    updateUsernames();

    var object = {
      name: socket.username,
      message: " has joined the chat.",
      time: "",
      color: socket.color,
      strong: false
    };

    listOfMessages.push(object);
    io.emit("new message", object);
  });

  //update username list
  function updateUsernames() {
    io.emit("get users", users);
  }

  function usernameTaken(oldname, newname) {
    io.sockets.connected[socket.id].emit("name taken", {
      old: oldname,
      new: newname
    });
  }

  socket.on("get message", function() {
    io.sockets.connected[socket.id].emit("get message", listOfMessages);
  });

  socket.on("existing users", function(name) {
    socket.username = name;
    socket.color = "000000";

    while (users.includes(socket.username)) {
      //username taken
      oldname = socket.username;
      socket.username = "User" + Math.floor(Math.random() * 10);
      usernameTaken(oldname, socket.username);
    }

    for (i = listOfMessages.length; i > 0; i--) {
      if (listOfMessages[i - 1].name == socket.username) {
        socket.color = listOfMessages[i - 1].color;
        break;
      }
    }

    users.push(socket.username);
    updateUsername(socket.username);
    updateUsernames();

    var object = {
      name: socket.username,
      message: " has joined the chat.",
      time: "",
      color: socket.color,
      strong: false
    };

    listOfMessages.push(object);
    io.emit("new message", object);
  });

  //error check functions
  function invalidcommand(msg) {
    io.sockets.connected[socket.id].emit("invalid command", msg);
  }

  function invalidcolor(color) {
    io.sockets.connected[socket.id].emit("invalid color", color);
  }

  function updateUsername(name) {
    io.sockets.connected[socket.id].emit("username", name);
  }
});

http.listen(port, function() {
  console.log("listening on *:" + port);
});
