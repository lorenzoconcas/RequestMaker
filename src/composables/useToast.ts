import { readonly, ref } from 'vue'

export type ToastVariant = 'default' | 'success' | 'error' | 'info'

export interface ToastOptions {
  title?: string
  description: string
  variant?: ToastVariant
  durationMs?: number
}

export interface ToastMessage {
  id: number
  title: string
  description: string
  variant: ToastVariant
}

const toastsState = ref<ToastMessage[]>([])
let nextToastId = 1

function defaultTitleForVariant(variant: ToastVariant) {
  if (variant === 'success') {
    return 'Operazione completata'
  }

  if (variant === 'error') {
    return 'Errore'
  }

  if (variant === 'info') {
    return 'Info'
  }

  return 'Messaggio'
}

function dismissToast(id: number) {
  toastsState.value = toastsState.value.filter((toastItem) => toastItem.id !== id)
}

function pushToast(options: ToastOptions) {
  const description = options.description.trim()

  if (!description) {
    return
  }

  const variant = options.variant ?? 'default'
  const id = nextToastId
  nextToastId += 1

  toastsState.value = [
    ...toastsState.value,
    {
      id,
      title: options.title?.trim() || defaultTitleForVariant(variant),
      description,
      variant,
    },
  ]

  const durationMs = Number.isFinite(options.durationMs) ? Math.max(1200, Math.floor(options.durationMs ?? 0)) : 4500
  setTimeout(() => {
    dismissToast(id)
  }, durationMs)
}

export function useToast() {
  return {
    toasts: readonly(toastsState),
    toast: pushToast,
    dismissToast,
    error: (description: string, title = 'Errore') =>
      pushToast({
        title,
        description,
        variant: 'error',
      }),
    success: (description: string, title = 'Operazione completata') =>
      pushToast({
        title,
        description,
        variant: 'success',
      }),
    info: (description: string, title = 'Info') =>
      pushToast({
        title,
        description,
        variant: 'info',
      }),
  }
}
