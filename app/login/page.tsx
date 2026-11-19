import LoginForm from './LoginForm'
import AuthCard from './AuthCard'

export const metadata = { title: 'Sign in · Study Buddy' }

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <AuthCard>
      <LoginForm linkFailed={searchParams.error === 'link'} />
    </AuthCard>
  )
}
