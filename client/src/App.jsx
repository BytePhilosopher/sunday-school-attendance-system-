import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { api, setUnauthorizedHandler } from './lib/api.js';
import { AuthContext } from './lib/auth.js';
import { FeedbackProvider } from './components/feedback.jsx';
import { Logo } from './components/ui.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import TakeAttendance from './pages/TakeAttendance.jsx';
import MonthlySheet from './pages/MonthlySheet.jsx';
import Members from './pages/Members.jsx';
import Users from './pages/Users.jsx';

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    api
      .get('/api/me')
      .then((r) => setUser(r.user))
      .catch(() => setUser(null));
  }, []);

  if (user === undefined)
    return (
      <div className="splash">
        <Logo />
      </div>
    );

  return (
    <FeedbackProvider>
      {user ? (
        <AuthContext.Provider value={{ user, setUser }}>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="attendance" element={<TakeAttendance />} />
                <Route path="sheet" element={<MonthlySheet />} />
                <Route path="members" element={<Members />} />
                {user.role === 'admin' && <Route path="users" element={<Users />} />}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthContext.Provider>
      ) : (
        <Login onLogin={setUser} />
      )}
    </FeedbackProvider>
  );
}
