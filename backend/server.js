import app from "./src/app.js"
import connectDB from "./src/db/db.js"
import { mountGraphQL } from "./src/graphql/index.js";
import { Server } from "socket.io";
import { createServer } from "http";
import { corsOptions } from "./src/utils/cors-options.js";
import { registerChatSocketHandlers } from "./src/socket/chat.socket.js";

const port = Number(process.env.PORT || 3000);
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: corsOptions,
});
app.set("io", io);
registerChatSocketHandlers(io);

io.on("connection", (socket) => {
 console.log("Socket Connected", socket.id);
 socket.on("add-todo",(data)=>{
    console.log(data);   
    io.emit("send-todo",data)
 })
 socket.on("delete-todo",({id})=>{
    io.emit("todo-deleted",{id})
 })
 socket.on("update-todo", (updatedTodo) => {
    io.emit("todo-updated", updatedTodo)
 });
});

async function startServer() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }
  await connectDB();
  await mountGraphQL(app);
  httpServer.listen(port, () => {
    console.log(`Chat backend listening on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start backend", error);
  process.exitCode = 1;
});