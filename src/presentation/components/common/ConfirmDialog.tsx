import React from 'react'
import { Alert } from 'react-native'

interface ConfirmDialogOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel?: () => void
}

/**
 * Shows a native confirmation dialog using Alert.alert.
 * Call this function directly — no component needed.
 */
export function showConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogOptions): void {
  Alert.alert(title, message, [
    {
      text: cancelLabel,
      style: 'cancel',
      onPress: onCancel,
    },
    {
      text: confirmLabel,
      style: destructive ? 'destructive' : 'default',
      onPress: onConfirm,
    },
  ])
}
