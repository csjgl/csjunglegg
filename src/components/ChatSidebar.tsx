import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

interface Message {
  id: string;
  userId: string;
  content: string;
  timestamp: string;
}

const ChatSidebar = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        console.log('User Data:', userData);
        console.log('User Error:', userError);

        if (userError || !userData?.user) {
          console.warn('User is not logged in.');
          setIsLoggedIn(false);
        } else {
          setIsLoggedIn(true);
        }
      } catch (err) {
        console.error('Error checking user session:', err);
        setIsLoggedIn(false);
      }
    };

    checkUserSession();
  }, []);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch(
          'https://bkvkvqcgnapeojafxqsn.supabase.co/rest/v1/messages?select=*&order=timestamp.asc',
          {
            headers: {
              apiKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch messages');
        }

        const data = await response.json();
        setMessages(data || []);
      } catch (err) {
        console.error('Error fetching messages:', err);
      }
    };

    fetchMessages();

    const subscription = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const sendMessage = async () => {
    if (!isLoggedIn) {
      console.warn('User is not logged in. Cannot send messages.');
      return;
    }

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        console.error('User is not logged in or an error occurred:', userError);
        return;
      }

      if (newMessage.trim()) {
        const { error } = await supabase.from('messages').insert([
          {
            content: newMessage,
            userId: userData.user.id,
            timestamp: new Date().toISOString(),
          },
        ]);

        if (error) {
          console.error('Error sending message:', error);
          return;
        }

        setNewMessage('');
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  return (
    <div className="w-64 bg-gray-100 p-4 border-l border-gray-300">
      <h2 className="text-lg font-bold mb-4">Chat</h2>
      <div className="h-64 overflow-y-auto mb-4">
        {messages.map((msg) => (
          <div key={msg.id} className="mb-2">
            <span className="font-bold">{msg.userId}:</span> {msg.content}
          </div>
        ))}
      </div>
      <div className="flex items-center space-x-2">
        <input
          type="text"
          className="flex-1 border border-gray-300 rounded px-2 py-1"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          disabled={!isLoggedIn}
        />
        <button
          className={`px-4 py-2 rounded ${isLoggedIn ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
          onClick={sendMessage}
          disabled={!isLoggedIn}
        >
          Send
        </button>
      </div>
      {!isLoggedIn && <p className="text-sm text-gray-500 mt-2">Log in to send messages.</p>}
    </div>
  );
};

export default ChatSidebar;
