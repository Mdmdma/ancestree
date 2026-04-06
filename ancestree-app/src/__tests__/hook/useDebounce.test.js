import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../../hooks/useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a debounced function and a cancel function', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounce(callback, 300));

    const [debouncedFn, cancel] = result.current;
    expect(typeof debouncedFn).toBe('function');
    expect(typeof cancel).toBe('function');
  });

  it('debounced function calls callback after delay', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounce(callback, 300));

    act(() => {
      result.current[0]('hello');
    });

    // Not called yet
    expect(callback).not.toHaveBeenCalled();

    // Advance time past the delay
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('hello');
  });

  it('rapid calls only trigger callback once', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounce(callback, 300));

    act(() => {
      result.current[0]('a');
      result.current[0]('b');
      result.current[0]('c');
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('c');
  });

  it('cancel function prevents pending execution', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounce(callback, 300));

    act(() => {
      result.current[0]('data');
    });

    act(() => {
      result.current[1](); // cancel
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(callback).not.toHaveBeenCalled();
  });
});
