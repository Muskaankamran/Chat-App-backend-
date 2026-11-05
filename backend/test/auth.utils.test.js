import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import {
  createAuthToken,
  clearAuthCookie,
  serializePublicUser,
  setAuthCookie,
  verifyAuthToken,
} from "../src/utils/auth.utils.js";
import { authenticateToken } from "../src/middlewares/auth.middleware.js";

const previousSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = "test-only-secret-with-sufficient-length";

after(() => {
  if (previousSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = previousSecret;
  }
});

describe("authentication utilities", () => {
  it("serializes only public user fields", () => {
    const publicUser = serializePublicUser({
      _id: { toString: () => "user-123" },
      username: "sam",
      email: "sam@example.com",
      role: "user",
      password: "hashed-password",
      cart: [{ product: "private-cart-item" }],
    });

    assert.deepEqual(publicUser, {
      id: "user-123",
      username: "sam",
      email: "sam@example.com",
      bio: "",
      avatarUrl: "",
    });
  });

  it("signs expiring tokens that can be verified", () => {
    const token = createAuthToken({
      _id: { toString: () => "user-123" },
      role: "user",
    });

    assert.deepEqual(
      { id: verifyAuthToken(token).id, role: verifyAuthToken(token).role },
      { id: "user-123", role: "user" },
    );
    assert.throws(() => verifyAuthToken("not-a-token"));
  });

  it("sets an HttpOnly, SameSite cookie without returning it in user data", () => {
    let cookie;
    setAuthCookie({
      cookie(name, value, options) {
        cookie = { name, value, options };
      },
    }, "signed-token");

    assert.equal(cookie.name, "token");
    assert.equal(cookie.value, "signed-token");
    assert.equal(cookie.options.httpOnly, true);
    assert.equal(cookie.options.sameSite, "lax");
    assert.equal(cookie.options.secure, process.env.NODE_ENV === "production");
  });

  it("clears the authentication cookie using matching security attributes", () => {
    let cookie;
    clearAuthCookie({
      clearCookie(name, options) {
        cookie = { name, options };
      },
    });

    assert.equal(cookie.name, "token");
    assert.equal(cookie.options.httpOnly, true);
    assert.equal(cookie.options.path, "/");
  });

  it("authenticates bearer tokens without exposing verification errors", () => {
    const token = createAuthToken({
      _id: { toString: () => "user-123" },
      role: "user",
    });
    const req = {
      get: () => `Bearer ${token}`,
      cookies: {},
    };
    let nextCalled = false;
    authenticateToken(req, {
      status() {
        throw new Error("Unexpected authentication failure");
      },
    }, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.user.id, "user-123");
  });
});
