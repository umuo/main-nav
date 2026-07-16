import React, { createContext, useContext, useEffect, useState } from 'react';

import { Theme } from '../types';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('minimal');

    // Fetch global theme on mount
    useEffect(() => {
        fetch('/api/config/theme')
            .then(async res => {
                if (!res.ok) {
                    throw new Error(`Theme request failed with status ${res.status}`);
                }
                return res.json();
            })
            .then(data => {
                if (data.theme) {
                    setThemeState(data.theme);
                }
            })
            .catch(err => {
                console.error('Failed to load theme', err);
                setThemeState('minimal');
            });
    }, []);

    // Sync to DOM when state changes
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    const setTheme = async (newTheme: Theme) => {
        // Optimistic update
        const previousTheme = theme;
        setThemeState(newTheme);

        try {
            // Persist globally (Admin only)
            const response = await fetch('/api/config/theme', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ theme: newTheme })
            });
            if (!response.ok) throw new Error('Theme update was rejected');
        } catch (e) {
            console.error('Failed to save global theme', e);
            setThemeState(previousTheme);
        }
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
