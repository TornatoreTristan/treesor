import { Button } from '~/components/ui/button'
import { FcGoogle } from 'react-icons/fc'

const Login = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Treesor</h1>
          <p className="mt-2 text-gray-600">Connectez-vous pour accéder à votre espace</p>
        </div>

        <div className="mt-8">
          <Button
            className="w-full flex items-center justify-center gap-2 py-6 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 cursor-pointer"
            asChild
          >
            <a href="/auth/google">
              <FcGoogle className="w-5 h-5" />
              <span>Continuer avec Google</span>
            </a>
          </Button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            En vous connectant, vous acceptez nos conditions d'utilisation et notre politique de
            confidentialité
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
