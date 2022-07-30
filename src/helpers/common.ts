import React from "react"
import * as ReactQuery from "@tanstack/react-query"

// Calls ReactQuery's useQueries, but maps the keys to the requests since ReqctQuery doesnt have a way to identify the request
export const useQueriesWithKeys = <T extends any[]>(queries: readonly [...ReactQuery.QueriesOptions<T>]) => {
  const queriesWithKeys = ReactQuery.useQueries({ queries }).map((query, index) => ({ ...query, queryKey: queries[index].queryKey as ReactQuery.QueryKey }))
  const data = useArrayMemo(queriesWithKeys.map((query) => query.data).flat().filter((item): item is T => !!item)) as T
  const immutableData = React.useMemo(() => JSON.parse(JSON.stringify(data)), [data]) as T    // ensure changes dont go back into useQueries

  return { queries: queriesWithKeys, data: immutableData }
}

// Used to get the results of useQueries stable
// from: https://medium.com/@trisianto/react-query-how-to-memoize-results-from-usequeries-hook-eaed9a0ec700
const useArrayMemo = <T extends any[]>(array: T) => {
  // this holds reference to previous value
  const ref = React.useRef<T>(array) //////////////////// the guy had this empty, no array in there

  // check if each element of the old and new array match
  const areArraysConsideredTheSame = (array.length === ref.current.length) && array.every((element, i) => element === ref.current[i])

  React.useEffect(() => {
    // only update prev results if array is not deemed the same
    if (!areArraysConsideredTheSame)
      ref.current = array
  }, [areArraysConsideredTheSame, array])

  return areArraysConsideredTheSame ? ref.current : array
}
