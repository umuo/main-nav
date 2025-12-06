import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'vibe' | 'sunset' | 'ocean' | 'minimal';

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
            .then(res => res.json())
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
        setThemeState(newTheme);

        try {
            // Persist globally (Admin only)
            await fetch('/api/config/theme', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ theme: newTheme })
            });
        } catch (e) {
            console.error('Failed to save global theme', e);
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
