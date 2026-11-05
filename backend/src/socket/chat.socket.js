import { verifyAuthToken } from "../utils/auth.utils.js";
import userModel from "../models/users.model.js";
import conversationModel from "../models/conversations.model.js";
import messageModel from "../models/messages.model.js";
import {
  ChatServiceError,
  getConversationForParticipant,
  markConversationSeen,
  sendTextMessage,
} from "../../services/chat.service.js";
import {
  conversationRoom,
  emitChatMessage,
  emitSeenUpdate,
  userRoom,
} from "./emitters.js";

const userSockets = new Map();

function getHandshakeToken(socket) {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken) {
    return authToken;
  }

  const authorization = socket.handshake.headers.authorization;
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearerToken) {
    return bearerToken;
  }

  const cookie = socket.handshake.headers.cookie
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("token="));
  if (!cookie) {
    return null;
  }
  try {
    return decodeURIComponent(cookie.slice("token=".length));
  } catch {
    return null;
  }
}

function requireSocketUser(socket) {
  if (!socket.data.userId) {
    throw new ChatServiceError("Authentication required.", "UNAUTHENTICATED");
  }
  return socket.data.userId;
}

function notifySocketError(socket, acknowledge, error) {
  if (!(error instanceof ChatServiceError)) {
    console.error(error);
  }
  const message = error instanceof ChatServiceError
    ? error.message
    : "The chat request could not be completed.";
  const response = { ok: false, error: { message } };
  socket.emit("chat:error", response.error);
  if (typeof acknowledge === "function") {
    acknowledge(response);
  }
}

async function performSocketAction(socket, acknowledge, action) {
  try {
    const data = await action();
    if (typeof acknowledge === "function") {
      acknowledge({ ok: true, data });
    }
  } catch (error) {
    notifySocketError(socket, acknowledge, error);
  }
}

async function setUserOnline(io, userId, isOnline, User) {
  const update = isOnline
    ? { isOnline: true, lastSeen: null }
    : { isOnline: false, lastSeen: new Date() };
  await User.updateOne({ _id: userId }, { $set: update });
  io.to("chat:authenticated").emit("presence:update", {
    userId,
    isOnline,
    lastSeen: isOnline ? null : update.lastSeen.toISOString(),
  });
}

export function registerChatSocketHandlers(io, models = {}) {
  const User = models.User ?? userModel;
  const Conversation = models.Conversation ?? conversationModel;
  const chatModels = {
    Conversation,
    Message: models.Message ?? messageModel,
  };

  io.use(async (socket, next) => {
    const token = getHandshakeToken(socket);
    if (!token) {
      socket.data.userId = null;
      return next();
    }
    let payload;
    try {
      payload = verifyAuthToken(token);
    } catch {
      return next(new Error("Invalid authentication"));
    }
    let user;
    try {
      user = await User.findById(payload.id).select("_id");
    } catch (error) {
      console.error(error);
      return next(new Error("Authentication service unavailable"));
    }
    if (!user) {
      return next(new Error("Invalid authentication"));
    }
    socket.data.userId = user._id.toString();
    return next();
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    if (userId) {
      let sockets = userSockets.get(userId);
      const firstConnection = !sockets;
      if (!sockets) {
        sockets = new Set();
        userSockets.set(userId, sockets);
      }
      sockets.add(socket.id);
      socket.join(userRoom(userId));
      socket.join("chat:authenticated");
      if (firstConnection) {
        setUserOnline(io, userId, true, User).catch((error) => {
          console.error(error);
          socket.emit("chat:error", {
            message: "Could not update online status.",
          });
        });
      }
    }

    socket.on("chat:join", (payload = {}, acknowledge) => {
      performSocketAction(socket, acknowledge, async () => {
        const authenticatedUserId = requireSocketUser(socket);
        const conversation = await getConversationForParticipant(
          payload.conversationId,
          authenticatedUserId,
          chatModels,
        );
        await socket.join(conversationRoom(conversation._id.toString()));
        return { conversationId: conversation._id.toString() };
      });
    });

    socket.on("chat:send", (payload = {}, acknowledge) => {
      performSocketAction(socket, acknowledge, async () => {
        const authenticatedUserId = requireSocketUser(socket);
        const message = await sendTextMessage({
          conversationId: payload.conversationId,
          senderId: authenticatedUserId,
          content: payload.content,
          models: chatModels,
        });
        const serialized = await emitChatMessage(io, message, Conversation);
        return serialized;
      });
    });

    socket.on("chat:typing", (payload = {}, acknowledge) => {
      performSocketAction(socket, acknowledge, async () => {
        const authenticatedUserId = requireSocketUser(socket);
        const conversation = await getConversationForParticipant(
          payload.conversationId,
          authenticatedUserId,
          chatModels,
        );
        const room = conversationRoom(conversation._id.toString());
        if (!socket.rooms.has(room)) {
          throw new ChatServiceError(
            "Join the conversation before sending typing updates.",
            "FORBIDDEN",
          );
        }
        const typing = {
          conversationId: conversation._id.toString(),
          userId: authenticatedUserId,
          isTyping: Boolean(payload.isTyping),
        };
        socket.to(room).emit("chat:typing", typing);
        return typing;
      });
    });

    socket.on("chat:seen", (payload = {}, acknowledge) => {
      performSocketAction(socket, acknowledge, async () => {
        const authenticatedUserId = requireSocketUser(socket);
        const receipt = await markConversationSeen({
          conversationId: payload.conversationId,
          userId: authenticatedUserId,
          models: chatModels,
        });
        emitSeenUpdate(io, receipt);
        return receipt;
      });
    });

    socket.on("disconnect", () => {
      if (!userId) {
        return;
      }
      const sockets = userSockets.get(userId);
      sockets?.delete(socket.id);
      if (sockets?.size === 0) {
        userSockets.delete(userId);
        setUserOnline(io, userId, false, User).catch((error) => {
          console.error(error);
        });
      }
    });
  });
}
