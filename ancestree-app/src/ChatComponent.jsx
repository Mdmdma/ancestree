import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';
import { appConfig } from './config';

const ChatComponent = ({ imageId, onError }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false);
  const messagesEndRef = useRef(null);

  // Get stored name from session storage
  useEffect(() => {
    const storedName = sessionStorage.getItem('chatUserName');
    if (storedName) {
      setUserName(storedName);
    }
  }, []);

  // Store name in session storage when it changes
  useEffect(() => {
    if (userName.trim()) {
      sessionStorage.setItem('chatUserName', userName.trim());
    }
  }, [userName]);

  // Load messages when component mounts or imageId changes
  const loadMessages = useCallback(async () => {
    if (!imageId) return;
    
    try {
      setLoading(true);
      const chatMessages = await api.getChatMessages(imageId);
      setMessages(chatMessages);
    } catch (error) {
      console.error('Error loading chat messages:', error);
      if (onError) {
        onError(appConfig.ui.chat.errorLoading + ': ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [imageId, onError]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Scroll to bottom only when explicitly requested (e.g., after sending a message)
  useEffect(() => {
    if (shouldAutoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      setShouldAutoScroll(false); // Reset the flag
    }
  }, [messages, shouldAutoScroll]);  // Handle form submission
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (!userName.trim()) {
      alert(appConfig.ui.chat.nameRequired);
      return;
    }
    
    if (!message.trim()) {
      alert(appConfig.ui.chat.messageRequired);
      return;
    }

    try {
      setSending(true);
      const result = await api.postChatMessage(imageId, userName.trim(), message.trim());
      
      if (result.success) {
        // Add the new message to the local state
        setMessages(prev => [...prev, result.message]);
        setMessage(''); // Clear the input
        setShouldAutoScroll(true); // Trigger auto-scroll for new message
      }
    } catch (error) {
      console.error('Error sending message:', error);
      if (onError) {
        onError(appConfig.ui.chat.errorSending + ': ' + error.message);
      }
    } finally {
      setSending(false);
    }
  }, [userName, message, imageId, onError]);

  // Format timestamp for display
  const formatTimestamp = useCallback((timestamp) => {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffMs = now - messageTime;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) {
      return appConfig.ui.chat.timeFormat.justNow;
    } else if (diffMinutes < 60) {
      return appConfig.ui.chat.timeFormat.minutesAgo.replace('{minutes}', diffMinutes);
    } else if (diffHours < 24) {
      return appConfig.ui.chat.timeFormat.hoursAgo.replace('{hours}', diffHours);
    } else if (diffDays < 7) {
      return appConfig.ui.chat.timeFormat.daysAgo.replace('{days}', diffDays);
    } else {
      return messageTime.toLocaleDateString('de-DE') + ' ' + messageTime.toLocaleTimeString('de-DE', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  }, []);

  // Handle message deletion (optional feature)
  const handleDeleteMessage = useCallback(async (messageId) => {
    if (!confirm(appConfig.ui.chat.deleteConfirm)) {
      return;
    }

    try {
      await api.deleteChatMessage(imageId, messageId);
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    } catch (error) {
      console.error('Error deleting message:', error);
      if (onError) {
        onError('Fehler beim Löschen der Nachricht: ' + error.message);
      }
    }
  }, [imageId, onError]);

  // Styles
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    height: '450px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '8px',
    overflow: 'hidden'
  };

  const headerStyle = {
    padding: '12px 16px',
    backgroundColor: '#262626',
    borderBottom: '1px solid #333',
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: '14px'
  };

  const messagesContainerStyle = {
    flex: 1,
    overflowY: 'auto',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  };

  const messageStyle = {
    backgroundColor: '#2a2a2a',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #333'
  };

  const messageHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px'
  };

  const messageNameStyle = {
    fontWeight: 'bold',
    color: '#4CAF50',
    fontSize: '12px'
  };

  const messageTimeStyle = {
    color: '#888',
    fontSize: '11px'
  };

  const messageTextStyle = {
    color: '#ffffff',
    fontSize: '13px',
    lineHeight: '1.4',
    wordBreak: 'break-word'
  };

  const formStyle = {
    padding: '12px',
    backgroundColor: '#262626',
    borderTop: '1px solid #333',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  };

  const inputStyle = {
    padding: '8px',
    backgroundColor: '#333',
    color: '#ffffff',
    border: '1px solid #555',
    borderRadius: '4px',
    fontSize: '13px'
  };

  const textareaStyle = {
    ...inputStyle,
    minHeight: '40px',
    resize: 'vertical',
    fontFamily: 'inherit'
  };

  const buttonStyle = {
    padding: '8px 16px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    alignSelf: 'flex-end'
  };

  const buttonDisabledStyle = {
    ...buttonStyle,
    backgroundColor: '#666',
    cursor: 'not-allowed'
  };

  const emptyStateStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    color: '#888',
    fontSize: '13px',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '20px'
  };

  const deleteButtonStyle = {
    background: 'none',
    border: 'none',
    color: '#ff6b6b',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '2px 4px',
    borderRadius: '2px',
    marginLeft: '8px'
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        {appConfig.ui.chat.title}
      </div>
      
      <div style={messagesContainerStyle}>
        {loading ? (
          <div style={emptyStateStyle}>
            {appConfig.ui.chat.loadingMessages}
          </div>
        ) : messages.length === 0 ? (
          <div style={emptyStateStyle}>
            {appConfig.ui.chat.noMessages}
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} style={messageStyle}>
              <div style={messageHeaderStyle}>
                <div>
                  <span style={messageNameStyle}>{msg.userName}</span>
                  <span style={messageTimeStyle}> • {formatTimestamp(msg.createdAt)}</span>
                </div>
                <button
                  onClick={() => handleDeleteMessage(msg.id)}
                  style={deleteButtonStyle}
                  title={appConfig.ui.chat.deleteConfirm}
                >
                  {appConfig.ui.chat.deleteButton}
                </button>
              </div>
              <div style={messageTextStyle}>{msg.message}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} style={formStyle}>
        <input
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder={appConfig.ui.chat.namePlaceholder}
          style={inputStyle}
          required
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={appConfig.ui.chat.messagePlaceholder}
          style={textareaStyle}
          required
        />
        <button
          type="submit"
          style={sending ? buttonDisabledStyle : buttonStyle}
          disabled={sending}
        >
          {sending ? 'Wird gesendet...' : appConfig.ui.chat.sendButton}
        </button>
      </form>
    </div>
  );
};

export default ChatComponent;
