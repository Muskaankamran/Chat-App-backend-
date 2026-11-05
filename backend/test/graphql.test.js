import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { ApolloServer } from "@apollo/server";
import { resolvers } from "../src/graphql/resolvers.js";
import { typeDefs } from "../src/graphql/schema.js";
import { Types } from "mongoose";

describe("chat GraphQL schema", () => {
  let server;

  before(async () => {
    server = new ApolloServer({ typeDefs, resolvers });
    await server.start();
  });

  after(async () => {
    await server.stop();
  });

  it("rejects protected queries without authentication", async () => {
    const response = await server.executeOperation(
      { query: "{ me { id } }" },
      { contextValue: { auth: null } },
    );

    assert.equal(response.body.kind, "single");
    assert.equal(
      response.body.singleResult.errors[0].extensions.code,
      "UNAUTHENTICATED",
    );
    assert.equal(response.body.singleResult.data, null);
  });

  it("does not allow public user queries without authentication", async () => {
    const response = await server.executeOperation(
      { query: "{ users { id email } }" },
      { contextValue: { auth: null } },
    );

    assert.equal(
      response.body.singleResult.errors[0].extensions.code,
      "UNAUTHENTICATED",
    );
  });

  it("searches only public user fields and hides other users' email", async () => {
    const currentUserId = new Types.ObjectId().toString();
    const otherUserId = new Types.ObjectId().toString();
    let capturedFilter;
    let selectedFields;
    const user = {
      _id: new Types.ObjectId(otherUserId),
      username: "sam",
      email: "private@example.com",
      password: "must-not-be-selected",
    };
    const result = await resolvers.Query.users(
      null,
      { search: "sa[m" },
      {
        auth: { id: currentUserId },
        models: {
          User: {
            find(filter) {
              capturedFilter = filter;
              return {
                select(fields) {
                  selectedFields = fields;
                  return this;
                },
                sort() {
                  return this;
                },
                limit() {
                  return this;
                },
                async lean() {
                  return [user];
                },
              };
            },
          },
        },
      },
    );

    assert.equal(capturedFilter._id.$ne, currentUserId);
    assert.equal(capturedFilter.username.$regex, "sa\\[m");
    assert.equal(selectedFields.includes("email"), false);
    assert.equal(selectedFields.includes("password"), false);
    assert.equal(resolvers.User.email(user, {}, { auth: { id: currentUserId } }), null);
    assert.equal(
      resolvers.User.email(user, {}, { auth: { id: otherUserId } }),
      "private@example.com",
    );
    assert.equal(result.length, 1);
  });

  it("creates a deterministic direct conversation without exposing user fields", async () => {
    const currentUserId = new Types.ObjectId().toString();
    const otherUserId = new Types.ObjectId().toString();
    let queryFilter;
    let update;
    const conversation = { _id: new Types.ObjectId() };

    const result = await resolvers.Mutation.createDirectConversation(
      null,
      { userId: otherUserId },
      {
        auth: { id: currentUserId },
        models: {
          User: {
            findById() {
              return {
                select: async () => ({ _id: new Types.ObjectId(otherUserId) }),
              };
            },
          },
          Conversation: {
            findOneAndUpdate(filter, updateDocument) {
              queryFilter = filter;
              update = updateDocument;
              return {
                populate: async () => conversation,
              };
            },
          },
        },
      },
    );

    const sortedIds = [currentUserId, otherUserId].sort();
    assert.equal(queryFilter.directKey, sortedIds.join(":"));
    assert.deepEqual(update.$setOnInsert.participants, sortedIds);
    assert.equal(result, conversation);
  });

  it("resolves each conversation unread count to a numeric result", async () => {
    const conversationId = new Types.ObjectId();
    const conversation = {
      _id: conversationId,
      participants: [],
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const executionCounts = [];
    const response = await server.executeOperation(
      {
        query: `query {
          conversations {
            id
            firstUnreadCount: unreadCount
            secondUnreadCount: unreadCount
          }
        }`,
      },
      {
        contextValue: {
          auth: { id: new Types.ObjectId().toString() },
          models: {
            Conversation: {
              find() {
                return {
                  populate() {
                    return this;
                  },
                  sort() {
                    return this;
                  },
                  lean: async () => [conversation],
                };
              },
            },
            Message: {
              countDocuments() {
                let executed = false;
                return {
                  then(resolve, reject) {
                    if (executed) {
                      reject(new Error("Count query executed more than once."));
                      return;
                    }
                    executed = true;
                    executionCounts.push(conversationId.toString());
                    resolve(3);
                  },
                };
              },
            },
          },
        },
      },
    );

    assert.deepEqual(response.body.singleResult.errors, undefined);
    assert.deepEqual(
      JSON.parse(JSON.stringify(response.body.singleResult.data.conversations)),
      [{
      id: conversationId.toString(),
      firstUnreadCount: 3,
      secondUnreadCount: 3,
      }],
    );
    assert.equal(executionCounts.length, 2);
  });

  it("fetches messages for the requested conversation and returns chronological history", async () => {
    const userId = new Types.ObjectId().toString();
    const conversationId = new Types.ObjectId().toString();
    const firstMessage = {
      _id: new Types.ObjectId(),
      conversation: new Types.ObjectId(conversationId),
      sender: { _id: new Types.ObjectId(userId), username: "sam" },
      type: "text",
      content: "First",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const secondMessage = {
      ...firstMessage,
      _id: new Types.ObjectId(),
      content: "Second",
      createdAt: new Date("2026-01-01T00:01:00.000Z"),
      updatedAt: new Date("2026-01-01T00:01:00.000Z"),
    };
    let conversationFilter;
    let messageFilter;
    let requestedLimit;
    const response = await server.executeOperation(
      {
        query: `query ConversationHistory($conversationId: ID!, $limit: Int!) {
          conversationMessages(conversationId: $conversationId, limit: $limit) {
            id
            conversationId
            sender { id username }
            type
            content
          }
        }`,
        variables: { conversationId, limit: 2 },
      },
      {
        contextValue: {
          auth: { id: userId },
          models: {
            Conversation: {
              findOne(filter) {
                conversationFilter = filter;
                return Promise.resolve({ _id: new Types.ObjectId(conversationId) });
              },
            },
            Message: {
              find(filter) {
                messageFilter = filter;
                const query = {
                  populate() {
                    return query;
                  },
                  sort() {
                    return query;
                  },
                  limit(value) {
                    requestedLimit = value;
                    return query;
                  },
                  lean: async () => [secondMessage, firstMessage],
                };
                return query;
              },
            },
          },
        },
      },
    );

    assert.deepEqual(response.body.singleResult.errors, undefined);
    assert.equal(conversationFilter._id, conversationId);
    assert.equal(conversationFilter.participants, userId);
    assert.equal(messageFilter.conversation, conversationId);
    assert.equal(requestedLimit, 2);
    assert.deepEqual(
      JSON.parse(JSON.stringify(response.body.singleResult.data.conversationMessages))
        .map((message) => message.content),
      ["First", "Second"],
    );
  });

  it("persists a sender's message for the other participant and denies outsiders", async () => {
    const senderId = new Types.ObjectId().toString();
    const recipientId = new Types.ObjectId().toString();
    const outsiderId = new Types.ObjectId().toString();
    const conversationId = new Types.ObjectId().toString();
    const storedMessages = [];
    const conversation = {
      _id: new Types.ObjectId(conversationId),
      participants: [new Types.ObjectId(senderId), new Types.ObjectId(recipientId)],
    };
    const models = {
      Conversation: {
        async findOne(filter) {
          const isParticipant = conversation.participants.some(
            (participant) => participant.toString() === filter.participants,
          );
          return filter._id === conversationId && isParticipant
            ? conversation
            : null;
        },
        async updateOne() {},
      },
      Message: {
        async create(input) {
          const message = {
            _id: new Types.ObjectId(),
            ...input,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            async populate() {
              return this;
            },
          };
          storedMessages.push(message);
          return message;
        },
        find(filter) {
          const query = {
            populate() {
              return query;
            },
            sort() {
              return query;
            },
            limit() {
              return query;
            },
            lean: async () => storedMessages.filter(
              (message) => message.conversation.toString() === filter.conversation,
            ),
          };
          return query;
        },
      },
    };

    const sentMessage = await resolvers.Mutation.sendMessage(
      null,
      { conversationId, content: "Persist across accounts" },
      { auth: { id: senderId }, models },
    );
    const recipientHistory = await resolvers.Query.conversationMessages(
      null,
      { conversationId, limit: 60 },
      { auth: { id: recipientId }, models },
    );

    assert.equal(storedMessages.length, 1);
    assert.equal(storedMessages[0].sender, senderId);
    assert.equal(storedMessages[0].conversation.toString(), conversationId);
    assert.equal(recipientHistory.length, 1);
    assert.equal(recipientHistory[0]._id, sentMessage._id);
    assert.equal(recipientHistory[0].content, "Persist across accounts");

    await assert.rejects(
      resolvers.Query.conversationMessages(
        null,
        { conversationId, limit: 60 },
        { auth: { id: outsiderId }, models },
      ),
      (error) => error.extensions?.code === "NOT_FOUND",
    );
  });
});
