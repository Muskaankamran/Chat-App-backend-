import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "user", required: true }],
      required: true,
      validate: {
        validator: (participants) => participants.length >= 2,
        message: "A conversation must have at least two participants.",
      },
    },
    directKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    isGroup: {
      type: Boolean,
      default: false,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "message",
      default: null,
    },
  },
  { timestamps: true },
);

conversationSchema.index({ participants: 1, updatedAt: -1 });

const conversationModel =
  mongoose.models.conversation ||
  mongoose.model("conversation", conversationSchema);

export default conversationModel;
