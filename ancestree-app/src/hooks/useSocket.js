import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { getAuthToken } from '../api';

export const useSocket = (serverPath, isAuthenticated = false) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [isSocketAuthenticated, setIsSocketAuthenticated] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    // Only connect if we don't already have a socket and user is authenticated
    if (!socketRef.current && serverPath && isAuthenticated) {
      const socketInstance = io(serverPath, {
        transports: ['websocket', 'polling'],
        autoConnect: true
      });

      socketRef.current = socketInstance;
      setSocket(socketInstance);

      socketInstance.on('connect', () => {
        console.log('Connected to collaboration server');
        setIsConnected(true);
        
        // Authenticate the socket connection
        const token = getAuthToken();
        if (token) {
          socketInstance.emit('authenticate', token);
        }
      });

      socketInstance.on('authenticated', (data) => {
        console.log('Socket authenticated for family:', data.familyName);
        setIsSocketAuthenticated(true);
      });

      socketInstance.on('authentication_error', (error) => {
        console.error('Socket authentication failed:', error.message);
        setIsSocketAuthenticated(false);
      });

      socketInstance.on('disconnect', () => {
        console.log('Disconnected from collaboration server');
        setIsConnected(false);
        setIsSocketAuthenticated(false);
      });

      socketInstance.on('user:count', (count) => {
        setUserCount(count);
        console.log(`Active collaborative users: ${count}`);
      });

      // Cleanup function
      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
        setSocket(null);
        setIsConnected(false);
        setIsSocketAuthenticated(false);
        setUserCount(0);
      };
    }
  }, [serverPath, isAuthenticated]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  return { 
    socket, 
    isConnected, 
    isSocketAuthenticated,
    userCount,
    // Helper to check if collaboration is active (more than 1 user)
    isCollaborating: userCount > 1 && isSocketAuthenticated
  };
};
