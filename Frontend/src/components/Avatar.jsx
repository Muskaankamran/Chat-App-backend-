const avatarColors = [
  "avatar-violet",
  "avatar-rose",
  "avatar-blue",
  "avatar-amber",
  "avatar-teal",
];

export default function Avatar({ user, size = "md", showStatus = false }) {
  const name = user?.username || "User";
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const colorIndex = name.split("").reduce((total, char) => total + char.charCodeAt(0), 0)
    % avatarColors.length;

  return (
    <span className={`avatar avatar-${size} ${avatarColors[colorIndex]}`}>
      {user?.avatarUrl
        ? <img src={user.avatarUrl} alt={`${name}'s profile`} />
        : <span aria-hidden="true">{initial}</span>}
      {showStatus && (
        <span
          className={`avatar-status${user?.isOnline ? " is-online" : ""}`}
          aria-label={user?.isOnline ? "Online" : "Offline"}
        />
      )}
    </span>
  );
}
