import './index.css';
import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import LoginModal from './components/LoginModal';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CrashGamePage from './pages/games/crash';
import RouletteGame from './components/RouletteGame';

// Define a User type for the user state
interface User {
  id: string;
  steamId: string;
  _json: {
    avatarmedium: string;
    personaname: string;
  };
  displayName: string;
  balance?: number;
}

// Define a UserContext to manage global user state
const UserContext = createContext<User | null>(null);
const UserLoadingContext = createContext<boolean>(true);

export const useUser = () => useContext(UserContext);
export const useUserLoading = () => useContext(UserLoadingContext);

const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = () => {
      axios.get('/api/user', { withCredentials: true })
        .then(response => {
          setUser(response.data);
        })
        .catch(error => {
          console.error('Error fetching user data:', error);
        })
        .finally(() => {
          setLoading(false);
        });
    };

    // Fetch user data on initial load and after login
    fetchUserData();

    // Listen for login events (e.g., after redirect)
    window.addEventListener('focus', fetchUserData);

    // Also try to fetch user data after page load (in case of redirect)
    window.addEventListener('load', fetchUserData);

    return () => {
      window.removeEventListener('focus', fetchUserData);
      window.removeEventListener('load', fetchUserData);
    };
  }, []);

  return (
    <UserContext.Provider value={user}>
      <UserLoadingContext.Provider value={loading}>
        {children}
      </UserLoadingContext.Provider>
    </UserContext.Provider>
  );
};

const MainRoutes = () => (
  <Routes>
    <Route path="/" element={<div />} />
    <Route path="/games/crash" element={<CrashGamePage />} />
    <Route path="/games/roulette" element={<RouletteGame />} />
  </Routes>
);

const App = () => {
  const [showLoginModal, setShowLoginModal] = useState(false);

  return (
    <UserProvider>
      <Router>
        <div className="flex flex-col min-h-screen">
          <AppNavbar setShowLoginModal={setShowLoginModal} />
          <main className="flex-1 bg-gray-100">
            <MainRoutes />
          </main>
          {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
        </div>
      </Router>
    </UserProvider>
  );
};

// Extracted Navbar as its own component
const AppNavbar = ({ setShowLoginModal }: { setShowLoginModal: (show: boolean) => void }) => {
  const user = useUser();
  const loading = useUserLoading();
  const [showMenu, setShowMenu] = useState(false);
  const [userTriggeredLogin, setUserTriggeredLogin] = useState(false);

  useEffect(() => {
    // Temporarily disable automatic modal logic for debugging
    // if (!user && !loading && !userTriggeredLogin && !autoTriggered) {
    //   setAutoTriggered(true); // Mark as auto-triggered immediately
    //   setShowLoginModal(true); // Automatically show login modal only once
    // }
  }, [user, loading, userTriggeredLogin]);

  const handleLoginClick = () => {
    console.log('Login button clicked'); // Debugging log
    setUserTriggeredLogin(true); // Mark that the user explicitly opened the modal
    setShowLoginModal(true);
  };

  const handleLogout = async () => {
    setShowLoginModal(false); // Ensure modal is closed during logout
    await fetch('/api/logout', { method: 'POST' }); // Clear Steam session
    window.location.reload(); // Refresh the page to reset the state
  };

  // Defensive check for user shape
  const avatar = user && user._json && user._json.avatarmedium ? user._json.avatarmedium : '/vite.svg';
  const name = user && user._json && user._json.personaname ? user._json.personaname : 'Guest';

  return (
    <header className="bg-white shadow-md sticky top-0 z-50 w-full">
      <div className="mx-auto px-4 py-4 flex justify-between items-center">
        {/* Logo */}
        <div className="flex items-center space-x-4">
          <img src="/CSJungleLOGO.png" alt="Logo" className="w-48" />
        </div>
        {/* Menu */}
        <nav className="flex items-center space-x-6">
          <a href="/" className="px-4 py-2 rounded bg-gray-200 text-gray-800">Dashboard</a>
          <a href="/games/crash" className="px-4 py-2 rounded bg-gray-200 text-gray-800">Crash</a>
          <a href="/games/roulette" className="px-4 py-2 rounded bg-gray-200 text-gray-800">Roulette</a>
        </nav>
        {/* Balance Bar */}
        {user && user.balance && (
          <div className="absolute left-1/2 transform -translate-x-1/2 font-bold text-gray-800 flex items-center space-x-2">
            Balance: {Number(user.balance).toFixed(2)}
          </div>
        )}
        {/* User Info or Login/Register Buttons */}
        <div className="flex items-center space-x-6 ml-auto">
          {user && user._json ? (
            <div className="relative">
              <div className="flex items-center space-x-4 cursor-pointer" onClick={() => setShowMenu(!showMenu)}>
                <img src={avatar} alt="Avatar" className="h-10 w-10 rounded-full" />
                <span className="text-gray-800 font-medium">{name}</span>
              </div>
              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50">
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-gray-800 hover:bg-gray-100"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={handleLoginClick}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors duration-200"
            >
              Login
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default App;