import { useEffect, useRef } from 'react';

type GoogleResponse = { credential: string };
type GoogleIdentity = {
  initialize: (options: { client_id: string; callback: (response: GoogleResponse) => void }) => void;
  renderButton: (element: HTMLElement, options: { theme: string; size: string; width: number }) => void;
};

declare global {
  interface Window { google?: { accounts: { id: GoogleIdentity } } }
}

export default function GoogleSignIn({ onCredential }: { onCredential: (credential: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  useEffect(() => { callback.current = onCredential; }, [onCredential]);
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || !container.current) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !window.google || !container.current) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: (response) => callback.current(response.credential) });
      container.current.replaceChildren();
      window.google.accounts.id.renderButton(container.current, { theme: 'outline', size: 'large', width: 320 });
    };
    if (window.google) render();
    else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = render;
      document.head.appendChild(script);
    }
    return () => { cancelled = true; };
  }, []);
  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) return null;
  return <div ref={container} className="flex justify-center mt-4" aria-label="Sign in with Google" />;
}
