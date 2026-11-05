import conversationModel from "../models/conversations.model.js";
import {
  serializeMessageForSocket,
} from "../../services/chat.service.js";

export const conversationRoom = (id) => `conversation:${id}`;
export const userRoom = (id) => `user:${id}`;

export async function emitChatMessage(io, message, Conversation = conversationModel) {
  if (!io) {
    return null;
  }
  const conversation = await Conversation.findById(
    message.conversation,
  ).select("participants").lean();
  if (!conversation) {
    throw new Error("Message conversation was not found for socket delivery.");
  }

  const serialized = serializeMessageForSocket(message);
  io.to(conversationRoom(serialized.conversationId)).emit(
    "chat:message",
    serialized,
  );
  for (const participantId of conversation.participants) {
    const recipientId = participantId.toString();
    if (recipientId !== serialized.sender.id) {
      io.to(userRoom(recipientId)).emit("notification:new", {
        conversationId: serialized.conversationId,
        messageId: serialized.id,
        senderId: serialized.sender.id,
        senderName: serialized.sender.username,
        preview: (serialized.content ?? "Shared a file").slice(0, 120),
        createdAt: serialized.createdAt,
      });
    }
  }
  return serialized;
}

export function emitSeenUpdate(io, receipt) {
  if (io) {
    io.to(conversationRoom(receipt.conversationId)).emit(
      "chat:seen",
      receipt,
    );
  }
}
