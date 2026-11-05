export const typeDefs = `#graphql
  enum MessageType {
    TEXT
    IMAGE
    AUDIO
  }

  type User {
    id: ID!
    username: String!
    email: String
    bio: String
    avatarUrl: String
    isOnline: Boolean!
    lastSeen: String
  }

  type Message {
    id: ID!
    conversationId: ID!
    sender: User!
    type: MessageType!
    content: String
    mediaUrl: String
    mediaType: String
    mediaSize: Int
    readBy: [User!]!
    reactions: [MessageReaction!]!
    isDeleted: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type MessageReaction {
    emoji: String!
    count: Int!
    reactedByMe: Boolean!
  }

  type Conversation {
    id: ID!
    participants: [User!]!
    isGroup: Boolean!
    name: String
    lastMessage: Message
    unreadCount: Int!
    createdAt: String!
    updatedAt: String!
  }

  type SeenReceipt {
    conversationId: ID!
    userId: ID!
    seenAt: String!
  }

  input UpdateProfileInput {
    username: String
    bio: String
  }

  type Query {
    me: User!
    users(search: String): [User!]!
    conversations: [Conversation!]!
    conversationMessages(
      conversationId: ID!
      before: String
      limit: Int = 30
    ): [Message!]!
  }

  type Mutation {
    updateMyProfile(input: UpdateProfileInput!): User!
    createDirectConversation(userId: ID!): Conversation!
    sendMessage(conversationId: ID!, content: String!): Message!
    markConversationSeen(conversationId: ID!): SeenReceipt!
    deleteMessage(messageId: ID!): Message!
    toggleMessageReaction(messageId: ID!, emoji: String!): Message!
  }
`;
