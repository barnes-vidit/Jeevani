import React, { useState, useEffect } from 'react';

import logoLight from '../assets/logo.png';
import logoDark from '../assets/logo-dark.png';

export const Logo = ({ className = "h-8 w-8", withText = false, forceDark = false }) => {
    const [currentLogo, setCurrentLogo] = useState(logoLight);
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        // Function to check if dark mode is active
        const checkDarkMode = () => {
            const isDark = forceDark || document.documentElement.classList.contains('dark');
            setIsDarkMode(isDark);
            setCurrentLogo(isDark ? logoDark : logoLight);
        };

        // Initial check
        checkDarkMode();

        // Create observer to watch for class changes on html element
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    checkDarkMode();
                }
            });
        });

        observer.observe(document.documentElement, { attributes: true });

        return () => observer.disconnect();
    }, []);

    return (
        <div className="flex items-center gap-2">
            <div className={`relative flex items-center justify-center ${className}`}>
                <img
                    src={currentLogo}
                    alt="Jeevani Logo"
                    className="w-full h-full object-contain"
                />
            </div>

            {withText && (
                <span className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'bg-clip-text text-transparent bg-gradient-to-r from-primary to-amber-500'}`}>
                    Jeevani
                </span>
            )}
        </div>
    );
};

export default Logo;
