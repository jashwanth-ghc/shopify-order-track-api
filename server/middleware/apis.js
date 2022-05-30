const { Router } = require('express');
const verifyRequest = require("./verify-request.js");
const { Shopify, ApiVersion } = require("@shopify/shopify-api");

const router = Router();

Shopify.Context.initialize({
    API_KEY: process.env.SHOPIFY_API_KEY,
    API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
    SCOPES: process.env.SCOPES.split(","),
    HOST_NAME: process.env.HOST.replace(/https:\/\//, ""),
    API_VERSION: ApiVersion.April22,
    IS_EMBEDDED_APP: true,
    // This should be replaced with your preferred storage strategy
    SESSION_STORAGE: new Shopify.Session.MemorySessionStorage(),
  });

const verifyRequestWrapped = (req,res,next) => verifyRequest(req.app)(req,res,next);


router.get("/orders", verifyRequestWrapped, async (req, res) => {
    const session = await Shopify.Utils.loadCurrentSession(req, res, false);
    const { Order } = await import(
      `@shopify/shopify-api/dist/rest-resources/${Shopify.Context.API_VERSION}/index.js`
    );
    let orderList;
    if(req.query.ids){
      orderList = await Order.all({ 
            session,
            ids: req.query.ids
           });
    }
    else{
      orderList = await Order.all({ session });
    }
    // console.log(orderList);
    res.status(200).send(orderList);
});

router.get("/product-list", verifyRequestWrapped, async (req, res) => {
    // console.log("Entered product list route");
    const session = await Shopify.Utils.loadCurrentSession(req, res, false);
    const { Product } = await import(
        `@shopify/shopify-api/dist/rest-resources/${Shopify.Context.API_VERSION}/index.js`
    );
    const productList = await Product.all({ session });
    // console.log(productList);
    res.status(200).send(productList);
});


module.exports = router;
