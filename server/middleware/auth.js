const { Shopify } = require("@shopify/shopify-api");

const topLevelAuthRedirect = require("../helpers/top-level-auth-redirect.js");
const { persistToken } = require("../helpers/database.js");
const { setupSchedulers } = require("../helpers/aws");

// async function setupOrderWebhookTallyJob(shop){
//   const putRuleCommand = new PutRuleCommand({
//     Name: `orderWebhookTally-${shop}`,
//     ScheduleExpression: "cron(0/2 * * * ? *)",
//     State: "ENABLED"
//   });
//   const putTargetsCommand = new PutTargetsCommand({
//     Rule: `orderWebhookTally-${shop}`,
//     Targets:[
//       {
//         Id: "AppAPI",
//         Arn: process.env.AWS_SQS_ARN,
//         Input: JSON.stringify({
//           msg:"Test message",
//           shop: shop
//         })
//       }
//     ]
//   })
//   try{
//     const data1 = await ebClient.send(putRuleCommand);
//     console.log("data1 :\n" ,data1);
//     if(data1){
//       const data2 = await ebClient.send(putTargetsCommand);
//       console.log("data2:\n" ,data2);
//     }
//   }
//   catch(err){
//     console.log(err);
//   }
// }

module.exports = function applyAuthMiddleware(app) {
  app.get("/auth", async (req, res) => {
    console.log("Entered auth flow");
    console.log("Base URL: ", app.get("base-url"))
    if (!req.signedCookies[app.get("top-level-oauth-cookie")]) {
      console.log("Entered If block");
      return res.redirect(
        `${app.get("base-url")}/auth/toplevel?${new URLSearchParams(req.query).toString()}`
      );
    }

    const redirectUrl = await Shopify.Auth.beginAuth(
      req,
      res,
      req.query.shop,
      "/auth/callback",
      app.get("use-online-tokens")
    );
    console.log(redirectUrl);

    res.redirect(redirectUrl);
  });

  app.get("/auth/toplevel", (req, res) => {
    console.log("entered top-level auth route");
    res.cookie(app.get("top-level-oauth-cookie"), "1", {
      signed: true,
      httpOnly: true,
      sameSite: "strict",
    });

    res.set("Content-Type", "text/html");

    console.log("topLevelRedir Params: ",{
      apiKey: Shopify.Context.API_KEY,
      hostName: Shopify.Context.HOST_NAME,
      host: req.query.host,
      query: req.query,
      baseURL: app.get("base-url")
    });

    res.send(
      topLevelAuthRedirect({
        apiKey: Shopify.Context.API_KEY,
        hostName: Shopify.Context.HOST_NAME,
        host: req.query.host,
        query: req.query,
        baseURL: app.get("base-url")
      })
    );
  });

  app.get("/auth/callback", async (req, res) => {
    try {
      console.log("entered auth-call back route");
      const session = await Shopify.Auth.validateAuthCallback(
        req,
        res,
        req.query
      );

      console.log("Session Object:");
      console.log(session);

      const host = req.query.host;
      // app.set(
      //   "active-shopify-shops",
      //   Object.assign(app.get("active-shopify-shops"), {
      //     [session.shop]: session,
      //   })
      // );
      console.log("BEFORE PERSIST TOKEN: \n", app.get("db-client").db);
      await persistToken(app.get("db-client"), session.shop, session.accessToken);      

      const response = await Shopify.Webhooks.Registry.registerAll({
        shop: session.shop,
        accessToken: session.accessToken
      });

      //setup schedulers for services      
      await setupSchedulers(session.shop);

      // Redirect to app with shop parameter upon auth
      res.redirect(`${app.get("base-url")}/?shop=${session.shop}&host=${host}`);
    } catch (e) {
      switch (true) {
        case e instanceof Shopify.Errors.InvalidOAuthError:
          res.status(400);
          res.send(e.message);
          break;
        case e instanceof Shopify.Errors.CookieNotFound:
        case e instanceof Shopify.Errors.SessionNotFound:
          // This is likely because the OAuth session cookie expired before the merchant approved the request
          res.redirect(`${app.get("base-url")}/auth?shop=${req.query.shop}`);
          break;
        default:
          res.status(500);
          res.send(e.message);
          break;
      }
    }
  });
}
