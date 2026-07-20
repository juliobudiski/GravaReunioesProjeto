import React, { createContext, useState, useEffect, useContext } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // Lê do localStorage (se existir) ou usa 'light' como padrão
  const [theme, setTheme] = useState(localStorage.getItem('app-theme') || 'light');

  useEffect(() => {
    // Remove todos os temas antigos da tag body
    document.body.classList.remove('theme-dark', 'theme-colorful');
    
    // Aplica o novo tema se não for o Light (o Light é o root padrão)
    if (theme !== 'light') {
      document.body.classList.add(`theme-${theme}`);
    }
    
    // Salva a escolha do usuário no navegador
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
