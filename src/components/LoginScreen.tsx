import { CredentialResponse, GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google"
import * as React from "react"
import { Col, Row, Typography, Alert, AlertProps, Avatar, Dropdown, Menu } from "antd"
import awardwizImageUrl from "../wizard.png"
import CarbonLogout from "~icons/carbon/logout"

export const LoginScreen = ({ children }: { children: JSX.Element }) => {
  const [message, setMessage] = React.useState<{ type: AlertProps["type"], text: string }>({ type: undefined, text: "" })
  const [session, setSession] = React.useState(false)

  React.useEffect(() => {
    setMessage({ type: "info", text: "Loading..." })

    // const loadSession = async () => {
    //   const session = await supabase.auth.getSession()
    //   if (!session.error) setSupabaseSession(session.data.session ?? undefined)
    // }
    // void loadSession()
    // supabase.auth.onAuthStateChange((event, session) => loadSession())
  }, [])

  const sessionEmail = "TODOEMAIL@EMAIL.COM" as string | undefined // supabaseSession?.user.email ?? undefined
  React.useEffect(() => {
    console.log(`Current user logged in: ${sessionEmail ?? "(not logged in)"}`)
  }, [sessionEmail])

  const onGoogleCredential = async (credentialResponse: CredentialResponse) => {
    setSession(true)    // TODO: implement session
    // console.log("Google credential received, logging into Supabase...")
    // if (!credentialResponse.credential || !credentialResponse.clientId) { setMessage({ type: "error", text: "Failed to log in with Google" }); return }

    // // Supabase seems to not support doing an xhr to get a token (so we don't need to reload the page) natively. We
    // // want this because of the Google One Tap button shouldn't require a redirect like Supabase is expecting. So we're
    // // using an older API to get the session and then we 'refresh' it to get back into the expected Supabase SDK flow.
    // const response = await axios.post<Session>(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=id_token`, {
    //   client_id: credentialResponse.clientId,
    //   id_token: credentialResponse.credential,
    //   issuer: "https://accounts.google.com",
    //   provider: "google"
    // }, { headers: { "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, "apikey": `${import.meta.env.VITE_SUPABASE_ANON_KEY}` } }).catch((error) => {
    //   setMessage({ type: "error", text: `Failed to log into Supabase: ${error.response?.data?.message || error.response?.data?.msg || error.message}` })
    //   throw error
    // })
    // if (!response.data.user.email) { setMessage({ type: "error", text: "Could not get email address from auth provider" }); return }
    // await supabase.auth.setSession({ refresh_token: response.data.refresh_token, access_token: response.data.access_token })
  }

  // Logged in view
  if (session) {
    const avatarMenu = (
      <Menu items={[
        { key: "logOut", icon: <CarbonLogout />, label: "Log out", onClick: () => {} /* supabase.auth.signOut() */ }
      ]} />
    )

    return (
      <>
        <Dropdown overlay={avatarMenu} trigger={["click"]}>
          <Avatar src={/* supabaseSession.user.user_metadata.picture */ ""} style={{ cursor: "pointer", float: "right", marginBlockStart: 10, marginInlineEnd: 10 }}>
            {/* {`${supabaseSession.user.user_metadata.given_name?.toString()[0]}${supabaseSession.user.user_metadata.family_name?.toString()[0]}`.toUpperCase()} */}
            TODO
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
        {message.type !== undefined && (
          <Row justify="center">
            <Alert style={{ marginTop: 10 }} message={message.text} type={message.type} showIcon />
          </Row>
        )}
      </Col>
    </Row>
  )
}
