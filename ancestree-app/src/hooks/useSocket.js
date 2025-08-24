import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

export const useSocket = (serverPath) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const socketRef = useRef(null);

  useEffect(() => {
    // Only connect if we don't already have a socket
    if (!socketRef.current && serverPath) {
      const socketInstance = io(serverPath, {
        transports: ['websocket', 'polling']
      });

      socketRef.current = socketInstance;
      setSocket(socketInstance);

      socketInstance.on('connect', () => {
        console.log('Connected to collaboration server');
        setIsConnected(true);
      });

      socketInstance.on('disconnect', () => {
        console.log('Disconnected from collaboration server');
        setIsConnected(false);
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
        setUserCount(0);
      };
    }
  }, [serverPath]);

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
    userCount,
    // Helper to check if collaboration is active (more than 1 user)
    isCollaborating: userCount > 1
  };
};
