import React from 'react';

interface LoginModalProps {
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose }: LoginModalProps) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="p-8 rounded-lg shadow-xl w-96 jungle-bg-color">
        {/* Header with title and close button in one row */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-white">Login</h2>
          <button
            onClick={onClose}
            className="text-white text-3xl leading-none hover:text-gray-400 focus:outline-none p-1"
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
            />
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">Password</label>
            <input
              type="password"
              className="w-full px-4 py-2 border border-green-900 rounded-md shadow-sm bg-transparent text-white focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="Enter your password"
            />
          </div>

          {/* Login Button */}
          <button
            type="submit"
            className="w-full py-3 px-6 text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors duration-200"
          >
            Login
          </button>
        </form>

        {/* Steam Login */}
        <div className="mt-4 text-center">
          <a
            href="/api/auth-steam"
            className="w-full flex items-center justify-center px-4 py-2 bg-[#171a21] text-white rounded hover:bg-[#1b2838] mt-4 font-semibold shadow"
            style={{ textDecoration: 'none' }}
          >
            <img
              src="https://steamcommunity-a.akamaihd.net/public/images/v5/ico_16x16.gif"
              alt="Steam"
              className="mr-2 h-5 w-5"
            />
            Sign in with Steam
          </a>
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