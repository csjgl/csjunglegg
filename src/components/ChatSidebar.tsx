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

  useEffect(() => {
    const setSupabaseSession = async () => {
      try {
        // Fetch the token from the server
        const response = await fetch('/api/auth-steam-callback');
        if (!response.ok) {
          throw new Error('Failed to fetch token from server');
        }

        const { token } = await response.json();

        // Set the Supabase session
        const { error } = await supabase.auth.setSession({ access_token: token, refresh_token: token });
        if (error) {
          console.error('Error setting Supabase session:', error);
        }
      } catch (err) {
        console.error('Error during session setup:', err);
      }
    };

    setSupabaseSession();
  }, []);

  useEffect(() => {
    // Fetch initial messages
    const fetchMessages = async () => {
      const response = await fetch(
        'https://bkvkvqcgnapeojafxqsn.supabase.co/rest/v1/messages?select=*&order=timestamp.asc',
        {
          headers: {
            apiKey: import.meta.env.VITE_SUPABASE_ANON_KEY, // Use your Supabase anon key
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data = await response.json();
      console.log(data); // Logs the fetched messages
      setMessages(data || []);
    };

    fetchMessages();

    // Subscribe to new messages
    const subscription = supabase
      .channel('public:messages') // Subscribe to the messages table
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe(); // Correct method to unsubscribe
    };
  }, []);

  const sendMessage = async () => {
    const { data: userData, error: userError } = await supabase.auth.getUser(); // Fetch the authenticated user

    if (userError || !userData?.user) {
      console.error('User is not logged in or an error occurred:', userError);
      return;
    }

    if (newMessage.trim()) {
      const { error } = await supabase.from('messages').insert([
        {
          content: newMessage,
          userId: userData.user.id, // Use the authenticated user's ID
          timestamp: new Date().toISOString(),
        },
      ]);

      if (error) {
        console.error('Error sending message:', error);
        return;
      }

      setNewMessage('');
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
        />
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={sendMessage}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatSidebar;
