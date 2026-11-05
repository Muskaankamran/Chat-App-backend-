import { lazy, Suspense, useEffect, useState } from "react";
import { useApolloClient, useQuery } from "@apollo/client/react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { ME_QUERY } from "./api/operations.js";
import { logout } from "./api/auth.js";
import { AuthContext } from "./context/auth-context.js";

const AuthPage = lazy(() => import("./components/AuthPage.jsx"));
const ChatApp = lazy(() => import("./components/ChatApp.jsx"));

function RoutedApp({ theme, toggleTheme }) {
  const client = useApolloClient();
  const { data, loading, refetch } = useQuery(ME_QUERY, {
    errorPolicy: "all",
    fetchPolicy: "network-only",
  });
  const user = data?.me ?? null;

  const completeAuthentication = async () => {
    const result = await refetch();
    if (!result.data?.me) {
      throw new Error("The session could not be verified. Please sign in again.");
    }
  };

  const signOut = async () => {
    await logout();
    await client.clearStore();
  };

  const authValue = {
    user,
    ready: !loading,
    completeAuthentication,
    signOut,
  };

  return (
    <AuthContext.Provider value={authValue}>
      <Suspense fallback={<div className="app-loading"><span className="loading-orb" />Loading orbit</div>}>
        <Routes>
          <Route
            path="/"
            element={<Navigate to={user ? "/chat" : "/login"} replace />}
          />
          <Route
            path="/login"
            element={
              user
                ? <Navigate to="/chat" replace />
                : <AuthPage onAuthenticated={completeAuthentication} />
            }
          />
          <Route
            path="/signup"
            element={
              user
                ? <Navigate to="/chat" replace />
                : <AuthPage onAuthenticated={completeAuthentication} />
            }
          />
          <Route
            path="/chat"
            element={
              !authValue.ready
                ? <div className="app-loading"><span className="loading-orb" />Loading your workspace</div>
                : user
                  ? <ChatApp theme={theme} toggleTheme={toggleTheme} />
                  : <Navigate to="/login" replace />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthContext.Provider>
  );
}

export default function App() {
  const [theme, setTheme] = useState(
    () => window.localStorage.getItem("orbit-theme") || "dark",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("orbit-theme", theme);
  }, [theme]);

  const toggleTheme = () =>
    setTheme((current) => current === "dark" ? "light" : "dark");

  return (
    <BrowserRouter>
      <RoutedApp theme={theme} toggleTheme={toggleTheme} />
    </BrowserRouter>
  );
}
