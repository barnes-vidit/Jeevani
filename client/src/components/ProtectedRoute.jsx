import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import Layout from './Layout';

/**
 * Wraps a page component with authentication + layout.
 * Redirects to sign-in if the user is not authenticated.
 */
export default function ProtectedRoute({ children }) {
    return (
        <>
            <SignedIn>
                <Layout>
                    {children}
                </Layout>
            </SignedIn>
            <SignedOut>
                <RedirectToSignIn />
            </SignedOut>
        </>
    );
}
