import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  MoreHorizontal,
  Phone,
  Video,
} from "lucide-react";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  CONVERSATION_MESSAGES_QUERY,
  DELETE_MESSAGE,
  MARK_CONVERSATION_SEEN,
  SEND_MESSAGE,
  TOGGLE_MESSAGE_REACTION,
} from "../api/operations.js";
import { API_URL } from "../api/apollo.js";
import Avatar from "./Avatar.jsx";
import MessageComposer from "./MessageComposer.jsx";

const reactionChoices = ["❤️", "😂", "👍", "😮", "🎉"];

function dayKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(date) === dayKey(today)) return "Today";
  if (dayKey(date) === dayKey(yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

function messageTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function MessageBubble({ message, isMine, otherUserId, onReact, onDelete }) {
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const seen = isMine && message.readBy.some((reader) => reader.id === otherUserId);

  return (
    <article className={`message-row${isMine ? " message-row-mine" : ""}`} id={`message-${message.id}`}>
      {!isMine && <Avatar user={message.sender} size="sm" />}
      <div className="message-content">
        <div className={`message-bubble${isMine ? " message-bubble-mine" : ""}`}>
          {message.isDeleted ? (
            <span className="deleted-message">This message was deleted</span>
          ) : message.type === "IMAGE" && message.mediaUrl ? (
            <a className="message-image-link" href={message.mediaUrl} rel="noreferrer" target="_blank">
              <img alt="Shared image" className="message-image" loading="lazy" src={message.mediaUrl} />
            </a>
          ) : message.type === "AUDIO" && message.mediaUrl ? (
            <audio className="message-audio" controls preload="metadata" src={message.mediaUrl} />
          ) : (
            <p>{message.content}</p>
          )}
        </div>
        {!message.isDeleted && (
          <div className="message-reactions">
            {message.reactions.map((reaction) => (
              <button
                aria-label={`${reaction.emoji}, ${reaction.count} reactions`}
                className={`reaction-chip${reaction.reactedByMe ? " reaction-selected" : ""}`}
                key={reaction.emoji}
                onClick={() => onReact(message.id, reaction.emoji)}
              >
                <span>{reaction.emoji}</span><small>{reaction.count}</small>
              </button>
            ))}
            <div className="reaction-picker-wrap">
              <button
                aria-label="Add reaction"
                className="reaction-add"
                onClick={() => setReactionPickerOpen((open) => !open)}
                title="Add a reaction"
              >
                +
              </button>
              {reactionPickerOpen && (
                <div className="reaction-picker">
                  {reactionChoices.map((emoji) => (
                    <button
                      aria-label={`React with ${emoji}`}
                      key={emoji}
                      onClick={() => {
                        onReact(message.id, emoji);
                        setReactionPickerOpen(false);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {isMine && (
              <button
                aria-label="Delete message"
                className="message-delete"
                onClick={() => onDelete(message.id)}
                title="Delete message"
              >
                <MoreHorizontal size={15} />
              </button>
            )}
          </div>
        )}
        <div className={`message-meta${isMine ? " message-meta-mine" : ""}`}>
          <time dateTime={message.createdAt}>{messageTime(message.createdAt)}</time>
          {isMine && (
            <span className={seen ? "receipt-seen" : "receipt-sent"} title={seen ? "Seen" : "Sent"}>
              {seen ? <CheckCheck size={14} /> : <Check size={14} />}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function MessageTimeline({
  messages,
  loading,
  error,
  currentUser,
  otherUser,
  onReact,
  onDelete,
  onRetry,
  typing,
}) {
  const bottom = useRef(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, typing]);

  if (loading && messages.length === 0) {
    return (
      <div className="message-timeline">
        <div className="message-skeleton message-skeleton-left" />
        <div className="message-skeleton message-skeleton-right" />
        <div className="message-skeleton message-skeleton-left short-skeleton" />
      </div>
    );
  }
  if (error && messages.length === 0) {
    return (
      <div className="chat-state">
        <strong>Messages couldn't load</strong>
        <span>Check your connection, then try again.</span>
        <button className="text-button" onClick={onRetry}>Retry</button>
      </div>
    );
  }
  if (!messages.length) {
    return (
      <div className="chat-state">
        <span className="empty-chat-mark">✦</span>
        <strong>This is the beginning</strong>
        <span>Send a message to start your conversation.</span>
      </div>
    );
  }

  return (
    <div className="message-timeline">
      {messages.map((message, index) => {
        const currentDay = dayKey(message.createdAt);
        const previousMessage = messages[index - 1];
        const separator =
          !previousMessage || dayKey(previousMessage.createdAt) !== currentDay;
        return (
          <div key={message.id}>
            {separator && (
              <div className="date-separator"><span>{dayLabel(message.createdAt)}</span></div>
            )}
            <MessageBubble
              isMine={message.sender.id === currentUser.id}
              message={message}
              onDelete={onDelete}
              onReact={onReact}
              otherUserId={otherUser.id}
            />
          </div>
        );
      })}
      {typing && (
        <div className="typing-indicator">
          <span className="typing-dots"><i /><i /><i /></span>
          <span>{otherUser.username} is typing</span>
        </div>
      )}
      <div ref={bottom} />
    </div>
  );
}

export default function ChatPanel({
  conversation,
  currentUser,
  onBack,
  onRefreshConversations,
  presence,
  socket,
}) {
  const [typing, setTyping] = useState(false);
  const [notice, setNotice] = useState("");
  const [sendMessage] = useMutation(SEND_MESSAGE);
  const [markSeen] = useMutation(MARK_CONVERSATION_SEEN);
  const [deleteMessage] = useMutation(DELETE_MESSAGE);
  const [toggleReaction] = useMutation(TOGGLE_MESSAGE_REACTION);
  const conversationId = conversation?.id;
  const { data, loading, error, refetch } = useQuery(CONVERSATION_MESSAGES_QUERY, {
    variables: { conversationId, limit: 60 },
    skip: !conversationId,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  const messages = data?.conversationMessages ?? [];
  const otherUser = useMemo(() => {
    const participant = conversation?.participants.find((person) => person.id !== currentUser.id)
      || conversation?.participants[0];
    if (!participant) return null;
    return {
      ...participant,
      ...presence[participant.id],
    };
  }, [conversation, currentUser.id, presence]);

  useEffect(() => {
    if (!conversationId || !socket) return undefined;
    const joinConversation = () => {
      socket.emit("chat:join", { conversationId }, (response) => {
        if (!response?.ok) {
          setNotice(response?.error?.message || "Couldn't join this conversation.");
        }
      });
      markSeen({ variables: { conversationId } })
        .then(() => onRefreshConversations())
        .catch(() => setNotice("Seen status couldn't be updated."));
    };

    const onTyping = (event) => {
      if (event.conversationId === conversationId && event.userId !== currentUser.id) {
        setTyping(event.isTyping);
      }
    };
    const onSeen = (event) => {
      if (event.conversationId === conversationId) refetch();
    };
    const onMessage = (message) => {
      if (message.conversationId !== conversationId) return;
      refetch();
      if (message.sender.id !== currentUser.id) {
        markSeen({ variables: { conversationId } }).catch(() => {
          setNotice("Seen status couldn't be updated.");
        });
      }
      onRefreshConversations();
    };
    socket.on("chat:typing", onTyping);
    socket.on("chat:seen", onSeen);
    socket.on("chat:message", onMessage);
    socket.on("connect", joinConversation);
    if (socket.connected) joinConversation();
    return () => {
      socket.off("chat:typing", onTyping);
      socket.off("chat:seen", onSeen);
      socket.off("chat:message", onMessage);
      socket.off("connect", joinConversation);
    };
  }, [
    conversationId,
    currentUser.id,
    markSeen,
    onRefreshConversations,
    refetch,
    socket,
  ]);

  const sendText = async (content) => {
    setNotice("");
    await sendMessage({ variables: { conversationId, content } });
    await refetch();
    await onRefreshConversations();
  };

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append("conversationId", conversationId);
    formData.append("file", file);
    const response = await fetch(`${API_URL}/api/chat/upload`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.message || "The upload couldn't be completed.");
    }
    await refetch();
    await onRefreshConversations();
  };

  const updateTyping = (isTyping) => {
    if (conversationId && socket?.connected) {
      socket.emit("chat:typing", { conversationId, isTyping });
    }
  };

  const handleReaction = async (messageId, emoji) => {
    try {
      await toggleReaction({ variables: { messageId, emoji } });
      await refetch();
    } catch (reactionError) {
      setNotice(reactionError.message || "Reaction couldn't be saved.");
    }
  };

  const handleDelete = async (messageId) => {
    if (!window.confirm("Delete this message for everyone in the conversation?")) return;
    try {
      await deleteMessage({ variables: { messageId } });
      await refetch();
      await onRefreshConversations();
    } catch (deleteError) {
      setNotice(deleteError.message || "Message couldn't be deleted.");
    }
  };

  if (!conversation || !otherUser) {
    return (
      <section className="empty-workspace">
        <div className="empty-workspace-art"><span>✦</span><i /><i /><i /></div>
        <span className="eyebrow">YOUR SPACE, YOUR PACE</span>
        <h2>A good conversation<br />starts with hello.</h2>
        <p>Pick a chat from your inbox or find someone new to talk to.</p>
        <div className="empty-workspace-hint"><span className="hint-dot" /> Your conversations are private</div>
      </section>
    );
  }

  const online = otherUser.isOnline ?? false;

  return (
    <section className="chat-panel">
      <header className="chat-header">
        <button aria-label="Back to conversations" className="icon-button mobile-back" onClick={onBack}>
          <ArrowLeft size={19} />
        </button>
        <Avatar user={otherUser} size="md" showStatus />
        <div className="chat-header-person">
          <strong>{conversation.isGroup ? conversation.name : otherUser.username}</strong>
          <span className={online ? "status-online" : ""}>
            <i /> {online ? "Online now" : "Offline"}
          </span>
        </div>
        <div className="chat-header-actions">
          <button className="icon-button" onClick={() => setNotice("Voice calls are coming soon.")} title="Voice call">
            <Phone size={17} />
          </button>
          <button className="icon-button" onClick={() => setNotice("Video calls are coming soon.")} title="Video call">
            <Video size={18} />
          </button>
          <span className="header-divider" />
          <button className="icon-button" onClick={() => setNotice("Conversation options")} title="More options">
            <MoreHorizontal size={19} />
          </button>
        </div>
      </header>

      {notice && (
        <div className="chat-notice" role="status">
          <span>{notice}</span>
          <button aria-label="Dismiss" onClick={() => setNotice("")}>×</button>
        </div>
      )}

      <MessageTimeline
        currentUser={currentUser}
        error={error}
        loading={loading}
        messages={messages}
        onDelete={handleDelete}
        onReact={handleReaction}
        onRetry={() => refetch()}
        otherUser={otherUser}
        typing={typing}
      />
      <MessageComposer
        disabled={false}
        onSend={sendText}
        onTyping={updateTyping}
        onUpload={uploadFile}
      />
    </section>
  );
}
