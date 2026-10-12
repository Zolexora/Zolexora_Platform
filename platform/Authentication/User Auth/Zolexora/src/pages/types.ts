export type AuthActionState = {
  error?: string
  success?: boolean
  email?: string
}

export type SignInAction = (
  prev: AuthActionState,
  formData: FormData,
) => Promise<AuthActionState>

export type SignUpAction = (
  prev: AuthActionState,
  formData: FormData,
) => Promise<AuthActionState>
