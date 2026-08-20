import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AuthForm } from '../components/AuthForm';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  return (
    <AuthForm
      title="Create account"
      subtitle="Start organizing your tasks."
      submitLabel="Create account"
      submittingLabel="Creating account..."
      passwordAutoComplete="new-password"
      errorFallback="Could not register"
      onSubmit={(email, password) => register(email, password)}
      onSuccess={() => navigate('/')}
      footer={
        <>
          Already have an account? <Link to="/login">Log in</Link>
        </>
      }
    />
  );
}
