import React, { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { QuillBinding } from 'y-quill';
import Quill from 'quill';
import QuillCursors from 'quill-cursors';
import hljs from 'highlight.js';
import 'highlight.js/styles/monokai-sublime.css';
import 'quill/dist/quill.snow.css';
import toast, { Toaster } from 'react-hot-toast';

Quill.register('modules/cursors', QuillCursors);

export default function CollaborativeEditor() {
  const editorContainerRef = useRef(null);
  const editorInstanceRef = useRef(null);
  const providerRef = useRef(null);
  const bindingRef = useRef(null);
  const ydocRef = useRef(null);

  const [status, setStatus] = useState('connecting...');
  const [users, setUsers] = useState([]);
  const [roomId, setRoomId] = useState('');
  const [docTitle, setDocTitle] = useState('Untitled Document');
  const [localUser, setLocalUser] = useState({ name: 'Anonymous', color: '#000' });
  const [activeMenu, setActiveMenu] = useState(null);
  const [stats, setStats] = useState({ words: 0, chars: 0 });
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  
  // Chat state
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const chatArrayRef = useRef(null);
  const chatEndRef = useRef(null);
  let typingTimeoutRef = useRef(null);
  
  const titleMapRef = useRef(null);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    let rawHash = window.location.hash.substring(1);
    if (!rawHash) return;
    
    let currentRoom = rawHash;
    let initialTitle = '';
    if (rawHash.includes('?title=')) {
      const parts = rawHash.split('?title=');
      currentRoom = parts[0];
      initialTitle = decodeURIComponent(parts[1]);
      // Clean URL silently
      window.history.replaceState(null, '', '#' + currentRoom);
    }
    
    setRoomId(currentRoom);

    if (!editorInstanceRef.current) {
      const oldToolbars = document.querySelectorAll('.ql-toolbar');
      oldToolbars.forEach(t => t.remove());

      const quill = new Quill(editorContainerRef.current, {
        modules: {
          cursors: true,
          syntax: { hljs },
          toolbar: [
            [{ header: [1, 2, 3, false] }],
            [{ font: [] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ color: [] }, { background: [] }],
            [{ script: 'sub'}, { script: 'super' }],
            [{ align: [] }],
            [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1'}, { indent: '+1' }],
            ['link', 'image', 'video', 'code-block'],
            ['clean']
          ]
        },
        placeholder: 'Start typing to collaborate...',
        theme: 'snow'
      });
      editorInstanceRef.current = quill;
      
      let statsTimeout = null;
      const updateStats = () => {
        if (statsTimeout) clearTimeout(statsTimeout);
        statsTimeout = setTimeout(() => {
          const text = quill.getText().trim();
          const chars = text.length;
          const words = text.length > 0 ? text.split(/\s+/).length : 0;
          setStats({ words, chars });
        }, 300);
      };
      quill.on('text-change', updateStats);
      setTimeout(() => {
        const text = quill.getText().trim();
        setStats({ chars: text.length, words: text.length > 0 ? text.split(/\s+/).length : 0 });
      }, 500);

      const ydoc = new Y.Doc();
      ydocRef.current = ydoc;

      // 1. Offline Support via IndexedDB
      const indexeddbProvider = new IndexeddbPersistence(currentRoom, ydoc);
      indexeddbProvider.on('synced', () => {
        console.log('Loaded from local IndexedDB cache');
      });

      // 2. WebSocket Connection
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = window.location.hostname === 'localhost' && window.location.port === '5173'
        ? 'ws://localhost:1234'
        : `${wsProtocol}//${window.location.host}`;
      
      const provider = new WebsocketProvider(wsUrl, currentRoom, ydoc);
      providerRef.current = provider;

      provider.on('status', event => {
        setStatus(event.status);
      });

      const ytext = ydoc.getText('quill');
      const binding = new QuillBinding(ytext, quill, provider.awareness);
      bindingRef.current = binding;

      const ymap = ydoc.getMap('metadata');
      titleMapRef.current = ymap;
      ymap.observe(() => {
        const t = ymap.get('title') || 'Untitled Document';
        setDocTitle(t);
        document.title = `${t} - SyncScribe`;
      });

      // Handle initial title from URL if creating
      if (initialTitle && !ymap.has('title')) {
        ymap.set('title', initialTitle);
      }

      // Handle local file import
      const importedContent = localStorage.getItem('importFileContent');
      if (importedContent) {
        setTimeout(() => {
          if (quill.getText().trim().length === 0) {
            quill.clipboard.dangerouslyPasteHTML(importedContent);
          }
          localStorage.removeItem('importFileContent');
        }, 500);
      }

      // 3. Live Chat Synchronization
      const ychat = ydoc.getArray('chat');
      chatArrayRef.current = ychat;
      ychat.observe(() => {
        setChatMessages(ychat.toArray());
      });

      // 4. Awareness & Users
      const colors = ['#f5624d', '#4a90e2', '#50e3c2', '#b8e986', '#f8e71c', '#9b59b6', '#e67e22', '#34495e'];
      let savedUser = null;
      try {
        savedUser = JSON.parse(localStorage.getItem('userProfile'));
      } catch (e) {}

      if (!savedUser) {
        // Force login if not authenticated
        window.location.hash = '';
        return;
      }

      const myUser = savedUser;
      
      setLocalUser(myUser);
      provider.awareness.setLocalStateField('user', myUser);

      let prevUsersMap = new Map();
      provider.awareness.on('change', () => {
        const states = Array.from(provider.awareness.getStates().entries());
        const activeUsers = [];
        const currentlyTyping = [];
        
        states.forEach(([clientId, state]) => {
          if (state.user) {
            activeUsers.push(state.user);
            if (state.isTyping && state.user.name !== myUser.name) {
              currentlyTyping.push(state.user.name);
            }
            if (!prevUsersMap.has(clientId) && state.user.name !== myUser.name) {
              toast(`${state.user.name} joined the room`, { icon: '👋', duration: 3000 });
            }
            prevUsersMap.set(clientId, state.user);
          }
        });

        prevUsersMap.forEach((user, clientId) => {
          if (!provider.awareness.getStates().has(clientId)) {
            toast(`${user.name} left the room`, { icon: '🚪', duration: 3000 });
            prevUsersMap.delete(clientId);
          }
        });

        setUsers(activeUsers);
        setTypingUsers(currentlyTyping);
      });
    }

    const closeMenu = () => setActiveMenu(null);
    document.addEventListener('click', closeMenu);

    return () => {
      document.removeEventListener('click', closeMenu);
      if (bindingRef.current) bindingRef.current.destroy();
      if (providerRef.current) providerRef.current.disconnect();
      if (editorContainerRef.current) {
        const toolbar = editorContainerRef.current.previousSibling;
        if (toolbar && toolbar.classList && toolbar.classList.contains('ql-toolbar')) {
          toolbar.remove();
        }
        editorContainerRef.current.innerHTML = '';
      }
      editorInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const recents = JSON.parse(localStorage.getItem('recentDocs') || '[]');
    const existingIndex = recents.findIndex(d => d.id === roomId);
    
    if (existingIndex > -1) {
      recents[existingIndex].lastVisited = Date.now();
      recents[existingIndex].title = docTitle;
    } else {
      recents.unshift({ id: roomId, title: docTitle, lastVisited: Date.now() });
    }
    
    localStorage.setItem('recentDocs', JSON.stringify(recents.slice(0, 10)));
  }, [docTitle, roomId]);

  // Scroll to bottom of chat when new message arrives
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, showChat]);

  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setDocTitle(newTitle);
    document.title = `${newTitle} - Collaborative Editor`;
    if (titleMapRef.current) {
      titleMapRef.current.set('title', newTitle);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Shareable link copied to clipboard!');
  };

  const updateName = () => {
    const newName = prompt('Enter your name:', localUser.name);
    if (newName && newName.trim() !== '') {
      const updatedUser = { ...localUser, name: newName.trim() };
      setLocalUser(updatedUser);
      localStorage.setItem('userProfile', JSON.stringify(updatedUser));
      if (providerRef.current) {
        providerRef.current.awareness.setLocalStateField('user', updatedUser);
      }
      toast.success(`Name updated to ${newName.trim()}`);
    }
  };

  const sendChatMessage = (e) => {
    e.preventDefault();
    if (chatInput.trim() === '' || !chatArrayRef.current) return;
    
    chatArrayRef.current.push([{
      user: localUser.name,
      color: localUser.color,
      text: chatInput.trim(),
      time: new Date().toISOString()
    }]);
    
    setChatInput('');
  };

  const downloadText = () => {
    if (!editorInstanceRef.current) return;
    const text = editorInstanceRef.current.getText();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docTitle || 'document'}.txt`;
    a.click();
    toast.success('Downloaded as Text');
  };

  const downloadHtml = () => {
    if (!editorContainerRef.current) return;
    const html = editorContainerRef.current.querySelector('.ql-editor').innerHTML;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docTitle || 'document'}.html`;
    a.click();
    toast.success('Downloaded as HTML');
  };

  const printDoc = () => window.print();

  const clearDoc = () => {
    if (window.confirm('Are you sure you want to clear the entire document? This affects all users.')) {
      if (editorInstanceRef.current) {
        editorInstanceRef.current.setText('');
        toast.success('Document cleared');
      }
    }
  };

  const toggleMenu = (e, menuName) => {
    e.stopPropagation();
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Toaster position="bottom-right" />
      <nav className="navbar">
        <div className="nav-left">
          <div 
            className="doc-icon" 
            title="Go to Dashboard"
            style={{ cursor: 'pointer' }}
            onClick={() => window.location.hash = ''}
          >
            📝
          </div>
          <div>
            <input 
              className="doc-title-input"
              value={docTitle} 
              onChange={handleTitleChange} 
              placeholder="Untitled Document"
              title="Rename Document"
            />
            <div style={{ fontSize: '0.85rem', color: '#444746', display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
              <div style={{ position: 'relative' }}>
                <span className="menu-btn" onClick={(e) => toggleMenu(e, 'file')}>File</span>
                {activeMenu === 'file' && (
                  <div className="dropdown-menu">
                    <div className="dropdown-item" onClick={() => {
                      if (editorInstanceRef.current) {
                        navigator.clipboard.writeText(editorInstanceRef.current.getText());
                        toast.success('Document text copied to clipboard!');
                      }
                    }}>Copy Document Text</div>
                    <div className="dropdown-divider"></div>
                    <div className="dropdown-item" onClick={downloadText}>Download as .txt</div>
                    <div className="dropdown-item" onClick={downloadHtml}>Download as .html</div>
                    <div className="dropdown-divider"></div>
                    <div className="dropdown-item" onClick={printDoc}>Print</div>
                  </div>
                )}
              </div>

              <div style={{ position: 'relative' }}>
                <span className="menu-btn" onClick={(e) => toggleMenu(e, 'edit')}>Edit</span>
                {activeMenu === 'edit' && (
                  <div className="dropdown-menu">
                    <div className="dropdown-item" onClick={clearDoc} style={{ color: '#d93025' }}>Clear Document</div>
                  </div>
                )}
              </div>

              <div style={{ position: 'relative' }}>
                <span className="menu-btn" onClick={(e) => toggleMenu(e, 'view')}>View</span>
                {activeMenu === 'view' && (
                  <div className="dropdown-menu">
                    <div className="dropdown-item" onClick={() => setDarkMode(!darkMode)}>
                      {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
                    </div>
                    <div className="dropdown-item" onClick={() => {
                      if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen();
                      } else {
                        document.exitFullscreen();
                      }
                    }}>Toggle Fullscreen</div>
                  </div>
                )}
              </div>
              
              <span style={{ 
                marginLeft: '15px',
                padding: '2px 8px', 
                borderRadius: '12px', 
                backgroundColor: status === 'connected' ? (darkMode ? '#1e4620' : '#e6f4ea') : (darkMode ? '#4a1515' : '#fce8e6'),
                color: status === 'connected' ? (darkMode ? '#81c995' : '#137333') : (darkMode ? '#f28b82' : '#c5221f'),
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {status === 'connected' ? '🟢 Connected' : '🔴 Offline'}
              </span>
              
              <span style={{ color: '#1a73e8', fontWeight: '500' }}>Room: #{roomId}</span>
            </div>
          </div>
        </div>
        
        <div className="nav-right">
          <div className="word-count" style={{ marginRight: '15px', fontSize: '0.85rem', color: '#5f6368', display: 'flex', gap: '10px' }}>
            <span>{stats.words} words</span>
            <span>{stats.chars} characters</span>
          </div>

          <button className="btn-secondary" style={{ marginRight: '10px', padding: '6px 12px' }} onClick={() => setShowChat(!showChat)}>
            💬 Chat
          </button>

          <button className="share-btn" onClick={copyLink}>
            🔗 Share
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', marginLeft: '10px' }}>
            {users.map((u, i) => (
              <div key={i} title={u.name + (u.name === localUser.name ? ' (You)' : '')} onClick={u.name === localUser.name ? updateName : undefined} style={{
                width: '35px', height: '35px', borderRadius: '50%', 
                backgroundColor: u.color, color: 'white', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                fontWeight: 'bold', border: '2px solid white',
                marginLeft: i > 0 ? '-12px' : '0', zIndex: 10 - i,
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                cursor: u.name === localUser.name ? 'pointer' : 'default'
              }}>
                {u.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      </nav>

      <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        {/* Editor Main Canvas */}
        <div className="editor-wrapper" style={{ flexGrow: 1, overflowY: 'auto' }}>
          <div ref={editorContainerRef} />
        </div>

        {/* Live Chat Sidebar */}
        {showChat && (
          <div className={`chat-sidebar ${darkMode ? 'dark' : ''}`} style={{ 
            width: '320px', 
            borderLeft: `1px solid ${darkMode ? '#444' : '#dadce0'}`,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: darkMode ? '#2b2b2b' : '#ffffff'
          }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${darkMode ? '#444' : '#dadce0'}`, fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Room Chat</span>
              <button onClick={() => setShowChat(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: darkMode ? '#e8eaed' : '#5f6368', fontSize: '1.2rem' }}>✕</button>
            </div>
            
            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {chatMessages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9aa0a6', fontSize: '0.9rem', marginTop: '20px' }}>No messages yet. Say hi!</div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div key={idx} style={{ 
                    alignSelf: msg.user === localUser.name ? 'flex-end' : 'flex-start',
                    maxWidth: '85%'
                  }}>
                    {msg.user !== localUser.name && (
                      <div style={{ fontSize: '0.75rem', color: msg.color, marginBottom: '2px', marginLeft: '4px', fontWeight: '600' }}>
                        {msg.user}
                      </div>
                    )}
                    <div style={{ 
                      backgroundColor: msg.user === localUser.name ? '#1a73e8' : (darkMode ? '#3c4043' : '#f1f3f4'),
                      color: msg.user === localUser.name ? 'white' : (darkMode ? '#e8eaed' : '#202124'),
                      padding: '8px 12px',
                      borderRadius: '16px',
                      borderBottomRightRadius: msg.user === localUser.name ? '4px' : '16px',
                      borderBottomLeftRadius: msg.user !== localUser.name ? '4px' : '16px',
                      fontSize: '0.9rem',
                      lineHeight: '1.4'
                    }}>
                      {msg.text}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#9aa0a6', marginTop: '4px', textAlign: msg.user === localUser.name ? 'right' : 'left', marginRight: '4px', marginLeft: '4px' }}>
                      {msg.time.includes('T') ? new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : msg.time}
                    </div>
                  </div>
                ))
              )}
              {typingUsers.length > 0 && (
                <div style={{ fontSize: '0.8rem', color: '#9aa0a6', fontStyle: 'italic', marginLeft: '8px' }}>
                  {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={sendChatMessage} style={{ padding: '12px', borderTop: `1px solid ${darkMode ? '#444' : '#dadce0'}`, display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                value={chatInput}
                onChange={e => {
                  setChatInput(e.target.value);
                  if (providerRef.current) {
                    providerRef.current.awareness.setLocalStateField('isTyping', true);
                    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                    typingTimeoutRef.current = setTimeout(() => {
                      providerRef.current.awareness.setLocalStateField('isTyping', false);
                    }, 2000);
                  }
                }}
                placeholder="Type a message..."
                style={{ 
                  flexGrow: 1, 
                  padding: '8px 12px', 
                  borderRadius: '20px', 
                  border: `1px solid ${darkMode ? '#5f6368' : '#dadce0'}`,
                  backgroundColor: darkMode ? '#202124' : 'white',
                  color: darkMode ? '#e8eaed' : '#202124',
                  outline: 'none'
                }}
              />
              <button type="submit" disabled={!chatInput.trim()} style={{ 
                backgroundColor: chatInput.trim() ? '#1a73e8' : (darkMode ? '#3c4043' : '#e8eaed'), 
                color: chatInput.trim() ? 'white' : '#9aa0a6',
                border: 'none', 
                borderRadius: '50%', 
                width: '36px', 
                height: '36px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                cursor: chatInput.trim() ? 'pointer' : 'default',
                transition: 'background-color 0.2s'
              }}>
                ➤
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
