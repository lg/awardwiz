import { GoogleLogin } from "@react-oauth/google"
import * as React from "react"
import { Session, SupabaseClient } from "@supabase/supabase-js"
import { Col, Row, Typography, Alert, AlertProps } from "antd"
import awardwizImageUrl from "../wizard.png"

const { Title } = Typography

const supabase = new SupabaseClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

export const LoginScreen = ({ children }: { children: JSX.Element }) => {
  const [googleCredential, setGoogleCredential] = React.useState<string>()
  const [status, setStatus] = React.useState<{type: AlertProps["type"], message: string}>({ type: undefined, message: "" })
  const [supabaseSession, setSupabaseSession] = React.useState<Session | null>(null)

  // Validate the Supabase session
  React.useEffect(() => {
    const session = supabase.auth.session()
    if (!session)
      return

    setStatus({ type: "info", message: "Loading..." })
    supabase.auth.refreshSession().then(({ data }) => {
      setStatus({ type: undefined, message: "" })
      setSupabaseSession(data)
      return data
    }).catch(() => {})
  }, [])

  // User has logged into google
  React.useEffect(() => {
    if (googleCredential) {
      supabase.auth.api.signInWithOpenIDConnect({ id_token: googleCredential, nonce: "", client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID, issuer: "https://accounts.google.com", provider: "google" }).then(async ({ data, error }) => {
        if (error)
          return setStatus({ type: "error", message: error.message })

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore (needed because of the signInWithOpenIDConnect hack above since we need nonce to be unneeded))
        // eslint-disable-next-line no-underscore-dangle
        supabase.auth._saveSession(data); supabase.auth._notifyAllSubscribers("SIGNED_IN")
        setSupabaseSession(supabase.auth.session())
        return data
      }).catch(() => {})
    }
  }, [googleCredential])

  if (supabaseSession)
    return children

  return (
    <Row justify="center" align="middle" style={{ minHeight: "100vh" }}>
      <Col>
        <Row justify="center" style={{ paddingBottom: 5 }}>
          <img alt="AwardWiz logo" src={awardwizImageUrl} style={{ width: 100 }} />
        </Row>
        <Row justify="center">
          <Title level={2}>AwardWiz</Title>
        </Row>
        <Row justify="center">
          <GoogleLogin
            onSuccess={async (credentialResponse) => setGoogleCredential(credentialResponse.credential)}
            onError={() => setStatus({ type: "error", message: "Couldn't log into Google" })}
          />
        </Row>
        { status.type !== undefined && (
          <Row justify="center">
            <Alert style={{ marginTop: 10 }} message={status.message} type={status.type} showIcon />
          </Row>
        )}
      </Col>
    </Row>
  )
}
