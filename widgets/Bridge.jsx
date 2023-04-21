const externalAppUrl = props.externalAppUrl || "";

if (externalAppUrl === "") {
  return <p>please provide an app url.</p>;
}

/**
 * Initial Path (optional but recommended)
 */
const path = props.path;
/**
 * Initial view height (optional but recommended)
 */
const initialViewHeight = 500;
const initialPayload = {};

/**
 * Request Handlers - Backend.
 *
 * - request: payload sent by External App
 *
 * - response: method to send the answer back to the External App
 *
 * - utils: Utils features like
 *      - promisify: (caller, resolve, reject)
 *      There's no Promisse for some features yet, So this is util for when you need to get cached data using DiscoveryAPI, e.g:
 *      utils.promisify(() => Social.getr(`${context.accountId}/profile`), (res) => console.log(res), (err) => console.log(err))
 *
 * @param {{type: string, payload: {}}} request request with payload sent by External App
 * @param {(request) => {send: () => void}} response send the answer back to the External App
 * @param {{promisify:(caller: () => void, resolve: (data) => void, reject: (error) => void)}} utils Utils features like
 */
const requestHandler = (request, response, Utils) => {
  switch (request.type) {
    case "create-thing":
      handleCreateThing(request, response);
      break;
  }
};

const handleCreateThing = (request, response) => {
  const { payload } = request;
  if (payload) {
    Social.set(
      {
        thing: {
          main: JSON.stringify({
            payload,
          }),
        },
        index: {
          everything: JSON.stringify({
            key: "main",
            value: {
              type: props.type,
            },
          }),
        },
      },
      {
        force: true,
        onCommit: () => {
          response(request).send({ success: true });
        },
        onCancel: () => {
          response(request).send({ error: "the action was canceled" });
        },
      }
    );
  }
};

return (
  <Widget
    src={"wendersonpires.near/widget/NearSocialBridgeCore"}
    props={{
      externalAppUrl,
      path,
      initialViewHeight,
      initialPayload,
      requestHandler,
    }}
  />
);
