import { io } from "socket.io-client";
import { API_URL } from "./apollo.js";

export function createChatSocket() {
  return io(import.meta.env.VITE_SOCKET_URL || API_URL, {
    autoConnect: false,
    withCredentials: true,
    transports: ["websocket", "polling"],
  });
}
