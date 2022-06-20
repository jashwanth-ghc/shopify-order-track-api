// @ts-check
const { resolve } = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const { Shopify, ApiVersion } = require("@shopify/shopify-api");
require("dotenv").config();

const applyAuthMiddleware = require("./middleware/auth.js");
const verifyRequest = require("./middleware/verify-request.js");
const { addWebhookHandlers, orderWebhookTally } = require("./helpers/webhooks.js");
const { getDbClient, getShopTokens, SessionStore } = require("./helpers/database.js");
const apiRoutes = require ("./middleware/apis.js");
const { getObject } = require("../server/helpers/aws.js");

const USE_ONLINE_TOKENS = false;
const TOP_LEVEL_OAUTH_COOKIE = "shopify_top_level_oauth";

const PORT = parseInt(process.env.PORT || "8081", 10);
const isTest = process.env.NODE_ENV === "test" || !!process.env.VITE_TEST_BUILD;
const BASE_URL = process.env.BASE_URL;
// const BASE_URL = "";
const awsBuildBucket = process.env.BUILD_FILES_AWS_BUCKET_UI;

const ACTIVE_SHOPIFY_SHOPS = {};



// export for test use only
const createServer = async function(
  root = process.cwd(),
  isProd = process.env.NODE_ENV === "production"
) {
  const app = express();
  const dbClient = await getDbClient();

  Shopify.Context.initialize({
    API_KEY: process.env.SHOPIFY_API_KEY,
    API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
    SCOPES: process.env.SCOPES.split(","),
    HOST_NAME: process.env.HOST.replace(/https:\/\//, ""),
    API_VERSION: ApiVersion.April22,
    IS_EMBEDDED_APP: true,
    // This should be replaced with your preferred storage strategy
    SESSION_STORAGE: new SessionStore(dbClient),
  });

  app.set("db-client",dbClient);
  app.set("top-level-oauth-cookie", TOP_LEVEL_OAUTH_COOKIE);
  // app.set("active-shopify-shops", ACTIVE_SHOPIFY_SHOPS);
  app.set("use-online-tokens", USE_ONLINE_TOKENS);
  app.set("shopify", Shopify);
  app.set("base-url", BASE_URL);

  app.use(cookieParser(Shopify.Context.API_SECRET_KEY));

  addWebhookHandlers(Shopify, app.get("db-client"));
  
  applyAuthMiddleware(app);

  app.post("/webhooks", async (req, res) => {
    try {
      await Shopify.Webhooks.Registry.process(req, res);
      console.log(`Webhook processed, returned status code 200`);
    } catch (error) {
      console.log(`Failed to process webhook: ${error}`);
      if (!res.headersSent) {
        res.status(500).send(error.message);
      }
    }
  });

  app.post("/graphql", verifyRequest(app), async (req, res) => {
    try {
      const response = await Shopify.Utils.graphqlProxy(req, res);
      res.status(200).send(response.body);
    } catch (error) {
      res.status(500).send(error.message);
    }
  });

  app.use(express.json());

  app.use("/api", apiRoutes);

  app.use((req, res, next) => {
    const shop = req.query.shop;
    if (Shopify.Context.IS_EMBEDDED_APP && shop) {
      res.setHeader(
        "Content-Security-Policy",
        `frame-ancestors https://${shop} https://admin.shopify.com;`
      );
    } else {
      res.setHeader("Content-Security-Policy", `frame-ancestors 'none';`);
    }
    next();
  });

  app.use("/test-route", (req,res)=>{
    res.send({msg:"Test Message"});
  });

  app.use("/*", async (req, res, next) => {
    const { shop } = req.query;
    // Detect whether we need to reinstall the app, any request from Shopify will
    // include a shop in the query parameters.

    const activeShops = await getShopTokens( app.get("db-client") ) || {};
    if (activeShops[shop] === undefined && shop) {
      res.redirect(`${app.get("base-url")}/auth?${new URLSearchParams(req.query).toString()}`);
    }
    // if (app.get("active-shopify-shops")[shop] === undefined && shop) {
    //   res.redirect(`/auth?${new URLSearchParams(req.query).toString()}`);
    // } 
    else {
      next();
    }
  });

  /**
   * @type {import('vite').ViteDevServer}
   */
  let vite;
  if (!isProd) {
    // vite = await import("vite").then(({ createServer }) =>
    //   createServer({
    //     root,
    //     logLevel: isTest ? "error" : "info",
    //     server: {
    //       port: PORT,
    //       hmr: {
    //         protocol: "ws",
    //         host: "localhost",
    //         port: 64999,
    //         clientPort: 64999,
    //       },
    //       middlewareMode: "html",
    //     },
    //   })
    // );

    app.get("/*",async (req,res,next)=>{ 
      let objectKey = req.originalUrl.slice(1).split("?")[0];
      if( !(objectKey ==="" || objectKey === "index.html" || objectKey.slice(0,6) == "assets") ){
        next();
      }
      else{
        objectKey = objectKey || "index.html";

        const objStream = await getObject(awsBuildBucket, objectKey);

        if(objectKey==="index.html"){
        res.set("Content-Type", "text/html");
        }
        else if(objectKey.slice(-3) === ".js"){
          res.set("Content-Type", "application/javascript");
        }
        else if(objectKey.slice(-4) === ".css"){
          res.set("Content-Type", "text/css");
        }
        res.status(200);
        objStream.Body.pipe(res);
      }
      
      // res.send(`URL:${req.originalUrl}`);      
    });

    // app.use(vite.middlewares);
  } else {
    const compression = await import("compression").then(
      ({ default: fn }) => fn
    );
    const serveStatic = await import("serve-static").then(
      ({ default: fn }) => fn
    );
    const fs = await import("fs");
    app.use(compression());
    app.use(serveStatic(resolve("/tmp/dist/client")));
    app.use("/*", (req, res, next) => {
      // Client-side routing will pick up on the correct route to render, so we always render the index here
      res
        .status(200)
        .set("Content-Type", "text/html")
        .send(fs.readFileSync(resolve("/tmp/dist/client/index.html")));
        // .send(fs.readFileSync(`${process.cwd()}/dist/client/index.html`));
    });
  }

  return { app, vite };
}

module.exports.createServer = createServer;

if (!isTest) {
  createServer().then(({ app }) => app.listen(PORT));  
}
