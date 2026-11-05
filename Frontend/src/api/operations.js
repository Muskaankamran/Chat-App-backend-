import { gql } from "@apollo/client";

const USER_FIELDS = gql`
  fragment ChatUserFields on User {
    id
    username
    bio
    avatarUrl
    isOnline
    lastSeen
  }
`;

const MESSAGE_FIELDS = gql`
  fragment ChatMessageFields on Message {
    id
    conversationId
    sender {
      ...ChatUserFields
    }
    type
    content
    mediaUrl
    mediaType
    mediaSize
    readBy {
      id
      username
    }
    reactions {
      emoji
      count
      reactedByMe
    }
    isDeleted
    createdAt
    updatedAt
  }
  ${USER_FIELDS}
`;

export const ME_QUERY = gql`
  query Me {
    me {
      ...ChatUserFields
      email
    }
  }
  ${USER_FIELDS}
`;

export const USERS_QUERY = gql`
  query Users($search: String) {
    users(search: $search) {
      ...ChatUserFields
    }
  }
  ${USER_FIELDS}
`;

export const CONVERSATIONS_QUERY = gql`
  query Conversations {
    conversations {
      id
      participants {
        ...ChatUserFields
      }
      isGroup
      name
      unreadCount
      updatedAt
      lastMessage {
        id
        type
        content
        createdAt
      }
    }
  }
  ${USER_FIELDS}
`;

export const CONVERSATION_MESSAGES_QUERY = gql`
  query ConversationMessages($conversationId: ID!, $limit: Int!) {
    conversationMessages(conversationId: $conversationId, limit: $limit) {
      ...ChatMessageFields
    }
  }
  ${MESSAGE_FIELDS}
`;

export const CREATE_DIRECT_CONVERSATION = gql`
  mutation CreateDirectConversation($userId: ID!) {
    createDirectConversation(userId: $userId) {
      id
      participants {
        ...ChatUserFields
      }
      isGroup
      name
      unreadCount
      updatedAt
      lastMessage {
        id
        type
        content
        createdAt
      }
    }
  }
  ${USER_FIELDS}
`;

export const SEND_MESSAGE = gql`
  mutation SendMessage($conversationId: ID!, $content: String!) {
    sendMessage(conversationId: $conversationId, content: $content) {
      ...ChatMessageFields
    }
  }
  ${MESSAGE_FIELDS}
`;

export const MARK_CONVERSATION_SEEN = gql`
  mutation MarkConversationSeen($conversationId: ID!) {
    markConversationSeen(conversationId: $conversationId) {
      conversationId
      userId
      seenAt
    }
  }
`;

export const DELETE_MESSAGE = gql`
  mutation DeleteMessage($messageId: ID!) {
    deleteMessage(messageId: $messageId) {
      ...ChatMessageFields
    }
  }
  ${MESSAGE_FIELDS}
`;

export const TOGGLE_MESSAGE_REACTION = gql`
  mutation ToggleMessageReaction($messageId: ID!, $emoji: String!) {
    toggleMessageReaction(messageId: $messageId, emoji: $emoji) {
      ...ChatMessageFields
    }
  }
  ${MESSAGE_FIELDS}
`;

export const UPDATE_PROFILE = gql`
  mutation UpdateMyProfile($input: UpdateProfileInput!) {
    updateMyProfile(input: $input) {
      ...ChatUserFields
      email
    }
  }
  ${USER_FIELDS}
`;
