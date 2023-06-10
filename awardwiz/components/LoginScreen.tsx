import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google"
import type { CredentialResponse } from "@react-oauth/google"
import * as React from "react"
import { Col, Row, Typography, Alert, Avatar, Dropdown } from "antd"
import { AlertProps } from "antd/lib/alert"
import awardwizImageUrl from "../wizard.png"
import CarbonLogout from "~icons/carbon/logout"
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth"
import type { User } from "firebase/auth"
import { firebaseAuth } from "../helpers/firebase.js"

export const LoginScreen = ({ children }: { children: JSX.Element }) => {
  const [message, setMessage] = React.useState<{ type: AlertProps["type"], text: string }>({ type: undefined, text: "" })
  const [user, setUser] = React.useState<User>()

  React.useEffect(() => {
    setMessage({ type: "info", text: "Loading..." })
    firebaseAuth.onAuthStateChanged((authUser) => {
      setUser(authUser ?? undefined)
    })
  }, [])

  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.log(`Current user logged in: ${user?.email ?? "(not logged in)"}`)
  }, [user])

  const onGoogleCredential = (credentialResponse: CredentialResponse) => {
    // eslint-disable-next-line no-console
    console.log("Google credential received, logging into Firebase...")
    if (!credentialResponse.credential || !credentialResponse.clientId) { setMessage({ type: "error", text: "Failed to log in with Google" }); return }

    const idToken = credentialResponse.credential
    const credential = GoogleAuthProvider.credential(idToken)
    void signInWithCredential(firebaseAuth, credential).catch((error) => {
      setMessage({ type: "error", text: `Failed to log into Firebase with Google credential: ${(error as Error).message}` })
      throw error
    })
  }

  // Logged in view
  if (user) {
    const avatarMenuItems = { key: "logOut", icon: <CarbonLogout />, label: "Log out", onClick: async () => firebaseAuth.signOut() }
    return (
      <>
        <Dropdown menu={avatarMenuItems} trigger={["click"]}>
          <Avatar src={user.photoURL} style={{ cursor: "pointer", float: "right", marginBlockStart: 10, marginInlineEnd: 10 }}>USER</Avatar>
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
