import { encryptedApi } from './encryptedApi';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';
import { appConfig } from './config';
import { isEncryptionEnabled, getDerivedKey } from './encryptionSession';
import { decryptValueFast } from './encryptionUtilsOptimized';
import { CHAT_MESSAGE_ENCRYPTED_FIELDS } from './encryptionFieldDefinitions';

const ChatComponent = ({ imageId, onError, socket }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);

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
      const chatMessages = await encryptedApi.getChatMessages(imageId);
      setMessages(chatMessages);
    } catch (error) {
      console.error('Error loading chat messages:', error);
      if (onError) {
        onError(appConfig.ui.chat.errorLoading + ': ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [imageId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Scroll to bottom when messages first load
  useEffect(() => {
    if (!loading && messages.length > 0 && messagesContainerRef.current) {
      // Use direct scroll instead of scrollIntoView to prevent parent scrolling
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [loading]);

  // Check if user is scrolled near the bottom
  const checkScrollPosition = useCallback(() => {
    if (!messagesContainerRef.current) return;
    
    const container = messagesContainerRef.current;
    const scrollThreshold = 100; // pixels from bottom
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < scrollThreshold;
    
    setIsUserScrolledUp(!isNearBottom);
  }, []);

  // Handle scroll events to track user position
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', checkScrollPosition);
    
    return () => {
      container.removeEventListener('scroll', checkScrollPosition);
    };
  }, [checkScrollPosition]);

  // Auto-scroll when new messages arrive (only if user is near bottom)
  useEffect(() => {
    if (!isUserScrolledUp && messagesContainerRef.current) {
      // Use direct scroll instead of scrollIntoView to prevent parent scrolling
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isUserScrolledUp]);

  // Listen for real-time chat messages from Socket.IO
  useEffect(() => {
    if (!socket || !imageId) return;

    const handleNewMessage = async (data) => {
      // Only add message if it's for the current image
      if (data.imageId === imageId) {
        let messageToAdd = data.message;
        
        // Decrypt the message if encryption is enabled
        if (isEncryptionEnabled()) {
          const key = getDerivedKey();
          if (key) {
            const decrypted = { ...messageToAdd };
            
            // Decrypt each encrypted field
            for (const field of CHAT_MESSAGE_ENCRYPTED_FIELDS) {
              if (messageToAdd[field] && typeof messageToAdd[field] === 'string' && messageToAdd[field].startsWith('enc:')) {
                try {
                  decrypted[field] = await decryptValueFast(messageToAdd[field], key, true);
                } catch (e) {
                  console.error('Error decrypting chat field:', field, e);
                }
              }
            }
            
            messageToAdd = decrypted;
          }
        }
        
        setMessages(prev => {
          // Check if message already exists to avoid duplicates
          if (prev.some(msg => msg.id === messageToAdd.id)) {
            return prev;
          }
          return [...prev, messageToAdd];
        });
      }
    };

    socket.on('chat:message', handleNewMessage);

    // Cleanup listener on unmount or when dependencies change
    return () => {
      socket.off('chat:message', handleNewMessage);
    };
  }, [socket, imageId]);  // Handle form submission
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
    
    // Validate message length (max 300 characters)
    if (message.trim().length > 300) {
      alert('Message cannot exceed 300 characters');
      return;
    }

    try {
      setSending(true);
      const result = await encryptedApi.postChatMessage(imageId, userName.trim(), message.trim());
      
      if (result.success || result.id) {
        // Don't add the message locally - let Socket.IO broadcast it back
        // This prevents duplicates and ensures all clients see messages in the same order
        setMessage(''); // Clear the input
        // Force scroll to bottom when user sends a message
        setIsUserScrolledUp(false);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      if (onError) {
        onError(appConfig.ui.chat.errorSending + ': ' + error.message);
      }
    } finally {
      setSending(false);
    }
  }, [userName, message, imageId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle keyboard shortcuts in textarea
  const handleTextareaKeyDown = useCallback((e) => {
    // Ctrl+Enter to submit
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit]);

  // Format timestamp for display with timezone handling
  const formatTimestamp = useCallback((timestamp) => {
    const now = new Date();
    // Parse the timestamp - handle both ISO and SQLite datetime formats
    let messageTime;
    
    // SQLite stores datetime in format: 'YYYY-MM-DD HH:MM:SS' (UTC)
    // We need to parse it as UTC and convert to local time
    if (timestamp.includes('T')) {
      // ISO format
      messageTime = new Date(timestamp);
    } else {
      // SQLite format - treat as UTC
      messageTime = new Date(timestamp + 'Z');
    }
    
    // Calculate time difference in local time
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
      // Format in user's local timezone
      return messageTime.toLocaleDateString() + ' ' + messageTime.toLocaleTimeString([], { 
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
  }, [imageId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div 
      className={`chat-component ${messages.length === 0 ? 'chat-empty' : 'chat-has-messages'}`}
      style={containerStyle}
    >
      <div style={headerStyle}>
        {appConfig.ui.chat.title}
      </div>
      
      <div style={messagesContainerStyle} ref={messagesContainerRef}>
        {loading ? (
          <div style={emptyStateStyle}>
            {appConfig.ui.chat.loadingMessages}
          </div>
        ) : messages.length === 0 ? (
          <div style={emptyStateStyle}>
            {appConfig.ui.chat.noMessages}
          </div>
        ) : (
          <>
            {messages.map((msg) => (
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
          ))}
          <div ref={messagesEndRef} />
          </>
        )}
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
        <div style={{ position: 'relative' }}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder={appConfig.ui.chat.messagePlaceholder}
            style={textareaStyle}
            maxLength={300}
            required
          />
          <div style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            fontSize: '0.75rem',
            color: message.length > 280 ? '#d32f2f' : '#666',
            pointerEvents: 'none'
          }}>
            {message.length}/300
          </div>
        </div>
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

// Memoize the component to prevent unnecessary re-renders when parent state changes
export default React.memo(ChatComponent, (prevProps, nextProps) => {
  // Only re-render if imageId or socket changes
  // Ignore onError changes as it's just for error reporting
  return prevProps.imageId === nextProps.imageId && 
         prevProps.socket === nextProps.socket;
});
