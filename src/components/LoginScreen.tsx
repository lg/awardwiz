import { CredentialResponse, GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google"
import * as React from "react"
import { Col, Row, Typography, Alert, AlertProps, Avatar, Dropdown, Menu } from "antd"
import awardwizImageUrl from "../wizard.png"
import CarbonLogout from "~icons/carbon/logout"
import { initializeApp } from "firebase/app"
import { getAuth, GoogleAuthProvider, signInWithCredential, User } from "firebase/auth"

const firebaseConfig = {
  apiKey: "AIzaSyCgu7EVRrz3LQnDypCJJDOX3BRUYHqVZus",
  authDomain: "awardwiz.firebaseapp.com",
  projectId: "awardwiz",
  storageBucket: "awardwiz.appspot.com",
  messagingSenderId: "416370374153",
  appId: "1:416370374153:web:12727dfb0493bf268b6ad8",
  measurementId: "G-6JPRBFR4Y6"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const auth = getAuth(app)

export const LoginScreen = ({ children }: { children: JSX.Element }) => {
  const [message, setMessage] = React.useState<{ type: AlertProps["type"], text: string }>({ type: undefined, text: "" })
  const [user, setUser] = React.useState<User>()

  React.useEffect(() => {
    setMessage({ type: "info", text: "Loading..." })
    auth.onAuthStateChanged((authUser) => {
      setUser(authUser ?? undefined)
    })
  }, [])

  React.useEffect(() => {
    console.log(`Current user logged in: ${user?.email ?? "(not logged in)"}`)
  }, [user])

  const onGoogleCredential = async (credentialResponse: CredentialResponse) => {
    console.log("Google credential received, logging into Firebase...")
    if (!credentialResponse.credential || !credentialResponse.clientId) { setMessage({ type: "error", text: "Failed to log in with Google" }); return }

    const idToken = credentialResponse.credential
    const credential = GoogleAuthProvider.credential(idToken)
    void signInWithCredential(auth, credential).catch((error) => {
      setMessage({ type: "error", text: `Failed to log into Firebase with Google credential: ${error.message}` })
      throw error
    })
  }

  // Logged in view
  if (user) {
    const avatarMenu = (
      <Menu items={[
        { key: "logOut", icon: <CarbonLogout />, label: "Log out", onClick: () => { void auth.signOut() } }
      ]} />
    )

    return (
      <>
        <Dropdown overlay={avatarMenu} trigger={["click"]}>
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
