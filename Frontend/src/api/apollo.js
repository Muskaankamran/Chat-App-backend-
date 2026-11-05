import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

export const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:3000"
).replace(/\/+$/, "");

const httpLink = new HttpLink({
  uri: `${API_URL}/graphql`,
  credentials: "include",
});

export const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
});
