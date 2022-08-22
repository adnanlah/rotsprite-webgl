import Styles from './Snackbar.module.css'

interface SnackbarProps {
  isActive: boolean
  message: string | undefined
}

export const Snackbar = ({isActive, message}: SnackbarProps) => {
  return (
    <div
      style={{display: isActive ? 'flex' : 'hidden'}}
      className={
        isActive
          ? [Styles.snackbar, Styles.fadeIn].join(' ')
          : [Styles.snackbar, Styles.fadeOut].join(' ')
      }
    >
      {message}
    </div>
  )
}
