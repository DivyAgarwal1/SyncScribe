import React, { useState, useEffect, Suspense, lazy } from 'react';
import Dashboard from './Dashboard';
import './App.css';

const CollaborativeEditor = lazy(() => import('./CollaborativeEditor'));

function App() {
  const [currentHash, setCurrentHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setCurrentHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const isAuthenticated = !!localStorage.getItem('userProfile');

  return (
    <div className="App">
      {currentHash && isAuthenticated ? (
        <Suspense fallback={<div className="loading-screen">Loading Editor...</div>}>
          <CollaborativeEditor />
        </Suspense>
      ) : (
        <Dashboard onLogin={() => setCurrentHash(window.location.hash)} />
      )}
    </div>
  );
}

export default App;
