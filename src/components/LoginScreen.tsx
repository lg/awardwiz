import { CredentialResponse, GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google"
import * as React from "react"
import { SupabaseClient } from "@supabase/supabase-js"
import { Col, Row, Typography, Alert, AlertProps, Avatar, Dropdown, Menu } from "antd"
import awardwizImageUrl from "../wizard.png"
import CarbonLogout from "~icons/carbon/logout"

export const supabase = new SupabaseClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

export const LoginScreen = ({ children }: { children: JSX.Element }) => {
  const [message, setMessage] = React.useState<{type: AlertProps["type"], text: string}>({ type: undefined, text: "" })
  const [supabaseSession, setSupabaseSession] = React.useState(supabase.auth.session())

  React.useEffect(() => {
    setMessage({ type: "info", text: "Loading..." })
    supabase.auth.onAuthStateChange((event, session) => { setSupabaseSession(session) })
  }, [])

  const sessionEmail = supabaseSession?.user?.email
  React.useEffect(() => {
    console.log(`Current user logged in: ${sessionEmail || "(not logged in)"}`)
  }, [sessionEmail])

  const onGoogleCredential = async (credentialResponse: CredentialResponse) => {
    console.log("Google credential received, logging into Supabase...")
    if (!credentialResponse.credential || !credentialResponse.clientId) { setMessage({ type: "error", text: "Failed to log in with Google" }); return }

    const { data, error } = await supabase.auth.api.signInWithOpenIDConnect({ id_token: credentialResponse.credential, nonce: "", client_id: credentialResponse.clientId, issuer: "https://accounts.google.com", provider: "google" })
    if (error) { setMessage({ type: "error", text: error.message }); return }
    if (!data?.user?.email) { setMessage({ type: "error", text: "Could not get email address from auth provider" }); return }

    // @ts-ignore (needed because of the nonce hack in signInWithOpenIDConnect above)
    // eslint-disable-next-line no-underscore-dangle
    supabase.auth._saveSession(data); supabase.auth._notifyAllSubscribers("SIGNED_IN")
  }

  // Logged in view
  if (supabaseSession) {
    const avatarMenu = (
      <Menu items={[
        { key: "logOut", icon: <CarbonLogout />, label: "Log out", onClick: () => supabase.auth.signOut() }
      ]} />
    )

    return (
      <>
        <Dropdown overlay={avatarMenu} trigger={["click"]}>
          <Avatar src={supabaseSession.user?.user_metadata?.picture} style={{ cursor: "pointer", float: "right", marginBlockStart: 10, marginInlineEnd: 10 }}>
            {`${supabaseSession.user?.user_metadata?.given_name?.toString()[0]}${supabaseSession.user?.user_metadata.family_name?.toString()[0]}`.toUpperCase()}
          </Avatar>
        </Dropdown>
        {children}
      </>
    )
  }

  // Logged out view
  return (
    <Row justify="center" align="middle" style={{ minHeight: "100vh" }}>
      <Col>
        <Row justify="center" style={{ paddingBottom: 5 }}>
          <img alt="AwardWiz logo" src={awardwizImageUrl} style={{ width: 100 }} />
        </Row>
        <Row justify="center">
          <Typography.Title level={2}>AwardWiz</Typography.Title>
        </Row>
        <Row justify="center">
          <GoogleOAuthProvider
            clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}
            onScriptLoadError={() => setMessage({ type: "error", text: "Couldn't load Google Login button" })}
            onScriptLoadSuccess={() => setMessage({ type: undefined, text: "" })}
          >
            <GoogleLogin
              onSuccess={onGoogleCredential}
              onError={() => setMessage({ type: "error", text: "Couldn't log into Google" })}
            />
          </GoogleOAuthProvider>
        </Row>
        { message.type !== undefined && (
          <Row justify="center">
            <Alert style={{ marginTop: 10 }} message={message.text} type={message.type} showIcon />
          </Row>
        )}
      </Col>
    </Row>
  )
}
