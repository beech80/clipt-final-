import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { io } from 'socket.io-client';

export default function App() {
  const videoRef = useRef();
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const socket = useRef(null);

  useEffect(() => {
    // Video setup
    const streamURL = process.env.REACT_APP_STREAM_URL;
    if (Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60 });
      hls.on(Hls.Events.ERROR, (e, data) => {
        if (data.fatal) {
          if (data.type === 'networkError') hls.startLoad();
          else if (data.type === 'mediaError') hls.recoverMediaError();
          else hls.destroy();
        }
      });
      hls.loadSource(streamURL);
      hls.attachMedia(videoRef.current);
    } else {
      videoRef.current.src = streamURL;
    }

    // Chat setup
    socket.current = io(process.env.REACT_APP_CHAT_URL);
    socket.current.on('chat message', m => {
      setMsgs(prev => [...prev.slice(-99), m]);
    });
    return () => socket.current.disconnect();
  }, []);

  const sendMsg = () => {
    if (input.trim()) {
      socket.current.emit('chat message', input.trim());
      setInput('');
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <video
        ref={videoRef}
        controls autoPlay muted
        style={{ flex: 1, background: '#000' }}
      />
      <div style={{
        width: 300, background: '#111', color: '#fff',
        display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
          {msgs.map((m,i) => <div key={i}>{m}</div>)}
        </div>
        <div style={{ display: 'flex' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key==='Enter' && sendMsg()}
            style={{ flex:1, padding:5, border:'none' }}
          />
          <button onClick={sendMsg} style={{ padding:5 }}>Send</button>
        </div>
      </div>
    </div>
  );
}
