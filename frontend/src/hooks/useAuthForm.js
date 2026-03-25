import { useState } from 'react';

// ── useAuthForm ───────────────────────────────────────────────────────────────
// Manages shared email / password / showPassword state for Login and Signup.
// setEmail and setPassword are exposed so existing onChange handlers need no changes.
export function useAuthForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [modalStatus, setModalStatus] = useState('closed');
    const [modalErrorMessage, setModalErrorMessage] = useState('');

    // Generic handler for email and password fields.
    // Usage: onChange={handleChange('email')}  or  onChange={handleChange('password')}
    const handleChange = (field) => (e) => {
        if (field === 'email') setEmail(e.target.value);
        else if (field === 'password') setPassword(e.target.value);
    };

    return {
        email,
        password,
        showPassword, setShowPassword,
        modalStatus, setModalStatus,
        modalErrorMessage, setModalErrorMessage,
        handleChange,
    };
}
