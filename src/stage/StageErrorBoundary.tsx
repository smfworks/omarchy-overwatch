import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  onReset?: () => void
}

interface State {
  error: string | null
}

export class StageErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error: error.message || 'center view failed' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('Center stage error (not invented intel):', error.message, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (prev.children !== this.props.children && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="stage-fallback" role="alert">
        <p>Center view failed to start (often a lost WebGL context). No map or globe data was invented.</p>
        <p className="disclaimer">{this.state.error}</p>
        <button
          type="button"
          className="btn"
          onClick={() => {
            this.setState({ error: null })
            this.props.onReset?.()
          }}
        >
          ← Globe
        </button>
      </div>
    )
  }
}
