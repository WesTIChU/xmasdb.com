import React, { useState } from 'react';

interface AdminLoginPageProps {
  onAuthenticated: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onAuthenticated }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSending) return;
    setIsSending(true);
    setError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Incorrect password.');
      onAuthenticated();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Incorrect password.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="py-12 sm:py-16" aria-labelledby="admin-login-heading">
      <div className="mx-auto max-w-md border-t border-[#E7DFD5] pt-8">
        <h1 id="admin-login-heading" className="font-heading text-2xl font-semibold tracking-wide text-[#1A3D2F]">ADMIN LOGIN</h1>
        <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
          {error && <p className="border-l-2 border-[#841818] bg-[#F7F2EB] px-4 py-3 text-sm text-[#841818]" role="alert">{error}</p>}
          <div>
            <label htmlFor="admin-password" className="mb-2 block text-sm font-semibold text-[#1A3D2F]">Password</label>
            <input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded border border-[#DCD3C7] bg-[#FFFDF9] px-3 py-2.5 text-[#23211E] outline-none focus:border-[#1A3D2F] focus:ring-2 focus:ring-[#1A3D2F]/20"
            />
          </div>
          <button type="submit" disabled={isSending} className="rounded border border-[#1A3D2F] bg-[#1A3D2F] px-5 py-3 text-sm font-semibold tracking-wide text-[#FAF7F2] transition-colors hover:bg-[#143626] disabled:cursor-wait disabled:opacity-60">
            {isSending ? 'SIGNING IN...' : 'SIGN IN'}
          </button>
        </form>
      </div>
    </section>
  );
};
