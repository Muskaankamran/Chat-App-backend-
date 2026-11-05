import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { verifyAuthToken } from "../utils/auth.utils.js";
import { resolvers } from "./resolvers.js";
import { typeDefs } from "./schema.js";

function getRequestAuth(req) {
  const authorization = req.get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const token = bearerToken || req.cookies?.token;
  if (!token) {
    return null;
  }
  try {
    return verifyAuthToken(token);
  } catch {
    return null;
  }
}

export async function mountGraphQL(app) {
  const apolloServer = new ApolloServer({ typeDefs, resolvers });
  await apolloServer.start();
  app.use(
    "/graphql",
    expressMiddleware(apolloServer, {
      context: async ({ req }) => ({
        auth: getRequestAuth(req),
        io: req.app.get("io"),
      }),
    }),
  );
  return apolloServer;
}
