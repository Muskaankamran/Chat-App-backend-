import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  LogOut,
  MessageCircle,
  Moon,
  Settings,
  Sun,
  UsersRound,
} from "lucide-react";
import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import {
  CONVERSATIONS_QUERY,
  CREATE_DIRECT_CONVERSATION,
  UPDATE_PROFILE,
} from "../api/operations.js";
import { API_URL } from "../api/apollo.js";
import { createChatSocket } from "../api/socket.js";
import { useAuth } from "../context/auth-context.js";
import Avatar from "./Avatar.jsx";
import Brand from "./Brand.jsx";
import ChatPanel from "./ChatPanel.jsx";
import {
  ConversationList,
  NotificationsPanel,
  PeoplePanel,
} from "./WorkspaceSidebar.jsx";

const navigation = [
  { id: "chats", label: "Chats", Icon: MessageCircle },
  { id: "friends", label: "Friends", Icon: UsersRound },
  { id: "notifications", label: "Notifications", Icon: Bell },
];
const EMPTY_CONVERSATIONS = [];

export default function ChatApp({ theme, toggleTheme }) {
  const { user, signOut } = useAuth();
  const client = useApolloClient();
  const { data, loading, error } = useQuery(CONVERSATIONS_QUERY, {
    fetchPolicy: "cache-and-network",
  });
  const conversations = data?.conversations ?? EMPTY_CONVERSATIONS;
  const [socket] = useState(() => createChatSocket());
  const [selectedId, setSelectedId] = useState("");
  const [openedConversation, setOpenedConversation] = useState(null);
  const [openingPersonId, setOpeningPersonId] = useState("");
  const [activeSection, setActiveSection] = useState("chats");
  const [conversationSearch, setConversationSearch] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [presence, setPresence] = useState({});
  const [profileUpdates, setProfileUpdates] = useState({});
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [bannerError, setBannerError] = useState("");
  const [profileName, setProfileName] = useState(user.username);
  const [profileBio, setProfileBio] = useState(user.bio || "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const avatarInput = useRef(null);
  const [updateProfile] = useMutation(UPDATE_PROFILE);

  const refreshConversations = useCallback(async () => {
    try {
      await client.refetchQueries({ include: [CONVERSATIONS_QUERY] });
    } catch {
      setBannerError("Conversation list couldn't be refreshed.");
    }
  }, [client]);

  useEffect(() => {
    const connection = socket;
    connection.connect();

    const onNotification = (notification) => {
      setNotifications((current) => [notification, ...current].slice(0, 40));
      refreshConversations();
    };
    const onPresence = (update) => {
      setPresence((current) => ({ ...current, [update.userId]: update }));
    };
    const onProfile = (profile) => {
      setProfileUpdates((current) => ({ ...current, [profile.id]: profile }));
    };
    const onMessage = () => {
      refreshConversations();
    };

    connection.on("notification:new", onNotification);
    connection.on("presence:update", onPresence);
    connection.on("profile:update", onProfile);
    connection.on("chat:message", onMessage);
    connection.on("connect_error", () => {
      setBannerError("Realtime connection interrupted. Chat history will still load.");
    });
    connection.on("connect", () => setBannerError(""));

    return () => {
      connection.off("notification:new", onNotification);
      connection.off("presence:update", onPresence);
      connection.off("profile:update", onProfile);
      connection.off("chat:message", onMessage);
      connection.disconnect();
    };
  }, [client, refreshConversations, socket]);

  const mergedUser = profileUpdates[user.id] || user;
  const effectiveSelectedId = selectedId || conversations[0]?.id || "";
  const selectedConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === effectiveSelectedId) ??
      (openedConversation?.id === effectiveSelectedId ? openedConversation : undefined),
    [conversations, effectiveSelectedId, openedConversation],
  );
  const unreadNotifications = notifications.length;

  const selectPerson = async (person) => {
    setBannerError("");
    setOpeningPersonId(person.id);
    try {
      const { data: result } = await client.mutate({
        mutation: CREATE_DIRECT_CONVERSATION,
        variables: { userId: person.id },
      });
      const conversation = result?.createDirectConversation;
      if (!conversation?.id) {
        throw new Error("The conversation could not be opened. Please try again.");
      }
      setOpenedConversation(conversation);
      setSelectedId(conversation.id);
      setMobileChatOpen(true);
      setActiveSection("chats");
      setNewChatOpen(false);
      refreshConversations();
    } catch (requestError) {
      setBannerError(requestError.message || "Couldn't start this conversation.");
    } finally {
      setOpeningPersonId("");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (requestError) {
      setBannerError(requestError.message || "Couldn't sign out.");
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileSaving(true);
    setBannerError("");
    try {
      const { data: result } = await updateProfile({
        variables: {
          input: {
            username: profileName,
            bio: profileBio,
          },
        },
      });
      setProfileUpdates((current) => ({
        ...current,
        [user.id]: result.updateMyProfile,
      }));
      setProfileName(result.updateMyProfile.username);
      setProfileBio(result.updateMyProfile.bio || "");
      setBannerError("");
      await client.refetchQueries({ include: [CONVERSATIONS_QUERY] });
    } catch (requestError) {
      setBannerError(requestError.message || "Profile couldn't be updated.");
    } finally {
      setProfileSaving(false);
    }
  };

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setAvatarSaving(true);
    setBannerError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch(`${API_URL}/api/chat/profile/avatar`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || "Profile image couldn't be uploaded.");
      }
      setProfileUpdates((current) => ({ ...current, [user.id]: result.user }));
    } catch (requestError) {
      setBannerError(requestError.message || "Profile image couldn't be uploaded.");
    } finally {
      setAvatarSaving(false);
    }
  };

  return (
    <div className={`chat-workspace${mobileChatOpen ? " mobile-show-chat" : ""}`}>
      <aside className="app-rail">
        <Brand compact />
        <nav className="rail-navigation" aria-label="Main navigation">
          {navigation.map(({ id, label, Icon }) => (
            <button
              aria-label={label}
              className={`rail-button${activeSection === id ? " is-active" : ""}`}
              key={id}
              onClick={() => {
                setActiveSection(id);
                setMobileChatOpen(false);
              }}
              title={label}
            >
              <Icon size={19} strokeWidth={1.9} />
              {id === "notifications" && unreadNotifications > 0 && (
                <span className="rail-badge">{unreadNotifications > 9 ? "9+" : unreadNotifications}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="rail-bottom">
          <button
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="rail-button"
            onClick={toggleTheme}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            aria-label="Settings"
            className={`rail-button${activeSection === "settings" ? " is-active" : ""}`}
            onClick={() => {
              setActiveSection("settings");
              setMobileChatOpen(false);
            }}
            title="Settings"
          >
            <Settings size={19} />
          </button>
          <div className="rail-avatar"><Avatar user={mergedUser} size="sm" /></div>
        </div>
      </aside>

      <aside className="conversation-sidebar">
        {activeSection === "chats" && (
          <ConversationList
            currentUser={mergedUser}
            conversations={conversations}
            error={error}
            loading={loading}
            onNewChat={() => setNewChatOpen(true)}
            onSearch={setConversationSearch}
            onSelect={(id) => {
              setSelectedId(id);
              setMobileChatOpen(true);
            }}
            presence={presence}
            search={conversationSearch}
            selectedId={effectiveSelectedId}
          />
        )}
        {activeSection === "friends" && (
          <PeoplePanel
            onSelect={selectPerson}
            openingPersonId={openingPersonId}
            title="Friends"
            actionLabel="Message"
          />
        )}
        {activeSection === "notifications" && (
          <NotificationsPanel
            notifications={notifications}
            onOpenConversation={(id) => {
              setSelectedId(id);
              setActiveSection("chats");
              setMobileChatOpen(true);
            }}
          />
        )}
        {activeSection === "settings" && (
          <div className="sidebar-view settings-view">
            <div className="sidebar-heading">
              <div><span className="eyebrow">MAKE IT YOURS</span><h1>Settings</h1></div>
            </div>
            <button className="setting-row" onClick={toggleTheme}>
              <span className="setting-icon">{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</span>
              <span><strong>Appearance</strong><small>{theme === "dark" ? "Dark mode" : "Light mode"}</small></span>
              <span className="setting-switch" />
            </button>
            <form className="profile-settings-form" onSubmit={saveProfile}>
              <div className="profile-settings-heading">
                <span className="eyebrow">YOUR PROFILE</span>
                <button className="text-button" disabled={profileSaving} type="submit">
                  {profileSaving ? "Saving..." : "Save"}
                </button>
              </div>
              <div className="avatar-edit-row">
                <Avatar user={mergedUser} size="lg" />
                <div>
                  <strong>Profile photo</strong>
                  <button
                    className="text-button"
                    disabled={avatarSaving}
                    onClick={() => avatarInput.current?.click()}
                    type="button"
                  >
                    {avatarSaving ? "Uploading..." : "Change photo"}
                  </button>
                </div>
                <input
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="visually-hidden"
                  onChange={uploadAvatar}
                  ref={avatarInput}
                  type="file"
                />
              </div>
              <label className="form-field settings-field">
                <span>Display name</span>
                <input
                  maxLength={32}
                  minLength={2}
                  onChange={(event) => setProfileName(event.target.value)}
                  required
                  value={profileName}
                />
              </label>
              <label className="form-field settings-field">
                <span>About you <small>{profileBio.length}/160</small></span>
                <textarea
                  maxLength={160}
                  onChange={(event) => setProfileBio(event.target.value)}
                  rows={3}
                  value={profileBio}
                />
              </label>
            </form>
            <button className="setting-row" onClick={handleSignOut}>
              <span className="setting-icon"><LogOut size={17} /></span>
              <span><strong>Sign out</strong><small>End this session</small></span>
            </button>
            <div className="settings-note">
              <Avatar user={mergedUser} size="lg" />
              <strong>{mergedUser.username}</strong>
              <span>{mergedUser.email}</span>
            </div>
          </div>
        )}
      </aside>

      <main className="chat-main">
        {bannerError && <div className="workspace-banner" role="status">{bannerError}</div>}
        <ChatPanel
          conversation={selectedConversation}
          currentUser={mergedUser}
          onBack={() => setMobileChatOpen(false)}
          onRefreshConversations={refreshConversations}
          presence={presence}
          socket={socket}
        />
      </main>

      {newChatOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setNewChatOpen(false);
        }}>
          <section aria-labelledby="new-chat-title" aria-modal="true" className="new-chat-modal" role="dialog">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">FIND YOUR PEOPLE</span>
                <h2 id="new-chat-title">Start a conversation</h2>
              </div>
              <button aria-label="Close dialog" className="icon-button" onClick={() => setNewChatOpen(false)}>×</button>
            </div>
            <PeoplePanel
              onSelect={selectPerson}
              openingPersonId={openingPersonId}
              title="People"
              actionLabel="Start chat"
            />
          </section>
        </div>
      )}
    </div>
  );
}
