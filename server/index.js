const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { faker } = require("@faker-js/faker");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(cors());

const port = 3333;

let users = new Map();

class User {
  constructor(id) {
    this.id = id;
    this.name = faker.name.findName();
  }
}

io.on("connection", (socket) => {
  const user = new User(socket.id);
  users.set(socket.id, user);

  socket.emit("welcome", user, Array.from(users.values()));

  socket.on("disconnect", () => {
    users.delete(socket.id);
    socket.broadcast.emit("user-leaved", socket.id);
  });

  socket.on('open_camera', () => {
    socket.broadcast.emit("user-joined", user);
  });

  socket.on("web-rtc:candidate", (toId, candidate) => {
    console.log("%s send candidate to %s", user.name, users.get(toId).name);
    socket.to(toId).emit("web-rtc:candidate", user, candidate);
  });

  socket.on("web-rtc:offer", (toId, offer) => {
    console.log("%s send a offer to %s", user.name, users.get(toId).name);
    socket.to(toId).emit("web-rtc:offer", user, offer);
  });

  socket.on("web-rtc:answer", (toId, answer) => {
    console.log("%s send a answer to %s", user.name, users.get(toId).name);
    socket.to(toId).emit("web-rtc:answer", user, answer);
  });
});

server.listen(port, () => {
  console.log("listening on http://localhost:" + port);
});
