import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import Login from './pages/Login.jsx';
import SignUp from './pages/SignUp.jsx';
import WorldSelector from './pages/WorldSelector.jsx';
import WorldFeed from './pages/WorldFeed.jsx';
import CharacterProfile from './pages/CharacterProfile.jsx';

function NavBar() {
  const { user, signOut } = useAuth();

  return (
    <nav style={{ padding: '1rem', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
      <Link to="/">OC Social</Link>
      {user ? (
        <button onClick={signOut}>Log Out</button>
      ) : (
        <Link to="/login">Log In</Link>
      )}
    </nav>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NavBar />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <WorldSelector />
              </RequireAuth>
            }
          />
          <Route
            path="/worlds/:worldId"
            element={
              <RequireAuth>
                <WorldFeed />
              </RequireAuth>
            }
          />
          <Route
            path="/characters/:characterId"
            element={
              <RequireAuth>
                <CharacterProfile />
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
