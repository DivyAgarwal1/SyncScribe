import React, { useState, useEffect } from 'react';
import logo from './assets/logo.jpg';

export default function Dashboard({ onLogin }) {
  const [roomCode, setRoomCode] = useState('');
  const [recentDocs, setRecentDocs] = useState([]);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('recentDocs') || '[]');
    setRecentDocs(stored.sort((a, b) => b.lastVisited - a.lastVisited));
    document.body.classList.remove('dark-mode');
  }, []);

  const [newDocTitle, setNewDocTitle] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [isLogin, setIsLogin] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('userProfile');
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
  }, []);

  const createRoom = (e) => {
    e.preventDefault();
    if (newDocTitle.trim()) {
      const val = newDocTitle.trim();
      const newRoom = 'doc-' + Math.random().toString(36).substring(2, 9);
      window.location.hash = val ? `${newRoom}?title=${encodeURIComponent(val)}` : newRoom;
    }
  };

  const joinRoom = (e) => {
    e.preventDefault();
    if (roomCode.trim()) {
      let code = roomCode.trim();
      if (code.startsWith('#')) code = code.substring(1);
      window.location.hash = code;
    }
  };

  const deleteRecent = (e, id) => {
    e.stopPropagation();
    const updated = recentDocs.filter(d => d.id !== id);
    setRecentDocs(updated);
    localStorage.setItem('recentDocs', JSON.stringify(updated));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      localStorage.setItem('importFileContent', content);
      
      const fileName = file.name.replace(/\.[^/.]+$/, ""); // strip extension
      const newRoom = 'doc-' + Math.random().toString(36).substring(2, 9);
      window.location.hash = fileName ? `${newRoom}?title=${encodeURIComponent(fileName)}` : newRoom;
    };
    if (file.name.endsWith('.txt') || file.name.endsWith('.html')) {
      reader.readAsText(file);
    } else {
      alert('Only .txt and .html files are supported right now.');
    }
  };


  const logout = () => {
    localStorage.removeItem('userProfile');
    setCurrentUser(null);
  };

  if (!currentUser) {
    return (
      <div className="login-page-container">
        {/* LEFT SIDE - BRANDING */}
        <div className="login-hero">
          <div className="login-hero-pattern"></div>
          
          <div style={{ zIndex: 1, maxWidth: '500px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '2rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', overflow: 'hidden', backgroundColor: 'white', padding: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <img src={logo} alt="SyncScribe" style={{ width: '100%', height: '100%', borderRadius: '12px' }} />
              </div>
              <h1 style={{ fontSize: '3rem', fontWeight: '800', margin: 0, letterSpacing: '-1px', color: 'white' }}>SyncScribe</h1>
            </div>
            
            <h2 style={{ fontSize: '1.75rem', fontWeight: '600', marginBottom: '1.5rem', lineHeight: '1.3', color: 'white' }}>
              Write, edit, and create together in real-time.
            </h2>
            <p style={{ fontSize: '1.1rem', color: '#e0e7ff', lineHeight: '1.6' }}>
              Experience seamless collaboration with conflict-free syncing, rich text formatting, and instant team chat. Your ultimate workspace for modern ideas.
            </p>
          </div>
        </div>

        {/* RIGHT SIDE - LOGIN */}
        <div className="login-form-side">
          <div style={{ width: '100%', maxWidth: '400px', padding: '0 2rem' }}>
            <h1 style={{ color: '#111827', fontSize: '2rem', marginBottom: '8px', fontWeight: '700' }}>
              {isLogin ? 'Welcome back' : 'Create an account'}
            </h1>
            <p style={{ color: '#6b7280', fontSize: '1rem', marginBottom: '40px' }}>
              {isLogin ? 'Please sign in to access your documents.' : 'Sign up to start collaborating.'}
            </p>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const email = document.getElementById('login-email').value;
              const pass = document.getElementById('login-password').value;
              if (email && pass) {
                // Fetch the simulated database of accounts from localStorage
                const accountsDb = JSON.parse(localStorage.getItem('accountsDb') || '{}');

                if (isLogin) {
                  // Verify Login
                  if (!accountsDb[email]) {
                    alert('Account not found! Please switch to "Sign Up" to create an account.');
                    return;
                  }
                  if (accountsDb[email].password !== pass) {
                    alert('Incorrect password! Please try again.');
                    return;
                  }
                  // Login Successful
                  const myUser = accountsDb[email].profile;
                  setCurrentUser(myUser);
                  localStorage.setItem('userProfile', JSON.stringify(myUser));
                  if (onLogin) onLogin();
                } else {
                  // Handle Sign Up
                  if (accountsDb[email]) {
                    alert('An account with this email already exists! Please sign in.');
                    return;
                  }
                  // Create new account
                  const name = email.includes('@') ? email.split('@')[0] : email;
                  const colors = ['#4f46e5', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#10b981'];
                  const myUser = { 
                    name: name.charAt(0).toUpperCase() + name.slice(1), 
                    color: colors[Math.floor(Math.random() * colors.length)],
                    email: email
                  };
                  
                  accountsDb[email] = {
                    password: pass,
                    profile: myUser
                  };
                  localStorage.setItem('accountsDb', JSON.stringify(accountsDb));
                  
                  // Automatically log them in after sign up
                  setCurrentUser(myUser);
                  localStorage.setItem('userProfile', JSON.stringify(myUser));
                  if (onLogin) onLogin();
                }
              }
            }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: '500', color: '#374151' }}>Email or Username</label>
                <input id="login-email" type="text" placeholder="name@company.com" required style={{ padding: '14px 16px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none', fontSize: '1rem', width: '100%', boxSizing: 'border-box', transition: 'border-color 0.2s' }} onFocus={e => e.target.style.borderColor='#4f46e5'} onBlur={e => e.target.style.borderColor='#d1d5db'} />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: '500', color: '#374151' }}>Password</label>
                <input id="login-password" type="password" placeholder="••••••••" required style={{ padding: '14px 16px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none', fontSize: '1rem', width: '100%', boxSizing: 'border-box', transition: 'border-color 0.2s' }} onFocus={e => e.target.style.borderColor='#4f46e5'} onBlur={e => e.target.style.borderColor='#d1d5db'} />
              </div>

              <button type="submit" style={{ backgroundColor: '#4f46e5', color: 'white', padding: '14px', borderRadius: '8px', border: 'none', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', marginTop: '10px', transition: 'background-color 0.2s', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)' }} onMouseOver={e => e.target.style.backgroundColor='#4338ca'} onMouseOut={e => e.target.style.backgroundColor='#4f46e5'}>
                {isLogin ? 'Sign In' : 'Sign Up'}
              </button>
            </form>

            <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.95rem', color: '#4b5563' }}>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <span onClick={() => setIsLogin(!isLogin)} style={{ color: '#4f46e5', fontWeight: '600', cursor: 'pointer' }}>
                {isLogin ? 'Sign up' : 'Sign in'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container" style={{ paddingTop: '2rem' }}>
      <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#f9fafb', padding: '6px 12px', borderRadius: '30px', border: '1px solid #e5e7eb' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: currentUser.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <span style={{ fontWeight: '500', fontSize: '0.95rem', color: '#374151' }}>{currentUser.name}</span>
          <button onClick={logout} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.85rem', marginLeft: '8px', textDecoration: 'underline' }}>Sign out</button>
        </div>
      </div>

      <div className="dashboard-header" style={{ marginBottom: '3rem' }}>
        <div className="doc-icon" style={{ margin: '0 auto 20px auto', width: '80px', height: '80px', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <img src={logo} alt="SyncScribe Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <h1 style={{ color: '#111827', fontSize: '2.5rem', fontWeight: '700' }}>SyncScribe</h1>
        <p style={{ color: '#6b7280' }}>Create a new document, join an existing one, or open a local file.</p>
      </div>

      <div className="dashboard-actions" style={{ backgroundColor: '#ffffff', padding: '30px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid #f3f4f6' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', width: '100%', maxWidth: '400px' }}>
          <form onSubmit={createRoom} style={{ display: 'flex', gap: '10px', width: '100%' }}>
            <input 
              id="newDocTitle"
              type="text" 
              placeholder="Enter Document Name..." 
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              disabled={roomCode.trim().length > 0}
              className="room-input"
              style={{ flexGrow: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none', fontSize: '1rem' }}
              required
            />
            <button type="submit" disabled={roomCode.trim().length > 0} style={{ whiteSpace: 'nowrap', opacity: roomCode.trim().length > 0 ? 0.5 : 1, backgroundColor: '#4f46e5', color: 'white', border: 'none', padding: '0 20px', borderRadius: '8px', fontWeight: '500', cursor: 'pointer', transition: 'background-color 0.2s' }}>+ Create</button>
          </form>
        </div>
        
        <div style={{ margin: '20px 0', color: '#9ca3af', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>or</div>

        <form onSubmit={joinRoom} style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '400px' }}>
          <input 
            type="text" 
            placeholder="Enter Room Code (e.g. doc-xyz)" 
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            disabled={newDocTitle.trim().length > 0}
            className="room-input"
            style={{ flexGrow: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none', fontSize: '1rem' }}
          />
          <button type="submit" disabled={newDocTitle.trim().length > 0} style={{ opacity: newDocTitle.trim().length > 0 ? 0.5 : 1, backgroundColor: 'white', color: '#4f46e5', border: '1px solid #4f46e5', padding: '0 24px', borderRadius: '8px', fontWeight: '500', cursor: 'pointer' }}>Join</button>
        </form>

        <div style={{ margin: '20px 0', color: '#9ca3af', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>or</div>
        
        <label style={{ cursor: 'pointer', display: 'inline-block', color: '#4b5563', fontWeight: '500', padding: '10px 20px', backgroundColor: '#f3f4f6', borderRadius: '8px', transition: 'background-color 0.2s' }} onMouseOver={e => e.target.style.backgroundColor='#e5e7eb'} onMouseOut={e => e.target.style.backgroundColor='#f3f4f6'}>
          📁 Open Local File
          <input type="file" accept=".txt,.html" onChange={handleFileUpload} style={{ display: 'none' }} />
        </label>
      </div>

      {recentDocs.length > 0 && (
        <div className="recent-docs-section" style={{ marginTop: '3rem' }}>
          <h2 style={{ color: '#111827', fontSize: '1.25rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', marginBottom: '20px' }}>Recent Documents</h2>
          <div className="recent-docs-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
            {recentDocs.map(doc => (
              <div key={doc.id} className="recent-doc-card" onClick={() => window.location.hash = doc.id} style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={e => {e.currentTarget.style.borderColor='#4f46e5'; e.currentTarget.style.boxShadow='0 4px 12px rgba(79, 70, 229, 0.1)'}} onMouseOut={e => {e.currentTarget.style.borderColor='#e5e7eb'; e.currentTarget.style.boxShadow='none'}}>
                <div className="recent-doc-info">
                  <div className="recent-doc-title" style={{ fontWeight: '500', color: '#111827', marginBottom: '4px' }}>{doc.title || 'Untitled Document'}</div>
                  <div className="recent-doc-id" style={{ color: '#6b7280', fontSize: '0.85rem' }}>#{doc.id}</div>
                </div>
                <button className="delete-recent-btn" onClick={(e) => deleteRecent(e, doc.id)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '1.2rem', padding: '4px' }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
