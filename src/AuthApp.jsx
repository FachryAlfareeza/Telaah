import React, { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, ListChecks, LockKeyhole } from 'lucide-react';
import AIWorkspace from './AIWorkspace';
import ThemeToggle from './ThemeToggle';

const ACCOUNTS = 'telaah-mock-accounts';
const SESSION = 'telaah-mock-session';
function read(key, storage) { try { return JSON.parse(window[storage].getItem(key)); } catch { return null; } }
async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits({ name:'PBKDF2', salt:new TextEncoder().encode(salt), iterations:120000, hash:'SHA-256' },key,256);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2,'0')).join('');
}
export default function AuthApp() {
  const [user, setUser] = useState(() => { const s = read(SESSION,'sessionStorage'); return typeof s?.name === 'string' && typeof s?.email === 'string' ? s : null; });
  const [mode,setMode] = useState('login'), [error,setError] = useState(''), [busy,setBusy] = useState(false), [show,setShow] = useState(false);
  useEffect(() => { window.scrollTo(0,0); }, [user]);
  function enter(profile) { try { sessionStorage.setItem(SESSION,JSON.stringify(profile)); } catch { /* In-memory session still works. */ } setUser(profile); }
  function logout() { try { sessionStorage.removeItem(SESSION); } catch {} setUser(null); setError(''); setMode('login'); setShow(false); }
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email')).trim().toLowerCase(), password = String(data.get('password'));
    try {
      const stored = read(ACCOUNTS,'localStorage'), accounts = Array.isArray(stored) ? stored : [];
      if (mode === 'register') {
        const name = String(data.get('name')).trim();
        if (!name) throw Error('Nama wajib diisi.');
        if (password !== data.get('confirm')) throw Error('Konfirmasi kata sandi tidak cocok.');
        if (accounts.some(a => a.email === email)) throw Error('Email sudah terdaftar pada perangkat ini. Silakan masuk.');
        const salt = crypto.randomUUID();
        const account = { name,email,salt,hash:await hashPassword(password,salt) };
        try { localStorage.setItem(ACCOUNTS,JSON.stringify([...accounts,account])); } catch { throw Error('Penyimpanan browser tidak tersedia. Gunakan akun demo.'); }
        enter({ name,email });
      } else {
        const account = accounts.find(a => a.email === email);
        if (!account || await hashPassword(password,account.salt) !== account.hash) throw Error('Email atau kata sandi salah. Daftar terlebih dahulu jika belum memiliki akun.');
        enter({ name:account.name,email:account.email });
      }
    } catch(e) { setError(e.message || 'Tidak dapat masuk. Coba akun demo.'); }
    finally { setBusy(false); }
  }
  if (user) return <AIWorkspace user={user} onLogout={logout}/>;
  return <div className="ai-workspace auth-page"><header className="auth-header"><a className="brand" href="#"><span className="brand-icon"><ListChecks size={24}/></span>telaah<span className="brand-dot">.</span></a><ThemeToggle/></header><main className="auth-main"><section className="auth-card" aria-labelledby="auth-title"><span className="auth-icon"><LockKeyhole size={25}/></span><h1 id="auth-title">{mode === 'login' ? 'Selamat datang kembali.' : 'Buat akun Anda.'}</h1><div className="auth-tabs"><button type="button" disabled={busy} aria-pressed={mode==='login'} onClick={() => { setMode('login'); setError(''); }}>Masuk</button><button type="button" disabled={busy} aria-pressed={mode==='register'} onClick={() => { setMode('register'); setError(''); }}>Daftar</button></div><form key={mode} onSubmit={submit}>{mode==='register' && <label>Nama lengkap<input name="name" autoComplete="name" required maxLength={80} placeholder="Nama Anda" disabled={busy}/></label>}<label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="nama@instansi.go.id" disabled={busy}/></label><label>Kata sandi<span className="password-field"><input name="password" type={show?'text':'password'} autoComplete={mode==='login'?'current-password':'new-password'} required minLength={8} maxLength={128} placeholder="Minimal 8 karakter" disabled={busy}/><button type="button" aria-label={show?'Sembunyikan kata sandi':'Tampilkan kata sandi'} onClick={() => setShow(s=>!s)}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label>{mode==='register' && <label>Konfirmasi kata sandi<input name="confirm" type={show?'text':'password'} autoComplete="new-password" required minLength={8} maxLength={128} placeholder="Ulangi kata sandi" disabled={busy}/></label>}{error && <p className="auth-error" role="alert">{error}</p>}<button className="button primary auth-submit" disabled={busy} type="submit">{busy?'Memproses…':mode==='login'?'Masuk':'Buat akun'}<ArrowRight size={17}/></button></form><div className="auth-divider"><span>atau</span></div><button className="button secondary auth-demo" disabled={busy} onClick={() => enter({name:'Evaluator Demo',email:'demo@telaah.local'})}>Masuk dengan akun demo</button><p className="auth-note">Mockup lokal · gunakan kredensial contoh.</p></section></main></div>;
}
