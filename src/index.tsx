import * as React from "react"
import * as ReactDOM from "react-dom"
import "./index.css"

class NearbyAirports extends React.Component<{}, { airportCode: string }> {
  state = { airportCode: "SFO" }

  render() {
    return (
      <div>
        <form onSubmit={(e) => {
          e.preventDefault()
          // eslint-disable-next-line
          window.alert(this.state.airportCode)
        }}>
          <label>
            Airport:
            <input
              type="text"
              value={this.state.airportCode}
              onChange={(e) => this.setState({ airportCode: e.target.value })}
            />
          </label>
          <input type="submit" value="Lookup" />
        </form>
        <ul>
          <li>abc</li>
          <li>def</li>
          <li>ghi</li>
        </ul>
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
