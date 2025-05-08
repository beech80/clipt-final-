import React, { useEffect, useRef } from "react";
import { Stream } from "@cloudflare/stream-react";
import Chat from "./Chat";

export default function App() {
  const playerRef = useRef();
  const videoId = process.env.REACT_APP_STREAM_VIDEO_ID;
  const accountId = process.env.REACT_APP_CF_ACCOUNT_ID;

  // Optional: track player events, errors, for observability
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const onError = e => console.error("Cloudflare Player Error:", e);
    p.on("error", onError);
    return () => p.off("error", onError);
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.videoWrapper}>
        <Stream
          ref={playerRef}
          src={videoId}
          controls
          autoplay
          muted
          style={styles.video}
          // enable LL-HLS
          hlsConfig={{ lowLatencyMode: true }}
        />
      </div>
      <Chat />
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    height: "100vh",
    background: "#000"
  },
  videoWrapper: {
    flex: 1,
    position: "relative"
  },
  video: {
    width: "100%",
    height: "100%"
  }
};
