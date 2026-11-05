import jwt from "jsonwebtoken";

const TOKEN_LIFETIME = "1d";
const COOKIE_MAX_AGE = 24 * 60 * 60 * 1000;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return secret;
}

export function createAuthToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    getJwtSecret(),
    { expiresIn: TOKEN_LIFETIME },
  );
}

export function verifyAuthToken(token) {
  const payload = jwt.verify(token, getJwtSecret());
  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof payload.id !== "string"
  ) {
    throw new Error("Invalid authentication token");
  }
  return payload;
}

export function serializePublicUser(user) {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    bio: user.bio ?? "",
    avatarUrl: user.avatarUrl ?? "",
  };
}

export function setAuthCookie(res, token) {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie("token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export function clearAuthCookie(res) {
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie("token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });
}
