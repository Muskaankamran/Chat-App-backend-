import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import userModel from "../models/users.model.js";
import conversationModel from "../models/conversations.model.js";
import messageModel from "../models/messages.model.js";
import {
  ChatServiceError,
  deleteOwnMessage,
  markConversationSeen,
  sendTextMessage,
  toggleMessageReaction,
} from "../../services/chat.service.js";
import { emitChatMessage, emitSeenUpdate } from "../socket/emitters.js";

const publicUserFields = "username bio avatarUrl isOnline lastSeen";

function getModels(context) {
  return context.models ?? {
    User: userModel,
    Conversation: conversationModel,
    Message: messageModel,
  };
}

function requireAuth(context) {
  if (!context.auth?.id) {
    throw new GraphQLError("Authentication required.", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  return context.auth.id;
}

function notFound(message) {
  return new GraphQLError(message, { extensions: { code: "NOT_FOUND" } });
}

function invalidInput(message) {
  return new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
}

function objectIdString(value) {
  return value?._id?.toString?.() ?? value?.toString?.() ?? "";
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function runChatService(action) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ChatServiceError) {
      throw new GraphQLError(error.message, {
        extensions: { code: error.code },
      });
    }
    throw error;
  }
}

async function requireConversation(models, conversationId, userId) {
  if (!mongoose.isValidObjectId(conversationId)) {
    throw invalidInput("Invalid conversation ID.");
  }
  const conversation = await models.Conversation.findOne({
    _id: conversationId,
    participants: userId,
  });
  if (!conversation) {
    throw notFound("Conversation not found.");
  }
  return conversation;
}

export const resolvers = {
  Query: {
    me: async (_parent, _args, context) => {
      const userId = requireAuth(context);
      const user = await getModels(context).User.findById(userId)
        .select("username email bio avatarUrl isOnline lastSeen")
        .lean();
      if (!user) {
        throw notFound("User not found.");
      }
      return user;
    },

    users: async (_parent, { search = "" }, context) => {
      const userId = requireAuth(context);
      const models = getModels(context);
      const filter = { _id: { $ne: userId } };
      const query = (search ?? "").trim();
      if (query) {
        filter.username = { $regex: escapeRegex(query), $options: "i" };
      }
      return models.User.find(filter)
        .select(publicUserFields)
        .sort({ username: 1 })
        .limit(50)
        .lean();
    },

    conversations: async (_parent, _args, context) => {
      const userId = requireAuth(context);
      return getModels(context).Conversation.find({ participants: userId })
        .populate("participants", publicUserFields)
        .populate("lastMessage")
        .sort({ updatedAt: -1 })
        .lean();
    },

    conversationMessages: async (
      _parent,
      { conversationId, before, limit = 30 },
      context,
    ) => {
      const userId = requireAuth(context);
      const models = getModels(context);
      await requireConversation(models, conversationId, userId);

      const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
      const filter = { conversation: conversationId };
      if (before !== undefined && before !== null) {
        const beforeDate = new Date(before);
        if (Number.isNaN(beforeDate.getTime())) {
          throw invalidInput("The message cursor must be a valid date.");
        }
        filter.createdAt = { $lt: beforeDate };
      }
      const messages = await models.Message.find(filter)
        .populate("sender", publicUserFields)
        .populate("readBy", publicUserFields)
        .sort({ createdAt: -1, _id: -1 })
        .limit(safeLimit)
        .lean();
      return messages.reverse();
    },
  },

  Mutation: {
    updateMyProfile: async (_parent, { input }, context) => {
      const userId = requireAuth(context);
      const updates = {};
      if (input.username !== undefined && input.username !== null) {
        const username = input.username.trim();
        if (username.length < 2 || username.length > 32) {
          throw invalidInput("Username must be between 2 and 32 characters.");
        }
        updates.username = username;
      }
      if (input.bio !== undefined && input.bio !== null) {
        const bio = input.bio.trim();
        if (bio.length > 160) {
          throw invalidInput("Bio cannot exceed 160 characters.");
        }
        updates.bio = bio;
      }
      if (Object.keys(updates).length === 0) {
        throw invalidInput("Provide at least one profile field to update.");
      }

      const user = await getModels(context).User.findByIdAndUpdate(
        userId,
        { $set: updates },
        { new: true, runValidators: true },
      ).select("username email bio avatarUrl isOnline lastSeen").lean();
      if (!user) {
        throw notFound("User not found.");
      }
      return user;
    },

    createDirectConversation: async (_parent, { userId: otherUserId }, context) => {
      const currentUserId = requireAuth(context);
      if (!mongoose.isValidObjectId(otherUserId)) {
        throw invalidInput("Invalid user ID.");
      }
      if (objectIdString(currentUserId) === objectIdString(otherUserId)) {
        throw invalidInput("A direct conversation requires another user.");
      }

      const models = getModels(context);
      const otherUser = await models.User.findById(otherUserId).select("_id");
      if (!otherUser) {
        throw notFound("User not found.");
      }

      const participants = [currentUserId, objectIdString(otherUserId)].sort();
      const directKey = participants.join(":");
      try {
        return await models.Conversation.findOneAndUpdate(
          { directKey },
          {
            $setOnInsert: {
              participants,
              directKey,
              isGroup: false,
            },
          },
          { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
        ).populate("participants", publicUserFields);
      } catch (error) {
        if (error?.code !== 11000) {
          throw error;
        }
        const existing = await models.Conversation.findOne({ directKey })
          .populate("participants", publicUserFields);
        if (!existing) {
          throw error;
        }
        return existing;
      }
    },

    sendMessage: async (_parent, { conversationId, content }, context) => {
      const senderId = requireAuth(context);
      const message = await runChatService(() => sendTextMessage({
        conversationId,
        senderId,
        content,
        models: getModels(context),
      }));
      await emitChatMessage(context.io, message, getModels(context).Conversation);
      return message;
    },

    markConversationSeen: async (_parent, { conversationId }, context) => {
      const userId = requireAuth(context);
      const receipt = await runChatService(() => markConversationSeen({
        conversationId,
        userId,
        models: getModels(context),
      }));
      emitSeenUpdate(context.io, receipt);
      return receipt;
    },

    deleteMessage: async (_parent, { messageId }, context) => {
      const userId = requireAuth(context);
      const message = await runChatService(() => deleteOwnMessage({
        messageId,
        userId,
        models: getModels(context),
      }));
      await emitChatMessage(context.io, message, getModels(context).Conversation);
      return message;
    },

    toggleMessageReaction: async (_parent, { messageId, emoji }, context) => {
      const userId = requireAuth(context);
      const message = await runChatService(() => toggleMessageReaction({
        messageId,
        userId,
        emoji,
        models: getModels(context),
      }));
      await emitChatMessage(context.io, message, getModels(context).Conversation);
      return message;
    },
  },

  User: {
    id: (user) => objectIdString(user),
    email: (user, _args, context) =>
      objectIdString(user) === objectIdString(context.auth?.id)
        ? user.email ?? null
        : null,
    isOnline: (user) => user.isOnline ?? false,
    lastSeen: (user) => user.lastSeen?.toISOString?.() ?? user.lastSeen ?? null,
  },

  Conversation: {
    id: (conversation) => objectIdString(conversation),
    participants: (conversation, _args, context) => {
      if (conversation.participants?.[0]?.username !== undefined) {
        return conversation.participants;
      }
      return getModels(context).User.find({
        _id: { $in: conversation.participants },
      }).select(publicUserFields).lean();
    },
    lastMessage: (conversation, _args, context) => {
      if (!conversation.lastMessage) {
        return null;
      }
      if (conversation.lastMessage.content !== undefined) {
        return conversation.lastMessage;
      }
      return getModels(context).Message.findById(conversation.lastMessage)
        .populate("sender", publicUserFields)
        .populate("readBy", publicUserFields)
        .lean();
    },
    unreadCount: async (conversation, _args, context) => {
      const count = await getModels(context).Message.countDocuments({
        conversation: conversation._id,
        sender: { $ne: context.auth.id },
        readBy: { $ne: context.auth.id },
        deletedAt: null,
      });
      return count;
    },
    createdAt: (conversation) => conversation.createdAt.toISOString(),
    updatedAt: (conversation) => conversation.updatedAt.toISOString(),
  },

  Message: {
    id: (message) => objectIdString(message),
    conversationId: (message) => objectIdString(message.conversation),
    sender: (message, _args, context) =>
      message.sender?.username !== undefined
        ? message.sender
        : getModels(context).User.findById(message.sender)
          .select(publicUserFields)
          .lean(),
    readBy: (message, _args, context) => {
      if (message.readBy?.[0]?.username !== undefined) {
        return message.readBy;
      }
      return getModels(context).User.find({
        _id: { $in: message.readBy ?? [] },
      }).select(publicUserFields).lean();
    },
    type: (message) => message.type.toUpperCase(),
    isDeleted: (message) => Boolean(message.deletedAt),
    reactions: (message, _args, context) => {
      const groups = new Map();
      for (const reaction of message.reactions ?? []) {
        const group = groups.get(reaction.emoji) ?? [];
        group.push(objectIdString(reaction.user));
        groups.set(reaction.emoji, group);
      }
      return Array.from(groups, ([emoji, userIds]) => ({
        emoji,
        count: userIds.length,
        reactedByMe: userIds.includes(objectIdString(context.auth?.id)),
      }));
    },
    createdAt: (message) => message.createdAt.toISOString(),
    updatedAt: (message) => message.updatedAt.toISOString(),
  },
};
