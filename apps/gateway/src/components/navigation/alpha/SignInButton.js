import React from "react";

export function SignInButton(props) {
  return (
    // <GrayBorderButton className="nav-sign-in-btn" onClick={props.onSignIn}>
    <button style={{ textTransform: "lowercase !important" }} onClick={props.onSignIn}>login</button>
    // </GrayBorderButton>
  );
}
