
import { SignIn, SignUp } from "@clerk/clerk-react";
import { Routes, Route } from "react-router-dom";
import { dark } from "@clerk/themes";
import { useEffect } from "react";

export default function Auth() {
    useEffect(() => {
        const html = document.documentElement;
        const hadDark = html.classList.contains('dark');
        html.classList.add('dark');
        return () => {
            if (!hadDark) html.classList.remove('dark');
        };
    }, []);

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background">
            <Routes>
                <Route
                    path="sign-in/*"
                    element={<SignIn routing="path" path="/auth/sign-in" signUpUrl="/auth/sign-up" forceRedirectUrl="/dashboard" appearance={{ baseTheme: dark, variables: { colorPrimary: '#F2C94C' } }} />}
                />
                <Route
                    path="sign-up/*"
                    element={<SignUp routing="path" path="/auth/sign-up" signInUrl="/auth/sign-in" forceRedirectUrl="/dashboard" appearance={{ baseTheme: dark, variables: { colorPrimary: '#F2C94C' } }} />}
                />
                <Route
                    path="*"
                    element={<SignIn routing="path" path="/auth/sign-in" signUpUrl="/auth/sign-up" forceRedirectUrl="/dashboard" appearance={{ baseTheme: dark, variables: { colorPrimary: '#F2C94C' } }} />}
                />
            </Routes>
        </div>
    );
}
