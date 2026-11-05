import assert from "node:assert/strict";
import { describe, it } from "node:test";
import userModel from "../src/models/users.model.js";
import conversationModel from "../src/models/conversations.model.js";
import messageModel from "../src/models/messages.model.js";

describe("chat model compatibility", () => {
  it("keeps existing user fields and applies chat defaults", () => {
    const user = new userModel({
      username: "sam",
      email: "sam@example.com",
      password: "hashed-password",
      cart: [],
    });

    assert.equal(user.username, "sam");
    assert.equal(user.password, "hashed-password");
    assert.deepEqual(user.cart, []);
    assert.equal(user.isOnline, false);
    assert.equal(user.avatarUrl, "");
  });

  it("requires at least two conversation participants", async () => {
    const conversation = new conversationModel({
      participants: ["507f1f77bcf86cd799439011"],
    });

    await assert.rejects(conversation.validate(), /at least two participants/);
  });

  it("supports text, image, and audio messages with read receipts", async () => {
    const message = new messageModel({
      conversation: "507f1f77bcf86cd799439011",
      sender: "507f1f77bcf86cd799439012",
      type: "audio",
      mediaUrl: "https://cdn.example.com/voice.webm",
      mediaType: "audio/webm",
      mediaSize: 1024,
      readBy: ["507f1f77bcf86cd799439012"],
    });

    await assert.doesNotReject(message.validate());
  });
});
