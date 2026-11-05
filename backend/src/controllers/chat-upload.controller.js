import { randomUUID } from "node:crypto";
import multer from "multer";
import uploadFile from "../../services/storage.service.js";
import userModel from "../models/users.model.js";
import {
  ChatServiceError,
  createMediaMessage,
  getConversationForParticipant,
  serializeMessageForSocket,
} from "../../services/chat.service.js";
import { emitChatMessage } from "../socket/emitters.js";
import {
  getSupportedMediaType,
  isSupportedMediaBuffer,
  normalizeMediaType,
} from "../utils/media-validation.js";
import { serializePublicUser } from "../utils/auth.utils.js";

function respondWithServiceError(res, error) {
  const status = error.code === "NOT_FOUND"
    ? 404
    : error.code === "UNAUTHENTICATED"
      ? 401
      : error.code === "FORBIDDEN"
        ? 403
        : 400;
  return res.status(status).json({ message: error.message });
}

export async function uploadChatMedia(req, res) {
  if (!req.file) {
    return res.status(400).json({
      message: "Choose a supported image or audio file to upload.",
    });
  }
  const mediaInfo = getSupportedMediaType(req.file.mimetype);
  if (!mediaInfo) {
    return res.status(400).json({ message: "Unsupported media type." });
  }
  if (!isSupportedMediaBuffer(req.file.buffer, req.file.mimetype)) {
    return res.status(400).json({
      message: "The uploaded file content does not match its media type.",
    });
  }

  try {
    await getConversationForParticipant(
      req.body?.conversationId,
      req.user.id,
    );

    const fileName = `${randomUUID()}${mediaInfo.extension}`;
    const uploaded = await uploadFile(req.file.buffer, {
      fileName,
      folder: `chat/${mediaInfo.type}`,
    });
    if (
      typeof uploaded?.url !== "string" ||
      !uploaded.url.startsWith("https://") ||
      typeof uploaded?.fileId !== "string"
    ) {
      throw new Error("Remote media storage returned an invalid upload result");
    }

    const message = await createMediaMessage({
      conversationId: req.body.conversationId,
      senderId: req.user.id,
      type: mediaInfo.type,
      mediaUrl: uploaded.url,
      mediaFileId: uploaded.fileId,
      mediaType: normalizeMediaType(req.file.mimetype),
      mediaSize: req.file.size,
    });
    const serialized = serializeMessageForSocket(message);
    await emitChatMessage(req.app.get("io"), message);
    return res.status(201).json({ message: serialized });
  } catch (error) {
    if (error instanceof ChatServiceError) {
      return respondWithServiceError(res, error);
    }
    console.error(error);
    return res.status(500).json({
      message: "The media upload could not be completed.",
    });
  }
}

export async function uploadProfileAvatar(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: "Choose an image to upload." });
  }
  const mediaInfo = getSupportedMediaType(req.file.mimetype);
  if (
    mediaInfo?.type !== "image" ||
    !isSupportedMediaBuffer(req.file.buffer, req.file.mimetype)
  ) {
    return res.status(400).json({
      message: "The uploaded file must be a supported image.",
    });
  }

  try {
    const uploaded = await uploadFile(req.file.buffer, {
      fileName: `${randomUUID()}${mediaInfo.extension}`,
      folder: "chat/avatars",
    });
    if (
      typeof uploaded?.url !== "string" ||
      !uploaded.url.startsWith("https://")
    ) {
      throw new Error("Remote media storage returned an invalid upload result");
    }

    const user = await userModel.findByIdAndUpdate(
      req.user.id,
      { $set: { avatarUrl: uploaded.url } },
      { new: true, runValidators: true },
    ).select("username email bio avatarUrl");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    req.app.get("io")?.to("chat:authenticated").emit("profile:update", {
      id: user._id.toString(),
      username: user.username,
      bio: user.bio ?? "",
      avatarUrl: user.avatarUrl,
    });
    return res.status(200).json({ user: serializePublicUser(user) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "The profile image could not be updated.",
    });
  }
}

export function handleChatUploadError(error, _req, res, next) {
  if (error instanceof multer.MulterError) {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "The file exceeds the 15 MB upload limit."
      : "The upload could not be processed.";
    return res.status(status).json({ message });
  }
  return next(error);
}
