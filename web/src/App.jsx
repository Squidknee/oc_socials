import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext.jsx';
import { PlatformsProvider } from './lib/PlatformsContext.jsx';
import { getCurrentWorldId } from './lib/currentWorld.js';
import RequireAuth from './components/RequireAuth.jsx';
import './App.css';
import Login from './pages/Login.jsx';
import SignUp from './pages/SignUp.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import WorldSelector from './pages/WorldSelector.jsx';
import CreateWorld from './pages/CreateWorld.jsx';
import WorldFeed from './pages/WorldFeed.jsx';
import CreateCharacter from './pages/CreateCharacter.jsx';
import CharacterProfile from './pages/CharacterProfile.jsx';
import PlatformAccountProfile from './pages/PlatformAccountProfile.jsx';
import PlatformFeedPage from './pages/PlatformFeedPage.jsx';
import MessagesOverview from './pages/MessagesOverview.jsx';
import ConversationView from './pages/ConversationView.jsx';

function NavBar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // No world id lives in this route, so look up the last world you
  // visited this session — if you haven't picked one yet, send you to
  // the world selector instead of a dead end.
  function goToCharacters() {
    const worldId = getCurrentWorldId();
    navigate(worldId ? `/worlds/${worldId}` : '/');
  }

  return (
    <nav className="application-nav">
      <Link className="application-brand" to="/">
        <img
          className="application-brand-logo"
          src="https://cdn.builder.io/api/v1/image/assets%2F89a27072983244b49ab31c3ad694e8ea%2F8e56f0468e124c7a9c2999c1bcb93624"
          alt="OC Social"
        />
      </Link>
      {user ? (
        <>
          <Link className="application-nav-link" to="/">Worlds</Link>
          <button className="application-nav-link" onClick={goToCharacters}>Characters</button>
          <button onClick={signOut}>Log Out</button>
        </>
      ) : (
        <Link className="application-nav-link" to="/login">Log In</Link>
      )}
    </nav>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PlatformsProvider>
        <BrowserRouter>
          <NavBar />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <WorldSelector />
                </RequireAuth>
              }
            />
            <Route
              path="/worlds/new"
              element={
                <RequireAuth>
                  <CreateWorld />
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
              path="/worlds/:worldId/characters/new"
              element={
                <RequireAuth>
                  <CreateCharacter />
                </RequireAuth>
              }
            />
            <Route
              path="/worlds/:worldId/platforms/:slug"
              element={
                <RequireAuth>
                  <PlatformFeedPage />
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
            <Route
              path="/accounts/:accountId"
              element={
                <RequireAuth>
                  <PlatformAccountProfile />
                </RequireAuth>
              }
            />
            <Route
              path="/characters/:characterId/messages/:platformSlug"
              element={
                <RequireAuth>
                  <MessagesOverview />
                </RequireAuth>
              }
            />
            <Route
              path="/characters/:characterId/messages/:platformSlug/:conversationId"
              element={
                <RequireAuth>
                  <ConversationView />
                </RequireAuth>
              }
            />
          </Routes>
        </BrowserRouter>
      </PlatformsProvider>
    </AuthProvider>
  );
}
