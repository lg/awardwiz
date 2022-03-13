// eslint-disable-next-line import/prefer-default-export
export const airLabsFetch = (endpoint: string, signal?: AbortSignal) => {
  return fetch(`https://airlabs.co/api/v9${endpoint}&api_key=${process.env.REACT_APP_AIRLABS_API_KEY}`, { signal })
    .then((resp) => resp.json())
    .then((resp) => {
      if (resp.error)
        throw new Error(`Error while making API call ${resp.error.message}`)
      return resp.response
    })
}
