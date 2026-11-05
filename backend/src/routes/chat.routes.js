import express from "express";
import {
  handleChatUploadError,
  uploadProfileAvatar,
  uploadChatMedia,
} from "../controllers/chat-upload.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { chatUpload } from "../middlewares/upload.middleware.js";

const router = express.Router();

router.post(
  "/upload",
  authenticateToken,
  chatUpload.single("file"),
  uploadChatMedia,
  handleChatUploadError,
);
router.post(
  "/profile/avatar",
  authenticateToken,
  chatUpload.single("file"),
  uploadProfileAvatar,
  handleChatUploadError,
);

export default router;
