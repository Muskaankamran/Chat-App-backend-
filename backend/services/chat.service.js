import mongoose from "mongoose";
import conversationModel from "../src/models/conversations.model.js";
import messageModel from "../src/models/messages.model.js";

const publicUserFields = "username bio avatarUrl isOnline lastSeen";
const allowedReactionEmojis = new Set(["❤️", "😂", "👍", "😮", "🎉"]);

export class ChatServiceError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "ChatServiceError";
    this.code = code;
  }
}

function getModels(models) {
  return models ?? {
    Conversation: conversationModel,
    Message: messageModel,
  };
}

function idString(value) {
  return value?._id?.toString?.() ?? value?.toString?.() ?? "";
}

export async function getConversationForParticipant(
  conversationId,
  userId,
  models,
) {
  if (!mongoose.isValidObjectId(conversationId)) {
    throw new ChatServiceError("Invalid conversation ID.", "BAD_USER_INPUT");
  }
  const conversation = await getModels(models).Conversation.findOne({
    _id: conversationId,
    participants: userId,
  });
  if (!conversation) {
    throw new ChatServiceError("Conversation not found.", "NOT_FOUND");
  }
  return conversation;
}

export async function sendTextMessage({
  conversationId,
  senderId,
  content,
  models,
}) {
  const text = typeof content === "string" ? content.trim() : "";
  if (!text || text.length > 4000) {
    throw new ChatServiceError(
      "Message must contain 1 to 4000 characters.",
      "BAD_USER_INPUT",
    );
  }

  const modelSet = getModels(models);
  const conversation = await getConversationForParticipant(
    conversationId,
    senderId,
    modelSet,
  );
  const message = await modelSet.Message.create({
    conversation: conversation._id,
    sender: senderId,
    type: "text",
    content: text,
    readBy: [senderId],
  });
  await modelSet.Conversation.updateOne(
    { _id: conversation._id },
    { $set: { lastMessage: message._id, updatedAt: message.createdAt } },
  );
  return message.populate([
    { path: "sender", select: publicUserFields },
    { path: "readBy", select: publicUserFields },
  ]);
}

export async function createMediaMessage({
  conversationId,
  senderId,
  type,
  mediaUrl,
  mediaFileId,
  mediaType,
  mediaSize,
  models,
}) {
  if (!["image", "audio"].includes(type)) {
    throw new ChatServiceError("Unsupported media message type.", "BAD_USER_INPUT");
  }
  if (
    typeof mediaUrl !== "string" ||
    !mediaUrl.startsWith("https://") ||
    typeof mediaType !== "string" ||
    !mediaType.startsWith(`${type}/`) ||
    !Number.isInteger(mediaSize) ||
    mediaSize < 1 ||
    mediaSize > 15 * 1024 * 1024
  ) {
    throw new ChatServiceError("Invalid uploaded media.", "BAD_USER_INPUT");
  }

  const modelSet = getModels(models);
  const conversation = await getConversationForParticipant(
    conversationId,
    senderId,
    modelSet,
  );
  const message = await modelSet.Message.create({
    conversation: conversation._id,
    sender: senderId,
    type,
    mediaUrl,
    mediaFileId,
    mediaType,
    mediaSize,
    readBy: [senderId],
  });
  await modelSet.Conversation.updateOne(
    { _id: conversation._id },
    { $set: { lastMessage: message._id, updatedAt: message.createdAt } },
  );
  return message.populate([
    { path: "sender", select: publicUserFields },
    { path: "readBy", select: publicUserFields },
  ]);
}

export async function markConversationSeen({
  conversationId,
  userId,
  models,
}) {
  const modelSet = getModels(models);
  await getConversationForParticipant(conversationId, userId, modelSet);
  await modelSet.Message.updateMany(
    {
      conversation: conversationId,
      sender: { $ne: userId },
      readBy: { $ne: userId },
      deletedAt: null,
    },
    { $addToSet: { readBy: userId } },
  );
  return {
    conversationId: idString(conversationId),
    userId: idString(userId),
    seenAt: new Date().toISOString(),
  };
}

export async function deleteOwnMessage({ messageId, userId, models }) {
  if (!mongoose.isValidObjectId(messageId)) {
    throw new ChatServiceError("Invalid message ID.", "BAD_USER_INPUT");
  }

  const modelSet = getModels(models);
  const message = await modelSet.Message.findOne({
    _id: messageId,
    sender: userId,
  });
  if (!message) {
    throw new ChatServiceError("Message not found.", "NOT_FOUND");
  }

  const conversation = await getConversationForParticipant(
    idString(message.conversation),
    userId,
    modelSet,
  );
  message.content = null;
  message.mediaUrl = null;
  message.mediaType = null;
  message.mediaSize = null;
  message.deletedAt = new Date();
  await message.save();

  if (idString(conversation.lastMessage) === idString(message)) {
    const previousMessage = await modelSet.Message.findOne({
      conversation: conversation._id,
      deletedAt: null,
    }).sort({ createdAt: -1 });
    await modelSet.Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessage: previousMessage?._id ?? null,
          updatedAt: previousMessage?.createdAt ?? message.deletedAt,
        },
      },
    );
  }

  return message.populate([
    { path: "sender", select: publicUserFields },
    { path: "readBy", select: publicUserFields },
  ]);
}

export async function toggleMessageReaction({
  messageId,
  userId,
  emoji,
  models,
}) {
  if (!mongoose.isValidObjectId(messageId)) {
    throw new ChatServiceError("Invalid message ID.", "BAD_USER_INPUT");
  }
  if (!allowedReactionEmojis.has(emoji)) {
    throw new ChatServiceError("Unsupported reaction.", "BAD_USER_INPUT");
  }

  const modelSet = getModels(models);
  const message = await modelSet.Message.findOne({
    _id: messageId,
    deletedAt: null,
  });
  if (!message) {
    throw new ChatServiceError("Message not found.", "NOT_FOUND");
  }
  await getConversationForParticipant(
    idString(message.conversation),
    userId,
    modelSet,
  );

  const reactions = message.reactions ?? [];
  const existingIndex = reactions.findIndex(
    (reaction) =>
      idString(reaction.user) === idString(userId) &&
      reaction.emoji === emoji,
  );
  if (existingIndex >= 0) {
    reactions.splice(existingIndex, 1);
  } else {
    reactions.push({ user: userId, emoji, addedAt: new Date() });
  }
  message.reactions = reactions;
  await message.save();
  return message.populate([
    { path: "sender", select: publicUserFields },
    { path: "readBy", select: publicUserFields },
    { path: "reactions.user", select: "_id" },
  ]);
}

export function serializeMessageForSocket(message) {
  const sender = message.sender;
  return {
    id: idString(message),
    conversationId: idString(message.conversation),
    sender: {
      id: idString(sender),
      username: sender.username,
      bio: sender.bio ?? "",
      avatarUrl: sender.avatarUrl ?? "",
      isOnline: sender.isOnline ?? false,
      lastSeen: sender.lastSeen?.toISOString?.() ?? sender.lastSeen ?? null,
    },
    type: message.type.toUpperCase(),
    content: message.content,
    mediaUrl: message.mediaUrl,
    mediaType: message.mediaType,
    mediaSize: message.mediaSize,
    readBy: (message.readBy ?? []).map(idString),
    reactions: (message.reactions ?? []).map((reaction) => ({
      emoji: reaction.emoji,
      userId: idString(reaction.user),
    })),
    isDeleted: Boolean(message.deletedAt),
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}
