const { MongoClient, ServerApiVersion } = require("mongodb");
const { Session } = require('@shopify/shopify-api/dist/auth/session/index.js');

const DB_URI = process.env.MONGO_URI;
const databaseClient = new MongoClient(DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1
});


class SessionStore {
  constructor(dbClient) {
    this.dbClient = dbClient;
    this.sessionCollection = this.dbClient.db("shopify-orders").collection("sessions");
    this.storeSession = this.storeSession.bind(this);
    this.loadSession = this.loadSession.bind(this);
    this.deleteSession = this.deleteSession.bind(this);
  }

  async storeSession(session) {
    try {
      const query = { id: session.id };
      const update = { $set: { id: session.id, session: session } };
      const options = { upsert: true };
      const response = await this.sessionCollection.updateOne(query, update, options);
      return true;
    }
    catch (err) {
      console.log(err);
      return false;
    }
  }

  async loadSession(id) {
    try {
      const document = await this.sessionCollection.findOne({id});

      /* isActive() method is lost from session object on serialization/de-serialization. It is required
         during verification of request. So session object has to be recreated */
      return Session.cloneSession(document.session, id);
    }
    catch (err) {
      console.log(err);
    }
  }

  async deleteSession(id){
    try {
      const response = await this.sessionCollection.deleteOne({id});
      return true;
    }
    catch (err) {
      console.log(err);
      return false;
    }
  }
}

module.exports.SessionStore = SessionStore;

module.exports.getDbClient = async function () {
  try {
    await databaseClient.connect();
    return databaseClient;
  }
  catch (err) {
    console.log(err);
  }
}


module.exports.persistToken = async function (dbClient, shop, token) {
  try {
    // await dbClient.connect();
    let shopCollection = dbClient.db("shopify-orders").collection("shops");
    const query = { shop: shop };
    const update = { $set: { shop: shop, access_token: token } };
    const options = { upsert: true };
    await shopCollection.updateOne(query, update, options);
  }
  catch (err) {
    console.log(err);
  }
  // finally{
  //   await dbClient.close();
  // }
}

module.exports.getShopTokens = async function (dbClient, shop = null) {
  try {
    // await dbClient.connect();
    let shopCollection = dbClient.db("shopify-orders").collection("shops");
    if (!shop) {
      const cursor = shopCollection.find();
      const shopTokens = {};
      await cursor.forEach(doc => shopTokens[doc.shop] = doc.access_token);
      return shopTokens;
    }
    else {
      const doc = await shopCollection.findOne({ shop: shop });
      return doc?.access_token;
    }
  }
  catch (err) {
    console.log(err);
  }
  // finally{
  //     await dbClient.close();
  // }
}

module.exports.deleteToken = async function (dbClient, shop) {
  try {
    // await dbClient.connect();
    let shopCollection = dbClient.db("shopify-orders").collection("shops");

    await shopCollection.deleteOne({ shop: shop });
    return true;
  }
  catch (err) {
    console.log(err);
  }
  // finally{
  //   await dbClient.close();
  // }
}

module.exports.saveWebhookOrder = async function (dbClient, orderDocument) {
  try {
    // await dbClient.connect();
    const db = dbClient.db('shopify-orders');
    const orderCollection = db.collection('orders');

    const query = { id: orderDocument.id };
    const update = { $setOnInsert: orderDocument };
    const options = { upsert: true };

    await orderCollection.updateOne(query, update, options);
  }
  catch (err) {
    console.log(err);
  }
  // finally{
  //   await dbClient.close();
  // }
}

module.exports.getWebhookOrders = async function (dbClient, shop) {
  try {
    // await dbClient.connect();
    const db = dbClient.db('shopify-orders');
    const orderCollection = db.collection('orders');

    // return await orderCollection.find().toArray();
    const orders = await orderCollection.find({ shop: shop }).toArray();

    return orders;
  }
  catch (err) {
    console.log(err);
  }
  // finally{
  //   await dbClient.close();
  // }
}

module.exports.saveAbandonedCheckout = async function (dbClient, checkout, shop) {
  try {
    shop = shop.split('.')[0];
    const db = dbClient.db(`shopify-${shop}`);
    const abandonedCheckoutCollection = db.collection('abandoned-checkouts');

    const query = { id: checkout.id };
    const update = { $setOnInsert: checkout };
    const options = { upsert: true };

    await abandonedCheckoutCollection.updateOne(query, update, options);
  }
  catch (err) {
    console.log(err);
  }
}