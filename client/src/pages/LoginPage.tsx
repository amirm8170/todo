import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AuthForm } from '../components/AuthForm';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  return (
    <AuthForm
      title="Log in"
      subtitle="Enter your email and password."
      submitLabel="Sign in"
      submittingLabel="Signing in..."
      passwordAutoComplete="current-password"
      errorFallback="Could not log in"
      onSubmit={(email, password) => login(email, password)}
      onSuccess={() => navigate('/')}
      footer={
        <>
          No account yet? <Link to="/register">Create one</Link>
        </>
      }
    />
  );
}
