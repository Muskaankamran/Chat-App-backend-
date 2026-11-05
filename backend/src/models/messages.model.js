import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "conversation",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["text", "image", "audio"],
      default: "text",
      required: true,
    },
    content: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: null,
    },
    mediaUrl: {
      type: String,
      default: null,
    },
    mediaFileId: {
      type: String,
      default: null,
    },
    mediaType: {
      type: String,
      default: null,
    },
    mediaSize: {
      type: Number,
      min: 0,
      default: null,
    },
    readBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    }],
    reactions: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true,
      },
      emoji: {
        type: String,
        required: true,
        maxlength: 8,
      },
      addedAt: {
        type: Date,
        default: Date.now,
      },
    }],
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

messageSchema.index({ conversation: 1, createdAt: -1 });

const messageModel =
  mongoose.models.message || mongoose.model("message", messageSchema);

export default messageModel;
