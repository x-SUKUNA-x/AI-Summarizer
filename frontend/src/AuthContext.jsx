import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // On mount: try to restore session from the HTTP-only cookie via /api/auth/me
    useEffect(() => {
        api.me()
            .then(data => setUser(data.user))
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    const login = async (email, password) => {
        const data = await api.login(email, password);
        // Cookie is set by the server — no localStorage needed
        setUser(data.user);
        return data.user;
    };

    const signup = async (email, password) => {
        const data = await api.signup(email, password);
        // After signup the user is also logged in (cookie set)
        setUser(data.user);
        return data.user;
    };

    const logout = async () => {
        await api.logout(); // tells backend to clear the cookie
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    return useContext(AuthContext);
}
