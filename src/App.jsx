import { useEffect, useRef, useState } from "react";

const API_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";
const WS_URL = process.env.REACT_APP_WS_URL || "ws://127.0.0.1:8000";
console.log(API_URL,WS_URL)

function App() {
  const [authMode, setAuthMode] = useState("login");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [currentUser, setCurrentUser] = useState(null);
  const [accessToken, setAccessToken] = useState(
    localStorage.getItem("access_token"),
  );

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);

  const websocketRef = useRef(null);

  /*
   * ---------------------------------------------------------
   * AUTHENTICATION
   * ---------------------------------------------------------
   */

  const register = async () => {
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Username and password are required.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Registration failed.");
        return;
      }

      setUsername("");
      setPassword("");
      setAuthMode("login");

      setError("Registration successful. Please login.");
    } catch {
      setError("Cannot connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Username and password are required.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Login failed.");
        return;
      }

      localStorage.setItem("access_token", data.access_token);

      setAccessToken(data.access_token);

      setUsername("");
      setPassword("");
      setError("");
    } catch {
      setError("Cannot connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * GET CURRENT USER
   * ---------------------------------------------------------
   */

  const loadCurrentUser = async (token) => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Authentication expired.");
      }

      const data = await response.json();

      setCurrentUser(data);
      setError("");
    } catch {
      localStorage.removeItem("access_token");
      setAccessToken(null);
      setCurrentUser(null);
    }
  };

  /*
   * ---------------------------------------------------------
   * LOAD USERS
   * ---------------------------------------------------------
   *
   * The backend must eventually expose:
   *
   * GET /users/
   *
   * protected by JWT.
   *
   */

  const loadUsers = async () => {
    if (!accessToken) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/users/`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      const filteredUsers = data.filter((user) => user.id !== currentUser?.id);

      setUsers(filteredUsers);
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };

  /*
   * ---------------------------------------------------------
   * WEBSOCKET
   * ---------------------------------------------------------
   */

  const connectWebSocket = () => {
    if (!accessToken || !currentUser) {
      return;
    }

    if (websocketRef.current) {
      websocketRef.current.close();
    }

    const websocket = new WebSocket(
      `${WS_URL}/ws?token=${encodeURIComponent(accessToken)}`,
    );

    websocketRef.current = websocket;

    websocket.onopen = () => {
      console.log("WebSocket connected");

      setConnected(true);
      setError("");
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.error) {
          setError(data.error);
          return;
        }

        setMessages((previousMessages) => {
          const exists = previousMessages.some(
            (message) => message.id === data.id,
          );

          if (exists) {
            return previousMessages;
          }

          return [...previousMessages, data];
        });
      } catch (err) {
        console.error("Invalid WebSocket message:", err);
      }
    };

    websocket.onclose = () => {
      console.log("WebSocket disconnected");

      setConnected(false);
    };

    websocket.onerror = () => {
      console.error("WebSocket error");

      setConnected(false);
    };
  };

  /*
   * ---------------------------------------------------------
   * SEND MESSAGE
   * ---------------------------------------------------------
   */

  const sendMessage = () => {
    if (!selectedUser) {
      return;
    }

    if (!messageText.trim()) {
      return;
    }

    if (!websocketRef.current) {
      setError("WebSocket is not connected.");
      return;
    }

    if (websocketRef.current.readyState !== WebSocket.OPEN) {
      setError("WebSocket is not connected.");
      return;
    }

    websocketRef.current.send(
      JSON.stringify({
        receiver: selectedUser.id,
        message: messageText.trim(),
      }),
    );

    setMessageText("");
  };

  /*
   * ---------------------------------------------------------
   * LOGOUT
   * ---------------------------------------------------------
   */

  const logout = () => {
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }

    localStorage.removeItem("access_token");

    setAccessToken(null);
    setCurrentUser(null);
    setUsers([]);
    setSelectedUser(null);
    setMessages([]);
    setMessageText("");
    setConnected(false);
    setError("");
  };

  /*
   * ---------------------------------------------------------
   * INITIAL AUTH CHECK
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    loadCurrentUser(accessToken);
  }, [accessToken]);

  /*
   * ---------------------------------------------------------
   * LOAD USERS AFTER LOGIN
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!currentUser || !accessToken) {
      return;
    }

    loadUsers();
  }, [currentUser, accessToken]);

  /*
   * ---------------------------------------------------------
   * CONNECT WEBSOCKET AFTER LOGIN
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!currentUser || !accessToken) {
      return;
    }

    connectWebSocket();

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
        websocketRef.current = null;
      }
    };
  }, [currentUser, accessToken]);

  /*
   * ---------------------------------------------------------
   * SEND WITH ENTER
   * ---------------------------------------------------------
   */

  const handleMessageKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  /*
   * ---------------------------------------------------------
   * FILTER CURRENT CONVERSATION
   * ---------------------------------------------------------
   */

  const conversationMessages = selectedUser
    ? messages.filter(
        (message) =>
          (message.user === currentUser?.id &&
            message.receiver === selectedUser.id) ||
          (message.user === selectedUser.id &&
            message.receiver === currentUser?.id),
      )
    : [];

  /*
   * ---------------------------------------------------------
   * LOGIN / REGISTER SCREEN
   * ---------------------------------------------------------
   */

  if (!currentUser) {
    return (
      <div style={styles.authPage}>
        <div style={styles.authCard}>
          <h1 style={styles.authTitle}>Real-Time Chat</h1>

          <p style={styles.authSubtitle}>
            {authMode === "login"
              ? "Login to continue chatting"
              : "Create your account"}
          </p>

          {error && <div style={styles.errorBox}>{error}</div>}

          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            style={styles.input}
            autoComplete="username"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                if (authMode === "login") {
                  login();
                } else {
                  register();
                }
              }
            }}
            style={styles.input}
            autoComplete={
              authMode === "login" ? "current-password" : "new-password"
            }
          />

          {authMode === "login" ? (
            <button
              onClick={login}
              disabled={loading}
              style={styles.primaryButton}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          ) : (
            <button
              onClick={register}
              disabled={loading}
              style={styles.primaryButton}
            >
              {loading ? "Creating account..." : "Register"}
            </button>
          )}

          <div style={styles.switchContainer}>
            {authMode === "login" ? (
              <>
                <span>Don't have an account?</span>

                <button
                  onClick={() => {
                    setAuthMode("register");
                    setError("");
                  }}
                  style={styles.linkButton}
                >
                  Register
                </button>
              </>
            ) : (
              <>
                <span>Already have an account?</span>

                <button
                  onClick={() => {
                    setAuthMode("login");
                    setError("");
                  }}
                  style={styles.linkButton}
                >
                  Login
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  /*
   * ---------------------------------------------------------
   * CHAT SCREEN
   * ---------------------------------------------------------
   */

  return (
    <div style={styles.app}>
      {/* SIDEBAR */}

      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div>
            <h2 style={styles.appName}>Chat</h2>

            <div style={styles.currentUser}>{currentUser.username}</div>
          </div>

          <button onClick={logout} style={styles.logoutButton}>
            Logout
          </button>
        </div>

        <div style={styles.connectionStatus}>
          <span
            style={{
              ...styles.statusDot,
              backgroundColor: connected ? "#22c55e" : "#ef4444",
            }}
          />

          {connected ? "Connected" : "Disconnected"}
        </div>

        <div style={styles.userList}>
          {users.length === 0 ? (
            <div style={styles.emptyUsers}>No other users found.</div>
          ) : (
            users.map((user) => (
              <button
                key={user.id}
                onClick={() => {
                  setSelectedUser(user);
                  setError("");
                }}
                style={{
                  ...styles.userItem,
                  ...(selectedUser?.id === user.id ? styles.selectedUser : {}),
                }}
              >
                <div style={styles.avatar}>
                  {user.username.charAt(0).toUpperCase()}
                </div>

                <div style={styles.userInfo}>
                  <div style={styles.userName}>{user.username}</div>

                  <div style={styles.userStatus}>User #{user.id}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* CHAT AREA */}

      <div style={styles.chatArea}>
        {!selectedUser ? (
          <div style={styles.noConversation}>
            <div style={styles.noConversationIcon}>💬</div>

            <h2>Select a user</h2>

            <p>Choose a user from the left to start chatting.</p>
          </div>
        ) : (
          <>
            {/* CHAT HEADER */}

            <div style={styles.chatHeader}>
              <div style={styles.avatar}>
                {selectedUser.username.charAt(0).toUpperCase()}
              </div>

              <div>
                <div style={styles.chatUserName}>{selectedUser.username}</div>

                <div style={styles.chatUserStatus}>User #{selectedUser.id}</div>
              </div>
            </div>

            {/* ERROR */}

            {error && <div style={styles.chatError}>{error}</div>}

            {/* MESSAGES */}

            <div style={styles.messagesArea}>
              {conversationMessages.length === 0 ? (
                <div style={styles.emptyConversation}>No messages yet.</div>
              ) : (
                conversationMessages.map((message) => {
                  const isMine = message.user === currentUser.id;

                  return (
                    <div
                      key={message.id}
                      style={{
                        ...styles.messageRow,
                        justifyContent: isMine ? "flex-end" : "flex-start",
                      }}
                    >
                      <div
                        style={{
                          ...styles.messageBubble,
                          ...(isMine ? styles.myMessage : styles.theirMessage),
                        }}
                      >
                        <div>{message.message}</div>

                        <div style={styles.messageTime}>
                          {formatMessageTime(message.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* MESSAGE INPUT */}

            <div style={styles.messageInputArea}>
              <input
                type="text"
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                onKeyDown={handleMessageKeyDown}
                placeholder="Type a message..."
                style={styles.messageInput}
              />

              <button
                onClick={sendMessage}
                disabled={!messageText.trim() || !connected}
                style={{
                  ...styles.sendButton,
                  opacity: !messageText.trim() || !connected ? 0.5 : 1,
                }}
              >
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/*
 * ---------------------------------------------------------
 * FORMAT MESSAGE TIME
 * ---------------------------------------------------------
 */

function formatMessageTime(timestamp) {
  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/*
 * ---------------------------------------------------------
 * STYLES
 * ---------------------------------------------------------
 */

const styles = {
  app: {
    display: "flex",
    height: "100vh",
    width: "100%",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    backgroundColor: "#f5f7fb",
    overflow: "hidden",
  },

  /*
   * AUTH
   */

  authPage: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f7fb",
    padding: "20px",
    boxSizing: "border-box",
  },

  authCard: {
    width: "100%",
    maxWidth: "400px",
    backgroundColor: "#ffffff",
    padding: "40px",
    borderRadius: "16px",
    boxShadow: "0 10px 40px rgba(0, 0, 0, 0.08)",
    boxSizing: "border-box",
  },

  authTitle: {
    margin: "0 0 8px",
    textAlign: "center",
    color: "#111827",
    fontSize: "28px",
  },

  authSubtitle: {
    margin: "0 0 28px",
    textAlign: "center",
    color: "#6b7280",
    fontSize: "14px",
  },

  input: {
    width: "100%",
    padding: "13px 14px",
    marginBottom: "14px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box",
  },

  primaryButton: {
    width: "100%",
    padding: "13px",
    border: "none",
    borderRadius: "8px",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
  },

  switchContainer: {
    marginTop: "20px",
    display: "flex",
    justifyContent: "center",
    gap: "6px",
    fontSize: "14px",
    color: "#6b7280",
  },

  linkButton: {
    border: "none",
    background: "none",
    color: "#2563eb",
    cursor: "pointer",
    padding: 0,
    fontSize: "14px",
    fontWeight: "600",
  },

  errorBox: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    padding: "10px 12px",
    borderRadius: "8px",
    marginBottom: "16px",
    fontSize: "14px",
  },

  /*
   * SIDEBAR
   */

  sidebar: {
    width: "320px",
    minWidth: "320px",
    height: "100vh",
    backgroundColor: "#ffffff",
    borderRight: "1px solid #e5e7eb",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
  },

  sidebarHeader: {
    padding: "20px",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  appName: {
    margin: 0,
    fontSize: "22px",
    color: "#111827",
  },

  currentUser: {
    marginTop: "4px",
    color: "#6b7280",
    fontSize: "13px",
  },

  logoutButton: {
    border: "1px solid #d1d5db",
    backgroundColor: "#ffffff",
    color: "#374151",
    borderRadius: "7px",
    padding: "7px 10px",
    cursor: "pointer",
    fontSize: "12px",
  },

  connectionStatus: {
    padding: "10px 20px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
    color: "#6b7280",
    borderBottom: "1px solid #f3f4f6",
  },

  statusDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    display: "inline-block",
  },

  userList: {
    flex: 1,
    overflowY: "auto",
  },

  emptyUsers: {
    padding: "30px 20px",
    textAlign: "center",
    color: "#9ca3af",
    fontSize: "14px",
  },

  userItem: {
    width: "100%",
    border: "none",
    backgroundColor: "#ffffff",
    padding: "14px 20px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    cursor: "pointer",
    textAlign: "left",
    borderBottom: "1px solid #f3f4f6",
  },

  selectedUser: {
    backgroundColor: "#eff6ff",
  },

  avatar: {
    width: "42px",
    height: "42px",
    minWidth: "42px",
    borderRadius: "50%",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "17px",
    fontWeight: "600",
  },

  userInfo: {
    minWidth: 0,
  },

  userName: {
    color: "#111827",
    fontSize: "15px",
    fontWeight: "600",
  },

  userStatus: {
    marginTop: "3px",
    color: "#9ca3af",
    fontSize: "12px",
  },

  /*
   * CHAT
   */

  chatArea: {
    flex: 1,
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },

  chatHeader: {
    height: "72px",
    minHeight: "72px",
    padding: "0 24px",
    backgroundColor: "#ffffff",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    boxSizing: "border-box",
  },

  chatUserName: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#111827",
  },

  chatUserStatus: {
    marginTop: "3px",
    fontSize: "12px",
    color: "#9ca3af",
  },

  chatError: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    padding: "9px 20px",
    fontSize: "13px",
  },

  messagesArea: {
    flex: 1,
    overflowY: "auto",
    padding: "24px",
    backgroundColor: "#f8fafc",
    boxSizing: "border-box",
  },

  messageRow: {
    display: "flex",
    marginBottom: "10px",
  },

  messageBubble: {
    maxWidth: "65%",
    padding: "10px 13px",
    borderRadius: "12px",
    fontSize: "14px",
    lineHeight: "1.4",
    wordBreak: "break-word",
  },

  myMessage: {
    backgroundColor: "#2563eb",
    color: "#ffffff",
    borderBottomRightRadius: "4px",
  },

  theirMessage: {
    backgroundColor: "#ffffff",
    color: "#111827",
    border: "1px solid #e5e7eb",
    borderBottomLeftRadius: "4px",
  },

  messageTime: {
    marginTop: "4px",
    fontSize: "10px",
    opacity: 0.7,
    textAlign: "right",
  },

  emptyConversation: {
    height: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    color: "#9ca3af",
    fontSize: "14px",
  },

  noConversation: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    color: "#6b7280",
    textAlign: "center",
  },

  noConversationIcon: {
    fontSize: "48px",
    marginBottom: "10px",
  },

  messageInputArea: {
    padding: "14px 20px",
    backgroundColor: "#ffffff",
    borderTop: "1px solid #e5e7eb",
    display: "flex",
    gap: "10px",
  },

  messageInput: {
    flex: 1,
    padding: "12px 14px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    outline: "none",
    fontSize: "14px",
  },

  sendButton: {
    padding: "0 20px",
    border: "none",
    borderRadius: "8px",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    fontWeight: "600",
    cursor: "pointer",
  },
};

export default App;
