import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Heart,
  Bell,
  FileText,
  Shield,
  LogOut,
  LogIn,
  UserPlus,
  Loader2,
  Mail,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function MobileProfile() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'menu' | 'login' | 'signup'>('menu');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (mode === 'signup') {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: displayName.trim() } },
      });
      if (signUpError) {
        setError(translateError(signUpError.message));
        setSubmitting(false);
        return;
      }
      if (data.user) {
        setMode('menu');
        setSubmitting(false);
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(translateError(signInError.message));
        setSubmitting(false);
        return;
      }
      setMode('menu');
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    setMode('menu');
  }

  if (mode === 'login' || mode === 'signup') {
    return (
      <div className="min-h-screen px-4 py-6">
        <h1 className="mb-6 text-xl font-bold tracking-tight text-neutral-900">
          {mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
        </h1>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="name">Ad</Label>
              <Input
                id="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Adınız"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">E-posta</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@email.com"
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Şifre</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="En az 6 karakter"
                className="pl-9"
              />
            </div>
          </div>

          <Button type="submit" disabled={submitting} className="w-full" size="lg">
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === 'login' ? (
              'Giriş Yap'
            ) : (
              'Kayıt Ol'
            )}
          </Button>

          <button
            type="button"
            onClick={() => setMode('menu')}
            className="w-full text-center text-sm text-neutral-500 hover:text-neutral-900"
          >
            Geri
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6">
      {/* User info */}
      <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5">
        {user ? (
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-lg font-medium text-white">
              {profile?.display_name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-neutral-900">
                {profile?.display_name ?? 'Kullanıcı'}
              </p>
              <p className="truncate text-sm text-neutral-400">{user.email}</p>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
              <User className="h-6 w-6 text-neutral-400" />
            </div>
            <p className="font-medium text-neutral-900">Misafir Kullanıcı</p>
            <p className="mt-1 text-sm text-neutral-400">
              Favorilerinizi senkronize etmek için giriş yapın
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setMode('login')}
              >
                <LogIn className="mr-2 h-4 w-4" />
                Giriş Yap
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => setMode('signup')}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Kayıt Ol
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Menu */}
      <div className="space-y-1">
        <MenuItem icon={<Heart className="h-5 w-5" />} label="Favorilerim" onClick={() => navigate('/favorites')} />
        {user && (
          <MenuItem
            icon={<Bell className="h-5 w-5" />}
            label="Bildirim Tercihleri"
            onClick={() => toast.info('Bu özellik yakında eklenecek.')}
          />
        )}
        <MenuItem
          icon={<Shield className="h-5 w-5" />}
          label="Gizlilik Politikası"
          onClick={() => toast.info('Gizlilik politikası yakında eklenecektir.')}
        />
        <MenuItem
          icon={<FileText className="h-5 w-5" />}
          label="Kullanım Koşulları"
          onClick={() => toast.info('Kullanım koşulları yakında eklenecektir.')}
        />
        {user && (
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl p-4 text-left text-red-600 transition-colors hover:bg-red-50"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">Çıkış Yap</span>
          </button>
        )}
      </div>

      <p className="mt-8 text-center text-xs text-neutral-300">İndirimGO v1.0</p>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl p-4 text-left transition-colors hover:bg-neutral-100"
    >
      <span className="text-neutral-500">{icon}</span>
      <span className="font-medium text-neutral-900">{label}</span>
    </button>
  );
}

function translateError(message: string): string {
  if (message.includes('already registered') || message.includes('already been registered')) {
    return 'Bu e-posta adresi zaten kayıtlı.';
  }
  if (message.includes('Invalid login credentials')) {
    return 'E-posta veya şifre hatalı.';
  }
  if (message.includes('Password should be at least')) {
    return 'Şifre en az 6 karakter olmalıdır.';
  }
  return 'Bir hata oluştu. Lütfen tekrar deneyin.';
}
