import * as React from "react"
import * as ReactDOM from "react-dom"
import "./index.css"

class NearbyAirports extends React.Component<{}, {airportCode: string}> {
  state = { airportCode: "SFO" }

  render() {
    return (
      <div>
        Airport:
        <input
          type="text"
          value={this.state.airportCode}
          onChange={(event) => this.setState({ airportCode: event.target.value })}
        />
      </div>
    )
  }
}

interface AppState {
}
class App extends React.Component<{}, AppState> {
  state: AppState = {}

  render() {
    return (
      <NearbyAirports />
    )
  }
}

// ========================================

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root")
)
