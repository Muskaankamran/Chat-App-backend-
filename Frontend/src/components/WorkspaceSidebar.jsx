import { useState } from "react";
import {
  ArrowUpRight,
  MessageSquarePlus,
  Search,
  UsersRound,
} from "lucide-react";
import { useQuery } from "@apollo/client/react";
import { USERS_QUERY } from "../api/operations.js";
import Avatar from "./Avatar.jsx";

function formatConversationTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toDateString() === new Date().toDateString()
    ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date)
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

export function ConversationList({
  currentUser,
  conversations,
  loading,
  error,
  selectedId,
  search,
  onSearch,
  onSelect,
  onNewChat,
  presence,
}) {
  const filtered = conversations.filter((conversation) => {
    const other = conversation.participants.find((person) => person.id !== currentUser.id);
    return (other?.username || conversation.name || "Conversation")
      .toLowerCase()
      .includes(search.toLowerCase());
  });

  return (
    <div className="sidebar-view">
      <div className="sidebar-heading">
        <div>
          <span className="eyebrow">YOUR SPACE</span>
          <h1>Messages</h1>
        </div>
        <button className="icon-button new-chat-button" onClick={onNewChat} title="Start a new chat">
          <MessageSquarePlus size={18} />
        </button>
      </div>
      <label className="search-field">
        <Search size={16} />
        <input
          aria-label="Search conversations"
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search conversations"
          value={search}
        />
        <kbd>⌘ K</kbd>
      </label>

      <div className="section-label">
        <span>Recent</span>
        <span className="section-count">{conversations.length}</span>
      </div>
      <div className="conversation-list">
        {loading && conversations.length === 0 && (
          <div className="conversation-skeletons" aria-label="Loading conversations">
            {[0, 1, 2, 3].map((item) => <div className="conversation-skeleton" key={item} />)}
          </div>
        )}
        {error && (
          <div className="sidebar-error" role="alert">
            Couldn't load conversations. Check your connection and retry.
          </div>
        )}
        {!loading && !error && conversations.length === 0 && (
          <div className="sidebar-empty">
            <span className="empty-icon"><UsersRound size={18} /></span>
            <strong>Your inbox is quiet</strong>
            <span>Start a conversation with someone.</span>
            <button className="text-button" onClick={onNewChat}>Find someone <ArrowUpRight size={14} /></button>
          </div>
        )}
        {!loading && !error && conversations.length > 0 && filtered.length === 0 && (
          <div className="sidebar-empty compact-empty">No conversations match that search.</div>
        )}
        {filtered.map((conversation) => {
          const other = conversation.participants.find((person) => person.id !== currentUser.id);
          const person = other || conversation.participants[0];
          const liveStatus = presence[person?.id];
          const isOnline = liveStatus?.isOnline ?? person?.isOnline;
          const lastMessage = conversation.lastMessage;
          const preview = lastMessage
            ? lastMessage.type === "IMAGE"
              ? "Shared a photo"
              : lastMessage.type === "AUDIO"
                ? "Voice message"
                : lastMessage.content
            : "Start a conversation";

          return (
            <button
              className={`conversation-row${selectedId === conversation.id ? " is-selected" : ""}`}
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
            >
              <Avatar user={person} size="lg" showStatus />
              <span className="conversation-copy">
                <span className="conversation-topline">
                  <strong>{conversation.isGroup ? conversation.name : person?.username || "Unknown"}</strong>
                  <time>{formatConversationTime(lastMessage?.createdAt || conversation.updatedAt)}</time>
                </span>
                <span className="conversation-bottomline">
                  <span className="conversation-preview">{preview || "Message"}</span>
                  {conversation.unreadCount > 0 && (
                    <span className="unread-badge">{conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}</span>
                  )}
                  {conversation.unreadCount === 0 && isOnline && <span className="online-hint">online</span>}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="sidebar-footer">
        <div className="current-user">
          <Avatar user={currentUser} size="md" />
          <span className="current-user-copy">
            <strong>{currentUser.username}</strong>
            <span>Personal workspace</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function PeoplePanel({
  onSelect,
  title = "People",
  actionLabel = "Start chat",
  openingPersonId,
}) {
  const [search, setSearch] = useState("");
  const { data, loading, error } = useQuery(USERS_QUERY, {
    variables: { search },
    fetchPolicy: "cache-and-network",
  });
  const users = data?.users ?? [];

  return (
    <div className="sidebar-view">
      <div className="sidebar-heading">
        <div>
          <span className="eyebrow">YOUR COMMUNITY</span>
          <h1>{title}</h1>
        </div>
      </div>
      <label className="search-field">
        <Search size={16} />
        <input
          aria-label="Search people"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by username"
          value={search}
        />
      </label>
      <div className="section-label"><span>People on orbit</span></div>
      <div className="people-list">
        {loading && users.length === 0 && [0, 1, 2].map((item) => (
          <div className="person-skeleton" key={item} />
        ))}
        {error && <div className="sidebar-error" role="alert">Couldn't load people. Try again shortly.</div>}
        {!loading && !error && users.length === 0 && (
          <div className="sidebar-empty compact-empty">
            {search ? "No people found. Try another name." : "No other accounts are available yet."}
          </div>
        )}
        {users.map((person) => (
          <button
            className="person-row"
            disabled={openingPersonId === person.id}
            key={person.id}
            onClick={() => onSelect(person)}
          >
            <Avatar user={person} size="md" showStatus />
            <span className="person-row-copy">
              <strong>{person.username}</strong>
              <span>{person.isOnline ? "Online now" : "Offline"}</span>
            </span>
            <span className="person-action">
              {openingPersonId === person.id ? "Opening..." : actionLabel}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function NotificationsPanel({ notifications, onOpenConversation }) {
  return (
    <div className="sidebar-view">
      <div className="sidebar-heading">
        <div>
          <span className="eyebrow">STAY IN THE LOOP</span>
          <h1>Notifications</h1>
        </div>
      </div>
      <div className="section-label"><span>Recent activity</span></div>
      <div className="notification-list">
        {notifications.length === 0 ? (
          <div className="sidebar-empty">
            <span className="empty-icon"><ArrowUpRight size={18} /></span>
            <strong>All caught up</strong>
            <span>New message notifications will show up here.</span>
          </div>
        ) : notifications.map((notification) => (
          <button
            className="notification-row"
            key={`${notification.messageId}-${notification.createdAt}`}
            onClick={() => onOpenConversation(notification.conversationId)}
          >
            <span className="notification-dot" />
            <span>
              <strong>{notification.senderName}</strong>
              <span>{notification.preview}</span>
              <time>{formatConversationTime(notification.createdAt)}</time>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
