const { Router } = require('express');
const verifyRequest = require("./verify-request.js");
const { getShopTokens, saveAbandonedCheckout } = require("../helpers/database.js");
const { setupAbandonedCheckoutReminder } = require("../helpers/aws.js");
const { orderWebhookTally } = require("../helpers/webhooks.js");

const router = Router();

const verifyRequestWrapped = (req, res, next) => verifyRequest(req.app)(req, res, next);


router.get("/orders", verifyRequestWrapped, async (req, res) => {
  const Shopify = req.app.get('shopify');
  const session = await Shopify.Utils.loadCurrentSession(req, res, false);
  const { Order } = await import(
    `@shopify/shopify-api/dist/rest-resources/${Shopify.Context.API_VERSION}/index.js`
  );
  let orderList;
  if (req.query.ids) {
    orderList = await Order.all({
      session,
      ids: req.query.ids
    });
  }
  else {
    orderList = await Order.all({ session });
  }
  // console.log(orderList);
  res.status(200).send(orderList);
});

router.get("/product-list", verifyRequestWrapped, async (req, res) => {
  console.log("product LIST route handler entered");
  const Shopify = req.app.get('shopify');
  const session = await Shopify.Utils.loadCurrentSession(req, res, false);
  const { Product } = await import(
    `@shopify/shopify-api/dist/rest-resources/${Shopify.Context.API_VERSION}/index.js`
  );
  const productList = await Product.all({ session });
  // console.log(productList);
  res.status(200).send(productList);
});

router.post("/abandoned-checkouts", async (req, res) => {
  const Shopify = req.app.get('shopify');
  console.log("Abandoned Checkouts-Request Body:\n", req.body);
  const shop = req.body.shop;

  const accessToken = await getShopTokens( req.app.get("db-client"), shop);

  const client = new Shopify.Clients.Rest(shop, accessToken);
  const response = await client.get({
    path:'checkouts',
    query:{
      created_at_min: (new Date( Date.now() - 1000*60*10 )).toISOString()  // orders created since last Cronjob
    }
  });
  console.log("Abandoned Checkout response:\n", response?.body?.checkouts[0]?.abandoned_checkout_url);

  await response.body.checkouts.forEach( async (checkout) => {
    await saveAbandonedCheckout( req.app.get("db-client"), checkout, shop);
    await setupAbandonedCheckoutReminder(checkout, shop);
  });
  res.status(200).send();

});

router.post("/webhook-tally", async (req, res) => {
  const Shopify = req.app.get('shopify');
  console.log("Webhhok-tally-Request Body:\n", req.body);
  const shop = req.body.shop;

  await orderWebhookTally(req.app.get('db-client'), Shopify, shop);
  res.status(200).send();

});


module.exports = router;
