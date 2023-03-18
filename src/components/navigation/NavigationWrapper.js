import React, { useEffect, useState } from "react";
import { MobileNavigation } from "./mobile/MobileNavigation";

export function NavigationWrapper(props) {
  const [matches, setMatches] = useState(
    window.matchMedia("(min-width: 992px)").matches
  );

  const { buffer } = props;

  useEffect(() => {
    window
      .matchMedia("(min-width: 992px)")
      .addEventListener("change", (e) => setMatches(e.matches));
  }, []);
  return (
    <>
      {/* {matches && <DesktopNavigation {...props} />} */}
      <MobileNavigation {...props} />
      <div style={{ height: buffer }} />
    </>
  );
}
