import { renderHook } from '@testing-library/react';
import { io } from 'socket.io-client';
import { useSocket } from '../../hooks/useSocket';

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
    id: 'mock-socket-id',
  })),
}));

vi.mock('../../api', () => ({
  getAuthToken: vi.fn(() => 'mock-token'),
}));

describe('useSocket', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns socket-related state', () => {
    const { result } = renderHook(() => useSocket('http://localhost:3001'));

    expect(result.current).toHaveProperty('socket');
    expect(result.current).toHaveProperty('isConnected');
    expect(result.current).toHaveProperty('isSocketAuthenticated');
    expect(result.current).toHaveProperty('userCount');
    expect(result.current).toHaveProperty('isCollaborating');
  });

  it('does not connect when not authenticated', () => {
    renderHook(() => useSocket('http://localhost:3001', false));

    // io should not be called since isAuthenticated is false
    expect(io).not.toHaveBeenCalled();
  });

  it('returns isConnected as false initially', () => {
    const { result } = renderHook(() => useSocket('http://localhost:3001'));
    expect(result.current.isConnected).toBe(false);
  });

  it('returns isSocketAuthenticated as false initially', () => {
    const { result } = renderHook(() => useSocket('http://localhost:3001'));
    expect(result.current.isSocketAuthenticated).toBe(false);
  });

  it('returns userCount as 0 initially', () => {
    const { result } = renderHook(() => useSocket('http://localhost:3001'));
    expect(result.current.userCount).toBe(0);
  });

  it('returns isCollaborating as false initially', () => {
    const { result } = renderHook(() => useSocket('http://localhost:3001'));
    expect(result.current.isCollaborating).toBe(false);
  });
});
