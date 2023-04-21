// Repository: https://github.com/near-everything/type-creator
// const externalAppUrl = "https://type-creator.vercel.app/";
const externalAppUrl = "https://649451d514cd.ngrok.app/";
const accountId = context.accountId;

const types = Social.keys("evrything.near/type/*", "final", {
  return_type: "BlockHeight",
  values_only: true,
});
types = Object.entries(types["evrything.near"].type ?? {});
types = types.map(item => item[0])

/**
 * Initial Path (optional but recommended)
 */
const path = props.path;
/**
 * Initial view height (optional but recommended)
 */
const initialViewHeight = 500;
const initialPayload = {
  types
};

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
    case "create-type":
      handleCreateType(request, response);
      break;
  }
};

const handleCreateType = (request, response) => {
  const { payload } = request;
  if (payload) {
    Social.set(
      {
        type: {
          [payload.name]: {
            "": JSON.stringify({
              properties: payload.properties,
              widgets: {
                summary: `${accountId}/widget/Everything.Summary.${payload.name}`,
                view: `${accountId}/widget/Everything.View.${payload.name}`,
                create: `${accountId}/widget/Everything.Create.${payload.name}`,
              },
            }),
          },
        },
        widget: {
          [`Everything.Summary.${payload.name}`]: {
            "": `const data= props.data; return (<><p>Configure <a href="/#/edit/${accountId}/widget/Everything.Summary.${payload.name}">this widget</a> to attractively display your data below:</p><p>{JSON.stringify(data)}</p></>);`,
          },
          [`Everything.View.${payload.name}`]: {
            "": `const data= props.data; return (<><p>Configure <a href="/#/edit/${accountId}/widget/Everything.View.${payload.name}">this widget</a>to attractively display your data below:</p><p>{JSON.stringify(data)}</p></>);`,
          },
          [`Everything.Create.${payload.name}`]: {
            "": `return (<><p>Click deploy below then put the app url in the <a href="/#/edit/${accountId}/widget/Everything.Create.${payload.name}">create widget</a>.</p><a href="https://vercel.com/new/clone?repository-url=https://github.com/near-everything/thing-creator" target="_blank"><img src="https://vercel.com/button" alt="Deploy with Vercel" /></a><Widget src={"evrything.near/widget/Bridge"} props={{ externalAppUrl: "", type: "${accountId}/type/${payload.name}" }} /></>);`,
          },
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
    return;
  }
  // Error
  response(request).send({
    error: "type must be provided",
  });
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
