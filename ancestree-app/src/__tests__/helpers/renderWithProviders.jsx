import { render } from '@testing-library/react';
import { LanguageProvider } from '../../locales/LanguageContext';

export function renderWithProviders(ui, options = {}) {
  function Wrapper({ children }) {
    return (
      <LanguageProvider>
        {children}
      </LanguageProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}
