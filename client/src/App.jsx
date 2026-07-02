import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import SignUpPage from './components/Auth/SignUp/SignUp';
import { GoogleOAuthProvider } from '@react-oauth/google';
import UserDashboard from './components/Dashboard/UserDashboard';
import SignIn from './components/Auth/SignIn/SignIn';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import Reports from './components/Reports/Reports';
import { AuthProvider } from './components/Auth/context/AuthContext';
import LiveMap from './components/Map/LiveMap';
import Alerts from './components/Alerts/Alerts';
import ProfileSettings from './components/Profile/ProfileSettings';
import Chat from './components/Chat/Chat';

const App = () => {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/" element={<Navigate to="/signup" />} />
            {/* <Route path="/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} /> */}
            <Route path="/dashboard" element={<UserDashboard />} />
            {/* <Route path="/map" element={<ProtectedRoute><LiveMap /></ProtectedRoute>} />
            <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
            <Route path="/incidents" element={<ProtectedRoute><Reports /></ProtectedRoute>} /> */}
            <Route path="/map" element={<LiveMap />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/incidents" element={<Reports />} /> 
            {/* kept for any old bookmarks/links */}
            <Route path="/reports" element={<Navigate to="/incidents" replace />} />
            {/* <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/profile-settings" element={<ProtectedRoute><ProfileSettings /></ProtectedRoute>} /> */}
            <Route path="/chat" element={<Chat />} />
            <Route path="/profile-settings" element={<ProfileSettings />} />
          </Routes>
        </Router>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
};

export default App;
