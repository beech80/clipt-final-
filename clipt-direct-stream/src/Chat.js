import React, { useEffect, useRef, useState } from "react";
import { sendMessage, subscribeToChat } from "./firebase";

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const containerRef = useRef();

  useEffect(() => {
    // subscribe to new messages
    subscribeToChat(msg => {
      setMessages(ms => {
        const next = [...ms, msg];
        return next.length > 200 ? next.slice(-200) : next;
      });
    });
  }, []);

  useEffect(() => {
    // scroll to bottom on new message
    containerRef.current?.scrollTo(0, containerRef.current.scrollHeight);
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    sendMessage("Viewer", text);
    setInput("");
  };

  return (
    <div style={styles.chatWrapper}>
      <div ref={containerRef} style={styles.messages}>
        {messages.map((m, i) => (
          <div key={i} style={styles.message}>
            <strong>{m.user}:</strong> {m.text}
          </div>
        ))}
      </div>
      <div style={styles.inputBar}>
        <input
          style={styles.input}
          value={input}
          placeholder="Type a message..."
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSend()}
        />
        <button style={styles.button} onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}

const styles = {
  chatWrapper: {
    width: 300,
    maxWidth: "30%",
    display: "flex",
    flexDirection: "column",
    background: "#1c1c1c",
    color: "#fff",
    fontFamily: "sans-serif"
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: 10,
    fontSize: 14
  },
  message: {
    marginBottom: 6
  },
  inputBar: {
    display: "flex",
    borderTop: "1px solid #444"
  },
  input: {
    flex: 1,
    padding: "8px 10px",
    border: "none",
    outline: "none",
    background: "#2c2c2c",
    color: "#fff"
  },
  button: {
    padding: "0 16px",
    background: "#007aff",
    color: "#fff",
    border: "none",
    cursor: "pointer"
  }
};
