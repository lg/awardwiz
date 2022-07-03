export const hasPods = (aircraftName: string, carrierCode: string) => {
  if (carrierCode === "AC")
    return /A330|787|777/.test(aircraftName)
  if (carrierCode === "UA")
    return /787|777|757-200|767/.test(aircraftName)
  return false
}

// module.exports = hasPods
