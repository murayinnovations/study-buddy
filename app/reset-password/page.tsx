import AuthCard from '../login/AuthCard'
import NewPasswordForm from './NewPasswordForm'

export const metadata = { title: 'New password · Curriculum AI' }

// Reached from a password reset email, which signs the person in first.
export default function ResetPasswordPage() {
  return (
    <AuthCard>
      <NewPasswordForm />
    </AuthCard>
  )
}
