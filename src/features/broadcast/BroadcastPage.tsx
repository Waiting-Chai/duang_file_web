import { useState } from 'react';
import { Send, MessageSquare, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

// Mock message type
interface Message {
  id: number;
  user: string;
  text: string;
  timestamp: string;
  isNew?: boolean;
}

// Mock initial messages
const initialMessages: Message[] = [
  { id: 1, user: 'User-Alpha', text: 'Hello everyone! This is a test message.', timestamp: '10:30 AM' },
  { id: 2, user: 'User-Beta', text: 'Hey Alpha! Nice to see you here.', timestamp: '10:31 AM' },
];

export default function BroadcastPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [newMessage, setNewMessage] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);



  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '') return;

    const messageData: Message = {
      id: Date.now(),
      user: 'You', // Or a configurable username
      text: newMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    if (isUrgent) {
      toast.custom((t) => (
        <div
          className={`${t.visible ? 'animate-enter' : 'animate-leave'}
          max-w-md w-full bg-red-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <AlertTriangle className="h-10 w-10 text-yellow-300" />
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-white">
                  Urgent Announcement
                </p>
                <p className="mt-1 text-sm text-gray-200">
                  {newMessage}
                </p>
              </div>
            </div>
          </div>
          <div className="flex border-l border-gray-600">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500">
              Close
            </button>
          </div>
        </div>
      ), { id: 'urgent-toast' });
    } else {
      setMessages(prev => [messageData, ...prev]);
    }

    setNewMessage('');
    setIsUrgent(false);
  };

  return (
    <div className="h-full flex flex-col bg-gray-800 rounded-xl p-6 text-white">
      <h2 className="text-2xl font-bold mb-4 flex items-center"><MessageSquare className="mr-3" /> Broadcast Board</h2>
      
      {/* Message Display Area */}
      <div className="flex-1 overflow-y-auto pr-4 space-y-4 mb-4">
        {messages.map(msg => (
          <div 
            key={msg.id} 
            className={`p-4 rounded-lg bg-gray-700 shadow-md animate-fade-in ${msg.isNew ? 'animate-new-message' : ''}`}>
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-blue-400">{msg.user}</span>
              <span className="text-xs text-gray-400">{msg.timestamp}</span>
            </div>
            <p className="text-gray-300">{msg.text}</p>
          </div>
        ))}
      </div>

      {/* Message Input Form */}
      <form onSubmit={handleSendMessage} className="flex items-center gap-4">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message here..."
          className="flex-1 p-3 bg-gray-700 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex items-center gap-2">
          <label htmlFor="urgent-toggle" className="flex items-center cursor-pointer">
            <div className="relative">
              <input type="checkbox" id="urgent-toggle" className="sr-only" checked={isUrgent} onChange={() => setIsUrgent(!isUrgent)} />
              <div className={`block w-14 h-8 rounded-full ${isUrgent ? 'bg-red-600' : 'bg-gray-600'}`}></div>
              <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isUrgent ? 'transform translate-x-6' : ''}`}></div>
            </div>
            <div className="ml-3 text-white font-medium">
              Urgent
            </div>
          </label>
        </div>
        <button type="submit" className="p-3 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50" disabled={!newMessage.trim()}>
          <Send size={24} />
        </button>
      </form>
    </div>
  );
}