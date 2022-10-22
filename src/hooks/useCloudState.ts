import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import { supabase } from "../components/LoginScreen"
import { Json } from "../types/supabase-types"

export const useCloudState = <T>(key: string, defaultValue: T) => {
  const queryClient = useQueryClient()

  const value = useQuery(["cloudstate", key], async () => {
    const existingResult = await supabase.from("cloudstate").select().eq("key", key).maybeSingle()
    if (existingResult.error === undefined && existingResult.data === undefined)
      return mutation.mutate(defaultValue)            // set the default value if not in the db

    if (existingResult.data?.value)
      return existingResult.data.value as unknown as T
    throw new Error(existingResult.error?.message ?? `Could not get ${key} for user`)
  })

  const mutation = useMutation(async (newValue: T) => {
    return supabase.from("cloudstate").upsert({ key, value: newValue as unknown as Json }).throwOnError()
  }, {
    onMutate: async (newValue) => {     // optimistic update
      await queryClient.cancelQueries(["cloudstate", key])
      const previousValue = queryClient.getQueryData(["cloudstate", key])
      queryClient.setQueryData(["cloudstate", key], newValue)
      return { previousValue, newValue }
    },
    onError: (error, newValue, context) => {    // set things back if there was an error
      queryClient.setQueryData(["cloudstate", key], context?.previousValue)
      if (context?.previousValue === undefined)
        throw new Error(`Unable to set default value of ${JSON.stringify(defaultValue)} for ${key}}`)
    },
    onSettled: (newValue) => {    // update all data (though should be unnecessary)
      return queryClient.invalidateQueries(["cloudstate", key])
    },
  })

  const setValueState = React.useCallback(async (newValue: T) => {
    mutation.mutate(newValue)
  }, [mutation])

  return { value: value.data, setValue: setValueState }
}
