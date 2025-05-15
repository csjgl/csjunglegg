import React, { useState } from 'react';

interface LoginModalProps {
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose }: LoginModalProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleSteamLogin = () => {
    setIsLoading(true);
    window.location.href = '/api/auth-steam';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-51">
      <div className="p-8 rounded-lg shadow-xl w-96 jungle-bg-color">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-white">Login</h2>
          <button
            onClick={onClose}
            className="text-white text-3xl leading-none hover:text-gray-400 focus:outline-none p-1"
            disabled={isLoading}
          >
            &times;
          </button>
        </div>
        <div className="mt-4 text-center">
          <button
            onClick={handleSteamLogin}
            className="w-full flex items-center justify-center px-4 py-2 bg-[#171a21] text-white rounded hover:bg-[#1b2838] mt-4 font-semibold shadow"
            style={{ textDecoration: 'none' }}
            disabled={isLoading}
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

export default LoginModal;