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
    // Fetch initial messages
    const fetchMessages = async () => {
      const { data } = await supabase
        .from<Message>('messages')
        .select('*')
        .order('timestamp', { ascending: true });
      setMessages(data || []);
    };

    fetchMessages();

    // Subscribe to new messages
    const subscription = supabase
      .from<Message>('messages')
      .on('INSERT', (payload: { new: Message }) => {
        setMessages((prev) => [...prev, payload.new]);
      })
      .subscribe();

    return () => {
      supabase.removeSubscription(subscription);
    };
  }, []);

  const sendMessage = async () => {
    if (newMessage.trim()) {
      await supabase.from('messages').insert([{ content: newMessage }]);
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
      <div className="flex">
        <input
          type="text"
          className="flex-1 border border-gray-300 rounded px-2 py-1"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <button
          className="ml-2 px-4 py-1 bg-blue-500 text-white rounded"
          onClick={sendMessage}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatSidebar;
