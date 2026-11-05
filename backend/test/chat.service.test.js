import assert from "node:assert/strict";
import { Types } from "mongoose";
import { describe, it } from "node:test";
import {
  ChatServiceError,
  markConversationSeen,
  sendTextMessage,
  serializeMessageForSocket,
  toggleMessageReaction,
} from "../services/chat.service.js";

const userId = new Types.ObjectId().toString();
const conversationId = new Types.ObjectId().toString();
const otherUserId = new Types.ObjectId().toString();

function createModels({ isMember = true } = {}) {
  const updates = [];
  const created = [];
  const conversation = {
    _id: new Types.ObjectId(conversationId),
    participants: [userId, otherUserId],
  };
  const models = {
    Conversation: {
      async findOne(filter) {
        assert.equal(filter._id, conversationId);
        assert.equal(filter.participants, userId);
        return isMember ? conversation : null;
      },
      async updateOne(...args) {
        updates.push(args);
      },
    },
    Message: {
      async create(input) {
        created.push(input);
        const message = {
          _id: new Types.ObjectId(),
          conversation: conversation._id,
          sender: {
            _id: new Types.ObjectId(userId),
            username: "sam",
            bio: "",
            avatarUrl: "",
            isOnline: true,
            lastSeen: null,
          },
          type: input.type,
          content: input.content,
          mediaUrl: null,
          mediaType: null,
          mediaSize: null,
          readBy: [{
            _id: new Types.ObjectId(userId),
            username: "sam",
          }],
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          deletedAt: null,
          async populate() {
            return this;
          },
        };
        return message;
      },
      async updateMany(...args) {
        updates.push(args);
      },
    },
  };
  return { models, created, updates };
}

describe("chat persistence services", () => {
  it("persists messages only for conversation participants", async () => {
    const { models, created, updates } = createModels();
    const message = await sendTextMessage({
      conversationId,
      senderId: userId,
      content: "  hello  ",
      models,
    });

    assert.equal(created[0].content, "hello");
    assert.equal(created[0].sender, userId);
    assert.equal(updates[0][1].$set.lastMessage.toString(), message._id.toString());
    assert.equal(serializeMessageForSocket(message).sender.username, "sam");
  });

  it("rejects non-participants before creating messages", async () => {
    const { models, created } = createModels({ isMember: false });

    await assert.rejects(
      sendTextMessage({
        conversationId,
        senderId: userId,
        content: "hello",
        models,
      }),
      (error) => error instanceof ChatServiceError && error.code === "NOT_FOUND",
    );
    assert.equal(created.length, 0);
  });

  it("marks only other participants' unread messages as seen", async () => {
    const { models, updates } = createModels();
    const receipt = await markConversationSeen({
      conversationId,
      userId,
      models,
    });

    assert.equal(receipt.conversationId, conversationId);
    assert.equal(updates[0][0].sender.$ne, userId);
    assert.equal(updates[0][0].readBy.$ne, userId);
    assert.deepEqual(updates[0][1], { $addToSet: { readBy: userId } });
  });

  it("toggles an authenticated participant's allowed emoji reaction", async () => {
    const message = {
      _id: new Types.ObjectId(),
      conversation: new Types.ObjectId(conversationId),
      reactions: [],
      async save() {},
      async populate() {
        return this;
      },
    };
    const models = {
      Conversation: {
        async findOne() {
          return { _id: new Types.ObjectId(conversationId) };
        },
      },
      Message: {
        async findOne() {
          return message;
        },
      },
    };

    await toggleMessageReaction({
      messageId: message._id.toString(),
      userId,
      emoji: "👍",
      models,
    });
    assert.equal(message.reactions.length, 1);
    assert.equal(serializeMessageForSocket({
      ...message,
      sender: { _id: new Types.ObjectId(userId), username: "sam" },
      createdAt: new Date(),
      updatedAt: new Date(),
      type: "text",
      readBy: [],
    }).reactions[0].userId, userId);

    await toggleMessageReaction({
      messageId: message._id.toString(),
      userId,
      emoji: "👍",
      models,
    });
    assert.equal(message.reactions.length, 0);
  });
});
