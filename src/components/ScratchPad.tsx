import * as React from "react"

const flexOnTop: React.CSSProperties = { position: "fixed", zIndex: 999999, display: "inline-flex", bottom: 0, right: 0, margin: 10 }

export const ScratchPad = () => {
  const [visible, setVisible] = React.useState(false)
  const [scratchPad, setScratchPad] = React.useState(localStorage.getItem("scratchpad") || "")
  React.useEffect(() => {
    localStorage.setItem("scratchpad", scratchPad)
  }, [scratchPad])

  return (
    <>
      <textarea
        style={{ ...flexOnTop, width: "55%", height: "30%", fontFamily: "monospace", fontSize: 12, visibility: visible ? "visible" : "hidden" }}
        value={scratchPad}
        spellCheck={false}
        onChange={(obj) => { setScratchPad(obj.currentTarget.value) }}
      />
      <button type="button" style={flexOnTop} onClick={() => { setVisible(!visible) }}>
        ScratchPad
      </button>
    </>
  )
}
