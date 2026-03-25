import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ArrowRight, Mail, Gem, Lock, Eye, EyeOff, ArrowLeft, X, AlertCircle, Loader } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../AuthContext';
import BlurFade from './BlurFade';
import GlassButton from './GlassButton';
import { useAuthForm } from '../../hooks/useAuthForm';



// ── GradientBackground ────────────────────────────────────────────────────────
const GradientBackground = () => (
    <>
        <style>{`@keyframes float1{0%{transform:translate(0,0)}50%{transform:translate(-10px,10px)}100%{transform:translate(0,0)}}@keyframes float2{0%{transform:translate(0,0)}50%{transform:translate(10px,-10px)}100%{transform:translate(0,0)}}`}</style>
        <svg width="100%" height="100%" viewBox="0 0 800 600" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" className="absolute top-0 left-0 w-full h-full">
            <defs>
                <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style={{ stopColor: 'var(--color-primary)', stopOpacity: 0.8 }} /><stop offset="100%" style={{ stopColor: 'var(--color-chart-3)', stopOpacity: 0.6 }} /></linearGradient>
                <linearGradient id="lg2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style={{ stopColor: 'var(--color-chart-4)', stopOpacity: 0.9 }} /><stop offset="50%" style={{ stopColor: 'var(--color-secondary)', stopOpacity: 0.7 }} /><stop offset="100%" style={{ stopColor: 'var(--color-chart-1)', stopOpacity: 0.6 }} /></linearGradient>
                <radialGradient id="rg3" cx="50%" cy="50%" r="50%"><stop offset="0%" style={{ stopColor: 'var(--color-destructive)', stopOpacity: 0.8 }} /><stop offset="100%" style={{ stopColor: 'var(--color-chart-5)', stopOpacity: 0.4 }} /></radialGradient>
                <filter id="lb1" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="35" /></filter>
                <filter id="lb2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="25" /></filter>
                <filter id="lb3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="45" /></filter>
            </defs>
            <g style={{ animation: 'float1 20s ease-in-out infinite' }}>
                <ellipse cx="200" cy="500" rx="250" ry="180" fill="url(#lg1)" filter="url(#lb1)" transform="rotate(-30 200 500)" />
                <rect x="500" y="100" width="300" height="250" rx="80" fill="url(#lg2)" filter="url(#lb2)" transform="rotate(15 650 225)" />
            </g>
            <g style={{ animation: 'float2 25s ease-in-out infinite' }}>
                <circle cx="650" cy="450" r="150" fill="url(#rg3)" filter="url(#lb3)" opacity="0.7" />
                <ellipse cx="50" cy="150" rx="180" ry="120" fill="var(--color-accent)" filter="url(#lb2)" opacity="0.8" />
            </g>
        </svg>
    </>
);



// ── Shared CSS (same as Signup) ───────────────────────────────────────────────
const sharedStyles = `
  input[type="password"]::-ms-reveal,input[type="password"]::-ms-clear{display:none!important}input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus,input:-webkit-autofill:active{-webkit-box-shadow:0 0 0 30px transparent inset!important;-webkit-text-fill-color:var(--foreground)!important;background-color:transparent!important;transition:background-color 5000s ease-in-out 0s!important;caret-color:var(--foreground)!important}
  @property --angle-1{syntax:"<angle>";inherits:false;initial-value:-75deg}@property --angle-2{syntax:"<angle>";inherits:false;initial-value:-45deg}
  .glass-button-wrap{--anim-time:400ms;--anim-ease:cubic-bezier(0.25,1,0.5,1);--border-width:clamp(1px,0.0625em,4px);position:relative;z-index:2;transform-style:preserve-3d;transition:transform var(--anim-time) var(--anim-ease)}.glass-button-wrap:has(.glass-button:active){transform:rotateX(25deg)}.glass-button-shadow{--shadow-cutoff-fix:2em;position:absolute;width:calc(100% + var(--shadow-cutoff-fix));height:calc(100% + var(--shadow-cutoff-fix));top:calc(0% - var(--shadow-cutoff-fix)/2);left:calc(0% - var(--shadow-cutoff-fix)/2);filter:blur(clamp(2px,0.125em,12px));transition:filter var(--anim-time) var(--anim-ease);pointer-events:none;z-index:0}.glass-button-shadow::after{content:"";position:absolute;inset:0;border-radius:9999px;background:linear-gradient(180deg,oklch(from var(--foreground) l c h/20%),oklch(from var(--foreground) l c h/10%));width:calc(100% - var(--shadow-cutoff-fix) - 0.25em);height:calc(100% - var(--shadow-cutoff-fix) - 0.25em);top:calc(var(--shadow-cutoff-fix) - 0.5em);left:calc(var(--shadow-cutoff-fix) - 0.875em);padding:0.125em;box-sizing:border-box;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude;transition:all var(--anim-time) var(--anim-ease);opacity:1}
  .glass-button{-webkit-tap-highlight-color:transparent;backdrop-filter:blur(clamp(1px,0.125em,4px));transition:all var(--anim-time) var(--anim-ease);background:linear-gradient(-75deg,oklch(from var(--background) l c h/5%),oklch(from var(--background) l c h/20%),oklch(from var(--background) l c h/5%));box-shadow:inset 0 0.125em 0.125em oklch(from var(--foreground) l c h/5%),inset 0 -0.125em 0.125em oklch(from var(--background) l c h/50%),0 0.25em 0.125em -0.125em oklch(from var(--foreground) l c h/20%),0 0 0.1em 0.25em inset oklch(from var(--background) l c h/20%)}.glass-button:hover{transform:scale(0.975)}.glass-button-text{color:oklch(from var(--foreground) l c h/90%);text-shadow:0em 0.25em 0.05em oklch(from var(--foreground) l c h/10%);transition:all var(--anim-time) var(--anim-ease)}.glass-button-text::after{content:"";display:block;position:absolute;width:calc(100% - var(--border-width));height:calc(100% - var(--border-width));top:calc(0% + var(--border-width)/2);left:calc(0% + var(--border-width)/2);box-sizing:border-box;border-radius:9999px;overflow:clip;background:linear-gradient(var(--angle-2),transparent 0%,oklch(from var(--background) l c h/50%) 40% 50%,transparent 55%);z-index:3;mix-blend-mode:screen;pointer-events:none;background-size:200% 200%;background-position:0% 50%;transition:background-position calc(var(--anim-time)*1.25) var(--anim-ease),--angle-2 calc(var(--anim-time)*1.25) var(--anim-ease)}.glass-button:hover .glass-button-text::after{background-position:25% 50%}.glass-button::after{content:"";position:absolute;z-index:1;inset:0;border-radius:9999px;width:calc(100% + var(--border-width));height:calc(100% + var(--border-width));top:calc(0% - var(--border-width)/2);left:calc(0% - var(--border-width)/2);padding:var(--border-width);box-sizing:border-box;background:conic-gradient(from var(--angle-1) at 50% 50%,oklch(from var(--foreground) l c h/50%) 0%,transparent 5% 40%,oklch(from var(--foreground) l c h/50%) 50%,transparent 60% 95%,oklch(from var(--foreground) l c h/50%) 100%),linear-gradient(180deg,oklch(from var(--background) l c h/50%),oklch(from var(--background) l c h/50%));mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude;transition:all var(--anim-time) var(--anim-ease),--angle-1 500ms ease;pointer-events:none}.glass-button:hover::after{--angle-1:-125deg}.glass-button:active::after{--angle-1:-75deg}
  .glass-input-wrap{position:relative;z-index:2;transform-style:preserve-3d;border-radius:9999px}.glass-input{display:flex;position:relative;width:100%;align-items:center;gap:0.5rem;border-radius:9999px;padding:0.25rem;-webkit-tap-highlight-color:transparent;backdrop-filter:blur(clamp(1px,0.125em,4px));transition:all 400ms cubic-bezier(0.25,1,0.5,1);background:linear-gradient(-75deg,oklch(from var(--background) l c h/5%),oklch(from var(--background) l c h/20%),oklch(from var(--background) l c h/5%));box-shadow:inset 0 0.125em 0.125em oklch(from var(--foreground) l c h/5%),inset 0 -0.125em 0.125em oklch(from var(--background) l c h/50%),0 0.25em 0.125em -0.125em oklch(from var(--foreground) l c h/20%),0 0 0.1em 0.25em inset oklch(from var(--background) l c h/20%)}.glass-input::after{content:"";position:absolute;z-index:1;inset:0;border-radius:9999px;width:calc(100% + clamp(1px,0.0625em,4px));height:calc(100% + clamp(1px,0.0625em,4px));top:calc(0% - clamp(1px,0.0625em,4px)/2);left:calc(0% - clamp(1px,0.0625em,4px)/2);padding:clamp(1px,0.0625em,4px);box-sizing:border-box;background:conic-gradient(from var(--angle-1) at 50% 50%,oklch(from var(--foreground) l c h/50%) 0%,transparent 5% 40%,oklch(from var(--foreground) l c h/50%) 50%,transparent 60% 95%,oklch(from var(--foreground) l c h/50%) 100%),linear-gradient(180deg,oklch(from var(--background) l c h/50%),oklch(from var(--background) l c h/50%));mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude;transition:all 400ms cubic-bezier(0.25,1,0.5,1),--angle-1 500ms ease;pointer-events:none}.glass-input-wrap:focus-within .glass-input::after{--angle-1:-125deg}.glass-input-text-area{position:absolute;inset:0;border-radius:9999px;pointer-events:none}.glass-input-text-area::after{content:"";display:block;position:absolute;width:calc(100% - clamp(1px,0.0625em,4px));height:calc(100% - clamp(1px,0.0625em,4px));top:calc(0% + clamp(1px,0.0625em,4px)/2);left:calc(0% + clamp(1px,0.0625em,4px)/2);box-sizing:border-box;border-radius:9999px;overflow:clip;background:linear-gradient(var(--angle-2),transparent 0%,oklch(from var(--background) l c h/50%) 40% 50%,transparent 55%);z-index:3;mix-blend-mode:screen;pointer-events:none;background-size:200% 200%;background-position:0% 50%;transition:background-position calc(400ms*1.25) cubic-bezier(0.25,1,0.5,1),--angle-2 calc(400ms*1.25) cubic-bezier(0.25,1,0.5,1)}.glass-input-wrap:focus-within .glass-input-text-area::after{background-position:25% 50%}
`;

// ── Login Page ────────────────────────────────────────────────────────────────
export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();

    const {
        email, password, showPassword, setShowPassword,
        modalStatus, setModalStatus, modalErrorMessage, setModalErrorMessage,
        handleChange,
    } = useAuthForm();
    const [authStep, setAuthStep] = useState('email');  // 'email' | 'password'
    const passwordInputRef = useRef(null);

    const isEmailValid = /\S+@\S+\.\S+/.test(email);
    const isPasswordValid = password.length >= 6;

    const handleFinalSubmit = async (e) => {
        e.preventDefault();
        if (modalStatus !== 'closed' || authStep !== 'password') return;
        setModalStatus('loading');
        try {
            await login(email, password);
            navigate('/');
        } catch (err) {
            setModalErrorMessage(err.message || 'Invalid email or password.');
            setModalStatus('error');
        }
    };

    const handleProgressStep = () => {
        if (authStep === 'email' && isEmailValid) setAuthStep('password');
        else if (authStep === 'password' && isPasswordValid) handleFinalSubmit({ preventDefault: () => { } });
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleProgressStep(); }
    };

    const closeModal = () => { setModalStatus('closed'); setModalErrorMessage(''); };

    useEffect(() => {
        if (authStep === 'password') setTimeout(() => passwordInputRef.current?.focus(), 500);
    }, [authStep]);

    const Modal = () => (
        <AnimatePresence>
            {modalStatus !== 'closed' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                        className="relative bg-card/80 border-4 border-border rounded-2xl p-8 w-full max-w-sm flex flex-col items-center gap-4 mx-2">
                        {(modalStatus === 'error') && (
                            <button onClick={closeModal} className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground transition-colors"><X className="w-5 h-5" /></button>
                        )}
                        {modalStatus === 'error' && <>
                            <AlertCircle className="w-12 h-12 text-destructive" />
                            <p className="text-lg font-medium text-foreground text-center">{modalErrorMessage}</p>
                            <GlassButton onClick={closeModal} size="sm" className="mt-4">Try Again</GlassButton>
                        </>}
                        {modalStatus === 'loading' &&
                            <div className="flex flex-col items-center gap-4">
                                <Loader className="w-12 h-12 text-primary animate-spin" />
                                <p className="text-lg font-medium text-foreground">Signing you in...</p>
                            </div>
                        }
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return (
        <div className="bg-background min-h-screen w-screen flex flex-col">
            <style>{sharedStyles}</style>
            <Modal />

            {/* Logo / Brand */}
            <div className={cn('fixed top-4 left-4 z-20 flex items-center gap-2', 'md:left-1/2 md:-translate-x-1/2')}>
                <div className="bg-primary text-primary-foreground rounded-md p-1.5"><Gem className="h-4 w-4" /></div>
                <h1 className="text-base font-bold text-foreground">AI Summarizer</h1>
            </div>

            <div className={cn('flex w-full flex-1 h-full items-center justify-center bg-card', 'relative overflow-hidden')}>
                <div className="absolute inset-0 z-0"><GradientBackground /></div>

                <fieldset disabled={modalStatus !== 'closed'} className="relative z-10 flex flex-col items-center gap-8 w-[280px] mx-auto p-4">
                    <AnimatePresence mode="wait">
                        {authStep === 'email' && (
                            <motion.div key="email-content" initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: 'easeOut' }} className="w-full flex flex-col items-center gap-4">
                                <BlurFade delay={0.25} className="w-full"><div className="text-center"><p className="font-serif font-light text-4xl sm:text-5xl md:text-6xl tracking-tight text-foreground whitespace-nowrap">Welcome back</p></div></BlurFade>
                            </motion.div>
                        )}
                        {authStep === 'password' && (
                            <motion.div key="password-title" initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: 'easeOut' }} className="w-full flex flex-col items-center text-center gap-4">
                                <BlurFade delay={0} className="w-full"><div className="text-center"><p className="font-serif font-light text-4xl sm:text-5xl tracking-tight text-foreground whitespace-nowrap">Enter password</p></div></BlurFade>
                                <BlurFade delay={0.25}><p className="text-sm font-medium text-muted-foreground">Logging in as <span className="text-foreground font-semibold">{email}</span></p></BlurFade>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleFinalSubmit} className="w-[300px] space-y-6">
                        {/* Always-visible email field */}
                        <div className="relative w-full">
                            <AnimatePresence>
                                {authStep === 'password' && (
                                    <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3, delay: 0.4 }} className="absolute -top-6 left-4 z-10">
                                        <label className="text-xs text-muted-foreground font-semibold">Email</label>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <BlurFade delay={authStep === 'email' ? 1.25 : 0} inView={true} className="w-full">
                                <div className="glass-input-wrap w-full"><div className="glass-input">
                                    <span className="glass-input-text-area" />
                                    <div className={cn('relative z-10 flex-shrink-0 flex items-center justify-center overflow-hidden transition-all duration-300 ease-in-out', email.length > 20 && authStep === 'email' ? 'w-0 px-0' : 'w-10 pl-2')}>
                                        <Mail className="h-5 w-5 text-foreground/80 flex-shrink-0" />
                                    </div>
                                    <input type="email" placeholder="Email" value={email} onChange={handleChange('email')} onKeyDown={handleKeyDown}
                                        className={cn('relative z-10 h-full w-0 flex-grow bg-transparent text-foreground placeholder:text-foreground/60 focus:outline-none transition-[padding-right] duration-300 ease-in-out delay-300', isEmailValid && authStep === 'email' ? 'pr-2' : 'pr-0')} />
                                    <div className={cn('relative z-10 flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out', isEmailValid && authStep === 'email' ? 'w-10 pr-1' : 'w-0')}>
                                        <GlassButton type="button" onClick={handleProgressStep} size="icon" aria-label="Continue" contentClassName="text-foreground/80 hover:text-foreground"><ArrowRight className="w-5 h-5" /></GlassButton>
                                    </div>
                                </div></div>
                            </BlurFade>
                        </div>

                        {/* Password field — only shown on step 2 */}
                        <AnimatePresence>
                            {authStep === 'password' && (
                                <BlurFade key="password-field" className="w-full">
                                    <div className="relative w-full">
                                        <AnimatePresence>
                                            {password.length > 0 && (
                                                <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3 }} className="absolute -top-6 left-4 z-10">
                                                    <label className="text-xs text-muted-foreground font-semibold">Password</label>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        <div className="glass-input-wrap w-full"><div className="glass-input">
                                            <span className="glass-input-text-area" />
                                            <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                                                {isPasswordValid
                                                    ? <button type="button" aria-label="Toggle password" onClick={() => setShowPassword(!showPassword)} className="text-foreground/80 hover:text-foreground transition-colors p-2 rounded-full">{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                                                    : <Lock className="h-5 w-5 text-foreground/80 flex-shrink-0" />
                                                }
                                            </div>
                                            <input ref={passwordInputRef} type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={handleChange('password')} onKeyDown={handleKeyDown}
                                                className="relative z-10 h-full w-0 flex-grow bg-transparent text-foreground placeholder:text-foreground/60 focus:outline-none" />
                                            <div className={cn('relative z-10 flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out', isPasswordValid ? 'w-10 pr-1' : 'w-0')}>
                                                <GlassButton type="submit" size="icon" contentClassName="text-foreground/80 hover:text-foreground"><ArrowRight className="w-5 h-5" /></GlassButton>
                                            </div>
                                        </div></div>
                                    </div>
                                    <BlurFade inView delay={0.2}>
                                        <button type="button" onClick={() => { setAuthStep('email'); setPassword(''); }} className="mt-4 flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-colors"><ArrowLeft className="w-4 h-4" /> Go back</button>
                                    </BlurFade>
                                </BlurFade>
                            )}
                        </AnimatePresence>
                    </form>

                    {/* Sign up link */}
                    <BlurFade delay={1.5} className="text-center">
                        <p className="text-sm text-muted-foreground">
                            Don&apos;t have an account?{' '}
                            <Link to="/signup" className="text-foreground font-semibold hover:underline transition-colors">Create one</Link>
                        </p>
                    </BlurFade>
                </fieldset>
            </div>
        </div>
    );
}
