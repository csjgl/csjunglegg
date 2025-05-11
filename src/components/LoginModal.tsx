import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

interface LoginModalProps {
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose }: LoginModalProps) => {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkSession = async (retryCount = 3) => {
      if (!isLoading) {
        console.log('Skipping session fetch because user is logged out or not in login flow.');
        return;
      }

      for (let i = 0; i < retryCount; i++) {
        try {
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            console.error('Error fetching session:', error);
          } else if (data.session && data.session.user) {
            console.log('Valid session found:', data.session);
            onClose();
            return;
          } else {
            console.log('Session is null or invalid:', data.session);
          }
        } catch (err) {
          console.error('Unexpected error during session fetch:', err);
        }

        console.log(`Retrying session fetch (${i + 1}/${retryCount})...`);
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second before retrying
      }

      console.warn('Session is still missing after retries. Logging out user.');
      await supabase.auth.signOut(); // Ensure user is logged out if session is invalid
      setIsLoading(false); // Reset loading state
    };

    checkSession();
  }, [isLoading]);

  const handleSteamLogin = () => {
    setIsLoading(true); // Set loading state
    console.log('Redirecting to Steam login...'); // Debugging log
    window.location.href = '/api/auth-steam'; // Redirect to Steam login
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-51">
      <div className="p-8 rounded-lg shadow-xl w-96 jungle-bg-color">
        {/* Header with title and close button in one row */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-white">Login</h2>
          <button
            onClick={onClose}
            className="text-white text-3xl leading-none hover:text-gray-400 focus:outline-none p-1"
            disabled={isLoading} // Disable close button while loading
          >
            &times;
          </button>
        </div>

        <form className="space-y-6">
          {/* Email/Username Input */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">Email/Username</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-green-900 rounded-md shadow-sm bg-transparent text-white focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="Enter your email or username"
              disabled={isLoading} // Disable input while loading
            />
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">Password</label>
            <input
              type="password"
              className="w-full px-4 py-2 border border-green-900 rounded-md shadow-sm bg-transparent text-white focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="Enter your password"
              disabled={isLoading} // Disable input while loading
            />
          </div>

          {/* Login Button */}
          <button
            type="submit"
            className="w-full py-3 px-6 text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors duration-200"
            disabled={isLoading} // Disable button while loading
          >
            Login
          </button>
        </form>

        {/* Steam Login */}
        <div className="mt-4 text-center">
          <button
            onClick={handleSteamLogin}
            className="w-full flex items-center justify-center px-4 py-2 bg-[#171a21] text-white rounded hover:bg-[#1b2838] mt-4 font-semibold shadow"
            style={{ textDecoration: 'none' }}
            disabled={isLoading} // Disable button while loading
          >
            {isLoading ? 'Redirecting...' : (
              <>
                <img
                  src="https://steamcommunity-a.akamaihd.net/public/images/v5/ico_16x16.gif"
                  alt="Steam"
                  className="mr-2 h-5 w-5"
                />
                Sign in with Steam
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const UserProfile: React.FC = () => {
  return null;
};

export default LoginModal;
export { UserProfile };