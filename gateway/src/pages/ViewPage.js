import { Widget } from "near-social-vm";
import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useParams } from "react-router-dom";
import { useHashUrlBackwardsCompatibility } from "../hooks/useHashUrlBackwardsCompatibility";
import { useQuery } from "../hooks/useQuery";
import useRedirectMap from "../hooks/useRedirectMap";
import { recordClick, recordPageView } from "../utils/analytics";

export default function ViewPage(props) {
  const [shouldWaitForMap, redirectMap, loaderError, loaderUrl] =
    useRedirectMap();

  const { widgetSrc } = useParams();
  const query = useQuery();
  const [widgetProps, setWidgetProps] = useState({});

  const src = widgetSrc || props.widgets.default;
  const setWidgetSrc = props.setWidgetSrc;
  const viewSourceWidget = props.widgets.viewSource;

  useHashUrlBackwardsCompatibility();

  useEffect(() => {
    setWidgetProps(Object.fromEntries([...query.entries()]));
  }, [query]);

  useEffect(() => {
    // Displays the Zendesk widget only if user is signed in and on the home page
    if (!props.signedIn || !!widgetSrc) {
      zE("webWidget", "hide");
      return;
    }
    localStorage.setItem("accountId", props.signedAccountId);
    zE("webWidget", "show");
  }, [props.signedIn, widgetSrc]);

  useEffect(() => {
    setTimeout(() => {
      recordPageView(src);
      setWidgetSrc(
        src === viewSourceWidget && query.get("src")
          ? {
              edit: query.get("src"),
              view: null,
            }
          : {
              edit: src,
              view: src,
            }
      );
    }, 1);
  }, [src, query, setWidgetSrc, viewSourceWidget]);

  return (
    <>
      <Helmet>
        <title>{props.meta.title}</title>
        <meta name="description" content={props.meta.description} />
        <meta property="og:title" content={props.meta.title} />
        <meta property="og:description" content={props.meta.description} />
      </Helmet>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
        }}
        onPointerUp={recordClick}
      >
        {loaderUrl && (
          <div
            style={{
              backgroundColor: "#FFF2CD",
              color: "#664D04",
              display: "flex",
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              height: "2rem",
              columnGap: "8px",
            }}
          >
            <span>Loading components from: {loaderUrl}</span>
            {props.flags?.bosLoaderUrl && (
              <button
                className="btn btn-outline"
                onClick={() => props.setFlags?.({ bosLoaderUrl: null })}
              >
                <i className="bi bi-x" />
              </button>
            )}
          </div>
        )}
        {loaderError && (
          <div style={{ padding: "16px" }}>
            BOS Loader fetch error, see console logs. CORS errors may be
            misleading and mean your endpoint cannot be reached
          </div>
        )}
        <div className="container-xl">
          <div className="row">
            <div
              className="d-inline-block position-relative overflow-hidden"
              style={{
                "--body-top-padding": "24px",
                paddingTop: "var(--body-top-padding)",
              }}
            >
              {(!shouldWaitForMap || redirectMap) && (
                <div>
                  <Widget
                    config={{ redirectMap: redirectMap }}
                    key={props.widgets.wrapper}
                    src={props.widgets.wrapper}
                    props={{
                      children: (
                        <Widget
                          config={{ redirectMap: redirectMap }}
                          key={props.tos.checkComponentPath}
                          src={props.tos.checkComponentPath}
                          props={{
                            logOut: props.logOut,
                            targetProps: widgetProps,
                            targetComponent: src,
                            tosName: props.tos.contentComponentPath,
                          }}
                        />
                      ),
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
