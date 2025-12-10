
import { SignIn, SignUp } from "@clerk/clerk-react";
import { Routes, Route } from "react-router-dom";

export default function Auth() {
    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background">
            <Routes>
                <Route
                    path="sign-in/*"
                    element={<SignIn routing="path" path="/auth/sign-in" signUpUrl="/auth/sign-up" forceRedirectUrl="/dashboard" />}
                />
                <Route
                    path="sign-up/*"
                    element={<SignUp routing="path" path="/auth/sign-up" signInUrl="/auth/sign-in" forceRedirectUrl="/dashboard" />}
                />
                <Route
                    path="*"
                    element={<SignIn routing="path" path="/auth/sign-in" signUpUrl="/auth/sign-up" forceRedirectUrl="/dashboard" />}
                />
            </Routes>
        </div>
    );
}
