import './index.css';
import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import LoginModal, { UserProfile } from './components/LoginModal';
import ChatSidebar from './components/ChatSidebar';

// Define a User type for the user state
interface User {
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

const App = () => {
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  return (
    <UserProvider>
      <div className="flex">
        <div className="flex-1">
          <AppContent showLoginModal={showLoginModal} setShowLoginModal={setShowLoginModal} />
        </div>
        <ChatSidebar />
      </div>
    </UserProvider>
  );
};

const AppContent = ({ showLoginModal, setShowLoginModal }: { showLoginModal: boolean; setShowLoginModal: (show: boolean) => void }) => {
  const user = useUser();
  const loading = useUserLoading();
  const [showMenu, setShowMenu] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Defensive check for user shape
  const avatar = user && user._json && user._json.avatarmedium ? user._json.avatarmedium : '/vite.svg';
  const name = user && user._json && user._json.personaname ? user._json.personaname : 'Guest';

  return (
    <div className="relative min-h-screen bg-gray-100">
      {/* Navbar */}
      <header className="bg-white shadow-md sticky top-0 z-50 w-full">
        <div className="mx-auto px-4 py-4 flex justify-between items-center">
          {/* Logo */}
          <div className="flex items-center space-x-4">
            <img src="/vite.svg" alt="Logo" className="h-10 w-10" />
            <span className="text-2xl font-bold text-gray-800">CSJungle.gg</span>
          </div>
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
                  <svg
                    className="w-5 h-5 text-gray-800"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {showMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded shadow-md">
                    <button
                      className="block w-full px-4 py-2 text-left text-gray-800 hover:bg-gray-100"
                      onClick={() => {
                        window.location.href = '/api/logout';
                      }}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <a
                  href="/api/auth-steam"
                  className="text-gray-800 font-medium hover:text-blue-500"
                >
                  Login
                </a>
                <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Register</button>
              </>
            )}
          </div>
        </div>
      </header>
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800">Welcome to CSJungle.gg</h1>
        <p className="mt-4 text-gray-600">This is a placeholder for your dashboard content.</p>
      </main>
      {/* User Profile Component */}
      <UserProfile />
      {/* Login Modal */}
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
    </div>
  );
};

export default App;