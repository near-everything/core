const externalAppUrl = "https://strike-card.vercel.app/";

/**
 * Request Handlers - Backend.
 *
 * - request: payload sent by External App
 *
 * - response: method to send const externalAppUrl = "https://strike-card.vercel.app/";

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
    case "sign-card":
      handleSignCard(request, response);
      break;
  }
};

const handleSignCard = (request, response) => {
  const { payload } = request;
  if (payload) {
    asyncFetch("https://2ed0-172-56-161-197.ngrok.io/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Strike-Card": "simple",
      },
      body: JSON.stringify({
        query:
          'mutation signCard($firstName: String = "", $lastName: String = "", $email: String = "", $phone: String = "", $sponsor: String = "", $consent: Boolean = false) { signatures { create(firstName: $firstName, lastName: $lastName, email: $email, phone: $phone, sponsor: $sponsor, consent: $consent) { message } } }',
        variables: payload,
      }),
    }).then((res) => {
      if (res.body.errors) {
        response(request).send(res.body.error);
      } else {
        response(request).send(res.body.data);
      }
    });
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
