import { encryptedApi } from './encryptedApi';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';
import { useTranslation } from './locales/LanguageContext';
import { isEncryptionEnabled, getDerivedKey } from './encryptionSession';
import { decryptValueFast } from './encryptionUtilsOptimized';
import { CHAT_MESSAGE_ENCRYPTED_FIELDS } from './encryptionFieldDefinitions';
import Button from './components/Button';

const ChatComponent = ({ imageId, onError, socket }) => {
  const { t } = useTranslation();
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
        onError(t.ui.chat.errorLoading + ': ' + error.message);
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
      alert(t.ui.chat.nameRequired);
      return;
    }
    
    if (!message.trim()) {
      alert(t.ui.chat.messageRequired);
      return;
    }
    
    // Validate message length (max 300 characters)
    if (message.trim().length > 300) {
      alert(t.ui.chat.messageTooLong);
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
        onError(t.ui.chat.errorSending + ': ' + error.message);
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
    // Escape to clear message
    if (e.key === 'Escape') {
      e.preventDefault();
      setMessage('');
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
      return t.ui.chat.timeFormat.justNow;
    } else if (diffMinutes < 60) {
      return t.ui.chat.timeFormat.minutesAgo.replace('{minutes}', diffMinutes);
    } else if (diffHours < 24) {
      return t.ui.chat.timeFormat.hoursAgo.replace('{hours}', diffHours);
    } else if (diffDays < 7) {
      return t.ui.chat.timeFormat.daysAgo.replace('{days}', diffDays);
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
    if (!confirm(t.ui.chat.deleteConfirm)) {
      return;
    }

    try {
      await api.deleteChatMessage(imageId, messageId);
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    } catch (error) {
      console.error('Error deleting message:', error);
      if (onError) {
        onError(t.ui.chat.errorDeleting + ': ' + error.message);
      }
    }
  }, [imageId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Styles - matching DescriptionTextarea design language
  // Dynamic container height: min when empty, grows up to 600px max, then scrolls
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    minHeight: messages.length === 0 ? '200px' : '300px', // Smaller when empty
    maxHeight: '600px', // Maximum height before scrolling
    height: messages.length === 0 ? 'auto' : 'auto',
    backgroundColor: '#27272a', // zinc-800
    border: '1px solid #52525b', // zinc-600
    borderRadius: '8px',
    overflow: 'hidden'
  };

  const headerStyle = {
    padding: '8px 12px', // Tighter padding
    backgroundColor: '#3f3f46', // zinc-700
    borderBottom: '1px solid #52525b', // zinc-600
    color: '#ffffff',
    fontWeight: '600',
    fontSize: '13px', // Slightly smaller
    flexShrink: 0 // Prevent header from shrinking
  };

  const messagesContainerStyle = {
    flex: 1,
    overflowY: 'auto',
    padding: messages.length === 0 ? '16px' : '8px', // Less padding when there are messages
    display: 'flex',
    flexDirection: 'column',
    gap: '8px', // Tighter gap between messages
    backgroundColor: '#1a1a1a',
    minHeight: messages.length === 0 ? '80px' : 'auto', // Minimum height for empty state
    maxHeight: '600px' // Allow messages area to grow
  };

  const messageStyle = {
    backgroundColor: '#27272a', // zinc-800
    padding: '8px 10px', // Tighter padding
    borderRadius: '6px', // Slightly smaller radius
    border: '1px solid #52525b', // zinc-600
    transition: 'border-color 0.2s ease'
  };

  const messageHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px', // Tighter spacing
    gap: '8px'
  };

  const messageNameStyle = {
    fontWeight: '600',
    color: '#10b981', // success green
    fontSize: '12px' // Slightly smaller
  };

  const messageTimeStyle = {
    color: '#9ca3af', // gray-400
    fontSize: '10px' // Smaller timestamp
  };

  const messageTextStyle = {
    color: '#ffffff',
    fontSize: '13px', // Slightly smaller
    lineHeight: '1.4',
    wordBreak: 'break-word'
  };

  const formStyle = {
    padding: '10px 12px', // Tighter padding
    backgroundColor: '#27272a', // zinc-800
    borderTop: '1px solid #52525b', // zinc-600
    display: 'flex',
    flexDirection: 'column',
    gap: '8px', // Tighter gap
    flexShrink: 0 // Prevent form from shrinking
  };

  const inputStyle = {
    padding: '8px 10px', // Tighter padding
    backgroundColor: '#27272a', // zinc-800
    color: '#ffffff',
    border: '1px solid #52525b', // zinc-600
    borderRadius: '6px', // Slightly smaller
    fontSize: '13px', // Slightly smaller
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
    outline: 'none'
  };

  const textareaWrapperStyle = {
    position: 'relative',
    width: '100%'
  };

  const textareaStyle = {
    ...inputStyle,
    minHeight: '60px', // Smaller minimum height
    resize: 'vertical',
    paddingBottom: '28px', // Space for character counter
    lineHeight: '1.4',
    width: '100%',
    boxSizing: 'border-box'
  };

  const characterCounterStyle = {
    position: 'absolute',
    bottom: '8px',
    right: '10px',
    fontSize: '11px', // Slightly smaller
    color: message.length > 280 ? '#ef4444' : '#9ca3af', // red-500 or gray-400
    fontWeight: message.length > 280 ? '600' : '400',
    backgroundColor: 'rgba(39, 39, 42, 0.9)', // Semi-transparent zinc-800
    padding: '2px 5px',
    borderRadius: '3px',
    pointerEvents: 'none',
    userSelect: 'none'
  };

  const emptyStateStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    color: '#9ca3af', // gray-400
    fontSize: '13px', // Slightly smaller
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '16px'
  };

  return (
    <div 
      className={`chat-component ${messages.length === 0 ? 'chat-empty' : 'chat-has-messages'}`}
      style={containerStyle}
    >
      <style>{`
        .chat-component input:focus,
        .chat-component textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
        }
        
        .chat-component input:hover:not(:focus),
        .chat-component textarea:hover:not(:focus) {
          border-color: #6b7280;
        }
        
        .chat-message:hover {
          border-color: #6b7280 !important;
        }
      `}</style>
      <div style={headerStyle}>
        {t.ui.chat.title}
      </div>
      
      <div style={messagesContainerStyle} ref={messagesContainerRef}>
        {loading ? (
          <div style={emptyStateStyle}>
            {t.ui.chat.loadingMessages}
          </div>
        ) : messages.length === 0 ? (
          <div style={emptyStateStyle}>
            {t.ui.chat.noMessages}
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} style={messageStyle} className="chat-message">
                <div style={messageHeaderStyle}>
                  <div>
                    <span style={messageNameStyle}>{msg.userName}</span>
                    <span style={messageTimeStyle}> • {formatTimestamp(msg.createdAt)}</span>
                  </div>
                  <div style={{ minWidth: '60px' }}>
                    <Button
                      onClick={() => handleDeleteMessage(msg.id)}
                      variant="danger"
                      size="small"
                    >
                      {t.ui.chat.deleteButton}
                    </Button>
                  </div>
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
          placeholder={t.ui.chat.namePlaceholder}
          style={inputStyle}
          required
        />
        <div style={textareaWrapperStyle}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder={t.ui.chat.messagePlaceholder}
            style={textareaStyle}
            maxLength={300}
            required
          />
          <div style={characterCounterStyle}>
            {message.length}/300
          </div>
        </div>
        <Button
          type="submit"
          variant="success"
          size="medium"
          icon="📤"
          disabled={sending}
        >
          {sending ? t.ui.chat.sendingButton : t.ui.chat.sendButton}
        </Button>
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
