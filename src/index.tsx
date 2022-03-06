import * as React from "react"
import * as ReactDOM from "react-dom"
import "./index.css"

interface AppState {
}
class App extends React.Component<{}, AppState> {
  state: AppState = {}

  render() {
    return <div>hello!</div>
  }
}

// ========================================

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root")
)
