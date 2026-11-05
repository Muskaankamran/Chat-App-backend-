import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { Types } from "mongoose";
import { createAuthToken } from "../src/utils/auth.utils.js";
import { registerChatSocketHandlers } from "../src/socket/chat.socket.js";

const previousSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = "test-only-secret-with-sufficient-length";

after(() => {
  if (previousSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = previousSecret;
  }
});

function createSocketHarness() {
  const currentUserId = "507f1f77bcf86cd799439011";
  const otherUserId = "507f1f77bcf86cd799439012";
  const conversationId = "507f1f77bcf86cd799439013";
  const currentUser = {
    _id: new Types.ObjectId(currentUserId),
    username: "sam",
    bio: "",
    avatarUrl: "",
    isOnline: true,
    lastSeen: null,
  };
  const conversation = {
    _id: new Types.ObjectId(conversationId),
    participants: [currentUser._id, new Types.ObjectId(otherUserId)],
  };
  const outgoingEvents = [];
  const ioHandlers = new Map();
  const io = {
    use(handler) {
      this.authMiddleware = handler;
    },
    on(event, handler) {
      ioHandlers.set(event, handler);
    },
    to(room) {
      return {
        emit(event, data) {
          outgoingEvents.push({ room, event, data });
        },
      };
    },
  };
  const User = {
    findById(id) {
      assert.equal(id, currentUserId);
      return {
        select: async () => ({ _id: currentUser._id }),
      };
    },
    async updateOne() {},
  };
  const Conversation = {
    async findOne(filter) {
      assert.equal(filter._id, conversationId);
      assert.equal(filter.participants, currentUserId);
      return conversation;
    },
    findById(id) {
      assert.equal(id.toString(), conversationId);
      return {
        select() {
          return {
            lean: async () => ({ participants: conversation.participants }),
          };
        },
      };
    },
    async updateOne() {},
  };
  const Message = {
    async create(input) {
      return {
        _id: new Types.ObjectId(),
        conversation: conversation._id,
        sender: currentUser,
        type: input.type,
        content: input.content,
        mediaUrl: null,
        mediaType: null,
        mediaSize: null,
        readBy: [currentUser],
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        deletedAt: null,
        async populate() {
          return this;
        },
      };
    },
  };
  registerChatSocketHandlers(io, { User, Conversation, Message });
  return {
    io,
    currentUserId,
    conversationId,
    ioHandlers,
    outgoingEvents,
  };
}

function runAuth(io, { token, cookie } = {}) {
  const socket = {
    handshake: {
      auth: token ? { token } : {},
      headers: cookie ? { cookie } : {},
    },
    data: {},
  };
  return new Promise((resolve) => {
    io.authMiddleware(socket, (error) => resolve({ error, socket }));
  });
}

describe("Socket.IO authentication", () => {
  it("allows unauthenticated connections for the existing todo events", async () => {
    const { io } = createSocketHarness();
    const { error, socket } = await runAuth(io);

    assert.equal(error, undefined);
    assert.equal(socket.data.userId, null);
  });

  it("verifies an HttpOnly cookie token and resolves its user", async () => {
    const { io, currentUserId } = createSocketHarness();
    const token = createAuthToken({
      _id: { toString: () => currentUserId },
      role: "user",
    });
    const { error, socket } = await runAuth(io, {
      cookie: `other=value; token=${token}`,
    });

    assert.equal(error, undefined);
    assert.equal(socket.data.userId, currentUserId);
  });

  it("rejects invalid supplied credentials", async () => {
    const { io } = createSocketHarness();
    const { error } = await runAuth(io, { token: "invalid-token" });

    assert.equal(error.message, "Invalid authentication");
  });

  it("denies chat events to anonymous sockets", async () => {
    const { io, ioHandlers } = createSocketHarness();
    const { socket } = await runAuth(io);
    socket.id = "anonymous-socket";
    socket.rooms = new Set([socket.id]);
    socket.on = (event, handler) => socket.handlers.set(event, handler);
    socket.handlers = new Map();
    socket.join = async (room) => socket.rooms.add(room);
    socket.emit = () => {};
    socket.to = () => ({ emit() {} });
    ioHandlers.get("connection")(socket);

    const result = await new Promise((resolve) => {
      socket.handlers.get("chat:send")(
        { conversationId: "507f1f77bcf86cd799439013", content: "hello" },
        resolve,
      );
    });

    assert.equal(result.ok, false);
    assert.equal(result.error.message, "Authentication required.");
  });

  it("persists and broadcasts a message from an authenticated participant", async () => {
    const { io, currentUserId, conversationId, ioHandlers, outgoingEvents } =
      createSocketHarness();
    const token = createAuthToken({
      _id: { toString: () => currentUserId },
      role: "user",
    });
    const { socket } = await runAuth(io, { token });
    socket.id = "authenticated-socket";
    socket.rooms = new Set([socket.id]);
    socket.on = (event, handler) => socket.handlers.set(event, handler);
    socket.handlers = new Map();
    socket.join = async (room) => socket.rooms.add(room);
    socket.emit = () => {};
    socket.to = () => ({ emit() {} });
    ioHandlers.get("connection")(socket);

    const result = await new Promise((resolve) => {
      socket.handlers.get("chat:send")(
        { conversationId, content: "hello" },
        resolve,
      );
    });

    assert.equal(result.ok, true);
    assert.equal(result.data.content, "hello");
    assert.equal(
      outgoingEvents.some((event) => event.event === "chat:message"),
      true,
    );
    assert.equal(
      outgoingEvents.some((event) => event.event === "notification:new"),
      true,
    );
  });
});
