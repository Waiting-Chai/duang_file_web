import { useState, useEffect } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { socketService } from '../../api/socket';
import { Subscription } from 'rxjs';

interface Message {
  id: number;
  user: string;
  text: string;
  timestamp: string;
  isNew?: boolean;
  isSentByMe?: boolean;
}

export default function BroadcastPage() {
  const username = sessionStorage.getItem('username') || 'You';
  const [messages, setMessages] = useState<Message[]>(() => {
    const stored = sessionStorage.getItem('broadcastMessages');
    return stored ? JSON.parse(stored) : [];
  });
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    const subscription: Subscription = socketService.onMessage$<any>('broadcastMessage').subscribe((msg) => {
      const newMsg: Message = {
        id: Date.now(),
        user: msg.user,
        text: msg.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isNew: true,
        isSentByMe: msg.user === username
      };
      setMessages(prev => {
        const updated = [newMsg, ...prev];
        sessionStorage.setItem('broadcastMessages', JSON.stringify(updated));
        return updated;
      });

      if (newMsg.user !== username) {
        if (Notification.permission === "granted") {
          new Notification(`${newMsg.user} says:`, {
            body: newMsg.text,
          });
        } else if (Notification.permission !== "denied") {
          Notification.requestPermission().then(permission => {
            if (permission === "granted") {
              new Notification(`${newMsg.user} says:`, {
                body: newMsg.text,
              });
            }
          });
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [username]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '') return;

    const messageData = {
      user: username,
      text: newMessage
    };

    socketService.sendMessage('broadcastMessage', messageData);

    setNewMessage('');
  };

  return (
    <div className="h-full flex flex-col bg-gray-800 rounded-xl p-6 text-white">
      <h2 className="text-2xl font-bold mb-4 flex items-center"><MessageSquare className="mr-3" /> Broadcast Board</h2>
      
      {/* Message Display Area */}
      <div className="flex-1 overflow-y-auto pr-4 space-y-4 mb-4">
        {messages.map(msg => (
          <div 
            key={msg.id} 
            className={`p-4 rounded-lg shadow-md animate-fade-in ${msg.isNew ? 'animate-new-message' : ''} ${msg.isSentByMe ? 'bg-green-600 ml-auto' : 'bg-blue-600 mr-auto'}`}
>
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
        <button type="submit" className="p-3 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50" disabled={!newMessage.trim()}>
          <Send size={24} />
        </button>
      </form>
    </div>
  );
}