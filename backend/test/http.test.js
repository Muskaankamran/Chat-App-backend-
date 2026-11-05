import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createServer } from "node:http";
import app from "../src/app.js";
import { mountGraphQL } from "../src/graphql/index.js";

describe("HTTP API integration", () => {
  let server;
  let apolloServer;
  let baseUrl;

  before(async () => {
    apolloServer = await mountGraphQL(app);
    server = createServer(app);
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await apolloServer.stop();
  });

  it("preserves register/login routes and validates malformed credentials", async () => {
    for (const route of ["/api/auth/register", "/api/auth/login"]) {
      const response = await fetch(`${baseUrl}${route}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      assert.equal(response.status, 400);
      assert.equal(typeof (await response.json()).message, "string");
    }
  });

  it("clears the auth cookie through the logout route", async () => {
    const response = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.match(response.headers.get("set-cookie"), /HttpOnly/i);
  });

  it("protects media uploads and GraphQL operations", async () => {
    const uploadResponse = await fetch(`${baseUrl}/api/chat/upload`, {
      method: "POST",
    });
    assert.equal(uploadResponse.status, 401);

    const graphResponse = await fetch(`${baseUrl}/graphql`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "{ me { id } }" }),
    });
    const graphBody = await graphResponse.json();
    assert.equal(graphResponse.status, 200);
    assert.equal(
      graphBody.errors[0].extensions.code,
      "UNAUTHENTICATED",
    );
  });
});
